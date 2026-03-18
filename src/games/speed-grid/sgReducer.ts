// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/sgReducer.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Pure SpeedGrid game logic: bonus-mask helper, initGame, sgReducer.
//        Extracted from SpeedGridGame.tsx so the deterministic test harness
//        can import these functions without pulling in React or any DOM code.
//
// [INVARIANT] Zero React imports. No side effects at module level.
//             SpeedGridGame.tsx imports FROM here — not the other way.
// ─────────────────────────────────────────────────────────────────────────────

import type { PracticeProfile } from '../../engine/PracticeProfile';
import {
  spawnBoard,
  gridFromSpawn,
  generateTarget,
  evaluate,
  chainMatchesTarget,
} from '../../engine/public';
import {
  emptyChain,
  startChain,
  tryExtend,
  commitChain,
  isChainReadyToEvaluate,
} from '../../systems/ChainSelector';
import {
  createTimer,
  startTimer,
  tick,
  isExpired,
  addTime,
} from '../../systems/TimerSystem';
import {
  createScoreState,
  calculatePoints,
  recordMatch,
  resetCombo,
} from '../../systems/ScoreSystem';
import type { SGState, SGAction } from './types';
import {
  ROWS,
  COLS,
  CHAIN_MIN_LENGTH,
  ROUND_DURATION_SECS,
  BONUS_TIME_SECS,
} from './constants';

// ── Bonus mask gravity ────────────────────────────────────────────────────────

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ClearedPositionsLaw                                       Phase-8 Task-8│
// │                                                                         │
// │ • clearedPositions is the EXACT set of grid coordinates cleared by the  │
// │   most recent valid CHAIN_COMMIT.                                       │
// │ • Coordinates are taken from the reducer's CHAIN_COMMIT snapshot,       │
// │   BEFORE any gravity mutation.                                          │
// │ • No position outside that commit snapshot may appear in               │
// │   clearedPositions.                                                     │
// │ • Duplicates are FORBIDDEN.                                             │
// │ • Order is irrelevant; set semantics apply.                             │
// │ • clearedPositions must be derivable deterministically from:            │
// │     – preGravGrid (the post-clear grid where cleared cells are 0)       │
// │     – state.chain.positions (single-chain era)                          │
// │ • clearedPositions is NOT recorded for replay; it is re-derived.        │
// │                                                                         │
// │ This law exists to enable future multi-chain union clears without       │
// │ changing BonusMask semantics.                                           │
// └─────────────────────────────────────────────────────────────────────────┘

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ GravitySnapshotBoundaryLaw                                Phase-8 Task-8│
// │                                                                         │
// │ • preGravGrid is the reducer grid AFTER CHAIN_COMMIT mutation           │
// │   (cleared tiles set to zero) and BEFORE any GravitySystem call.       │
// │ • clearedPositions refers to positions that were non-zero BEFORE commit │
// │   and are zero AFTER commit.                                            │
// │ • BonusMask evolution Stage-1 dual-path assertion must compare:         │
// │     A. explicit clearedPositions path                                   │
// │     B. zero-inference path                                              │
// │ • Any mismatch indicates a snapshot timing violation.                   │
// └─────────────────────────────────────────────────────────────────────────┘

// BONUSMASK EVOLUTION STAGE-1
// clearedPositions additive migration path
// preGravGrid zero-inference scheduled for removal in Stage-3

/**
 * Applies the same column-compaction logic as GravitySystem to the bonus mask.
 * Called in the CLEARING effect after gravity so bonus status follows its tile.
 *
 * Algorithm (per column):
 *   1. Collect surviving tile bonus values bottom-to-top.
 *   2. Place them at the bottom of the new mask (mirrors gravity compaction).
 *   3. Fill remaining top rows with spawn bonuses from spawnBonuses[col][idx].
 *
 * Stage-1 migration: accepts optional clearedPositions for explicit survivor
 * determination. When provided, cleared cells are identified by position rather
 * than preGravGrid zero-inference. Both paths produce identical results today;
 * a dev assertion enforces this invariant during migration.
 */
