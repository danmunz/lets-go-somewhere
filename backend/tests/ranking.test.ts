import { describe, expect, it } from 'vitest';
import { activities, destinations } from '../src/store.js';
import { groupRankings, isComplete, normalizeDestinationScores, rankUser, selectNextPair } from '../src/ranking.js';

describe('ranking', () => {
  it('is deterministic and rewards a repeatedly selected activity', () => { const [a, b] = activities; const comparisons = [{ activityA: a.id, activityB: b.id, winner: a.id }]; const result = rankUser(destinations, activities, comparisons); expect(result.activityScores[a.id]).toBeGreaterThan(result.activityScores[b.id]); expect(rankUser(destinations, activities, comparisons)).toEqual(result); });
  it('does not complete before the minimum', () => expect(isComplete(activities, [])).toBe(false));
  it('selects a new cross-destination pair', () => { const pair = selectNextPair(activities, []); expect(pair).toBeDefined(); expect(pair![0].destinationId).not.toBe(pair![1].destinationId); });
  it('normalizes individual scales and applies the documented polarization penalty', () => {
    const first = destinations[0], second = destinations[1];
    const individual = [normalizeDestinationScores({ [first.id]: 100, [second.id]: 0 }), normalizeDestinationScores({ [first.id]: 1, [second.id]: 0 })];
    const results = groupRankings([first, second], individual);
    expect(results[0].id).toBe(first.id);
    expect(results[0].meanPreference).toBeCloseTo(1);
    expect(results[0].polarization).toBeCloseTo(0);
    expect(results[0].groupScore).toBeCloseTo(1);
  });
});
