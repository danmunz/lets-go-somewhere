import type { ResultConfidence } from '@lgs/shared';
import { modelConfig, type ModelConfig } from './config.js';
import { utilityFromParameters } from './features.js';
import type { FitSuccess } from './fit.js';
import { credibleInterval, drawPosteriorParameters } from './posterior.js';
import { createPrng } from './prng.js';

export const GROUP_POLARIZATION_PENALTY = 0.25;

/**
 * These values are deliberately named and exported so OT-19 can evaluate and
 * document them against the fixed synthetic rubric before production routing
 * adopts this model. They are not tuned against a real traveler's choices.
 */
export const confidenceThresholds = {
  topFiveSetStability: 0.8,
  fifthSixthBoundary: 0.85,
  groupRankOne: 0.75,
  groupRunnerUp: 0.85,
} as const;

export const consensusThresholds = {
  broadMaxPolarization: 0.16,
  broadMaxWorstRank: 5,
  polarizedMinPolarization: 0.28,
  polarizedMinWorstRank: 12,
} as const;

export type DestinationDraw = Readonly<Record<string, number>>;
export type DestinationRank = Readonly<{ id: string; score: number; rank: number }>;

export type DestinationPosteriorSummary = Readonly<{
  id: string;
  expectedUtility: number;
  interval: Readonly<{ low: number; high: number }>;
  topFiveMembershipProbability: number;
  rankOneProbability: number;
  /** Probability of beating the posterior-mean sixth-place challenger. */
  rankFiveBoundaryProbability: number;
}>;

export type IndividualDestinationAnalysis = Readonly<{
  draws: readonly DestinationDraw[];
  ranking: readonly DestinationRank[];
  summaries: ReadonlyMap<string, DestinationPosteriorSummary>;
  topFiveIds: readonly string[];
  topThreeIds: readonly string[];
  topFiveSetStability: number;
  fifthSixthBoundaryProbability: number;
  confidenceLabel: 'clear-shape' | 'close-call';
  warnings: readonly string[];
}>;

export type UserFit = Readonly<{ user: string; fit: FitSuccess }>;
export type UserDestinationDraws = Readonly<{ user: string; draws: readonly DestinationDraw[] }>;

export type GroupDestinationPosteriorSummary = DestinationPosteriorSummary & Readonly<{
  expectedPolarization: number;
  consensus: 'broad-consensus' | 'mixed' | 'polarized';
  worstOrdinalRank: number;
}>;

export type GroupDestinationAnalysis = Readonly<{
  draws: readonly DestinationDraw[];
  ranking: readonly DestinationRank[];
  summaries: ReadonlyMap<string, GroupDestinationPosteriorSummary>;
  topFiveIds: readonly string[];
  confidence: ResultConfidence;
  warnings: readonly string[];
  /** Kept backend-only for snapshot construction and consensus derivation. */
  normalizedUserDraws: ReadonlyMap<string, readonly DestinationDraw[]>;
}>;

export class AggregateError extends Error {
  readonly code: 'invalid-draws' | 'invalid-user-input';

  constructor(code: AggregateError['code'], message: string) {
    super(message);
    this.name = 'AggregateError';
    this.code = code;
  }
}

function numericMean(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new AggregateError('invalid-draws', 'Posterior draw values must be a non-empty finite collection.');
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function populationStandardDeviation(values: readonly number[]): number {
  const mean = numericMean(values);
  return Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length);
}

function identicalIds(draws: readonly DestinationDraw[]): string[] {
  if (draws.length === 0) throw new AggregateError('invalid-draws', 'At least one posterior destination draw is required.');
  const ids = Object.keys(draws[0] ?? {}).sort((left, right) => left.localeCompare(right));
  if (ids.length === 0) throw new AggregateError('invalid-draws', 'A destination draw cannot be empty.');
  for (const draw of draws) {
    const drawIds = Object.keys(draw).sort((left, right) => left.localeCompare(right));
    if (drawIds.length !== ids.length || drawIds.some((id, index) => id !== ids[index])) {
      throw new AggregateError('invalid-draws', 'Every posterior draw must contain the same destination IDs.');
    }
    for (const id of ids) {
      if (!Number.isFinite(draw[id])) throw new AggregateError('invalid-draws', `Destination draw for ${id} is not finite.`);
    }
  }
  return ids;
}

