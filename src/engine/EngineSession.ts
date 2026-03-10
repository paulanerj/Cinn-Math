// [ROLE] Session state for a single GridMath game session.
// Tracks the running score, round count, best score (persisted across sessions),
// and the seed used for this session's PRNG (needed for replay).
//
// [WHY] Separating session bookkeeping from game rules keeps both layers clean.
// The engine can increment the score without knowing anything about how
// CombineGrid or SpeedGrid defines a "match". Games call addScore() and the
// session handles persistence and best-score tracking.
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

const BEST_SCORE_KEY = 'gridmath_bestScore';

/** All state the engine tracks across a single play session. */
export interface EngineSession {
  /** Current score for this session. */
  score: number;
  /** Best score ever achieved (loaded from localStorage on creation). */
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
 */
export function createSession(seed: number, profileId: string): EngineSession {
  const bestScore = loadBestScore();
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
 * Best score is updated and persisted if the new score exceeds it.
 *
 * [INVARIANT] delta may be negative (penalty mechanics). Score is clamped to 0.
 */
export function addScore(session: EngineSession, delta: number): EngineSession {
  const score = Math.max(0, session.score + delta);
  const bestScore = Math.max(session.bestScore, score);
  if (bestScore > session.bestScore) {
    saveBestScore(bestScore);
  }
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

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadBestScore(): number {
  try {
    const raw = localStorage.getItem(BEST_SCORE_KEY);
    return raw ? Math.max(0, parseInt(raw, 10)) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Silently ignore storage errors (private browsing mode, quota exceeded).
  }
}
