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

import { applyBonusMaskGravity } from '../../systems/BonusMaskSystem';
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

// [NOTE] applyBonusMaskGravity and its laws are in src/systems/BonusMaskSystem.ts.
//        Imported at the top of this file and re-exported below for existing
//        callers that imported it from here during Phase-8 development.
export { applyBonusMaskGravity } from '../../systems/BonusMaskSystem';

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
