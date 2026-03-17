// [ROLE] Seeded pseudo-random number generator (PRNG) for the GridMath engine.
// All game-logic randomness (tile spawning, target generation, board shuffling)
// must go through this module so that sessions are fully reproducible for
// replay and testing.
//
// [WHY] JavaScript's Math.random() is non-deterministic and cannot be seeded.
// Using a seeded PRNG means that any game session can be re-run identically
// from its seed — enabling replay, deterministic testing, and undo stacks.
//
// [FUTURE] If a new game mode requires reproducible random sequences with
// different statistical properties, add a new factory here (e.g. makeGaussianPrng)
// without changing makePrng, which is already relied on by existing games.
//
// [LLM NOTE] Do not replace the mulberry32 algorithm with Math.random() or any
// other non-deterministic source. The replay system depends on this being a
// pure function of its seed.
//
// [INVARIANT] makePrng() returns a function that produces values in [0, 1).
//             Successive calls advance the generator's internal state.
//             Two generators created with the same seed produce identical sequences.

/**
 * Creates a mulberry32 seeded PRNG.
 * Mulberry32 is fast, statistically sound, and widely used in game engines.
 *
 * @param seed  A 32-bit integer seed. Use randomSeed() to generate one at
 *              session start and store it in the session record.
 * @returns  A function that returns a float in [0, 1) on each call.
 */
export function makePrng(seed: number): () => number {
  // mulberry32 — state is a single 32-bit integer
  let s = seed | 0;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

/**
 * Generates a random 32-bit integer suitable as a PRNG seed.
 * This is the only place in the engine where Math.random() is used.
 * Call this once at session creation and store the result in the session record.
 */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) | 0;
}

/**
 * Returns a random integer in the inclusive range [min, max] using the given PRNG.
 *
 * [INVARIANT] min and max must be integers. min ≤ max.
 */
export function randomInt(prng: () => number, min: number, max: number): number {
  return Math.floor(prng() * (max - min + 1)) + min;
}

/**
 * Returns a random element from a non-empty array using the given PRNG.
 *
 * [INVARIANT] arr must have length ≥ 1.
 */
export function randomPick<T>(prng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(prng() * arr.length)];
}

/**
 * Returns a new array with the elements of `arr` in a deterministic random
 * order, using a Fisher-Yates (Knuth) shuffle driven by `prng`.
 *
 * Consumes exactly `arr.length - 1` PRNG calls regardless of array content
 * or JavaScript engine — call count is portable across V8, SpiderMonkey, etc.
 * This is the required replacement for `[...arr].sort(() => prng() - 0.5)`,
 * whose comparator call count is JS-engine-defined and non-deterministic.
 *
 * [INVARIANT] arr is not mutated. A fresh array is returned.
 * [INVARIANT] For arr.length ≤ 1, returns a shallow copy with 0 PRNG calls.
 */
export function randomShuffle<T>(prng: () => number, arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}
