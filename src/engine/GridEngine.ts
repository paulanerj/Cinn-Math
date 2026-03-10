// [ROLE] Core grid state operations for the GridMath engine.
// Provides pure functions to create, mutate, and query a 2D grid of numbers.
// This module is the lowest layer of the engine — it has no knowledge of
// React, game rules, or tile visuals.
//
// [WHY] Both CombineGrid and SpeedGrid share the same underlying grid
// mechanics: create a board, clear cells, apply gravity, refill from the top.
// Centralising these operations prevents each game from having its own
// slightly different gravity implementation.
//
// [FUTURE] When a new game adds non-standard gravity (e.g. sideways gravity,
// anti-gravity mode), add a new gravity variant here rather than copying
// applyGravity into the game file.
//
// [LLM NOTE] All functions here are pure. They take grid state as input and
// return new grid state. They must not hold references to the previous grid —
// always return a fresh array. Games should treat the returned grid as the
// new canonical state.
//
// [INVARIANT] Grid is represented as number[][], row-major, zero-indexed.
//             grid[row][col] is the value at (row, col).
//             Cleared cells are represented as 0 (zero), not null, to keep
//             the array type homogeneous.
//             grid.length === rows, grid[r].length === cols for all r.

import type { SpawnedTile } from './SpawnEngine';

// ── Grid creation ─────────────────────────────────────────────────────────────

/**
 * Creates a new rows×cols grid by calling fill() for each cell.
 * fill() is called row-by-row, left-to-right.
 *
 * [INVARIANT] rows ≥ 1, cols ≥ 1.
 */
export function createGrid(
  rows: number,
  cols: number,
  fill: (row: number, col: number) => number,
): number[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => fill(r, c)),
  );
}

/**
 * Creates a grid pre-filled with zero (empty/cleared state).
 * Useful as a starting point before spawning tiles.
 */
export function emptyGrid(rows: number, cols: number): number[][] {
  return createGrid(rows, cols, () => 0);
}

/**
 * Converts a flat SpawnedTile[] (row-major, from SpawnEngine.spawnBoard) into
 * a number[][] grid, using tile.value for each cell.
 *
 * Bonus tile distinction is not stored in the grid — games that need to track
 * bonus positions should maintain a parallel boolean[][] in their game state.
 *
 * [INVARIANT] tiles.length must equal rows * cols.
 */
export function gridFromSpawn(
  rows: number,
  cols: number,
  tiles: SpawnedTile[],
): number[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => tiles[r * cols + c].value),
  );
}

// ── Cell reads ────────────────────────────────────────────────────────────────

/**
 * Returns the value at (row, col), or 0 if the position is out of bounds.
 * Safe to call without bounds checking at the call site.
 */
export function getCellValue(grid: number[][], row: number, col: number): number {
  return grid[row]?.[col] ?? 0;
}

/**
 * Returns true if (row, col) is within the grid's bounds.
 */
export function inBounds(
  grid: number[][],
  row: number,
  col: number,
): boolean {
  return row >= 0 && row < grid.length && col >= 0 && col < (grid[0]?.length ?? 0);
}

// ── Cell writes (pure — return new grid) ─────────────────────────────────────

/**
 * Returns a new grid with the cell at (row, col) set to value.
 *
 * [INVARIANT] (row, col) must be in bounds.
 */
export function setCell(
  grid: number[][],
  row: number,
  col: number,
  value: number,
): number[][] {
  return grid.map((r, ri) =>
    ri === row ? r.map((v, ci) => (ci === col ? value : v)) : r,
  );
}

/**
 * Returns a new grid with all listed positions set to 0 (cleared).
 * Used by games to mark cells for removal before applying gravity.
 *
 * [INVARIANT] All positions must be in bounds.
 */
export function clearCells(
  grid: number[][],
  positions: ReadonlyArray<{ row: number; col: number }>,
): number[][] {
  const posSet = new Set(positions.map((p) => `${p.row},${p.col}`));
  return grid.map((r, ri) =>
    r.map((v, ci) => (posSet.has(`${ri},${ci}`) ? 0 : v)),
  );
}

// ── Gravity ───────────────────────────────────────────────────────────────────

