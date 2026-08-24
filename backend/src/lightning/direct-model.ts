/**
 * Direct-destination preference model for the optional Lightning Round.
 *
 * This module is intentionally independent from the activity-attribute model
 * used by the original round.  A parameter here means only a destination's
 * latent appeal within this one direct-comparison exercise; it is never mixed
 * with the original model's activity or portfolio scores.
 */
import {
  addDiagonal,
  addScaledOuterProduct,
  cholesky,
  createMatrix,
  createVector,
  dot,
  maxAbsolute,
  solveCholesky,
  solveUpperFromLower,
  type Matrix,
} from '../model/linear-algebra.js';
import { createPrng } from '../model/prng.js';

export const LIGHTNING_MODEL_VERSION = 'bayes-direct-destination-v1';
export const LIGHTNING_CORE_COMPARISONS = 48;
export const LIGHTNING_MAX_COMPARISONS = 60;
export const LIGHTNING_BALANCED_COMPARISONS = 36;
/** Fixed deterministic joint posterior sample count for result evidence. */
export const LIGHTNING_EVIDENCE_DRAW_COUNT = 4096;
/** Adjacent MAP items need this much support to form a visible break. */
export const LIGHTNING_CLEAR_BREAK_PROBABILITY = 0.75;

export type DirectDestination = Readonly<{ id: string }>;

export type DirectComparison = Readonly<{
  destinationA: string;
  destinationB: string;
  winner: string;
}>;

export type DirectPair = readonly [DirectDestination, DirectDestination];

export type DirectModelConfig = Readonly<{
  priorSd: number;
  covarianceJitter: number;
  maxNewtonIterations: number;
  convergenceTolerance: number;
  posteriorDrawCount: number;
  /** Adjacent destinations below this probability are deliberately shown as a tier. */
  tierSeparationProbability: number;
}>;

export const directModelConfig: DirectModelConfig = Object.freeze({
  priorSd: 1.5,
  covarianceJitter: 1e-9,
  maxNewtonIterations: 48,
  convergenceTolerance: 1e-8,
  posteriorDrawCount: 1024,
  tierSeparationProbability: 0.85,
});

export type DirectFitSuccess = Readonly<{
  ok: true;
  destinationIds: readonly string[];
  parameters: readonly number[];
  precision: Matrix;
  precisionCholesky: Matrix;
  comparisonCount: number;
}>;

export type DirectFitFailure = Readonly<{
  ok: false;
  code: 'invalid-input' | 'non-convergence' | 'covariance-failure';
  message: string;
}>;

export type DirectFit = DirectFitSuccess | DirectFitFailure;

export type LightningTier = Readonly<{
  /** 1-indexed displayed rank range, inclusive. */
  startRank: number;
  endRank: number;
  destinationIds: readonly string[];
}>;

export type LightningRanking = Readonly<{
  destinationIds: readonly string[];
  tiers: readonly LightningTier[];
}>;

export type LightningBordaRow = Readonly<{
  destinationId: string;
  points: number;
  firstPlaceVotes: number;
  topFiveSupport: number;
  startRank: number;
  endRank: number;
}>;

export type LightningRankRange = Readonly<{ low: number; high: number }>;
export type LightningWorkingOrderEvidence = Readonly<{
  destinationId: string;
  workingRank: number;
  topFivePercent: number;
  rankRange: LightningRankRange;
}>;
export type LightningWorkingOrder = Readonly<{
  workingOrder: readonly string[];
  clearBreaksAfter: readonly number[];
  topFiveGroups: Readonly<{ likelyTopFive: readonly string[]; possibleTopFive: readonly string[]; unlikelyTopFive: readonly string[] }>;
  privateEvidence: readonly LightningWorkingOrderEvidence[];
}>;

function logistic(value: number): number {
  if (value >= 0) {
    const exponent = Math.exp(-value);
    return 1 / (1 + exponent);
  }
  const exponent = Math.exp(value);
  return exponent / (1 + exponent);
}

function logSigmoid(value: number): number {
  return value >= 0 ? -Math.log1p(Math.exp(-value)) : value - Math.log1p(Math.exp(value));
}

