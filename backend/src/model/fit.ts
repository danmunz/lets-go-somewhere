import type { Activity, Comparison } from '@lgs/shared';
import { ATTRIBUTE_KEYS } from '@lgs/shared';
import { modelConfig, type ModelConfig } from './config.js';
import { createDesignMatrix, prepareComparisons, type DesignMatrix, type PreparedComparison } from './features.js';
import {
  addDiagonal,
  addScaledOuterProduct,
  cholesky,
  createMatrix,
  createVector,
  dot,
  LinearAlgebraError,
  maxAbsolute,
  solveCholesky,
  type Matrix,
  type Vector,
} from './linear-algebra.js';

export type FitFailureCode = 'invalid-input' | 'non-convergence' | 'covariance-failure';
export type FitFailure = Readonly<{
  ok: false;
  code: FitFailureCode;
  message: string;
  diagnostics: Readonly<{ iterations: number; lastUpdate: number; logPosterior: number }>;
}>;

export type FitSuccess = Readonly<{
  ok: true;
  design: DesignMatrix;
  parameters: readonly number[];
  precision: Matrix;
  precisionCholesky: Matrix;
  diagnostics: Readonly<{
    converged: true;
    iterations: number;
    lastUpdate: number;
    logPosterior: number;
    usedDiagonalJitter: boolean;
    comparisonCount: number;
  }>;
}>;

export type MapFit = FitSuccess | FitFailure;

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

export function priorPrecisions(design: DesignMatrix, config: ModelConfig = modelConfig): number[] {
  return [
    ...Array.from({ length: ATTRIBUTE_KEYS.length }, () => 1 / config.betaPriorSd ** 2),
    ...Array.from({ length: design.destinationIds.length }, () => 1 / config.destinationPriorSd ** 2),
    ...Array.from({ length: design.residualActivityIds.length }, () => 1 / config.activityResidualPriorSd ** 2),
  ];
}

function objective(prepared: readonly PreparedComparison[], parameters: Vector, priors: Vector): number {
  let total = 0;
  for (const comparison of prepared) {
    const eta = dot(comparison.row, parameters);
    total += comparison.target === 1 ? logSigmoid(eta) : logSigmoid(-eta);
  }
  for (let index = 0; index < parameters.length; index += 1) total -= 0.5 * priors[index]! * parameters[index]! ** 2;
  return total;
}

/**
 * Double-precision objective values are the sum of a sparse likelihood and a
 * quadratic prior. Near the MAP, two algebraically equivalent evaluations can
 * differ by a few ulps. Treat only that scale of apparent loss as stationary;
 * a material loss still triggers deterministic backtracking/failure.
 */
function objectiveRoundoffTolerance(value: number): number {
  return 64 * Number.EPSILON * Math.max(1, Math.abs(value));
}

function gradientAndPrecision(prepared: readonly PreparedComparison[], parameters: Vector, priors: Vector) {
  const gradient = createVector(parameters.length);
  const precision = createMatrix(parameters.length);
  for (let index = 0; index < priors.length; index += 1) {
    gradient[index] = -priors[index]! * parameters[index]!;
    precision[index]![index] = priors[index]!;
  }
  for (const comparison of prepared) {
    const probability = logistic(dot(comparison.row, parameters));
    const residual = comparison.target - probability;
    for (let index = 0; index < parameters.length; index += 1) gradient[index]! += comparison.row[index]! * residual;
    addScaledOuterProduct(precision, comparison.row, probability * (1 - probability));
  }
  return { gradient, precision };
}

function factorWithSingleJitter(precision: Matrix, jitter: number): { lower: Matrix; usedDiagonalJitter: boolean } | undefined {
  try {
    return { lower: cholesky(precision), usedDiagonalJitter: false };
  } catch (error) {
    if (!(error instanceof LinearAlgebraError) || error.code !== 'not-positive-definite') throw error;
    try {
      return { lower: cholesky(addDiagonal(precision, jitter)), usedDiagonalJitter: true };
    } catch (jitterError) {
      if (jitterError instanceof LinearAlgebraError && jitterError.code === 'not-positive-definite') return undefined;
      throw jitterError;
    }
  }
}

function isUsableConfig(config: ModelConfig): boolean {
  return Number.isFinite(config.betaPriorSd) && config.betaPriorSd > 0
    && Number.isFinite(config.destinationPriorSd) && config.destinationPriorSd > 0
    && Number.isFinite(config.activityResidualPriorSd) && config.activityResidualPriorSd > 0
    && Number.isFinite(config.covarianceJitter) && config.covarianceJitter > 0
    && Number.isInteger(config.maxNewtonIterations) && config.maxNewtonIterations > 0
    && Number.isFinite(config.convergenceTolerance) && config.convergenceTolerance > 0;
}

