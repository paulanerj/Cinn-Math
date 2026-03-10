// ═══════════════════════════════════════════════════════════════════════════════
// src/engine/GridGameRules.ts
// ═══════════════════════════════════════════════════════════════════════════════
//
// [ROLE] Shared rules contract for all grid-based math games on this platform.
//        Defines the boundary between the engine (board rendering, input routing,
//        scoring display, timing) and any individual game's logic.
//
// [WHY]  CombineGrid and SpeedGrid were the first two games, but the engine is
//        designed to host many more. Without a common contract, every new game
//        must invent its own coupling to the engine — leading to drift, duplicated
//        scaffolding, and tile-sizing math being copy-pasted into every game.
//        This contract solves that permanently by defining the exact shape of
//        data that flows in both directions across the engine/game boundary.
//
// [FUTURE] Future games (pair-match multiplication, swap puzzles, destroy-radius,
//          path-building, etc.) should implement GridGameRules and receive:
//          - Board rendering for free (from src/grid/GridBoard)
//          - Input normalization for free (from src/grid/GridInputController)
//          - Tile sizing math for free (from src/grid/GridSizing)
//          - HUD chrome for free (from src/platform/ui/HUDShell)
//          A new game is just an object that satisfies this interface + a React
//          shell that connects it to the shared engine layer.
//
// [LLM NOTE] THIS FILE IS TYPES/INTERFACES ONLY. No runtime code. No imports
//            from React or game files. No wiring into CombineGrid or SpeedGrid.
//            Do not add function bodies, class implementations, or default
//            exports. Do not import this file into any game until that game's
//            phase explicitly wires it. Violating these constraints breaks the
//            reconstruction contract.
//
// [INVARIANT] This file must remain importable with zero side effects.
//             It is safe to import from anywhere for type-checking purposes.
//             It must never trigger rendering, state changes, or subscriptions.
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// § 1  SPATIAL PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A row/column address within the grid.
 *
 * [INVARIANT] Both row and col are zero-indexed integers.
 *             (0,0) is the top-left tile of the board.
 *             Values outside [0, rows-1] × [0, cols-1] are illegal.
 */
export interface GridPos {
  row: number;
  col: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2  INTERACTION DESCRIPTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The normalized description of a single user interaction with the grid.
 * The input layer (GridInputController) is responsible for translating raw
 * pointer/touch/keyboard events into one of these shapes before passing
 * them to handleInteraction().
 *
 * [WHY] Normalizing interactions here means game rules never touch raw DOM
 * events. A game that supports "chain" is automatically compatible with both
 * touch chains and mouse-drag chains, because the engine normalizes both.
 *
 * [FUTURE] Additional interaction types (e.g. "long-press", "pinch") can be
 * added to this union without breaking existing game implementations, because
 * game rules receive the full descriptor and can ignore unknown kinds via a
 * default/exhaustive switch.
 */
export type GridInteractionKind =
  | 'tap'     // Single tile selected (tap or click)
  | 'drag'    // Tile dragged from one position toward another
  | 'swipe'   // Fast directional gesture across the board (not tile-specific)
  | 'chain'   // Ordered sequence of tiles visited in one continuous gesture
  | 'swap';   // Two tiles exchanged (drag-to-swap or keyboard swap)

export interface GridInteraction {
  /**
   * The normalized kind of interaction.
   * [INVARIANT] Must be one of the GridInteractionKind union members.
   */
  kind: GridInteractionKind;

  /**
   * The primary tile address.
   * - tap:   the tapped tile
   * - drag:  the tile the drag started on
   * - swipe: the tile the swipe started on
   * - chain: the first tile in the chain
   * - swap:  the tile being dragged away
   */
  origin: GridPos;

