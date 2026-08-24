import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  LIGHTNING_MODEL_VERSION,
  LIGHTNING_POLICY_VERSION,
  lightningVetoSubmissionSchema,
  lightningComparisonSchema,
  lightningDestinationBriefSchema,
  lightningGroupResultsSchema,
  rosterUserSchema,
  type LightningComparison,
  type LightningDestinationBrief,
  type LightningGroupResults,
  type RosterUser,
} from '@lgs/shared';
import { ROSTER, StoreConflictError, StoreDataError, getRevealSnapshot } from '../store.js';
import { shouldUseFirestore } from '../runtime.js';

export const LIGHTNING_PENDING_TTL_MS = 10 * 60 * 1000;
const lightningSeedSchema = z.object({
  id: z.string(), name: z.string(), country: z.string(), photoPath: z.string(), shortPitch: z.string(), highlights: z.array(z.string()).length(3),
  weather: z.object({ typicalHighF: z.number().int(), typicalLowF: z.number().int(), note: z.string() }),
  airfare: z.object({ dc: z.number().int(), nyc: z.number().int(), sfo: z.number().int(), qualifier: z.string() }),
  travel: z.object({ effort: z.number().int(), description: z.string() }), caveat: z.string(), researchedAt: z.string().date(),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })).min(1),
}).strict();
const rawLightningDestinations = lightningSeedSchema.array().length(24).parse(JSON.parse(readFileSync(new URL('../../../seed/lightning-round/destination-briefs.json', import.meta.url), 'utf8')));
export const lightningDestinations = rawLightningDestinations.map((destination) => lightningDestinationBriefSchema.parse({
  id: destination.id, name: destination.name, country: destination.country, imageUrl: destination.photoPath, pitch: destination.shortPitch,
  highlights: destination.highlights.map((detail, index) => ({ title: `Plan ${index + 1}`, detail })),
  weather: destination.weather, travel: { effort: destination.travel.effort, summary: destination.travel.description, fares: { dc: destination.airfare.dc, nyc: destination.airfare.nyc, sfo: destination.airfare.sfo }, fareNote: destination.airfare.qualifier },
  caveat: destination.caveat, researchedAt: destination.researchedAt, sources: destination.sources.map((source) => ({ label: source.title, url: source.url })),
})) as LightningDestinationBrief[];
export const lightningDestinationById = new Map(lightningDestinations.map((destination) => [destination.id, destination]));
export const lightningContentVersion = createHash('sha256').update(JSON.stringify(lightningDestinations)).update(LIGHTNING_MODEL_VERSION).update(LIGHTNING_POLICY_VERSION).digest('hex');

export type StoredLightningComparison = LightningComparison & { ordinal: number; createdAt: string; selectorVersion: string };
export type PendingLightningComparison = { destinationA: string; destinationB: string; issuedAt: string; revision: number; selectorVersion: string };
export type LightningUserState = {
  comparisons: StoredLightningComparison[];
  pending: PendingLightningComparison | null;
  revision: number;
  completedAt?: string;
  /** Undefined until the traveler explicitly submits the zero-to-four veto step. */
  vetoedDestinationIds?: string[];
  vetoSubmittedAt?: string;
  updatedAt?: string;
  contentVersion?: string;
};
type LightningRoundState = { contentVersion?: string; openedAt?: string; snapshotId?: string; updatedAt?: string };

const db = () => { if (!getApps().length) initializeApp(); return getFirestore(); };
const userDoc = (user: RosterUser) => db().collection('lgsV4LightningUsers').doc(user);
const roundDoc = () => db().collection('lgsV4LightningState').doc('round');
const snapshotDoc = (id: string) => db().collection('lgsV4LightningResultSnapshots').doc(id);

const userMemory = new Map<RosterUser, LightningUserState>();
let roundMemory: LightningRoundState = {};
const snapshotsMemory = new Map<string, unknown>();
let revealLock: Promise<void> = Promise.resolve();
const locks = new Map<RosterUser, Promise<void>>();

