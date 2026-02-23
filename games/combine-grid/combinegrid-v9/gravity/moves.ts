
import { Tile } from '../types';
import { GravityMove } from './types';

/**
 * Deterministic sort:
 * - Moves before spawns
 * - Bottom-first (lower destination rows first)
 * - Stable by col, then id
 *
 * This improves the "cascade feel" and avoids inconsistent ordering per run.
 */
function sortGravityMoves(moves: GravityMove[]): GravityMove[] {
  return [...moves].sort((a, b) => {
    const aPri = a.type === 'move' ? 0 : 1;
    const bPri = b.type === 'move' ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;

    // Bottom-first
    if (a.r !== b.r) return b.r - a.r;

    // Then by col
    if (a.c !== b.c) return a.c - b.c;

    // Stable tie-break by id
    return a.id.localeCompare(b.id);
  });
}

/**
 * Compare preGrid -> postGrid and output:
 * - move: same id moved to new r/c
 * - spawn: id exists only in postGrid
 */
export function computeGravityMoves(
  preGrid: (Tile | null)[][],
  postGrid: (Tile | null)[][]
): GravityMove[] {
  const preTiles = preGrid.flat().filter(Boolean) as Tile[];
  const postTiles = postGrid.flat().filter(Boolean) as Tile[];

  const preById = new Map<string, Tile>();
  preTiles.forEach((t) => preById.set(t.id, t));

  const moves: GravityMove[] = [];

  postTiles.forEach((post) => {
    const pre = preById.get(post.id);

    if (pre) {
      if (pre.r !== post.r || pre.c !== post.c) {
        moves.push({ type: 'move', id: post.id, r: post.r, c: post.c });
      }
    } else {
      moves.push({ type: 'spawn', id: post.id, r: post.r, c: post.c, data: post });
    }
  });

  return sortGravityMoves(moves);
}
