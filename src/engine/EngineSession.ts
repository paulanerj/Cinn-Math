// [ROLE] Session state for a single GridMath game session.
// Tracks the running score, round count, best score, and the seed used for
// this session's PRNG (needed for replay).
//
// [WHY] Separating session bookkeeping from game rules keeps both layers clean.
// The engine can increment the score without knowing anything about how
// CombineGrid or SpeedGrid defines a "match". Games call addScore() and the
// session tracks cumulative score and best-score state.
//
// [PURITY CONTRACT — Phase-8 Task-18]
// This module is pure: no localStorage, no DOM, no browser globals.
// Best-score persistence is the caller's responsibility. The component layer
// reads bestScore from storage before calling createSession(), and writes it
// back after addScore() when the returned bestScore exceeds the previous value.
// This keeps EngineSession portable across Node.js, Web Workers, SSR, and any
// future headless execution context.
//
// [FUTURE] When a new game mode adds a "lives" mechanic, add it to EngineSession
// here rather than in the game file, so the platform HUD can display it
// generically without per-game knowledge.
//
// [LLM NOTE] EngineSession is plain data + pure update functions.
//            There is no React state here. Games lift EngineSession into
//            their own useState/useReducer at the game component level.
//
// [INVARIANT] score ≥ 0. bestScore ≥ score (at any point in the session).
//             roundsCompleted ≥ 0. seed is the uint32 used to initialise
//             the session's PRNG — it must be stored before any PRNG calls
//             are made so that the session can be replayed.

/** All state the engine tracks across a single play session. */
export interface EngineSession {
  /** Current score for this session. */
  score: number;
  /**
   * Best score ever achieved. Supplied by the caller at session creation
   * (loaded from platform storage) and updated in-memory by addScore().
   * The caller is responsible for persisting the new value when it changes.
   */
  bestScore: number;
  /** Number of rounds completed successfully this session. */
  roundsCompleted: number;
  /** The PRNG seed for this session. Store in replay records. */
  seed: number;
  /** Millisecond timestamp of when the session was created. */
  startedAt: number;
  /** Profile id active for this session. */
  profileId: string;
}

/**
 * Creates a fresh EngineSession.
 *
 * @param seed       The uint32 PRNG seed (from rng.randomSeed()).
 * @param profileId  The active practice profile id.
 * @param bestScore  All-time best score, loaded by the caller from platform
 *                   storage before calling this function. Defaults to 0.
 */
export function createSession(
  seed: number,
  profileId: string,
  bestScore = 0,
): EngineSession {
  return {
    score: 0,
    bestScore,
    roundsCompleted: 0,
    seed,
    startedAt: Date.now(),
    profileId,
  };
}

/**
 * Returns a new session with score incremented by `delta`.
 * Updates bestScore in-memory if the new score exceeds it.
 * The caller is responsible for persisting bestScore when it changes
 * (i.e. when returned session.bestScore > the previous session.bestScore).
 *
 * [INVARIANT] delta may be negative (penalty mechanics). Score is clamped to 0.
 */
export function addScore(session: EngineSession, delta: number): EngineSession {
  const score = Math.max(0, session.score + delta);
  const bestScore = Math.max(session.bestScore, score);
  return { ...session, score, bestScore };
}

/**
 * Returns a new session with roundsCompleted incremented by 1.
 */
export function incrementRound(session: EngineSession): EngineSession {
  return { ...session, roundsCompleted: session.roundsCompleted + 1 };
}

/**
 * Returns the elapsed milliseconds since the session started.
 * Uses the provided `now` argument (default: Date.now()) so this function
 * remains testable without real timers.
 */
export function elapsedMs(session: EngineSession, now: number = Date.now()): number {
  return Math.max(0, now - session.startedAt);
}
