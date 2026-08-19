import { ATTRIBUTE_KEYS, type Activity, type AttributeKey, type Comparison } from '@lgs/shared';
import { MODEL_PARAMETER_ORDER } from './config.js';
import { createVector, type Vector } from './linear-algebra.js';

export type DesignMatrix = Readonly<{
  activities: readonly Activity[];
  activityIds: readonly string[];
  /**
   * Only activities that have actually appeared in this person's round receive
   * an explicit residual coefficient. Unseen activities remain exchangeable
   * draws from the same zero-mean residual distribution (aggregate.ts adds
   * that uncertainty when a destination portfolio is summarized).
   */
  residualActivityIds: readonly string[];
  destinationIds: readonly string[];
  attributeMeans: Readonly<Record<AttributeKey, number>>;
  attributeScales: Readonly<Record<AttributeKey, number>>;
  featureByActivityId: ReadonlyMap<string, readonly number[]>;
  activityIndexById: ReadonlyMap<string, number>;
  residualActivityIndexById: ReadonlyMap<string, number>;
  destinationIndexById: ReadonlyMap<string, number>;
  parameterNames: readonly string[];
  parameterCount: number;
  includeDestinationEffects: boolean;
}>;

export class FeatureError extends Error {
  readonly code: 'duplicate-activity' | 'unknown-activity' | 'invalid-comparison';

  constructor(code: FeatureError['code'], message: string) {
    super(message);
    this.name = 'FeatureError';
    this.code = code;
  }
}

function sortedCopy<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function standardization(activities: readonly Activity[], key: AttributeKey) {
  const values = activities.map((activity) => activity.attributes[key]);
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  // A constant column contains no evidence. Leaving it centered at zero is
  // preferable to producing Infinity or inventing a scale.
  return { mean, scale: Math.sqrt(variance) || 1 };
}

/** Creates a canonical, centered/scaled eight-attribute model design. */
export function createDesignMatrix(
  inputActivities: readonly Activity[],
  residualInputIds: readonly string[] = inputActivities.map((activity) => activity.id),
  options: Readonly<{ includeDestinationEffects?: boolean; includeActivityResiduals?: boolean }> = {},
): DesignMatrix {
  if (inputActivities.length === 0) throw new FeatureError('invalid-comparison', 'A model requires at least one activity.');
  const activities = sortedCopy(inputActivities);
  const activityIds = activities.map((activity) => activity.id);
  if (new Set(activityIds).size !== activities.length) throw new FeatureError('duplicate-activity', 'Activity IDs must be unique.');
  const destinationIds = [...new Set(activities.map((activity) => activity.destinationId))].sort((left, right) => left.localeCompare(right));
  const stats = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, standardization(activities, key)])) as Record<AttributeKey, { mean: number; scale: number }>;
  const attributeMeans = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, stats[key].mean])) as Record<AttributeKey, number>;
  const attributeScales = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, stats[key].scale])) as Record<AttributeKey, number>;
  const activityIndexById = new Map(activityIds.map((id, index) => [id, index]));
  const includeDestinationEffects = options.includeDestinationEffects ?? true;
  const includeActivityResiduals = options.includeActivityResiduals ?? true;
  const residualActivityIds = includeActivityResiduals
    ? [...new Set(residualInputIds)].sort((left, right) => left.localeCompare(right))
    : [];
  if (residualActivityIds.some((id) => !activityIndexById.has(id))) {
    throw new FeatureError('unknown-activity', 'Residual activity IDs must belong to the activity portfolio.');
  }
  const residualActivityIndexById = new Map(residualActivityIds.map((id, index) => [id, index]));
  const destinationIndexById = new Map(destinationIds.map((id, index) => [id, index]));
  const featureByActivityId = new Map(activities.map((activity) => [
    activity.id,
    ATTRIBUTE_KEYS.map((key) => (activity.attributes[key] - attributeMeans[key]) / attributeScales[key]),
  ]));
  const parameterNames = [
    ...MODEL_PARAMETER_ORDER,
    ...(includeDestinationEffects ? destinationIds.map((id) => `destination:${id}`) : []),
    ...residualActivityIds.map((id) => `activity:${id}`),
  ];
  return {
    activities,
    activityIds,
    residualActivityIds,
    destinationIds,
    attributeMeans,
    attributeScales,
    featureByActivityId,
    activityIndexById,
    residualActivityIndexById,
    destinationIndexById,
    parameterNames,
    parameterCount: parameterNames.length,
    includeDestinationEffects,
  };
}

export function activityFeature(design: DesignMatrix, activityId: string): readonly number[] {
  const feature = design.featureByActivityId.get(activityId);
  if (!feature) throw new FeatureError('unknown-activity', `Unknown activity: ${activityId}`);
  return feature;
}

/** Sparse concept, dense representation: 152 entries is cheaper and safer here. */
export function utilityDesignRow(design: DesignMatrix, activityId: string): number[] {
  const activity = design.activities[design.activityIndexById.get(activityId) ?? -1];
  if (!activity) throw new FeatureError('unknown-activity', `Unknown activity: ${activityId}`);
  const row = createVector(design.parameterCount);
  const features = activityFeature(design, activityId);
  for (let index = 0; index < ATTRIBUTE_KEYS.length; index += 1) row[index] = features[index]!;
  const destinationIndex = design.destinationIndexById.get(activity.destinationId);
  if (design.includeDestinationEffects) {
    if (destinationIndex === undefined) throw new FeatureError('unknown-activity', `Missing model index for ${activityId}.`);
    row[ATTRIBUTE_KEYS.length + destinationIndex] = 1;
  }
  const residualIndex = design.residualActivityIndexById.get(activityId);
  if (residualIndex !== undefined) {
    const residualOffset = ATTRIBUTE_KEYS.length + (design.includeDestinationEffects ? design.destinationIds.length : 0);
    row[residualOffset + residualIndex] = 1;
  }
  return row;
}

export function comparisonDesignRow(design: DesignMatrix, activityA: string, activityB: string): number[] {
  if (activityA === activityB) throw new FeatureError('invalid-comparison', 'A comparison requires two distinct activities.');
  const first = utilityDesignRow(design, activityA);
  const second = utilityDesignRow(design, activityB);
  return first.map((value, index) => value - second[index]!);
}

export type PreparedComparison = Readonly<{ row: Vector; target: 0 | 1; activityA: string; activityB: string }>;

export function prepareComparisons(design: DesignMatrix, comparisons: readonly Comparison[]): PreparedComparison[] {
  return comparisons.map((comparison) => {
    if (comparison.winner !== comparison.activityA && comparison.winner !== comparison.activityB) {
      throw new FeatureError('invalid-comparison', 'Comparison winner must be one of its activities.');
    }
    return {
      row: comparisonDesignRow(design, comparison.activityA, comparison.activityB),
      target: comparison.winner === comparison.activityA ? 1 : 0,
      activityA: comparison.activityA,
      activityB: comparison.activityB,
    };
  });
}

export function utilityFromParameters(design: DesignMatrix, parameters: Vector, activityId: string): number {
  if (parameters.length !== design.parameterCount) throw new FeatureError('invalid-comparison', 'Parameter vector does not match the design matrix.');
  const row = utilityDesignRow(design, activityId);
  return row.reduce((total, value, index) => total + value * parameters[index]!, 0);
}
