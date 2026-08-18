import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SEED_FILES,
  canonicalJson,
  createInputDigest,
  createSeedVersion,
  getSeedVersion,
  readCanonicalSeed,
} from '../src/model/snapshot.js';

describe('model snapshots', () => {
  it('canonicalizes object keys while preserving array order', () => {
    expect(canonicalJson({ second: [2, { z: true, a: null }], first: 'yes' }))
      .toBe(canonicalJson({ first: 'yes', second: [2, { a: null, z: true }] }));
    expect(canonicalJson(['first', 'second'])).not.toBe(canonicalJson(['second', 'first']));
  });

  it('includes all three checked-in seed sources in a stable seed version', () => {
    const seed = readCanonicalSeed();
    expect(CANONICAL_SEED_FILES).toEqual(['destinations.json', 'activities.json', 'activity-media.json']);
    expect(createSeedVersion(seed)).toBe(createSeedVersion({
      'activity-media.json': seed['activity-media.json'],
      'destinations.json': seed['destinations.json'],
      'activities.json': seed['activities.json'],
    }));
    expect(getSeedVersion()).toBe(createSeedVersion(seed));

    for (const file of CANONICAL_SEED_FILES) {
      const changed = structuredClone(seed) as Record<string, unknown>;
      changed[file] = { changed: file, original: changed[file] };
      expect(createSeedVersion(changed as typeof seed)).not.toBe(createSeedVersion(seed));
      expect(JSON.parse(readFileSync(new URL(`../../seed/${file}`, import.meta.url), 'utf8'))).toBeDefined();
    }
  });

  it('is stable across user/object key order but observes ordered comparison input', () => {
    const danChoices = [
      { activityA: 'a', activityB: 'b', winner: 'a', selectorVersion: 'information-gain-v1', revision: 1 },
      { activityA: 'c', activityB: 'd', winner: 'd', selectorVersion: 'information-gain-v1', revision: 2 },
    ] as const;
    const jamesChoices = [{ activityA: 'e', activityB: 'f', winner: 'f' }] as const;
    const first = createInputDigest({ dan: danChoices, james: jamesChoices });
    expect(first).toBe(createInputDigest({ james: jamesChoices, dan: danChoices }));
    expect(first).not.toBe(createInputDigest({ dan: [...danChoices].reverse(), james: jamesChoices }));
    expect(first).not.toBe(createInputDigest({ dan: [{ ...danChoices[0], winner: 'b' }, danChoices[1]], james: jamesChoices }));
  });

  it('does not add a wall-clock timestamp to the semantic comparison digest', () => {
    const comparison = { activityA: 'a', activityB: 'b', winner: 'a' } as const;
    expect(createInputDigest({ dan: [comparison] })).toBe(createInputDigest({ dan: [comparison] }));
  });
});
