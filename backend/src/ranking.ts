import type { Activity, Attributes, Comparison, Destination } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';

export type Ranking = { activityScores: Record<string, number>; attributeScores: Record<string, number>; destinationScores: Record<string, number> };
const blankAttributes = (): Attributes => Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0])) as Attributes;

export function rankUser(destinations: Destination[], activities: Activity[], comparisons: Comparison[]): Ranking {
  const activityScores = Object.fromEntries(activities.map(({ id }) => [id, 0]));
  const attributeScores = blankAttributes();
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  for (const comparison of comparisons) {
    const winner = activityById.get(comparison.winner)!;
    const loser = activityById.get(comparison.winner === comparison.activityA ? comparison.activityB : comparison.activityA)!;
    const expected = 1 / (1 + Math.exp((activityScores[loser.id] - activityScores[winner.id]) / 24));
    const delta = 24 * (1 - expected);
    activityScores[winner.id] += delta;
    activityScores[loser.id] -= delta;
    for (const key of ATTRIBUTE_KEYS) attributeScores[key] += winner.attributes[key] - loser.attributes[key];
  }
  const destinationScores: Record<string, number> = {};
  for (const destination of destinations) {
    const portfolio = activities.filter((activity) => activity.destinationId === destination.id);
    const activitySignal = portfolio.reduce((sum, activity) => sum + activityScores[activity.id], 0) / portfolio.length;
    const attributeSignal = portfolio.reduce((sum, activity) => sum + ATTRIBUTE_KEYS.reduce((inner, key) => inner + (attributeScores[key] * activity.attributes[key]) / 5, 0), 0) / portfolio.length;
    destinationScores[destination.id] = activitySignal + attributeSignal / Math.max(1, comparisons.length);
  }
  return { activityScores, attributeScores, destinationScores };
}

export function isComplete(activities: Activity[], comparisons: Comparison[]) {
  if (comparisons.length < 24) return false;
  if (comparisons.length >= 40) return true;
  const appearances = Object.fromEntries(activities.map((activity) => [activity.destinationId, 0] as const));
  for (const comparison of comparisons) for (const id of [comparison.activityA, comparison.activityB]) appearances[activities.find((activity) => activity.id === id)!.destinationId]++;
  return Object.values(appearances).every((total) => total >= 2) && comparisons.length >= 28;
}

export function selectNextPair(activities: Activity[], comparisons: Comparison[]) {
  const seen = new Set(comparisons.map(({ activityA, activityB }) => [activityA, activityB].sort().join(':')));
  const seenActivities = new Map(activities.map(({ id }) => [id, 0]));
  for (const comparison of comparisons) { seenActivities.set(comparison.activityA, seenActivities.get(comparison.activityA)! + 1); seenActivities.set(comparison.activityB, seenActivities.get(comparison.activityB)! + 1); }
  const phaseOne = comparisons.length < 8;
  let best: [Activity, Activity] | undefined;
  let bestValue = -Infinity;
  for (let a = 0; a < activities.length; a++) for (let b = a + 1; b < activities.length; b++) {
    const first = activities[a], second = activities[b];
    if (first.destinationId === second.destinationId || seen.has([first.id, second.id].sort().join(':'))) continue;
    const distance = ATTRIBUTE_KEYS.reduce((sum, key) => sum + Math.abs(first.attributes[key] - second.attributes[key]), 0);
    const coverage = 8 - (seenActivities.get(first.id)! + seenActivities.get(second.id)!);
    const value = coverage * 10 + (phaseOne ? distance : 40 - distance);
    if (value > bestValue || (value === bestValue && `${first.id}:${second.id}` < `${best![0].id}:${best![1].id}`)) { best = [first, second]; bestValue = value; }
  }
  return best;
}
