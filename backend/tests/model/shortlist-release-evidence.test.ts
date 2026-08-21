import { describe, expect, it } from 'vitest';
import { resultSnapshotReaderSchema, type Comparison } from '@lgs/shared';
import { app } from '../../src/app.js';
import { activities, destinations, ROSTER, __storeTest } from '../../src/store.js';
import { buildShortlistRevealSnapshot } from '../../src/dto/one-trip.js';
import { shortlistModelConfig } from '../../src/model/config.js';
import { fitBayesianAttributeShortlist } from '../../src/model/fit.js';
import {
  SHORTLIST_COMPARISONS,
  SHORTLIST_COVERAGE_COMPARISONS,
  analyzeShortlist,
  selectShortlistPair,
  topFiveShortlist,
} from '../../src/model/shortlist.js';
import { eligibleInformationGainPairs, selectInformationGainPair } from '../../src/model/selection.js';
import { createSyntheticFixtureRun } from './fixtures.js';

/**
 * This suite is the bounded release evidence for the deliberately small,
 * fixed-round production model. It is intentionally independent of the old
 * hierarchical audit and pins the actual version/policy through its imports.
 */
const RELEASE_FIXTURES = [
  'clear-attribute-preference',
  'fifth-sixth-boundary',
  'noisy-replay',
  'polarizing-group',
] as const;
// One fixed seed per independent preference shape keeps this a bounded
// production-verification gate (the full historical matrix belongs only to
// the rejected hierarchical research candidate). The polarizing fixture still
// exercises all five deliberately divergent travelers.
const RELEASE_SEEDS = [61_001] as const;

function canonicalPair(comparison: Comparison): string {
  return [comparison.activityA, comparison.activityB].sort().join(':');
}

function replayFixture(scenarioId: (typeof RELEASE_FIXTURES)[number], seed: number, userId: string): Comparison[] {
  const fixture = createSyntheticFixtureRun(scenarioId, seed, destinations, activities);
  const comparisons: Comparison[] = [];
  for (let ordinal = 0; ordinal < SHORTLIST_COMPARISONS; ordinal += 1) {
    if (ordinal >= SHORTLIST_COVERAGE_COMPARISONS) {
      const fit = fitBayesianAttributeShortlist(activities, comparisons, shortlistModelConfig);
      expect(fit.ok, `${scenarioId}/${seed}/${userId} must fit before boundary question ${ordinal + 1}`).toBe(true);
      if (!fit.ok) throw new Error('Expected fixed-shortlist fit.');
      const eligible = eligibleInformationGainPairs(activities, comparisons);
      const expected = selectInformationGainPair({ activities, comparisons, fit, seed: `${userId}:${ordinal + 1}` });
      // The selector's normal portfolio has eligible pairs throughout the
      // final eight. If that ever changes, this assertion fails rather than
      // silently treating the documented boundary-targeting rule as optional.
      expect(eligible.length, `${scenarioId}/${seed}/${userId} must have an eligible boundary pair`).toBeGreaterThan(0);
      expect(expected, `${scenarioId}/${seed}/${userId} must select an eligible boundary pair`).toBeDefined();
      const actual = selectShortlistPair(activities, comparisons, userId);
      expect(actual?.map((activity) => activity.id)).toEqual(expected?.map((activity) => activity.id));
    }
    const pair = selectShortlistPair(activities, comparisons, userId);
    expect(pair, `${scenarioId}/${seed}/${userId} must issue question ${ordinal + 1}`).toBeDefined();
    comparisons.push({
      activityA: pair![0].id,
      activityB: pair![1].id,
      winner: fixture.winnerForPair(userId, pair![0].id, pair![1].id, ordinal + 1),
    });
  }
  return comparisons;
}

function assertPairSafety(comparisons: readonly Comparison[]) {
  expect(comparisons).toHaveLength(SHORTLIST_COMPARISONS);
  expect(new Set(comparisons.map(canonicalPair)).size).toBe(SHORTLIST_COMPARISONS);
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  for (const comparison of comparisons) {
    expect(activityById.get(comparison.activityA)?.destinationId).not.toBe(activityById.get(comparison.activityB)?.destinationId);
  }
  const appearances = new Map(destinations.map((destination) => [destination.id, 0]));
  for (const comparison of comparisons.slice(0, SHORTLIST_COVERAGE_COMPARISONS)) {
    for (const activityId of [comparison.activityA, comparison.activityB]) {
      const destinationId = activityById.get(activityId)!.destinationId;
      appearances.set(destinationId, appearances.get(destinationId)! + 1);
    }
  }
  expect([...appearances.values()].every((count) => count >= 2)).toBe(true);
}

