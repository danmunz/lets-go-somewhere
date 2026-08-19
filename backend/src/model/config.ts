/**
 * Versioned, reviewable configuration for the one-trip ranking model.
 *
 * Keep version strings here rather than scattering them through selection or
 * persistence code: any value change that can alter a shortlist requires a
 * corresponding model or policy version.
 */
export const BASELINE_MODEL_VERSION = 'elo-coverage-v1' as const;
export const MODEL_VERSION = 'bt-hierarchical-laplace-v2-compact' as const;
/** The deliberately small production model for the one fixed trip. */
export const SHORTLIST_MODEL_VERSION = 'bayes-attribute-shortlist-v1' as const;
export const SHORTLIST_POLICY_VERSION = 'fixed-32-boundary-v1' as const;
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

/**
 * Thirty-two answers can identify broad preference directions, but not a free
 * parameter for every destination or card. This model therefore has exactly
 * the eight standardized activity attributes and a regularizing normal prior.
 */
export const shortlistModelConfig = {
  ...modelConfig,
  modelVersion: SHORTLIST_MODEL_VERSION,
  betaPriorSd: 1,
  destinationPriorSd: 1,
  activityResidualPriorSd: 1,
  posteriorDrawCount: 128,
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
