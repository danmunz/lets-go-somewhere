import type { Activity, Comparison } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import { analyzeIndividualDestinationPosterior, type IndividualDestinationAnalysis } from './aggregate.js';
import { SHORTLIST_MODEL_VERSION, SHORTLIST_POLICY_VERSION, shortlistModelConfig } from './config.js';
import { fitBayesianAttributeShortlist, type FitSuccess, type MapFit } from './fit.js';
import { buildDestinationExplanation, buildPreferenceProfile, type SafeDestinationExplanation } from './profile.js';
import { eligibleInformationGainPairs, selectInformationGainPair } from './selection.js';

export const SHORTLIST_COMPARISONS = 32 as const;
export const SHORTLIST_COVERAGE_COMPARISONS = 24 as const;

export type ShortlistResult = Readonly<{
  modelVersion: typeof SHORTLIST_MODEL_VERSION;
  policyVersion: typeof SHORTLIST_POLICY_VERSION;
  fit: FitSuccess;
  analysis: IndividualDestinationAnalysis;
}>;

export class ShortlistError extends Error {
  constructor(readonly code: 'fit-failed' | 'incomplete-round' | 'no-eligible-pair', message: string) {
    super(message);
  }
}

function requireFit(fit: MapFit): FitSuccess {
  if (!fit.ok) throw new ShortlistError('fit-failed', 'The preference model needs another moment. Please retry the next choice.');
  return fit;
}

/** Fits only the eight travel attributes, then turns the portfolio into a private shortlist. */
export function analyzeShortlist(
  activities: readonly Activity[],
  comparisons: readonly Comparison[],
  seed: string | number,
): ShortlistResult {
  const fit = requireFit(fitBayesianAttributeShortlist(activities, comparisons, shortlistModelConfig));
  return {
    modelVersion: SHORTLIST_MODEL_VERSION,
    policyVersion: SHORTLIST_POLICY_VERSION,
    fit,
    analysis: analyzeIndividualDestinationPosterior(fit, `${seed}:shortlist`, shortlistModelConfig),
  };
}

/**
 * The first 24 selections inherit the hard two-appearance coverage guard from
 * the selector. The final eight use the same selector's posterior boundary
 * objective; no completion-confidence result is ever sent to the participant.
 */
export function selectShortlistPair(
  activities: readonly Activity[],
  comparisons: readonly Comparison[],
  seed: string | number,
): readonly [Activity, Activity] | undefined {
  if (comparisons.length >= SHORTLIST_COMPARISONS) return undefined;
  // Coverage comes first. Its deterministic high-contrast choice avoids
  // repeatedly fitting a model before enough evidence exists to usefully
  // target the top-five boundary.
  if (comparisons.length < SHORTLIST_COVERAGE_COMPARISONS) {
    return eligibleInformationGainPairs(activities, comparisons)
      .map((pair) => ({
        pair,
        contrast: ATTRIBUTE_KEYS.reduce((total, key) => total + Math.abs(pair[0].attributes[key] - pair[1].attributes[key]), 0),
      }))
      .sort((left, right) => right.contrast - left.contrast
        || left.pair[0].id.localeCompare(right.pair[0].id)
        || left.pair[1].id.localeCompare(right.pair[1].id))[0]?.pair;
  }
  const fit = requireFit(fitBayesianAttributeShortlist(activities, comparisons, shortlistModelConfig));
  const pair = selectInformationGainPair({ activities, comparisons, fit, seed: `${seed}:${comparisons.length + 1}` });
  if (pair) return pair;
  // This is defensive only: the production portfolio has many eligible pairs.
  return eligibleInformationGainPairs(activities, comparisons)[0];
}

export function shortlistProfile(activities: readonly Activity[], comparisons: readonly Comparison[], seed: string | number) {
  return buildPreferenceProfile(analyzeShortlist(activities, comparisons, seed).fit, `${seed}:profile`, shortlistModelConfig);
}

export function shortlistRanking(activities: readonly Activity[], comparisons: readonly Comparison[], seed: string | number) {
  const result = analyzeShortlist(activities, comparisons, seed);
  return result.analysis.ranking.map(({ id }) => id);
}

export function shortlistExplanation(
  activities: readonly Activity[],
  comparisons: readonly Comparison[],
  destinationId: string,
  seed: string | number,
): SafeDestinationExplanation {
  const result = analyzeShortlist(activities, comparisons, seed);
  return buildDestinationExplanation({
    fit: result.fit,
    destinationId,
    encounteredActivityIds: comparisons.flatMap((comparison) => [comparison.activityA, comparison.activityB]),
    seed: `${seed}:explanation`,
    config: shortlistModelConfig,
  });
}

export function isShortlistComplete(comparisons: readonly Comparison[]): boolean {
  return comparisons.length >= SHORTLIST_COMPARISONS;
}

export function shortlistProgress(comparisons: number) {
  return {
    comparisons,
    minimum: SHORTLIST_COMPARISONS,
    maximum: SHORTLIST_COMPARISONS,
    estimatedCompletion: Math.min(1, comparisons / SHORTLIST_COMPARISONS),
    phase: comparisons < SHORTLIST_COVERAGE_COMPARISONS ? (comparisons < 12 ? 'explore' as const : 'discriminate' as const) : 'checking-boundary' as const,
  };
}

/** Kept here to make the presentation contract explicit at the model boundary. */
export function topFiveShortlist(activities: readonly Activity[], comparisons: readonly Comparison[], seed: string | number): string[] {
  if (!isShortlistComplete(comparisons)) throw new ShortlistError('incomplete-round', 'A shortlist is ready after all 32 choices.');
  return shortlistRanking(activities, comparisons, seed).slice(0, 5);
}

export const shortlistModelMetadata = {
  modelVersion: SHORTLIST_MODEL_VERSION,
  policyVersion: SHORTLIST_POLICY_VERSION,
  comparisons: SHORTLIST_COMPARISONS,
} as const;
