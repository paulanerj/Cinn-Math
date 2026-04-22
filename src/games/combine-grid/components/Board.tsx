// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/components/Board.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure display component.  No dispatch, no PRNG, no local state.
// Pointer handling is fully lifted to CombineGridGame's container div.
// Tiles carry data-row / data-col for hit testing.
// Position arrays are guaranteed valid by assertValidPositions() in CombineGridGame
// before any dispatch — no defensive filtering needed here.
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
  frozenMask: boolean[][];
  /** Position of the currently ignited bomb (fuse burning). */
  ignitedBombPos: GridPos | null;
  /** 0→1 progress of the bomb fuse (used to render countdown ring). */
  bombFuseProgress: number;
  dragSource: GridPos | null;
  dropTarget: GridPos | null;
  poppingPos: GridPos | null;
  spawnedPositions: GridPos[];
  tileOverlay: { label: string; color: string } | null;
  mergeHighlight: 'invalid' | 'valid' | 'trophy' | null;
  isShaking: boolean;
  boardRef: React.RefObject<HTMLDivElement | null>;
}

// ── SVG connector helpers ─────────────────────────────────────────────────────

function tileCx(index: number, tileSize: number): number {
  return 6 + index * (tileSize + GAP) + tileSize / 2;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Board({
  grid,
  tileSize,
  selection,
  clearingPositions,
  trophyMask,
  frozenMask,
  ignitedBombPos,
  bombFuseProgress: _bombFuseProgress,
  dragSource,
  dropTarget,
  poppingPos,
  spawnedPositions,
  tileOverlay,
  mergeHighlight,
  isShaking,
  boardRef,
}: BoardProps) {
  // Guard: ensure grid has at least one row before accessing grid[0].
  const rows = grid.length;
  const cols = grid[0]?.length ?? 5;

  const svgLine =
    dragSource !== null && dropTarget !== null
      ? {
          x1: tileCx(dragSource.col, tileSize),
          y1: tileCx(dragSource.row, tileSize),
          x2: tileCx(dropTarget.col, tileSize),
          y2: tileCx(dropTarget.row, tileSize),
        }
      : null;

  const boardW = 6 * 2 + cols * tileSize + (cols - 1) * GAP;
  const boardH = 6 * 2 + rows * tileSize + (rows - 1) * GAP;

  // Guard: if grid is empty, render the board shell without tiles.
  if (rows === 0) {
    return (
      <div
        ref={boardRef}
        style={{
          position: 'relative',
          background: 'linear-gradient(160deg, #C8B89A 0%, #B8A888 45%, #A89878 100%)',
          borderRadius: 16,
          padding: 6,
          minWidth: 80,
          minHeight: 80,
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.45)',
        }}
      />
    );
  }

  return (
    <div
      ref={boardRef}
      style={{
        position: 'relative',
        // Warm beige-stone board tray.
        background: 'linear-gradient(160deg, #C8B89A 0%, #B8A888 45%, #A89878 100%)',
        borderRadius: 16,
        padding: 6,
        boxShadow: [
          'inset 0 2px 10px rgba(0,0,0,0.35)',
          'inset 0 -1px 4px rgba(255,240,210,0.20)',
          '0 8px 32px rgba(0,0,0,0.45)',
          '0 2px 0 rgba(255,255,255,0.08)',
        ].join(', '),
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
            const isDropTgt =
              dropTarget !== null && dropTarget.row === r && dropTarget.col === c;
            const isBombLit =
              ignitedBombPos !== null &&
              ignitedBombPos.row === r &&
              ignitedBombPos.col === c;
            return (
              <Tile
                key={`${r},${c}`}
                val={val}
                size={tileSize}
                row={r}
                col={c}
                selected={isSelected(selection, pos)}
                clearing={clearingPositions.some((p) => p.row === r && p.col === c)}
                // Optional chaining (?.) prevents crash if masks are not yet initialised.
                isTrophy={trophyMask?.[r]?.[c] ?? false}
                isFrozen={frozenMask?.[r]?.[c] ?? false}
                isBombLit={isBombLit}
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

      {/* SVG connector line between drag source and drop target */}
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
            strokeOpacity={0.20}
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