function invalid(message: string): never { throw new StoreDataError(`Invalid Lightning Round data: ${message}`); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function readState(value: unknown): LightningUserState {
  const raw = isObject(value) ? value : {};
  const comparisonsRaw = raw.comparisons ?? [];
  if (!Array.isArray(comparisonsRaw)) invalid('comparisons must be an array');
  const comparisons = comparisonsRaw.map((item, index) => {
    if (!isObject(item)) invalid(`comparison ${index + 1}`);
    const { ordinal, createdAt, selectorVersion, ...storedComparison } = item;
    const parsed = lightningComparisonSchema.safeParse(storedComparison);
    if (!parsed.success || typeof ordinal !== 'number' || ordinal !== index + 1 || typeof createdAt !== 'string' || typeof selectorVersion !== 'string') invalid(`comparison ${index + 1}`);
    return { ...parsed.data, ordinal, createdAt, selectorVersion };
  });
  const revision = typeof raw.revision === 'number' && Number.isInteger(raw.revision) ? raw.revision : comparisons.length;
  if (revision < comparisons.length) invalid('revision is behind comparisons');
  const pendingRaw = raw.pending;
  const pending = pendingRaw == null ? null : (() => {
    if (!isObject(pendingRaw) || typeof pendingRaw.destinationA !== 'string' || typeof pendingRaw.destinationB !== 'string' || pendingRaw.destinationA === pendingRaw.destinationB || typeof pendingRaw.issuedAt !== 'string' || typeof pendingRaw.revision !== 'number' || typeof pendingRaw.selectorVersion !== 'string') invalid('pending comparison');
    return { destinationA: pendingRaw.destinationA, destinationB: pendingRaw.destinationB, issuedAt: pendingRaw.issuedAt, revision: pendingRaw.revision, selectorVersion: pendingRaw.selectorVersion };
  })();
  if (pending && pending.revision !== revision) invalid('pending revision');
  const hasVetoIds = Object.hasOwn(raw, 'vetoedDestinationIds');
  const hasVetoSubmittedAt = Object.hasOwn(raw, 'vetoSubmittedAt');
  if (hasVetoIds !== hasVetoSubmittedAt) invalid('vetoes must include both choices and submission time');
  const vetoedDestinationIds = hasVetoIds ? (() => {
    const parsed = lightningVetoSubmissionSchema.safeParse({ destinationIds: raw.vetoedDestinationIds });
    if (!parsed.success || parsed.data.destinationIds.some((id) => !lightningDestinationById.has(id))) invalid('veto destinations');
    return [...parsed.data.destinationIds].sort((left, right) => left.localeCompare(right));
  })() : undefined;
  if (hasVetoSubmittedAt && typeof raw.vetoSubmittedAt !== 'string') invalid('veto submission time');
  return {
    comparisons,
    pending,
    revision,
    ...(typeof raw.completedAt === 'string' ? { completedAt: raw.completedAt } : {}),
    ...(vetoedDestinationIds ? { vetoedDestinationIds } : {}),
    ...(typeof raw.vetoSubmittedAt === 'string' ? { vetoSubmittedAt: raw.vetoSubmittedAt } : {}),
    ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {}),
    ...(typeof raw.contentVersion === 'string' ? { contentVersion: raw.contentVersion } : {}),
  };
}
function readRound(value: unknown): LightningRoundState {
  if (!isObject(value)) return {};
  return { ...(typeof value.contentVersion === 'string' ? { contentVersion: value.contentVersion } : {}), ...(typeof value.openedAt === 'string' ? { openedAt: value.openedAt } : {}), ...(typeof value.snapshotId === 'string' ? { snapshotId: value.snapshotId } : {}), ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}) };
}
function validateVersion(state: LightningUserState) {
  if (state.comparisons.length > 0 && state.contentVersion !== lightningContentVersion) throw new StoreDataError('This Lightning Round was started with different trip details. Ask Dan for help.');
}
async function lockUser<T>(user: RosterUser, task: () => Promise<T> | T): Promise<T> {
  const previous = locks.get(user) ?? Promise.resolve(); let release!: () => void; const current = new Promise<void>((resolve) => { release = resolve; }); locks.set(user, current); await previous;
  try { return await task(); } finally { release(); if (locks.get(user) === current) locks.delete(user); }
}
async function lockReveal<T>(task: () => Promise<T> | T): Promise<T> { const previous = revealLock; let release!: () => void; revealLock = new Promise<void>((resolve) => { release = resolve; }); await previous; try { return await task(); } finally { release(); } }
async function readRaw(user: RosterUser) { return shouldUseFirestore() ? (await userDoc(user).get()).data() ?? {} : userMemory.get(user) ?? { comparisons: [], pending: null, revision: 0 }; }