export function applyBonusMaskGravity(
  oldMask: boolean[][],
  preGravGrid: number[][],
  spawnBonuses: boolean[][],
  rows: number,
  cols: number,
  clearedPositions?: ReadonlyArray<{ row: number; col: number }>,
): boolean[][] {
  if (clearedPositions !== undefined) {
    // --- AssertClearedPositionsIntegrity (Phase-8 Task-8) ---
    // Validates ClearedPositionsLaw before any mask computation:
    //   1. No duplicates: Set key count must equal array length.
    //   2. Every declared cleared position must be zero in preGravGrid
    //      (confirming GravitySnapshotBoundaryLaw — snapshot taken post-commit).
    // NOTE: Chain-length equality (positions.length === chain.positions.length)
    // is enforced by Stage-2 callers; the function cannot verify it without
    // receiving the chain length as a parameter.
    if (process.env.NODE_ENV !== 'production') {
      const keySet = new Set<string>(
        clearedPositions.map(({ row, col }) => `${row},${col}`),
      );
      if (keySet.size !== clearedPositions.length) {
        throw new Error(
          `[BONUSMASK EVOLUTION] AssertClearedPositionsIntegrity: ` +
            `duplicate positions detected. ` +
            `array length=${clearedPositions.length}, unique=${keySet.size}.`,
        );
      }
      for (const { row, col } of clearedPositions) {
        if (preGravGrid[row]?.[col] !== 0) {
          throw new Error(
            `[BONUSMASK EVOLUTION] AssertClearedPositionsIntegrity: ` +
              `position [${row},${col}] is declared cleared but ` +
              `preGravGrid[${row}][${col}]=${String(preGravGrid[row]?.[col])} (expected 0). ` +
              `Snapshot timing violation — preGravGrid must be post-commit.`,
          );
        }
      }
    }

    // --- Explicit cleared-position path ---
    // Build O(1) lookup set from authoritative cleared list.
    const clearedSet = new Set<string>(
      clearedPositions.map(({ row, col }) => `${row},${col}`),
    );

    const explicitResult = _computeBonusMask(
      oldMask,
      rows,
      cols,
      spawnBonuses,
      (r, c) => !clearedSet.has(`${r},${c}`),
    );

    // --- ZeroInferenceParityLaw guard (Phase-8 Task-8) ---
    // Confirms Stage-1 dual-path equality: explicit result must deep-equal
    // the zero-inference result. A mismatch means clearedPositions and
    // preGravGrid disagree — this is a snapshot timing violation.
    // This guard must remain until Stage-3 removes the zero-inference path.
    if (process.env.NODE_ENV !== 'production') {
      const inferredResult = _computeBonusMask(
        oldMask,
        rows,
        cols,
        spawnBonuses,
        (r, c) => preGravGrid[r][c] !== 0,
      );
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (explicitResult[r][c] !== inferredResult[r][c]) {
            throw new Error(
              `[BONUSMASK EVOLUTION] ZeroInferenceParityLaw violated at [${r}][${c}]: ` +
                `explicit=${String(explicitResult[r][c])}, ` +
                `inferred=${String(inferredResult[r][c])}. ` +
                `clearedPositions and preGravGrid zero-inference disagree.`,
            );
          }
        }
      }
    }

    return explicitResult;
  }

  // --- Zero-inference fallback (scheduled for removal in Stage-3) ---
  // Surviving tiles identified by preGravGrid[r][c] !== 0.
  return _computeBonusMask(
    oldMask,
    rows,
    cols,
    spawnBonuses,
    (r, c) => preGravGrid[r][c] !== 0,
  );
}

/**
 * Shared column-compaction kernel used by both survivor-determination paths.
 * @param isSurvivor - returns true when the tile at (r, c) survived clearing.
 */
function _computeBonusMask(
  oldMask: boolean[][],
  rows: number,
  cols: number,
  spawnBonuses: boolean[][],
  isSurvivor: (r: number, c: number) => boolean,
): boolean[][] {
  const newMask: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  );

  for (let c = 0; c < cols; c++) {
    const surviving: boolean[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (isSurvivor(r, c)) {
        surviving.push(oldMask[r][c]);
      }
    }
    for (let i = 0; i < surviving.length; i++) {
      newMask[rows - 1 - i][c] = surviving[i];
    }
    const spawnCount = rows - surviving.length;
    const colSpawns = spawnBonuses[c] ?? [];
    for (let i = 0; i < spawnCount; i++) {
      newMask[i][c] = colSpawns[i] ?? false;
    }
  }

  return newMask;
}

// ── initGame ──────────────────────────────────────────────────────────────────

/**
 * Produces the initial SGState for a new or restarted session.
 * Not a reducer — called once at mount and once per Play Again.
 * Advances `prng` by (ROWS * COLS * 2) + target-generation calls.
 */
