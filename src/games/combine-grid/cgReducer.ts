// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/cgReducer.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] CombineGrid pure state types, initializer, and reducer.
//
// [PURITY CONTRACT] reducer() is a pure function — (CGState, Action) → CGState.
//   It never calls Math.random(), Date.now(), or any PRNG.
//   All PRNG-derived values are computed in effects and passed via action payloads.
//
// [SEED LAW] initGame() takes the pre-generated seed as a parameter.
//   The caller is the entropy authority — do NOT call randomSeed() here.
//
// [INTERACTION MATRIX — §15 of Rulebook]
//   trophy  → any tile      : swap
//   any tile → trophy       : swap
//   frozen  → non-trophy    : blocked
//   non-trophy → frozen     : blocked
//   bomb    → trophy        : swap (handled by trophy arm above)
//   trophy  → bomb          : swap (handled by trophy arm above)
//   number  → bomb          : bomb ignites (UI layer); reducer cancels drag
//   bomb    → number        : bomb ignites (UI layer); reducer cancels drag
//   number  → zero          : zero reset (double respawn)
//   zero    → number        : zero reset (double respawn)
//   number  → number:
//     result < target       : standard productive merge
//     result == target      : trophy created
//     result > target       : frozen tile created at dst
// ─────────────────────────────────────────────────────────────────────────────

import type { PracticeProfile } from '../../engine/PracticeProfile';
import { spawnBoard, gridFromSpawn, generateTarget } from '../../engine/public';
import type { EvalMode } from '../../engine/public';
import {
  ROWS, COLS, ROUNDS_PER_SESSION, ROUND_DURATION_SECS,
  ZERO_TILE_VALUE, BOMB_TILE_VALUE,
} from './constants';
import type { GamePhase, GridPos } from './types';
import { evaluateSelection, hasSolution } from './services/GridService';
import { toggleTile } from './services/SelectionService';

// ── State ─────────────────────────────────────────────────────────────────────

export interface CGState {
  phase: GamePhase;
  mode: EvalMode;
  /** Board as a plain number[][]. 0 = empty cell (during gravity transition).
   *  Special sentinels: ZERO_TILE_VALUE = live zero tile; BOMB_TILE_VALUE = bomb. */
  board: number[][];
  /** Bonus tile mask — structurally aligned with board. */
  bonusMask: boolean[][];
  /**
   * Trophy tile mask — true where a tile is a locked trophy (result of A×B==target).
   * Trophy board value is set to state.target so the target number is visible inside.
   * Cleared on ADVANCE_ROUND and CLEAR_COMPLETE.
   */
  trophyMask: boolean[][];
  /**
   * Frozen tile mask — true where A×B>target produced a hardened tile.
   * Frozen tiles cannot be merged further and can only move via trophy swap.
   * Board value is the actual merge result (e.g. 16).
   */
  frozenMask: boolean[][];
  /** Cumulative trophy count for this session (drives bomb spawning every 10). */
  trophyCount: number;
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
   * Positions needing normal in-place tile respawn (factor-weighted distribution).
   * Non-empty while the RESPAWNING effect is pending; cleared by RESPAWN_COMPLETE.
   */
  respawnPositions: GridPos[];
  /**
   * Positions needing zero-interaction respawn (40% factor / 40% distractor /
   * 10% zero / 10% one).  Set by DRAG_DROP when zero interaction fires.
   * Cleared by RESPAWN_COMPLETE.
   */
  zeroRespawnPositions: GridPos[];
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
      respawns: Array<{ pos: GridPos; value: number; isBonus: boolean }>;
    }
  | {
      /** Destroys all tiles in a 3×3 region centered on `center`.
       *  Called by the component after the 2-second bomb fuse expires. */
      type: 'BOMB_EXPLODE';
      center: GridPos;
    }
  | {
      /** Places a bomb tile at a specific position (every BOMB_TROPHIES_PER_SPAWN trophies). */
      type: 'SPAWN_BOMB';
      pos: GridPos;
    }
  | { type: 'PLAY_AGAIN'; newState: CGState };

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Swap the tile at src with the tile at dst, carrying all parallel masks. */
function applySwap(state: CGState, src: GridPos, dst: GridPos): CGState {
  const swap2D = <T>(grid: T[][], aVal: T, bVal: T): T[][] =>
    grid.map((r, ri) =>
      r.map((v, ci) => {
        if (ri === src.row && ci === src.col) return bVal;
        if (ri === dst.row && ci === dst.col) return aVal;
        return v;
      }),
    );

  const srcBoard = state.board[src.row][src.col];
  const dstBoard = state.board[dst.row][dst.col];
  const srcTrophy = state.trophyMask[src.row][src.col];
  const dstTrophy = state.trophyMask[dst.row][dst.col];
  const srcFrozen = state.frozenMask[src.row][src.col];
  const dstFrozen = state.frozenMask[dst.row][dst.col];
  const srcBonus = state.bonusMask[src.row][src.col];
  const dstBonus = state.bonusMask[dst.row][dst.col];

  return {
    ...state,
    board: swap2D(state.board, srcBoard, dstBoard),
    trophyMask: swap2D(state.trophyMask, srcTrophy, dstTrophy),
    frozenMask: swap2D(state.frozenMask, srcFrozen, dstFrozen),
    bonusMask: swap2D(state.bonusMask, srcBonus, dstBonus),
    dragSource: null,
    selection: [],
    selectionVal: 0,
    clearingPositions: [],
    respawnPositions: [],
    zeroRespawnPositions: [],
  };
}

