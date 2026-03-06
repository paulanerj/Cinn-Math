/**
 * Shared animation timing tokens for all GridMath games.
 *
 * Rules:
 *  ANIM_FAST     — micro-feedback only (hover, tap, active press). Imperceptible as animation.
 *  ANIM_INTERACT — drag lift, tile pick-up, quick state responses. Felt but not noticed.
 *  ANIM_REVEAL   — deliberate reveal: factor glow, celebration states. Clearly visible.
 *
 * Usage:
 *  — Tile transitions:  outer wrapper uses ANIM_INTERACT, inner style uses ANIM_FAST
 *  — HUD buttons:       use ANIM_FAST for hover/active transitions
 *  — Factor glow:       CombineGrid bridges via FACTOR_REVEAL_DURATION_MS = ANIM_REVEAL
 *
 * SpeedGrid adoption: import these tokens instead of hardcoded durations in tile cells
 * and HUD buttons. No game logic is affected by this module.
 */

/** ms — micro-feedback: hover states, active press, icon button transitions */
export const ANIM_FAST = 100;

/** ms — drag lift, tile pick-up, quick visual response animations */
export const ANIM_INTERACT = 150;

/** ms — factor glow reveal, celebration animations, deliberate state reveals */
export const ANIM_REVEAL = 650;
