import type { Activity, Comparison } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import { destinationUtilitiesForParameters, rankDestinationDraw } from './aggregate.js';
import { modelConfig, SELECTOR_VERSION } from './config.js';
import { comparisonDesignRow, utilityDesignRow } from './features.js';
import type { FitSuccess } from './fit.js';
import { dot, type Vector } from './linear-algebra.js';
import { drawPosteriorParameters, solvePosteriorCovariance } from './posterior.js';

export { SELECTOR_VERSION };

const MIN_DESTINATION_APPEARANCES = 2;
const RECENT_COMPARISON_WINDOW = 2;
const DIVERSITY_HISTORY_WINDOW = 4;
const BOUNDARY_DRAW_LIMIT = 64;

export type EligiblePair = readonly [Activity, Activity];

export type InformationGainSelectionInput = Readonly<{
  activities: readonly Activity[];
  comparisons: readonly Comparison[];
  fit: FitSuccess;
  /** Stable server-owned seed, never returned to the client. */
  seed: string | number;
}>;

export type SelectionMetric = Readonly<{
  pair: EligiblePair;
  score: number;
  boundaryVarianceReduction: number;
  predictiveEntropy: number;
  coverageNeed: number;
  diversityNovelty: number;
  fatiguePenalty: number;
}>;

export class SelectionError extends Error {
  readonly code: 'invalid-input' | 'fit-mismatch';

  constructor(code: SelectionError['code'], message: string) {
    super(message);
    this.name = 'SelectionError';
    this.code = code;
  }
}

