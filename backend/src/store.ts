import { readFileSync } from 'node:fs';
import type { Activity, Comparison, Destination } from '@lgs/shared';
import { activitySchema, destinationSchema } from '@lgs/shared';

export const destinations = destinationSchema.array().parse(JSON.parse(readFileSync(new URL('../../seed/destinations.json', import.meta.url), 'utf8'))) as Destination[];
export const activities = activitySchema.array().parse(JSON.parse(readFileSync(new URL('../../seed/activities.json', import.meta.url), 'utf8'))) as Activity[];
export const ROSTER = ['dan', 'james', 'john', 'matt', 'peter'] as const;
export type RosterUser = (typeof ROSTER)[number];
const comparisons = new Map<RosterUser, Comparison[]>();
const pending = new Map<RosterUser, [string, string]>();
let revealOpen = false;
export const getComparisons = (user: RosterUser) => comparisons.get(user) ?? [];
export const setPending = (user: RosterUser, pair: [string, string]) => pending.set(user, pair);
export const takePending = (user: RosterUser) => { const pair = pending.get(user); pending.delete(user); return pair; };
export const addComparison = (user: RosterUser, comparison: Comparison) => comparisons.set(user, [...getComparisons(user), comparison]);
export const isRevealOpen = () => revealOpen;
export const openReveal = () => { revealOpen = true; };
