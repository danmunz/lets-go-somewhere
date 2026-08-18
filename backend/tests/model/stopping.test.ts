import { describe, expect, it } from 'vitest';
import type { Activity, Comparison } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import { evaluateStopping, progressFor } from '../../src/model/stopping.js';

function activity(id: string, destinationId: string): Activity {
  return {
    id, destinationId, title: id, description: `${id} description`, imageUrl: '/media/cards/example.webp',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 2])) as Activity['attributes'],
  };
}

const activities = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].flatMap((destinationId) =>
  Array.from({ length: 5 }, (_, index) => activity(`${destinationId}-${index + 1}`, destinationId)));

function comparisons(count: number): Comparison[] {
  const pairs: Comparison[] = [];
  for (let left = 0; left < activities.length && pairs.length < count; left += 1) {
    for (let right = left + 1; right < activities.length && pairs.length < count; right += 1) {
      const first = activities[left]!;
      const second = activities[right]!;
      if (first.destinationId === second.destinationId) continue;
      pairs.push({ activityA: first.id, activityB: second.id, winner: first.id });
    }
  }
  return pairs;
}

const stable = { topFiveSetStability: 0.8, fifthSixthBoundaryProbability: 0.85 } as const;
const close = { topFiveSetStability: 0.79, fifthSixthBoundaryProbability: 1 } as const;

describe('confidence-aware bounded stopping', () => {
  it('never completes before 24, requires coverage and both posterior thresholds for a stable stop', () => {
    expect(evaluateStopping({ activities, comparisons: comparisons(23) })).toMatchObject({ complete: false });
    expect(evaluateStopping({ activities, comparisons: comparisons(24), analysis: stable, hasEligiblePair: true })).toMatchObject({
      complete: true,
      completion: { reason: 'stable-top-five', confidenceLabel: 'clear-shape' },
    });
    const insufficientCoverage = comparisons(24).map((entry) => ({ ...entry, activityA: 'alpha-1', activityB: 'bravo-1', winner: 'alpha-1' }));
    // Duplicate pair input is intentionally rejected by selector but stopping
    // only needs destination coverage and therefore returns unfinished here.
    expect(evaluateStopping({ activities, comparisons: insufficientCoverage, analysis: stable, hasEligiblePair: true })).toMatchObject({ complete: false });
    expect(evaluateStopping({ activities, comparisons: comparisons(24), analysis: close, hasEligiblePair: true })).toMatchObject({ complete: false });
  });

  it('forces an honest close-call at maximum and for explicitly exhausted portfolios', () => {
    expect(evaluateStopping({ activities, comparisons: comparisons(40), analysis: close })).toMatchObject({
      complete: true,
      completion: { reason: 'maximum-reached', confidenceLabel: 'close-call' },
    });
    expect(evaluateStopping({ activities, comparisons: comparisons(24), analysis: stable, hasEligiblePair: false })).toMatchObject({
      complete: true,
      completion: { reason: 'portfolio-exhausted', confidenceLabel: 'close-call' },
    });
  });

  it('reports bounded phases and never moves persisted progress backward', () => {
    expect(progressFor({ activities, comparisons: comparisons(0) }).phase).toBe('explore');
    expect(progressFor({ activities, comparisons: comparisons(12) }).phase).toBe('discriminate');
    const current = progressFor({ activities, comparisons: comparisons(24), analysis: close });
    expect(current.phase).toBe('checking-boundary');
    expect(current.estimatedCompletion).toBeGreaterThan(progressFor({ activities, comparisons: comparisons(23) }).estimatedCompletion);
    expect(progressFor({ activities, comparisons: comparisons(25), analysis: close, previousEstimatedCompletion: 0.995 }).estimatedCompletion).toBe(0.995);
  });
});
