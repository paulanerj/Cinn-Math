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
// [TASK 2]   mergeHighlight — drop-target tile border varies by result.
// [TASK 3]   SVG connector line between dragSource and dropTarget.
// [TASK 4]   isShaking — triggers cgBoardShake CSS animation on the board.
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
   * Task 2: merge result classification passed to the drop-target tile so its
   * border/shadow can reflect the merge outcome during drag.
   */
  mergeHighlight: 'invalid' | 'valid' | 'trophy' | null;
  /**
   * Task 4: when true, the board plays the cgBoardShake CSS animation.
   */
  isShaking: boolean;
  /**
   * Ref forwarded to the board's outer padding box so CombineGridGame can
   * compute screen-space tile centres for particle placement (Phase 5).
   */
  boardRef: React.RefObject<HTMLDivElement | null>;
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── SVG connector helpers ─────────────────────────────────────────────────────

/** Pixel offset from board left/top edge to centre of a tile cell. */
function tileCx(index: number, tileSize: number): number {
  // 6px board padding + index * (tileSize + 2px gap) + half tile
  return 6 + index * (tileSize + GAP) + tileSize / 2;
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
  mergeHighlight,
  isShaking,
  boardRef,
}: BoardProps) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 4;

  // Task 3 — SVG connector: compute endpoints when both src and dst are known.
  const svgLine =
    dragSource !== null && dropTarget !== null
      ? {
          x1: tileCx(dragSource.col, tileSize),
          y1: tileCx(dragSource.row, tileSize),
          x2: tileCx(dropTarget.col, tileSize),
          y2: tileCx(dropTarget.row, tileSize),
        }
      : null;

  // Board pixel dimensions (for SVG sizing).
  const boardW = 6 * 2 + cols * tileSize + (cols - 1) * GAP;
  const boardH = 6 * 2 + rows * tileSize + (rows - 1) * GAP;

  return (
    <div
      ref={boardRef}
      style={{
        position: 'relative',
        background: 'rgba(0,0,0,0.30)',
        borderRadius: 12,
        padding: 6,
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.40)',
        // Task 4: board micro-shake animation on trophy celebration.
        animation: isShaking ? 'cgBoardShake 0.12s ease-out' : undefined,
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
                mergeHighlight={isDropTgt ? (mergeHighlight ?? undefined) : undefined}
                eqOverlay={isDropTgt && tileOverlay !== null ? tileOverlay : undefined}
              />
            );
          }),
        )}
      </div>

      {/* Task 3 — Merge path connector: faint SVG line between src and dst.   */}
      {/* Absolute over the board; pointer-events:none so drag is unaffected.  */}
      {svgLine && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: boardW,
            height: boardH,
            pointerEvents: 'none',
            zIndex: 5,
          }}
          width={boardW}
          height={boardH}
        >
          <line
            x1={svgLine.x1}
            y1={svgLine.y1}
            x2={svgLine.x2}
            y2={svgLine.y2}
            stroke="white"
            strokeWidth={3}
            strokeOpacity={0.25}
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
