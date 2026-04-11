// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/components/Board.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// [PHASE 1]  onTilePress / onTileHover removed — pointer handling is fully
//            lifted to CombineGridGame's container div.  Board is now a pure
//            display component; tiles carry data-row / data-col for hit testing.
//
// [PHASE 2]  tileOverlay — CombineGridGame passes the computed equation
//            overlay ({label, color}) for the tile at dropTarget.  Board routes
//            it to exactly that tile's eqOverlay prop.
//
// [PHASE 3]  poppingPos  — the dst tile receives isPopping for one frame.
// [PHASE 4]  spawnedPositions — src tile receives isSpawning after respawn.
//
// [PURITY]   Pure display; no dispatch, no PRNG, no local state.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import Tile from './Tile';
import { GridPos } from '../types';
import { GAP } from '../uiTokens';
import { isSelected } from '../services/SelectionService';

// ── Props ─────────────────────────────────────────────────────────────────────

interface BoardProps {
  grid: number[][];
  tileSize: number;
  selection: GridPos[];
  clearingPositions: GridPos[];
  trophyMask: boolean[][];
  dragSource: GridPos | null;
  dropTarget: GridPos | null;
  /** Phase 3: position of the tile that should play the merge-pop animation. */
  poppingPos: GridPos | null;
  /** Phase 4: positions of tiles that should play the spawn-pop animation. */
  spawnedPositions: GridPos[];
  /**
   * Phase 2: equation preview for the drop-target tile.
   * Board forwards this to the Tile at dropTarget.  Null when no drag active.
   */
  tileOverlay: { label: string; color: string } | null;
  /**
   * Ref forwarded to the board's outer padding box so CombineGridGame can
   * compute screen-space tile centres for particle placement (Phase 5).
   */
  boardRef: React.RefObject<HTMLDivElement | null>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Board({
  grid,
  tileSize,
  selection,
  clearingPositions,
  trophyMask,
  dragSource,
  dropTarget,
  poppingPos,
  spawnedPositions,
  tileOverlay,
  boardRef,
}: BoardProps) {
  const cols = grid[0]?.length ?? 4;

  return (
    <div
      ref={boardRef}
      style={{
        background: 'rgba(0,0,0,0.30)',
        borderRadius: 12,
        padding: 6,
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.40)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
          gap: GAP,
        }}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const pos: GridPos = { row: r, col: c };
            const isDropTgt = dropTarget !== null && dropTarget.row === r && dropTarget.col === c;
            return (
              <Tile
                key={`${r},${c}`}
                val={val}
                size={tileSize}
                row={r}
                col={c}
                selected={isSelected(selection, pos)}
                clearing={clearingPositions.some((p) => p.row === r && p.col === c)}
                isTrophy={trophyMask[r]?.[c] ?? false}
                isDragSource={dragSource !== null && dragSource.row === r && dragSource.col === c}
                isDropTarget={isDropTgt}
                isPopping={poppingPos !== null && poppingPos.row === r && poppingPos.col === c}
                isSpawning={spawnedPositions.some((p) => p.row === r && p.col === c)}
                eqOverlay={isDropTgt && tileOverlay !== null ? tileOverlay : undefined}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