export function initGame(
  profile: PracticeProfile,
  prng: () => number,
): SGState {
  const spawnedTiles = spawnBoard(ROWS, COLS, profile, prng);
  const grid = gridFromSpawn(ROWS, COLS, spawnedTiles);
  const bonusMask: boolean[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => spawnedTiles[r * COLS + c].isBonus),
  );
  const target = generateTarget(grid, ROWS, COLS, 'sum', profile, prng);

  return {
    phase: 'WAITING_TO_START',
    grid,
    bonusMask,
    chain: emptyChain(),
    target,
    mode: 'sum',
    timer: createTimer(ROUND_DURATION_SECS, 'countdown'),
    score: createScoreState(),
    chainsCompleted: 0,
    bonusesCollected: 0,
    wrongFlash: false,
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function sgReducer(state: SGState, action: SGAction): SGState {
  switch (action.type) {

    case 'CHAIN_START': {
      if (state.phase === 'WAITING_TO_START') {
        return {
          ...state,
          phase: 'PLAYING',
          timer: startTimer(state.timer),
          chain: startChain(action.pos),
        };
      }
      if (state.phase === 'PLAYING') {
        return { ...state, chain: startChain(action.pos) };
      }
      return state;
    }

    case 'CHAIN_EXTEND': {
      if (state.phase !== 'PLAYING' && state.phase !== 'WAITING_TO_START')
        return state;
      if (!state.chain.isActive) return state;
      const newChain = tryExtend(state.chain, action.pos);
      if (newChain === state.chain) return state;
      return { ...state, chain: newChain };
    }

    case 'CHAIN_COMMIT': {
      // FUTURE LAW — MultiChainUnionClear (Phase-8 Task-8 forward guard)
      // In the multi-chain era, clearedPositions will become union(all committed chains).
      // Gravity will trigger only when all active pointers release.
      // Do NOT encode single-chain assumptions here (e.g. "positions === chain.positions").
      // The single-chain derivation below is valid only for the single-chain era.
      //
      // Phase-8 Task-8 confirms no entropy boundary movement:
      // No new PRNG calls, no spawnTile token consumption changes, and no
      // generateTarget call-order changes are introduced in this case branch.
      if (state.phase !== 'PLAYING') return state;

      const committed = commitChain(state.chain);

      // Too short — silently cancel.
      if (!isChainReadyToEvaluate(committed, CHAIN_MIN_LENGTH)) {
        return { ...state, chain: emptyChain() };
      }

      const positions = committed.positions;
      const values = positions.map((p) => state.grid[p.row][p.col]);

      // Wrong answer.
      if (!chainMatchesTarget(values, state.target, state.mode)) {
        return {
          ...state,
          chain: emptyChain(),
          score: resetCombo(state.score),
          wrongFlash: true,
        };
      }

      // Valid chain.
      const bonusCount = positions.filter(
        (p) => state.bonusMask[p.row][p.col],
      ).length;

      const basePoints = evaluate(values, state.mode);
      const points = calculatePoints(basePoints, state.score.comboCount);
      const newScore = recordMatch(state.score, points);

      let newTimer = state.timer;
      if (bonusCount > 0) {
        newTimer = addTime(newTimer, BONUS_TIME_SECS * bonusCount);
      }

      const cleared = new Set(positions.map((p) => `${p.row},${p.col}`));
      const newGrid = state.grid.map((row, ri) =>
        row.map((v, ci) => (cleared.has(`${ri},${ci}`) ? 0 : v)),
      );
      const newBonusMask = state.bonusMask.map((row, ri) =>
        row.map((v, ci) => (cleared.has(`${ri},${ci}`) ? false : v)),
      );

      return {
        ...state,
        phase: 'CLEARING',
        grid: newGrid,
        bonusMask: newBonusMask,
        chain: emptyChain(),
        score: newScore,
        timer: newTimer,
        chainsCompleted: state.chainsCompleted + 1,
        bonusesCollected: state.bonusesCollected + bonusCount,
      };
    }

    case 'TICK': {
      if (state.phase !== 'PLAYING') return state;
      const newTimer = tick(state.timer);
      if (isExpired(newTimer)) {
        return {
          ...state,
          timer: newTimer,
          phase: 'GAME_OVER',
          chain: emptyChain(),
        };
      }
      return { ...state, timer: newTimer };
    }

    case 'GRAVITY_DONE': {
      if (state.phase !== 'CLEARING') return state;
      return {
        ...state,
        phase: 'PLAYING',
        grid: action.grid,
        bonusMask: action.bonusMask,
        target: action.target,
      };
    }

    case 'CLEAR_WRONG_FLASH': {
      return { ...state, wrongFlash: false };
    }

    case 'PLAY_AGAIN': {
      return action.newState;
    }

    default:
      return state;
  }
}
