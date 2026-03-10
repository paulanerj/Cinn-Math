// ─────────────────────────────────────────────────────────────────────────────
// src/systems/TimerSystem.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Generic countdown and countup timer for grid-based games.
//        Manages remaining time, running/paused state, and time bonuses.
//        All transitions are pure state updates — no setInterval, no DOM.
//
// [WHY]  SpeedGrid needs a countdown timer with time-bonus mechanics (clearing
//        tiles with bonus values adds seconds). Future timed games need the
//        same primitive. Centralising it here means the timer behaviour is
//        tested once and reused everywhere.
//
// [FUTURE] If a future game needs a countup timer (e.g. "fastest clear" mode),
//          use direction: 'countup'. The tick() function increments instead
//          of decrementing. isExpired() is not meaningful for countup timers —
//          those games check elapsedSeconds instead.
//          If sub-second precision is needed, change the unit to milliseconds
//          by adding a `tickMs` field to TimerState without touching existing
//          callers that rely on the default 1-second tick.
//
// [LLM NOTE] No imports. No React. No DOM. No setTimeout/setInterval.
//            The game component owns the interval (typically via useEffect)
//            and calls tick() on each firing. This module only defines what
//            tick() does to the state — not when it fires.
//
// [INVARIANT] remainingSeconds ≥ 0 for countdown timers (clamped on tick).
//             elapsedSeconds ≥ 0 always.
//             isRunning can be true even when remainingSeconds === 0 — the
//             game component must check isExpired() and stop the interval.
// ─────────────────────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────────

/** Whether the timer counts down to zero or counts up from zero. */
export type TimerDirection = 'countdown' | 'countup';

/**
 * Full state of one timer.
 *
 * [INVARIANT] remainingSeconds is only meaningful for 'countdown' timers.
 *             elapsedSeconds is meaningful for both directions.
 *             totalSeconds is the value passed to createTimer() — it does
 *             not change during the timer's lifetime.
 */
export interface TimerState {
  /** The direction this timer counts. Set at creation; never changes. */
  readonly direction: TimerDirection;
  /** The starting value (seconds) for countdown timers. 0 for countup. */
  readonly totalSeconds: number;
  /** Seconds remaining (countdown) or seconds elapsed (countup). */
  remainingSeconds: number;
  /** Total seconds elapsed since the timer started (or was last reset). */
  elapsedSeconds: number;
  /** True if the timer is actively ticking. */
  isRunning: boolean;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a new TimerState. Does NOT start the timer — call start() or
 * use `{ ...timer, isRunning: true }` to begin.
 *
 * @param totalSeconds  For countdown: time limit. For countup: pass 0.
 * @param direction     'countdown' (default) or 'countup'.
 *
 * [INVARIANT] totalSeconds ≥ 0.
 */
export function createTimer(
  totalSeconds: number,
  direction: TimerDirection = 'countdown',
): TimerState {
  return {
    direction,
    totalSeconds,
    remainingSeconds: direction === 'countdown' ? totalSeconds : 0,
    elapsedSeconds: 0,
    isRunning: false,
  };
}

// ── State transitions ─────────────────────────────────────────────────────────

/**
 * Starts the timer. No-op if already running.
 */
export function startTimer(state: TimerState): TimerState {
  return state.isRunning ? state : { ...state, isRunning: true };
}

/**
 * Pauses the timer. No-op if already paused.
 */
export function pauseTimer(state: TimerState): TimerState {
  return !state.isRunning ? state : { ...state, isRunning: false };
}

/**
 * Advances the timer by one tick (one second by default).
 *
 * - Countdown: decrements remainingSeconds (clamped to 0).
 * - Countup:   increments elapsedSeconds without bound.
 * - Always increments elapsedSeconds.
 *
 * [INVARIANT] Should only be called when isRunning === true, but is safe
 *             to call when paused (it just does nothing visible because the
 *             game component should not be ticking a paused timer).
 *
 * @param state     Current timer state.
 * @param tickSecs  Seconds per tick. Default 1. Pass a sub-second value for
 *                  higher-resolution timers.
 */
export function tick(state: TimerState, tickSecs = 1): TimerState {
  if (!state.isRunning) return state;

  const elapsed = state.elapsedSeconds + tickSecs;

  if (state.direction === 'countdown') {
    const remaining = Math.max(0, state.remainingSeconds - tickSecs);
    return { ...state, remainingSeconds: remaining, elapsedSeconds: elapsed };
  } else {
    // countup: remainingSeconds not used — track elapsed only
    return {
      ...state,
      remainingSeconds: elapsed,
      elapsedSeconds: elapsed,
    };
  }
}

/**
 * Adds `seconds` to the remaining time (countdown only).
 * Used for time-bonus tile mechanics (clearing a bonus tile grants extra time).
 *
 * [INVARIANT] seconds may be negative (time penalty). remainingSeconds is
 *             clamped to [0, ∞) — it cannot go negative.
 * [INVARIANT] Has no effect on countup timers (silently returns unchanged state).
 */
export function addTime(state: TimerState, seconds: number): TimerState {
  if (state.direction !== 'countdown') return state;
  return {
    ...state,
    remainingSeconds: Math.max(0, state.remainingSeconds + seconds),
  };
}

/**
 * Resets the timer to its initial values but preserves direction and totalSeconds.
 * isRunning is set to false — call startTimer() to restart.
 */
export function resetTimer(state: TimerState): TimerState {
  return createTimer(state.totalSeconds, state.direction);
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns true if a countdown timer has reached zero.
 * Always false for countup timers.
 *
 * [USAGE] Game components check this after each tick() to decide whether to
 *         trigger game-over.
 */
export function isExpired(state: TimerState): boolean {
  return state.direction === 'countdown' && state.remainingSeconds <= 0;
}

/**
 * Returns true if the timer is in its final `warningSeconds` of countdown.
 * Use to trigger urgency visuals (red flash, beeping).
 *
 * [INVARIANT] Always false for countup timers or if timer has already expired.
 */
export function isInWarningZone(state: TimerState, warningSeconds = 10): boolean {
  return (
    state.direction === 'countdown' &&
    state.remainingSeconds > 0 &&
    state.remainingSeconds <= warningSeconds
  );
}

/**
 * Returns a [0, 1] progress fraction for a countdown timer.
 *   1.0 = full time remaining
 *   0.0 = expired
 *
 * [USAGE] Drive a countdown progress bar width.
 * [INVARIANT] Returns 0 if totalSeconds === 0 (avoids divide-by-zero).
 */
export function countdownProgress(state: TimerState): number {
  if (state.totalSeconds === 0) return 0;
  return Math.max(0, Math.min(1, state.remainingSeconds / state.totalSeconds));
}
