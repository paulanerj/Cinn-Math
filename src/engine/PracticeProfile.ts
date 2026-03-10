// [ROLE] Difficulty / practice-level profiles for GridMath games.
// A PracticeProfile controls tile value ranges, target number ranges,
// time pressure, and spawn behaviour. Both CombineGrid and SpeedGrid
// read their settings from a profile at game start.
//
// [WHY] Centralising difficulty in one place means both games stay balanced
// relative to each other, and future games can re-use the same tiers without
// duplicating constants. The profile also provides the values SpawnEngine and
// TargetGenerator need, keeping those modules stateless.
//
// [FUTURE] Add new ProfileIds (e.g. 'expert', 'timed-blitz') here.
// Each new id needs a corresponding entry in PRACTICE_PROFILES.
// Existing game components read profiles by id, so they automatically pick
// up any new tier without code changes.
//
// [LLM NOTE] Do not add game-specific logic here (e.g. CombineGrid-only
// settings). Profile fields must be meaningful to all grid-based games.
// Game-specific tuning belongs in the game's own config, which may reference
// profile values as a starting point.
//
// [INVARIANT] tileMin ≤ tileMax. targetSumMin ≤ targetSumMax.
//             targetProductMin ≤ targetProductMax. timeLimitSeconds ≥ 0
//             (0 means no timer — used by practice/untimed modes).

/** Stable identifier for a practice/difficulty level. */
export type ProfileId = 'easy' | 'medium' | 'hard';

/** All difficulty settings consumed by SpawnEngine, TargetGenerator, and game timers. */
export interface PracticeProfile {
  /** Identifies this profile for save-state and analytics. */
  readonly id: ProfileId;

  // ── Tile values ────────────────────────────────────────────────────────────

  /** Minimum numeric value that can appear on a spawned tile. */
  readonly tileMin: number;
  /** Maximum numeric value that can appear on a spawned tile. */
  readonly tileMax: number;

  // ── Target ranges ──────────────────────────────────────────────────────────

  /** Minimum acceptable generated target for sum-mode games (SpeedGrid sum). */
  readonly targetSumMin: number;
  /** Maximum acceptable generated target for sum-mode games. */
  readonly targetSumMax: number;

  /**
   * Minimum acceptable generated target for product-mode games
   * (SpeedGrid multiply, CombineGrid).
   */
  readonly targetProductMin: number;
  /** Maximum acceptable generated target for product-mode games. */
  readonly targetProductMax: number;

  // ── Time pressure ──────────────────────────────────────────────────────────

  /**
   * Total session time in seconds for timed modes.
   * 0 means the mode is untimed (practice / free-play).
   */
  readonly timeLimitSeconds: number;

  // ── Spawn distribution ─────────────────────────────────────────────────────

  /**
   * Probability in [0, 1) that a freshly spawned tile carries a bonus type
   * rather than a plain number. Bonus tile semantics are game-defined.
   *
   * [INVARIANT] 0 ≤ bonusTileProbability < 1.
   */
  readonly bonusTileProbability: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in profiles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All registered practice profiles, keyed by ProfileId.
 *
 * [INVARIANT] Every ProfileId must have a corresponding entry here.
 *             Games look up profiles via getProfile() — adding an id without
 *             a matching entry will throw at runtime.
 *
 * Values mirror the original difficulty constants from the Cinnamoroll baseline:
 *   easy   ≈ banana  (tiles 1–5, 75 s, gentle targets)
 *   medium ≈ apple   (tiles 1–9, 60 s, moderate targets)
 *   hard   ≈ coconut (tiles 2–12, 45 s, demanding targets)
 */
export const PRACTICE_PROFILES: Record<ProfileId, PracticeProfile> = {
  easy: {
    id: 'easy',
    tileMin: 1,
    tileMax: 5,
    targetSumMin: 4,
    targetSumMax: 15,
    targetProductMin: 4,
    targetProductMax: 25,
    timeLimitSeconds: 75,
    bonusTileProbability: 0.30,
  },
  medium: {
    id: 'medium',
    tileMin: 1,
    tileMax: 9,
    targetSumMin: 5,
    targetSumMax: 25,
    targetProductMin: 4,
    targetProductMax: 81,
    timeLimitSeconds: 60,
    bonusTileProbability: 0.25,
  },
  hard: {
    id: 'hard',
    tileMin: 2,
    tileMax: 12,
    targetSumMin: 10,
    targetSumMax: 40,
    targetProductMin: 20,
    targetProductMax: 150,
    timeLimitSeconds: 45,
    bonusTileProbability: 0.15,
  },
};

/**
 * Returns the PracticeProfile for a given id.
 * Throws if the id is not registered — this is a programming error, not a
 * user-facing error, so an early throw is the correct response.
 *
 * [INVARIANT] Only call with a known ProfileId. Do not pass user input
 *             directly without validating it against the ProfileId union first.
 */
export function getProfile(id: ProfileId): PracticeProfile {
  const profile = PRACTICE_PROFILES[id];
  if (!profile) {
    throw new Error(`[PracticeProfile] Unknown profile id: "${id}"`);
  }
  return profile;
}

/** Default profile used when no explicit selection has been made. */
export const DEFAULT_PROFILE_ID: ProfileId = 'easy';
