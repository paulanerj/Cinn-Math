// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/cgReducer.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] CombineGrid pure state types, initializer, and reducer.
//        Extracted from CombineGridGame.tsx (Phase-9 Task-1).
//        No React, no DOM, no PRNG calls in the reducer.
//
// [PURITY CONTRACT] reducer() is a pure function — (CGState, Action) → CGState.
//   It never calls Math.random(), Date.now(), or any PRNG.
//   All PRNG-derived values (new boards, new targets) are computed in effects
//   and passed into the reducer via action payloads.
//
// [SEED LAW] initGame() takes the pre-generated seed as a parameter.
//   The caller is the entropy authority — do NOT call randomSeed() here.
// ─────────────────────────────────────────────────────────────────────────────

import type { PracticeProfile } from '../../engine/PracticeProfile';
import { spawnBoard, gridFromSpawn, generateTarget } from '../../engine/public';
import type { EvalMode } from '../../engine/public';
import { ROWS, COLS, ROUNDS_PER_SESSION, ROUND_DURATION_SECS } from './constants';
import type { GamePhase, GridPos } from './types';
import { evaluateSelection, hasSolution } from './services/GridService';
import { toggleTile } from './services/SelectionService';

// ── State ─────────────────────────────────────────────────────────────────────

export interface CGState {
  phase: GamePhase;
  mode: EvalMode;
  /** Board as a plain number[][]. 0 = empty cell (during gravity transition). */
  board: number[][];
  /** Bonus tile mask — true where a tile is a bonus tile. Structurally aligned with board. */
  bonusMask: boolean[][];
  /** PRNG seed captured at session start — stored for replay readiness. */
  seed: number;
  /**
   * Position of the tile currently selected as a drag source.
   * null when no drag is in progress.
   */
  dragSource: GridPos | null;
  selection: GridPos[];
  target: number;
  selectionVal: number;
  score: number;
  roundScore: number;
  roundsCompleted: number;
  roundScores: number[];
  timeLeft: number;
  clearingPositions: GridPos[];
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'TICK' }
  | { type: 'TAP_TILE'; pos: GridPos }
  | { type: 'DRAG_START'; pos: GridPos }
  | { type: 'DRAG_DROP'; src: GridPos; dst: GridPos }
  | { type: 'DRAG_CANCEL' }
  | { type: 'CLEAR_COMPLETE'; board: number[][]; bonusMask: boolean[][]; target: number }
  | { type: 'ADVANCE_ROUND'; board: number[][]; bonusMask: boolean[][]; target: number }
  | { type: 'RESOLVE_STALEMATE'; target: number }
  | { type: 'PLAY_AGAIN'; newState: CGState };

// ── Lazy initializer ──────────────────────────────────────────────────────────

/**
 * Produces the initial CGState for a new session.
 * Takes profile, prng, and seed so PRNG consumption is seeded and recorded.
 *
 * [PURITY] Not a reducer. Called once at mount and once per PLAY_AGAIN.
 * The component owns profile and prngRef — they are passed in so initGame
 * has no hidden entropy dependencies.
 *
 * [SEED LAW] seed must be the exact uint32 used to construct prng via makePrng(seed).
 * CGState.seed stores this value for replay. Do NOT call randomSeed() here —
 * the caller is the entropy authority (Phase-8 Task-17 fix).
 */