/** Stable descending score order; lexical IDs break only exact numerical ties. */
export function rankDestinationDraw(draw: DestinationDraw): DestinationRank[] {
  return Object.entries(draw)
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function beats(leftId: string, rightId: string, draw: DestinationDraw): boolean {
  const left = draw[leftId];
  const right = draw[rightId];
  if (left === undefined || right === undefined) throw new AggregateError('invalid-draws', 'A boundary comparison referenced an unknown destination.');
  // Lexical ordering makes a displayed rank deterministic, but an exact tie is
  // not evidence that the fifth-place boundary or a group leader is stable.
  return left > right;
}

/** Equal-weighted destination portfolio scores for one posterior parameter draw. */
export function destinationUtilitiesForParameters(fit: FitSuccess, parameters: readonly number[]): DestinationDraw {
  if (parameters.length !== fit.parameters.length) {
    throw new AggregateError('invalid-draws', 'Posterior parameter draw does not match the fitted model.');
  }
  const totals = new Map<string, { total: number; count: number }>();
  for (const activity of fit.design.activities) {
    const previous = totals.get(activity.destinationId) ?? { total: 0, count: 0 };
    previous.total += utilityFromParameters(fit.design, parameters, activity.id);
    previous.count += 1;
    totals.set(activity.destinationId, previous);
  }
  return Object.fromEntries(
    [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, portfolio]) => [id, portfolio.total / portfolio.count]),
  );
}

/** Draw posterior parameters without covariance inversion, then average each portfolio. */
export function drawDestinationUtilities(
  fit: FitSuccess,
  seed: string | number,
  config: Pick<ModelConfig, 'posteriorDrawCount' | 'activityResidualPriorSd'> = modelConfig,
): DestinationDraw[] {
  const latentResiduals = createPrng(`${seed}:unseen-activity-residual`);
  const unseenByDestination = new Map<string, string[]>();
  for (const activity of fit.design.activities) {
    if (!fit.design.residualActivityIndexById.has(activity.id)) {
      const items = unseenByDestination.get(activity.destinationId) ?? [];
      items.push(activity.id);
      unseenByDestination.set(activity.destinationId, items);
    }
  }
  const portfolioSizes = new Map(fit.design.destinationIds.map((id) => [id, fit.design.activities.filter((activity) => activity.destinationId === id).length]));
  return drawPosteriorParameters(fit, config.posteriorDrawCount, seed).map((parameters) => {
    const utilities: Record<string, number> = { ...destinationUtilitiesForParameters(fit, parameters) };
    for (const [destinationId, unseenIds] of unseenByDestination) {
      const residual = unseenIds.reduce((sum) => sum + latentResiduals.normal() * config.activityResidualPriorSd, 0);
      utilities[destinationId] = utilities[destinationId]! + residual / portfolioSizes.get(destinationId)!;
    }
    return utilities;
  });
}

export function individualConfidenceLabel(
  topFiveSetStability: number,
  fifthSixthBoundaryProbability: number,
): 'clear-shape' | 'close-call' {
  return topFiveSetStability >= confidenceThresholds.topFiveSetStability
    && fifthSixthBoundaryProbability >= confidenceThresholds.fifthSixthBoundary
    ? 'clear-shape'
    : 'close-call';
}

