/**
 * gridTypes.ts — shared type contracts for the Grid Game Engine.
 *
 * These types form the boundary between the platform runtime and individual
 * games. All games that plug into GridRuntime must conform to GridGameModule.
 *
 * Phase B — Grid Runtime Foundation.
 *
 * STABILITY RULE: Once a game ships against these types, only add optional
 * fields. Never remove or change existing field types.
 */

// ── Interaction types ─────────────────────────────────────────────────────────

/** Single-cell tap (primary selection for tap-to-chain games) */
export interface TapCell {
  type: 'TAP_CELL';
  row: number;
  col: number;
}

/**
 * Swap two adjacent cells by dragging one onto the other.
 * Used by swap-style games (not CombineGrid, but defined for future games).
 */
export interface DragSwap {
  type: 'DRAG_SWAP';
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

/**
 * Chain selection — the primary input for CombineGrid.
 *
 * - phase 'start'   : pointer down on a cell → begin a new chain
 * - phase 'extend'  : pointer enters another cell while down → extend or backtrack
 * - phase 'commit'  : pointer up → evaluate the chain
 * - phase 'cancel'  : pointer leaves grid / ESC → discard chain
 */
export interface ChainSelect {
  type: 'CHAIN_SELECT';
  cells: { row: number; col: number }[];
  phase: 'start' | 'extend' | 'commit' | 'cancel';
}

/** Full-board swipe (for swipe-to-shift games). */
export interface Swipe {
  type: 'SWIPE';
  direction: 'up' | 'down' | 'left' | 'right';
  /** Cell the swipe originated from */
  startRow: number;
  startCol: number;
}

/** Discriminated union of all supported grid interactions */
export type GridInteraction = TapCell | DragSwap | ChainSelect | Swipe;

// ── Grid state types ──────────────────────────────────────────────────────────

/**
 * A single cell in the game grid as seen by the renderer.
 * The game module fills these; GridBoard/GridTile consume them.
 */
export interface GridCell {
  id: string;
  /** Tile kind drives visual variant (number, bomb, trophy, stone, …) */
  kind: string;
  /** Primary numeric value displayed on the tile */
  val: number;
  /** True while this cell is part of the active chain selection */
  selected?: boolean;
  /** True when this cell is highlighted (e.g. valid factor of target) */
  highlighted?: boolean;
}

/** Snapshot of all observable game state — returned by GridGameModule.getState() */
export interface GridGameState {
  /** 2D grid, row-major: grid[row][col] */
  grid: GridCell[][];
  score: number;
  /** Current target value the player must reach */
  target: number;
  /** Remaining seconds, if the game is time-limited */
  timeRemaining?: number;
  /** Game lifecycle phase */
  phase: 'playing' | 'paused' | 'gameover';
}

// ── Game module interface ─────────────────────────────────────────────────────

/**
 * GridGameModule — the contract every game must satisfy to run inside GridRuntime.
 *
 * Design intent:
 *  - The module owns ALL game logic and mutable state.
 *  - GridRuntime is a dumb host: it calls tick() and onInteraction().
 *  - React re-renders are triggered externally (e.g. via onStateChange callback
 *    or a simple polling approach in the component).
 */
export interface GridGameModule {
  /** Grid dimensions (fixed for the lifetime of the module) */
  readonly rows: number;
  readonly cols: number;

  /**
   * Returns the current observable state.
   * Called by the renderer after every interaction and tick.
   */
  getState(): GridGameState;

  /**
   * Deliver a player interaction to the game.
   * Must be synchronous — update internal state immediately.
   */
  onInteraction(interaction: GridInteraction): void;

  /**
   * Called once per animation frame by GridRuntime.
   * @param dt  Elapsed milliseconds since last tick (capped at 100ms).
   */
  tick(dt: number): void;

  /**
   * Called when the game is unmounted or reset.
   * Clean up timers, subscriptions, and any external state.
   */
  destroy(): void;
}