/** Requires that the original immutable envelope is already open, then freezes this round's own content identity. */
export async function ensureLightningRound(): Promise<LightningRoundState> {
  const original = await getRevealSnapshot();
  if (!original) throw new StoreConflictError('pending-missing', 'Open the first group envelope before starting the Lightning Round.');
  const ensure = (raw: unknown, now: string) => { const state = readRound(raw); if (state.contentVersion && state.contentVersion !== lightningContentVersion) throw new StoreDataError('Lightning Round trip details no longer match the frozen round.'); return { ...state, contentVersion: state.contentVersion ?? lightningContentVersion, updatedAt: now }; };
  if (!shouldUseFirestore()) return lockReveal(() => { roundMemory = ensure(roundMemory, new Date().toISOString()); return roundMemory; });
  return db().runTransaction(async (transaction) => { const ref = roundDoc(); const next = ensure((await transaction.get(ref)).data() ?? {}, new Date().toISOString()); transaction.set(ref, next, { merge: true }); return next; });
}
export async function getLightningState(user: RosterUser): Promise<LightningUserState> { const state = readState(await readRaw(user)); validateVersion(state); return state; }
export async function issueLightningPending(user: RosterUser, pair: readonly [string, string]) {
  await ensureLightningRound();
  const apply = (raw: unknown, now: string) => { const state = readState(raw); validateVersion(state); if (state.completedAt) throw new StoreConflictError('completed', 'This Lightning Round is complete.'); return { ...state, pending: { destinationA: pair[0], destinationB: pair[1], issuedAt: now, revision: state.revision, selectorVersion: LIGHTNING_POLICY_VERSION }, updatedAt: now, contentVersion: state.contentVersion ?? lightningContentVersion }; };
  if (!shouldUseFirestore()) return lockUser(user, () => { const next = apply(userMemory.get(user) ?? {}, new Date().toISOString()); userMemory.set(user, next); });
  return db().runTransaction(async (transaction) => { const ref = userDoc(user); const next = apply((await transaction.get(ref)).data() ?? {}, new Date().toISOString()); transaction.set(ref, next, { merge: true }); });
}
export async function claimLightningComparison(user: RosterUser, input: LightningComparison & { revision: number }, complete: boolean): Promise<StoredLightningComparison> {
  await ensureLightningRound();
  const apply = (raw: unknown, now: string) => {
    const state = readState(raw); validateVersion(state);
    const { revision, ...submittedComparison } = input;
    const parsed = lightningComparisonSchema.safeParse(submittedComparison); if (!parsed.success) invalid('submitted direct comparison');
    if (state.completedAt) throw new StoreConflictError('completed', 'This Lightning Round is complete.');
    if (!state.pending) throw new StoreConflictError('pending-missing', 'No direct comparison is currently offered.');
    if (Date.parse(state.pending.issuedAt) + LIGHTNING_PENDING_TTL_MS < Date.parse(now)) throw new StoreConflictError('pending-expired', 'That direct comparison has expired.');
    if (state.pending.revision !== state.revision || revision !== state.revision) throw new StoreConflictError('pending-revision-mismatch', 'That direct comparison is stale.');
    const offered = new Set([state.pending.destinationA, state.pending.destinationB]);
    if (!offered.has(parsed.data.destinationA) || !offered.has(parsed.data.destinationB)) throw new StoreConflictError('pending-offered-mismatch', 'That direct comparison was not offered.');
    const comparison: StoredLightningComparison = { ...parsed.data, ordinal: state.comparisons.length + 1, createdAt: now, selectorVersion: state.pending.selectorVersion };
    const next: LightningUserState = { ...state, comparisons: [...state.comparisons, comparison], pending: null, revision: state.revision + 1, updatedAt: now, contentVersion: state.contentVersion ?? lightningContentVersion, ...(complete ? { completedAt: now } : {}) };
    return { next, comparison };
  };
  if (!shouldUseFirestore()) return lockUser(user, () => { const { next, comparison } = apply(userMemory.get(user) ?? {}, new Date().toISOString()); userMemory.set(user, next); return comparison; });
  return db().runTransaction(async (transaction) => { const ref = userDoc(user); const { next, comparison } = apply((await transaction.get(ref)).data() ?? {}, new Date().toISOString()); transaction.set(ref, next, { merge: true }); return comparison; });
}
/**
 * Persists a finished traveler's explicit zero-to-four veto decision. The
 * caller verifies direct-ranking completion; the store owns canonicalization,
 * idempotent retry behavior, and the immutable post-submit boundary.
 */
