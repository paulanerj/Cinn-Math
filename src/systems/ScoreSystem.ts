// ─────────────────────────────────────────────────────────────────────────────
// src/systems/ScoreSystem.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Generic scoring and combo mechanics for grid-based games.
//        Tracks cumulative score, combo streak, and multiplier calculation.
//        Provides pure state-update functions — no side effects, no storage.
//
// [WHY]  Both CombineGrid and SpeedGrid have scores and combo streaks.
//        Centralising this avoids both games independently implementing
//        slightly different combo logic that then diverges over time.
//        Any future game (SwapGrid, DestroyGrid) that wants scoring gets this
//        for free and stays consistent with the platform's feel.
//
// [FUTURE] If a future game needs a different multiplier curve (e.g. exponential
//          instead of linear), pass a custom `multiplierFn` to calculatePoints().
//          The default linear curve is preserved for existing games.
//          If a game needs "negative combo" (penalty for wrong guesses), add a
//          decrementCombo() function — do not modify incrementCombo().
//
// [LLM NOTE] No imports. No React. No DOM. No localStorage (persistence is
//            EngineSession's job). This module is pure functions + types.
//            Games lift ScoreState into their own React state and call these
//            functions from event handlers.
//
// [INVARIANT] score is always ≥ 0 (clamped on decrement).
//             comboCount is always ≥ 0.
//             The combo multiplier is always ≥ 1.0.
// ─────────────────────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────────

/**
 * All scoring state for one game session.
 *
 * [INVARIANT] score ≥ 0. comboCount ≥ 0.
 */
export interface ScoreState {
  /** Cumulative score for this session. */
  score: number;
  /** Number of consecutive successful matches without a miss. */
  comboCount: number;
  /**
   * Opaque key that changes whenever the combo resets.
   * React components use this as a `key` prop on the combo-bar element to
   * restart its CSS animation without needing an imperative animation call.
   *
   * [INVARIANT] This value is only meaningful to the UI layer. The score
   *             system sets it to a monotonically increasing integer on reset;
   *             the exact value does not matter, only that it changes.
   */
  comboResetKey: number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/** Returns the initial ScoreState for a new game session. */
export function createScoreState(): ScoreState {
  return { score: 0, comboCount: 0, comboResetKey: 0 };
}

// ── Multiplier ────────────────────────────────────────────────────────────────

/**
 * Calculates the score multiplier for a given combo count.
 *
 * Formula: multiplier = 1 + floor(comboCount / COMBO_TIER_SIZE) * MULTIPLIER_STEP
 *
 * Default tiers (every 3 combos adds 0.5×):
 *   combo 0–2  → 1.0×
 *   combo 3–5  → 1.5×
 *   combo 6–8  → 2.0×
 *   combo 9–11 → 2.5×
 *   …capped at MAX_MULTIPLIER
 *
 * [FUTURE] Games that want a different curve can pass a custom multiplierFn
 *          to calculatePoints(). This default is preserved as the platform standard.
 */
const COMBO_TIER_SIZE = 3;
const MULTIPLIER_STEP = 0.5;
const MAX_MULTIPLIER = 5.0;

export function comboMultiplier(comboCount: number): number {
  const raw = 1 + Math.floor(comboCount / COMBO_TIER_SIZE) * MULTIPLIER_STEP;
  return Math.min(raw, MAX_MULTIPLIER);
}

// ── Point calculation ─────────────────────────────────────────────────────────

/**
 * Calculates the points awarded for one successful match.
 *
 * @param basePoints   The raw point value of the match (e.g. sum of tile values,
 *                     or a fixed award per correct chain).
 * @param comboCount   The current combo streak BEFORE this match is recorded.
 *                     (The multiplier is applied using the pre-increment combo.)
 * @param multiplierFn Optional custom multiplier function. Defaults to comboMultiplier.
 *
 * [INVARIANT] Returns a positive integer ≥ 1. Always rounds up.
 */
export function calculatePoints(
  basePoints: number,
  comboCount: number,
  multiplierFn: (combo: number) => number = comboMultiplier,
): number {
  return Math.max(1, Math.ceil(basePoints * multiplierFn(comboCount)));
}

// ── State transitions ─────────────────────────────────────────────────────────

/**
 * Records a successful match: adds `points` to score and increments combo.
 *
 * [USAGE] Call after calculatePoints() has determined the award.
 *         The combo is incremented here, so pass the PRE-increment combo
 *         to calculatePoints() first.
 */
export function recordMatch(state: ScoreState, points: number): ScoreState {
  return {
    ...state,
    score: state.score + Math.max(0, points),
    comboCount: state.comboCount + 1,
  };
}

/**
 * Resets the combo streak to 0.
 * Called when the player makes a wrong guess or time expires on a round.
 *
 * [INVARIANT] comboResetKey is incremented so React can key off the change.
 */
export function resetCombo(state: ScoreState): ScoreState {
  return {
    ...state,
    comboCount: 0,
    comboResetKey: state.comboResetKey + 1,
  };
}

/**
 * Applies a score penalty (e.g. wrong guess, time bonus missed).
 * Score is clamped to 0 — it never goes negative.
 *
 * [INVARIANT] penalty ≥ 0. Pass a positive number to subtract.
 */
export function applyPenalty(state: ScoreState, penalty: number): ScoreState {
  return {
    ...state,
    score: Math.max(0, state.score - Math.max(0, penalty)),
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns the multiplier that will apply to the NEXT match.
 * (Based on the current comboCount before any increment.)
 */
export function nextMultiplier(state: ScoreState): number {
  return comboMultiplier(state.comboCount);
}

/**
 * Returns true if the current combo streak has reached a "tier boundary" —
 * i.e. the multiplier just increased. Use to trigger a visual tier-up effect.
 */
export function isAtTierBoundary(state: ScoreState): boolean {
  return state.comboCount > 0 && state.comboCount % COMBO_TIER_SIZE === 0;
}
