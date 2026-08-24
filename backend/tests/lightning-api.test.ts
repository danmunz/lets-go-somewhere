import { beforeEach, describe, expect, it } from 'vitest';
import { LIGHTNING_POLICY_VERSION, lightningNextComparisonResponseSchema, lightningPersonalResultsSchema } from '@lgs/shared';
import { __lightningStoreTest, lightningContentVersion, lightningDestinations } from '../src/lightning/store.js';
import { __storeTest } from '../src/store.js';
import { app } from '../src/app.js';
import { initialLightningSchedule, selectNextLightningPair } from '../src/lightning/direct-model.js';

const headers = { 'X-Demo-User': 'dan', 'content-type': 'application/json' };

const completeOriginalRound = async (user: string) => {
  const userHeaders = { 'X-Demo-User': user, 'content-type': 'application/json' };
  for (let index = 0; index < 32; index += 1) {
    const next = await app.request('/v1/comparison/next', { headers: userHeaders });
    const pair = await next.json();
    if (pair.complete) return;
    const submit = await app.request('/v1/comparisons', {
      method: 'POST', headers: userHeaders,
      body: JSON.stringify({ activityA: pair.activityA.id, activityB: pair.activityB.id, winner: pair.activityA.id }),
    });
    expect(submit.status).toBe(200);
  }
};

const openOriginalReveal = async () => {
  for (const user of ['dan', 'james', 'john', 'matt', 'peter']) await completeOriginalRound(user);
  const originalReveal = await app.request('/v1/reveal', { method: 'POST', headers });
  expect(originalReveal.status).toBe(200);
};

function directCompleteState(offset = 0) {
  const comparisons = initialLightningSchedule(lightningDestinations).map(([destinationA, destinationB], index) => ({
    destinationA,
    destinationB,
    winner: index % 2 === offset % 2 ? destinationA : destinationB,
    ordinal: index + 1,
    createdAt: '2026-08-23T00:00:00.000Z',
    selectorVersion: LIGHTNING_POLICY_VERSION,
  }));
  while (comparisons.length < 48) {
    const next = selectNextLightningPair(lightningDestinations, comparisons, `test-${offset}`);
    if (!next) throw new Error('Expected a fair Lightning core comparison.');
    const [destinationA, destinationB] = next;
    const index = comparisons.length;
    comparisons.push({
      destinationA: destinationA.id,
      destinationB: destinationB.id,
      winner: index % 2 === offset % 2 ? destinationA.id : destinationB.id,
      ordinal: index + 1,
      createdAt: '2026-08-23T00:00:00.000Z',
      selectorVersion: LIGHTNING_POLICY_VERSION,
    });
  }
  return {
    comparisons,
    pending: null,
    revision: comparisons.length,
    completedAt: '2026-08-23T00:00:00.000Z',
    contentVersion: lightningContentVersion,
  };
}

