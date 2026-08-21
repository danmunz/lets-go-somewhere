import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import type {
  Activity,
  Comparison,
  Destination,
  ResultSnapshotCreation,
  VersionedResultSnapshot,
} from '@lgs/shared';
import {
  activitySchema,
  comparisonSchema,
  destinationSchema,
  resultSnapshotCreationSchema,
  resultSnapshotReaderSchema,
} from '@lgs/shared';
import { SELECTOR_VERSION } from './model/config.js';
import { getSeedVersion } from './model/snapshot.js';
import { shouldUseFirestore } from './runtime.js';

export const destinations = destinationSchema.array().parse(JSON.parse(readFileSync(new URL('../../seed/destinations.json', import.meta.url), 'utf8'))) as Destination[];
export const activities = activitySchema.array().parse(JSON.parse(readFileSync(new URL('../../seed/activities.json', import.meta.url), 'utf8'))) as Activity[];
export const ROSTER = ['dan', 'james', 'john', 'matt', 'peter'] as const;
export type RosterUser = (typeof ROSTER)[number];

/** A literal sentinel distinguishes replayed legacy data from a server stamp. */
export const LEGACY_TIMESTAMP = 'unknown-legacy' as const;
export const LEGACY_SELECTOR_VERSION = 'unknown-legacy' as const;
/** Issued pairs are short-lived capability tokens, not a second client state. */
export const PENDING_COMPARISON_TTL_MS = 10 * 60 * 1000;

export type StoredComparison = Comparison & {
  ordinal: number;
  createdAt: string;
  selectorVersion: string;
};

export type PendingComparison = {
  activityA: string;
  activityB: string;
  issuedAt: string;
  revision: number;
  selectorVersion: string;
};

export type StoredUserState = {
  comparisons: StoredComparison[];
  pending: PendingComparison | null;
  revision: number;
  completedAt?: string;
  updatedAt?: string;
  seedVersion?: string;
};

/**
 * The model supplies only validated, Firestore-safe summaries. The repository
 * owns the reveal timestamp and document identity so a client cannot choose
 * either one when the API promotes this capability.
 */
export type RevealSnapshotInput = Omit<ResultSnapshotCreation, 'createdAt'> & { createdAt?: string };
export type StoredRevealSnapshot = VersionedResultSnapshot & { snapshotId: string };

export type SeedVersionState = {
  current: string;
  persisted?: string;
  hasComparisons: boolean;
  matches: boolean | null;
};

export class StoreDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreDataError';
  }
}

/**
 * A started journey is tied to one canonical seed. This intentionally carries
 * no digest values: callers must restore the release, not learn deployment
 * internals from an API response.
 */
export class SeedVersionMismatchError extends Error {
  constructor() {
    super('This trip’s content version no longer matches the started journey.');
    this.name = 'SeedVersionMismatchError';
  }
}

export class StoreConflictError extends Error {
  constructor(
    public readonly code: StoreConflictCode,
    message: string,
  ) {
    super(message);
    this.name = 'StoreConflictError';
  }
}

export type StoreConflictCode =
  | 'completed'
  | 'pending-missing'
  | 'pending-expired'
  | 'pending-revision-mismatch'
  | 'pending-offered-mismatch';

export type PendingClaimInput = Comparison & {
  /** The server revision that accompanied the issued pair. */
  revision: number;
};

const timestampSchema = z.string().datetime({ offset: true });
const replayTimestampSchema = z.union([timestampSchema, z.literal(LEGACY_TIMESTAMP)]);
const metadataSchema = z.object({
  ordinal: z.number().int().positive(),
  createdAt: replayTimestampSchema,
  selectorVersion: z.string().min(1),
});
const storedComparisonValueSchema = comparisonSchema.and(metadataSchema);
const pendingComparisonValueSchema = z.object({
  activityA: z.string().min(1),
  activityB: z.string().min(1),
  issuedAt: timestampSchema,
  revision: z.number().int().nonnegative(),
  selectorVersion: z.string().min(1),
}).strict().superRefine((value, context) => {
  if (value.activityA === value.activityB) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Pending activities must differ.' });
});
const legacyPendingSchema = z.tuple([z.string().min(1), z.string().min(1)]).refine(([activityA, activityB]) => activityA !== activityB, 'Pending activities must differ.');
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/i, 'Seed version must be a SHA-256 digest.');
const rawUserDocumentSchema = z.object({
  comparisons: z.array(z.unknown()).optional(),
  pending: z.unknown().nullable().optional(),
  revision: z.number().int().nonnegative().optional(),
  completedAt: timestampSchema.optional(),
  updatedAt: timestampSchema.optional(),
  seedVersion: digestSchema.optional(),
}).passthrough();
const revealStateSchema = z.object({
  open: z.boolean().optional(),
  openedAt: timestampSchema.optional(),
  snapshotId: z.string().min(1).optional(),
}).passthrough();
const revealSnapshotInputSchema = resultSnapshotCreationSchema
  .omit({ createdAt: true })
  .extend({ createdAt: timestampSchema.optional() })
  .strict();

