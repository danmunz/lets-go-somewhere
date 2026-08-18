import { describe, expect, it } from 'vitest';
import type { Activity } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import {
  comparisonDesignRow,
  createDesignMatrix,
  FeatureError,
  prepareComparisons,
  utilityDesignRow,
} from '../../src/model/features.js';

function activity(id: string, destinationId: string, adventure: number, nature: number): Activity {
  return {
    id,
    destinationId,
    title: id,
    description: `${id} description`,
    imageUrl: '/media/cards/example.webp',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, key === 'adventure' ? adventure : key === 'nature' ? nature : 2])) as Activity['attributes'],
  };
}

describe('model feature design', () => {
  const activities = [activity('bravo', 'south', 5, 3), activity('alpha', 'north', 1, 1), activity('charlie', 'north', 3, 5)];

  it('uses a fixed lexical parameter order and centered/scaled feature columns', () => {
    const design = createDesignMatrix(activities);
    expect(design.activityIds).toEqual(['alpha', 'bravo', 'charlie']);
    expect(design.destinationIds).toEqual(['north', 'south']);
    expect(design.parameterCount).toBe(8 + 2 + 3);
    expect(design.parameterNames.slice(0, 8)).toEqual([
      'beta:adventure', 'beta:nature', 'beta:culture', 'beta:food',
      'beta:history', 'beta:urban', 'beta:novelty', 'beta:physicalIntensity',
    ]);
    expect(design.parameterNames.slice(8)).toEqual(['destination:north', 'destination:south', 'activity:alpha', 'activity:bravo', 'activity:charlie']);
    expect(design.attributeMeans.adventure).toBe(3);
    expect(design.attributeScales.adventure).toBeCloseTo(Math.sqrt(8 / 3));
    const adventureValues = design.activityIds.map((id) => design.featureByActivityId.get(id)![0]!);
    expect(adventureValues.reduce((total, value) => total + value, 0)).toBeCloseTo(0);
  });

  it('encodes utility and comparison rows without a global intercept', () => {
    const design = createDesignMatrix(activities);
    const alpha = utilityDesignRow(design, 'alpha');
    expect(alpha).toHaveLength(design.parameterCount);
    expect(alpha[8]).toBe(1);
    expect(alpha[10]).toBe(1);
    const pair = comparisonDesignRow(design, 'alpha', 'bravo');
    expect(pair[8]).toBe(1);
    expect(pair[9]).toBe(-1);
    expect(pair[10]).toBe(1);
    expect(pair[11]).toBe(-1);
    expect(prepareComparisons(design, [{ activityA: 'alpha', activityB: 'bravo', winner: 'bravo' }])[0]!.target).toBe(0);
  });

  it('uses explicit residual coefficients only for encountered activities', () => {
    const compact = createDesignMatrix(activities, ['alpha', 'charlie', 'alpha']);
    expect(compact.residualActivityIds).toEqual(['alpha', 'charlie']);
    expect(compact.parameterCount).toBe(8 + 2 + 2);
    expect(utilityDesignRow(compact, 'bravo').slice(10)).toEqual([0, 0]);
  });

  it('rejects duplicate or unknown activity input', () => {
    expect(() => createDesignMatrix([...activities, activities[0]!])).toThrow(FeatureError);
    const design = createDesignMatrix(activities);
    expect(() => utilityDesignRow(design, 'missing')).toThrow(/Unknown activity/);
  });
});