function objective(rows: readonly PreparedComparison[], parameters: readonly number[], priorPrecision: number): number {
  let value = 0;
  for (const row of rows) {
    const eta = parameters[row.a]! - parameters[row.b]!;
    value += row.winnerIsA ? logSigmoid(eta) : logSigmoid(-eta);
  }
  for (const parameter of parameters) value -= 0.5 * priorPrecision * parameter ** 2;
  return value;
}

function validConfig(config: DirectModelConfig): boolean {
  return Number.isFinite(config.priorSd) && config.priorSd > 0
    && Number.isFinite(config.covarianceJitter) && config.covarianceJitter > 0
    && Number.isInteger(config.maxNewtonIterations) && config.maxNewtonIterations > 0
    && Number.isFinite(config.convergenceTolerance) && config.convergenceTolerance > 0
    && Number.isInteger(config.posteriorDrawCount) && config.posteriorDrawCount > 0
    && config.tierSeparationProbability > 0.5 && config.tierSeparationProbability < 1;
}

type PreparedComparison = Readonly<{ a: number; b: number; winnerIsA: boolean }>;

function normalizeDestinations(destinations: readonly DirectDestination[]): readonly string[] {
  const ids = destinations.map((destination) => destination.id).sort((left, right) => left.localeCompare(right));
  if (ids.length < 2 || ids.some((id) => id.trim().length === 0) || new Set(ids).size !== ids.length) {
    throw new Error('Lightning destinations must contain at least two unique, non-empty IDs.');
  }
  return ids;
}

function prepareComparisons(ids: readonly string[], comparisons: readonly DirectComparison[]): PreparedComparison[] {
  const index = new Map(ids.map((id, position) => [id, position]));
  const pairs = new Set<string>();
  return comparisons.map((comparison, ordinal) => {
    const a = index.get(comparison.destinationA);
    const b = index.get(comparison.destinationB);
    if (a === undefined || b === undefined || a === b) throw new Error(`Lightning comparison ${ordinal + 1} has an invalid destination pair.`);
    if (comparison.winner !== comparison.destinationA && comparison.winner !== comparison.destinationB) {
      throw new Error(`Lightning comparison ${ordinal + 1} winner must be one of its destinations.`);
    }
    const key = pairKey(comparison.destinationA, comparison.destinationB);
    if (pairs.has(key)) throw new Error(`Lightning comparison ${ordinal + 1} repeats a destination pair.`);
    pairs.add(key);
    return { a, b, winnerIsA: comparison.winner === comparison.destinationA };
  });
}

function gradientAndPrecision(rows: readonly PreparedComparison[], parameters: readonly number[], priorPrecision: number) {
  const gradient = createVector(parameters.length);
  const precision = createMatrix(parameters.length);
  for (let index = 0; index < parameters.length; index += 1) {
    gradient[index] = -priorPrecision * parameters[index]!;
    precision[index]![index] = priorPrecision;
  }
  for (const row of rows) {
    const probability = logistic(parameters[row.a]! - parameters[row.b]!);
    const target = row.winnerIsA ? 1 : 0;
    const residual = target - probability;
    gradient[row.a]! += residual;
    gradient[row.b]! -= residual;
    const direction = createVector(parameters.length);
    direction[row.a] = 1;
    direction[row.b] = -1;
    addScaledOuterProduct(precision, direction, probability * (1 - probability));
  }
  return { gradient, precision };
}

function factorPrecision(precision: Matrix, jitter: number): { precision: Matrix; lower: Matrix } | undefined {
  try {
    return { precision, lower: cholesky(precision) };
  } catch {
    try {
      const adjusted = addDiagonal(precision, jitter);
      return { precision: adjusted, lower: cholesky(adjusted) };
    } catch {
      return undefined;
    }
  }
}

