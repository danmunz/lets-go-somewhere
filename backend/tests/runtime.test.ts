import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from '../src/runtime.js';

describe('runtime selection', () => {
  it('requires an explicit flag for the local demo identity adapter', () => {
    expect(resolveRuntimeConfig({ NODE_ENV: 'test' })).toMatchObject({
      allowsDemoIdentity: false,
      usesFirestore: false,
      usesFirebaseEmulators: false,
    });
    expect(resolveRuntimeConfig({ NODE_ENV: 'test', LGS_TEST_MODE: 'demo' })).toMatchObject({
      testMode: 'demo',
      allowsDemoIdentity: true,
      usesFirestore: false,
    });
  });

  it('selects Firestore only for an explicit emulator mode, Cloud Run, or a production server', () => {
    expect(resolveRuntimeConfig({ NODE_ENV: 'test', LGS_TEST_MODE: 'emulator' })).toMatchObject({
      testMode: 'emulator',
      usesFirestore: true,
      usesFirebaseEmulators: true,
      allowsDemoIdentity: false,
    });
    expect(resolveRuntimeConfig({ NODE_ENV: 'production' })).toMatchObject({
      usesFirestore: true,
      allowsDemoIdentity: false,
    });
  });

  it('always rejects demo authentication and emulator selection in Cloud Run', () => {
    expect(resolveRuntimeConfig({
      NODE_ENV: 'test',
      K_SERVICE: 'lgs-api',
      LGS_TEST_MODE: 'demo',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    })).toMatchObject({
      isCloudRun: true,
      allowsDemoIdentity: false,
      usesFirestore: true,
      usesFirebaseEmulators: false,
    });
  });
});
