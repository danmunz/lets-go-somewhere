import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { ROSTER, type RosterUser } from '../src/store.js';

/**
 * The release rehearsal exercises the same authenticated HTTP boundary that
 * the browser uses, with five disposable Firebase Auth Emulator accounts.
 * These identities are deliberately not the real roster addresses and this
 * suite is only included by `npm run test:emulator`.
 */
describe.runIf(process.env.LGS_TEST_MODE === 'emulator')('five-identity authenticated rehearsal', () => {
  const projectId = 'lgs-emulator-test';
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const emails: Record<RosterUser, string> = Object.fromEntries(
    ROSTER.map((user) => [user, `${user}@rehearsal.invalid`]),
  ) as Record<RosterUser, string>;
  const tokens = new Map<RosterUser, string>();
  const collectionNames = ['lgsV4Users', 'lgsV4State', 'lgsV4ResultSnapshots'];

  const headersFor = (user: RosterUser) => ({
    Authorization: `Bearer ${tokens.get(user) ?? ''}`,
    'content-type': 'application/json',
  });

  const request = (user: RosterUser, path: string, init?: RequestInit) =>
    app.request(path, { ...init, headers: { ...headersFor(user), ...init?.headers } });

  async function createEmulatorIdentity(user: RosterUser): Promise<string> {
    const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=rehearsal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: emails[user], password: 'rehearsal-password', returnSecureToken: true }),
    });
    const payload = await response.json() as { idToken?: string; error?: unknown };
    if (!response.ok || !payload.idToken) throw new Error(`Could not create ${user}'s emulator identity: ${JSON.stringify(payload.error)}`);
    return payload.idToken;
  }

  async function clearState() {
    if (!getApps().length) initializeApp({ projectId });
    const database = getFirestore();
    await Promise.all(collectionNames.map(async (name) => {
      const documents = await database.collection(name).listDocuments();
      await Promise.all(documents.map((document) => document.delete()));
    }));
    const response = await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Could not clear Auth Emulator state (${response.status}).`);
    tokens.clear();
  }

  async function next(user: RosterUser) {
    const response = await request(user, '/v1/comparison/next');
    expect(response.status).toBe(200);
    return await response.json() as {
      complete: boolean;
      progress?: { comparisons: number; minimum: number; maximum: number; estimatedCompletion: number; phase: string };
      activityA?: { id: string };
      activityB?: { id: string };
    };
  }

  async function choose(user: RosterUser, pair: { activityA?: { id: string }; activityB?: { id: string } }) {
    const response = await request(user, '/v1/comparisons', {
      method: 'POST',
      body: JSON.stringify({ activityA: pair.activityA!.id, activityB: pair.activityB!.id, winner: pair.activityA!.id }),
    });
    expect(response.status).toBe(200);
  }

  async function complete(user: RosterUser, startingComparisons = 0) {
    for (let expected = startingComparisons; expected < 32; expected += 1) {
      const offered = await next(user);
      expect(offered.complete).toBe(false);
      expect(offered.progress).toMatchObject({ comparisons: expected, minimum: 32, maximum: 32 });
      expect(offered.activityA?.id).toBeTruthy();
      expect(offered.activityB?.id).toBeTruthy();
      await choose(user, offered);
    }
    const done = await next(user);
    expect(done).toEqual({ complete: true, completion: { complete: true, reason: 'fixed-round-complete' } });
  }

  type LightningOffer = {
    complete: boolean;
    revision?: number;
    progress: { comparisons: number; core: 48; maximum: 60; phase: 'core' | 'tie-breakers' };
    destinationA?: { id: string; name: string; country: string };
    destinationB?: { id: string; name: string; country: string };
  };

  async function nextLightning(user: RosterUser): Promise<LightningOffer> {
    const response = await request(user, '/v1/lightning-round/comparison/next');
    expect(response.status).toBe(200);
    return await response.json() as LightningOffer;
  }

  async function finishLightningRanking(user: RosterUser) {
    const seenPairs = new Set<string>();
    let first = await nextLightning(user);
    // A refresh/resume must preserve the same outstanding direct comparison.
    const resumed = await nextLightning(user);
    expect(resumed).toMatchObject({
      complete: first.complete,
      revision: first.revision,
      destinationA: { id: first.destinationA?.id },
      destinationB: { id: first.destinationB?.id },
    });

    while (!first.complete) {
      expect(first.progress.comparisons).toBeGreaterThanOrEqual(0);
      expect(first.progress.comparisons).toBeLessThanOrEqual(60);
      expect(first.destinationA).toMatchObject({ id: expect.any(String), name: expect.any(String), country: expect.any(String) });
      expect(first.destinationB).toMatchObject({ id: expect.any(String), name: expect.any(String), country: expect.any(String) });
      const pair = [first.destinationA!.id, first.destinationB!.id].sort().join('\u0000');
      expect(seenPairs.has(pair)).toBe(false);
      seenPairs.add(pair);
      const accepted = await request(user, '/v1/lightning-round/comparisons', {
        method: 'POST',
        body: JSON.stringify({
          destinationA: first.destinationA!.id,
          destinationB: first.destinationB!.id,
          winner: first.destinationA!.id,
          revision: first.revision,
        }),
      });
      expect(accepted.status).toBe(200);
      first = await nextLightning(user);
    }

    expect(seenPairs.size).toBeGreaterThanOrEqual(48);
    expect(seenPairs.size).toBeLessThanOrEqual(60);
    return seenPairs.size;
  }

  beforeAll(() => {
    // `authenticate` reads this at request time. These are test-only aliases
    // and are never accepted by the deployed service.
    process.env.ROSTER_EMAILS = JSON.stringify(emails);
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId });
  });
  beforeEach(clearState);
  afterAll(async () => {
    await clearState();
    delete process.env.ROSTER_EMAILS;
  });

  it('takes five isolated travelers from mismatch recovery through a sealed, immutable reveal', async () => {
    for (const user of ROSTER) tokens.set(user, await createEmulatorIdentity(user));

    // A selected Dan paired with John's Auth session sees John at the session
    // boundary, which is the safe signal the client uses to offer recovery.
    const mismatchedSession = await request('john', '/v1/session');
    expect(mismatchedSession.status).toBe(200);
    expect(await mismatchedSession.json()).toMatchObject({ user: 'john', roster: [...ROSTER] });

    // Before completion, neither Atlas nor group result data leaks.
    const lockedAtlas = await request('dan', '/v1/atlas');
    expect(lockedAtlas.status).toBe(409);
    const lockedGroup = await request('dan', '/v1/results/group');
    expect(lockedGroup.status).toBe(423);
    const lockedRaw = JSON.stringify(await lockedGroup.json());
    expect(lockedRaw).not.toMatch(/destination|country|score|rank|activityA|activityB|winner/i);

    // Refresh/resume returns the exact pending pair. A duplicate/stale send
    // is rejected and cannot append a second answer.
    const offered = await next('dan');
    expect(offered.progress).toMatchObject({ comparisons: 0, minimum: 32, maximum: 32 });
    const resumed = await next('dan');
    expect(resumed).toMatchObject({
      complete: false,
      activityA: { id: offered.activityA?.id },
      activityB: { id: offered.activityB?.id },
    });
    await choose('dan', offered);
    const duplicate = await request('dan', '/v1/comparisons', {
      method: 'POST',
      body: JSON.stringify({ activityA: offered.activityA!.id, activityB: offered.activityB!.id, winner: offered.activityA!.id }),
    });
    expect(duplicate.status).toBe(409);
    expect((await next('dan')).progress).toMatchObject({ comparisons: 1, minimum: 32, maximum: 32 });

    // Dan cannot open the envelope early. Finish Dan first to validate the
    // private post-game surfaces while the crew stays sealed.
    await complete('dan', 1);
    const danProfile = await request('dan', '/v1/profile');
    expect(danProfile.status).toBe(200);
    expect(JSON.stringify(await danProfile.json())).not.toMatch(/destination|country|rank|score|confidence|interval/i);
    const danAtlas = await request('dan', '/v1/atlas');
    expect(danAtlas.status).toBe(200);
    expect((await danAtlas.json() as { destinations: unknown[] }).destinations).toHaveLength(24);
    const danWaiting = await request('dan', '/v1/group-status');
    expect(danWaiting.status).toBe(200);
    expect(await danWaiting.json()).toMatchObject({ allComplete: false, revealOpen: false });
    const earlyReveal = await request('dan', '/v1/reveal', { method: 'POST' });
    expect(earlyReveal.status).toBe(409);
    const privateResults = await request('dan', '/v1/results/me');
    expect(privateResults.status).toBe(200);
    const privatePayload = await privateResults.json() as { results: unknown[]; snapshotId?: string };
    expect(privatePayload.results).toHaveLength(5);
    expect(privatePayload).not.toHaveProperty('snapshotId');

    // The remaining four identities make exactly 32 choices. The organizer
    // restriction is independent of who has completed.
    const nonOrganizerReveal = await request('james', '/v1/reveal', { method: 'POST' });
    expect(nonOrganizerReveal.status).toBe(403);
    for (const user of ['james', 'john', 'matt', 'peter'] as const) await complete(user);

    const ready = await request('dan', '/v1/group-status');
    expect(await ready.json()).toMatchObject({ allComplete: true, revealOpen: false });
    const opened = await request('dan', '/v1/reveal', { method: 'POST' });
    expect(opened.status).toBe(200);
    const reveal = await opened.json() as { revealOpen: true; snapshotId: string };
    expect(reveal).toMatchObject({ revealOpen: true, snapshotId: expect.stringMatching(/^reveal-/) });

    // Every caller sees the same stored reveal snapshot, and each person's
    // private top five is preserved rather than recalculated at reveal time.
    for (const user of ROSTER) {
      const personal = await request(user, '/v1/results/me');
      expect(personal.status).toBe(200);
      const personalPayload = await personal.json() as { snapshotId?: string; results: unknown[] };
      expect(personalPayload.snapshotId).toBe(reveal.snapshotId);
      expect(personalPayload.results).toHaveLength(5);
    }
    const group = await request('peter', '/v1/results/group');
    expect(group.status).toBe(200);
    const groupPayload = await group.json() as { snapshotId: string; group: Array<{ id: string }> };
    expect(groupPayload.snapshotId).toBe(reveal.snapshotId);
    expect(groupPayload.group).toHaveLength(5);

    // The reveal is the end of the in-app flow. The group discusses its
    // transparent results together rather than recording a final vote here.
    expect((await request('dan', '/v1/final-decision')).status).toBe(404);
  }, 120_000);

  it('takes all five authenticated travelers through the persisted Lightning Round, vetoes, and immutable second envelope', async () => {
    for (const user of ROSTER) tokens.set(user, await createEmulatorIdentity(user));

    // The original envelope is already covered by the first rehearsal. Here
    // we create it via that same public flow so Lightning's opening guard is
    // exercised against the Firestore-backed original result.
    for (const user of ROSTER) await complete(user);
    expect((await request('dan', '/v1/reveal', { method: 'POST' })).status).toBe(200);

    // No second-envelope information leaks before all five rankings and
    // explicit (including zero-veto) veto submissions are saved.
    expect((await request('dan', '/v1/lightning-round/results/group')).status).toBe(423);
    expect((await request('james', '/v1/lightning-round/reveal', { method: 'POST' })).status).toBe(403);

    const rankingLengths = new Map<RosterUser, number>();
    for (const user of ROSTER) rankingLengths.set(user, await finishLightningRanking(user));
    for (const count of rankingLengths.values()) {
      expect(count).toBeGreaterThanOrEqual(48);
      expect(count).toBeLessThanOrEqual(60);
    }

    const personalBeforeVeto = await request('dan', '/v1/lightning-round/results/me');
    expect(personalBeforeVeto.status).toBe(200);
    const danList = await personalBeforeVeto.json() as {
      destinations: Array<{ id: string }>;
      comparisonTrail: Array<{ order: number; winnerId: string; loserId: string }>;
      vetoes: { submitted: boolean; destinationIds: string[] };
    };
    expect(danList.destinations).toHaveLength(24);
    expect(danList.comparisonTrail).toHaveLength(rankingLengths.get('dan'));
    expect(danList.comparisonTrail.map(({ order }) => order)).toEqual(Array.from({ length: danList.comparisonTrail.length }, (_, index) => index + 1));
    expect(danList.vetoes).toEqual({ submitted: false, destinationIds: [] });

    const vetoes: Record<RosterUser, readonly string[]> = {
      dan: danList.destinations.slice(-2).map(({ id }) => id),
      james: [],
      john: [danList.destinations[0]!.id],
      matt: [danList.destinations[1]!.id, danList.destinations[2]!.id],
      peter: [],
    };
    for (const user of ROSTER) {
      const saved = await request(user, '/v1/lightning-round/vetoes', {
        method: 'POST', body: JSON.stringify({ destinationIds: vetoes[user] }),
      });
      expect(saved.status).toBe(200);
    }

    const ready = await request('dan', '/v1/lightning-round/group-status');
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ revealOpen: false, allComplete: true, members: ROSTER.map((user) => ({ user, complete: true })) });
    const opened = await request('dan', '/v1/lightning-round/reveal', { method: 'POST' });
    expect(opened.status).toBe(200);
    const opening = await opened.json() as { revealOpen: true; snapshotId: string };
    expect(opening.snapshotId).toMatch(/^lightning-/);

    // Every traveler reloads the exact same second envelope. Vetoes are an
    // overlay on the transparent ranking, not a hidden scoring adjustment.
    let canonicalPayload = '';
    for (const user of ROSTER) {
      const result = await request(user, '/v1/lightning-round/results/group');
      expect(result.status).toBe(200);
      const payload = await result.json() as {
        snapshotId: string;
        members: Array<{ user: RosterUser; vetoedDestinationIds: string[] }>;
        group: Array<{ destinationId: string; vetoedBy: RosterUser[] }>;
      };
      expect(payload.snapshotId).toBe(opening.snapshotId);
      expect(payload.members).toHaveLength(5);
      expect(payload.group).toHaveLength(24);
      expect(payload.members.find((member) => member.user === user)?.vetoedDestinationIds).toEqual([...vetoes[user]].sort());
      if (!canonicalPayload) canonicalPayload = JSON.stringify(payload);
      else expect(JSON.stringify(payload)).toBe(canonicalPayload);
    }

    const postRevealVeto = await request('dan', '/v1/lightning-round/vetoes', {
      method: 'POST', body: JSON.stringify({ destinationIds: [] }),
    });
    expect(postRevealVeto.status).toBe(409);
  }, 300_000);
});