/** Clear a single position (set board to 0, clear all masks for that cell). */
function clearPos(
  board: number[][],
  trophyMask: boolean[][],
  frozenMask: boolean[][],
  bonusMask: boolean[][],
  pos: GridPos,
): {
  board: number[][];
  trophyMask: boolean[][];
  frozenMask: boolean[][];
  bonusMask: boolean[][];
} {
  const { row, col } = pos;
  const at = (r: number, c: number, orig: number | boolean, cleared: number | boolean) =>
    r === row && c === col ? cleared : orig;

  return {
    board: board.map((r, ri) => r.map((v, ci) => at(ri, ci, v, 0) as number)),
    trophyMask: trophyMask.map((r, ri) =>
      r.map((v, ci) => at(ri, ci, v, false) as boolean),
    ),
    frozenMask: frozenMask.map((r, ri) =>
      r.map((v, ci) => at(ri, ci, v, false) as boolean),
    ),
    bonusMask: bonusMask.map((r, ri) =>
      r.map((v, ci) => at(ri, ci, v, false) as boolean),
    ),
  };
}

// ── Lazy initializer ──────────────────────────────────────────────────────────

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
  const emptyBool = (): boolean[][] =>
    Array.from({ length: ROWS }, () => Array(COLS).fill(false) as boolean[]);
  return {
    phase: 'SELECTING',
    mode: 'product',
    board,
    bonusMask,
    trophyMask: emptyBool(),
    frozenMask: emptyBool(),
    trophyCount: 0,
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
    zeroRespawnPositions: [],
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function reducer(state: CGState, action: Action): CGState {
  switch (action.type) {
    // ── TICK ────────────────────────────────────────────────────────────────────
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
          zeroRespawnPositions: [],
        };
      }
      return { ...state, timeLeft: next };
    }

    // ── TAP_TILE (legacy — tap-select mechanic) ─────────────────────────────────
    case 'TAP_TILE': {
      if (state.phase !== 'SELECTING') return state;
      const newSel = toggleTile(state.selection, action.pos);
      const val = evaluateSelection(state.board, newSel, state.mode);

      if (val > state.target) return { ...state, selection: [], selectionVal: 0 };

      if (val === state.target && newSel.length >= 2) {
        const basePoints = newSel
          .map(({ row, col }) => state.board[row][col])
          .reduce((a, b) => a + b, 0);
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
          zeroRespawnPositions: [],
          score: state.score + basePoints,
          roundScore: state.roundScore + basePoints,
        };
      }

      return { ...state, selection: newSel, selectionVal: val };
    }

    // ── DRAG_START ──────────────────────────────────────────────────────────────
    case 'DRAG_START': {
      if (state.phase !== 'SELECTING') return state;
      const { pos } = action;
      const val = state.board[pos.row][pos.col];
      // Reject empty cells, frozen tiles (frozen can only move via trophy swap),
      // and bomb tiles (bomb touch is handled by the UI layer — it ignites).
      if (val === 0) return state;
      if (state.frozenMask[pos.row][pos.col]) return state;
      if (val === BOMB_TILE_VALUE) return state; // UI handles bomb ignition
      return { ...state, dragSource: pos, selection: [], selectionVal: 0 };
    }

    // ── DRAG_CANCEL ─────────────────────────────────────────────────────────────
    case 'DRAG_CANCEL': {
      return { ...state, dragSource: null };
    }

    // ── DRAG_DROP ───────────────────────────────────────────────────────────────
    case 'DRAG_DROP': {
      if (state.phase !== 'SELECTING') return state;
      const { src, dst } = action;

      const srcVal = state.board[src.row][src.col];
      const dstVal = state.board[dst.row][dst.col];
      if (srcVal === 0 || dstVal === 0) return { ...state, dragSource: null };

      // Adjacency — Chebyshev distance must be exactly 1.
      const isAdj =
        Math.max(Math.abs(src.row - dst.row), Math.abs(src.col - dst.col)) === 1;
      if (!isAdj) return { ...state, dragSource: null };

      const srcTrophy = state.trophyMask[src.row][src.col];
      const dstTrophy = state.trophyMask[dst.row][dst.col];
      const srcFrozen = state.frozenMask[src.row][src.col];
      const dstFrozen = state.frozenMask[dst.row][dst.col];
      const srcBomb = srcVal === BOMB_TILE_VALUE;
      const dstBomb = dstVal === BOMB_TILE_VALUE;
      const srcZero = srcVal === ZERO_TILE_VALUE;
      const dstZero = dstVal === ZERO_TILE_VALUE;

      // ── Trophy swap (§15.2, §15.3, §15.4, §15.5, §15.6, §15.7) ────────────
      // Any tile dragged onto a trophy, or a trophy dragged onto any tile → swap.
      // This includes trophy↔frozen, trophy↔bomb.
      if (srcTrophy || dstTrophy) {
        return applySwap(state, src, dst);
      }

      // ── Bomb interactions (§15.8, §15.9) ────────────────────────────────────
      // Number→bomb or bomb→number: the UI layer already ignited the bomb;
      // the reducer just cancels the drag cleanly.
      if (srcBomb || dstBomb) {
        return { ...state, dragSource: null };
      }

      // ── Frozen blocker (§8.2) ────────────────────────────────────────────────
      // Frozen tiles can only move via trophy swap (handled above).
      if (srcFrozen || dstFrozen) {
        return { ...state, dragSource: null };
      }

      // ── Zero interaction (§9.2) ─────────────────────────────────────────────
      // Both tiles are consumed and respawn with the zero distribution.
      if (srcZero || dstZero) {
        let b = state.board;
        let tm = state.trophyMask;
        let fm = state.frozenMask;
        let bm = state.bonusMask;
        for (const pos of [src, dst]) {
          const cleared = clearPos(b, tm, fm, bm, pos);
          b = cleared.board;
          tm = cleared.trophyMask;
          fm = cleared.frozenMask;
          bm = cleared.bonusMask;
        }
        return {
          ...state,
          board: b,
          trophyMask: tm,
          frozenMask: fm,
          bonusMask: bm,
          dragSource: null,
          selection: [],
          selectionVal: 0,
          clearingPositions: [src, dst],
          respawnPositions: [],
          zeroRespawnPositions: [src, dst],
        };
      }

      // ── Standard number × number merge ──────────────────────────────────────
      const result = srcVal * dstVal;

      // Case: result > target → frozen tile at dst (§7.1 Case C).
      if (result > state.target) {
        // src is consumed; dst becomes frozen at the merge-result value.
        const cleared = clearPos(state.board, state.trophyMask, state.frozenMask, state.bonusMask, src);
        const newBoard = cleared.board.map((r, ri) =>
          r.map((v, ci) => (ri === dst.row && ci === dst.col ? result : v)),
        );
        const newFrozenMask = cleared.frozenMask.map((r, ri) =>
          r.map((v, ci) => (ri === dst.row && ci === dst.col ? true : v)),
        );
        const newBonusMask = cleared.bonusMask.map((r, ri) =>
          r.map((v, ci) => (ri === dst.row && ci === dst.col ? false : v)),
        );
        return {
          ...state,
          board: newBoard,
          trophyMask: cleared.trophyMask,
          frozenMask: newFrozenMask,
          bonusMask: newBonusMask,
          dragSource: null,
          selection: [],
          selectionVal: 0,
          clearingPositions: [src],
          respawnPositions: [src],
          zeroRespawnPositions: [],
        };
      }

      // Case: result === target → trophy (§6.1).
      // dst board value is set to state.target so the trophy displays the target number.
      if (result === state.target) {
        const cleared = clearPos(state.board, state.trophyMask, state.frozenMask, state.bonusMask, src);
        const newBoard = cleared.board.map((r, ri) =>
          r.map((v, ci) => (ri === dst.row && ci === dst.col ? state.target : v)),
        );
        const newTrophyMask = cleared.trophyMask.map((r, ri) =>
          r.map((v, ci) => (ri === dst.row && ci === dst.col ? true : v)),
        );
        const newBonusMask = cleared.bonusMask.map((r, ri) =>
          r.map((v, ci) => (ri === dst.row && ci === dst.col ? false : v)),
        );
        return {
          ...state,
          board: newBoard,
          trophyMask: newTrophyMask,
          frozenMask: cleared.frozenMask,
          bonusMask: newBonusMask,
          trophyCount: state.trophyCount + 1,
          dragSource: null,
          selection: [],
          selectionVal: 0,
          clearingPositions: [src],
          respawnPositions: [src],
          zeroRespawnPositions: [],
          score: state.score + result,
          roundScore: state.roundScore + result,
        };
      }

      // Case: result < target → standard productive merge (§7.1 Case A).
      const cleared = clearPos(state.board, state.trophyMask, state.frozenMask, state.bonusMask, src);
      const mergedBoard = cleared.board.map((r, ri) =>
        r.map((v, ci) => (ri === dst.row && ci === dst.col ? result : v)),
      );
      return {
        ...state,
        board: mergedBoard,
        trophyMask: cleared.trophyMask,
        frozenMask: cleared.frozenMask,
        bonusMask: cleared.bonusMask,
        dragSource: null,
        selection: [],
        selectionVal: 0,
        clearingPositions: [src],
        respawnPositions: [src],
        zeroRespawnPositions: [],
      };
    }

    // ── BOMB_EXPLODE ─────────────────────────────────────────────────────────────
    // Destroys all tiles in a 3×3 region centered on `center`.
    // Sets clearingPositions + zeroRespawnPositions so the RESPAWNING effect fills them.
    case 'BOMB_EXPLODE': {
      const { center } = action;
      const destroyed: GridPos[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = center.row + dr;
          const c = center.col + dc;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            destroyed.push({ row: r, col: c });
          }
        }
      }
      let b = state.board;
      let tm = state.trophyMask;
      let fm = state.frozenMask;
      let bm = state.bonusMask;
      for (const pos of destroyed) {
        const cl = clearPos(b, tm, fm, bm, pos);
        b = cl.board; tm = cl.trophyMask; fm = cl.frozenMask; bm = cl.bonusMask;
      }
      return {
        ...state,
        board: b,
        trophyMask: tm,
        frozenMask: fm,
        bonusMask: bm,
        dragSource: null,
        selection: [],
        selectionVal: 0,
        clearingPositions: destroyed,
        respawnPositions: destroyed, // in-place refill (no gravity)
        zeroRespawnPositions: [],
      };
    }

    // ── SPAWN_BOMB ───────────────────────────────────────────────────────────────
    case 'SPAWN_BOMB': {
      const { pos } = action;
      const newBoard = state.board.map((r, ri) =>
        r.map((v, ci) => (ri === pos.row && ci === pos.col ? BOMB_TILE_VALUE : v)),
      );
      const newBonusMask = state.bonusMask.map((r, ri) =>
        r.map((v, ci) => (ri === pos.row && ci === pos.col ? false : v)),
      );
      const newFrozenMask = state.frozenMask.map((r, ri) =>
        r.map((v, ci) => (ri === pos.row && ci === pos.col ? false : v)),
      );
      return {
        ...state,
        board: newBoard,
        bonusMask: newBonusMask,
        frozenMask: newFrozenMask,
      };
    }

    // ── CLEAR_COMPLETE ───────────────────────────────────────────────────────────
    case 'CLEAR_COMPLETE': {
      const emptyBool = (): boolean[][] =>
        Array.from({ length: ROWS }, () => Array(COLS).fill(false) as boolean[]);
      const solvable = hasSolution(
        action.board, action.target, state.mode,
        emptyBool(), emptyBool(),
      );
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
        trophyMask: emptyBool(),
        frozenMask: emptyBool(),
        target: action.target,
        clearingPositions: [],
        respawnPositions: [],
        zeroRespawnPositions: [],
        selection: [],
        selectionVal: 0,
      };
    }

    // ── RESPAWN_COMPLETE ─────────────────────────────────────────────────────────
    case 'RESPAWN_COMPLETE': {
      let newBoard = state.board;
      let newBonusMask = state.bonusMask;
      let newFrozenMask = state.frozenMask;
      for (const { pos, value, isBonus } of action.respawns) {
        newBoard = newBoard.map((r, ri) =>
          r.map((v, ci) => (ri === pos.row && ci === pos.col ? value : v)),
        );
        newBonusMask = newBonusMask.map((r, ri) =>
          r.map((v, ci) => (ri === pos.row && ci === pos.col ? isBonus : v)),
        );
        // Frozen cleared implicitly (new tile is never frozen on spawn).
        newFrozenMask = newFrozenMask.map((r, ri) =>
          r.map((v, ci) => (ri === pos.row && ci === pos.col ? false : v)),
        );
      }
      const solvable = hasSolution(
        newBoard, state.target, state.mode,
        state.trophyMask, newFrozenMask,
      );
      return {
        ...state,
        phase: solvable ? 'SELECTING' : 'STALEMATE',
        board: newBoard,
        bonusMask: newBonusMask,
        frozenMask: newFrozenMask,
        clearingPositions: [],
        respawnPositions: [],
        zeroRespawnPositions: [],
      };
    }

    // ── ADVANCE_ROUND ────────────────────────────────────────────────────────────
    case 'ADVANCE_ROUND': {
      if (state.roundsCompleted >= ROUNDS_PER_SESSION) {
        return { ...state, phase: 'FINAL' };
      }
      const emptyBool = (): boolean[][] =>
        Array.from({ length: ROWS }, () => Array(COLS).fill(false) as boolean[]);
      return {
        ...state,
        phase: 'SELECTING',
        board: action.board,
        bonusMask: action.bonusMask,
        trophyMask: emptyBool(),
        frozenMask: emptyBool(),
        target: action.target,
        dragSource: null,
        selection: [],
        selectionVal: 0,
        roundScore: 0,
        timeLeft: ROUND_DURATION_SECS,
        clearingPositions: [],
        respawnPositions: [],
        zeroRespawnPositions: [],
      };
    }

    // ── RESOLVE_STALEMATE ────────────────────────────────────────────────────────
    case 'RESOLVE_STALEMATE': {
      return {
        ...state,
        phase: 'SELECTING',
        target: action.target,
        respawnPositions: [],
        zeroRespawnPositions: [],
      };
    }

    // ── PLAY_AGAIN ───────────────────────────────────────────────────────────────
    case 'PLAY_AGAIN':
      return action.newState;

    default:
      return state;
  }
}
