// [ROLE] Pure board management functions for CombineGrid.
// No React. No side effects. All functions take data and return data.

import { Tile, GridPos } from '../types';

type Mode = 'sum' | 'multiply';
import { ROWS, COLS, TILE_VAL_MIN, TILE_VAL_MAX } from '../constants';

function makeTile(val: number): Tile {
  return { id: crypto.randomUUID(), kind: 'number', val };
}

function randVal(): number {
  return (
    Math.floor(Math.random() * (TILE_VAL_MAX - TILE_VAL_MIN + 1)) + TILE_VAL_MIN
  );
}

/** Creates a fresh ROWS×COLS board filled with number tiles. */
export function createBoard(): Tile[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => makeTile(randVal())),
  );
}

/**
 * Applies gravity after clearing the given positions.
 * Cleared columns compact downward; empty slots at top are filled with new tiles.
 * Returns the new board and a Set of IDs for the newly spawned tiles.
 */
export function applyGravity(
  board: Tile[][],
  cleared: GridPos[],
): { board: Tile[][]; newIds: Set<string> } {
  const next: (Tile | null)[][] = board.map((row) => [...row]);
  for (const { r, c } of cleared) {
    next[r][c] = null;
  }

  const newIds = new Set<string>();

  for (let c = 0; c < COLS; c++) {
    // Collect existing tiles in this column, bottom-first
    const existing: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (next[r][c] !== null) existing.push(next[r][c]!);
    }
    // Fill remaining slots with new tiles
    while (existing.length < ROWS) {
      const t = makeTile(randVal());
      newIds.add(t.id);
      existing.push(t);
    }
    // Write back: existing[0] → bottom row, existing[ROWS-1] → top row
    for (let r = 0; r < ROWS; r++) {
      next[r][c] = existing[ROWS - 1 - r];
    }
  }

  return { board: next as Tile[][], newIds };
}

/** Evaluates the arithmetic value of the selected tiles. */
export function evaluateSelection(
  board: Tile[][],
  selection: GridPos[],
  mode: Mode,
): number {
  const vals = selection.map(({ r, c }) => board[r][c].val);
  if (vals.length === 0) return mode === 'sum' ? 0 : 1;
  return mode === 'sum'
    ? vals.reduce((a, b) => a + b, 0)
    : vals.reduce((a, b) => a * b, 1);
}

/**
 * Generates a target number that is definitely achievable on this board.
 * Picks 2 or 3 random tiles and returns their sum or product.
 */
export function generateTarget(board: Tile[][], mode: Mode): number {
  const flat: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      flat.push(board[r][c].val);
    }
  }
  // Shuffle and take 2–3 tiles
  const shuffled = flat.sort(() => Math.random() - 0.5);
  const count = Math.random() < 0.5 ? 2 : 3;
  const chosen = shuffled.slice(0, count);
  return mode === 'sum'
    ? chosen.reduce((a, b) => a + b, 0)
    : chosen.reduce((a, b) => a * b, 1);
}

/** Returns true if at least one valid selection equals the target. */
export function hasSolution(
  board: Tile[][],
  target: number,
  mode: Mode,
): boolean {
  const vals: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      vals.push(board[r][c].val);
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