function canonicalPairId(first: string, second: string): string {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

function sortedPair(first: Activity, second: Activity): EligiblePair {
  return first.id.localeCompare(second.id) <= 0 ? [first, second] : [second, first];
}

function logistic(value: number): number {
  if (value >= 0) {
    const exponent = Math.exp(-value);
    return 1 / (1 + exponent);
  }
  const exponent = Math.exp(value);
  return exponent / (1 + exponent);
}

function binaryEntropy(probability: number): number {
  if (probability <= 0 || probability >= 1) return 0;
  return -probability * Math.log2(probability) - (1 - probability) * Math.log2(1 - probability);
}

type ExposureState = Readonly<{
  activity: ReadonlyMap<string, number>;
  destination: ReadonlyMap<string, number>;
  seenPairs: ReadonlySet<string>;
  recentActivityIds: ReadonlySet<string>;
  recentHistory: readonly Activity[];
  destinationPairCounts: ReadonlyMap<string, number>;
}>;

function readExposure(activities: readonly Activity[], comparisons: readonly Comparison[]): ExposureState {
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  if (activityById.size !== activities.length) throw new SelectionError('invalid-input', 'Selection requires unique activity IDs.');
  const activity = new Map(activities.map((item) => [item.id, 0]));
  const destination = new Map([...new Set(activities.map((item) => item.destinationId))].map((id) => [id, 0]));
  const seenPairs = new Set<string>();
  const destinationPairCounts = new Map<string, number>();

  for (const comparison of comparisons) {
    const first = activityById.get(comparison.activityA);
    const second = activityById.get(comparison.activityB);
    if (!first || !second || first.id === second.id || (comparison.winner !== first.id && comparison.winner !== second.id)) {
      throw new SelectionError('invalid-input', 'Selection comparison input contains an invalid or unknown activity.');
    }
    const pairId = canonicalPairId(first.id, second.id);
    if (seenPairs.has(pairId)) {
      // A persisted duplicate is a data-integrity error; silently treating it
      // as one exposure would hide a violation of the selection contract.
      throw new SelectionError('invalid-input', 'Selection comparison input contains a duplicate activity pair.');
    }
    seenPairs.add(pairId);
    activity.set(first.id, activity.get(first.id)! + 1);
    activity.set(second.id, activity.get(second.id)! + 1);
    destination.set(first.destinationId, destination.get(first.destinationId)! + 1);
    destination.set(second.destinationId, destination.get(second.destinationId)! + 1);
    const destinationPair = canonicalPairId(first.destinationId, second.destinationId);
    destinationPairCounts.set(destinationPair, (destinationPairCounts.get(destinationPair) ?? 0) + 1);
  }

  const recent = comparisons.slice(-RECENT_COMPARISON_WINDOW).flatMap((comparison) => [comparison.activityA, comparison.activityB]);
  const recentHistory = comparisons.slice(-DIVERSITY_HISTORY_WINDOW).flatMap((comparison) => [
    activityById.get(comparison.activityA)!,
    activityById.get(comparison.activityB)!,
  ]);
  return {
    activity,
    destination,
    seenPairs,
    recentActivityIds: new Set(recent),
    recentHistory,
    destinationPairCounts,
  };
}

function baseEligiblePairs(
  activities: readonly Activity[],
  exposure: ExposureState,
  allowThirdExposure: boolean,
): EligiblePair[] {
  const needsCoverage = [...exposure.destination.values()].some((count) => count < MIN_DESTINATION_APPEARANCES);
  const candidates: EligiblePair[] = [];
  for (let left = 0; left < activities.length; left += 1) {
    for (let right = left + 1; right < activities.length; right += 1) {
      const first = activities[left]!;
      const second = activities[right]!;
      if (first.destinationId === second.destinationId) continue;
      if (exposure.seenPairs.has(canonicalPairId(first.id, second.id))) continue;
      if (needsCoverage
        && exposure.destination.get(first.destinationId)! >= MIN_DESTINATION_APPEARANCES
        && exposure.destination.get(second.destinationId)! >= MIN_DESTINATION_APPEARANCES) continue;
      // A third appearance is prohibited throughout the normal game, not just
      // the opening coverage pass. It can be relaxed only by the explicit
      // portfolio-exhaustion fallback below.
      if (!allowThirdExposure && (exposure.activity.get(first.id)! >= 2 || exposure.activity.get(second.id)! >= 2)) continue;
      candidates.push(sortedPair(first, second));
    }
  }
  // With 24 destinations and 24 early comparisons, choosing two undercovered
  // destinations whenever that option exists is what makes the documented
  // two-appearances-per-destination checkpoint achievable. The original
  // one-undercovered-endpoint guard was safe but could spend a scarce early
  // slot on a destination that had already met coverage.
  if (needsCoverage) {
    const dualCoverage = candidates.filter(([first, second]) =>
      exposure.destination.get(first.destinationId)! < MIN_DESTINATION_APPEARANCES
      && exposure.destination.get(second.destinationId)! < MIN_DESTINATION_APPEARANCES);
    if (dualCoverage.length > 0) return dualCoverage.sort((left, right) => canonicalPairId(left[0].id, left[1].id).localeCompare(canonicalPairId(right[0].id, right[1].id)));
  }
  return candidates.sort((left, right) => canonicalPairId(left[0].id, left[1].id).localeCompare(canonicalPairId(right[0].id, right[1].id)));
}

/**
 * Returns all valid candidates after hard exclusions. Recent-activity cooling
 * is relaxed only when no candidate remains, exactly as the product contract
 * allows. This helper is backend-only; no selection rationale crosses an API.
 */
export function eligibleInformationGainPairs(
  activities: readonly Activity[],
  comparisons: readonly Comparison[],
): EligiblePair[] {
  const exposure = readExposure(activities, comparisons);
  const cool = (candidates: EligiblePair[]) => {
    const cooled = candidates.filter(([first, second]) =>
      !exposure.recentActivityIds.has(first.id) && !exposure.recentActivityIds.has(second.id));
    return cooled.length > 0 ? cooled : candidates;
  };
  const primary = cool(baseEligiblePairs(activities, exposure, false));
  if (primary.length > 0) return primary;
  // Once normal choices are exhausted, a third appearance is allowed as a
  // final fallback. The exact-pair, cross-destination, and coverage guards
  // remain in force, so this cannot disguise a duplicate or unsafe pair.
  return cool(baseEligiblePairs(activities, exposure, true));
}

export function hasEligibleInformationGainPair(activities: readonly Activity[], comparisons: readonly Comparison[]): boolean {
  return eligibleInformationGainPairs(activities, comparisons).length > 0;
}

function normalize(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (!Number.isFinite(low) || !Number.isFinite(high)) throw new SelectionError('invalid-input', 'Selection metrics must be finite.');
  if (Math.abs(high - low) <= Number.EPSILON) return values.map(() => 0);
  return values.map((value) => (value - low) / (high - low));
}

function destinationBoundaryDirection(fit: FitSuccess, fifthId: string, sixthId: string): Vector {
  const averagePortfolioRow = (destinationId: string) => {
    const activities = fit.design.activities.filter((activity) => activity.destinationId === destinationId);
    if (activities.length === 0) throw new SelectionError('fit-mismatch', `Model has no activities for destination ${destinationId}.`);
    const average = Array.from({ length: fit.parameters.length }, () => 0);
    for (const activity of activities) {
      const row = utilityDesignRow(fit.design, activity.id);
      for (let index = 0; index < average.length; index += 1) average[index]! += row[index]! / activities.length;
    }
    return average;
  };
  const fifth = averagePortfolioRow(fifthId);
  const sixth = averagePortfolioRow(sixthId);
  return fifth.map((value, index) => value - sixth[index]!);
}

type BoundarySample = Readonly<{ direction: Vector; variance: number; parameters: readonly number[] }>;

function boundarySamples(fit: FitSuccess, seed: string | number): BoundarySample[] {
  const count = Math.min(BOUNDARY_DRAW_LIMIT, modelConfig.posteriorDrawCount);
  const draws = drawPosteriorParameters(fit, count, `${seed}:selection-boundary`);
  const samples: BoundarySample[] = [];
  for (const parameters of draws) {
    const ranking = rankDestinationDraw(destinationUtilitiesForParameters(fit, parameters));
    const fifth = ranking[4]?.id;
    const sixth = ranking[5]?.id;
    if (!fifth || !sixth) throw new SelectionError('fit-mismatch', 'Information-gain selection requires at least six destinations.');
    // Repeated boundary identities represent posterior mass. Retaining every
    // deterministic draw intentionally weights high-mass boundaries correctly.
    const direction = destinationBoundaryDirection(fit, fifth, sixth);
    const covarianceDirection = solvePosteriorCovariance(fit, direction);
    const variance = dot(direction, covarianceDirection);
    if (!(variance >= 0) || !Number.isFinite(variance)) throw new SelectionError('fit-mismatch', 'Boundary posterior variance is invalid.');
    samples.push({ direction, variance, parameters });
  }
  return samples;
}

function coverageNeed(pair: EligiblePair, exposure: ExposureState): number {
  const destinationNeed = [pair[0], pair[1]].reduce(
    (total, activity) => total + Math.max(0, MIN_DESTINATION_APPEARANCES - exposure.destination.get(activity.destinationId)!),
    0,
  );
  const activityNeed = [pair[0], pair[1]].reduce(
    (total, activity) => total + Math.max(0, MIN_DESTINATION_APPEARANCES - exposure.activity.get(activity.id)!),
    0,
  );
  return Math.min(4, destinationNeed) + Math.min(4, activityNeed) / 2;
}

function activityDistance(first: Activity, second: Activity): number {
  return ATTRIBUTE_KEYS.reduce((total, key) => total + Math.abs(first.attributes[key] - second.attributes[key]), 0) / (ATTRIBUTE_KEYS.length * 5);
}

function diversityNovelty(pair: EligiblePair, exposure: ExposureState): number {
  const historyDistance = exposure.recentHistory.length === 0
    ? 1
    : ([pair[0], pair[1]].reduce((total, activity) => total + exposure.recentHistory.reduce(
      (inner, previous) => inner + activityDistance(activity, previous), 0,
    ) / exposure.recentHistory.length, 0) / 2);
  const destinationPair = canonicalPairId(pair[0].destinationId, pair[1].destinationId);
  const destinationNovelty = 1 / (1 + (exposure.destinationPairCounts.get(destinationPair) ?? 0));
  return historyDistance * 0.75 + destinationNovelty * 0.25;
}

function fatiguePenalty(pair: EligiblePair, exposure: ExposureState): number {
  return [pair[0], pair[1]].reduce((total, activity) => {
    const appearances = exposure.activity.get(activity.id)!;
    if (appearances <= 0) return total;
    if (appearances === 1) return total + 0.04;
    if (appearances === 2) return total + 0.45;
    return total + 0.9;
  }, 0);
}

function assertFitMatchesActivities(input: InformationGainSelectionInput) {
  const selectedIds = [...input.activities].map((activity) => activity.id).sort((left, right) => left.localeCompare(right));
  if (selectedIds.length !== input.fit.design.activityIds.length
    || selectedIds.some((id, index) => id !== input.fit.design.activityIds[index])) {
    throw new SelectionError('fit-mismatch', 'Selection activity portfolio must exactly match the fitted design matrix.');
  }
}

/**
 * Backend-only diagnostic scoring. The HTTP layer receives only the selected
 * opaque activities, never these metrics or a selection rationale.
 */
export function scoreInformationGainPairs(input: InformationGainSelectionInput): SelectionMetric[] {
  assertFitMatchesActivities(input);
  const exposure = readExposure(input.activities, input.comparisons);
  const candidates = eligibleInformationGainPairs(input.activities, input.comparisons);
  if (candidates.length === 0) return [];
  const boundary = boundarySamples(input.fit, input.seed);

  const raw = candidates.map((pair) => {
    const row = comparisonDesignRow(input.fit.design, pair[0].id, pair[1].id);
    // Entropy and Fisher information use the posterior predictive, not an
    // overconfident plug-in MAP probability. Each boundary draw is already a
    // deterministic posterior sub-sample, so the same stream supports both
    // terms without a second random source.
    const predictiveProbabilities = boundary.map((sample) => logistic(dot(row, sample.parameters)));
    const probability = predictiveProbabilities.reduce((total, value) => total + value, 0) / predictiveProbabilities.length;
    const weight = Math.max(
      predictiveProbabilities.reduce((total, value) => total + value * (1 - value), 0) / predictiveProbabilities.length,
      Number.EPSILON,
    );
    const covarianceRow = solvePosteriorCovariance(input.fit, row);
    const rowVariance = dot(row, covarianceRow);
    const reduction = boundary.reduce((total, sample) => {
      const covariance = dot(sample.direction, covarianceRow);
      const denominator = 1 / weight + rowVariance;
      return total + Math.max(0, (covariance * covariance) / denominator);
    }, 0) / boundary.length;
    return {
      pair,
      boundaryVarianceReduction: reduction,
      predictiveEntropy: binaryEntropy(probability),
      coverageNeed: coverageNeed(pair, exposure),
      diversityNovelty: diversityNovelty(pair, exposure),
      fatiguePenalty: fatiguePenalty(pair, exposure),
    };
  });

  const boundaryReduction = normalize(raw.map((entry) => entry.boundaryVarianceReduction));
  const entropy = normalize(raw.map((entry) => entry.predictiveEntropy));
  const coverage = normalize(raw.map((entry) => entry.coverageNeed));
  const diversity = normalize(raw.map((entry) => entry.diversityNovelty));
  return raw.map((entry, index) => ({
    ...entry,
    score: 0.45 * boundaryReduction[index]!
      + 0.25 * entropy[index]!
      + 0.20 * coverage[index]!
      + 0.10 * diversity[index]!
      - entry.fatiguePenalty,
  })).sort((left, right) => right.score - left.score
    || canonicalPairId(left.pair[0].id, left.pair[1].id).localeCompare(canonicalPairId(right.pair[0].id, right.pair[1].id)));
}

/** Returns the one deterministic pair to issue, or undefined when exhausted. */
export function selectInformationGainPair(input: InformationGainSelectionInput): EligiblePair | undefined {
  return scoreInformationGainPairs(input)[0]?.pair;
}
