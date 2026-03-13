// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/components/Board.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Grid layout component for SpeedGrid.  Owns all pointer-event
//        handling for the chain-drag gesture via pointer capture.
//
// [GESTURE MODEL]
//   pointer-down  → setPointerCapture + dispatch CHAIN_START
//   pointer-move  → hit-test tile under pointer + dispatch CHAIN_EXTEND
//   pointer-up    → releasePointerCapture + dispatch CHAIN_COMMIT
//
//   setPointerCapture ensures pointer-move events keep firing even when the
//   pointer leaves individual tile divs, so the drag gesture works reliably.
//   Tile detection is done by translating clientX/Y to grid coordinates using
//   the board's bounding rect + stride (tileSize + GAP).
//
// [INVARIANT] Board.tsx must never import from src/games/combine-grid/.
//             Board.tsx must never import GridBoard.tsx or GridInputController.ts.
//
// [INVARIANT] Empty cells (grid[r][c] === 0) render as invisible placeholder
//             divs so the CSS grid stays fully populated during gravity.
//
// [REACT 19] key is placed on React.Fragment wrappers, not on SpeedTile
//            directly, to avoid the React 19 'key in props type' type error.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef } from 'react';
import type { ChainState } from '../../../systems/ChainSelector';
import type { ChainPos } from '../../../systems/ChainSelector';
import type { SGAction, SGPhase } from '../types';
import { ROWS, COLS } from '../constants';
import { GAP } from '../uiTokens';
import SpeedTile from './SpeedTile';

// ── Props ─────────────────────────────────────────────────────────────────────

interface BoardProps {
  grid: number[][];
  bonusMask: boolean[][];
  chain: ChainState;
  tileSize: number;
  dispatch: React.Dispatch<SGAction>;
  phase: SGPhase;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Board({
  grid,
  bonusMask,
  chain,
  tileSize,
  dispatch,
  phase,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);

  // Input is allowed during PLAYING and WAITING_TO_START (first gesture starts the timer).
  const isInteractive = phase === 'PLAYING' || phase === 'WAITING_TO_START';

  // ── Tile hit-testing ───────────────────────────────────────────────────────

  /**
   * Given a pointer's client coordinates, returns the (row, col) of the tile
   * under the pointer, or null if outside the board bounds.
   *
   * Stride = tileSize + GAP because each tile cell is that wide/tall in the grid.
   * The hit region per tile is [stride*col, stride*col + tileSize) so the gap
   * between tiles is dead-space.
   */
  function tileAt(clientX: number, clientY: number): ChainPos | null {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const stride = tileSize + GAP;
    const col = Math.floor(relX / stride);
    const row = Math.floor(relY / stride);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      return { row, col };
    }
    return null;
  }

  // ── Pointer handlers ───────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    // Capture so pointer-move keeps firing even when pointer leaves the element.
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = tileAt(e.clientX, e.clientY);
    if (pos) {
      dispatch({ type: 'CHAIN_START', pos });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteractive || !chain.isActive) return;
    const pos = tileAt(e.clientX, e.clientY);
    if (pos) {
      dispatch({ type: 'CHAIN_EXTEND', pos });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dispatch({ type: 'CHAIN_COMMIT' });
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  const boardWidth = COLS * tileSize + (COLS - 1) * GAP;
  const boardHeight = ROWS * tileSize + (ROWS - 1) * GAP;

  return (
    <div
      ref={boardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        width: boardWidth,
        height: boardHeight,
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, ${tileSize}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${tileSize}px)`,
        gap: GAP,
        // Prevent browser scroll / touch-action interference during drag.
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {grid.map((row, ri) =>
        row.map((value, ci) => {
          // Empty cells render as invisible placeholders to keep grid stable
          // during gravity (cleared tiles show as empty before refill).
          if (value === 0) {
            return (
              <div
                key={`${ri}-${ci}`}
                style={{ width: tileSize, height: tileSize, opacity: 0 }}
              />
            );
          }

          const inChain = chain.positions.some(
            (p) => p.row === ri && p.col === ci,
          );
          const chainIdx = chain.positions.findIndex(
            (p) => p.row === ri && p.col === ci,
          );

          // [REACT 19] key goes on the Fragment wrapper, not on SpeedTile.
          // React.Fragment is transparent in the DOM — SpeedTile becomes the
          // direct CSS grid item while key is tracked correctly by React.
          return (
            <React.Fragment key={`${ri}-${ci}`}>
              <SpeedTile
                value={value}
                isBonus={bonusMask[ri][ci]}
                isInChain={inChain}
                chainIndex={chainIdx}
                tileSize={tileSize}
                phase={phase}
              />
            </React.Fragment>
          );
        }),
      )}
    </div>
  );
}