describe('Lightning Round route boundary', () => {
  beforeEach(() => {
    __storeTest.clearMemory();
    __lightningStoreTest.clearMemory();
  });

  it('does not allow the named-destination follow-up to start before the first immutable envelope exists', async () => {
    const status = await app.request('/v1/lightning-round/status', { headers });
    expect(status.status).toBe(409);
    expect(await status.json()).toEqual({ code: 'conflict', error: 'Open the first group envelope before starting the Lightning Round.' });
  });

  it('keeps the second envelope sealed when its direct result has not been opened', async () => {
    const group = await app.request('/v1/lightning-round/results/group', { headers });
    // The original-envelope guard has priority over all direct-result access.
    expect(group.status).toBe(409);
  });

  it('starts only after the original reveal, accepts a revisioned direct choice, and rejects a stale replay', async () => {
    await openOriginalReveal();

    const beforeRanking = await app.request('/v1/lightning-round/vetoes', { method: 'POST', headers, body: JSON.stringify({ destinationIds: [] }) });
    expect(beforeRanking.status).toBe(409);

    const before = await app.request('/v1/lightning-round/comparison/next', { headers });
    const pair = lightningNextComparisonResponseSchema.parse(await before.json());
    expect(pair.complete).toBe(false);
    if (pair.complete) throw new Error('Expected a first Lightning comparison.');
    expect(pair.destinationA).toMatchObject({ name: expect.any(String), country: expect.any(String), travel: expect.any(Object), weather: expect.any(Object) });

    const submission = {
      destinationA: pair.destinationA.id,
      destinationB: pair.destinationB.id,
      winner: pair.destinationA.id,
      revision: pair.revision,
    };
    const accepted = await app.request('/v1/lightning-round/comparisons', { method: 'POST', headers, body: JSON.stringify(submission) });
    expect(accepted.status).toBe(200);

    const staleReplay = await app.request('/v1/lightning-round/comparisons', { method: 'POST', headers, body: JSON.stringify(submission) });
    expect(staleReplay.status).toBe(409);

    // Complete Dan's direct round. The caller-only personal result should include
    // the persisted direct decisions in their original, stable order.
    for (let index = 1; index < 60; index += 1) {
      const next = lightningNextComparisonResponseSchema.parse(await (await app.request('/v1/lightning-round/comparison/next', { headers })).json());
      if (next.complete) break;
      const response = await app.request('/v1/lightning-round/comparisons', {
        method: 'POST', headers,
        body: JSON.stringify({ destinationA: next.destinationA.id, destinationB: next.destinationB.id, winner: next.destinationA.id, revision: next.revision }),
      });
      expect(response.status).toBe(200);
    }
    const personal = await app.request('/v1/lightning-round/results/me', { headers });
    expect(personal.status).toBe(200);
    const parsedPersonal = lightningPersonalResultsSchema.parse(await personal.json());
    expect(parsedPersonal.resultVersion).toBe('working-order-borda-v2');
    expect(parsedPersonal.ranking.workingOrder).toHaveLength(24);
    expect(parsedPersonal.ranking.privateEvidence).toHaveLength(24);
    expect(parsedPersonal.comparisonTrail.length).toBeGreaterThanOrEqual(48);
    expect(parsedPersonal.comparisonTrail.length).toBeLessThanOrEqual(60);
    expect(parsedPersonal.comparisonTrail.map((entry) => entry.order)).toEqual(Array.from({ length: parsedPersonal.comparisonTrail.length }, (_, index) => index + 1));
    expect(parsedPersonal.comparisonTrail.every((entry) => entry.winnerId !== entry.loserId)).toBe(true);
    expect(parsedPersonal.comparisonTrail.slice(0, 48).every((entry) => entry.phase === 'core')).toBe(true);
    expect(parsedPersonal.comparisonTrail.slice(48).every((entry) => entry.phase === 'tie-breakers')).toBe(true);
    expect(parsedPersonal.vetoes).toEqual({ submitted: false, destinationIds: [] });

    const vetoes = parsedPersonal.destinations.slice(0, 2).map((destination) => destination.id);
    const saved = await app.request('/v1/lightning-round/vetoes', { method: 'POST', headers, body: JSON.stringify({ destinationIds: vetoes }) });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ accepted: true, vetoes: { submitted: true, destinationIds: [...vetoes].sort() } });
    const idempotent = await app.request('/v1/lightning-round/vetoes', { method: 'POST', headers, body: JSON.stringify({ destinationIds: [...vetoes].reverse() }) });
    expect(idempotent.status).toBe(200);
    const changed = await app.request('/v1/lightning-round/vetoes', { method: 'POST', headers, body: JSON.stringify({ destinationIds: [vetoes[0]!] }) });
    expect(changed.status).toBe(409);
    const withVetoes = lightningPersonalResultsSchema.parse(await (await app.request('/v1/lightning-round/results/me', { headers })).json());
    expect(withVetoes.vetoes).toEqual({ submitted: true, destinationIds: [...vetoes].sort() });
  }, 25_000);

  it('requires every direct ranking to submit vetoes before opening a veto-consistent second envelope', async () => {
    await openOriginalReveal();
    const users = ['dan', 'james', 'john', 'matt', 'peter'] as const;
    users.forEach((user, index) => __lightningStoreTest.setMemoryState(user, directCompleteState(index)));

    const before = await app.request('/v1/lightning-round/group-status', { headers });
    expect(before.status).toBe(200);
    expect((await before.json()).members.every((member: { complete: boolean }) => !member.complete)).toBe(true);
    const unopened = await app.request('/v1/lightning-round/reveal', { method: 'POST', headers });
    expect(unopened.status).toBe(409);

    const invalid = await app.request('/v1/lightning-round/vetoes', { method: 'POST', headers, body: JSON.stringify({ destinationIds: Array.from({ length: 5 }, (_, index) => lightningDestinations[index]!.id) }) });
    expect(invalid.status).toBe(400);
    const duplicate = await app.request('/v1/lightning-round/vetoes', { method: 'POST', headers, body: JSON.stringify({ destinationIds: [lightningDestinations[0]!.id, lightningDestinations[0]!.id] }) });
    expect(duplicate.status).toBe(400);
    const unknown = await app.request('/v1/lightning-round/vetoes', { method: 'POST', headers, body: JSON.stringify({ destinationIds: ['not-a-lightning-destination'] }) });
    expect(unknown.status).toBe(400);

    for (const [index, user] of users.entries()) {
      const userHeaders = { 'X-Demo-User': user, 'content-type': 'application/json' };
      const destinationIds = index === 0 ? [lightningDestinations[0]!.id, lightningDestinations[3]!.id] : [];
      const saved = await app.request('/v1/lightning-round/vetoes', { method: 'POST', headers: userHeaders, body: JSON.stringify({ destinationIds }) });
      expect(saved.status).toBe(200);
    }
    const after = await app.request('/v1/lightning-round/group-status', { headers });
    expect((await after.json()).allComplete).toBe(true);
    const reveal = await app.request('/v1/lightning-round/reveal', { method: 'POST', headers });
    expect(reveal.status).toBe(200);
    const group = await app.request('/v1/lightning-round/results/group', { headers });
    expect(group.status).toBe(200);
    const results = await group.json();
    expect(results.resultVersion).toBe('working-order-borda-v2');
    expect(results.members.every((member: { ranking?: unknown }) => member.ranking === undefined)).toBe(true);
    expect(results.members.every((member: { workingOrder: unknown[] }) => member.workingOrder.length === 24)).toBe(true);
    expect(JSON.stringify(results)).not.toContain('privateEvidence');
    expect(JSON.stringify(results)).not.toContain('topFivePercent');
    expect(results.members.find((member: { user: string }) => member.user === 'dan').vetoedDestinationIds).toEqual([lightningDestinations[0]!.id, lightningDestinations[3]!.id].sort());
    expect(results.group.find((row: { destinationId: string }) => row.destinationId === lightningDestinations[0]!.id).vetoedBy).toEqual(['dan']);

    // A previously opened, no-veto second envelope stays read-only and renders
    // safely with empty veto data; it is never rewritten in storage.
    const legacy = {
      snapshotId: 'legacy-second-envelope', modelVersion: results.modelVersion, contentVersion: results.contentVersion,
      destinations: results.destinations,
      group: results.group.map((row: { rankStart: number; rankEnd: number; destinationId: string; bordaPoints: number; firstPlaceVotes: number; supporters: string[] }) => ({
        rankStart: row.rankStart, rankEnd: row.rankEnd, destinationId: row.destinationId, bordaHalfPoints: row.bordaPoints * 2, firstPlaceVotes: row.firstPlaceVotes, supporters: row.supporters,
      })),
      members: results.members.map((member: { user: string; workingOrder: string[] }) => ({
        user: member.user, tiers: [{ rankStart: 1, rankEnd: 24, destinationIds: member.workingOrder }],
      })),
    };
    __lightningStoreTest.setMemorySnapshot('legacy-second-envelope', legacy);
    const legacyRead = await app.request('/v1/lightning-round/results/group', { headers });
    expect(legacyRead.status).toBe(200);
    expect((await legacyRead.json()).group.every((row: { vetoedBy: unknown[] }) => row.vetoedBy.length === 0)).toBe(true);

    const corrupt = structuredClone(results) as { group: Array<{ destinationId: string; vetoedBy: string[] }> };
    corrupt.group.find((row) => row.destinationId === lightningDestinations[0]!.id)!.vetoedBy = [];
    __lightningStoreTest.setMemorySnapshot('corrupt-second-envelope', corrupt);
    const corruptRead = await app.request('/v1/lightning-round/results/group', { headers });
    expect(corruptRead.status).toBe(503);
  }, 30_000);
});
