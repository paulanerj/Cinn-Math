// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/uiTokens.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] SpeedGrid layout constants, board-sizing formula, and tile colour
//        mapping.  Platform-visual tokens (shadows, specular) are imported
//        from src/platform/ui/tileStyles.ts at the component level — this
//        file owns only what is SpeedGrid-specific.
//
// [INVARIANT] HUD_TOP_H = 54 must match HUDShell.tsx's hardcoded height.
//             MAX_TILE_SIZE = 96 mirrors GridSizing.ts but is copied here
//             because SpeedGrid must NOT import src/grid/ during Phases 1–8.
//             computeTileSize() must use Math.floor for both axes and must
//             cap the result at MAX_TILE_SIZE.
// ─────────────────────────────────────────────────────────────────────────────

// ── Layout reservation constants ─────────────────────────────────────────────

/** Height of HUDTopBar in CSS pixels. Must stay in sync with HUDShell.tsx. */
export const HUD_TOP_H = 54;

/** Height reserved for the bottom chrome (target display + combo strip). */
export const HUD_BOT_H = 72;

/** Minimum safe margin subtracted from available width/height before sizing. */
export const SAFE_MARGIN = 16;

/** Pixel gap between adjacent tiles in both axes. */
export const GAP = 4;

/**
 * Maximum tile edge length in CSS pixels.
 *
 * [SOURCE] Mirrors MAX_TILE_SIZE = 96 in src/grid/GridSizing.ts.
 *          Copied here — SpeedGrid does not import GridSizing during Phase 7.
 */
export const MAX_TILE_SIZE = 96;

// ── Tile sizing formula ───────────────────────────────────────────────────────

/**
 * Computes the CSS pixel size of each square tile given the current viewport.
 *
 * Formula:
 *   availH = viewportH − HUD_TOP_H − HUD_BOT_H − SAFE_MARGIN
 *   availW = viewportW − SAFE_MARGIN
 *   tileSize = Math.min(
 *     Math.floor(availH / rows),
 *     Math.floor(availW / cols),
 *     MAX_TILE_SIZE,
 *   )
 *
 * [INVARIANT] Returns an integer ≥ 1. Never fractional.
 * [INVARIANT] Does NOT use CombineGrid's magic (-32)/(-16) offset artifacts —
 *             offsets here are derived from explicit layout constants.
 *
 * @param viewportW  window.innerWidth (CSS pixels)
 * @param viewportH  window.innerHeight (CSS pixels)
 * @param rows       Board row count (ROWS constant)
 * @param cols       Board column count (COLS constant)
 */
export function computeTileSize(
  viewportW: number,
  viewportH: number,
  rows: number,
  cols: number,
): number {
  const availH = viewportH - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN;
  const availW = viewportW - SAFE_MARGIN;
  return Math.max(
    1,
    Math.min(
      Math.floor(availH / rows),
      Math.floor(availW / cols),
      MAX_TILE_SIZE,
    ),
  );
}

// ── Tile colour config ────────────────────────────────────────────────────────

/**
 * Background colour for a SpeedGrid tile based on its numeric value.
 * Blue → indigo → violet spectrum, matching SpeedGrid's visual identity
 * (contrast with CombineGrid's orange identity).
 *
 * [INVARIANT] Always returns a valid CSS colour string.
 */
export function tileBaseColor(value: number): string {
  if (value <= 2)  return '#1e3a8a'; // blue-900
  if (value <= 4)  return '#1e40af'; // blue-800
  if (value <= 6)  return '#1d4ed8'; // blue-700
  if (value <= 8)  return '#2563eb'; // blue-600
  if (value <= 10) return '#4f46e5'; // indigo-600
  if (value <= 12) return '#6366f1'; // indigo-500
  return '#7c3aed';                   // violet-600  (13+)
}

/** Text colour for tile value labels — white on dark SpeedGrid backgrounds. */
export const TILE_TEXT_COLOR = '#ffffff';

/**
 * Semi-transparent overlay applied to tiles that are currently in the chain.
 * Produces a warm yellow tint on top of the tile's base colour.
 */
export const CHAIN_HIGHLIGHT_COLOR = 'rgba(255, 235, 80, 0.30)';

/**
 * Box-shadow applied to bonus tiles when NOT in the chain.
 * Gold glow ring to distinguish them from plain tiles.
 */
export const BONUS_GLOW =
  '0 0 0 3px rgba(251,191,36,0.70), 0 0 14px rgba(251,191,36,0.40)';

/** Border colour used on bonus tiles (amber-400). */
export const BONUS_BORDER_COLOR = '#fbbf24';

/** Border width in pixels for the bonus-tile ring. */
export const BONUS_BORDER_WIDTH = 2;
