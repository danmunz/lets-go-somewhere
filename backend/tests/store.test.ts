import { describe, expect, it } from 'vitest';
import { getSeedVersion } from '../src/model/snapshot.js';
import { buildTransparentSocialBallot } from '../src/results/social-ballot.js';
import {
  LEGACY_SELECTOR_VERSION,
  LEGACY_TIMESTAMP,
  PENDING_COMPARISON_TTL_MS,
  StoreConflictError,
  StoreDataError,
  __storeTest,
  addComparison,
  claimPendingAndAppendComparison,
  createFinalDecision,
  createOrGetRevealSnapshot,
  getAllFinalDecisions,
  getFinalDecision,
  getRevealSnapshot,
  getStoredUserState,
  inspectSeedVersionState,
  isRevealOpen,
  openReveal,
  readPendingComparison,
  readStoredComparison,
  readStoredUserState,
  setPending,
  type RevealSnapshotInput,
} from '../src/store.js';

const comparison = { activityA: 'a', activityB: 'b', winner: 'a' };
const now = '2026-08-18T12:00:00.000Z';

const profile = {
  headline: 'Apparently, this is your kind of trip.',
  synthesis: 'You consistently leaned toward active, distinctive experiences.',
  dimensions: [
    { key: 'adventure' as const, label: 'Adventure', strength: 'strong' as const, direction: 'drawn-to' as const },
    { key: 'nature' as const, label: 'Wild places', strength: 'present' as const, direction: 'drawn-to' as const },
  ],
  confidenceLabel: 'clear-shape' as const,
};

const snapshotInput = (): RevealSnapshotInput => {
  const topFive = ['antigua', 'oaxaca', 'quito', 'cuzco', 'medellin'];
  const userSummary = {
    topFive,
    profileThemes: ['Adventure', 'Wild places'],
    profile,
    personalResults: {
      confidence: { label: 'clear-favorite' as const, summary: 'A clear favorite.' },
      topFive: topFive.map((id, index) => ({
        rank: index + 1,
        id,
        fitLabel: index === 0 ? 'strong-match' as const : 'contender' as const,
        interval: { low: 0.1, high: 0.9 },
        explanation: { themes: ['Adventure', 'Wild places'], matchedActivityCount: 1, encounteredActivityCount: 1 },
      })),
    },
  };
  const users = { dan: userSummary, james: userSummary, john: userSummary, matt: userSummary, peter: userSummary };
  return {
    schemaVersion: 2,
    modelVersion: 'bt-hierarchical-laplace-v1',
    seedVersion: 'a'.repeat(64),
    inputDigest: 'b'.repeat(64),
    users,
    group: buildTransparentSocialBallot({
      ballots: { dan: topFive, james: topFive, john: topFive, matt: topFive, peter: topFive },
      profileThemes: { dan: ['Adventure'], james: ['Adventure'], john: ['Adventure'], matt: ['Adventure'], peter: ['Adventure'] },
      destinationNames: Object.fromEntries(topFive.map((id) => [id, id])),
    }),
  };
};

