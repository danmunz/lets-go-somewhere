import { describe, expect, it } from 'vitest';
import { activities, destinations } from '../src/store.js';
import { isComplete, rankUser, selectNextPair } from '../src/ranking.js';

describe('ranking', () => {
  it('is deterministic and rewards a repeatedly selected activity', () => { const [a, b] = activities; const comparisons = [{ activityA: a.id, activityB: b.id, winner: a.id }]; const result = rankUser(destinations, activities, comparisons); expect(result.activityScores[a.id]).toBeGreaterThan(result.activityScores[b.id]); expect(rankUser(destinations, activities, comparisons)).toEqual(result); });
  it('does not complete before the minimum', () => expect(isComplete(activities, [])).toBe(false));
  it('selects a new cross-destination pair', () => { const pair = selectNextPair(activities, []); expect(pair).toBeDefined(); expect(pair![0].destinationId).not.toBe(pair![1].destinationId); });
});
