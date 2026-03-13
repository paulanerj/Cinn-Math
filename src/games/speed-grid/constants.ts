// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/constants.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] SpeedGrid gameplay tuning constants.
//        All values are explicit and game-specific — do not derive from
//        CombineGrid constants or share values cross-game.
//
// [INVARIANT] ROWS * COLS must equal the tile count passed to spawnBoard().
//             TIMER_WARNING_SECS < ROUND_DURATION_SECS.
//             BONUS_TIME_SECS ≥ 1.
// ─────────────────────────────────────────────────────────────────────────────

/** Number of rows on the SpeedGrid board. */
export const ROWS = 5;

/** Number of columns on the SpeedGrid board. */
export const COLS = 4;

/**
 * Minimum number of tiles required to form an evaluatable chain.
 * Chains shorter than this are silently cancelled on pointer-up.
 */
export const CHAIN_MIN_LENGTH = 2;

/**
 * Seconds remaining at which the timer progress bar turns red.
 * Drives isInWarningZone() in TimerSystem.
 */
export const TIMER_WARNING_SECS = 10;

/**
 * Total session duration in seconds for one SpeedGrid game.
 * The countdown does NOT begin until the player makes their first gesture.
 */
export const ROUND_DURATION_SECS = 60;

/**
 * Seconds added to the timer for each bonus tile included in a valid chain.
 * Three bonus tiles cleared in one chain → +3 × BONUS_TIME_SECS.
 */
export const BONUS_TIME_SECS = 3;
