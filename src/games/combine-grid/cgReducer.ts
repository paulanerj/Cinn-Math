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
  /**
   * Trophy tile mask — true where a tile is a locked trophy (result of a successful
   * drag-merge). Trophy tiles retain their value but cannot be moved or dragged.
   * Cleared on ADVANCE_ROUND (fresh board) and CLEAR_COMPLETE (gravity invalidates positions).
   */
  trophyMask: boolean[][];
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
  /**
   * Positions that need in-place tile respawn after a drag-merge action.
   * Non-empty while the RESPAWNING effect is pending; cleared by RESPAWN_COMPLETE.
   * Distinct from clearingPositions (gravity pipeline signal) — respawn is
   * in-place, no column collapse.
   */
  respawnPositions: GridPos[];
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
  | {
      type: 'RESPAWN_COMPLETE';
      /** Per-position spawn results from the RESPAWNING effect. Always [src] only — dst is a trophy. */
      respawns: Array<{ pos: GridPos; value: number; isBonus: boolean }>;
      // [TARGET LAW] No target field — target is static for the full round.
      // The reducer uses state.target unchanged.
    }
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
    trophyMask: Array.from({ length: ROWS }, () => Array(COLS).fill(false) as boolean[]),
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
    respawnPositions: [],
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
          respawnPositions: [],
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
          respawnPositions: [],
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

      // Reject drag from or onto a trophy tile.
      if (state.trophyMask[src.row][src.col] || state.trophyMask[dst.row][dst.col]) {
        return { ...state, dragSource: null };
      }

      // Validate adjacency: Chebyshev distance must be exactly 1.
      const isAdjacent =
        Math.max(Math.abs(src.row - dst.row), Math.abs(src.col - dst.col)) === 1;
      if (!isAdjacent) return { ...state, dragSource: null };

      const result = srcVal * dstVal;

      // Case 1 — result > target: invalid merge, snap back.
      if (result > state.target) {
        return { ...state, dragSource: null };
      }

      // Case 3 — result === target: TROPHY.
      // [STATIC RESPAWN] Phase stays SELECTING — no gravity, no column collapse.
      // src is zeroed and will be respawned in-place (respawnPositions=[src]).
      // dst retains its value and becomes a locked trophy (trophyMask[dst]=true).
      // clearingPositions=[src] drives the opacity-0 animation for src only.
      // [TARGET LAW] target is NOT regenerated. state.target carries forward.
      if (result === state.target) {
        const newBoard = state.board.map((r, ri) =>
          r.map((v, ci) => (ri === src.row && ci === src.col ? 0 : v)),
        );
        const newBonusMask = state.bonusMask.map((r, ri) =>
          r.map((v, ci) =>
            ri === src.row && ci === src.col
              ? false
              : ri === dst.row && ci === dst.col
              ? false   // dst becomes trophy — bonus flag cleared
              : v,
          ),
        );
        const newTrophyMask = state.trophyMask.map((r, ri) =>
          r.map((v, ci) => (ri === dst.row && ci === dst.col ? true : v)),
        );
        return {
          ...state,
          board: newBoard,
          bonusMask: newBonusMask,
          trophyMask: newTrophyMask,
          dragSource: null,
          selection: [],
          selectionVal: 0,
          clearingPositions: [src],
          respawnPositions: [src],
          score: state.score + result,
          roundScore: state.roundScore + result,
        };
      }

      // Case 2 — result < target: merge. Destination gets result, source removed.
      // [STATIC RESPAWN] Phase stays SELECTING — src empties and is respawned in-place.
      // dst value is updated immediately. No trophy created.
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
        board: mergedBoard,
        bonusMask: mergedMask,
        dragSource: null,
        selection: [],
        selectionVal: 0,
        clearingPositions: [src],
        respawnPositions: [src],
      };
    }

    case 'CLEAR_COMPLETE': {
      // Gravity produces a fully fresh board — trophy positions are invalidated.
      // Reset trophyMask so no stale locks carry into the new layout.
      const freshTrophyMask: boolean[][] = Array.from({ length: ROWS }, () =>
        Array(COLS).fill(false),
      );
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
        trophyMask: freshTrophyMask,
        target: action.target,
        clearingPositions: [],
        respawnPositions: [],
        selection: [],
        selectionVal: 0,
      };
    }

    case 'RESPAWN_COMPLETE': {
      // Fill each respawned position (always src only — dst is a trophy, unchanged).
      let newBoard = state.board;
      let newBonusMask = state.bonusMask;
      for (const { pos, value, isBonus } of action.respawns) {
        newBoard = newBoard.map((r, ri) =>
          r.map((v, ci) => (ri === pos.row && ci === pos.col ? value : v)),
        );
        newBonusMask = newBonusMask.map((r, ri) =>
          r.map((v, ci) => (ri === pos.row && ci === pos.col ? isBonus : v)),
        );
      }
      // [TARGET LAW] Target is static for the full round — use state.target unchanged.
      // Trophy tiles are excluded from hasSolution via trophyMask (state.trophyMask
      // already has dst marked true from DRAG_DROP; src was empty, is now refilled).
      const solvable = hasSolution(newBoard, state.target, state.mode, state.trophyMask);
      return {
        ...state,
        phase: solvable ? 'SELECTING' : 'STALEMATE',
        board: newBoard,
        bonusMask: newBonusMask,
        clearingPositions: [],
        respawnPositions: [],
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
        trophyMask: Array.from({ length: ROWS }, () => Array(COLS).fill(false) as boolean[]),
        target: action.target,
        dragSource: null,
        selection: [],
        selectionVal: 0,
        roundScore: 0,
        timeLeft: ROUND_DURATION_SECS,
        clearingPositions: [],
        respawnPositions: [],
      };
    }

    case 'RESOLVE_STALEMATE': {
      return { ...state, phase: 'SELECTING', target: action.target, respawnPositions: [] };
    }

    case 'PLAY_AGAIN':
      return action.newState;

    default:
      return state;
  }
}
