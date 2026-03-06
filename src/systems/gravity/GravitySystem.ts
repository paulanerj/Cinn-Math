
// src/systems/gravity/GravitySystem.ts
//
// Shared canonical GravitySystem (logic only).
//
// This file is an exact logical copy of the original SpeedGrid gravity logic.
// It computes a "finalGrid" after removals + column collapse + refill spawns.
// It also returns a spawnList (useful for debug / future animation variants).
//
// IMPORTANT:
// - This is LOGIC ONLY (no DOM, no animation).
// - Safe to share across games because it has no UI dependencies.

import { EngineTile } from '../../engine/public';

export interface GridCell extends EngineTile {
  id: string;
  key: string;
}

export interface GravityResult {
  collapsedGrid: (GridCell | null)[][];
  spawnList: {
    tile: GridCell;
    fromRow: number; // negative row (above grid)
    toRow: number;
    col: number;
  }[];
  finalGrid: GridCell[][];
}

export class GravitySystem {
  static computeGravity(
    grid: GridCell[][],
    removedIds: Set<string>,
    getRefillTile: () => EngineTile
  ): GravityResult {
    const rows = grid.length;
    const cols = grid[0].length;

    // Phase 1: Remove tiles (null out removed IDs)
    const collapsed: (GridCell | null)[][] = grid.map((row) =>
      row.map((cell) => (removedIds.has(cell.id) ? null : cell))
    );

    // Phase 2: Collapse existing tiles downward (per column)
    for (let c = 0; c < cols; c++) {
      let writeRow = rows - 1;

      for (let r = rows - 1; r >= 0; r--) {
        const cell = collapsed[r][c];

        if (cell !== null) {
          if (writeRow !== r) {
            collapsed[writeRow][c] = cell;
            collapsed[r][c] = null;
          }
          writeRow--;
        }
      }
    }

    // Phase 3: Create spawn list + fill finalGrid
    const spawnList: GravityResult['spawnList'] = [];

    const finalGrid: GridCell[][] = collapsed.map((row) => [...row]) as GridCell[][];

    for (let c = 0; c < cols; c++) {
      let spawnOffset = 0;

      // Fill from top to bottom to find holes
      for (let r = 0; r < rows; r++) {
        if (finalGrid[r][c] === null) {
          const refill = getRefillTile();

          const newCell: GridCell = {
            ...refill,
            id: Math.random().toString(36).substr(2, 9),
            key: Math.random().toString(36).substr(2, 9),
          };

          spawnList.push({
            tile: newCell,
            fromRow: -1 - spawnOffset,
            toRow: r,
            col: c,
          });

          finalGrid[r][c] = newCell;
          spawnOffset++;
        }
      }
    }

    return {
      collapsedGrid: collapsed,
      spawnList,
      finalGrid,
    };
  }
}
