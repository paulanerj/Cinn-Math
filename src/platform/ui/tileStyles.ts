/**
 * Shared tile visual styling system for GridMath games.
 *
 * Defines the "lighting model" shared across all grid-based game tile renderers:
 *  — base depth shadow + top-shine (for colorful/dark tiles)
 *  — soft shadow variant (for light-background tiles: zero, one, trophy)
 *  — drag lift state (scale + elevated shadow)
 *  — zap/clear state shadow
 *  — number typography formula (proportional to tile size)
 *  — specular highlight overlay classes
 *
 * CombineGrid:  Tile.tsx imports from this module (Task 1 complete).
 * SpeedGrid:    Import these constants when adopting shared tile visuals.
 *               Wrap each grid cell with the drag/base shadow pattern.
 *
 * NOT in this module (game-specific):
 *  — Factor glow (CombineGrid — combineGridStyles.ts + uiTokens.ts)
 *  — Bomb / trophy / stone visuals (CombineGrid — Tile.tsx getVisuals())
 *  — Chain selection highlight (SpeedGrid)
 *  — Color palettes (each game defines its own)
 */

// ── Base shadow model ──────────────────────────────────────────────────────────

/** Standard depth: bottom shadow + top-shine inset for colorful/dark-background tiles */
export const TILE_BASE_SHADOW =
  '0 4px 0 rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.12)';

/** Soft variant: lighter depth for tiles with light backgrounds (zero, one, trophy) */
export const TILE_SOFT_SHADOW = '0 3px 0 rgba(0,0,0,0.22)';

// ── Drag state ────────────────────────────────────────────────────────────────

/** Uniform scale applied to a tile being dragged (lifted off the board) */
export const TILE_DRAG_SCALE = 1.18;

/**
 * Shadow while dragging: strong lift elevation + top-shine.
 * Paired with TILE_DRAG_SCALE for the full lift effect.
 */
export const TILE_DRAG_SHADOW =
  '0 20px 40px rgba(0,0,0,0.65), 0 6px 0 rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.15)';

// ── Zap / clear state ─────────────────────────────────────────────────────────

/** Shadow during zap/clear animation: cyan electric glow + jitter ring */
export const TILE_ZAP_SHADOW =
  '0 0 24px rgba(34,211,238,0.8), inset 0 0 12px rgba(34,211,238,0.3), 0 3px 0 rgba(0,0,0,0.2)';

// ── Typography ────────────────────────────────────────────────────────────────

/**
 * Returns inline style object for the tile number label.
 * Font size is proportional to tile pixel size; weight is always max.
 *
 * @param tileSize  Tile width/height in pixels
 */
export function tileTypography(tileSize: number): { fontSize: number; fontWeight: number } {
  return {
    fontSize:   tileSize * 0.45,
    fontWeight: 900,
  };
}

// ── Specular highlight ────────────────────────────────────────────────────────

/**
 * Tailwind class string for the top-left specular gradient overlay on every tile.
 * Render as a non-interactive `<div>` inside the tile's inner container.
 *
 * @example
 *   <div className={TILE_SPECULAR_CLASSES} />
 */
export const TILE_SPECULAR_CLASSES =
  'absolute inset-0 pointer-events-none bg-gradient-to-br from-white/20 to-transparent';
