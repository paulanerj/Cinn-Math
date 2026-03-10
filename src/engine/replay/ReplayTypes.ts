// [ROLE] Type definitions for GridMath session replay records.
// A replay captures the complete inputs to a game session so it can be
// re-run deterministically and produce the exact same board sequence.
//
// [WHY] Replays serve three purposes:
//   1. Bug reproduction — share a seed + interaction log, reproduce the bug.
//   2. Score verification — leaderboard entries can be validated by replay.
//   3. Tutorial/demo mode — pre-record a session, play it back as a demo.
//
// Because the engine uses a seeded PRNG, the only information needed to
// fully replay a session is the seed + the list of player interactions
// (each described as a ReplayFrame). The board state at any frame is
// deterministically derived.
//
// [FUTURE] When async events (network latency, audio callbacks) influence
// game state, add a `serverTimestamp` field to ReplayFrame so replay can
// account for timing-dependent decisions.
//
// [LLM NOTE] This file is types-only. No recording logic, no playback logic.
// ReplayRecorder.ts handles recording; playback is a future implementation.
//
// [INVARIANT] A ReplaySession with a given seed, played through
//             ReplayRecorder.frames, must always produce the same final
//             score and board state on any device.

import type { ENGINE_VERSION } from '../version';

// ─────────────────────────────────────────────────────────────────────────────
// Frame types
// ─────────────────────────────────────────────────────────────────────────────

/** The type of player action recorded in a replay frame. */
export type ReplayFrameKind =
  | 'pointer-down'    // Player pressed / touched a tile
  | 'pointer-move'    // Pointer moved to a new tile during drag/chain
  | 'pointer-up'      // Player released
  | 'round-start'     // A new round began (target changed)
  | 'game-over';      // Session ended

/**
 * A single recorded moment in a game session.
 * Each frame captures a player action and the timestamp at which it occurred.
 */
export interface ReplayFrame {
  /** Monotonic ms since session start. */
  t: number;
  kind: ReplayFrameKind;
  /** Tile grid position, present for pointer events. */
  pos?: { row: number; col: number };
  /** The target value active at this frame (for round-start frames). */
  target?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A complete replay record for one game session.
 *
 * [INVARIANT] engineVersion must equal ENGINE_VERSION at the time of recording.
 *             seed is the uint32 from rng.randomSeed() used at session start.
 *             frames are in chronological order (t values non-decreasing).
 */
export interface ReplaySession {
  /** Engine version at record time — used to detect compatibility issues. */
  engineVersion: typeof ENGINE_VERSION;
  /** The PRNG seed for this session. */
  seed: number;
  /** Practice profile id used for this session. */
  profileId: string;
  /** Game id (matches GridGameRules.id for the active game). */
  gameId: string;
  /** Ms timestamp (Date.now()) at session start. */
  recordedAt: number;
  /** Chronological list of player interactions. */
  frames: ReplayFrame[];
  /** Final score at session end. */
  finalScore: number;
  /** Total rounds completed. */
  roundsCompleted: number;
  /** Total session duration in ms. */
  durationMs: number;
}
