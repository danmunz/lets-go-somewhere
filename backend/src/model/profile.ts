import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type PreferenceProfile,
  type ProfileDimension,
} from '@lgs/shared';
import { modelConfig, type ModelConfig } from './config.js';
import { utilityFromParameters } from './features.js';
import type { FitSuccess } from './fit.js';
import { drawPosteriorParameters } from './posterior.js';

type ControlledAttributeCopy = Readonly<{
  dimensionLabel: string;
  theme: string;
}>;

/**
 * These phrases are intentionally categorical and destination-free. Do not
 * substitute activity titles, place names, scores, or model values here.
 */
export const ATTRIBUTE_COPY: Readonly<Record<AttributeKey, ControlledAttributeCopy>> = {
  adventure: { dimensionLabel: 'adventurous days', theme: 'adventurous days' },
  nature: { dimensionLabel: 'time outside', theme: 'time outside' },
  culture: { dimensionLabel: 'local culture', theme: 'local culture' },
  food: { dimensionLabel: 'food with a sense of place', theme: 'food with a sense of place' },
  history: { dimensionLabel: 'old places', theme: 'old places' },
  urban: { dimensionLabel: 'city energy', theme: 'city energy' },
  novelty: { dimensionLabel: 'distinctive experiences', theme: 'distinctive experiences' },
  physicalIntensity: { dimensionLabel: 'days that get you moving', theme: 'days that get you moving' },
};

const FALLBACK_THEMES = ['the overall trip mix', 'the way your choices fit together'] as const;
const POSITIVE_THEME_PROBABILITY = 0.8;

export type AttributePosteriorSummary = Readonly<{
  key: AttributeKey;
  expectedContribution: number;
  positiveProbability: number;
}>;

/** Structural twin of the shared post-reveal explanation contract. */
export type SafeDestinationExplanation = Readonly<{
  themes: string[];
  matchedActivityCount: number;
  encounteredActivityCount: number;
}>;

export class ProfileError extends Error {
  readonly code: 'invalid-fit' | 'invalid-activity';

  constructor(code: ProfileError['code'], message: string) {
    super(message);
    this.name = 'ProfileError';
    this.code = code;
  }
}

function mean(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new ProfileError('invalid-fit', 'A posterior summary requires finite values.');
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new ProfileError('invalid-activity', 'A median requires finite encountered activity utilities.');
  }
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!;
}

function dimensionStrength(summary: AttributePosteriorSummary): ProfileDimension['strength'] {
  const certainty = Math.max(summary.positiveProbability, 1 - summary.positiveProbability);
  const magnitude = Math.abs(summary.expectedContribution);
  if (certainty >= 0.85 && magnitude >= 0.2) return 'strong';
  if (certainty >= 0.7 && magnitude >= 0.08) return 'present';
  return 'open';
}

const strengthOrder: Readonly<Record<ProfileDimension['strength'], number>> = {
  strong: 0,
  present: 1,
  open: 2,
};

/** Builds a controlled, categorical profile from attribute posterior summaries. */
export function buildPreferenceProfileFromAttributes(
  input: readonly AttributePosteriorSummary[],
): PreferenceProfile {
  const byKey = new Map(input.map((summary) => [summary.key, summary]));
  if (byKey.size !== ATTRIBUTE_KEYS.length || ATTRIBUTE_KEYS.some((key) => !byKey.has(key))) {
    throw new ProfileError('invalid-fit', 'A preference profile requires all eight attribute posterior summaries.');
  }
  const dimensions = ATTRIBUTE_KEYS.map((key) => {
    const summary = byKey.get(key)!;
    const strength = dimensionStrength(summary);
    const certainty = Math.max(summary.positiveProbability, 1 - summary.positiveProbability);
    return {
      key,
      label: ATTRIBUTE_COPY[key].dimensionLabel,
      strength,
      direction: summary.expectedContribution >= 0 ? 'drawn-to' as const : 'less-drawn-to' as const,
      certainty,
      magnitude: Math.abs(summary.expectedContribution),
    };
  }).sort((left, right) => strengthOrder[left.strength] - strengthOrder[right.strength]
    || right.certainty - left.certainty
    || right.magnitude - left.magnitude
    || left.key.localeCompare(right.key));

  const clearDimensions = dimensions.filter((dimension) => dimension.strength !== 'open');
  const selected = (clearDimensions.length >= 3 ? clearDimensions.slice(0, 5) : dimensions.slice(0, 2))
    .map(({ certainty: _certainty, magnitude: _magnitude, ...dimension }) => dimension);
  const clearShape = clearDimensions.length >= 3;
  const labels = selected.map((dimension) => dimension.label);
  return {
    headline: clearShape ? 'The shape of your trip came through clearly.' : 'Apparently, this is your kind of trip.',
    synthesis: clearShape
      ? `You consistently leaned toward ${joinLabels(labels)}.`
      : 'Your trip rhythm is still taking shape, with a few honest close calls.',
    dimensions: selected,
    confidenceLabel: clearShape ? 'clear-shape' : 'still-emerging',
  };
}

