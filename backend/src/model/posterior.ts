import { modelConfig, type ModelConfig } from './config.js';
import type { FitSuccess } from './fit.js';
import { createPrng } from './prng.js';
import { createVector, dot, solveCholesky, solveUpperFromLower, type Vector } from './linear-algebra.js';

export class PosteriorError extends Error {
  readonly code: 'invalid-draw-count' | 'invalid-interval' | 'covariance-failure';

  constructor(code: PosteriorError['code'], message: string) {
    super(message);
    this.name = 'PosteriorError';
    this.code = code;
  }
}

/** Returns Σv using the posterior precision factor H = L Lᵀ. */
export function solvePosteriorCovariance(fit: FitSuccess, vector: Vector): number[] {
  if (vector.length !== fit.parameters.length) {
    throw new PosteriorError('covariance-failure', 'Covariance vector does not match fitted parameters.');
  }
  try {
    return solveCholesky(fit.precisionCholesky, vector);
  } catch (error) {
    throw new PosteriorError('covariance-failure', error instanceof Error ? error.message : 'Posterior covariance solve failed.');
  }
}

export function posteriorVariance(fit: FitSuccess, direction: Vector): number {
  const value = dot(direction, solvePosteriorCovariance(fit, direction));
  if (!(value >= 0) || !Number.isFinite(value)) throw new PosteriorError('covariance-failure', 'Posterior variance is invalid.');
  return value;
}

/**
 * Draws θ ~ N(θ̂, H⁻¹) without explicitly materializing H⁻¹. For H = LLᵀ,
 * L⁻ᵀz has covariance H⁻¹.
 */
export function drawPosteriorParameters(fit: FitSuccess, count: number, seed: string | number): number[][] {
  if (!Number.isInteger(count) || count < 1) throw new PosteriorError('invalid-draw-count', 'Posterior draw count must be a positive integer.');
  const random = createPrng(seed);
  try {
    return Array.from({ length: count }, () => {
      const standardNormal = Array.from({ length: fit.parameters.length }, () => random.normal());
      const noise = solveUpperFromLower(fit.precisionCholesky, standardNormal);
      return fit.parameters.map((value, index) => value + noise[index]!);
    });
  } catch (error) {
    throw new PosteriorError('covariance-failure', error instanceof Error ? error.message : 'Posterior draw failed.');
  }
}

export type CredibleInterval = Readonly<{ low: number; high: number; median: number }>;

function quantile(sortedValues: readonly number[], probability: number): number {
  if (sortedValues.length === 0) throw new PosteriorError('invalid-interval', 'Cannot summarize zero values.');
  const index = (sortedValues.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sortedValues[low]!;
  return sortedValues[low]! + (sortedValues[high]! - sortedValues[low]!) * (index - low);
}

export function credibleInterval(values: readonly number[], mass: number = modelConfig.credibleInterval): CredibleInterval {
  if (!(mass > 0 && mass < 1)) throw new PosteriorError('invalid-interval', 'Credible interval mass must lie between zero and one.');
  if (values.some((value) => !Number.isFinite(value))) throw new PosteriorError('invalid-interval', 'Credible interval values must be finite.');
  const ordered = [...values].sort((left, right) => left - right);
  const tail = (1 - mass) / 2;
  return { low: quantile(ordered, tail), high: quantile(ordered, 1 - tail), median: quantile(ordered, 0.5) };
}

export function posteriorMean(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new PosteriorError('invalid-interval', 'Posterior mean requires finite values.');
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** A compact deterministic helper for downstream selection/aggregation modules. */
export function createPosteriorAnalysis(
  fit: FitSuccess,
  seed: string | number,
  config: Pick<ModelConfig, 'posteriorDrawCount' | 'credibleInterval'> = modelConfig,
) {
  const draws = drawPosteriorParameters(fit, config.posteriorDrawCount, seed);
  return {
    seed: createPrng(seed).seed,
    draws,
    summarize: (direction: Vector): Readonly<{ mean: number; interval: CredibleInterval }> => {
      const values = draws.map((parameters) => dot(direction, parameters));
      return { mean: posteriorMean(values), interval: credibleInterval(values, config.credibleInterval) };
    },
  };
}

/** Convenience for testing covariance diagonals without leaking a matrix publicly. */
export function posteriorStandardDeviation(fit: FitSuccess, parameterIndex: number): number {
  if (!Number.isInteger(parameterIndex) || parameterIndex < 0 || parameterIndex >= fit.parameters.length) {
    throw new PosteriorError('covariance-failure', 'Parameter index is outside the posterior.');
  }
  const direction = createVector(fit.parameters.length);
  direction[parameterIndex] = 1;
  return Math.sqrt(posteriorVariance(fit, direction));
}