  /**
   * The secondary tile address (destination).
   * - tap:   undefined (no destination)
   * - drag:  the tile the pointer is currently over (may equal origin)
   * - swipe: the tile the swipe ended on (may be off-board → clamped)
   * - chain: the last tile visited (full sequence in `chain`)
   * - swap:  the tile being swapped into
   *
   * [INVARIANT] If present, target is always a valid GridPos.
   */
  target?: GridPos;

  /**
   * The full ordered list of tile addresses visited during the gesture.
   * Only populated for 'chain' interactions; undefined for all others.
   *
   * [INVARIANT] For chain: length ≥ 2, no duplicate adjacent entries,
   * each consecutive pair is orthogonally or diagonally adjacent.
   */
  chain?: GridPos[];

  /**
   * Raw swipe direction, populated only for 'swipe' interactions.
   * Encoded as a unit compass direction.
   */
  swipeDir?: 'up' | 'down' | 'left' | 'right';
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3  GAME CONTEXT (engine → rules)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The full state snapshot passed to handleInteraction() and lifecycle hooks.
 * This is what the engine knows about the current game moment.
 *
 * [WHY] Game rules are pure functions: given this context and an interaction,
 * produce a result. No game rule implementation should maintain hidden mutable
 * state — all relevant state should live in gameState and flow through here.
 *
 * [LLM NOTE] grid is typed as readonly — rules must not mutate it in place.
 * Return position changes through GridGameResult instead.
 *
 * [FUTURE] When a game needs additional per-tile metadata (e.g. "locked",
 * "highlighted", "frozen"), add it to the tile value type at the game layer,
 * not to GridGameContext. GridGameContext remains lean and engine-agnostic.
 */
export interface GridGameContext<TileValue = number, GameState = unknown> {
  /**
   * Current tile values on the board, row-major order.
   * grid[row][col] is the value at (row, col).
   * [INVARIANT] Dimensions match rows × cols declared in GridGameRules.
   */
  readonly grid: ReadonlyArray<ReadonlyArray<TileValue>>;

  /**
   * The current target value the player is working toward.
   * Meaning is game-specific:
   * - SpeedGrid:    the sum/product the chain must reach
   * - CombineGrid:  not used (undefined)
   * - Future games: could be a target shape, path length, colour, etc.
   */
  readonly currentTarget: number | undefined;

  /** Cumulative score for the current session. */
  readonly score: number;

  /**
   * Game-specific auxiliary state (timers, combo counters, undo stacks, etc.).
   * The engine treats this as opaque — it stores and forwards it but never
   * inspects it. Each game defines its own GameState shape.
   *
   * [INVARIANT] Must be serializable (no class instances, no DOM refs).
   */
  readonly gameState: GameState;

