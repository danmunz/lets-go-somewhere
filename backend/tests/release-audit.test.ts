import { beforeEach, describe, expect, it } from 'vitest';
import { ROSTER_USERS, legacyResultSnapshotSchema } from '@lgs/shared';
import { app } from '../src/app.js';
import { getSeedVersion } from '../src/model/snapshot.js';
import { buildTransparentSocialBallot } from '../src/results/social-ballot.js';
import {
  __storeTest,
  createOrGetRevealSnapshot,
  getAllFinalDecisions,
  getFinalDecision,
  type RevealSnapshotInput,
} from '../src/store.js';

const headers = { 'X-Demo-User': 'dan', 'content-type': 'application/json' };
const destinations = ['antigua', 'oaxaca', 'quito', 'cuzco', 'medellin'];
const now = '2026-08-19T12:00:00.000Z';

function validV2Input(): RevealSnapshotInput {
  const personal = {
    topFive: destinations,
    profileThemes: ['Adventure', 'Nature'],
    profile: {
      headline: 'A travel shape', synthesis: 'A clear travel shape.',
      dimensions: [
        { key: 'adventure' as const, label: 'Adventure', strength: 'strong' as const, direction: 'drawn-to' as const },
        { key: 'nature' as const, label: 'Nature', strength: 'present' as const, direction: 'drawn-to' as const },
      ],
      confidenceLabel: 'clear-shape' as const,
    },
    personalResults: {
      confidence: { label: 'close-call' as const, summary: 'Close choices.' },
      topFive: destinations.map((id, index) => ({
        rank: index + 1, id, fitLabel: index === 0 ? 'strong-match' as const : 'contender' as const,
        interval: { low: 0, high: 1 }, explanation: { themes: ['Adventure', 'Nature'], matchedActivityCount: 1, encounteredActivityCount: 1 },
      })),
    },
  };
  const users = Object.fromEntries(ROSTER_USERS.map((user) => [user, personal])) as RevealSnapshotInput['users'];
  return {
    schemaVersion: 2,
    modelVersion: 'audit-model',
    seedVersion: getSeedVersion(),
    inputDigest: 'a'.repeat(64),
    users,
    group: buildTransparentSocialBallot({
      ballots: Object.fromEntries(ROSTER_USERS.map((user) => [user, destinations])) as Record<typeof ROSTER_USERS[number], string[]>,
      profileThemes: Object.fromEntries(ROSTER_USERS.map((user) => [user, ['Adventure']])) as Record<typeof ROSTER_USERS[number], string[]>,
      destinationNames: Object.fromEntries(destinations.map((id) => [id, id])),
    }),
  };
}

function validLegacySnapshot() {
  const profile = {
    headline: 'A travel shape', synthesis: 'A clear travel shape.',
    dimensions: [
      { key: 'adventure', label: 'Adventure', strength: 'strong', direction: 'drawn-to' },
      { key: 'nature', label: 'Nature', strength: 'present', direction: 'drawn-to' },
    ], confidenceLabel: 'clear-shape',
  } as const;
  const summary = {
    topFive: destinations.map((id) => ({ id, interval: { low: 0, high: 1 }, topFiveMembershipProbability: 0.5, rankOneProbability: 0.2, rankFiveBoundaryProbability: 0.2 })),
    topThreeIds: destinations.slice(0, 3), profile, confidenceLabel: 'close-call',
    diagnostics: { converged: true, iterations: 1, warnings: [], drawCount: 1 },
  };
  return legacyResultSnapshotSchema.parse({
    schemaVersion: 1, modelVersion: 'legacy-model', seedVersion: getSeedVersion(), inputDigest: 'b'.repeat(64), createdAt: now,
    users: Object.fromEntries(ROSTER_USERS.map((user) => [user, summary])),
    group: {
      topFive: destinations.map((id) => ({ id, interval: { low: 0, high: 1 }, topFiveMembershipProbability: 0.5, rankOneProbability: 0.2, rankFiveBoundaryProbability: 0.2, consensus: 'mixed' })),
      confidence: { label: 'close-call', summary: 'Close.' }, diagnostics: { converged: true, iterations: 1, warnings: [], drawCount: 1 },
    },
  });
}

describe('release-gate backend audit', () => {
  beforeEach(() => __storeTest.clearMemory());

  it('fails closed at the HTTP boundary when a persisted v2 tally is corrupt', async () => {
    const snapshot = await createOrGetRevealSnapshot(validV2Input());
    const raw = __storeTest.getMemorySnapshot(snapshot.snapshotId)!;
    if (raw.schemaVersion !== 2) throw new Error('Expected a v2 audit fixture.');
    raw.group.finalists[0]!.points += 1;

    const response = await app.request('/v1/results/group', { headers });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: 'temporarily-unavailable', error: 'This trip data is temporarily unavailable. Ask the organizer for help.',
    });
  });

  it('rejects stale or cross-snapshot persisted decisions instead of publishing them', async () => {
    const snapshot = await createOrGetRevealSnapshot(validV2Input());
    __storeTest.setMemoryFinalDecision('dan', {
      user: 'dan', choice: 'antigua', snapshotId: `${snapshot.snapshotId}-other`, createdAt: now,
    });

    await expect(getFinalDecision('dan')).rejects.toThrow(/snapshot ID must match/);
    await expect(getAllFinalDecisions()).rejects.toThrow(/snapshot ID must match/);
    const response = await app.request('/v1/final-decision', { headers });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'temporarily-unavailable' });
  });

  it('keeps every final-decision endpoint read-only for a valid legacy reveal', async () => {
    __storeTest.setMemoryRevealSnapshot('legacy-audit', validLegacySnapshot());

    const get = await app.request('/v1/final-decision', { headers });
    expect(get.status).toBe(503);
    expect(await get.json()).toEqual({ code: 'temporarily-unavailable', error: 'This legacy reveal remains read-only until the trip reset.' });

    const post = await app.request('/v1/final-decision', { method: 'POST', headers, body: JSON.stringify({ choice: 'antigua' }) });
    expect(post.status).toBe(503);
    expect(await post.json()).toEqual({ code: 'temporarily-unavailable', error: 'This legacy reveal remains read-only until the trip reset.' });
    expect(__storeTest.getMemoryFinalDecision('dan')).toBeUndefined();
  });
});
