// [ROLE] Records player interactions during a live session for later replay.
// ReplayRecorder accumulates ReplayFrames as the player interacts with the
// board, then produces a ReplaySession when the session ends.
//
// [WHY] The recorder sits between the game's input handlers and the engine's
// interaction processor. Every normalised interaction that the game receives
// is also passed to the recorder — the game never has to manually log actions.
//
// [FUTURE] When a server-side leaderboard is added, the completed ReplaySession
// can be uploaded directly. The server re-runs the session deterministically
// to verify the score before accepting the submission.
//
// [LLM NOTE] ReplayRecorder holds mutable state (the growing frames array)
// but it is never shared across React renders. Each game session owns exactly
// one recorder, creates it on mount, and discards it on unmount. There is
// deliberately no React integration here — games manage the recorder lifecycle
// in a useRef or similar.
//
// [INVARIANT] startSession() must be called exactly once before any recordFrame()
//             calls. finishSession() must be called exactly once after all
//             recordFrame() calls. Calling them out of order throws.

import { ENGINE_VERSION } from '../version';
import type { ReplayFrame, ReplaySession } from './ReplayTypes';

export class ReplayRecorder {
  private readonly seed: number;
  private readonly profileId: string;
  private readonly gameId: string;
  private readonly recordedAt: number;
  private readonly startedAt: number;
  private frames: ReplayFrame[] = [];
  private started = false;
  private finished = false;

  constructor(seed: number, profileId: string, gameId: string) {
    this.seed = seed;
    this.profileId = profileId;
    this.gameId = gameId;
    this.recordedAt = Date.now();
    this.startedAt = this.recordedAt;
  }

  /**
   * Marks the session as started. Must be called before recordFrame().
   *
   * [INVARIANT] May only be called once per recorder instance.
   */
  startSession(): void {
    if (this.started) {
      throw new Error('[ReplayRecorder] startSession() called more than once.');
    }
    this.started = true;
  }

  /**
   * Records a single interaction frame.
   * The timestamp is derived from the elapsed time since session start.
   *
   * [INVARIANT] startSession() must have been called first.
   *             finishSession() must not have been called yet.
   */
  recordFrame(frame: Omit<ReplayFrame, 't'>): void {
    if (!this.started) {
      throw new Error('[ReplayRecorder] recordFrame() called before startSession().');
    }
    if (this.finished) {
      throw new Error('[ReplayRecorder] recordFrame() called after finishSession().');
    }
    this.frames.push({ ...frame, t: Date.now() - this.startedAt });
  }

  /**
   * Closes the recording and produces the final ReplaySession.
   *
   * @param finalScore       Score at session end.
   * @param roundsCompleted  Rounds completed during the session.
   */
  finishSession(finalScore: number, roundsCompleted: number): ReplaySession {
    if (!this.started) {
      throw new Error('[ReplayRecorder] finishSession() called before startSession().');
    }
    if (this.finished) {
      throw new Error('[ReplayRecorder] finishSession() called more than once.');
    }
    this.finished = true;
    const durationMs = Date.now() - this.startedAt;

    return {
      engineVersion: ENGINE_VERSION,
      seed: this.seed,
      profileId: this.profileId,
      gameId: this.gameId,
      recordedAt: this.recordedAt,
      frames: [...this.frames],
      finalScore,
      roundsCompleted,
      durationMs,
    };
  }

  /** Returns the current number of recorded frames. Useful for diagnostics. */
  get frameCount(): number {
    return this.frames.length;
  }
}
