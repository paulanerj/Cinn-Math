// [ROLE] Game-local utilities for CombineGrid.
// Only contains logic specific to CombineGrid's selection mechanic and solvability.
//
// [INVARIANT] No Math.random() calls. No side effects. Pure functions only.

import { GridPos } from '../types';
import { evaluate } from '../../../engine/public';
import type { EvalMode } from '../../../engine/public';
import { ZERO_TILE_VALUE, BOMB_TILE_VALUE } from '../constants';

/** Evaluates the arithmetic value of the selected tiles on a number[][] board. */
export function evaluateSelection(
  board: number[][],
  selection: GridPos[],
  mode: EvalMode,
): number {
  if (selection.length === 0) return mode === 'sum' ? 0 : 1;
  const vals = selection.map(({ row, col }) => board[row][col]);
  return evaluate(vals, mode);
}

/**
 * Returns true if at least one valid multiplication pair on the board equals target.
 *
 * Excludes:
 *   - trophyMask cells (locked trophies)
 *   - frozenMask cells (hardened over-target results)
 *   - BOMB_TILE_VALUE cells (bombs are not mergeable)
 *   - ZERO_TILE_VALUE cells (zero × anything = 0, never equals target ≥ 2)
 *   - empty cells (board value === 0)
 *
 * Note: if any zero tile exists on the board, there is always at least one
 * tactical move available (zero reset), but that move won't directly satisfy
 * the target, so we don't count it as "solvable" here.  The STALEMATE resolver
 * will generate a new target if no number-pair solution exists.
 */
export function hasSolution(
  board: number[][],
  target: number,
  mode: EvalMode,
  trophyMask?: boolean[][],
  frozenMask?: boolean[][],
): boolean {
  const vals: number[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[0]?.length ?? 0); c++) {
      if (trophyMask?.[r]?.[c]) continue;
      if (frozenMask?.[r]?.[c]) continue;
      const v = board[r][c];
      if (v === 0 || v === BOMB_TILE_VALUE || v === ZERO_TILE_VALUE) continue;
      vals.push(v);
    }
  }
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === target) return true;
    for (let j = i + 1; j < vals.length; j++) {
      const pair = mode === 'sum' ? vals[i] + vals[j] : vals[i] * vals[j];
      if (pair === target) return true;
      for (let k = j + 1; k < vals.length; k++) {
        const triple = mode === 'sum' ? pair + vals[k] : pair * vals[k];
        if (triple === target) return true;
      }
    }
  }
  return false;
}
