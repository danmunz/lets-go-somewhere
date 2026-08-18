import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  StoreConflictError,
  claimPendingAndAppendComparison,
  getStoredUserState,
  setPending,
} from '../src/store.js';

/**
 * This suite deliberately exercises the Firestore adapter, rather than the
 * memory seam used by the fast unit tests. It only runs inside the isolated
 * Firebase Emulator project configured by `npm run test:emulator`.
 */
describe.runIf(process.env.LGS_TEST_MODE === 'emulator')('Firestore transaction adapter', () => {
  const collectionNames = ['lgsV4Users', 'lgsV4State', 'lgsV4ResultSnapshots', 'lgsV4FinalDecisions'];

  async function clearEmulatorState() {
    if (!getApps().length) initializeApp({ projectId: 'lgs-emulator-test' });
    const database = getFirestore();
    await Promise.all(collectionNames.map(async (name) => {
      const documents = await database.collection(name).listDocuments();
      await Promise.all(documents.map((document) => document.delete()));
    }));
  }

  beforeEach(clearEmulatorState);
  afterAll(clearEmulatorState);

  it('durably accepts exactly one concurrent claim and keeps the stamped answer', async () => {
    await setPending('dan', ['oaxaca-ruins', 'lima-barranco']);
    const input = { activityA: 'oaxaca-ruins', activityB: 'lima-barranco', winner: 'oaxaca-ruins', revision: 0 };

    const claims = await Promise.allSettled([
      claimPendingAndAppendComparison('dan', input),
      claimPendingAndAppendComparison('dan', input),
    ]);

    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    expect(claims.find((claim) => claim.status === 'rejected')).toMatchObject({
      reason: expect.objectContaining<Partial<StoreConflictError>>({ code: 'pending-missing' }),
    });
    await expect(getStoredUserState('dan')).resolves.toMatchObject({
      revision: 1,
      pending: null,
      seedVersion: expect.stringMatching(/^[a-f0-9]{64}$/),
      comparisons: [expect.objectContaining({ ordinal: 1, selectorVersion: 'information-gain-v1' })],
    });
  });

  it('rejects a stale revision without consuming the outstanding offer', async () => {
    await setPending('james', ['oaxaca-ruins', 'lima-barranco']);
    await expect(claimPendingAndAppendComparison('james', {
      activityA: 'oaxaca-ruins', activityB: 'lima-barranco', winner: 'oaxaca-ruins', revision: 1,
    })).rejects.toMatchObject<Partial<StoreConflictError>>({ code: 'pending-revision-mismatch' });

    await expect(getStoredUserState('james')).resolves.toMatchObject({
      revision: 0,
      pending: expect.objectContaining({ activityA: 'oaxaca-ruins', activityB: 'lima-barranco', revision: 0 }),
      comparisons: [],
    });
  });
});
