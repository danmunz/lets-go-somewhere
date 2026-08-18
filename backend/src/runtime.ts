/**
 * Runtime selection is deliberately positive and explicit. In particular,
 * neither NODE_ENV nor the absence of a production service may enable the
 * local demo identity adapter.
 */
export type TestMode = 'demo' | 'emulator';

export type RuntimeConfig = {
  isCloudRun: boolean;
  testMode?: TestMode;
  allowsDemoIdentity: boolean;
  usesFirestore: boolean;
  usesFirebaseEmulators: boolean;
};

const asTestMode = (value: string | undefined): TestMode | undefined =>
  value === 'demo' || value === 'emulator' ? value : undefined;

export function resolveRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  // K_SERVICE is supplied by Cloud Run. It wins even if a deployment is
  // accidentally configured with a test flag, preventing header-based auth
  // and emulator routing in a production instance.
  const isCloudRun = Boolean(environment.K_SERVICE);
  const testMode = isCloudRun ? undefined : asTestMode(environment.LGS_TEST_MODE);
  const usesFirebaseEmulators = testMode === 'emulator';

  return {
    isCloudRun,
    ...(testMode ? { testMode } : {}),
    allowsDemoIdentity: !isCloudRun && testMode === 'demo',
    usesFirestore: isCloudRun || environment.NODE_ENV === 'production' || usesFirebaseEmulators,
    usesFirebaseEmulators,
  };
}

export const shouldUseFirestore = (): boolean => resolveRuntimeConfig().usesFirestore;
export const allowsDemoIdentity = (): boolean => resolveRuntimeConfig().allowsDemoIdentity;