  /**
   * Elapsed time in milliseconds since the current round started.
   * Populated by the engine's timer; 0 if the game has no time dimension.
   */
  readonly elapsedMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4  GAME RESULT (rules → engine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A spawn request: ask the engine to place a new tile value at a given position.
 *
 * [WHY] Games declare what they *want* spawned; the engine handles the actual
 * board mutation, animation queuing, and gravity application. This keeps
 * animation logic out of game rules.
 */
export interface SpawnRequest<TileValue = number> {
  pos: GridPos;
  value: TileValue;
  /** Visual hint for the engine: how should this tile enter the board? */
  spawnStyle?: 'fall' | 'pop' | 'slide-in' | 'instant';
}

/**
 * Optional UI hints the engine should apply after processing the result.
 * These are cosmetic signals — they change nothing about game state.
 *
 * [LLM NOTE] Do not put game-state consequences here. If a tile being
 * "highlighted" changes what interactions are legal, that belongs in
 * GameState, not uiHints.
 */
export interface GridUIHints {
  /** Tiles that should briefly flash/pulse after the interaction resolves. */
  flashPositions?: GridPos[];
  /** Tiles that should show a "wrong" shake animation. */
  shakePositions?: GridPos[];
  /** A short message to pop up near the board (e.g. "✓ 12!", "Try again"). */
  popMessage?: string;
  /** If true, play the "correct" audio cue. */
  playCorrectSfx?: boolean;
  /** If true, play the "wrong" audio cue. */
  playWrongSfx?: boolean;
}

/**
 * The result returned from handleInteraction() and lifecycle hooks.
 * The engine applies this result to the board, score, and UI in order.
 *
 * [WHY] By making results declarative (a plain data object, not imperative
 * calls), game rules become trivially testable: construct a context, call
 * handleInteraction(), assert on the result shape. No mocking required.
 *
 * [INVARIANT] clearPositions and swapPositions are mutually exclusive in a
 * single result — applying both simultaneously is undefined behavior.
 * Use separate results (multi-step animations) if both are needed.
 *
 * [FUTURE] Additional result keys (e.g. "lockPositions", "revealPositions")
 * can be added here without breaking existing game implementations, because
 * the engine checks for presence before acting.
 */
export interface GridGameResult<TileValue = number, GameState = unknown> {
  /**
   * Positions whose tiles should be removed from the board (cleared/merged).
   * The engine will run the clear animation, then fulfil spawnRequests.
   */
  clearPositions?: GridPos[];

  /**
   * A pair of positions to swap. The engine will animate the exchange.
   * [INVARIANT] Length must be exactly 2 if present.
   */
  swapPositions?: [GridPos, GridPos];

  /**
   * New tiles to place after clears (or immediately if no clears).
   * If fewer spawns are provided than cleared positions, remaining
   * cells stay empty until the next gravity pass.
   */
  spawnRequests?: SpawnRequest<TileValue>[];

  /**
   * How much to add to (or subtract from) the cumulative score.
   * Negative values are allowed (penalty mechanics).
   */
  scoreDelta?: number;

  /**
   * The next target value to display after this result is applied.
   * If undefined, the engine leaves the current target unchanged.
   */
  nextTarget?: number;

  /**
   * Updated game-specific state to persist until the next interaction.
   * If undefined, the engine leaves gameState unchanged.
   */
  nextGameState?: GameState;

  /**
   * If true, the game session is over. The engine will stop accepting
   * interactions and fire any registered onGameOver callbacks.
   */
  gameOver?: boolean;

  /** Optional cosmetic hints for the engine's animation/audio layer. */
  uiHints?: GridUIHints;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5  LIFECYCLE HOOKS (optional)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional lifecycle hooks a game may implement.
 * The engine calls these at well-defined moments in the game loop.
 *
 * [WHY] Not every game needs a timer or per-round setup. Making hooks optional
 * keeps simple games simple — they just implement handleInteraction() and
 * nothing else.
 *
 * [LLM NOTE] All hooks follow the same pure-function contract as
 * handleInteraction: receive a context, return a partial result (or void).
 * Returning void/undefined means "no changes needed at this moment."
 */
export interface GridGameLifecycle<TileValue = number, GameState = unknown> {
  /**
   * Called by the engine on each timer tick (typically ~16ms / 60fps).
   * Use for countdown timers, auto-advance logic, or time-pressure effects.
   *
   * [INVARIANT] Must be fast (< 1ms). Do not allocate large objects here.
   * [FUTURE] If a game needs variable-rate ticks, add a `tickRateMs` field
   * to GridGameRules and the engine will respect it.
   */
  onTick?: (
    context: GridGameContext<TileValue, GameState>,
  ) => GridGameResult<TileValue, GameState> | void;

  /**
   * Called when a new round begins (after the board is reset and targets
   * are re-generated). Use to initialize round-specific state.
   *
   * [FUTURE] "Round" semantics are game-defined. For CombineGrid it could
   * mean a new board spawn; for SpeedGrid it means a new target challenge.
   */
  onRoundStart?: (
    context: GridGameContext<TileValue, GameState>,
  ) => GridGameResult<TileValue, GameState> | void;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6  THE CONTRACT — GridGameRules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete rules contract for a grid-based math game.
 *
 * [ROLE] Every game hosted on this platform implements this interface.
 *        The engine requires only this shape — it does not care whether the
 *        implementation is a class, a plain object, or a factory function.
 *
 * [WHY]  By programming to this interface, the engine gains the ability to
 *        host any grid math game without modification. New games are registered
 *        by providing an object that satisfies GridGameRules — no engine PRs,
 *        no new routing logic, no new React providers.
 *
 * [FUTURE] When wiring future games:
 *          1. Implement GridGameRules<TileValue, GameState> for the new game.
 *          2. Register it in the GameSelector (a two-line change).
 *          3. The engine handles all rendering, input, timing, and HUD.
 *
 * [LLM NOTE] CombineGrid and SpeedGrid do NOT implement this interface yet.
 *            They were built before it existed. They will be migrated during
 *            a dedicated future phase once both games are fully reconstructed
 *            and verified. Do not force-migrate them during Phases 3–8.
 *
 * @template TileValue  The type stored per cell (usually `number`).
 * @template GameState  Opaque auxiliary state owned by this game.
 */
export interface GridGameRules<TileValue = number, GameState = unknown>
  extends GridGameLifecycle<TileValue, GameState> {

  // ── Identity ──────────────────────────────────────────────────────────────

  /**
   * Stable identifier for this game.
   * Used by the engine for routing, analytics, and save-slot namespacing.
   * [INVARIANT] Must be lowercase-kebab, unique across all registered games,
   *             and stable across releases (saved state keys depend on it).
   * Examples: 'combine-grid', 'speed-grid', 'swap-twelve', 'path-sum'
   */
  readonly id: string;

  // ── Board geometry ────────────────────────────────────────────────────────

  /**
   * Number of rows in this game's grid.
   * [INVARIANT] Must be a positive integer ≥ 2.
   *             The engine uses this to compute tile sizing via GridSizing.ts.
   */
  readonly rows: number;

  /**
   * Number of columns in this game's grid.
   * [INVARIANT] Must be a positive integer ≥ 2.
   */
  readonly cols: number;

  // ── Initialisation ────────────────────────────────────────────────────────

  /**
   * Produce the full initial state for a new game session.
   * Called once on mount, and again on explicit restart.
   *
   * [INVARIANT] Must return a grid of exactly `rows` × `cols` tile values.
   *             Must return a valid GameState (not null/undefined).
   *
   * [LLM NOTE] This is the only place in game rules that produces state from
   * nothing. All subsequent state changes flow through handleInteraction()
   * and lifecycle hooks, which receive the current state and return deltas.
   *
   * @returns The initial context fields the engine should use to mount the game.
   */
  createInitialState(): {
    grid: TileValue[][];
    initialTarget: number | undefined;
    gameState: GameState;
  };

  // ── Core interaction handler ───────────────────────────────────────────────

  /**
   * Pure function: given the current game context and a normalized user
   * interaction, return what should change on the board and in game state.
   *
   * [INVARIANT] Must be a pure function — identical inputs must produce
   *             identical outputs. Do not call Date.now(), Math.random(),
   *             or any DOM API inside this function.
   *             (Randomness should be seeded via gameState if needed.)
   *
   * [WHY] Purity makes game rules unit-testable without a browser, and makes
   * time-travel debugging (undo stacks, replays) trivially implementable by
   * the engine — it just replays stored interactions over createInitialState().
   *
   * [FUTURE] If a game needs non-determinism (random spawns), it should store
   * an RNG seed in gameState and advance it deterministically here, so that
   * replays remain fully reproducible.
   *
   * @param context  The full current state snapshot from the engine.
   * @param interaction  The normalized user gesture.
   * @returns A result object describing all changes to apply, or an empty
   *          object `{}` if the interaction was a no-op.
   */
  handleInteraction(
    context: GridGameContext<TileValue, GameState>,
    interaction: GridInteraction,
  ): GridGameResult<TileValue, GameState>;
}
