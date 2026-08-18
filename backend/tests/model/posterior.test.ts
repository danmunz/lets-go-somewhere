import { describe, expect, it } from 'vitest';
import type { Activity, Comparison } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import { fitHierarchicalBradleyTerry } from '../../src/model/fit.js';
import { createPrng, hashSeed } from '../../src/model/prng.js';
import {
  credibleInterval,
  drawPosteriorParameters,
  posteriorStandardDeviation,
  posteriorVariance,
  solvePosteriorCovariance,
} from '../../src/model/posterior.js';

function activity(id: string, destinationId: string, adventure: number): Activity {
  return {
    id, destinationId, title: id, description: `${id} description`, imageUrl: '/media/cards/example.webp',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, key === 'adventure' ? adventure : 2])) as Activity['attributes'],
  };
}

describe('posterior helpers and deterministic randomness', () => {
  const activities = [activity('one', 'a', 1), activity('two', 'b', 5)];
  const comparisons: Comparison[] = Array.from({ length: 10 }, () => ({ activityA: 'two', activityB: 'one', winner: 'two' }));

  it('has reproducible uniform and normal sequences for the same seed', () => {
    const first = createPrng('snapshot:user').normal();
    const random = createPrng('snapshot:user');
    const replay = createPrng('snapshot:user');
    expect(first).toBe(replay.normal());
    expect([random.next(), random.next(), random.normal(), random.normal()]).toEqual([
      createPrng('snapshot:user').next(),
      (() => { const source = createPrng('snapshot:user'); source.next(); return source.next(); })(),
      (() => { const source = createPrng('snapshot:user'); source.next(); source.next(); return source.normal(); })(),
      (() => { const source = createPrng('snapshot:user'); source.next(); source.next(); source.normal(); return source.normal(); })(),
    ]);
    expect(hashSeed('snapshot:user')).toBe(hashSeed('snapshot:user'));
  });

  it('draws reproducible posterior parameters and solves covariance directions', () => {
    const fit = fitHierarchicalBradleyTerry(activities, comparisons);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    const direction = Array.from({ length: fit.parameters.length }, (_, index) => index === 0 ? 1 : 0);
    const covarianceDirection = solvePosteriorCovariance(fit, direction);
    expect(covarianceDirection).toHaveLength(fit.parameters.length);
    expect(posteriorVariance(fit, direction)).toBeGreaterThan(0);
    expect(posteriorStandardDeviation(fit, 0)).toBeGreaterThan(0);
    expect(drawPosteriorParameters(fit, 4, 'draw-seed')).toEqual(drawPosteriorParameters(fit, 4, 'draw-seed'));
    expect(drawPosteriorParameters(fit, 4, 'draw-seed')).not.toEqual(drawPosteriorParameters(fit, 4, 'other-seed'));
  });

  it('produces interpolated credible intervals and rejects invalid interval input', () => {
    expect(credibleInterval([1, 2, 3, 4, 5], 0.8)).toEqual({ low: 1.4, high: 4.6, median: 3 });
    expect(() => credibleInterval([], 0.9)).toThrow(/zero values/);
    expect(() => credibleInterval([1, 2], 1)).toThrow(/between zero and one/);
  });
});
