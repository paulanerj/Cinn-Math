// [ROLE] Shared tile visual tokens for the GridMath platform.
// Defines the lighting model applied to all tile states across both games.
//
// [WHY] CombineGrid and SpeedGrid tiles share the same shadow/scale system
// so that game feel is consistent when users switch between them.
//
// [INVARIANT] Shadow strings are raw CSS box-shadow values — do not wrap
// them in `shadow-[...]` Tailwind syntax here; callers apply them via
// the style prop or a Tailwind arbitrary value at the call site.
//
// [FUTURE] If a third tile state is added (e.g. "locked"), add a new
// TILE_*_SHADOW constant here without touching existing callers.

/** Resting tile: subtle depth, neutral lighting. */
export const TILE_BASE_SHADOW =
  '0 2px 0 rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18)';

/** Hover / soft-focus state: lifted slightly off the surface. */
export const TILE_SOFT_SHADOW =
  '0 4px 0 rgba(0,0,0,0.35), 0 8px 16px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.22)';

/** Active drag state: tile is held by the user. */
export const TILE_DRAG_SHADOW =
  '0 8px 0 rgba(0,0,0,0.40), 0 16px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28)';

/** Zap / merge effect: bright glow for the merge moment. */
export const TILE_ZAP_SHADOW =
  '0 0 0 3px rgba(255,220,60,0.85), 0 8px 24px rgba(255,180,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)';

/** CSS transform scale applied while a tile is being dragged. */
export const TILE_DRAG_SCALE = 1.18;

/**
 * Returns inline font-size and line-height for a tile given its cell size.
 * Keeps digit labels legible across the full range of board geometries.
 *
 * [CONTRACT] cellSize is the computed pixel size (already min-clamped by
 * Board.tsx). Never call this with 0 — callers must guard before mounting.
 */
export function tileTypography(cellSize: number): { fontSize: number; lineHeight: string } {
  const fontSize = Math.round(cellSize * 0.38);
  return { fontSize, lineHeight: `${cellSize}px` };
}

/**
 * Tailwind utility classes that produce the specular highlight stripe
 * across the top edge of each tile (the "glossy" effect).
 *
 * [USAGE] Spread these classes onto the inner highlight <div> inside
 * each tile component.
 */
export const TILE_SPECULAR_CLASSES =
  'absolute inset-x-0 top-0 h-[38%] rounded-t-[inherit] pointer-events-none ' +
  'bg-gradient-to-b from-white/20 to-transparent';
