// [ROLE] Structural grid slot renderer.
// [STATUS] Phase 5 stub — available but not required by games during Phases 1–8.
// [CONTRACT] REBUILD_CONTRACT.md §4
//
// Renders a rows×cols CSS Grid container sized to exactly the computed pixel
// dimensions. Game components render their own tile elements as children inside
// this container. GridBoard owns no state, no input handling, and no sizing logic.
//
// HARD RESTRICTIONS (contract §4):
//   - NO render-prop pattern. This component does not accept renderTile, render,
//     or any function-as-child / slot-fill prop. Games use `children`.
//   - NO tile logic, NO input event handling, NO sizing computation.
//   - `cellSize` is provided by the caller — this component does not compute it.
//   - Must not import from src/games/, src/platform/, or src/systems/.
//   - CombineGrid and SpeedGrid must NOT import this file during Phases 1–8.
//     Each game uses its own components/Board.tsx during reconstruction.

import React from 'react';

export interface GridBoardProps {
  /** Number of tile rows on the board (must be ≥ 1). */
  rows: number;

  /** Number of tile columns on the board (must be ≥ 1). */
  cols: number;

  /**
   * Tile cell size in CSS pixels, pre-computed by the game's layout logic.
   * This component does NOT compute tile size — the caller is responsible.
   * See src/grid/GridSizing.ts for the canonical formula.
   */
  cellSize: number;

  /**
   * Gap between adjacent cells in CSS pixels.
   * Applied uniformly in both row and column directions.
   * Default: 0.
   */
  gap?: number;

  /** Additional CSS class names to apply to the board container element. */
  className?: string;

  /**
   * Game tile elements to render inside the board's slot grid.
   * GridBoard provides the geometry; games provide the tiles.
   *
   * NOTE: This is the ONLY way games supply tile content. There is no
   * renderTile prop, no slot-fill API, no function children. Plain children.
   */
  children?: React.ReactNode;
}

/**
 * GridBoard — structural grid slot renderer.
 *
 * Renders a CSS Grid container with `cols` columns and `rows` rows, each cell
 * exactly `cellSize × cellSize` pixels, separated by `gap` pixels. The outer
 * container is sized to exactly fit the grid (no overflow, no scrolling).
 *
 * Game components position their own tile elements inside this container.
 * GridBoard is a layout primitive only — it owns no state, no pointer events,
 * and no tile rendering logic.
 *
 * Future games may adopt GridBoard as their board container once parity is
 * verified (post-Phase-8 convergence). During reconstruction (Phases 1–8),
 * CombineGrid and SpeedGrid use their own frozen Board.tsx files.
 */
export function GridBoard({
  rows,
  cols,
  cellSize,
  gap = 0,
  className,
  children,
}: GridBoardProps): React.ReactElement {
  const totalWidth  = cols * cellSize + Math.max(0, cols - 1) * gap;
  const totalHeight = rows * cellSize + Math.max(0, rows - 1) * gap;

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows:    `repeat(${rows}, ${cellSize}px)`,
        gap:                 `${gap}px`,
        width:               `${totalWidth}px`,
        height:              `${totalHeight}px`,
        position:            'relative',
        // No transform:scale, no zoom, no viewport-unit sizing — contract §2.
        // Tile size is fixed by the caller via cellSize; this container just
        // holds the grid geometry exactly.
        flexShrink:          0,
      }}
    >
      {children}
    </div>
  );
}
