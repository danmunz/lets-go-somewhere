import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS, type Activity } from '@lgs/shared';
import {
  aggregateGroupDestinationDraws,
  analyzeDestinationDraws,
  analyzeGroupDestinationPosterior,
  consensusLabel,
  destinationUtilitiesForParameters,
  groupConfidence,
  individualConfidenceLabel,
  personalFitLabel,
  rankDestinationDraw,
  type DestinationPosteriorSummary,
} from '../../src/model/aggregate.js';
import { createDesignMatrix } from '../../src/model/features.js';
import type { FitSuccess } from '../../src/model/fit.js';
import { cholesky, createMatrix } from '../../src/model/linear-algebra.js';

const IDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'] as const;

function activity(id: string, destinationId: string, adventure: number): Activity {
  return {
    id,
    destinationId,
    title: `${id} activity`,
    description: `${id} description`,
    imageUrl: '/media/cards/example.webp',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, key === 'adventure' ? adventure : 2])) as Activity['attributes'],
  };
}

function fittedModel(inputActivities: readonly Activity[], activityResiduals: Readonly<Record<string, number>> = {}): FitSuccess {
  const design = createDesignMatrix(inputActivities);
  const parameters = Array.from({ length: design.parameterCount }, () => 0);
  for (const [id, value] of Object.entries(activityResiduals)) {
    const activityIndex = design.activityIndexById.get(id);
    if (activityIndex === undefined) throw new Error(`Unknown fixture activity ${id}`);
    parameters[ATTRIBUTE_KEYS.length + design.destinationIds.length + activityIndex] = value;
  }
  const precision = createMatrix(design.parameterCount);
  for (let index = 0; index < precision.length; index += 1) precision[index]![index] = 100;
  return {
    ok: true,
    design,
    parameters,
    precision,
    precisionCholesky: cholesky(precision),
    diagnostics: { converged: true, iterations: 1, lastUpdate: 0, logPosterior: 0, usedDiagonalJitter: false, comparisonCount: 24 },
  };
}

function draw(values: readonly number[]): Record<string, number> {
  return Object.fromEntries(IDS.map((id, index) => [id, values[index]!])) as Record<string, number>;
}

describe('destination and group posterior aggregation', () => {
  it('uses equal-weighted activity portfolios and lexical ties', () => {
    const fit = fittedModel([
      activity('alpha-vivid', 'alpha', 3),
      activity('alpha-calm', 'alpha', 3),
      activity('bravo-one', 'bravo', 3),
      activity('bravo-two', 'bravo', 3),
    ], { 'alpha-vivid': 10, 'alpha-calm': 0, 'bravo-one': 4, 'bravo-two': 4 });
    const utilities = destinationUtilitiesForParameters(fit, fit.parameters);
    expect(utilities.alpha).toBe(5);
    expect(utilities.bravo).toBe(4);
    expect(rankDestinationDraw({ bravo: 1, alpha: 1 })).toMatchObject([{ id: 'alpha', rank: 1 }, { id: 'bravo', rank: 2 }]);
  });

  it('reports stable top-five and fifth/sixth confidence from posterior draws', () => {
    const draws = [
      draw([9, 8, 7, 6, 5, 4]),
      draw([9, 8, 7, 6, 5.2, 4]),
      draw([9, 8, 7, 6, 5.1, 4]),
      draw([9, 8, 7, 6, 5.3, 4]),
    ];
    const analysis = analyzeDestinationDraws(draws);
    expect(analysis.topFiveIds).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
    expect(analysis.topFiveSetStability).toBe(1);
    expect(analysis.fifthSixthBoundaryProbability).toBe(1);
    expect(analysis.confidenceLabel).toBe('clear-shape');
    expect(analysis.summaries.get('alpha')?.rankOneProbability).toBe(1);
    expect(individualConfidenceLabel(0.799, 1)).toBe('close-call');
    expect(individualConfidenceLabel(0.8, 0.85)).toBe('clear-shape');
  });

  it('normalizes every traveler per draw, applies the polarization penalty, and records flat-model warnings', () => {
    const result = aggregateGroupDestinationDraws([
      { user: 'one', draws: [draw([10, 9, 8, 7, 6, 0]), draw([10, 9, 8, 7, 6, 0])] },
      { user: 'two', draws: [draw([1, 0.9, 0.8, 0.7, 0.6, 0]), draw([1, 0.9, 0.8, 0.7, 0.6, 0])] },
      { user: 'flat', draws: [draw([4, 4, 4, 4, 4, 4]), draw([4, 4, 4, 4, 4, 4])] },
    ]);
    expect(result.ranking[0]?.id).toBe('alpha');
    expect(result.warnings).toEqual(['zero-range-normalization:flat']);
    expect(result.summaries.get('alpha')?.expectedPolarization).toBeGreaterThan(0);
    expect(result.draws[0]?.alpha).toBeLessThan(1);
  });

  it('uses independent deterministic posterior sub-seeds for group members', () => {
    const activities = IDS.map((id, index) => activity(`${id}-one`, id, index));
    const fit = fittedModel(activities);
    const first = analyzeGroupDestinationPosterior([{ user: 'dan', fit }, { user: 'james', fit }], 'snapshot', { posteriorDrawCount: 8 });
    const replay = analyzeGroupDestinationPosterior([{ user: 'dan', fit }, { user: 'james', fit }], 'snapshot', { posteriorDrawCount: 8 });
    expect(replay.draws).toEqual(first.draws);
    expect(first.normalizedUserDraws.get('dan')).not.toEqual(first.normalizedUserDraws.get('james'));
  });

  it('maps confidence, fit, and consensus threshold edges to qualitative labels', () => {
    expect(consensusLabel(0.16, 5)).toBe('broad-consensus');
    expect(consensusLabel(0.2, 7)).toBe('mixed');
    expect(consensusLabel(0.28, 5)).toBe('polarized');
    expect(consensusLabel(0.2, 12)).toBe('polarized');
    expect(groupConfidence(0.75, 0.85)).toEqual({ label: 'clear-favorite', summary: 'The crew has a clear front-runner.' });
    expect(groupConfidence(0.749, 1).label).toBe('close-call');

    const certain: DestinationPosteriorSummary = {
      id: 'alpha', expectedUtility: 1, interval: { low: 0.2, high: 1.2 }, topFiveMembershipProbability: 0.8, rankOneProbability: 0.5, rankFiveBoundaryProbability: 0.85,
    };
    expect(personalFitLabel(certain, 1)).toBe('strong-match');
    expect(personalFitLabel(certain, 2)).toBe('contender');
    expect(personalFitLabel({ ...certain, rankFiveBoundaryProbability: 0.84 }, 5)).toBe('close-call');
  });
});
