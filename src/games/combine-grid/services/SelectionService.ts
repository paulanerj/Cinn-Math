import { Tile, GridPos } from '../types';

export type Selection = {
  first: GridPos | null;
  second: GridPos | null;
};

export function emptySelection(): Selection {
  return { first: null, second: null };
}

export function selectTile(sel: Selection, pos: GridPos, grid: Tile[][]): Selection {
  const tile = grid[pos.r][pos.c];
  if (tile.kind === 'blank' || tile.kind === 'stone') return sel;

  if (!sel.first) {
    return { ...sel, first: pos };
  }

  // Tapping first again deselects
  if (sel.first.r === pos.r && sel.first.c === pos.c) {
    return emptySelection();
  }

  return { first: sel.first, second: pos };
}

export function isPairComplete(sel: Selection): sel is { first: GridPos; second: GridPos } {
  return sel.first !== null && sel.second !== null;
}

export function pairMultiplies(sel: { first: GridPos; second: GridPos }, grid: Tile[][], target: number): boolean {
  const a = grid[sel.first.r][sel.first.c];
  const b = grid[sel.second.r][sel.second.c];
  return a.val * b.val === target;
}
