/**
 * Deterministic PRNG for the engine. The entire generator state is a single
 * uint32 stored in GameState.rngState, so it serializes as plain JSON.
 *
 * Algorithm: mulberry32, seeded from a string via the xmur3 hash. Every
 * function here is pure: it returns the drawn value AND the next rng state.
 * ALL game randomness (shuffles, coin flip, Monsters kept unit, Emhyr peek)
 * must go through these helpers — that is what makes "same seed + same move
 * sequence ⇒ deep-equal final state" hold.
 */

/** Hash an arbitrary seed string into a uint32 mulberry32 state. */
export function seedToRngState(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** One mulberry32 step → [float in [0,1), next state]. */
export function rngNext(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Uniform integer in [0, maxExclusive) → [value, next state]. */
export function rngInt(state: number, maxExclusive: number): [number, number] {
  if (maxExclusive <= 0) {
    throw new Error('rngInt: maxExclusive must be positive');
  }
  const [value, next] = rngNext(state);
  return [Math.floor(value * maxExclusive), next];
}

/** Fisher–Yates shuffle (returns a new array) → [shuffled, next state]. */
export function rngShuffle<T>(state: number, items: readonly T[]): [T[], number] {
  const result = items.slice();
  let s = state;
  for (let i = result.length - 1; i > 0; i--) {
    const [j, next] = rngInt(s, i + 1);
    s = next;
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return [result, s];
}

/** Pick n distinct random elements (order random) → [picked, next state]. */
export function rngPick<T>(state: number, items: readonly T[], n: number): [T[], number] {
  const [shuffled, next] = rngShuffle(state, items);
  return [shuffled.slice(0, Math.min(n, shuffled.length)), next];
}
