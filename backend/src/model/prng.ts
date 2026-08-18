/** Platform-stable seed hashing, Mulberry32 PRNG, and Box–Muller normals. */
export type RandomSource = {
  next: () => number;
  normal: () => number;
  seed: number;
};

export function hashSeed(seed: string | number): number {
  const value = String(seed);
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 as a closure so each model operation owns an independent stream. */
export function createPrng(seedInput: string | number): RandomSource {
  const seed = hashSeed(seedInput);
  let state = seed;
  let spare: number | undefined;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
  const normal = () => {
    if (spare !== undefined) {
      const value = spare;
      spare = undefined;
      return value;
    }
    // Exclude zero so log() is finite. The exact branch is deterministic.
    const first = Math.max(next(), Number.MIN_VALUE);
    const second = next();
    const radius = Math.sqrt(-2 * Math.log(first));
    const angle = 2 * Math.PI * second;
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
  return { seed, next, normal };
}
