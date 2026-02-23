
import { Tile, TileKind } from '../types';
import { distributionController } from './DistributionController';
import { logDistributionAudit } from '../debug/distributionAudit';

export class GridEngine {
  static createId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  static createTile(r: number, c: number, kind: TileKind, val: number, lineage?: string): Tile {
    return {
      id: this.createId(),
      r, c, kind, val, op: null,
      fixed: kind === TileKind.STONE,
      lineage: lineage || `${val}`,
    };
  }

  static getRandomSpawnValue(target: number, practiceSet?: number[]): { kind: TileKind, val: number } {
    const decision = distributionController.getSpawnValue();
    return { kind: decision.kind, val: decision.val };
  }

  static seedGrid(rows: number, cols: number, target: number, practiceSet?: number[]): (Tile | null)[][] {
    // Initialize controller for the new round
    distributionController.initialize(target, rows, cols, practiceSet || []);

    // Deterministically fill grid using the controller's seed queue
    const grid: (Tile | null)[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const decision = distributionController.getSeedValue();
        return this.createTile(r, c, decision.kind, decision.val);
      })
    );

    logDistributionAudit(grid, target, 'Seed Initialized');
    return grid;
  }

  static isAdjacent(t1: { r: number; c: number }, t2: { r: number; c: number }): boolean {
    const dr = Math.abs(t1.r - t2.r);
    const dc = Math.abs(t1.c - t2.c);
    return (dr === 0 && dc === 0) ? false : (dr <= 1 && dc <= 1);
  }

  static explode(grid: (Tile | null)[][], r: number, c: number): { grid: (Tile | null)[][], explodedIds: string[], trophiesCount: number } {
    const rows = grid.length, cols = grid[0].length;
    const newGrid = grid.map(row => [...row]);
    const explodedIds: string[] = [];
    let trophiesCount = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const t = newGrid[nr][nc];
          if (t) {
            if (t.kind === TileKind.TROPHY) trophiesCount++;
            explodedIds.push(t.id);
            newGrid[nr][nc] = null;
          }
        }
      }
    }
    return { grid: newGrid, explodedIds, trophiesCount };
  }
}
