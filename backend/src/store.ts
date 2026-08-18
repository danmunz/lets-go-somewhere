import { readFileSync } from 'node:fs';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Activity, Comparison, Destination } from '@lgs/shared';
import { activitySchema, destinationSchema } from '@lgs/shared';

export const destinations = destinationSchema.array().parse(JSON.parse(readFileSync(new URL('../../seed/destinations.json', import.meta.url), 'utf8'))) as Destination[];
export const activities = activitySchema.array().parse(JSON.parse(readFileSync(new URL('../../seed/activities.json', import.meta.url), 'utf8'))) as Activity[];
export const ROSTER = ['dan', 'james', 'john', 'matt', 'peter'] as const;
export type RosterUser = (typeof ROSTER)[number];
const comparisons = new Map<RosterUser, Comparison[]>();
const pending = new Map<RosterUser, [string, string]>();
let revealOpen = false;
// Cloud Run always supplies K_SERVICE. Keep the in-memory adapter for the local
// browser harness and deterministic tests, but never let a production instance
// silently fall back to process memory because NODE_ENV was omitted.
const useFirestore = () => process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE);
const database = () => { if (!getApps().length) initializeApp(); return getFirestore(); };
const userDocument = (user: RosterUser) => database().collection('lgsV4Users').doc(user);

export const getComparisons = async (user: RosterUser): Promise<Comparison[]> => {
  if (!useFirestore()) return comparisons.get(user) ?? [];
  return ((await userDocument(user).get()).data()?.comparisons ?? []) as Comparison[];
};
export const getAllComparisons = async (): Promise<Record<RosterUser, Comparison[]>> => Object.fromEntries(await Promise.all(ROSTER.map(async (user) => [user, await getComparisons(user)]))) as Record<RosterUser, Comparison[]>;
export const setPending = async (user: RosterUser, pair: [string, string]) => {
  if (!useFirestore()) { pending.set(user, pair); return; }
  await userDocument(user).set({ pending: pair }, { merge: true });
};
export const takePending = async (user: RosterUser): Promise<[string, string] | undefined> => {
  if (!useFirestore()) { const pair = pending.get(user); pending.delete(user); return pair; }
  return database().runTransaction(async (transaction) => {
    const reference = userDocument(user), snapshot = await transaction.get(reference), pair = snapshot.data()?.pending as [string, string] | undefined;
    transaction.set(reference, { pending: null }, { merge: true });
    return pair;
  });
};
export const addComparison = async (user: RosterUser, comparison: Comparison) => {
  if (!useFirestore()) { comparisons.set(user, [...await getComparisons(user), comparison]); return; }
  await database().runTransaction(async (transaction) => {
    const reference = userDocument(user), snapshot = await transaction.get(reference), existing = (snapshot.data()?.comparisons ?? []) as Comparison[];
    transaction.set(reference, { comparisons: [...existing, comparison], updatedAt: new Date().toISOString() }, { merge: true });
  });
};
export const isRevealOpen = async () => {
  if (!useFirestore()) return revealOpen;
  return Boolean((await database().collection('lgsV4State').doc('reveal').get()).data()?.open);
};
export const openReveal = async () => {
  if (!useFirestore()) { revealOpen = true; return; }
  await database().collection('lgsV4State').doc('reveal').set({ open: true, openedAt: new Date().toISOString() });
};
