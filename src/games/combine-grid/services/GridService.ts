// [ROLE] Game-local utilities for CombineGrid.
// Only contains logic that is specific to CombineGrid's tap-select mechanic
// and has no equivalent in the shared engine layer.
//
// Board creation, gravity, and target generation have been removed and are
// now handled by the engine (SpawnEngine, GravitySystem, TargetGenerator)
// via the component's effect layer in CombineGridGame.tsx.
//
// [INVARIANT] No Math.random() calls. No side effects. Pure functions only.

import { GridPos } from '../types';
import { evaluate } from '../../../engine/public';
import type { EvalMode } from '../../../engine/public';

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
 * Returns true if at least one valid selection of 1, 2, or 3 tiles equals the target.
 * No adjacency constraint — CombineGrid allows selecting any tiles.
 *
 * [NOTE] Intentionally searches non-adjacent combinations because CombineGrid's
 * TAP_TILE mechanic places no adjacency requirement on selections. This is
 * consistent with hasSolution being a stalemate detector, not a path validator.
 *
 * @param trophyMask  Optional mask of locked trophy tiles. Trophy cells are excluded
 *                    from the search — they cannot participate in tap-selections or
 *                    drag-merges, so a board is unsolvable if only trophy cells satisfy
 *                    the target.
 */
export function hasSolution(
  board: number[][],
  target: number,
  mode: EvalMode,
  trophyMask?: boolean[][],
): boolean {
  const vals: number[] = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[0]?.length ?? 0); c++) {
      if (trophyMask?.[r]?.[c]) continue;   // locked trophy — cannot be selected
      vals.push(board[r][c]);
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
