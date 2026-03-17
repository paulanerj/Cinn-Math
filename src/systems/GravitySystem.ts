// ─────────────────────────────────────────────────────────────────────────────
// src/systems/GravitySystem.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Generic downward-gravity mechanic for any grid-based game on this
//        platform. Takes a board with cleared cells (value 0) and produces a
//        compacted board plus metadata about every tile movement and spawn.
//
// [WHY]  Every grid-based math game on this platform needs gravity: after
//        tiles are removed, the remaining tiles fall and new ones fill the top.
//        Centralising this here means CombineGrid, SpeedGrid, DestroyGrid, and
//        any future game all get identical, tested gravity behaviour without
//        each reimplementing it.
//
// [FUTURE] If a future game needs sideways gravity, anti-gravity, or per-column
//          gravity direction, add a `gravityDir` parameter to applyGravity()
//          and branch the loop. Do NOT add the new direction to the existing
//          downward implementation — keep them separate.
//
// [LLM NOTE] This module imports only from the engine layer. It must never
//            import React, DOM APIs, platform UI, or game files. The returned
//            data structures are plain objects — animation rendering is the
//            responsibility of GravityAnimator.ts (one level above, in the
//            game component).
//
// [INVARIANT] The grid uses 0 to represent an empty cell. A non-zero value
//             is a live tile. applyGravity() reads 0s as "cleared" and fills
//             them bottom-up within each column, then spawns into the
//             remaining empty cells at the top.
// ─────────────────────────────────────────────────────────────────────────────

import { applyGravity as engineApplyGravity } from '../engine/GridEngine';
import type { GravityResult as EngineGravityResult } from '../engine/GridEngine';

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Describes a single tile that fell downward due to gravity.
 *
 * [INVARIANT] toRow > fromRow always (tiles only fall down).
 *             col is zero-indexed.
 */
export interface FallingTile {
  col: number;
  fromRow: number;
  toRow: number;
  /** The value of the tile that moved. */
  value: number;
}

/**
 * Describes a single tile that was freshly spawned at the top of a column.
 *
 * [INVARIANT] row < the lowest non-zero row in the column after compaction.
 */
export interface SpawnedPosition {
  row: number;
  col: number;
  value: number;
}

/**
 * Full result of one gravity application.
 *
 * [USAGE] Games consume grid as the new canonical board state.
 *         fallingTiles and spawnedPositions feed into GravityAnimator to
 *         produce per-tile animation frames.
 *         spawnBonusMap feeds into BonusMaskSystem (applyBonusMaskGravity) so
 *         callers no longer need a side-effect closure to capture bonus flags.
 */
