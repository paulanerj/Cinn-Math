// [ROLE] Tile value generator for GridMath boards.
// SpawnEngine creates the numeric values that populate grid tiles at session
// start and after tiles are cleared. It knows nothing about React or the DOM —
// it only produces numbers and boolean flags.
//
// [WHY] Separating spawn logic from board state management (GridEngine) keeps
// each module testable in isolation. SpawnEngine is a pure function of its
// inputs: profile + PRNG → value. GridEngine consumes SpawnEngine via a
// factory function argument so it never has a hard dependency.
//
// [FUTURE] When a new game type needs a different spawn distribution (e.g.
// fraction tiles, emoji tiles, operator tiles), add a new factory here
// and pass it to GridEngine at game startup.
//
// [LLM NOTE] All public functions here are pure: same inputs → same outputs.
// Do not add side effects, React state, or DOM access.
//
// [INVARIANT] spawnNumber always returns an integer in [profile.tileMin, profile.tileMax].
//             isBonus returns true with probability exactly profile.bonusTileProbability.

import type { PracticeProfile } from './PracticeProfile';
import { randomInt } from './rng';

/** The raw data produced by SpawnEngine for one tile cell. */
export interface SpawnedTile {
  /** The numeric value displayed on the tile. */
  value: number;
  /**
   * True if this tile carries a bonus effect (time bonus, score multiplier, etc.).
   * Bonus tile semantics are game-defined — SpawnEngine only sets the flag.
   */
  isBonus: boolean;
}

/**
 * Spawns a single tile value appropriate for the given profile.
 *
 * @param profile  The active practice profile controlling value range and bonus rate.
 * @param prng     The session's seeded PRNG. Advances the generator by 2 calls.
 */
export function spawnTile(profile: PracticeProfile, prng: () => number): SpawnedTile {
  const value = randomInt(prng, profile.tileMin, profile.tileMax);
  const isBonus = prng() < profile.bonusTileProbability;
  return { value, isBonus };
}

/**
 * Fills a rows×cols grid with freshly spawned tile values.
 * Returns a flat row-major array of SpawnedTile, indexed as [row * cols + col].
 *
 * [INVARIANT] rows ≥ 1, cols ≥ 1. Result length === rows * cols.
 *
 * @param rows     Number of rows.
 * @param cols     Number of columns.
 * @param profile  Active practice profile.
 * @param prng     Session PRNG. Will be advanced rows*cols*2 times.
 */
export function spawnBoard(
  rows: number,
  cols: number,
  profile: PracticeProfile,
  prng: () => number,
): SpawnedTile[] {
  const tiles: SpawnedTile[] = [];
  for (let i = 0; i < rows * cols; i++) {
    tiles.push(spawnTile(profile, prng));
  }
  return tiles;
}

/**
 * Spawns values for a single column refill after gravity.
 * Returns an array of `count` SpawnedTile values, index 0 = topmost new tile.
 *
 * [INVARIANT] count ≥ 1.
 */
export function spawnColumn(
  count: number,
  profile: PracticeProfile,
  prng: () => number,
): SpawnedTile[] {
  const tiles: SpawnedTile[] = [];
  for (let i = 0; i < count; i++) {
    tiles.push(spawnTile(profile, prng));
  }
  return tiles;
}