describe('versioned store readers', () => {
  it('normalizes legacy choices by persisted array order for replay', () => {
    const state = readStoredUserState({ comparisons: [comparison, { activityA: 'c', activityB: 'd', winner: 'd' }] });
    expect(state.revision).toBe(2);
    expect(state.comparisons).toEqual([
      { ...comparison, ordinal: 1, createdAt: LEGACY_TIMESTAMP, selectorVersion: LEGACY_SELECTOR_VERSION },
      { activityA: 'c', activityB: 'd', winner: 'd', ordinal: 2, createdAt: LEGACY_TIMESTAMP, selectorVersion: LEGACY_SELECTOR_VERSION },
    ]);
  });

  it('accepts fully server-stamped records and revision/completion metadata', () => {
    const state = readStoredUserState({
      comparisons: [{ ...comparison, ordinal: 1, createdAt: now, selectorVersion: 'information-gain-v1' }],
      pending: { activityA: 'c', activityB: 'd', issuedAt: now, revision: 4, selectorVersion: 'information-gain-v1' },
      revision: 4,
      completedAt: now,
      updatedAt: now,
      seedVersion: 'a'.repeat(64),
    });
    expect(state).toMatchObject({ revision: 4, completedAt: now, updatedAt: now, seedVersion: 'a'.repeat(64) });
    expect(state.pending).toMatchObject({ activityA: 'c', revision: 4 });
  });

  it('accepts the deployed legacy pending tuple at the current revision', () => {
    expect(readPendingComparison(['a', 'b'], 3)).toEqual({
      activityA: 'a', activityB: 'b', issuedAt: LEGACY_TIMESTAMP, revision: 3, selectorVersion: LEGACY_SELECTOR_VERSION,
    });
  });

  it('rejects malformed or partially stamped persisted values', () => {
    expect(() => readStoredComparison({ ...comparison, ordinal: 1 }, 0)).toThrow(StoreDataError);
    expect(() => readStoredUserState({ comparisons: [{ ...comparison, ordinal: 3, createdAt: now, selectorVersion: 'selector' }] })).toThrow(/append-only array order/);
    expect(() => readStoredUserState({ comparisons: [comparison], revision: 0 })).toThrow(/revision cannot be lower/);
    expect(() => readStoredUserState({ pending: ['a', 'a'] })).toThrow(StoreDataError);
    expect(() => readStoredUserState({ completedAt: 'not-a-date' })).toThrow(StoreDataError);
  });

  it('blocks a legacy started journey without a seed version instead of mixing content', async () => {
    __storeTest.clearMemory();
    __storeTest.setMemoryUserDocument('dan', { comparisons: [comparison], pending: ['a', 'b'] });
    const before = structuredClone(__storeTest.getMemoryUserDocument('dan')!);
    await expect(setPending('dan', ['c', 'd'])).rejects.toMatchObject({ name: 'SeedVersionMismatchError' });
    expect(__storeTest.getMemoryUserDocument('dan')).toEqual(before);

    __storeTest.setMemoryUserDocument('james', { comparisons: [comparison], completedAt: now, seedVersion: getSeedVersion() });
    await expect(addComparison('james', { activityA: 'c', activityB: 'd', winner: 'c' })).rejects.toBeInstanceOf(StoreConflictError);
    expect((await getStoredUserState('james')).comparisons).toEqual([
      { ...comparison, ordinal: 1, createdAt: LEGACY_TIMESTAMP, selectorVersion: LEGACY_SELECTOR_VERSION },
    ]);
  });

  it('inspects seed state without applying a reset', async () => {
    __storeTest.clearMemory();
    __storeTest.setMemoryUserDocument('matt', { comparisons: [comparison], seedVersion: 'b'.repeat(64) });
    const inspection = await inspectSeedVersionState('matt');
    expect(inspection).toMatchObject({ persisted: 'b'.repeat(64), hasComparisons: true, matches: false });
    expect((await getStoredUserState('matt')).comparisons).toHaveLength(1);
  });
});

