// [ROLE] Canonical tile-size formula for GridMath.
// [STATUS] Phase 5 stub — not imported by any game during Phases 1–8.
// [CONTRACT] REBUILD_CONTRACT.md §2, §3, §4
//
// This is the authoritative home of the tile-size formula established in §2.
// CombineGrid and SpeedGrid each own their own frozen board-sizing math during
// reconstruction. This module is the future migration target once parity is
// verified (post-Phase-8 convergence task).
//
// DO NOT import this file from src/games/ during Phases 1–8.

/**
 * Maximum tile size in CSS pixels.
 *
 * Upper bound for computeTileSize(). A tile will never be larger than this
 * regardless of available container space. Games that migrate to this module
 * must verify this value matches their own internal MAX_TILE_SIZE constant
 * before switching.
 */
export const MAX_TILE_SIZE = 96;

/**
 * Compute the largest square tile size (in CSS pixels) that fits a grid of
 * (rows × cols) tiles into a container of (availableHeight × availableWidth).
 *
 * This is the canonical implementation of REBUILD_CONTRACT.md §2:
 *
 *   tileSize = Math.min(
 *     Math.floor(availableHeight / rows),
 *     Math.floor(availableWidth  / cols),
 *     MAX_TILE_SIZE,
 *   )
 *
 * The result is always an integer (Math.floor ensures no fractional pixels).
 *
 * @param availableHeight  Container height in CSS pixels (content-box, after
 *                         padding and border are removed by the caller).
 * @param availableWidth   Container width in CSS pixels (content-box).
 * @param rows             Number of tile rows on the board (must be ≥ 1).
 * @param cols             Number of tile columns on the board (must be ≥ 1).
 * @returns                Integer tile size in CSS pixels, ≥ 0, ≤ MAX_TILE_SIZE.
 */
export function computeTileSize(
  availableHeight: number,
  availableWidth: number,
  rows: number,
  cols: number,
): number {
  return Math.min(
    Math.floor(availableHeight / rows),
    Math.floor(availableWidth / cols),
    MAX_TILE_SIZE,
  );
}