/** Fits a regularized item-level Bayesian Bradley–Terry MAP estimate. */
export function fitDirectDestinationBradleyTerry(
  destinations: readonly DirectDestination[],
  comparisons: readonly DirectComparison[],
  config: DirectModelConfig = directModelConfig,
): DirectFit {
  if (!validConfig(config)) return { ok: false, code: 'invalid-input', message: 'Lightning model configuration is invalid.' };
  let ids: readonly string[];
  let rows: PreparedComparison[];
  try {
    ids = normalizeDestinations(destinations);
    rows = prepareComparisons(ids, comparisons);
  } catch (error) {
    return { ok: false, code: 'invalid-input', message: error instanceof Error ? error.message : 'Lightning model input is invalid.' };
  }
  const priorPrecision = 1 / config.priorSd ** 2;
  let parameters = createVector(ids.length);
  let previousObjective = objective(rows, parameters, priorPrecision);

  for (let iteration = 0; iteration < config.maxNewtonIterations; iteration += 1) {
    const state = gradientAndPrecision(rows, parameters, priorPrecision);
    const factor = factorPrecision(state.precision, config.covarianceJitter);
    if (!factor) return { ok: false, code: 'covariance-failure', message: 'Lightning posterior precision could not be factored.' };
    let delta: number[];
    try {
      delta = solveCholesky(factor.lower, state.gradient);
    } catch {
      return { ok: false, code: 'covariance-failure', message: 'Lightning posterior precision could not be solved.' };
    }
    let step = 1;
    let candidate = parameters.map((value, index) => value + delta[index]!);
    let candidateObjective = objective(rows, candidate, priorPrecision);
    const tolerance = 64 * Number.EPSILON * Math.max(1, Math.abs(previousObjective));
    while (candidateObjective < previousObjective - tolerance && step > 1 / 128) {
      step /= 2;
      candidate = parameters.map((value, index) => value + step * delta[index]!);
      candidateObjective = objective(rows, candidate, priorPrecision);
    }
    if (!Number.isFinite(candidateObjective) || candidateObjective < previousObjective - tolerance) {
      return { ok: false, code: 'non-convergence', message: 'Lightning model could not find a stable ascent step.' };
    }
    parameters = candidate;
    previousObjective = candidateObjective;
    if (maxAbsolute(delta) * step < config.convergenceTolerance) {
      const finalState = gradientAndPrecision(rows, parameters, priorPrecision);
      const finalFactor = factorPrecision(finalState.precision, config.covarianceJitter);
      if (!finalFactor) return { ok: false, code: 'covariance-failure', message: 'Lightning final posterior could not be factored.' };
      return { ok: true, destinationIds: ids, parameters, precision: finalFactor.precision, precisionCholesky: finalFactor.lower, comparisonCount: comparisons.length };
    }
  }
  return { ok: false, code: 'non-convergence', message: 'Lightning model did not converge within its fixed iteration limit.' };
}

