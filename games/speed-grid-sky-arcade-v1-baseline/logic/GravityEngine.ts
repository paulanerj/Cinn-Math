
import { EngineTile } from '../../../src/engine/public';
import { SpeedGridAdapter } from '../SpeedGridAdapter';

export interface GridCell extends EngineTile {
  id: string;
  key: string;
}

export class GravityEngine {
  static applyGravity(
    grid: GridCell[][], 
    removedIds: Set<string>
  ): GridCell[][] {
    const rows = grid.length;
    const cols = grid[0].length;
    
    // 1. Create a copy of the grid
    const nextGrid: (GridCell | null)[][] = grid.map(row => row.map(cell => 
      removedIds.has(cell.id) ? null : cell
    ));

    // 2. Fall Phase (Column by Column)
    for (let c = 0; c < cols; c++) {
      let writeRow = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (nextGrid[r][c] !== null) {
          if (r !== writeRow) {
            nextGrid[writeRow][c] = nextGrid[r][c];
            nextGrid[r][c] = null;
          }
          writeRow--;
        }
      }
    }

    // 3. Spawn Phase (Fill nulls at top)
    const finalGrid: GridCell[][] = nextGrid.map(row => [...(row as GridCell[])]);
    
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (finalGrid[r][c] === null) {
          const refill = SpeedGridAdapter.getRefill();
          finalGrid[r][c] = {
            ...refill,
            id: Math.random().toString(36).substr(2, 9),
            key: Math.random().toString(36).substr(2, 9)
          };
        }
      }
    }

    return finalGrid;
  }
}