/**
 * Fits a regularized hierarchical Bradley–Terry MAP model with deterministic
 * damped Newton iterations. The returned Cholesky factor represents posterior
 * precision; posterior.ts performs covariance solves/draws without inversion.
 */
export function fitHierarchicalBradleyTerry(
  activities: readonly Activity[],
  comparisons: readonly Comparison[],
  config: ModelConfig = modelConfig,
): MapFit {
  if (!isUsableConfig(config)) {
    return {
      ok: false,
      code: 'invalid-input',
      message: 'Model configuration contains an invalid prior or numerical tolerance.',
      diagnostics: { iterations: 0, lastUpdate: 0, logPosterior: 0 },
    };
  }
  let design: DesignMatrix;
  let prepared: PreparedComparison[];
  try {
    // A 24–40 choice round cannot identify a separate residual for all 120
    // cards. Retain explicit residuals for seen activities and marginalize the
    // exchangeable unseen residuals in the posterior portfolio calculation.
    const observedActivityIds = comparisons.flatMap((comparison) => [comparison.activityA, comparison.activityB]);
    design = createDesignMatrix(activities, observedActivityIds);
    prepared = prepareComparisons(design, comparisons);
  } catch (error) {
    return {
      ok: false,
      code: 'invalid-input',
      message: error instanceof Error ? error.message : 'Invalid model input.',
      // Keep diagnostics serializable even when no numerical iteration began.
      diagnostics: { iterations: 0, lastUpdate: 0, logPosterior: 0 },
    };
  }
  const priors = priorPrecisions(design, config);
  let parameters = createVector(design.parameterCount);
  let lastUpdate = Infinity;
  let lastObjective = objective(prepared, parameters, priors);
  let usedDiagonalJitter = false;

  for (let iteration = 1; iteration <= config.maxNewtonIterations; iteration += 1) {
    const { gradient, precision } = gradientAndPrecision(prepared, parameters, priors);
    const factor = factorWithSingleJitter(precision, config.covarianceJitter);
    if (!factor) {
      return {
        ok: false,
        code: 'covariance-failure',
        message: 'Posterior precision could not be factored safely.',
        diagnostics: { iterations: iteration, lastUpdate, logPosterior: lastObjective },
      };
    }
    usedDiagonalJitter ||= factor.usedDiagonalJitter;
    let delta: number[];
    try {
      delta = solveCholesky(factor.lower, gradient);
    } catch (error) {
      return {
        ok: false,
        code: 'covariance-failure',
        message: error instanceof Error ? error.message : 'Posterior precision could not be solved safely.',
        diagnostics: { iterations: iteration, lastUpdate, logPosterior: lastObjective },
      };
    }
    let step = 1;
    let candidate = parameters.map((value, index) => value + delta[index]!);
    let candidateObjective = objective(prepared, candidate, priors);
    // Deterministic backtracking means a bad Newton step cannot reduce the
    // penalized posterior simply because this particular sample is sparse.
    while (candidateObjective < lastObjective - objectiveRoundoffTolerance(lastObjective) && step > 1 / 128) {
      step /= 2;
      candidate = parameters.map((value, index) => value + step * delta[index]!);
      candidateObjective = objective(prepared, candidate, priors);
    }
    if (candidateObjective < lastObjective - objectiveRoundoffTolerance(lastObjective) || !Number.isFinite(candidateObjective)) {
      return {
        ok: false,
        code: 'non-convergence',
        message: 'MAP fitting could not find a stable ascent step.',
        diagnostics: { iterations: iteration, lastUpdate, logPosterior: lastObjective },
      };
    }
    parameters = candidate;
    lastObjective = candidateObjective;
    lastUpdate = maxAbsolute(delta) * step;
    if (lastUpdate < config.convergenceTolerance) {
      const finalState = gradientAndPrecision(prepared, parameters, priors);
      const finalFactor = factorWithSingleJitter(finalState.precision, config.covarianceJitter);
      if (!finalFactor) {
        return {
          ok: false,
          code: 'covariance-failure',
          message: 'Final posterior precision could not be factored safely.',
          diagnostics: { iterations: iteration, lastUpdate, logPosterior: lastObjective },
        };
      }
      return {
        ok: true,
        design,
        parameters,
        precision: finalFactor.usedDiagonalJitter ? addDiagonal(finalState.precision, config.covarianceJitter) : finalState.precision,
        precisionCholesky: finalFactor.lower,
        diagnostics: {
          converged: true,
          iterations: iteration,
          lastUpdate,
          logPosterior: lastObjective,
          usedDiagonalJitter: usedDiagonalJitter || finalFactor.usedDiagonalJitter,
          comparisonCount: comparisons.length,
        },
      };
    }
  }
  return {
    ok: false,
    code: 'non-convergence',
    message: `MAP fitting did not converge within ${config.maxNewtonIterations} iterations.`,
    diagnostics: { iterations: config.maxNewtonIterations, lastUpdate, logPosterior: lastObjective },
  };
}