type StoredRevealState = {
  open: boolean;
  openedAt?: string;
  snapshotId?: string;
};

function persistedError(label: string, cause?: unknown): StoreDataError {
  const detail = cause instanceof z.ZodError ? cause.issues.map((issue) => issue.message).join('; ') : undefined;
  return new StoreDataError(`Invalid persisted ${label}${detail ? `: ${detail}` : '.'}`);
}

function readRevealState(value: unknown): StoredRevealState {
  const parsed = revealStateSchema.safeParse(value ?? {});
  if (!parsed.success) throw persistedError('reveal state', parsed.error);
  return {
    open: parsed.data.open ?? false,
    ...(parsed.data.openedAt ? { openedAt: parsed.data.openedAt } : {}),
    ...(parsed.data.snapshotId ? { snapshotId: parsed.data.snapshotId } : {}),
  };
}

function readStoredRevealSnapshot(snapshotId: string, value: unknown): StoredRevealSnapshot {
  const parsed = resultSnapshotReaderSchema.safeParse(value);
  if (!parsed.success) throw persistedError(`result snapshot ${snapshotId}`, parsed.error);
  return { snapshotId, ...parsed.data };
}

function snapshotForWrite(input: RevealSnapshotInput, now: string): ResultSnapshotCreation {
  const parsed = revealSnapshotInputSchema.safeParse(input);
  if (!parsed.success) throw new StoreDataError(`Cannot persist an invalid result snapshot: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  // Ignore a caller-provided timestamp: only the repository determines when a
  // public reveal became immutable.
  return resultSnapshotCreationSchema.parse({ ...parsed.data, createdAt: now });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStoredComparisonMetadata(value: unknown): boolean {
  return isRecord(value) && ['ordinal', 'createdAt', 'selectorVersion'].some((key) => key in value);
}

/**
 * Reads either a fully stamped comparison or an old deployed comparison. A
 * partial metadata record is invalid instead of being silently treated as
 * legacy, which keeps server-owned ordering fields trustworthy.
 */
export function readStoredComparison(value: unknown, index: number): StoredComparison {
  const ordinal = index + 1;
  if (hasStoredComparisonMetadata(value)) {
    const parsed = storedComparisonValueSchema.safeParse(value);
    if (!parsed.success) throw persistedError(`comparison at ordinal ${ordinal}`, parsed.error);
    if (parsed.data.ordinal !== ordinal) throw new StoreDataError(`Invalid persisted comparison at ordinal ${ordinal}: ordinal must match append-only array order.`);
    return parsed.data;
  }

  const legacy = comparisonSchema.safeParse(value);
  if (!legacy.success) throw persistedError(`legacy comparison at ordinal ${ordinal}`, legacy.error);
  return { ...legacy.data, ordinal, createdAt: LEGACY_TIMESTAMP, selectorVersion: LEGACY_SELECTOR_VERSION };
}

export function readStoredComparisons(value: unknown): StoredComparison[] {
  if (!Array.isArray(value)) throw new StoreDataError('Invalid persisted comparisons: expected an array.');
  return value.map((comparison, index) => readStoredComparison(comparison, index));
}

/** Legacy pending pairs remain readable until OT-06 switches to pending claims. */
export function readPendingComparison(value: unknown, revision: number): PendingComparison | null {
  if (value === undefined || value === null) return null;
  const current = pendingComparisonValueSchema.safeParse(value);
  if (current.success) return current.data;
  if (isRecord(value)) throw persistedError('pending comparison', current.error);
  const legacy = legacyPendingSchema.safeParse(value);
  if (!legacy.success) throw persistedError('legacy pending comparison', legacy.error);
  return { activityA: legacy.data[0], activityB: legacy.data[1], issuedAt: LEGACY_TIMESTAMP, revision, selectorVersion: LEGACY_SELECTOR_VERSION };
}

/** Pure reader: a read never writes a migration. */
export function readStoredUserState(value: unknown): StoredUserState {
  const raw = rawUserDocumentSchema.safeParse(value ?? {});
  if (!raw.success) throw persistedError('user document', raw.error);
  const comparisons = readStoredComparisons(raw.data.comparisons ?? []);
  const revision = raw.data.revision ?? comparisons.length;
  if (revision < comparisons.length) throw new StoreDataError('Invalid persisted user document: revision cannot be lower than the comparison count.');
  const pending = readPendingComparison(raw.data.pending, revision);
  if (pending && pending.revision !== revision) throw new StoreDataError('Invalid persisted pending comparison: revision must match the user revision.');
  return {
    comparisons,
    pending,
    revision,
    ...(raw.data.completedAt ? { completedAt: raw.data.completedAt } : {}),
    ...(raw.data.updatedAt ? { updatedAt: raw.data.updatedAt } : {}),
    ...(raw.data.seedVersion ? { seedVersion: raw.data.seedVersion } : {}),
  };
}

function toCanonicalStoredComparison(
  comparison: Comparison,
  ordinal: number,
  now: string,
  selectorVersion: string = SELECTOR_VERSION,
): StoredComparison {
  const parsed = comparisonSchema.safeParse(comparison);
  if (!parsed.success) throw new StoreDataError('Cannot persist an invalid comparison.');
  return { ...parsed.data, ordinal, createdAt: now, selectorVersion };
}

function normalizeForWrite(state: StoredUserState): StoredUserState {
  return {
    ...state,
    comparisons: state.comparisons.map((comparison, index) => ({
      ...comparison,
      ordinal: index + 1,
      // Legacy timestamps remain explicitly unknown; inventing a historical
      // clock value would make replay metadata look more precise than it is.
      createdAt: comparison.createdAt,
    })),
  };
}

type RawUserDocument = Record<string, unknown>;
const memoryUsers = new Map<RosterUser, RawUserDocument>();
const memoryUserLocks = new Map<RosterUser, Promise<void>>();
let memoryRevealState: StoredRevealState = { open: false };
const memoryResultSnapshots = new Map<string, VersionedResultSnapshot>();
let memoryRevealLock: Promise<void> = Promise.resolve();
let testSeedVersionOverride: string | undefined;
const currentSeedVersion = () => testSeedVersionOverride ?? getSeedVersion();
const database = () => { if (!getApps().length) initializeApp(); return getFirestore(); };
const userDocument = (user: RosterUser) => database().collection('lgsV4Users').doc(user);
const revealDocument = () => database().collection('lgsV4State').doc('reveal');
const resultSnapshotDocument = (snapshotId: string) => database().collection('lgsV4ResultSnapshots').doc(snapshotId);

/**
 * Gives the memory adapter the same one-winner claim semantics as Firestore
 * transactions. The lock is deliberately per traveler so independent roster
 * members can still answer concurrently.
 */
async function withMemoryUserLock<T>(user: RosterUser, operation: () => Promise<T> | T): Promise<T> {
  const previous = memoryUserLocks.get(user) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  memoryUserLocks.set(user, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (memoryUserLocks.get(user) === current) memoryUserLocks.delete(user);
  }
}

/** Serializes memory-only reveal writes just as Firestore does. */
async function withMemoryRevealLock<T>(operation: () => Promise<T> | T): Promise<T> {
  const previous = memoryRevealLock;
  let release!: () => void;
  memoryRevealLock = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function getRawUserDocument(user: RosterUser): Promise<RawUserDocument> {
  if (!shouldUseFirestore()) return memoryUsers.get(user) ?? {};
  return (await userDocument(user).get()).data() ?? {};
}

async function writeRawUserDocument(user: RosterUser, value: RawUserDocument): Promise<void> {
  if (!shouldUseFirestore()) { memoryUsers.set(user, value); return; }
  await userDocument(user).set(value, { merge: true });
}

export const getStoredUserState = async (user: RosterUser): Promise<StoredUserState> => readStoredUserState(await getRawUserDocument(user));

/** Read-only seed inspection; controlled resets are intentionally deferred. */
export const inspectSeedVersionState = async (user: RosterUser): Promise<SeedVersionState> => {
  const state = await getStoredUserState(user);
  const current = currentSeedVersion();
  return {
    current,
    ...(state.seedVersion ? { persisted: state.seedVersion } : {}),
    hasComparisons: state.comparisons.length > 0,
    matches: state.seedVersion ? state.seedVersion === current : null,
  };
};

/**
 * A legacy started journey without a digest is unsafe to continue. Fresh
 * users may begin under the current seed; their first answer binds it inside
 * the same write transaction.
 */
function assertStateSeedVersionCompatible(state: StoredUserState, current = currentSeedVersion()): void {
  if (state.comparisons.length > 0 && state.seedVersion !== current) {
    throw new SeedVersionMismatchError();
  }
}

export const assertSeedVersionCompatible = async (user: RosterUser): Promise<void> => {
  assertStateSeedVersionCompatible(await getStoredUserState(user));
};

export function assertRevealSnapshotSeedVersionCompatible(snapshot: StoredRevealSnapshot): void {
  if (snapshot.seedVersion !== currentSeedVersion()) throw new SeedVersionMismatchError();
}

/** Existing API compatibility: callers still receive plain comparisons. */
export const getComparisons = async (user: RosterUser): Promise<Comparison[]> => (await getStoredUserState(user)).comparisons.map(({ ordinal: _ordinal, createdAt: _createdAt, selectorVersion: _selectorVersion, ...comparison }) => comparison);
export const getAllComparisons = async (): Promise<Record<RosterUser, Comparison[]>> => Object.fromEntries(await Promise.all(ROSTER.map(async (user) => [user, await getComparisons(user)]))) as Record<RosterUser, Comparison[]>;

/** Existing API compatibility until OT-06 replaces this with a claim transaction. */
export const setPending = async (user: RosterUser, pair: [string, string]) => {
  const issue = (state: StoredUserState, now: string): RawUserDocument => {
    assertStateSeedVersionCompatible(state);
    if (state.completedAt) throw new StoreConflictError('completed', 'Cannot issue a comparison after completion.');
    const pending: PendingComparison = { activityA: pair[0], activityB: pair[1], issuedAt: now, revision: state.revision, selectorVersion: SELECTOR_VERSION };
    return { ...normalizeForWrite(state), pending, updatedAt: now };
  };
  if (!shouldUseFirestore()) {
    await withMemoryUserLock(user, async () => {
      const state = readStoredUserState(memoryUsers.get(user) ?? {});
      memoryUsers.set(user, issue(state, new Date().toISOString()));
    });
    return;
  }
  await database().runTransaction(async (transaction) => {
    const reference = userDocument(user);
    const snapshot = await transaction.get(reference);
    transaction.set(reference, issue(readStoredUserState(snapshot.data() ?? {}), new Date().toISOString()), { merge: true });
  });
};

/** Existing API compatibility until OT-06 replaces this with a claim transaction. */
export const takePending = async (user: RosterUser): Promise<[string, string] | undefined> => {
  if (!shouldUseFirestore()) {
    const state = await getStoredUserState(user);
    assertStateSeedVersionCompatible(state);
    if (!state.pending) return undefined;
    await writeRawUserDocument(user, { ...normalizeForWrite(state), pending: null });
    return [state.pending.activityA, state.pending.activityB];
  }
  return database().runTransaction(async (transaction) => {
    const reference = userDocument(user);
    const snapshot = await transaction.get(reference);
    const state = readStoredUserState(snapshot.data() ?? {});
    assertStateSeedVersionCompatible(state);
    if (!state.pending) return undefined;
    transaction.set(reference, { ...normalizeForWrite(state), pending: null }, { merge: true });
    return [state.pending.activityA, state.pending.activityB] as [string, string];
  });
};

/** Existing API compatibility until OT-06 replaces this with a claim transaction. */
export const addComparison = async (user: RosterUser, comparison: Comparison) => {
  const append = (state: StoredUserState, now: string) => {
    assertStateSeedVersionCompatible(state);
    if (state.completedAt) throw new StoreConflictError('completed', 'Cannot append a comparison after completion.');
    const canonical = normalizeForWrite(state);
    return {
      ...canonical,
      comparisons: [...canonical.comparisons, toCanonicalStoredComparison(comparison, canonical.comparisons.length + 1, now)],
      revision: state.revision + 1,
      updatedAt: now,
      seedVersion: canonical.seedVersion ?? currentSeedVersion(),
    };
  };
  if (!shouldUseFirestore()) {
    const now = new Date().toISOString();
    await writeRawUserDocument(user, append(await getStoredUserState(user), now));
    return;
  }
  await database().runTransaction(async (transaction) => {
    const reference = userDocument(user);
    const snapshot = await transaction.get(reference);
    transaction.set(reference, append(readStoredUserState(snapshot.data() ?? {}), new Date().toISOString()), { merge: true });
  });
};

function sameOfferedActivities(pending: PendingComparison, comparison: Comparison): boolean {
  return new Set([pending.activityA, pending.activityB]).size === 2
    && new Set([comparison.activityA, comparison.activityB]).size === 2
    && pending.activityA !== pending.activityB
    && [pending.activityA, pending.activityB].every((activityId) => activityId === comparison.activityA || activityId === comparison.activityB);
}

function isPendingExpired(pending: PendingComparison, now: number): boolean {
  if (pending.issuedAt === LEGACY_TIMESTAMP) return true;
  const issuedAt = Date.parse(pending.issuedAt);
  return !Number.isFinite(issuedAt) || now - issuedAt >= PENDING_COMPARISON_TTL_MS;
}

/**
 * Claims exactly the currently-issued pair and appends it in the same durable
 * operation. A conflict never clears/replaces pending state or appends a
 * partial answer, so callers may safely render a 409 and fetch a fresh pair.
 */
function claimPendingAndAppend(
  state: StoredUserState,
  input: PendingClaimInput,
  now: string,
): StoredUserState {
  const parsed = comparisonSchema.safeParse(input);
  if (!parsed.success || !Number.isInteger(input.revision) || input.revision < 0) {
    throw new StoreDataError('Cannot claim an invalid comparison.');
  }
  assertStateSeedVersionCompatible(state);
  if (state.completedAt) throw new StoreConflictError('completed', 'Cannot append a comparison after completion.');
  if (!state.pending) throw new StoreConflictError('pending-missing', 'No comparison is currently offered.');
  if (isPendingExpired(state.pending, Date.parse(now))) {
    throw new StoreConflictError('pending-expired', 'The offered comparison has expired.');
  }
  if (state.pending.revision !== state.revision || input.revision !== state.revision) {
    throw new StoreConflictError('pending-revision-mismatch', 'The offered comparison is stale.');
  }
  if (!sameOfferedActivities(state.pending, parsed.data)) {
    throw new StoreConflictError('pending-offered-mismatch', 'That comparison was not offered.');
  }

  const canonical = normalizeForWrite(state);
  return {
    ...canonical,
    comparisons: [
      ...canonical.comparisons,
      toCanonicalStoredComparison(parsed.data, canonical.comparisons.length + 1, now, state.pending.selectorVersion),
    ],
    pending: null,
    revision: canonical.revision + 1,
    updatedAt: now,
    seedVersion: canonical.seedVersion ?? currentSeedVersion(),
  };
}

/**
 * The only safe answer write for the new API path. It is intentionally
 * additive while legacy routes still use takePending/addComparison.
 */
export const claimPendingAndAppendComparison = async (user: RosterUser, input: PendingClaimInput): Promise<StoredComparison> => {
  if (!shouldUseFirestore()) {
    return withMemoryUserLock(user, () => {
      const state = readStoredUserState(memoryUsers.get(user) ?? {});
      const next = claimPendingAndAppend(state, input, new Date().toISOString());
      memoryUsers.set(user, next);
      return next.comparisons.at(-1)!;
    });
  }
  return database().runTransaction(async (transaction) => {
    const reference = userDocument(user);
    const snapshot = await transaction.get(reference);
    const next = claimPendingAndAppend(readStoredUserState(snapshot.data() ?? {}), input, new Date().toISOString());
    transaction.set(reference, next, { merge: true });
    return next.comparisons.at(-1)!;
  });
};

export const isRevealOpen = async () => {
  if (!shouldUseFirestore()) return memoryRevealState.open;
  return readRevealState((await revealDocument().get()).data()).open;
};
export const openReveal = async () => {
  const now = new Date().toISOString();
  if (!shouldUseFirestore()) {
    await withMemoryRevealLock(() => {
      // Kept for current route compatibility. It deliberately does not invent
      // a result snapshot; the promoted reveal flow calls createOrGetRevealSnapshot.
      memoryRevealState = { ...memoryRevealState, open: true, openedAt: now };
    });
    return;
  }
  // Merge preserves a snapshot written by the new path if an older caller
  // invokes this backwards-compatible helper later.
  await revealDocument().set({ open: true, openedAt: now }, { merge: true });
};

/** Reads the immutable snapshot selected by the reveal gate, if one exists. */
export const getRevealSnapshot = async (): Promise<StoredRevealSnapshot | undefined> => {
  if (!shouldUseFirestore()) {
    if (!memoryRevealState.open) return undefined;
    const snapshotId = memoryRevealState.snapshotId;
    if (!snapshotId) return undefined;
    const snapshot = memoryResultSnapshots.get(snapshotId);
    if (!snapshot) throw new StoreDataError(`Reveal references missing result snapshot ${snapshotId}.`);
    return readStoredRevealSnapshot(snapshotId, snapshot);
  }

  const state = readRevealState((await revealDocument().get()).data());
  if (!state.open) return undefined;
  if (!state.snapshotId) return undefined;
  const snapshot = await resultSnapshotDocument(state.snapshotId).get();
  if (!snapshot.exists) throw new StoreDataError(`Reveal references missing result snapshot ${state.snapshotId}.`);
  return readStoredRevealSnapshot(state.snapshotId, snapshot.data());
};

/**
 * Atomically creates the one visible group result or returns the snapshot that
 * is already public. A second call intentionally ignores its supplied model
 * summary: visible results must never be recalculated or reordered.
 */
export const createOrGetRevealSnapshot = async (input: RevealSnapshotInput): Promise<StoredRevealSnapshot> => {
  if (!shouldUseFirestore()) {
    return withMemoryRevealLock(() => {
      if (memoryRevealState.snapshotId) {
        const existing = memoryResultSnapshots.get(memoryRevealState.snapshotId);
        if (!existing) throw new StoreDataError(`Reveal references missing result snapshot ${memoryRevealState.snapshotId}.`);
        return readStoredRevealSnapshot(memoryRevealState.snapshotId, existing);
      }
      const now = new Date().toISOString();
      const snapshotId = `reveal-${randomUUID()}`;
      const snapshot = snapshotForWrite(input, now);
      memoryResultSnapshots.set(snapshotId, snapshot);
      memoryRevealState = { open: true, openedAt: now, snapshotId };
      return { snapshotId, ...snapshot };
    });
  }

  return database().runTransaction(async (transaction) => {
    const reveal = revealDocument();
    const state = readRevealState((await transaction.get(reveal)).data());
    if (state.snapshotId) {
      const existing = await transaction.get(resultSnapshotDocument(state.snapshotId));
      if (!existing.exists) throw new StoreDataError(`Reveal references missing result snapshot ${state.snapshotId}.`);
      return readStoredRevealSnapshot(state.snapshotId, existing.data());
    }

    const now = new Date().toISOString();
    const snapshotId = `reveal-${randomUUID()}`;
    const snapshot = snapshotForWrite(input, now);
    transaction.create(resultSnapshotDocument(snapshotId), snapshot);
    transaction.set(reveal, { open: true, openedAt: now, snapshotId }, { merge: true });
    return { snapshotId, ...snapshot };
  });
};

/** Test-only controls for validating adapter migration behavior without Firebase. */
export const __storeTest = {
  clearMemory() {
    memoryUsers.clear();
    memoryUserLocks.clear();
    memoryRevealState = { open: false };
    memoryResultSnapshots.clear();
    memoryRevealLock = Promise.resolve();
    testSeedVersionOverride = undefined;
  },
  setMemoryUserDocument(user: RosterUser, value: RawUserDocument) { memoryUsers.set(user, value); },
  getMemoryUserDocument(user: RosterUser): RawUserDocument | undefined { return memoryUsers.get(user); },
  getMemoryRevealState(): StoredRevealState { return structuredClone(memoryRevealState); },
  getMemorySnapshot(snapshotId: string): VersionedResultSnapshot | undefined { return memoryResultSnapshots.get(snapshotId); },
  setMemoryRevealSnapshot(snapshotId: string, value: VersionedResultSnapshot, openedAt = new Date().toISOString()) {
    memoryResultSnapshots.set(snapshotId, value);
    memoryRevealState = { open: true, openedAt, snapshotId };
  },
  setCurrentSeedVersion(version: string | undefined) { testSeedVersionOverride = version; },
};
