import { Tile, GridPos } from '../types';

/**
 * BombService — handles bomb tile interactions.
 * A bomb tile, when tapped as the second selection next to any factor tile,
 * removes both tiles from the board.
 */
export function isBomb(tile: Tile): boolean {
  return tile.kind === 'bomb';
}

export function bombBlastPositions(pos: GridPos, rows: number, cols: number): GridPos[] {
  const positions: GridPos[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = pos.r + dr;
      const c = pos.c + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        positions.push({ r, c });
      }
    }
  }
  return positions;
}