export async function submitLightningVetoes(user: RosterUser, destinationIds: readonly string[], rankingComplete: boolean) {
  await ensureLightningRound();
  if (!rankingComplete) throw new StoreConflictError('veto-ranking-incomplete', 'Finish your direct destination choices before choosing vetoes.');
  if (await getLightningRevealSnapshot()) throw new StoreConflictError('veto-reveal-open', 'The second envelope is already open, so vetoes can no longer change.');
  const parsed = lightningVetoSubmissionSchema.safeParse({ destinationIds });
  if (!parsed.success || parsed.data.destinationIds.some((id) => !lightningDestinationById.has(id))) invalid('submitted vetoes');
  const canonicalIds = [...parsed.data.destinationIds].sort((left, right) => left.localeCompare(right));
  const apply = (raw: unknown, now: string) => {
    const state = readState(raw); validateVersion(state);
    if (!state.completedAt) throw new StoreConflictError('veto-ranking-incomplete', 'Finish your direct destination choices before choosing vetoes.');
    if (state.vetoSubmittedAt) {
      const existing = state.vetoedDestinationIds ?? [];
      if (existing.length === canonicalIds.length && existing.every((id, index) => id === canonicalIds[index])) return existing;
      throw new StoreConflictError('veto-submitted', 'Your vetoes are already saved and cannot be changed.');
    }
    const next: LightningUserState = {
      ...state,
      vetoedDestinationIds: canonicalIds,
      vetoSubmittedAt: now,
      updatedAt: now,
      contentVersion: state.contentVersion ?? lightningContentVersion,
    };
    return { next, destinationIds: canonicalIds };
  };
  if (!shouldUseFirestore()) return lockUser(user, () => {
    const outcome = apply(userMemory.get(user) ?? {}, new Date().toISOString());
    if (Array.isArray(outcome)) return outcome;
    userMemory.set(user, outcome.next);
    return outcome.destinationIds;
  });
  return db().runTransaction(async (transaction) => {
    const ref = userDoc(user);
    const outcome = apply((await transaction.get(ref)).data() ?? {}, new Date().toISOString());
    if (Array.isArray(outcome)) return outcome;
    transaction.set(ref, outcome.next, { merge: true });
    return outcome.destinationIds;
  });
}
export async function getAllLightningStates() { return Object.fromEntries(await Promise.all(ROSTER.map(async (user) => [user, await getLightningState(user)]))) as Record<RosterUser, LightningUserState>; }
function withLegacyEmptyVetoes(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const members = Array.isArray(raw.members) ? raw.members.map((member) => isObject(member) && !Object.hasOwn(member, 'vetoedDestinationIds') ? { ...member, vetoedDestinationIds: [] } : member) : raw.members;
  const group = Array.isArray(raw.group) ? raw.group.map((row) => isObject(row) && !Object.hasOwn(row, 'vetoedBy') ? { ...row, vetoedBy: [] } : row) : raw.group;
  return { ...raw, members, group };
}
export async function getLightningRevealSnapshot(): Promise<LightningGroupResults | undefined> {
  const state = shouldUseFirestore() ? readRound((await roundDoc().get()).data() ?? {}) : roundMemory;
  if (!state.snapshotId) return undefined;
  const raw = shouldUseFirestore() ? (await snapshotDoc(state.snapshotId).get()).data() : snapshotsMemory.get(state.snapshotId);
  if (!raw) invalid('missing second envelope');
  return lightningGroupResultsSchema.parse({ ...withLegacyEmptyVetoes(raw) as Record<string, unknown>, snapshotId: state.snapshotId });
}
export async function createOrGetLightningRevealSnapshot(build: () => LightningGroupResults): Promise<LightningGroupResults> {
  await ensureLightningRound();
  if (!shouldUseFirestore()) return lockReveal(() => { if (roundMemory.snapshotId) return getLightningRevealSnapshot() as Promise<LightningGroupResults>; const result = build(); const id = `lightning-${randomUUID()}`; const payload = lightningGroupResultsSchema.parse({ ...result, snapshotId: id }); snapshotsMemory.set(id, payload); roundMemory = { ...roundMemory, snapshotId: id, openedAt: new Date().toISOString() }; return payload; });
  return db().runTransaction(async (transaction) => { const stateRef = roundDoc(); const state = readRound((await transaction.get(stateRef)).data() ?? {}); if (state.snapshotId) { const existing = await transaction.get(snapshotDoc(state.snapshotId)); if (!existing.exists) invalid('missing second envelope'); return lightningGroupResultsSchema.parse({ ...withLegacyEmptyVetoes(existing.data()) as Record<string, unknown>, snapshotId: state.snapshotId }); } const id = `lightning-${randomUUID()}`; const result = build(); const payload = lightningGroupResultsSchema.parse({ ...result, snapshotId: id }); transaction.create(snapshotDoc(id), payload); transaction.set(stateRef, { ...state, snapshotId: id, openedAt: new Date().toISOString(), contentVersion: lightningContentVersion }, { merge: true }); return payload; });
}
export const __lightningStoreTest = {
  clearMemory() { userMemory.clear(); snapshotsMemory.clear(); roundMemory = {}; locks.clear(); revealLock = Promise.resolve(); },
  setMemoryState(user: RosterUser, state: LightningUserState) { userMemory.set(rosterUserSchema.parse(user), state); },
  setMemorySnapshot(id: string, snapshot: unknown) { snapshotsMemory.set(id, snapshot); roundMemory = { ...roundMemory, snapshotId: id }; },
};
