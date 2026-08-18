import { describe, expect, it } from 'vitest';
import type { Activity, Comparison, Destination } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import * as baseline from '../../src/model/baseline.js';
import { BASELINE_MODEL_VERSION, replayBaselineRanking, replayBaselineShouldStop } from '../../src/model/baseline.js';
import { isComplete, rankUser } from '../../src/ranking.js';

function activity(id: string, destinationId: string, adventure: number): Activity {
  return {
    id, destinationId, title: id, description: `${id} description`, imageUrl: '/media/cards/example.webp',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, key === 'adventure' ? adventure : 2])) as Activity['attributes'],
  };
}

describe('frozen Elo coverage baseline', () => {
  const activities = [activity('a', 'alpha', 1), activity('b', 'bravo', 5)];
  const destinations = activities.map((item) => ({ id: item.destinationId })) as Destination[];
  const comparisons: Comparison[] = [{ activityA: 'a', activityB: 'b', winner: 'b' }];

  it('is versioned and exactly replays the deployed scoring behaviour', () => {
    expect(BASELINE_MODEL_VERSION).toBe('elo-coverage-v1');
    expect(replayBaselineRanking(destinations, activities, comparisons)).toEqual(rankUser(destinations, activities, comparisons));
  });

  it('retains the coverage stop only for replay, without a selector export', () => {
    expect(replayBaselineShouldStop(activities, comparisons)).toBe(isComplete(activities, comparisons));
    // A production-like module surface has no baseline pair-selection function.
    expect('selectBaselinePair' in baseline).toBe(false);
  });
});
