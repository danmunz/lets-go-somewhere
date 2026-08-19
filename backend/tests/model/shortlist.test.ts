import { describe, expect, it } from 'vitest';
import { activities } from '../../src/store.js';
import { SHORTLIST_COMPARISONS, SHORTLIST_COVERAGE_COMPARISONS, analyzeShortlist, isShortlistComplete, selectShortlistPair, shortlistProgress, topFiveShortlist } from '../../src/model/shortlist.js';
import { shortlistModelConfig } from '../../src/model/config.js';
import { fitBayesianAttributeShortlist } from '../../src/model/fit.js';
import { selectInformationGainPair } from '../../src/model/selection.js';
import type { Comparison } from '@lgs/shared';

describe('fixed Bayesian attribute shortlist', () => {
  it('issues a deterministic, destination-spread 32-choice round without duplicate pairs', () => {
    const comparisons: Comparison[] = [];
    for (let ordinal = 0; ordinal < SHORTLIST_COMPARISONS; ordinal += 1) {
      const pair = selectShortlistPair(activities, comparisons, 'dan');
      expect(pair).toBeDefined();
      expect(pair![0].destinationId).not.toBe(pair![1].destinationId);
      comparisons.push({ activityA: pair![0].id, activityB: pair![1].id, winner: pair![0].id });
    }
    expect(isShortlistComplete(comparisons)).toBe(true);
    expect(selectShortlistPair(activities, comparisons, 'dan')).toBeUndefined();
    const pairIds = comparisons.map((comparison) => [comparison.activityA, comparison.activityB].sort().join(':'));
    expect(new Set(pairIds).size).toBe(SHORTLIST_COMPARISONS);
    const appearances = new Map(activities.map((activity) => [activity.destinationId, 0]));
    for (const comparison of comparisons.slice(0, SHORTLIST_COVERAGE_COMPARISONS)) {
      for (const activityId of [comparison.activityA, comparison.activityB]) {
        const activity = activities.find((item) => item.id === activityId)!;
        appearances.set(activity.destinationId, appearances.get(activity.destinationId)! + 1);
      }
    }
    expect([...appearances.values()].every((count) => count >= 2)).toBe(true);
  }, 10_000);

  it('uses the same hidden posterior deterministically without public confidence output', () => {
    const comparisons: Comparison[] = [];
    for (let ordinal = 0; ordinal < SHORTLIST_COMPARISONS; ordinal += 1) {
      const pair = selectShortlistPair(activities, comparisons, 'james')!;
      comparisons.push({ activityA: pair[0].id, activityB: pair[1].id, winner: ordinal % 2 === 0 ? pair[0].id : pair[1].id });
    }
    const first = topFiveShortlist(activities, comparisons, 'james');
    const second = topFiveShortlist(activities, comparisons, 'james');
    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(new Set(first).size).toBe(5);
    expect(analyzeShortlist(activities, comparisons, 'james').fit.parameters).toHaveLength(8);
    expect(shortlistProgress(31)).toMatchObject({ comparisons: 31, minimum: 32, maximum: 32 });
  }, 10_000);

  it('uses the private boundary selector for the final eight whenever an eligible pair exists', () => {
    const comparisons: Comparison[] = [];
    for (let ordinal = 0; ordinal < SHORTLIST_COVERAGE_COMPARISONS; ordinal += 1) {
      const pair = selectShortlistPair(activities, comparisons, 'john')!;
      comparisons.push({ activityA: pair[0].id, activityB: pair[1].id, winner: pair[ordinal % 2].id });
    }
    const fit = fitBayesianAttributeShortlist(activities, comparisons, shortlistModelConfig);
    expect(fit.ok).toBe(true);
    if (!fit.ok) throw new Error('Expected an attribute-only fit.');
    const expected = selectInformationGainPair({ activities, comparisons, fit, seed: 'john:25' });
    const actual = selectShortlistPair(activities, comparisons, 'john');
    expect(actual?.map((activity) => activity.id)).toEqual(expected?.map((activity) => activity.id));
  }, 10_000);
});
