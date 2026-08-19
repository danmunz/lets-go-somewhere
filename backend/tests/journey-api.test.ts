import { beforeEach, describe, expect, it } from 'vitest';
import { groupStatusSchema, nextComparisonResponseSchema, personalResultsResponseSchema, profileResponseSchema } from '@lgs/shared';
import { app } from '../src/app.js';
import { __storeTest } from '../src/store.js';

const headersFor = (user: string) => ({ 'X-Demo-User': user, 'content-type': 'application/json' });

async function complete(user: string) {
  const headers = headersFor(user);
  // The next request observes completion after the fortieth accepted answer.
  for (let index = 0; index <= 40; index += 1) {
    const next = await app.request('/v1/comparison/next', { headers });
    const payload = await next.json() as { complete: boolean; activityA?: { id: string }; activityB?: { id: string } };
    if (payload.complete) return;
    const response = await app.request('/v1/comparisons', {
      method: 'POST',
      headers,
      body: JSON.stringify({ activityA: payload.activityA!.id, activityB: payload.activityB!.id, winner: payload.activityA!.id }),
    });
    expect(response.status).toBe(200);
  }
  throw new Error(`${user} did not complete within the bounded game.`);
}

describe('one-trip route DTOs', () => {
  beforeEach(() => __storeTest.clearMemory());

  it('returns only a destination-free profile after the caller completes', async () => {
    const locked = await app.request('/v1/profile', { headers: headersFor('dan') });
    expect(locked.status).toBe(409);
    expect(await locked.json()).toEqual({ code: 'completion-required', error: 'Finish the preference game first.' });

    await complete('dan');
    const response = await app.request('/v1/profile', { headers: headersFor('dan') });
    const payload = profileResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(JSON.stringify(payload)).not.toMatch(/antigua|country|destination|activity|score|rank/i);
    expect(JSON.stringify(payload)).not.toMatch(/confidence|interval|clear.favorite|close.call/i);
    expect(payload.profile.dimensions.length).toBeGreaterThanOrEqual(2);
  });

  it('validates shared next-comparison variants and preserves a pending pair after a stale submission', async () => {
    const headers = headersFor('dan');
    const next = await app.request('/v1/comparison/next', { headers });
    const payload = nextComparisonResponseSchema.parse(await next.json());
    expect(payload.complete).toBe(false);
    if (payload.complete) throw new Error('Expected an initial comparison.');
    expect(payload.progress.phase).toBe('explore');

    const stale = await app.request('/v1/comparisons', {
      method: 'POST',
      headers,
      body: JSON.stringify({ activityA: payload.activityA.id, activityB: 'not-offered', winner: payload.activityA.id }),
    });
    expect(stale.status).toBe(409);

    const accepted = await app.request('/v1/comparisons', {
      method: 'POST',
      headers,
      body: JSON.stringify({ activityA: payload.activityA.id, activityB: payload.activityB.id, winner: payload.activityA.id }),
    });
    expect(accepted.status).toBe(200);
  });

  it('returns a typed 503 and leaves a started journey untouched on a seed mismatch', async () => {
    const headers = headersFor('dan');
    const next = await app.request('/v1/comparison/next', { headers });
    const pair = nextComparisonResponseSchema.parse(await next.json());
    if (pair.complete) throw new Error('Expected an initial comparison.');
    await app.request('/v1/comparisons', {
      method: 'POST', headers,
      body: JSON.stringify({ activityA: pair.activityA.id, activityB: pair.activityB.id, winner: pair.activityA.id }),
    });
    const before = structuredClone(__storeTest.getMemoryUserDocument('dan')!);
    __storeTest.setCurrentSeedVersion('f'.repeat(64));

    const blocked = await app.request('/v1/comparison/next', { headers });
    expect(blocked.status).toBe(503);
    expect(await blocked.json()).toEqual({
      code: 'seed-version-mismatch',
      error: 'This trip’s content changed. Ask the organizer to restore the original version.',
    });
    const rejected = await app.request('/v1/comparisons', {
      method: 'POST', headers,
      body: JSON.stringify({ activityA: pair.activityA.id, activityB: pair.activityB.id, winner: pair.activityA.id }),
    });
    expect(rejected.status).toBe(503);
    expect(__storeTest.getMemoryUserDocument('dan')).toEqual(before);
  });

  it('exposes group completion state only, with rounded update time', async () => {
    await complete('matt');
    const response = await app.request('/v1/group-status', { headers: headersFor('matt') });
    const payload = groupStatusSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(payload.members).toEqual([
      { user: 'dan', complete: false },
      { user: 'james', complete: false },
      { user: 'john', complete: false },
      { user: 'matt', complete: true },
      { user: 'peter', complete: false },
    ]);
    expect(payload.updatedAt).toMatch(/\.000Z$/);
    expect(JSON.stringify(payload)).not.toMatch(/comparisons|progress|destination|profile|score|rank/i);
  });

  it('returns only the completed caller’s private shortlist before reveal, then preserves it in the immutable snapshot', async () => {
    await complete('dan');
    const privateResponse = await app.request('/v1/results/me', { headers: headersFor('dan') });
    const privatePayload = personalResultsResponseSchema.parse(await privateResponse.json());
    expect(privateResponse.status).toBe(200);
    expect(privatePayload).not.toHaveProperty('snapshotId');
    const privateRaw = JSON.stringify(privatePayload);
    for (const forbidden of [
      'activityA', 'activityB', 'winner', 'comparisons', 'attributeScores', 'activityScores', 'destinationScores',
      'rawChoices', 'covariance', 'group', 'members', 'finalistRanks', 'insights', 'decisions', 'snapshotId',
    ]) expect(privateRaw).not.toContain(`\"${forbidden}\"`);
    expect((await app.request('/v1/results/group', { headers: headersFor('dan') })).status).toBe(423);

    await complete('james');
    const jamesPrivate = personalResultsResponseSchema.parse(await (await app.request('/v1/results/me', { headers: headersFor('james') })).json());
    expect(jamesPrivate).not.toHaveProperty('snapshotId');
    expect(JSON.stringify(jamesPrivate)).not.toContain('dan');

    for (const user of ['john', 'matt', 'peter']) await complete(user);
    const reveal = await app.request('/v1/reveal', { method: 'POST', headers: headersFor('dan') });
    expect(reveal.status).toBe(200);

    const response = await app.request('/v1/results/me', { headers: headersFor('dan') });
    const payload = personalResultsResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    const group = await app.request('/v1/results/group', { headers: headersFor('dan') });
    const groupPayload = await group.json() as { snapshotId: string; modelVersion: string };
    expect(payload.snapshotId).toBe(groupPayload.snapshotId);
    expect(payload.modelVersion).toBe(groupPayload.modelVersion);
    expect(payload.results).toHaveLength(5);
    expect(payload.profile).toEqual(privatePayload.profile);
    expect(payload.results).toEqual(privatePayload.results);
    expect(payload.results.every((result) => result.explanation.themes.length >= 2)).toBe(true);
    const raw = JSON.stringify(payload);
    // Post-reveal results intentionally include a named destination, country,
    // rank, and qualitative interval; raw blind-comparison/model evidence is
    // never part of this personal contract.
    for (const forbidden of ['activityA', 'activityB', 'winner', 'comparisons', 'attributeScores', 'activityScores', 'destinationScores', 'rawChoices', 'covariance']) {
      expect(raw).not.toContain(`\"${forbidden}\"`);
    }
    expect(raw).not.toContain('james');
    expect(raw).not.toContain('peter');
  });

  it('keeps immutable results sealed behind a seed-version mismatch after reveal', async () => {
    for (const user of ['dan', 'james', 'john', 'matt', 'peter']) await complete(user);
    await app.request('/v1/reveal', { method: 'POST', headers: headersFor('dan') });
    const beforePersonal = await app.request('/v1/results/me', { headers: headersFor('dan') });
    const beforeGroup = await app.request('/v1/results/group', { headers: headersFor('dan') });
    expect(beforePersonal.status).toBe(200);
    expect(beforeGroup.status).toBe(200);

    __storeTest.setCurrentSeedVersion('f'.repeat(64));
    expect((await app.request('/v1/results/me', { headers: headersFor('dan') })).status).toBe(503);
    expect((await app.request('/v1/results/group', { headers: headersFor('dan') })).status).toBe(503);

    __storeTest.setCurrentSeedVersion(undefined);
    const afterPersonal = await (await app.request('/v1/results/me', { headers: headersFor('dan') })).json();
    const afterGroup = await (await app.request('/v1/results/group', { headers: headersFor('dan') })).json();
    expect(afterPersonal).toEqual(await beforePersonal.json());
    expect(afterGroup).toEqual(await beforeGroup.json());
  });
});
