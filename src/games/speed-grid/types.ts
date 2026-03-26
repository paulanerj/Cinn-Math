// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/types.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] SpeedGrid game state types and action discriminated union.
//        No React, no platform UI, no DOM — pure data types only.
//
// [INVARIANT] SGState is the single source of truth for all SpeedGrid state.
//             bonusMask[row][col] === true iff the tile at grid[row][col]
//             carries a time-bonus effect.  When grid[row][col] === 0
//             (empty cell), bonusMask[row][col] must be false.
//
// [COORDINATE] SpeedGrid uses ChainPos { row, col } from ChainSelector.
//              This differs from CombineGrid's GridPos { r, c } — the two
//              are intentionally divergent and must never be mixed.
// ─────────────────────────────────────────────────────────────────────────────

import type { ChainState, ChainPos } from '../../systems/ChainSelector';
import type { TimerState } from '../../systems/TimerSystem';
import type { ScoreState } from '../../systems/ScoreSystem';
import type { EvalMode } from '../../engine/TargetGenerator';

// Re-export ChainPos so callers import coordinates from this module.
export type { ChainPos };

// ── Phase ─────────────────────────────────────────────────────────────────────

/**
 * The four phases of a SpeedGrid session.
 *
 * WAITING_TO_START  Board visible; timer not started. First pointer-down starts it.
 * PLAYING           Active gameplay: timer running, input enabled.
 * CLEARING          Valid chain committed: gravity animating, input locked.
 * GAME_OVER         Timer expired: ResultScreen shown.
 */
export type SGPhase =
  | 'WAITING_TO_START'
  | 'PLAYING'
  | 'CLEARING'
  | 'GAME_OVER';

// ── Tile alias ────────────────────────────────────────────────────────────────

/**
 * SpeedGrid board cells store raw numeric values (number[][]).
 * Bonus-tile status is tracked separately in SGState.bonusMask.
 * This alias clarifies intent at call sites.
 */
export type SGTile = number;

// ── State ─────────────────────────────────────────────────────────────────────

/**
 * Complete SpeedGrid game state.
 *
 * [INVARIANT] bonusMask dimensions must equal grid dimensions at all times.
 *             bonusMask[r][c] corresponds to grid[r][c].
 *             After gravity the mask is remapped so bonus status follows
 *             its owning tile — see applyBonusMaskGravity() in SpeedGridGame.
 */
export interface SGState {
  /** Current phase of the game session. */
  phase: SGPhase;

  /**
   * Numeric board. 0 = empty (cleared) cell.
   * Non-zero = live tile with that displayed value.
   */
  grid: number[][];

  /**
   * Parallel boolean mask. true = the tile at this cell is a bonus tile
   * that awards extra seconds when cleared.
   */
  bonusMask: boolean[][];

  /** Active chain selection managed by ChainSelector. */
  chain: ChainState;

  /** The current target value the player must match by chaining tiles. */
  target: number;

  /**
   * Evaluation mode for chain → target matching.
   * SpeedGrid defaults to 'sum' (add the chain values).
   */
  mode: EvalMode;

  /** Countdown timer state. Managed by TimerSystem. */
  timer: TimerState;

  /** Score and combo streak state. Managed by ScoreSystem. */
  score: ScoreState;

  /** Total valid chains completed in this session. Shown on ResultScreen. */
  chainsCompleted: number;

  /** Total bonus tiles included in valid chains this session. */
  bonusesCollected: number;

  /**
   * The PRNG seed for this session.
   * [SEED LAW — Phase-8 Task-22] seed === the exact uint32 passed to makePrng()
   * that initialized the session PRNG. Stored in SGState so the session is
   * serializable for replay without access to the component's prngRef.
   */
  seed: number;

  /**
   * True for one render cycle after a wrong chain submission.
   * Drives the "Wrong!" flash feedback. Cleared by CLEAR_WRONG_FLASH.
   */
  wrongFlash: boolean;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type SGAction =
  /**
   * Pointer-down on a tile. Starts a new chain at pos.
   * If phase is WAITING_TO_START, also starts the countdown timer.
   */
  | { type: 'CHAIN_START'; pos: ChainPos }

  /**
   * Pointer-move enters a new tile while chain is active.
   * Extends the chain (or backtracks if re-entering second-to-last tile).
   */
  | { type: 'CHAIN_EXTEND'; pos: ChainPos }

  /**
   * Pointer-up: commits the current chain and evaluates it against the target.
   * If valid → phase transitions to CLEARING.
   * If invalid → combo resets, wrongFlash set.
   * If too short → chain silently cancelled.
   */
  | { type: 'CHAIN_COMMIT' }

  /**
   * Timer tick. Dispatched every 1 s by setInterval while phase === PLAYING.
   * If the timer expires, transitions phase to GAME_OVER.
   */
  | { type: 'TICK' }

  /**
   * Dispatched by the CLEARING effect after gravity animation completes.
   * Carries the fully-resolved new board, updated bonus mask, and next target.
   * The reducer transitions phase back to PLAYING.
   */
  | { type: 'GRAVITY_DONE'; grid: number[][]; bonusMask: boolean[][]; target: number }

  /**
   * Clears the wrongFlash flag after the feedback animation has played.
   * Dispatched by a setTimeout in SpeedGridGame after CHAIN_COMMIT sets wrongFlash.
   */
  | { type: 'CLEAR_WRONG_FLASH' }

  /**
   * Restart the game with a freshly initialised state.
   * newState is computed by the component (pure — no PRNG in reducer).
   */
  | { type: 'PLAY_AGAIN'; newState: SGState };
