// [ROLE] Pure selection state machine for CombineGrid tap-pair mechanic.
// No React. No side effects.

import { GridPos } from '../types';

/** Toggles a position in the current selection. */
export function toggleTile(current: GridPos[], pos: GridPos): GridPos[] {
  const idx = current.findIndex((p) => p.r === pos.r && p.c === pos.c);
  if (idx !== -1) return current.filter((_, i) => i !== idx);
  return [...current, pos];
}

/** Returns true if pos is in the current selection. */
export function isSelected(selection: GridPos[], pos: GridPos): boolean {
  return selection.some((p) => p.r === pos.r && p.c === pos.c);
}

/** Returns the selection index (0-based) of pos, or -1 if not selected. */
export function selectionIndex(selection: GridPos[], pos: GridPos): number {
  return selection.findIndex((p) => p.r === pos.r && p.c === pos.c);
}