export function pairKey(left: string, right: string): string {
  return left.localeCompare(right) <= 0 ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function pairWasAsked(comparisons: readonly DirectComparison[], left: string, right: string): boolean {
  const key = pairKey(left, right);
  return comparisons.some((comparison) => pairKey(comparison.destinationA, comparison.destinationB) === key);
}

function appearanceCounts(ids: readonly string[], comparisons: readonly DirectComparison[]): Map<string, number> {
  const counts = new Map(ids.map((id) => [id, 0]));
  for (const comparison of comparisons) {
    counts.set(comparison.destinationA, (counts.get(comparison.destinationA) ?? 0) + 1);
    counts.set(comparison.destinationB, (counts.get(comparison.destinationB) ?? 0) + 1);
  }
  return counts;
}

/** First three circle-method rounds: exactly three appearances per destination and no repeated pair. */
export function initialLightningSchedule(destinations: readonly DirectDestination[]): readonly (readonly [string, string])[] {
  const ids = normalizeDestinations(destinations);
  if (ids.length % 2 !== 0) throw new Error('Lightning balanced scheduling requires an even destination count.');
  const schedule: Array<readonly [string, string]> = [];
  let ring = [...ids];
  for (let round = 0; round < 3; round += 1) {
    for (let index = 0; index < ring.length / 2; index += 1) schedule.push([ring[index]!, ring[ring.length - 1 - index]!]);
    // Circle method: the first entry remains fixed while all other entries rotate.
    ring = [ring[0]!, ring[ring.length - 1]!, ...ring.slice(1, -1)];
  }
  return schedule;
}

function predictiveEntropy(fit: DirectFitSuccess | undefined, left: string, right: string): number {
  if (!fit) return 1;
  const leftIndex = fit.destinationIds.indexOf(left);
  const rightIndex = fit.destinationIds.indexOf(right);
  if (leftIndex < 0 || rightIndex < 0) return 0;
  const probability = logistic(fit.parameters[leftIndex]! - fit.parameters[rightIndex]!);
  return probability * (1 - probability);
}

function deterministicJitter(seed: string, left: string, right: string): number {
  return createPrng(`${seed}:${pairKey(left, right)}`).next() * 1e-6;
}

/**
 * Finds a no-repeat perfect matching for the one-extra-appearance core block.
 * The input is tiny (at most 24 IDs) and the first complete matching is enough;
 * ordering candidates by predictive entropy keeps it useful without allowing a
 * greedy early pair to strand the last two destinations on an already-asked
 * edge.
 */
function balancedFourthPair(
  needingFourth: readonly string[],
  comparisons: readonly DirectComparison[],
  fit: DirectFitSuccess | undefined,
  seed: string,
): readonly [string, string] | undefined {
  const choose = (remaining: readonly string[]): Array<readonly [string, string]> | undefined => {
    if (remaining.length === 0) return [];
    const anchor = [...remaining].sort((left, right) => left.localeCompare(right))[0]!;
    const opponents = remaining.slice(1)
      .filter((id) => !pairWasAsked(comparisons, anchor, id))
      .sort((left, right) => {
        const scoreDelta = predictiveEntropy(fit, right, anchor) - predictiveEntropy(fit, left, anchor);
        return scoreDelta || deterministicJitter(seed, anchor, left) - deterministicJitter(seed, anchor, right) || left.localeCompare(right);
      });
    for (const opponent of opponents) {
      const next = choose(remaining.filter((id) => id !== anchor && id !== opponent));
      if (next) return [[anchor, opponent], ...next];
    }
    return undefined;
  };
  return choose(needingFourth)?.[0];
}

/**
 * Direct comparisons 1–36 use the fixed fair schedule.  Comparisons 37–48
 * make one additional appearance for each destination, choosing the most
 * informative compatible opponent.  Later questions resolve adjacent tiers.
 */
export function selectNextLightningPair(
  destinations: readonly DirectDestination[],
  comparisons: readonly DirectComparison[],
  seed: string | number,
  config: DirectModelConfig = directModelConfig,
): DirectPair | undefined {
  const ids = normalizeDestinations(destinations);
  if (comparisons.length >= LIGHTNING_MAX_COMPARISONS) return undefined;
  const byId = new Map(destinations.map((destination) => [destination.id, destination]));

  if (comparisons.length < LIGHTNING_BALANCED_COMPARISONS) {
    const scheduled = initialLightningSchedule(destinations);
    const next = scheduled.find(([left, right]) => !pairWasAsked(comparisons, left, right));
    return next ? [byId.get(next[0])!, byId.get(next[1])!] : undefined;
  }

  const fit = fitDirectDestinationBradleyTerry(destinations, comparisons, config);
  const safeFit = fit.ok ? fit : undefined;
  if (comparisons.length < LIGHTNING_CORE_COMPARISONS) {
    const counts = appearanceCounts(ids, comparisons);
    const needingFourth = ids.filter((id) => (counts.get(id) ?? 0) < 4);
    if (needingFourth.length < 2) return undefined;
    const next = balancedFourthPair(needingFourth, comparisons, safeFit, String(seed));
    if (next) return [byId.get(next[0])!, byId.get(next[1])!];
    // This only occurs with malformed persisted history. Continue safely with
    // an unused pair rather than silently repeating an answer.
  }

  if (!safeFit || !hasUnresolvedLightningBoundaries(safeFit, seed, config)) return undefined;
  const ranking = rankedDirectDestinationIds(safeFit);
  const counts = appearanceCounts(ids, comparisons);
  const candidates: Array<{ left: string; right: string; score: number }> = [];
  for (let index = 0; index < ranking.length - 1; index += 1) {
    const left = ranking[index]!;
    const right = ranking[index + 1]!;
    if (!pairWasAsked(comparisons, left, right)) {
      const p = posteriorBeatsProbability(safeFit, left, right, `${seed}:boundary:${index}`, config);
      candidates.push({ left, right, score: p * (1 - p) + 0.01 / (1 + (counts.get(left) ?? 0) + (counts.get(right) ?? 0)) });
    }
  }
  if (candidates.length === 0) {
    for (let leftIndex = 0; leftIndex < ranking.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ranking.length; rightIndex += 1) {
        const left = ranking[leftIndex]!;
        const right = ranking[rightIndex]!;
        if (pairWasAsked(comparisons, left, right)) continue;
        const distancePenalty = 1 / (1 + rightIndex - leftIndex);
        candidates.push({ left, right, score: predictiveEntropy(safeFit, left, right) * distancePenalty });
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.left.localeCompare(right.left) || left.right.localeCompare(right.right));
  const next = candidates[0];
  return next ? [byId.get(next.left)!, byId.get(next.right)!] : undefined;
}

export function posteriorDraws(fit: DirectFitSuccess, count: number, seed: string | number): readonly (readonly number[])[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('Lightning posterior draw count must be a positive integer.');
  const random = createPrng(seed);
  return Array.from({ length: count }, () => {
    const standardNormal = fit.parameters.map(() => random.normal());
    const noise = solveUpperFromLower(fit.precisionCholesky, standardNormal);
    return fit.parameters.map((value, index) => value + noise[index]!);
  });
}

export function rankedDirectDestinationIds(fit: DirectFitSuccess): readonly string[] {
  return fit.destinationIds
    .map((id, index) => ({ id, score: fit.parameters[index]! }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .map(({ id }) => id);
}

export function posteriorBeatsProbability(
  fit: DirectFitSuccess,
  higher: string,
  lower: string,
  seed: string | number,
  config: Pick<DirectModelConfig, 'posteriorDrawCount'> = directModelConfig,
): number {
  const higherIndex = fit.destinationIds.indexOf(higher);
  const lowerIndex = fit.destinationIds.indexOf(lower);
  if (higherIndex < 0 || lowerIndex < 0 || higherIndex === lowerIndex) throw new Error('Lightning posterior comparison requires two known destinations.');
  const draws = posteriorDraws(fit, config.posteriorDrawCount, seed);
  return draws.filter((draw) => draw[higherIndex]! > draw[lowerIndex]!).length / draws.length;
}

export function hasUnresolvedLightningBoundaries(
  fit: DirectFitSuccess,
  seed: string | number,
  config: Pick<DirectModelConfig, 'posteriorDrawCount' | 'tierSeparationProbability'> = directModelConfig,
): boolean {
  const ranking = rankedDirectDestinationIds(fit);
  return ranking.slice(0, -1).some((id, index) => posteriorBeatsProbability(fit, id, ranking[index + 1]!, `${seed}:tier:${index}`, config) < config.tierSeparationProbability);
}

/** Returns honest adjacent tiers: uncertain boundaries remain visibly shared. */
export function buildLightningRanking(
  fit: DirectFitSuccess,
  seed: string | number,
  config: Pick<DirectModelConfig, 'posteriorDrawCount' | 'tierSeparationProbability'> = directModelConfig,
): LightningRanking {
  const ids = rankedDirectDestinationIds(fit);
  const tiers: LightningTier[] = [];
  let tierStart = 0;
  for (let index = 0; index < ids.length - 1; index += 1) {
    const probability = posteriorBeatsProbability(fit, ids[index]!, ids[index + 1]!, `${seed}:rank:${index}`, config);
    if (probability >= config.tierSeparationProbability) {
      tiers.push({ startRank: tierStart + 1, endRank: index + 1, destinationIds: ids.slice(tierStart, index + 1) });
      tierStart = index + 1;
    }
  }
  tiers.push({ startRank: tierStart + 1, endRank: ids.length, destinationIds: ids.slice(tierStart) });
  return { destinationIds: ids, tiers };
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) throw new Error('Lightning evidence requires posterior samples.');
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index]!;
}

/**
 * Produces an exact, deterministic working order plus modest evidence markers.
 * It is result-only: saved comparisons remain the sole input and this output
 * never feeds into direct-question selection.
 */
export function buildLightningWorkingOrder(
  fit: DirectFitSuccess,
  seed: string | number,
  drawCount = LIGHTNING_EVIDENCE_DRAW_COUNT,
): LightningWorkingOrder {
  if (!Number.isInteger(drawCount) || drawCount < 1) throw new Error('Lightning evidence draw count must be a positive integer.');
  const workingOrder = rankedDirectDestinationIds(fit);
  const indexById = new Map(fit.destinationIds.map((id, index) => [id, index]));
  const sampleRanks = new Map(workingOrder.map((id) => [id, [] as number[]]));
  const topFiveCounts = new Map(workingOrder.map((id) => [id, 0]));
  const adjacentWins = Array.from({ length: workingOrder.length - 1 }, () => 0);
  const draws = posteriorDraws(fit, drawCount, `${seed}:working-order-v2`);

  for (const draw of draws) {
    const ordered = fit.destinationIds
      .map((id, index) => ({ id, score: draw[index]! }))
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
    const rankById = new Map(ordered.map(({ id }, index) => [id, index + 1]));
    for (const id of workingOrder) {
      const rank = rankById.get(id)!;
      sampleRanks.get(id)!.push(rank);
      if (rank <= 5) topFiveCounts.set(id, topFiveCounts.get(id)! + 1);
    }
    for (let index = 0; index < workingOrder.length - 1; index += 1) {
      const higher = indexById.get(workingOrder[index]!)!;
      const lower = indexById.get(workingOrder[index + 1]!)!;
      if (draw[higher]! > draw[lower]!) adjacentWins[index]! += 1;
    }
  }

  const privateEvidence = workingOrder.map((destinationId, index) => {
    const ranks = sampleRanks.get(destinationId)!.sort((left, right) => left - right);
    const topFivePercent = Math.round((topFiveCounts.get(destinationId)! / draws.length) * 100);
    return {
      destinationId,
      workingRank: index + 1,
      topFivePercent,
      rankRange: { low: percentile(ranks, 0.10), high: percentile(ranks, 0.90) },
    };
  });
  const clearBreaksAfter = adjacentWins
    .map((wins, index) => ({ rank: index + 1, probability: wins / draws.length }))
    .filter(({ probability }) => probability >= LIGHTNING_CLEAR_BREAK_PROBABILITY)
    .map(({ rank }) => rank);
  const likelyTopFive = privateEvidence.filter(({ topFivePercent }) => topFivePercent >= 50).map(({ destinationId }) => destinationId);
  const possibleTopFive = privateEvidence.filter(({ topFivePercent }) => topFivePercent >= 15 && topFivePercent < 50).map(({ destinationId }) => destinationId);
  const unlikelyTopFive = privateEvidence.filter(({ topFivePercent }) => topFivePercent < 15).map(({ destinationId }) => destinationId);
  return { workingOrder, clearBreaksAfter, topFiveGroups: { likelyTopFive, possibleTopFive, unlikelyTopFive }, privateEvidence };
}

export function shouldCompleteLightningRound(
  destinations: readonly DirectDestination[],
  comparisons: readonly DirectComparison[],
  seed: string | number,
  config: DirectModelConfig = directModelConfig,
): boolean {
  if (comparisons.length < LIGHTNING_CORE_COMPARISONS) return false;
  if (comparisons.length >= LIGHTNING_MAX_COMPARISONS) return true;
  const fit = fitDirectDestinationBradleyTerry(destinations, comparisons, config);
  return !fit.ok || !hasUnresolvedLightningBoundaries(fit, seed, config);
}

/**
 * Transparent 24..1 Borda tally.  A shared tier gets the arithmetic mean of
 * the positional values it spans (for example, a shared 2nd/3rd receives
 * (23 + 22) / 2). Ties then resolve by first-place votes and top-five support.
 */
export function tallyLightningBorda(
  destinationIds: readonly string[],
  rankings: readonly LightningRanking[],
): readonly LightningBordaRow[] {
  const ids = [...destinationIds].sort((left, right) => left.localeCompare(right));
  if (ids.length !== 24 || new Set(ids).size !== ids.length) throw new Error('Lightning Borda tally requires exactly 24 unique destinations.');
  const totals = new Map(ids.map((id) => [id, { points: 0, firstPlaceVotes: 0, topFiveSupport: 0 }]));
  for (const ranking of rankings) {
    const seen = new Set<string>();
    for (const tier of ranking.tiers) {
      if (tier.startRank < 1 || tier.endRank < tier.startRank || tier.destinationIds.length !== tier.endRank - tier.startRank + 1) throw new Error('Lightning ranking tier is malformed.');
      const points = Array.from({ length: tier.destinationIds.length }, (_, index) => 25 - (tier.startRank + index))
        .reduce((total, value) => total + value, 0) / tier.destinationIds.length;
      for (const id of tier.destinationIds) {
        if (!totals.has(id) || seen.has(id)) throw new Error('Lightning ranking must contain every destination exactly once.');
        seen.add(id);
        const row = totals.get(id)!;
        row.points += points;
        if (tier.startRank === 1) row.firstPlaceVotes += 1 / tier.destinationIds.length;
        if (tier.startRank <= 5) row.topFiveSupport += 1;
      }
    }
    if (seen.size !== ids.length) throw new Error('Lightning ranking must include all 24 destinations.');
  }
  const ordered = ids.map((id) => ({ destinationId: id, ...totals.get(id)! }))
    .sort((left, right) => right.points - left.points || right.firstPlaceVotes - left.firstPlaceVotes || right.topFiveSupport - left.topFiveSupport || left.destinationId.localeCompare(right.destinationId));
  const rows: LightningBordaRow[] = [];
  let index = 0;
  while (index < ordered.length) {
    let end = index;
    while (end + 1 < ordered.length
      && ordered[end]!.points === ordered[end + 1]!.points
      && ordered[end]!.firstPlaceVotes === ordered[end + 1]!.firstPlaceVotes
      && ordered[end]!.topFiveSupport === ordered[end + 1]!.topFiveSupport) end += 1;
    for (let position = index; position <= end; position += 1) {
      const row = ordered[position]!;
      rows.push({ ...row, startRank: index + 1, endRank: end + 1 });
    }
    index = end + 1;
  }
  return rows;
}

/** Transparent exact-order 24..1 Borda tally for the v2 working order. */
export function tallyLightningWorkingOrderBorda(
  destinationIds: readonly string[],
  workingOrders: readonly (readonly string[])[],
): readonly LightningBordaRow[] {
  const ids = [...destinationIds].sort((left, right) => left.localeCompare(right));
  if (ids.length !== 24 || new Set(ids).size !== ids.length) throw new Error('Lightning Borda tally requires exactly 24 unique destinations.');
  const totals = new Map(ids.map((id) => [id, { points: 0, firstPlaceVotes: 0, topFiveSupport: 0 }]));
  for (const order of workingOrders) {
    if (order.length !== ids.length || new Set(order).size !== ids.length || order.some((id) => !totals.has(id))) throw new Error('Lightning working order must contain every destination exactly once.');
    for (const [index, id] of order.entries()) {
      const row = totals.get(id)!;
      row.points += 24 - index;
      if (index === 0) row.firstPlaceVotes += 1;
      if (index < 5) row.topFiveSupport += 1;
    }
  }
  const ordered = ids.map((id) => ({ destinationId: id, ...totals.get(id)! }))
    .sort((left, right) => right.points - left.points || right.firstPlaceVotes - left.firstPlaceVotes || right.topFiveSupport - left.topFiveSupport || left.destinationId.localeCompare(right.destinationId));
  const rows: LightningBordaRow[] = [];
  let index = 0;
  while (index < ordered.length) {
    let end = index;
    while (end + 1 < ordered.length
      && ordered[end]!.points === ordered[end + 1]!.points
      && ordered[end]!.firstPlaceVotes === ordered[end + 1]!.firstPlaceVotes
      && ordered[end]!.topFiveSupport === ordered[end + 1]!.topFiveSupport) end += 1;
    for (let position = index; position <= end; position += 1) rows.push({ ...ordered[position]!, startRank: index + 1, endRank: end + 1 });
    index = end + 1;
  }
  return rows;
}
