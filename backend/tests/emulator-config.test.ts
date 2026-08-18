import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from '../src/runtime.js';

describe.runIf(process.env.LGS_TEST_MODE === 'emulator')('Firebase Emulator Suite configuration', () => {
  it('runs against explicitly selected local Auth and Firestore emulators', () => {
    expect(process.env.LGS_TEST_MODE).toBe('emulator');
    expect(process.env.FIRESTORE_EMULATOR_HOST).toMatch(/^127\.0\.0\.1:\d+$/);
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toMatch(/^127\.0\.0\.1:\d+$/);
    expect(resolveRuntimeConfig()).toMatchObject({
      isCloudRun: false,
      testMode: 'emulator',
      allowsDemoIdentity: false,
      usesFirestore: true,
      usesFirebaseEmulators: true,
    });
  });
});