function joinLabels(labels: readonly string[]): string {
  if (labels.length === 0) return 'a trip mix that feels like you';
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}

/** Uses posterior draws for profile confidence without exposing coefficient values. */
export function buildPreferenceProfile(
  fit: FitSuccess,
  seed: string | number,
  config: Pick<ModelConfig, 'posteriorDrawCount'> = modelConfig,
): PreferenceProfile {
  const draws = drawPosteriorParameters(fit, config.posteriorDrawCount, `${seed}:profile`);
  const summaries = ATTRIBUTE_KEYS.map((key, index) => {
    const values = draws.map((parameters) => parameters[index]!);
    return {
      key,
      expectedContribution: mean(values),
      positiveProbability: values.filter((value) => value > 0).length / values.length,
    };
  });
  return buildPreferenceProfileFromAttributes(summaries);
}

/**
 * Converts already-derived contributions into safe themes. Anything without a
 * strong positive posterior direction is omitted; generic fallbacks maintain
 * the public contract's two-theme minimum without inventing specific evidence.
 */
export function safeExplanationThemes(contributions: readonly AttributePosteriorSummary[]): string[] {
  const themes = contributions
    .filter((contribution) => contribution.expectedContribution > 0
      && contribution.positiveProbability >= POSITIVE_THEME_PROBABILITY)
    .sort((left, right) => right.expectedContribution - left.expectedContribution || left.key.localeCompare(right.key))
    .slice(0, 4)
    .map((contribution) => ATTRIBUTE_COPY[contribution.key].theme);
  for (const fallback of FALLBACK_THEMES) {
    if (themes.length >= 2) break;
    themes.push(fallback);
  }
  return themes;
}

export type DestinationExplanationInput = Readonly<{
  fit: FitSuccess;
  destinationId: string;
  /** Unique or repeated displayed activity IDs; repeated IDs count once. */
  encounteredActivityIds: readonly string[];
  seed: string | number;
  config?: Pick<ModelConfig, 'posteriorDrawCount'>;
}>;

/**
 * Produces only controlled themes and aggregate evidence counts. It never
 * returns raw utility, parameter, activity-title, or comparison-opponent data.
 */
export function buildDestinationExplanation(input: DestinationExplanationInput): SafeDestinationExplanation {
  const { fit, destinationId, seed } = input;
  const destinationActivities = fit.design.activities.filter((activity) => activity.destinationId === destinationId);
  if (destinationActivities.length === 0) throw new ProfileError('invalid-activity', 'Explanation destination is not in the fitted activity portfolio.');
  const encounteredIds = [...new Set(input.encounteredActivityIds)];
  const encounteredActivities = encounteredIds.map((id) => {
    const activity = fit.design.activities[fit.design.activityIndexById.get(id) ?? -1];
    if (!activity) throw new ProfileError('invalid-activity', `Encountered activity ${id} is not in the fitted portfolio.`);
    return activity;
  });
  const observedUtilities = encounteredActivities.map((activity) => utilityFromParameters(fit.design, fit.parameters, activity.id));
  const observedMedian = observedUtilities.length > 0 ? median(observedUtilities) : Number.POSITIVE_INFINITY;
  const destinationEncountered = encounteredActivities.filter((activity) => activity.destinationId === destinationId);
  const matchedActivityCount = destinationEncountered.filter((activity) =>
    utilityFromParameters(fit.design, fit.parameters, activity.id) > observedMedian,
  ).length;

  const config = input.config ?? modelConfig;
  const draws = drawPosteriorParameters(fit, config.posteriorDrawCount, `${seed}:explanation:${destinationId}`);
  const contributions = ATTRIBUTE_KEYS.map((key, index) => {
    const values = draws.map((parameters) => mean(destinationActivities.map((activity) =>
      fit.design.featureByActivityId.get(activity.id)![index]! * parameters[index]!,
    )));
    return {
      key,
      expectedContribution: mean(values),
      positiveProbability: values.filter((value) => value > 0).length / values.length,
    };
  });
  return {
    themes: safeExplanationThemes(contributions),
    matchedActivityCount,
    encounteredActivityCount: destinationEncountered.length,
  };
}
