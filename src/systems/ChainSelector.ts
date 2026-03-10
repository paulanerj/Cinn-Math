// ─────────────────────────────────────────────────────────────────────────────
// src/systems/ChainSelector.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Pure state machine for pointer-chain tile selection on a grid.
//        Manages the ordered sequence of positions visited during a drag
//        gesture, including adjacency validation and backtracking.
//
// [WHY]  SpeedGrid's core mechanic is "drag a chain of adjacent tiles whose
//        values sum/multiply to the target." The exact same chain-selection
//        logic applies to any future path-building or chain game (PathGrid,
//        ChainEquation, etc.). Centralising it here means those games get
//        validated, tested chain behaviour for free.
//
// [FUTURE] If a future game allows non-adjacent jumps (e.g. knight-move
//          chains), add a `validator` parameter to tryExtend() that overrides
//          the default adjacency check. The default remains Chebyshev-adjacent
//          (orthogonal + diagonal) for backwards compatibility.
//
// [LLM NOTE] This module has zero imports. It is a pure state machine over
//            plain data. Do not add React, DOM, engine, or platform imports.
//            Game components call these functions from pointer event handlers
//            and store the returned ChainState in their own useState/useReducer.
//
// [INVARIANT] ChainState is always consistent:
//             - positions is an ordered list with no duplicates.
//             - isActive is true iff positions.length ≥ 1 and the gesture is
//               still in progress (pointer has not been lifted).
//             - Each consecutive pair in positions is adjacency-valid under
//               the rule used when the chain was built.
// ─────────────────────────────────────────────────────────────────────────────

/** A grid coordinate (zero-indexed, row-major). */
export interface ChainPos {
  row: number;
  col: number;
}

/**
 * The full state of a chain selection.
 *
 * [INVARIANT] positions contains no duplicate entries.
 *             When isActive is false, positions MAY be non-empty (the chain
 *             was completed but not yet consumed). Call clearChain() after
 *             the game has read the result.
 */
export interface ChainState {
  /** Ordered list of tile positions in the chain (selection order). */
  positions: ChainPos[];
  /** True while the pointer is still held down and the gesture is live. */
  isActive: boolean;
}

// ── Adjacency helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if a and b are orthogonally adjacent (4-directional).
 */
export function isOrthoAdjacent(a: ChainPos, b: ChainPos): boolean {
  return (
    (Math.abs(a.row - b.row) === 1 && a.col === b.col) ||
    (a.row === b.row && Math.abs(a.col - b.col) === 1)
  );
}

/**
 * Returns true if a and b are within Chebyshev distance 1
 * (orthogonal OR diagonal — 8-directional).
 *
 * [USAGE] SpeedGrid uses this for chain extension — diagonal moves are allowed.
 */
export function isChebyshevAdjacent(a: ChainPos, b: ChainPos): boolean {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) === 1;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/** Returns an empty, inactive chain state. */
export function emptyChain(): ChainState {
  return { positions: [], isActive: false };
}

// ── State transitions (all return new state — do not mutate) ──────────────────

/**
 * Starts a new chain at `pos`. Replaces any existing chain.
 *
 * [INVARIANT] Call this on pointer-down. The returned state has one position
 *             and isActive = true.
 */
export function startChain(pos: ChainPos): ChainState {
  return { positions: [pos], isActive: true };
}

/**
 * Attempts to extend the chain to `pos`.
 *
 * Rules:
 * 1. If `pos` is the second-to-last position in the chain (backtrack step),
 *    the last position is removed instead of `pos` being added.
 * 2. If `pos` is already in the chain (non-backtrack duplicate), no change.
 * 3. If `pos` is not adjacent to the last position (using `adjacentFn`),
 *    no change.
 * 4. Otherwise, `pos` is appended.
 *
 * Returns the new ChainState (or the same reference if nothing changed).
 *
 * [INVARIANT] Call this on pointer-move when the pointer enters a new tile.
 *             Only valid when state.isActive === true.
 *
 * @param state       Current chain state.
 * @param pos         The tile the pointer just entered.
 * @param adjacentFn  Adjacency predicate. Defaults to isChebyshevAdjacent.
 */
export function tryExtend(
  state: ChainState,
  pos: ChainPos,
  adjacentFn: (a: ChainPos, b: ChainPos) => boolean = isChebyshevAdjacent,
): ChainState {
  if (!state.isActive || state.positions.length === 0) return state;

  const positions = state.positions;
  const last = positions[positions.length - 1];

  // 1. Backtrack: pointer returned to the second-to-last tile.
  if (positions.length >= 2) {
    const secondToLast = positions[positions.length - 2];
    if (secondToLast.row === pos.row && secondToLast.col === pos.col) {
      return { ...state, positions: positions.slice(0, -1) };
    }
  }

  // 2. Already in chain (non-backtrack).
  if (positions.some((p) => p.row === pos.row && p.col === pos.col)) {
    return state;
  }

  // 3. Not adjacent to last.
  if (!adjacentFn(last, pos)) return state;

  // 4. Extend.
  return { ...state, positions: [...positions, pos] };
}

/**
 * Marks the chain as inactive (pointer was lifted).
 * The positions remain for the game to read and evaluate.
 *
 * [INVARIANT] Call this on pointer-up. After calling, isActive = false.
 *             The game reads positions, calls clearChain() after evaluation.
 */
export function commitChain(state: ChainState): ChainState {
  return { ...state, isActive: false };
}

/**
 * Clears the chain entirely. Returns emptyChain().
 *
 * [INVARIANT] Call this after the game has finished evaluating the committed
 *             chain — whether it matched the target or not.
 */
export function clearChain(): ChainState {
  return emptyChain();
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns true if `pos` is currently in the chain.
 * O(n) where n = chain length. Chains are short (≤ ~15 tiles) in practice.
 */
export function isInChain(state: ChainState, pos: ChainPos): boolean {
  return state.positions.some((p) => p.row === pos.row && p.col === pos.col);
}

/**
 * Returns the index of `pos` in the chain, or -1 if not present.
 * Index 0 = the first tile selected.
 */
export function chainIndexOf(state: ChainState, pos: ChainPos): number {
  return state.positions.findIndex((p) => p.row === pos.row && p.col === pos.col);
}

/**
 * Returns the number of tiles in the chain.
 */
export function chainLength(state: ChainState): number {
  return state.positions.length;
}

/**
 * Returns true if the chain has at least `minLength` positions and is not
 * still active (i.e. the pointer has been lifted and results can be read).
 *
 * [USAGE] SpeedGrid calls this after pointer-up to decide whether to evaluate.
 */
export function isChainReadyToEvaluate(
  state: ChainState,
  minLength = 2,
): boolean {
  return !state.isActive && state.positions.length >= minLength;
}