/** Summarizes a fixed collection of equal-weighted destination posterior draws. */
export function analyzeDestinationDraws(draws: readonly DestinationDraw[]): IndividualDestinationAnalysis {
  const ids = identicalIds(draws);
  const expectedDraw = Object.fromEntries(ids.map((id) => [id, numericMean(draws.map((draw) => draw[id]!))]));
  const ranking = rankDestinationDraw(expectedDraw);
  const topCount = Math.min(5, ids.length);
  const topFiveIds = ranking.slice(0, topCount).map((entry) => entry.id);
  const topThreeIds = ranking.slice(0, Math.min(3, ids.length)).map((entry) => entry.id);
  const topFiveSet = new Set(topFiveIds);
  const challengerId = ranking[5]?.id;
  const boundaryId = ranking[4]?.id;

  const drawRankings = draws.map(rankDestinationDraw);
  const topFiveSetStability = drawRankings.filter((drawRanking) => {
    const idsInDraw = new Set(drawRanking.slice(0, topCount).map((entry) => entry.id));
    return idsInDraw.size === topFiveSet.size && [...idsInDraw].every((id) => topFiveSet.has(id));
  }).length / draws.length;
  const fifthSixthBoundaryProbability = boundaryId && challengerId
    ? draws.filter((draw) => beats(boundaryId, challengerId, draw)).length / draws.length
    : 1;

  const summaries = new Map<string, DestinationPosteriorSummary>();
  for (const id of ids) {
    const values = draws.map((draw) => draw[id]!);
    const interval = credibleInterval(values);
    const ranks = drawRankings.map((drawRanking) => drawRanking.find((entry) => entry.id === id)!.rank);
    summaries.set(id, {
      id,
      expectedUtility: expectedDraw[id]!,
      interval: { low: interval.low, high: interval.high },
      topFiveMembershipProbability: ranks.filter((rank) => rank <= topCount).length / ranks.length,
      rankOneProbability: ranks.filter((rank) => rank === 1).length / ranks.length,
      rankFiveBoundaryProbability: challengerId
        ? draws.filter((draw) => beats(id, challengerId, draw)).length / draws.length
        : 1,
    });
  }

  return {
    draws: [...draws],
    ranking,
    summaries,
    topFiveIds,
    topThreeIds,
    topFiveSetStability,
    fifthSixthBoundaryProbability,
    confidenceLabel: individualConfidenceLabel(topFiveSetStability, fifthSixthBoundaryProbability),
    warnings: [],
  };
}

export function analyzeIndividualDestinationPosterior(
  fit: FitSuccess,
  seed: string | number,
  config: Pick<ModelConfig, 'posteriorDrawCount' | 'activityResidualPriorSd'> = modelConfig,
): IndividualDestinationAnalysis {
  return analyzeDestinationDraws(drawDestinationUtilities(fit, seed, config));
}

function normalizeDestinationDraw(draw: DestinationDraw): { draw: DestinationDraw; zeroRange: boolean } {
  const ids = Object.keys(draw).sort((left, right) => left.localeCompare(right));
  const values = ids.map((id) => draw[id]!);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  if (range <= Number.EPSILON) {
    return { draw: Object.fromEntries(ids.map((id) => [id, 0.5])), zeroRange: true };
  }
  return { draw: Object.fromEntries(ids.map((id) => [id, (draw[id]! - minimum) / range])), zeroRange: false };
}

export function consensusLabel(
  expectedPolarization: number,
  worstOrdinalRank: number,
): 'broad-consensus' | 'mixed' | 'polarized' {
  if (expectedPolarization <= consensusThresholds.broadMaxPolarization
    && worstOrdinalRank <= consensusThresholds.broadMaxWorstRank) return 'broad-consensus';
  if (expectedPolarization >= consensusThresholds.polarizedMinPolarization
    || worstOrdinalRank >= consensusThresholds.polarizedMinWorstRank) return 'polarized';
  return 'mixed';
}

export function groupConfidence(
  rankOneProbability: number,
  runnerUpBeatProbability: number,
): ResultConfidence {
  if (rankOneProbability >= confidenceThresholds.groupRankOne
    && runnerUpBeatProbability >= confidenceThresholds.groupRunnerUp) {
    return { label: 'clear-favorite', summary: 'The crew has a clear front-runner.' };
  }
  return { label: 'close-call', summary: 'The top of the list is a real close call.' };
}

/**
 * Combines deterministic user draw streams. Each draw is normalized per user
 * before aggregation, so a wider individual model scale cannot dominate group
 * results. The only warning is categorical and safe to persist in diagnostics.
 */
