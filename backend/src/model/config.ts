/**
 * Versioned, reviewable configuration for the one-trip ranking model.
 *
 * These values are intentionally provisional until OT-19's synthetic evaluation
 * gate records the selected configuration in the model ADR. Keep version strings
 * here rather than scattering them through selection or persistence code: any
 * value change that can alter a result requires a corresponding model version.
 */
export const BASELINE_MODEL_VERSION = 'elo-coverage-v1' as const;
export const MODEL_VERSION = 'bt-hierarchical-laplace-v2-compact' as const;
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
  // Synthetic-only calibration candidates use stronger structured shrinkage:
  // sparse 24–40 answer rounds identify broad attribute preferences much more
  // reliably than card-specific or destination-specific deviations.
  betaPriorSd: 0.8,
  destinationPriorSd: 0.15,
  activityResidualPriorSd: 0.08,
  maxNewtonIterations: 48,
  convergenceTolerance: 1e-6,
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
