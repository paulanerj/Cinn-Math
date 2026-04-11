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

// ── Weighted spawn (Phase 6) ──────────────────────────────────────────────────

/**
 * Returns all integers v in [min, max] where v > 1 and target % v === 0.
 * Excludes 1 so that "value-1" tiles are handled by the separate explicit
 * probability bucket in spawnTileWeighted.
 */
function getFactors(target: number, min: number, max: number): number[] {
  const lo = Math.max(min, 2); // skip 1 — handled by explicit bucket
  const factors: number[] = [];
  for (let v = lo; v <= max; v++) {
    if (target % v === 0) factors.push(v);
  }
  return factors;
}

/**
 * Spawns a tile using the gameplay-weighted distribution:
 *
 *  10%  → value 1   (low-utility "filler" tiles; combines two ×5% spec slots
 *                    — the "value 0 / dead tile" slot is omitted because
 *                    board[r][c]=0 is the architecture's empty-cell sentinel
 *                    and cannot safely represent a live tile without a larger
 *                    refactor. Tracked as follow-up work.)
 *  50%  → a factor of `target` in (1, tileMax] ∩ [tileMin, tileMax]
 *  40%  → a non-factor of `target` in (1, tileMax] ∩ [tileMin, tileMax]
 *
 * Each call consumes exactly 3 PRNG values regardless of outcome so the
 * call-count stays portable across sessions (replay-safe).
 *
 * Falls back to a uniform pick from [tileMin, tileMax] if a category's
 * candidate list is empty (e.g. target is prime and the prime lies outside
 * the tile range → no factors available → fall back to uniform).
 *
 * @param target  The current round target value used to compute factor lists.
 * @param profile Active practice profile for tile range and bonus probability.
 * @param prng    Session PRNG. Advances by exactly 3 calls.
 */
export function spawnTileWeighted(
  target: number,
  profile: PracticeProfile,
  prng: () => number,
): SpawnedTile {
  const categoryRoll = prng(); // call 1 — always consumed
  const valueRoll    = prng(); // call 2 — always consumed
  const bonusRoll    = prng(); // call 3 — always consumed

  const { tileMin, tileMax, bonusTileProbability } = profile;
  let value: number;

  if (categoryRoll < 0.10) {
    // 10%: explicit value-1 tile
    value = 1;
  } else if (categoryRoll < 0.60) {
    // 50%: factor of target (excludes 1)
    const factors = getFactors(target, tileMin, tileMax);
    if (factors.length > 0) {
      value = factors[Math.floor(valueRoll * factors.length)];
    } else {
      // fallback: uniform over full profile range
      value = Math.floor(valueRoll * (tileMax - tileMin + 1)) + tileMin;
    }
  } else {
    // 40%: non-factor of target (excludes 1)
    const factorSet = new Set(getFactors(target, tileMin, tileMax));
    const nonFactors: number[] = [];
    const lo = Math.max(tileMin, 2);
    for (let v = lo; v <= tileMax; v++) {
      if (!factorSet.has(v)) nonFactors.push(v);
    }
    if (nonFactors.length > 0) {
      value = nonFactors[Math.floor(valueRoll * nonFactors.length)];
    } else {
      // fallback: uniform over full profile range
      value = Math.floor(valueRoll * (tileMax - tileMin + 1)) + tileMin;
    }
  }

  return { value, isBonus: bonusRoll < bonusTileProbability };
}
