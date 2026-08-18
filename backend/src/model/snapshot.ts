import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** The three checked-in files whose content identifies a playable seed. */
export const CANONICAL_SEED_FILES = ['destinations.json', 'activities.json', 'activity-media.json'] as const;
export type CanonicalSeedFile = (typeof CANONICAL_SEED_FILES)[number];

export type CanonicalSeedContent = Readonly<Record<CanonicalSeedFile, unknown>>;

/**
 * The ranking input is a sequence, not a set. Timestamps are deliberately absent:
 * replay identity comes from the server-stored sequence and the semantic result of
 * each comparison, never from when a request happened to arrive.
 */
export type ComparisonDigestEntry = Readonly<{
  activityA: string;
  activityB: string;
  winner: string;
  revision?: number;
  selectorVersion?: string;
}>;

export type OrderedComparisonsByUser = Readonly<Record<string, readonly ComparisonDigestEntry[]>>;

type JsonValue = null | boolean | number | string | JsonValue[] | { readonly [key: string]: JsonValue };

function canonicalizeJsonValue(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON cannot contain a non-finite number.');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJsonValue).join(',')}]`;
  const record = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJsonValue(record[key]!)}`).join(',')}}`;
}

/** Stable JSON encoding with lexically ordered object keys and preserved array order. */
export function canonicalJson(value: unknown): string {
  return canonicalizeJsonValue(value as JsonValue);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Computes a content identity rather than a file-byte identity. Whitespace and
 * object-key ordering do not matter; a changed value in any canonical seed file
 * does. Including the filenames prevents equivalent values being swapped between
 * seed roles without changing the digest.
 */
export function createSeedVersion(seed: CanonicalSeedContent): string {
  return sha256(canonicalJson(Object.fromEntries(CANONICAL_SEED_FILES.map((file) => [file, seed[file]]))));
}

export function readCanonicalSeed(): CanonicalSeedContent {
  return Object.fromEntries(CANONICAL_SEED_FILES.map((file) => [
    file,
    JSON.parse(readFileSync(new URL(`../../../seed/${file}`, import.meta.url), 'utf8')),
  ])) as CanonicalSeedContent;
}

export function getSeedVersion(): string {
  return createSeedVersion(readCanonicalSeed());
}

function comparisonInput(entry: ComparisonDigestEntry, ordinal: number) {
  return {
    ordinal,
    activityA: entry.activityA,
    activityB: entry.activityB,
    winner: entry.winner,
    ...(entry.revision === undefined ? {} : { revision: entry.revision }),
    ...(entry.selectorVersion === undefined ? {} : { selectorVersion: entry.selectorVersion }),
  };
}

/**
 * Hashes semantic, ordered model inputs for every roster user. User keys and
 * object keys are canonicalized, while comparison-array order is retained. This
 * makes a replay order change observable without introducing wall-clock input.
 */
export function createInputDigest(comparisonsByUser: OrderedComparisonsByUser): string {
  const orderedUsers = Object.keys(comparisonsByUser).sort().map((user) => ({
    user,
    comparisons: comparisonsByUser[user]!.map(comparisonInput),
  }));
  return sha256(canonicalJson({ comparisons: orderedUsers }));
}

export function createUserInputDigest(user: string, comparisons: readonly ComparisonDigestEntry[]): string {
  return createInputDigest({ [user]: comparisons });
}