/**
 * Result of applying gravity to a grid.
 */
export interface GravityResult {
  /** The new grid after gravity and refill. */
  grid: number[][];
  /**
   * For each column, the list of new tile values that were spawned at the top.
   * Index 0 = topmost new tile in that column.
   * colFills[c].length === number of empty cells that were filled in column c.
   */
  colFills: number[][];
}

/**
 * Applies downward gravity to the grid:
 * 1. Non-zero tiles fall to the lowest available position in their column.
 * 2. Empty cells (value 0) at the top are filled by calling spawnValue(col, fillIndex).
 *    fillIndex counts from 0 at the topmost new tile in that column.
 *
 * [INVARIANT] spawnValue must be a pure function. It is called once per empty
 *             cell that needs filling, in top-to-bottom order within each column,
 *             left-to-right across columns.
 *
 * This is the same algorithm as the original Cinnamoroll boardUtils.applyGravity,
 * generalised to an arbitrary grid size and spawn function.
 *
 * @param grid        Current grid (may contain 0s marking cleared cells).
 * @param spawnValue  Factory for new tile values: (col, fillIndex) → number.
 */
export function applyGravity(
  grid: number[][],
  spawnValue: (col: number, fillIndex: number) => number,
): GravityResult {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  // Work on a mutable copy — we'll return it as the new canonical state.
  const next: number[][] = grid.map((r) => [...r]);
  const colFills: number[][] = Array.from({ length: cols }, () => []);

  for (let c = 0; c < cols; c++) {
    // Compact: move all non-zero values to the bottom of the column.
    let writeRow = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (next[r][c] !== 0) {
        next[writeRow][c] = next[r][c];
        if (writeRow !== r) next[r][c] = 0;
        writeRow--;
      }
    }
    // Fill empty cells from the top with new spawned values.
    let fillIndex = 0;
    for (let r = 0; r <= writeRow; r++) {
      const val = spawnValue(c, fillIndex);
      next[r][c] = val;
      colFills[c].push(val);
      fillIndex++;
    }
  }

  return { grid: next, colFills };
}

// ── Swap ──────────────────────────────────────────────────────────────────────

/**
 * Returns a new grid with the values at two positions exchanged.
 *
 * [INVARIANT] Both positions must be in bounds and must be different cells.
 */
export function swapCells(
  grid: number[][],
  a: { row: number; col: number },
  b: { row: number; col: number },
): number[][] {
  const va = getCellValue(grid, a.row, a.col);
  const vb = getCellValue(grid, b.row, b.col);
  return setCell(setCell(grid, a.row, a.col, vb), b.row, b.col, va);
}

// ── Adjacency ─────────────────────────────────────────────────────────────────

/**
 * Returns true if (ar, ac) and (br, bc) are orthogonally adjacent.
 */
export function isOrthoAdjacent(
  ar: number, ac: number,
  br: number, bc: number,
): boolean {
  return (Math.abs(ar - br) === 1 && ac === bc) ||
         (ar === br && Math.abs(ac - bc) === 1);
}

/**
 * Returns true if (ar, ac) and (br, bc) are orthogonally or diagonally adjacent
 * (Chebyshev distance === 1).
 */
export function isChebyshevAdjacent(
  ar: number, ac: number,
  br: number, bc: number,
): boolean {
  return Math.max(Math.abs(ar - br), Math.abs(ac - bc)) === 1;
}

// ── Grid queries ──────────────────────────────────────────────────────────────

/**
 * Returns the sum of values along the given list of positions.
 * Positions with value 0 contribute 0 to the sum.
 */
export function sumPositions(
  grid: number[][],
  positions: ReadonlyArray<{ row: number; col: number }>,
): number {
  return positions.reduce((acc, p) => acc + getCellValue(grid, p.row, p.col), 0);
}

/**
 * Returns the product of values along the given list of positions.
 * Positions with value 0 contribute 0 to the product (effectively zeroing it).
 * [INVARIANT] positions.length ≥ 1.
 */
export function productPositions(
  grid: number[][],
  positions: ReadonlyArray<{ row: number; col: number }>,
): number {
  return positions.reduce((acc, p) => acc * getCellValue(grid, p.row, p.col), 1);
}