function replayRosterUser(user: (typeof ROSTER)[number]): Comparison[] {
  const comparisons: Comparison[] = [];
  for (let ordinal = 0; ordinal < SHORTLIST_COMPARISONS; ordinal += 1) {
    const pair = selectShortlistPair(activities, comparisons, user);
    if (!pair) throw new Error(`Expected fixed-round pair ${ordinal + 1} for ${user}.`);
    comparisons.push({
      activityA: pair[0].id,
      activityB: pair[1].id,
      // This intentionally fixed answer pattern makes persistence/reload
      // identity independent of any synthetic preference-fixture identity.
      winner: ordinal % 2 === 0 ? pair[0].id : pair[1].id,
    });
  }
  return comparisons;
}

function assertNoForbiddenKeys(value: unknown, forbidden: ReadonlySet<string>) {
  if (Array.isArray(value)) return value.forEach((item) => assertNoForbiddenKeys(item, forbidden));
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    expect(forbidden.has(key), `blind comparison response included ${key}`).toBe(false);
    assertNoForbiddenKeys(nested, forbidden);
  }
}

describe('RG-06 fixed-shortlist release evidence', () => {
  it('replays deterministic fixed-32 rounds without fit failures across clear, close, noisy, and divergent fixtures', () => {
    for (const scenarioId of RELEASE_FIXTURES) {
      for (const seed of RELEASE_SEEDS) {
        const fixture = createSyntheticFixtureRun(scenarioId, seed, destinations, activities);
        for (const user of fixture.users) {
          const first = replayFixture(scenarioId, seed, user.id);
          const second = replayFixture(scenarioId, seed, user.id);
          expect(second).toEqual(first);
          assertPairSafety(first);
          const firstShortlist = topFiveShortlist(activities, first, user.id);
          expect(analyzeShortlist(activities, first, user.id).fit.parameters).toHaveLength(8);
          expect(topFiveShortlist(activities, second, user.id)).toEqual(firstShortlist);
          expect(firstShortlist).toHaveLength(5);
          expect(new Set(firstShortlist).size).toBe(5);
        }
      }
    }
  }, 45_000);

  it('keeps the immutable persisted reveal input and each roster shortlist stable on reload', () => {
    const completed = ROSTER.map((user) => ({
      user,
      comparisons: replayRosterUser(user),
    }));
    const first = buildShortlistRevealSnapshot(completed, destinations, activities);
    const second = buildShortlistRevealSnapshot(structuredClone(completed), destinations, activities);
    expect(second).toEqual(first);
    const persisted = resultSnapshotReaderSchema.parse({
      ...first,
      createdAt: '2026-08-20T00:00:00.000Z',
    });
    expect(persisted.modelVersion).toBe('bayes-attribute-shortlist-v1');
    expect(persisted.policyVersion).toBe('fixed-32-boundary-v1');
    for (const { user, comparisons } of completed) {
      expect(persisted.users[user].topFive).toEqual(topFiveShortlist(activities, comparisons, user));
    }
  }, 30_000);

  it('never leaks destination or model metadata through the active comparison DTO', async () => {
    __storeTest.clearMemory();
    const response = await app.request('/v1/comparison/next', { headers: { 'X-Demo-User': 'dan' } });
    expect(response.status).toBe(200);
    const payload = await response.json();
    assertNoForbiddenKeys(payload, new Set([
      'destinationId', 'name', 'country', 'coordinates', 'latitude', 'longitude',
      'gallery', 'photographerName', 'photographerUrl', 'sourceUrl', 'credit',
      'score', 'rank', 'ranking', 'posterior', 'parameters', 'covariance',
      'modelVersion', 'policyVersion', 'selectorVersion', 'seedVersion',
    ]));
  });
});
