/**
 * Versioned, reviewable configuration for the one-trip ranking model.
 *
 * These values are intentionally provisional until OT-19's synthetic evaluation
 * gate records the selected configuration in the model ADR. Keep version strings
 * here rather than scattering them through selection or persistence code: any
 * value change that can alter a result requires a corresponding model version.
 */
export const BASELINE_MODEL_VERSION = 'elo-coverage-v1' as const;
export const MODEL_VERSION = 'bt-hierarchical-laplace-v1' as const;
export const SELECTOR_VERSION = 'information-gain-v1' as const;
export const SNAPSHOT_SCHEMA_VERSION = 1 as const;

export const MODEL_PARAMETER_ORDER = [
  'beta:adventure',
  'beta:nature',
  'beta:culture',
  'beta:food',
  'beta:history',
  'beta:urban',
  'beta:novelty',
  'beta:physicalIntensity',
] as const;

export const modelConfig = {
  modelVersion: MODEL_VERSION,
  betaPriorSd: 1.25,
  destinationPriorSd: 0.45,
  activityResidualPriorSd: 0.2,
  maxNewtonIterations: 16,
  convergenceTolerance: 1e-7,
  posteriorDrawCount: 512,
  credibleInterval: 0.9,
  /** A single, documented numerical recovery attempt for Cholesky factorization. */
  covarianceJitter: 1e-9,
} as const;

/** Deliberately structural so synthetic evaluation can test candidate settings. */
export type ModelConfig = Readonly<{
  modelVersion: string;
  betaPriorSd: number;
  destinationPriorSd: number;
  activityResidualPriorSd: number;
  maxNewtonIterations: number;
  convergenceTolerance: number;
  posteriorDrawCount: number;
  credibleInterval: number;
  covarianceJitter: number;
}>;
