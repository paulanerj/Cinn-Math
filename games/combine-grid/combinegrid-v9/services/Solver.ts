
import { Tile, TileKind } from '../types';

export class Solver {
  static hasAnyLegalMove(grid: (Tile | null)[][], target: number): boolean {
    const rows = grid.length, cols = grid[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t1 = grid[r][c];
        if (!t1 || t1.kind === TileKind.STONE) continue;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const t2 = grid[nr][nc];
              if (!t2 || t2.kind === TileKind.STONE) continue;
              if (t1.kind === TileKind.TROPHY || t2.kind === TileKind.TROPHY) return true;
              if (t1.val === 0 || t2.val === 0) return true;
              return true; 
            }
          }
        }
      }
    }
    return false;
  }

  static hasImmediateSolve(grid: (Tile | null)[][], target: number): boolean {
    const rows = grid.length, cols = grid[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t1 = grid[r][c];
        if (!t1 || t1.kind !== TileKind.NUMBER || t1.val === 0 || t1.val === 1) continue;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              const t2 = grid[nr][nc];
              if (t2 && t2.kind === TileKind.NUMBER && t1.val * t2.val === target) return true;
            }
          }
        }
      }
    }
    return false;
  }
}
