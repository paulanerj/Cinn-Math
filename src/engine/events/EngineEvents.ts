// [ROLE] Event type definitions for the GridMath engine event system.
// These types describe every observable thing that can happen during a game
// session — tile clears, score updates, game over, etc.
//
// [WHY] An event-based API decouples the engine's state transitions from the
// React components that need to respond to them (playing sound effects,
// triggering animations, updating the HUD). Components subscribe to events
// without knowing how the engine produces them.
//
// [FUTURE] When a new game adds a new observable moment (e.g. "bonus-tile-hit",
// "combo-broken"), add a new event type to the EngineEvent union and a matching
// payload interface here. No existing listeners break because TypeScript
// exhaustive-switch checks will catch unhandled cases at compile time.
//
// [LLM NOTE] This file is types-only. No EventEmitter, no addEventListener,
// no React state. The runtime wiring of the event bus lives in each game's
// own controller hook. These types are the shared vocabulary.
//
// [INVARIANT] Every EngineEvent has a `type` discriminant string.
//             Every EngineEvent has a `sessionSeed` field so event logs can
//             be correlated with a specific replay record.

// ─────────────────────────────────────────────────────────────────────────────
// Payload interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Common fields present on every engine event. */
export interface EngineEventBase {
  /** The session's PRNG seed — ties this event to a specific replay. */
  sessionSeed: number;
  /** Monotonic ms timestamp relative to session start. */
  elapsedMs: number;
}

/** A group of tiles was cleared from the board. */
export interface TilesClearedPayload {
  positions: ReadonlyArray<{ row: number; col: number }>;
  /** Values of the tiles at those positions before clearing. */
  values: number[];
}

/** The player's score changed. */
export interface ScoreUpdatedPayload {
  previousScore: number;
  newScore: number;
  delta: number;
  /** True if this update also set a new best score. */
  newBestScore: boolean;
}

/** The player successfully matched the current target. */
export interface TargetMatchedPayload {
  target: number;
  mode: 'sum' | 'product';
  /** Positions of the tiles that formed the match. */
  positions: ReadonlyArray<{ row: number; col: number }>;
}

/** A new target number has been generated. */
export interface NewTargetPayload {
  target: number;
  mode: 'sum' | 'product';
}

/** A round (one target cycle) has been completed. */
export interface RoundCompletePayload {
  roundsCompleted: number;
  score: number;
}

/** The game session has ended. */
export interface GameOverPayload {
  finalScore: number;
  bestScore: number;
  roundsCompleted: number;
  elapsedMs: number;
}

/** The countdown timer ticked. */
export interface TimerTickPayload {
  remainingSeconds: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Discriminated union
// ─────────────────────────────────────────────────────────────────────────────

export type EngineEvent =
  | (EngineEventBase & { type: 'tiles-cleared';    payload: TilesClearedPayload })
  | (EngineEventBase & { type: 'score-updated';    payload: ScoreUpdatedPayload })
  | (EngineEventBase & { type: 'target-matched';   payload: TargetMatchedPayload })
  | (EngineEventBase & { type: 'new-target';       payload: NewTargetPayload })
  | (EngineEventBase & { type: 'round-complete';   payload: RoundCompletePayload })
  | (EngineEventBase & { type: 'game-over';        payload: GameOverPayload })
  | (EngineEventBase & { type: 'timer-tick';       payload: TimerTickPayload });

/** All valid engine event type strings. */
export type EngineEventType = EngineEvent['type'];

/** Extract the payload type for a specific event type. */
export type EngineEventPayload<T extends EngineEventType> =
  Extract<EngineEvent, { type: T }>['payload'];

// ─────────────────────────────────────────────────────────────────────────────
// Listener type
// ─────────────────────────────────────────────────────────────────────────────

/** A function that handles a specific engine event. */
export type EngineEventListener<T extends EngineEventType = EngineEventType> = (
  event: Extract<EngineEvent, { type: T }>,
) => void;
