/**
 * GridBoard — shared board renderer for all GridMath games.
 *
 * Renders a 2D grid of tiles. The caller provides a `renderTile` prop so
 * each game can supply its own tile visuals without coupling this component
 * to any game-specific data shape.
 *
 * Sizing: delegates entirely to the parent (flex-1 / absolute fill).
 * Cell pixel size comes from `useGridMetrics` — passed down via `cellSize`.
 *
 * Phase A — Shared UI Extraction. No game logic here.
 */

import React from 'react';

export interface GridBoardProps {
  rows: number;
  cols: number;
  /** Tile pixel size (width = height). Supply from useGridMetrics or similar. */
  cellSize: number;
  /**
   * Render function called for every (row, col) position.
   * Must return a React node sized to `cellSize × cellSize`.
   */
  renderTile: (row: number, col: number, cellSize: number) => React.ReactNode;
  /** Optional extra className on the outer grid container */
  className?: string;
}

/**
 * Renders a `rows × cols` grid of cells using CSS grid.
 * Each cell is `cellSize × cellSize` px.
 */
export const GridBoard: React.FC<GridBoardProps> = ({
  rows,
  cols,
  cellSize,
  renderTile,
  className = '',
}) => {
  if (cellSize <= 0) return null;

  return (
    <div
      className={`relative ${className}`}
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        width: cols * cellSize,
        height: rows * cellSize,
      }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <div
            key={`${r}-${c}`}
            style={{ width: cellSize, height: cellSize, position: 'relative' }}
          >
            {renderTile(r, c, cellSize)}
          </div>
        ))
      )}
    </div>
  );
};

export default GridBoard;
