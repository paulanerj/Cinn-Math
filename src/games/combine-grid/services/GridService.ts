import { Tile, GridPos } from '../types';
import { EngineTile } from '../../../engine/SpawnEngine';

let _idCounter = 1;
function newId(): string { return `t${_idCounter++}`; }

export function engineTileToTile(et: EngineTile): Tile {
  return {
    id: newId(),
    kind: et.kind as Tile['kind'],
    val: et.val,
  };
}

export function buildGrid(engineTiles: EngineTile[][], rows: number, cols: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(engineTileToTile(engineTiles[r][c]));
    }
    grid.push(row);
  }
  return grid;
}

export function getFactorPairs(target: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let a = 1; a <= target; a++) {
    if (target % a === 0) {
      const b = target / a;
      if (a <= b) pairs.push([a, b]);
    }
  }
  return pairs;
}

export function isFactor(val: number, target: number): boolean {
  return val > 0 && target % val === 0;
}

export function countValidPairs(grid: Tile[][], target: number): number {
  let count = 0;
  const flat = grid.flat().filter(t => t.kind === 'number');
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i].val * flat[j].val === target) count++;
    }
  }
  return count;
}

export function countBombs(grid: Tile[][]): number {
  return grid.flat().filter(t => t.kind === 'bomb').length;
}

export function removeTiles(grid: Tile[][], positions: GridPos[]): Tile[][] {
  const posSet = new Set(positions.map(p => `${p.r},${p.c}`));
  return grid.map((row, r) =>
    row.map((tile, c) =>
      posSet.has(`${r},${c}`) ? { ...tile, kind: 'blank' as Tile['kind'], val: 0 } : tile
    )
  );
}

/** Apply gravity: tiles fall down into blank cells */
export function applyGravity(grid: Tile[][]): Tile[][] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next = grid.map(row => row.map(t => ({ ...t })));

  for (let c = 0; c < cols; c++) {
    let writeR = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (next[r][c].kind !== 'blank') {
        next[writeR][c] = { ...next[r][c] };
        if (writeR !== r) next[r][c] = { id: newId(), kind: 'blank', val: 0 };
        writeR--;
      }
    }
  }
  return next;
}

/** Find tile position in grid */
export function findTile(grid: Tile[][], id: string): GridPos | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c].id === id) return { r, c };
    }
  }
  return null;
}
