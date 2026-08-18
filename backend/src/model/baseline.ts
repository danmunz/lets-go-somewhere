/**
 * Frozen pre-one-trip ranking behaviour for deterministic replay only.
 *
 * This module deliberately has no pair-selection export.  Production routing
 * must use `selection.ts` after the model promotion gate; the baseline exists
 * solely so the evaluator can compare a candidate model against the deployed
 * `elo-coverage-v1` behaviour on identical synthetic choices.
 */
import type { Activity, Attributes, Comparison, Destination } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import { BASELINE_MODEL_VERSION } from './config.js';

export { BASELINE_MODEL_VERSION };

export type BaselineRanking = Readonly<{
  activityScores: Record<string, number>;
  attributeScores: Record<string, number>;
  destinationScores: Record<string, number>;
}>;

const blankAttributes = (): Attributes =>
  Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0])) as Attributes;

/** @internal Replay/evaluation only; never call from an HTTP route. */
export function replayBaselineRanking(
  destinations: readonly Destination[],
  activities: readonly Activity[],
  comparisons: readonly Comparison[],
): BaselineRanking {
  const activityScores = Object.fromEntries(activities.map(({ id }) => [id, 0]));
  const attributeScores = blankAttributes();
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));

  for (const comparison of comparisons) {
    const winner = activityById.get(comparison.winner);
    const loserId = comparison.winner === comparison.activityA ? comparison.activityB : comparison.activityA;
    const loser = activityById.get(loserId);
    if (!winner || !loser) throw new Error('Baseline replay comparison references an unknown activity.');
    const expected = 1 / (1 + Math.exp((activityScores[loser.id]! - activityScores[winner.id]!) / 24));
    const delta = 24 * (1 - expected);
    activityScores[winner.id]! += delta;
    activityScores[loser.id]! -= delta;
    for (const key of ATTRIBUTE_KEYS) attributeScores[key] += winner.attributes[key] - loser.attributes[key];
  }

  const destinationScores: Record<string, number> = {};
  for (const destination of destinations) {
    const portfolio = activities.filter((activity) => activity.destinationId === destination.id);
    if (portfolio.length === 0) throw new Error(`Baseline replay destination ${destination.id} has no activities.`);
    const activitySignal = portfolio.reduce((sum, activity) => sum + activityScores[activity.id]!, 0) / portfolio.length;
    const attributeSignal = portfolio.reduce((sum, activity) => sum + ATTRIBUTE_KEYS.reduce(
      (inner, key) => inner + (attributeScores[key] * activity.attributes[key]) / 5,
      0,
    ), 0) / portfolio.length;
    destinationScores[destination.id] = activitySignal + attributeSignal / Math.max(1, comparisons.length);
  }
  return { activityScores, attributeScores, destinationScores };
}

/** @internal Replay/evaluation only; mirrors the deployed coverage stop. */
export function replayBaselineShouldStop(
  activities: readonly Activity[],
  comparisons: readonly Comparison[],
): boolean {
  if (comparisons.length < 24) return false;
  if (comparisons.length >= 40) return true;
  const appearances = Object.fromEntries(
    [...new Set(activities.map((activity) => activity.destinationId))].map((id) => [id, 0]),
  ) as Record<string, number>;
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  for (const comparison of comparisons) {
    for (const activityId of [comparison.activityA, comparison.activityB]) {
      const activity = activityById.get(activityId);
      if (!activity) throw new Error('Baseline replay comparison references an unknown activity.');
      appearances[activity.destinationId]! += 1;
    }
  }
  return Object.values(appearances).every((total) => total >= 2) && comparisons.length >= 28;
}
