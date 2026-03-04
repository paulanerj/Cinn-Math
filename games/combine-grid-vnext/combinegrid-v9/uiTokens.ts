/* ⚠ UI CONTRACT PROTECTED
 This is the single source of truth for all Combine Grid geometry and glow constants.
 Do not add, remove, or modify values without updating COMBINE_GRID_UI_CONTRACT.md.
 No component may shadow these with locally-defined duplicates.
*/

// ── Grid sizing constants ──────────────────────────────────────────────────────
export const SAFE_MARGIN  = 5;   // px each side: viewport edge to board edge (mobile dominance policy)
export const BORDER_WIDTH = 5;   // px: board border thickness (all four sides)
export const GAP          = 2;   // px: gap between tiles
export const PAD          = 6;   // px: board inner padding (all sides)

// ── Tile geometry ──────────────────────────────────────────────────────────────
export const BASE_RADIUS_PX = 16; // px: base tile corner radius

// ── Factor glow tokens ─────────────────────────────────────────────────────────
export const FACTOR_WARM_OUTLINE       = 'rgba(249,115,22,0.55)';  // orange ring  (val > 1, is factor)
export const FACTOR_WARM_GLOW          = 'rgba(249,115,22,0.25)';  // orange halo  (val > 1, is factor)
export const FACTOR_ONE_OUTLINE        = 'rgba(56,189,248,0.55)';  // sky-blue ring (val === 1, is factor)
export const FACTOR_ONE_GLOW           = 'rgba(56,189,248,0.20)';  // sky-blue halo (val === 1, is factor)
export const FACTOR_REVEAL_DURATION_MS = 650;                       // ms: one-shot reveal animation duration
