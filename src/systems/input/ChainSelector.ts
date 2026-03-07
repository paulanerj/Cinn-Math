export type GridPos = { r: number; c: number };

export type ChainState = {
  active: boolean;
  path: GridPos[];
  startPos: GridPos | null;
};

function posKey(p: GridPos): string {
  return `${p.r},${p.c}`;
}

function isAdjacent(a: GridPos, b: GridPos): boolean {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return dr <= 1 && dc <= 1 && (dr + dc > 0);
}

/**
 * ChainSelector — manages drag-to-chain input selection.
 * Stateless-style: each method returns a new ChainState rather than mutating.
 */
export class ChainSelector {
  static empty(): ChainState {
    return { active: false, path: [], startPos: null };
  }

  static startChain(pos: GridPos): ChainState {
    return { active: true, path: [pos], startPos: pos };
  }

  /**
   * Extend chain to a new position. Returns updated state.
   * - If pos is already in the path (and not the last one), trims back to that point (undo).
   * - If pos is adjacent to last tile, appends it.
   * - Otherwise ignores (not adjacent).
   */
  static extend(state: ChainState, pos: GridPos): ChainState {
    if (!state.active) return state;
    const key = posKey(pos);
    const existingIdx = state.path.findIndex(p => posKey(p) === key);

    if (existingIdx !== -1 && existingIdx < state.path.length - 1) {
      // Backtrack: trim path to this point
      return { ...state, path: state.path.slice(0, existingIdx + 1) };
    }

    if (existingIdx !== -1) {
      // Already at the tail — no change
      return state;
    }

    const last = state.path[state.path.length - 1];
    if (!isAdjacent(last, pos)) return state;

    return { ...state, path: [...state.path, pos] };
  }

  static endChain(state: ChainState): ChainState {
    return { ...state, active: false };
  }

  static cancelChain(): ChainState {
    return ChainSelector.empty();
  }

  static hasPos(state: ChainState, pos: GridPos): boolean {
    return state.path.some(p => posKey(p) === posKey(pos));
  }

  static pathLength(state: ChainState): number {
    return state.path.length;
  }
}