export function initGame(
  profile: PracticeProfile,
  prng: () => number,
  seed: number,
): CGState {
  const spawnedTiles = spawnBoard(ROWS, COLS, profile, prng);
  const board = gridFromSpawn(ROWS, COLS, spawnedTiles);
  const bonusMask: boolean[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => spawnedTiles[r * COLS + c].isBonus),
  );
  const target = generateTarget(board, ROWS, COLS, 'product', profile, prng);
  return {
    phase: 'SELECTING',
    mode: 'product',
    board,
    bonusMask,
    seed,
    dragSource: null,
    selection: [],
    target,
    selectionVal: 0,
    score: 0,
    roundScore: 0,
    roundsCompleted: 0,
    roundScores: [],
    timeLeft: ROUND_DURATION_SECS,
    clearingPositions: [],
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function reducer(state: CGState, action: Action): CGState {
  switch (action.type) {
    case 'TICK': {
      if (state.phase !== 'SELECTING') return state;
      const next = state.timeLeft - 1;
      if (next <= 0) {
        const roundScores = [...state.roundScores, state.roundScore];
        const roundsCompleted = state.roundsCompleted + 1;
        return {
          ...state,
          timeLeft: 0,
          roundScores,
          roundsCompleted,
          phase: roundsCompleted >= ROUNDS_PER_SESSION ? 'FINAL' : 'ROUND_OVER',
          selection: [],
          selectionVal: 0,
          clearingPositions: [],
        };
      }
      return { ...state, timeLeft: next };
    }

    case 'TAP_TILE': {
      if (state.phase !== 'SELECTING') return state;
      const newSel = toggleTile(state.selection, action.pos);
      const val = evaluateSelection(state.board, newSel, state.mode);

      // Over target → error, reset selection
      if (val > state.target) {
        return { ...state, selection: [], selectionVal: 0 };
      }

      // Match! (need at least 2 tiles)
      if (val === state.target && newSel.length >= 2) {
        // Score = sum of selected values (base points regardless of mode)
        const basePoints = newSel
          .map(({ row, col }) => state.board[row][col])
          .reduce((a, b) => a + b, 0);
        // [PIPELINE ALIGNMENT — Phase-9 Task-2 / Task-3 / Task-5]
        // Zero cleared cells in board and bonusMask here so both enter CLEARING
        // already aligned. posSet shared across both maps — same positions, one pass.
        const posSet = new Set(newSel.map((p) => `${p.row},${p.col}`));
        const clearedBoard = state.board.map((r, ri) =>
          r.map((v, ci) => (posSet.has(`${ri},${ci}`) ? 0 : v)),
        );
        const clearedMask = state.bonusMask.map((r, ri) =>
          r.map((v, ci) => (posSet.has(`${ri},${ci}`) ? false : v)),
        );
        return {
          ...state,
          phase: 'CLEARING',
          board: clearedBoard,
          bonusMask: clearedMask,
          selection: [],
          selectionVal: 0,
          clearingPositions: newSel,
          score: state.score + basePoints,
          roundScore: state.roundScore + basePoints,
        };
      }

      return { ...state, selection: newSel, selectionVal: val };
    }

    case 'DRAG_START': {
      if (state.phase !== 'SELECTING') return state;
      const { pos } = action;
      // Reject empty cells.
      if (state.board[pos.row][pos.col] === 0) return state;
      return { ...state, dragSource: pos, selection: [], selectionVal: 0 };
    }

    case 'DRAG_CANCEL': {
      return { ...state, dragSource: null };
    }

    case 'DRAG_DROP': {
      if (state.phase !== 'SELECTING') return state;
      const { src, dst } = action;

      // Validate non-zero source and destination.
      const srcVal = state.board[src.row][src.col];
      const dstVal = state.board[dst.row][dst.col];
      if (srcVal === 0 || dstVal === 0) return { ...state, dragSource: null };

      // Validate adjacency: Chebyshev distance must be exactly 1.
      const isAdjacent =
        Math.max(Math.abs(src.row - dst.row), Math.abs(src.col - dst.col)) === 1;
      if (!isAdjacent) return { ...state, dragSource: null };

      const result = srcVal * dstVal;

      // Case 1 — result > target: invalid merge, snap back.
      if (result > state.target) {
        return { ...state, dragSource: null };
      }

      // Case 3 — result === target: TROPHY. Both tiles cleared.
      if (result === state.target) {
        const clearingPositions: GridPos[] = [src, dst];
        const posSet = new Set(clearingPositions.map((p) => `${p.row},${p.col}`));
        const clearedBoard = state.board.map((r, ri) =>
          r.map((v, ci) => (posSet.has(`${ri},${ci}`) ? 0 : v)),
        );
        const clearedMask = state.bonusMask.map((r, ri) =>
          r.map((v, ci) => (posSet.has(`${ri},${ci}`) ? false : v)),
        );
        return {
          ...state,
          phase: 'CLEARING',
          board: clearedBoard,
          bonusMask: clearedMask,
          dragSource: null,
          selection: [],
          selectionVal: 0,
          clearingPositions,
          score: state.score + result,
          roundScore: state.roundScore + result,
        };
      }

      // Case 2 — result < target: merge. Destination gets result, source removed.
      const mergedBoard = state.board.map((r, ri) =>
        r.map((v, ci) => {
          if (ri === src.row && ci === src.col) return 0;
          if (ri === dst.row && ci === dst.col) return result;
          return v;
        }),
      );
      const mergedMask = state.bonusMask.map((r, ri) =>
        r.map((v, ci) => (ri === src.row && ci === src.col ? false : v)),
      );
      return {
        ...state,
        phase: 'CLEARING',
        board: mergedBoard,
        bonusMask: mergedMask,
        dragSource: null,
        selection: [],
        selectionVal: 0,
        clearingPositions: [src],
      };
    }

    case 'CLEAR_COMPLETE': {
      const solvable = hasSolution(action.board, action.target, state.mode);
      const nextPhase = !solvable
        ? 'STALEMATE'
        : state.timeLeft > 0
        ? 'SELECTING'
        : 'ROUND_OVER';
      return {
        ...state,
        phase: nextPhase,
        board: action.board,
        bonusMask: action.bonusMask,
        target: action.target,
        clearingPositions: [],
        selection: [],
        selectionVal: 0,
      };
    }

    case 'ADVANCE_ROUND': {
      if (state.roundsCompleted >= ROUNDS_PER_SESSION) {
        return { ...state, phase: 'FINAL' };
      }
      return {
        ...state,
        phase: 'SELECTING',
        board: action.board,
        bonusMask: action.bonusMask,
        target: action.target,
        dragSource: null,
        selection: [],
        selectionVal: 0,
        roundScore: 0,
        timeLeft: ROUND_DURATION_SECS,
        clearingPositions: [],
      };
    }

    case 'RESOLVE_STALEMATE': {
      return { ...state, phase: 'SELECTING', target: action.target };
    }

    case 'PLAY_AGAIN':
      return action.newState;

    default:
      return state;
  }
}