describe('transactional pending claims', () => {
  const offered = { activityA: 'a', activityB: 'b', winner: 'a', revision: 0 };

  it('atomically appends a stamped answer, clears its offer, and advances revision', async () => {
    __storeTest.clearMemory();
    await setPending('dan', ['a', 'b']);

    const appended = await claimPendingAndAppendComparison('dan', offered);
    const state = await getStoredUserState('dan');

    expect(appended).toMatchObject({ ...comparison, ordinal: 1, selectorVersion: expect.any(String) });
    expect(appended.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(state).toMatchObject({ revision: 1, pending: null, updatedAt: appended.createdAt });
    expect(state.comparisons).toEqual([appended]);
    expect(state.seedVersion).toMatch(/^[a-f0-9]{64}$/);
  });

  it('binds the first answer to a seed and fails closed if the seed later changes', async () => {
    __storeTest.clearMemory();
    await setPending('dan', ['a', 'b']);
    await claimPendingAndAppendComparison('dan', offered);
    const before = structuredClone(__storeTest.getMemoryUserDocument('dan')!);

    __storeTest.setCurrentSeedVersion('f'.repeat(64));
    await expect(setPending('dan', ['c', 'd'])).rejects.toMatchObject({ name: 'SeedVersionMismatchError' });
    expect(__storeTest.getMemoryUserDocument('dan')).toEqual(before);
  });

  it('accepts exactly one of two concurrent claims for the same issued pair', async () => {
    __storeTest.clearMemory();
    await setPending('james', ['a', 'b']);

    const claims = await Promise.allSettled([
      claimPendingAndAppendComparison('james', offered),
      claimPendingAndAppendComparison('james', offered),
    ]);

    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    const rejected = claims.find((claim) => claim.status === 'rejected');
    expect(rejected).toMatchObject({ reason: expect.objectContaining({ code: 'pending-missing' }) });
    expect((await getStoredUserState('james'))).toMatchObject({ revision: 1, pending: null });
    expect((await getStoredUserState('james')).comparisons).toHaveLength(1);
  });

  it.each([
    ['a stale revision', { ...offered, revision: 2 }, 'pending-revision-mismatch'],
    ['a modified pair', { activityA: 'a', activityB: 'c', winner: 'a', revision: 0 }, 'pending-offered-mismatch'],
  ])('rejects %s without mutating the outstanding offer', async (_label, input, code) => {
    __storeTest.clearMemory();
    await setPending('john', ['a', 'b']);
    const before = structuredClone(__storeTest.getMemoryUserDocument('john')!);

    await expect(claimPendingAndAppendComparison('john', input)).rejects.toMatchObject({
      code,
      name: 'StoreConflictError',
    });

    expect(__storeTest.getMemoryUserDocument('john')).toEqual(before);
  });

  it('rejects an expired issued pair without clearing or appending it', async () => {
    __storeTest.clearMemory();
    const issuedAt = new Date(Date.now() - PENDING_COMPARISON_TTL_MS).toISOString();
    __storeTest.setMemoryUserDocument('matt', {
      comparisons: [],
      revision: 0,
      pending: { activityA: 'a', activityB: 'b', issuedAt, revision: 0, selectorVersion: 'selector' },
    });
    const before = structuredClone(__storeTest.getMemoryUserDocument('matt')!);

    await expect(claimPendingAndAppendComparison('matt', offered)).rejects.toMatchObject({
      code: 'pending-expired',
      name: 'StoreConflictError',
    });

    expect(__storeTest.getMemoryUserDocument('matt')).toEqual(before);
  });

  it('rejects a post-completion answer without mutating raw choices', async () => {
    __storeTest.clearMemory();
    __storeTest.setMemoryUserDocument('peter', {
      comparisons: [comparison],
      revision: 1,
      completedAt: now,
      seedVersion: getSeedVersion(),
      pending: { activityA: 'a', activityB: 'b', issuedAt: new Date().toISOString(), revision: 1, selectorVersion: 'selector' },
    });
    const before = structuredClone(__storeTest.getMemoryUserDocument('peter')!);

    await expect(claimPendingAndAppendComparison('peter', { ...offered, revision: 1 })).rejects.toMatchObject({
      code: 'completed',
      name: 'StoreConflictError',
    });

    expect(__storeTest.getMemoryUserDocument('peter')).toEqual(before);
  });
});

describe('immutable reveal snapshots and final decisions', () => {
  it('creates one snapshot and retains it across repeated opens and repository reads', async () => {
    __storeTest.clearMemory();
    const first = await createOrGetRevealSnapshot(snapshotInput());
    const changed = { ...snapshotInput(), modelVersion: 'a-different-model' };
    const second = await createOrGetRevealSnapshot(changed);

    expect(first.snapshotId).toMatch(/^reveal-/);
    expect(first.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(second).toEqual(first);
    expect(await isRevealOpen()).toBe(true);
    expect(__storeTest.getMemoryRevealState()).toEqual(expect.objectContaining({ open: true, snapshotId: first.snapshotId }));
    expect(__storeTest.getMemorySnapshot(first.snapshotId)).toMatchObject({ modelVersion: 'bt-hierarchical-laplace-v1' });
    expect(await getRevealSnapshot()).toEqual(first);
  });

  it('upgrades a backwards-compatible open reveal into a single immutable snapshot', async () => {
    __storeTest.clearMemory();
    await openReveal();
    expect(await getRevealSnapshot()).toBeUndefined();

    const snapshot = await createOrGetRevealSnapshot(snapshotInput());
    expect(snapshot).toMatchObject({ snapshotId: expect.any(String) });
    expect(await getRevealSnapshot()).toEqual(snapshot);
  });

  it('does not persist a final decision before an open reveal snapshot', async () => {
    __storeTest.clearMemory();

    await expect(createFinalDecision('dan', 'antigua')).rejects.toMatchObject({
      name: 'StoreConflictError',
      code: 'reveal-snapshot-missing',
    });
    expect(__storeTest.getMemoryFinalDecision('dan')).toBeUndefined();
    expect(await getFinalDecision('dan')).toBeUndefined();
  });

  it('creates one snapshot-bound decision and returns its existing state in a repeat conflict', async () => {
    __storeTest.clearMemory();
    const snapshot = await createOrGetRevealSnapshot(snapshotInput());
    const decision = await createFinalDecision('dan', 'antigua');

    expect(decision).toMatchObject({ user: 'dan', choice: 'antigua', snapshotId: snapshot.snapshotId });
    await expect(createFinalDecision('dan', 'oaxaca')).rejects.toMatchObject({
      name: 'StoreConflictError',
      code: 'final-decision-exists',
      existingDecision: decision,
    });
    expect(await getFinalDecision('dan')).toEqual(decision);
    expect(await getAllFinalDecisions()).toEqual([decision]);
  });

  it('accepts only a snapshot finalist or research and keeps a rejected choice out of storage', async () => {
    __storeTest.clearMemory();
    await createOrGetRevealSnapshot(snapshotInput());

    await expect(createFinalDecision('james', 'not-a-finalist')).rejects.toBeInstanceOf(StoreDataError);
    expect(__storeTest.getMemoryFinalDecision('james')).toBeUndefined();
    await expect(createFinalDecision('james', 'need-more-research')).resolves.toMatchObject({ choice: 'need-more-research' });
  });

  it('allows exactly one concurrent final-decision create for a roster member', async () => {
    __storeTest.clearMemory();
    await createOrGetRevealSnapshot(snapshotInput());

    const attempts = await Promise.allSettled([
      createFinalDecision('matt', 'antigua'),
      createFinalDecision('matt', 'antigua'),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.find((attempt) => attempt.status === 'rejected')).toMatchObject({
      reason: expect.objectContaining({ code: 'final-decision-exists' }),
    });
  });
});