export interface GravityApplicationResult {
  /** The board after gravity and refill — use this as the new game board. */
  grid: number[][];
  /**
   * Every tile that moved downward. Used by GravityAnimator to compute
   * drop-distance animations.
   */
  fallingTiles: FallingTile[];
  /**
   * Every tile that was newly spawned (did not previously exist on the board).
   * Used by GravityAnimator to trigger fall-in animations from above the board.
   */
  spawnedPositions: SpawnedPosition[];
  /** For each column, how many new tiles were spawned (0 if column was full). */
  spawnCountPerCol: number[];
  /**
   * Bonus flags for every spawned tile, indexed [col][spawnIndex].
   * spawnIndex 0 = topmost spawned tile in the column.
   * spawnBonusMap[c].length === spawnCountPerCol[c] for every column c.
   *
   * [USAGE] Pass directly to applyBonusMaskGravity() — eliminates the
   *         side-effect closure pattern that previously captured these flags.
   */
  spawnBonusMap: boolean[][];
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Applies downward gravity to `grid`:
 * 1. Existing non-zero tiles fall to fill cleared (0) cells in their column.
 * 2. Remaining empty cells at the top of each column are filled by `spawnValue`.
 *
 * Returns the new grid, movement metadata for animation, and `spawnBonusMap`
 * so callers can pass it directly to applyBonusMaskGravity() without needing
 * a side-effect closure to capture bonus flags.
 *
 * [INVARIANT] grid is not mutated. A fresh array is returned.
 * [INVARIANT] spawnValue and spawnBonus must be backed by the same underlying
 *             spawn source — i.e. spawnBonus(col, i) must reflect the bonus
 *             status of the tile whose value was returned by spawnValue(col, i).
 *             Callers satisfy this by capturing both fields from the same
 *             spawnTile() call and providing lookup closures over the cache.
 * [INVARIANT] spawnBonus is called exactly once per (col, spawnIndex) pair,
 *             after engineApplyGravity has populated spawnCountPerCol — it is
 *             a pure lookup, not a PRNG consumer.
 *
 * @param grid        Current board. 0 = cleared/empty cell.
 * @param rows        Row count (must equal grid.length).
 * @param cols        Column count.
 * @param spawnValue  Factory: (col, spawnIndex) → new tile value.
 *                    spawnIndex counts from 0 at the topmost new tile per column.
 * @param spawnBonus  Factory: (col, spawnIndex) → bonus flag for that tile.
 *                    Must be a pure lookup into the same spawn data as spawnValue.
 */
export function applyGravity(
  grid: number[][],
  rows: number,
  cols: number,
  spawnValue: (col: number, spawnIndex: number) => number,
  spawnBonus: (col: number, spawnIndex: number) => boolean,
): GravityApplicationResult {
  // Snapshot the pre-gravity board so we can compute which tiles moved.
  const before: number[][] = grid.map((r) => [...r]);

  // Delegate the actual compaction + fill to the engine primitive.
  const engineResult: EngineGravityResult = engineApplyGravity(grid, spawnValue);
  const after = engineResult.grid;

  // ── Derive movement metadata ──────────────────────────────────────────────

  const fallingTiles: FallingTile[] = [];
  const spawnedPositions: SpawnedPosition[] = [];
  const spawnCountPerCol: number[] = Array(cols).fill(0);
  const spawnBonusMap: boolean[][] = Array.from({ length: cols }, () => []);

  for (let c = 0; c < cols; c++) {
    // Count how many new tiles were spawned in this column.
    const spawnCount = engineResult.colFills[c]?.length ?? 0;
    spawnCountPerCol[c] = spawnCount;

    // The top `spawnCount` rows in `after` for this column are newly spawned.
    for (let r = 0; r < spawnCount; r++) {
      spawnedPositions.push({ row: r, col: c, value: after[r][c] });
    }

    // Collect bonus flags for every spawned tile in this column.
    // spawnBonus is a pure lookup — no PRNG calls here.
    for (let i = 0; i < spawnCount; i++) {
      spawnBonusMap[c][i] = spawnBonus(c, i);
    }

    // For rows below the spawn zone: if the value changed position, record it.
    // We do this by matching non-zero values from the bottom of `before` to
    // the bottom of `after` in column order.
    const beforeVals = before
      .map((row, ri) => ({ ri, v: row[c] }))
      .filter((x) => x.v !== 0)
      .reverse(); // bottom-first

    let writeRow = rows - 1;
    for (const { ri: originalRow, v } of beforeVals) {
      if (writeRow < spawnCount) break; // Into the spawn zone — stop.
      if (writeRow !== originalRow) {
        fallingTiles.push({
          col: c,
          fromRow: originalRow,
          toRow: writeRow,
          value: v,
        });
      }
      writeRow--;
    }
  }

  return {
    grid: after,
    fallingTiles,
    spawnedPositions,
    spawnCountPerCol,
    spawnBonusMap,
  };
}

/**
 * Helper: clears the listed positions in `grid` (sets them to 0) and returns
 * the cleared grid. Gravity should be applied to the result.
 *
 * This is a convenience wrapper around the engine primitive so callers do not
 * need to import GridEngine directly.
 *
 * [INVARIANT] All positions must be in-bounds.
 */
export function clearAndGravity(
  grid: number[][],
  rows: number,
  cols: number,
  clearPositions: ReadonlyArray<{ row: number; col: number }>,
  spawnValue: (col: number, spawnIndex: number) => number,
  spawnBonus: (col: number, spawnIndex: number) => boolean,
): GravityApplicationResult {
  // Zero out the cleared positions.
  const cleared = grid.map((r, ri) =>
    r.map((v, ci) =>
      clearPositions.some((p) => p.row === ri && p.col === ci) ? 0 : v,
    ),
  );
  return applyGravity(cleared, rows, cols, spawnValue, spawnBonus);
}
