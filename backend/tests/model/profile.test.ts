import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS, type Activity } from '@lgs/shared';
import {
  buildDestinationExplanation,
  buildPreferenceProfile,
  buildPreferenceProfileFromAttributes,
  safeExplanationThemes,
  type AttributePosteriorSummary,
} from '../../src/model/profile.js';
import { createDesignMatrix } from '../../src/model/features.js';
import type { FitSuccess } from '../../src/model/fit.js';
import { cholesky, createMatrix } from '../../src/model/linear-algebra.js';

function activity(id: string, destinationId: string, adventure: number, history: number): Activity {
  return {
    id,
    destinationId,
    title: `A very specific ${id} in Antigua`,
    description: `A raw activity description for ${id} that must never enter profile copy.`,
    imageUrl: '/media/cards/example.webp',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, key === 'adventure' ? adventure : key === 'history' ? history : 2])) as Activity['attributes'],
  };
}

function fitForProfile(inputActivities: readonly Activity[]): FitSuccess {
  const design = createDesignMatrix(inputActivities);
  const parameters = Array.from({ length: design.parameterCount }, () => 0);
  parameters[0] = 1.25;
  parameters[4] = 0.9;
  const precision = createMatrix(design.parameterCount);
  for (let index = 0; index < precision.length; index += 1) precision[index]![index] = 400;
  return {
    ok: true,
    design,
    parameters,
    precision,
    precisionCholesky: cholesky(precision),
    diagnostics: { converged: true, iterations: 1, lastUpdate: 0, logPosterior: 0, usedDiagonalJitter: false, comparisonCount: 24 },
  };
}

function attributeSummaries(overrides: Partial<Record<string, Partial<AttributePosteriorSummary>>> = {}): AttributePosteriorSummary[] {
  return ATTRIBUTE_KEYS.map((key) => ({
    key,
    expectedContribution: 0.01,
    positiveProbability: 0.51,
    ...overrides[key],
  }));
}

describe('safe preference profiles and explanation primitives', () => {
  it('builds a destination-free controlled profile from categorical attribute evidence', () => {
    const profile = buildPreferenceProfileFromAttributes(attributeSummaries({
      adventure: { expectedContribution: 0.7, positiveProbability: 0.98 },
      history: { expectedContribution: 0.45, positiveProbability: 0.92 },
      novelty: { expectedContribution: 0.25, positiveProbability: 0.86 },
    }));
    expect(profile.confidenceLabel).toBe('clear-shape');
    expect(profile.dimensions).toHaveLength(3);
    expect(profile.dimensions.map((dimension) => dimension.key)).toEqual(['adventure', 'history', 'novelty']);
    expect(JSON.stringify(profile)).not.toContain('Antigua');
    expect(JSON.stringify(profile)).not.toMatch(/0\.7|0\.98/);
  });

  it('uses the accessible two-dimension fallback when no three dimensions are clear', () => {
    const profile = buildPreferenceProfileFromAttributes(attributeSummaries({
      nature: { expectedContribution: -0.13, positiveProbability: 0.2 },
      food: { expectedContribution: 0.1, positiveProbability: 0.74 },
    }));
    expect(profile.confidenceLabel).toBe('still-emerging');
    expect(profile.dimensions).toHaveLength(2);
    expect(profile.synthesis).toBe('Your trip rhythm is still taking shape, with a few honest close calls.');
  });

  it('omits uncertain or negative themes and uses only safe categorical fallbacks', () => {
    const themes = safeExplanationThemes(attributeSummaries({
      adventure: { expectedContribution: 0.8, positiveProbability: 0.95 },
      history: { expectedContribution: 0.5, positiveProbability: 0.88 },
      food: { expectedContribution: 0.9, positiveProbability: 0.62 },
      urban: { expectedContribution: -0.9, positiveProbability: 0.01 },
    }));
    expect(themes).toEqual(['adventurous days', 'old places']);
    expect(themes).not.toContain('food with a sense of place');
    expect(safeExplanationThemes(attributeSummaries()).length).toBe(2);
  });

  it('counts only destination-local encountered activity evidence and never returns raw card text', () => {
    const activities = [
      activity('alpha-high', 'alpha', 5, 5),
      activity('bravo-low', 'bravo', 0, 0),
      activity('charlie', 'charlie', 1, 1),
      activity('delta', 'delta', 2, 2),
      activity('echo', 'echo', 3, 3),
      activity('foxtrot', 'foxtrot', 4, 4),
    ];
    const fit = fitForProfile(activities);
    const explanation = buildDestinationExplanation({
      fit,
      destinationId: 'alpha',
      encounteredActivityIds: ['alpha-high', 'bravo-low', 'alpha-high'],
      seed: 'profile-test',
      config: { posteriorDrawCount: 24 },
    });
    expect(explanation.encounteredActivityCount).toBe(1);
    expect(explanation.matchedActivityCount).toBe(1);
    expect(explanation.themes).toHaveLength(2);
    expect(JSON.stringify(explanation)).not.toContain('Antigua');
    expect(JSON.stringify(explanation)).not.toContain('alpha-high');
  });

  it('derives the same controlled profile deterministically from posterior draws', () => {
    const activities = [
      activity('alpha', 'alpha', 5, 5), activity('bravo', 'bravo', 0, 0), activity('charlie', 'charlie', 1, 1),
      activity('delta', 'delta', 2, 2), activity('echo', 'echo', 3, 3), activity('foxtrot', 'foxtrot', 4, 4),
    ];
    const fit = fitForProfile(activities);
    expect(buildPreferenceProfile(fit, 'same-seed', { posteriorDrawCount: 24 }))
      .toEqual(buildPreferenceProfile(fit, 'same-seed', { posteriorDrawCount: 24 }));
  });
});
