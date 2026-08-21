import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getSeedVersion } from '../src/model/snapshot.js';
import { buildGroupResultsResponse } from '../src/dto/one-trip.js';
import { buildTransparentSocialBallot } from '../src/results/social-ballot.js';
import {
  StoreConflictError,
  claimPendingAndAppendComparison,
  createOrGetRevealSnapshot,
  destinations,
  getRevealSnapshot,
  getStoredUserState,
  setPending,
  type RevealSnapshotInput,
} from '../src/store.js';

/**
 * This suite deliberately exercises the Firestore adapter, rather than the
 * memory seam used by the fast unit tests. It only runs inside the isolated
 * Firebase Emulator project configured by `npm run test:emulator`.
 */
describe.runIf(process.env.LGS_TEST_MODE === 'emulator')('Firestore transaction adapter', () => {
  const collectionNames = ['lgsV4Users', 'lgsV4State', 'lgsV4ResultSnapshots'];
  const finalistIds = ['antigua', 'oaxaca', 'quito', 'lima', 'medellin'];

  /** A schema-valid persisted result, deliberately independent of live ranking. */
  const revealInput = (modelVersion = 'emulator-ballot-v2'): RevealSnapshotInput => {
    const userSummary = {
      topFive: finalistIds,
      profileThemes: ['Adventure', 'Wild places'],
      profile: {
        headline: 'A travel shape',
        synthesis: 'A clear travel shape.',
        dimensions: [
          { key: 'adventure' as const, label: 'Adventure', strength: 'strong' as const, direction: 'drawn-to' as const },
          { key: 'nature' as const, label: 'Wild places', strength: 'present' as const, direction: 'drawn-to' as const },
        ],
        confidenceLabel: 'clear-shape' as const,
      },
      personalResults: {
        confidence: { label: 'close-call' as const, summary: 'Close choices.' },
        topFive: finalistIds.map((id, index) => ({
          rank: index + 1,
          id,
          fitLabel: index === 0 ? 'strong-match' as const : 'contender' as const,
          interval: { low: 0, high: 1 },
          explanation: { themes: ['Adventure', 'Wild places'], matchedActivityCount: 1, encounteredActivityCount: 1 },
        })),
      },
    };
    const users = {
      dan: userSummary, james: userSummary, john: userSummary, matt: userSummary, peter: userSummary,
    };
    return {
      schemaVersion: 2,
      modelVersion,
      seedVersion: getSeedVersion(),
      inputDigest: 'e'.repeat(64),
      users,
      group: buildTransparentSocialBallot({
        ballots: { dan: finalistIds, james: finalistIds, john: finalistIds, matt: finalistIds, peter: finalistIds },
        profileThemes: { dan: ['Adventure'], james: ['Adventure'], john: ['Adventure'], matt: ['Adventure'], peter: ['Adventure'] },
        destinationNames: Object.fromEntries(finalistIds.map((id) => [id, id])),
      }),
    };
  };

  async function clearEmulatorState() {
    if (!getApps().length) initializeApp({ projectId: 'lgs-emulator-test' });
    const database = getFirestore();
    await Promise.all(collectionNames.map(async (name) => {
      const documents = await database.collection(name).listDocuments();
      await Promise.all(documents.map((document) => document.delete()));
    }));
  }

  beforeEach(clearEmulatorState);
  afterAll(clearEmulatorState);

  it('durably accepts exactly one concurrent claim and keeps the stamped answer', async () => {
    await setPending('dan', ['oaxaca-ruins', 'lima-barranco']);
    const input = { activityA: 'oaxaca-ruins', activityB: 'lima-barranco', winner: 'oaxaca-ruins', revision: 0 };

    const claims = await Promise.allSettled([
      claimPendingAndAppendComparison('dan', input),
      claimPendingAndAppendComparison('dan', input),
    ]);

    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    expect(claims.find((claim) => claim.status === 'rejected')).toMatchObject({
      reason: expect.objectContaining<Partial<StoreConflictError>>({ code: 'pending-missing' }),
    });
    await expect(getStoredUserState('dan')).resolves.toMatchObject({
      revision: 1,
      pending: null,
      seedVersion: expect.stringMatching(/^[a-f0-9]{64}$/),
      comparisons: [expect.objectContaining({ ordinal: 1, selectorVersion: 'information-gain-v1' })],
    });
  });

  it('rejects a stale revision without consuming the outstanding offer', async () => {
    await setPending('james', ['oaxaca-ruins', 'lima-barranco']);
    await expect(claimPendingAndAppendComparison('james', {
      activityA: 'oaxaca-ruins', activityB: 'lima-barranco', winner: 'oaxaca-ruins', revision: 1,
    })).rejects.toMatchObject<Partial<StoreConflictError>>({ code: 'pending-revision-mismatch' });

    await expect(getStoredUserState('james')).resolves.toMatchObject({
      revision: 0,
      pending: expect.objectContaining({ activityA: 'oaxaca-ruins', activityB: 'lima-barranco', revision: 0 }),
      comparisons: [],
    });
  });

  it('stores one identical immutable snapshot when organizer reveal opens race', async () => {
    const opened = await Promise.all([
      createOrGetRevealSnapshot(revealInput('first-racing-request')),
      createOrGetRevealSnapshot(revealInput('second-racing-request')),
    ]);

    expect(opened[1]).toEqual(opened[0]);
    expect(opened[0].snapshotId).toMatch(/^reveal-/);
    // Either racing transaction may win; only one winner may become public.
    expect(['first-racing-request', 'second-racing-request']).toContain(opened[0].modelVersion);
    const storedSnapshots = await getFirestore().collection('lgsV4ResultSnapshots').listDocuments();
    expect(storedSnapshots).toHaveLength(1);
    await expect(getRevealSnapshot()).resolves.toEqual(opened[0]);
  }, 15_000);

  it('reloads the exact persisted snapshot facts rather than recalculating a new reveal', async () => {
    const opened = await createOrGetRevealSnapshot(revealInput('stored-model'));
    const reload = await getRevealSnapshot();
    const raw = await getFirestore().collection('lgsV4ResultSnapshots').doc(opened.snapshotId).get();

    expect(raw.exists).toBe(true);
    expect(reload).toEqual(opened);
    expect(reload).toMatchObject({ snapshotId: opened.snapshotId, modelVersion: 'stored-model', group: opened.group, users: opened.users });
  });

  it('builds a redacted public v2 group result from the Firestore-backed snapshot', async () => {
    await createOrGetRevealSnapshot(revealInput());
    const persisted = await getRevealSnapshot();
    if (!persisted || persisted.schemaVersion !== 2) throw new Error('Expected a persisted v2 reveal fixture.');
    const response = buildGroupResultsResponse(persisted, destinations);
    const serialized = JSON.stringify(response);

    expect(response.snapshotId).toBe(persisted.snapshotId);
    expect(response.group).toHaveLength(5);
    for (const forbidden of [
      'activityA', 'activityB', 'winner', 'comparisons', 'destinationScores',
      'attributeScores', 'normalized', 'posterior', 'covariance', 'interval',
      'coordinates', 'photographerName', 'photographerUrl', 'sourceUrl',
    ]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`);
    }
  });
});
