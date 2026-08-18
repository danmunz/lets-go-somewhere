import { describe, expect, it } from 'vitest';
import type { Activity, Comparison } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import { fitHierarchicalBradleyTerry, priorPrecisions } from '../../src/model/fit.js';
import { createDesignMatrix } from '../../src/model/features.js';
import { modelConfig } from '../../src/model/config.js';

function createActivity(id: string, destinationId: string, adventure: number): Activity {
  return {
    id,
    destinationId,
    title: id,
    description: `${id} description`,
    imageUrl: '/media/cards/example.webp',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, key === 'adventure' ? adventure : 2])) as Activity['attributes'],
  };
}

describe('hierarchical Bradley–Terry MAP fitting', () => {
  const activities = [createActivity('low', 'delta', 0), createActivity('mid', 'echo', 2), createActivity('high', 'foxtrot', 5)];
  const comparisons: Comparison[] = [
    ...Array.from({ length: 8 }, () => ({ activityA: 'high', activityB: 'low', winner: 'high' })),
    ...Array.from({ length: 5 }, () => ({ activityA: 'high', activityB: 'mid', winner: 'high' })),
    ...Array.from({ length: 4 }, () => ({ activityA: 'mid', activityB: 'low', winner: 'mid' })),
  ];

  it('recovers the direction of a synthetic attribute preference deterministically', () => {
    const first = fitHierarchicalBradleyTerry(activities, comparisons);
    const second = fitHierarchicalBradleyTerry([...activities].reverse(), comparisons);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.parameters[0]).toBeGreaterThan(0);
    expect(first.parameters).toEqual(second.parameters);
    expect(first.diagnostics.converged).toBe(true);
    expect(first.diagnostics.iterations).toBeLessThanOrEqual(modelConfig.maxNewtonIterations);
    expect(first.precisionCholesky).toEqual(second.precisionCholesky);
  });

  it('uses independent, specified shrinkage priors for each parameter block', () => {
    const design = createDesignMatrix(activities);
    const priors = priorPrecisions(design);
    expect(priors[0]).toBeCloseTo(1 / modelConfig.betaPriorSd ** 2);
    expect(priors[8]).toBeCloseTo(1 / modelConfig.destinationPriorSd ** 2);
    expect(priors.at(-1)).toBeCloseTo(1 / modelConfig.activityResidualPriorSd ** 2);
  });

  it('does not create weakly identified residual coefficients for unseen cards', () => {
    const fit = fitHierarchicalBradleyTerry(activities, [{ activityA: 'high', activityB: 'low', winner: 'high' }]);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    expect(fit.design.residualActivityIds).toEqual(['high', 'low']);
    expect(fit.parameters).toHaveLength(8 + fit.design.destinationIds.length + 2);
  });

  it('returns typed safe failures for malformed input and an exhausted iteration budget', () => {
    const malformed = fitHierarchicalBradleyTerry(activities, [{ activityA: 'high', activityB: 'unknown', winner: 'high' }]);
    expect(malformed).toMatchObject({ ok: false, code: 'invalid-input' });
    const noIterations = fitHierarchicalBradleyTerry(activities, comparisons, { ...modelConfig, maxNewtonIterations: 0 });
    expect(noIterations).toMatchObject({ ok: false, code: 'invalid-input' });
    const oneIteration = fitHierarchicalBradleyTerry(activities, comparisons, { ...modelConfig, maxNewtonIterations: 1 });
    expect(oneIteration).toMatchObject({ ok: false, code: 'non-convergence' });
  });
});
