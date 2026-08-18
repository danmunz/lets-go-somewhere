import type { Activity, Comparison, CompletionState, Progress } from '@lgs/shared';
import type { IndividualDestinationAnalysis } from './aggregate.js';
import { confidenceThresholds } from './aggregate.js';
import { hasEligibleInformationGainPair } from './selection.js';

export const MINIMUM_COMPARISONS = 24 as const;
export const MAXIMUM_COMPARISONS = 40 as const;

export type CompletionReason = 'stable-top-five' | 'maximum-reached' | 'portfolio-exhausted';
export type CompletionConfidenceLabel = 'clear-shape' | 'close-call';

export type StoppingDecision = Readonly<{
  complete: boolean;
  progress: Progress;
  completion?: CompletionState;
}>;

export type StoppingInput = Readonly<{
  activities: readonly Activity[];
  comparisons: readonly Comparison[];
  /** Required once the game reaches the minimum; omission fails closed. */
  analysis?: Pick<IndividualDestinationAnalysis, 'topFiveSetStability' | 'fifthSixthBoundaryProbability'>;
  /** Persisted visual progress can clamp the estimated value monotonically. */
  previousEstimatedCompletion?: number;
  /** Test seam for exhaustively checked eligible-pair availability. */
  hasEligiblePair?: boolean;
}>;

export class StoppingError extends Error {
  readonly code: 'invalid-input' | 'missing-analysis';

  constructor(code: StoppingError['code'], message: string) {
    super(message);
    this.name = 'StoppingError';
    this.code = code;
  }
}

function phaseFor(comparisons: number): Progress['phase'] {
  if (comparisons < 12) return 'explore';
  if (comparisons < MINIMUM_COMPARISONS) return 'discriminate';
  return 'checking-boundary';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stabilityScore(analysis: NonNullable<StoppingInput['analysis']>): number {
  return clamp((analysis.topFiveSetStability + analysis.fifthSixthBoundaryProbability) / 2, 0, 1);
}

function destinationCoverageComplete(activities: readonly Activity[], comparisons: readonly Comparison[]): boolean {
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const appearances = new Map([...new Set(activities.map((activity) => activity.destinationId))].map((id) => [id, 0]));
  for (const comparison of comparisons) {
    for (const activityId of [comparison.activityA, comparison.activityB]) {
      const activity = activityById.get(activityId);
      if (!activity) throw new StoppingError('invalid-input', 'Stopping comparison references an unknown activity.');
      appearances.set(activity.destinationId, appearances.get(activity.destinationId)! + 1);
    }
  }
  return [...appearances.values()].every((count) => count >= 2);
}

function completionConfidence(analysis: NonNullable<StoppingInput['analysis']>): CompletionConfidenceLabel {
  return analysis.topFiveSetStability >= confidenceThresholds.topFiveSetStability
    && analysis.fifthSixthBoundaryProbability >= confidenceThresholds.fifthSixthBoundary
    ? 'clear-shape'
    : 'close-call';
}

export function isStableTopFive(analysis: NonNullable<StoppingInput['analysis']>): boolean {
  return completionConfidence(analysis) === 'clear-shape';
}

/**
 * Honest visual pacing: before question 24 it mirrors the public minimum;
 * afterward it is guided by current stability. The optional persisted previous
 * value prevents a re-fit from making the client bar move backward.
 */
export function progressFor(input: StoppingInput): Progress {
  const comparisons = input.comparisons.length;
  if (!Number.isInteger(comparisons) || comparisons < 0 || comparisons > MAXIMUM_COMPARISONS) {
    throw new StoppingError('invalid-input', 'Comparison count must remain within the 0–40 game envelope.');
  }
  let estimatedCompletion: number;
  if (comparisons < MINIMUM_COMPARISONS) {
    estimatedCompletion = comparisons / MINIMUM_COMPARISONS;
  } else if (comparisons >= MAXIMUM_COMPARISONS) {
    estimatedCompletion = 1;
  } else {
    if (!input.analysis) throw new StoppingError('missing-analysis', 'Posterior analysis is required after the minimum comparison count.');
    // The 24th answer is visibly near the finish, while remaining uncertainty
    // determines how quickly the bounded checking phase approaches completion.
    estimatedCompletion = 0.96 + 0.03 * stabilityScore(input.analysis)
      + 0.005 * ((comparisons - MINIMUM_COMPARISONS) / (MAXIMUM_COMPARISONS - MINIMUM_COMPARISONS));
    estimatedCompletion = Math.min(0.999, estimatedCompletion);
  }
  if (input.previousEstimatedCompletion !== undefined) {
    if (!Number.isFinite(input.previousEstimatedCompletion) || input.previousEstimatedCompletion < 0 || input.previousEstimatedCompletion > 1) {
      throw new StoppingError('invalid-input', 'Previous estimated completion must be a finite unit interval value.');
    }
    estimatedCompletion = Math.max(estimatedCompletion, input.previousEstimatedCompletion);
  }
  return {
    comparisons,
    minimum: MINIMUM_COMPARISONS,
    maximum: MAXIMUM_COMPARISONS,
    estimatedCompletion: clamp(estimatedCompletion, 0, 1),
    phase: phaseFor(comparisons),
  };
}

function completed(progress: Progress, reason: CompletionReason, confidenceLabel: CompletionConfidenceLabel): StoppingDecision {
  return {
    complete: true,
    progress: { ...progress, estimatedCompletion: 1 },
    completion: { complete: true, reason, confidenceLabel },
  };
}

/**
 * Applies the confidence-aware 24–40 rule. `portfolio-exhausted` is only
 * emitted after the selector has exhaustively checked all hard/relaxed eligible
 * candidates, and is always an honest close-call rather than a false success.
 */
export function evaluateStopping(input: StoppingInput): StoppingDecision {
  const progress = progressFor(input);
  const comparisons = input.comparisons.length;
  if (comparisons < MINIMUM_COMPARISONS) return { complete: false, progress };
  if (!input.analysis) throw new StoppingError('missing-analysis', 'Posterior analysis is required to decide completion.');
  if (comparisons >= MAXIMUM_COMPARISONS) {
    return completed(progress, 'maximum-reached', completionConfidence(input.analysis));
  }
  const hasEligiblePair = input.hasEligiblePair ?? hasEligibleInformationGainPair(input.activities, input.comparisons);
  if (!hasEligiblePair) return completed(progress, 'portfolio-exhausted', 'close-call');
  if (!destinationCoverageComplete(input.activities, input.comparisons)) return { complete: false, progress };
  if (!isStableTopFive(input.analysis)) return { complete: false, progress };
  return completed(progress, 'stable-top-five', 'clear-shape');
}