export function aggregateGroupDestinationDraws(userDraws: readonly UserDestinationDraws[]): GroupDestinationAnalysis {
  if (userDraws.length === 0 || new Set(userDraws.map((entry) => entry.user)).size !== userDraws.length) {
    throw new AggregateError('invalid-user-input', 'Group aggregation requires uniquely named user draw streams.');
  }
  const count = userDraws[0]?.draws.length ?? 0;
  if (count === 0 || userDraws.some((entry) => entry.draws.length !== count)) {
    throw new AggregateError('invalid-user-input', 'Every group member requires the same positive posterior draw count.');
  }
  const ids = identicalIds(userDraws[0]!.draws);
  for (const entry of userDraws.slice(1)) {
    const memberIds = identicalIds(entry.draws);
    if (memberIds.length !== ids.length || memberIds.some((id, index) => id !== ids[index])) {
      throw new AggregateError('invalid-user-input', 'Every group member must model the same destination portfolio.');
    }
  }

  const warnings = new Set<string>();
  const normalizedUserDraws = new Map<string, DestinationDraw[]>();
  for (const entry of userDraws) {
    const normalized = entry.draws.map((draw) => {
      const result = normalizeDestinationDraw(draw);
      if (result.zeroRange) warnings.add(`zero-range-normalization:${entry.user}`);
      return result.draw;
    });
    normalizedUserDraws.set(entry.user, normalized);
  }

  const polarizations: Record<string, number[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const draws: DestinationDraw[] = Array.from({ length: count }, (_, drawIndex) => {
    const groupDraw: Record<string, number> = {};
    for (const id of ids) {
      const values = userDraws.map((entry) => normalizedUserDraws.get(entry.user)![drawIndex]![id]!);
      const polarization = populationStandardDeviation(values);
      polarizations[id]!.push(polarization);
      groupDraw[id] = numericMean(values) - GROUP_POLARIZATION_PENALTY * polarization;
    }
    return groupDraw;
  });

  const individualRanks = new Map<string, DestinationRank[][]>();
  for (const entry of userDraws) {
    individualRanks.set(entry.user, normalizedUserDraws.get(entry.user)!.map(rankDestinationDraw));
  }
  const base = analyzeDestinationDraws(draws);
  const summaries = new Map<string, GroupDestinationPosteriorSummary>();
  for (const id of ids) {
    const summary = base.summaries.get(id)!;
    const worstOrdinalRank = Math.max(...userDraws.flatMap((entry) => individualRanks.get(entry.user)!
      .map((ranking) => ranking.find((rank) => rank.id === id)!.rank)));
    summaries.set(id, {
      ...summary,
      expectedPolarization: numericMean(polarizations[id]!),
      worstOrdinalRank,
      consensus: consensusLabel(numericMean(polarizations[id]!), worstOrdinalRank),
    });
  }

  const leaderId = base.ranking[0]?.id;
  const runnerUpId = base.ranking[1]?.id;
  const leader = leaderId ? summaries.get(leaderId) : undefined;
  const runnerUpBeatProbability = leaderId && runnerUpId
    ? draws.filter((draw) => beats(leaderId, runnerUpId, draw)).length / draws.length
    : 1;
  return {
    draws,
    ranking: base.ranking,
    summaries,
    topFiveIds: base.topFiveIds,
    confidence: groupConfidence(leader?.rankOneProbability ?? 1, runnerUpBeatProbability),
    warnings: [...warnings].sort((left, right) => left.localeCompare(right)),
    normalizedUserDraws,
  };
}

/**
 * User sub-seeds are intentionally independent. A group draw never shares a
 * random stream across travelers, even when their MAP fits happen to match.
 */
export function analyzeGroupDestinationPosterior(
  users: readonly UserFit[],
  snapshotSeed: string | number,
  config: Pick<ModelConfig, 'posteriorDrawCount' | 'activityResidualPriorSd'> = modelConfig,
): GroupDestinationAnalysis {
  if (users.length === 0 || new Set(users.map((entry) => entry.user)).size !== users.length) {
    throw new AggregateError('invalid-user-input', 'Group posterior analysis requires uniquely named fits.');
  }
  return aggregateGroupDestinationDraws(users.map(({ user, fit }) => ({
    user,
    draws: drawDestinationUtilities(fit, `${snapshotSeed}:${user}`, config),
  })));
}

export function personalFitLabel(
  summary: DestinationPosteriorSummary,
  rank: number,
): 'strong-match' | 'contender' | 'close-call' {
  if (rank === 1 && summary.rankOneProbability >= 0.5
    && summary.topFiveMembershipProbability >= confidenceThresholds.topFiveSetStability) return 'strong-match';
  if (summary.topFiveMembershipProbability >= confidenceThresholds.topFiveSetStability
    && summary.rankFiveBoundaryProbability >= confidenceThresholds.fifthSixthBoundary) return 'contender';
  return 'close-call';
}
