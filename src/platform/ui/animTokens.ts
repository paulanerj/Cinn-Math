// [ROLE] Shared animation timing tokens for the GridMath platform.
// Both CombineGrid and SpeedGrid reference these constants to ensure
// consistent feel across all interactive elements.
//
// [WHY] Centralising timings prevents drift between game feel — if we
// change ANIM_INTERACT here, all callers stay in sync automatically.
//
// [INVARIANT] Values are in milliseconds, matching CSS transition durations.
// Do not convert to seconds — all callers expect ms numbers.

/** Fast micro-feedback: icon press, button tap. */
export const ANIM_FAST = 100;

/** Standard interactive response: tile selection, drag start. */
export const ANIM_INTERACT = 150;

/** Full reveal animation: score pop, phase transition, zap effect. */
export const ANIM_REVEAL = 650;
