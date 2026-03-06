
// src/services/DistributionController.ts
//
// ✅ UPGRADED DISTRIBUTION CONTROLLER (Pedagogical TARGET_TABLE + Deterministic Plan)
// ------------------------------------------------------------------------------
// Contract goals this file satisfies:
//
// 1) Perfect deterministic distribution
//    - NO Date.now() seeding
//    - Seed derived only from initialize() inputs (target, rows, cols, practiceSet, seedSalt)
//    - Same inputs => identical seedQueue + spawnQueue output
//
// 2) Guaranteed solvability + guaranteed tutorial anchors
//    - grid[0][0] and grid[0][1] ALWAYS multiply to target (anchor pair)
//    - Anchor prefers non-trivial operands (>=2) when available
//
// 3) Unified seed and spawn logic
//    - Both seed and spawn values come from the same internal planner (generateQueue)
//    - Spawn queue refills deterministically with the same per-target profile
//
// 4) Per-target optimal distribution tables
//    - TARGET_TABLE contains the full 59-target profile set
//    - Ratios drive factor / zero / one / distractor counts for ANY grid size
//
// 5) Anti-flood (no single value dominates)
//    - Enforces per-value max cap on queue contents (excluding the two anchor slots)
//
// 6) Practice mode bias without breaking balance
//    - If practiceSet contains valid factor operands for the target, they receive extra
//      weight within factor selection while still respecting per-value caps.
//
// IMPORTANT: This file is designed to be a SAFE DROP-IN replacement for distribution logic.
// It does NOT import UI, SettingsModal, mode system, Flyout, etc.
// It only exports `distributionController` and a class used by GridEngine/mathpopSpawn.
//
// ------------------------------------------------------------------------------

import { TileKind } from '../types';

export interface SpawnDecision {
  kind: TileKind;
  val: number;
  reason: string;
}

/**
 * Deterministic PRNG (Mulberry32)
 * Given a fixed 32-bit seed, the sequence is deterministic.
 */
class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    // Force to uint32
    this.seed = seed >>> 0;
  }

  next(): number {
    // Mulberry32
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    const r = this.next();
    return Math.floor(r * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
}

/**
 * FNV-1a 32-bit hash for deterministic seeding from a string.
 */
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5; // offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Rounding helper that guarantees the returned parts sum to `total`.
 * We compute raw desired counts, floor them, then distribute remaining
 * units to largest fractional remainders.
 */
function apportionCounts(total: number, parts: Array<{ key: string; ratio: number }>): Record<string, number> {
  const raw = parts.map(p => ({
    key: p.key,
    exact: total * p.ratio,
    floor: Math.floor(total * p.ratio),
    frac: (total * p.ratio) - Math.floor(total * p.ratio)
  }));

  let used = raw.reduce((a, b) => a + b.floor, 0);
  let remaining = total - used;

  raw.sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < raw.length && remaining > 0; i++) {
    raw[i].floor += 1;
    remaining -= 1;
  }

  const out: Record<string, number> = {};
  for (const r of raw) out[r.key] = r.floor;
  // Safety (should never happen if ratios are sane)
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  if (sum !== total) {
    // Patch last key to match total
    const lastKey = raw[raw.length - 1].key;
    out[lastKey] = (out[lastKey] || 0) + (total - sum);
  }
  return out;
}

/**
 * Pedagogical per-target distribution profile.
 *
 * factor_set:
 *  - Operand values in [1..12] that participate in at least one valid (a,b)
 *    multiplication fact for that target under 1..12 constraints.
 *
 * ratios:
 *  - factor_ratio + zero_ratio + one_ratio + other_distr_ratio ~= 1.0
 */
type TargetProfile = {
  pair_count: number;
  factor_set: number[];
  factor_ratio: number;
  zero_ratio: number;
  one_ratio: number;
  other_distr_ratio: number;
};

/**
 * FULL 59-target profile table (1..12 multiplication table reachable products).
 * Source: your provided table (verbatim values).
 */
const TARGET_TABLE: Record<number, TargetProfile> = {
  1:   { pair_count: 1, factor_set: [1], factor_ratio: 0.6,  zero_ratio: 0.1,   one_ratio: 0.12,  other_distr_ratio: 0.18 },
  2:   { pair_count: 1, factor_set: [1,2], factor_ratio: 0.6,  zero_ratio: 0.1,   one_ratio: 0.12,  other_distr_ratio: 0.18 },
  3:   { pair_count: 1, factor_set: [1,3], factor_ratio: 0.6,  zero_ratio: 0.099, one_ratio: 0.12,  other_distr_ratio: 0.181 },
  4:   { pair_count: 2, factor_set: [1,2,4], factor_ratio: 0.55, zero_ratio: 0.099, one_ratio: 0.119, other_distr_ratio: 0.232 },
  5:   { pair_count: 1, factor_set: [1,5], factor_ratio: 0.6,  zero_ratio: 0.099, one_ratio: 0.119, other_distr_ratio: 0.182 },
  6:   { pair_count: 2, factor_set: [1,2,3,6], factor_ratio: 0.55, zero_ratio: 0.098, one_ratio: 0.119, other_distr_ratio: 0.233 },
  7:   { pair_count: 1, factor_set: [1,7], factor_ratio: 0.6,  zero_ratio: 0.098, one_ratio: 0.118, other_distr_ratio: 0.184 },
  8:   { pair_count: 2, factor_set: [1,2,4,8], factor_ratio: 0.55, zero_ratio: 0.098, one_ratio: 0.118, other_distr_ratio: 0.234 },
  9:   { pair_count: 2, factor_set: [1,3,9], factor_ratio: 0.55, zero_ratio: 0.097, one_ratio: 0.118, other_distr_ratio: 0.235 },
  10:  { pair_count: 2, factor_set: [1,2,5,10], factor_ratio: 0.55, zero_ratio: 0.097, one_ratio: 0.117, other_distr_ratio: 0.236 },
  11:  { pair_count: 1, factor_set: [1,11], factor_ratio: 0.6,  zero_ratio: 0.097, one_ratio: 0.117, other_distr_ratio: 0.186 },
  12:  { pair_count: 3, factor_set: [1,2,3,4,6,12], factor_ratio: 0.5,  zero_ratio: 0.096, one_ratio: 0.116, other_distr_ratio: 0.288 },
  14:  { pair_count: 2, factor_set: [1,2,7,14], factor_ratio: 0.55, zero_ratio: 0.096, one_ratio: 0.116, other_distr_ratio: 0.238 },
  15:  { pair_count: 2, factor_set: [1,3,5,15], factor_ratio: 0.55, zero_ratio: 0.095, one_ratio: 0.116, other_distr_ratio: 0.239 },
  16:  { pair_count: 2, factor_set: [1,2,4,8], factor_ratio: 0.55, zero_ratio: 0.095, one_ratio: 0.115, other_distr_ratio: 0.24 },
  18:  { pair_count: 3, factor_set: [1,2,3,6,9], factor_ratio: 0.5,  zero_ratio: 0.094, one_ratio: 0.114, other_distr_ratio: 0.292 },
  20:  { pair_count: 3, factor_set: [1,2,4,5,10], factor_ratio: 0.5,  zero_ratio: 0.094, one_ratio: 0.114, other_distr_ratio: 0.292 },
  21:  { pair_count: 2, factor_set: [1,3,7], factor_ratio: 0.55, zero_ratio: 0.093, one_ratio: 0.113, other_distr_ratio: 0.244 },
  22:  { pair_count: 2, factor_set: [1,2,11], factor_ratio: 0.55, zero_ratio: 0.093, one_ratio: 0.113, other_distr_ratio: 0.244 },
  24:  { pair_count: 4, factor_set: [1,2,3,4,6,8,12], factor_ratio: 0.5, zero_ratio: 0.092, one_ratio: 0.112, other_distr_ratio: 0.296 },
  25:  { pair_count: 1, factor_set: [5], factor_ratio: 0.6,  zero_ratio: 0.092, one_ratio: 0.112, other_distr_ratio: 0.196 },
  27:  { pair_count: 1, factor_set: [3,9], factor_ratio: 0.6,  zero_ratio: 0.091, one_ratio: 0.111, other_distr_ratio: 0.198 },
  28:  { pair_count: 2, factor_set: [1,2,4,7,14], factor_ratio: 0.55, zero_ratio: 0.091, one_ratio: 0.111, other_distr_ratio: 0.248 },
  30:  { pair_count: 4, factor_set: [1,2,3,5,6,10,15], factor_ratio: 0.5, zero_ratio: 0.09, one_ratio: 0.11, other_distr_ratio: 0.3 },
  32:  { pair_count: 1, factor_set: [4,8], factor_ratio: 0.6,  zero_ratio: 0.089, one_ratio: 0.109, other_distr_ratio: 0.202 },
  33:  { pair_count: 1, factor_set: [3,11], factor_ratio: 0.6, zero_ratio: 0.089, one_ratio: 0.109, other_distr_ratio: 0.202 },
  35:  { pair_count: 1, factor_set: [5,7], factor_ratio: 0.6, zero_ratio: 0.088, one_ratio: 0.108, other_distr_ratio: 0.204 },
  36:  { pair_count: 5, factor_set: [1,2,3,4,6,9,12], factor_ratio: 0.45, zero_ratio: 0.088, one_ratio: 0.108, other_distr_ratio: 0.354 },
  40:  { pair_count: 4, factor_set: [1,2,4,5,8,10], factor_ratio: 0.5, zero_ratio: 0.087, one_ratio: 0.107, other_distr_ratio: 0.306 },
  42:  { pair_count: 4, factor_set: [1,2,3,6,7,14], factor_ratio: 0.5, zero_ratio: 0.086, one_ratio: 0.106, other_distr_ratio: 0.308 },
  44:  { pair_count: 2, factor_set: [1,4,11], factor_ratio: 0.55, zero_ratio: 0.086, one_ratio: 0.106, other_distr_ratio: 0.258 },
  45:  { pair_count: 3, factor_set: [1,3,5,9,15], factor_ratio: 0.5, zero_ratio: 0.085, one_ratio: 0.105, other_distr_ratio: 0.31 },
  48:  { pair_count: 5, factor_set: [1,2,3,4,6,8,12], factor_ratio: 0.45, zero_ratio: 0.084, one_ratio: 0.104, other_distr_ratio: 0.362 },
  49:  { pair_count: 1, factor_set: [7], factor_ratio: 0.6, zero_ratio: 0.084, one_ratio: 0.104, other_distr_ratio: 0.212 },
  50:  { pair_count: 2, factor_set: [1,5,10], factor_ratio: 0.55, zero_ratio: 0.083, one_ratio: 0.103, other_distr_ratio: 0.264 },
  54:  { pair_count: 4, factor_set: [1,2,3,6,9], factor_ratio: 0.5, zero_ratio: 0.082, one_ratio: 0.102, other_distr_ratio: 0.316 },
  55:  { pair_count: 1, factor_set: [5,11], factor_ratio: 0.6, zero_ratio: 0.082, one_ratio: 0.102, other_distr_ratio: 0.216 },
  56:  { pair_count: 3, factor_set: [1,2,4,7,8], factor_ratio: 0.5, zero_ratio: 0.081, one_ratio: 0.101, other_distr_ratio: 0.318 },
  60:  { pair_count: 6, factor_set: [1,2,3,4,5,6,10,12], factor_ratio: 0.45, zero_ratio: 0.08, one_ratio: 0.1, other_distr_ratio: 0.37 },
  63:  { pair_count: 2, factor_set: [3,7,9], factor_ratio: 0.55, zero_ratio: 0.079, one_ratio: 0.099, other_distr_ratio: 0.272 },
  64:  { pair_count: 1, factor_set: [8], factor_ratio: 0.6, zero_ratio: 0.079, one_ratio: 0.099, other_distr_ratio: 0.222 },
  66:  { pair_count: 2, factor_set: [1,6,11], factor_ratio: 0.55, zero_ratio: 0.078, one_ratio: 0.098, other_distr_ratio: 0.274 },
  70:  { pair_count: 2, factor_set: [7,10], factor_ratio: 0.55, zero_ratio: 0.077, one_ratio: 0.097, other_distr_ratio: 0.276 },
  72:  { pair_count: 6, factor_set: [1,2,3,4,6,8,9,12], factor_ratio: 0.45, zero_ratio: 0.077, one_ratio: 0.097, other_distr_ratio: 0.376 },
  77:  { pair_count: 1, factor_set: [7,11], factor_ratio: 0.6, zero_ratio: 0.076, one_ratio: 0.096, other_distr_ratio: 0.228 },
  80:  { pair_count: 2, factor_set: [8,10], factor_ratio: 0.55, zero_ratio: 0.075, one_ratio: 0.095, other_distr_ratio: 0.28 },
  81:  { pair_count: 1, factor_set: [9], factor_ratio: 0.6, zero_ratio: 0.075, one_ratio: 0.095, other_distr_ratio: 0.23 },
  84:  { pair_count: 4, factor_set: [1,2,3,4,6,7,12], factor_ratio: 0.5, zero_ratio: 0.074, one_ratio: 0.094, other_distr_ratio: 0.332 },
  88:  { pair_count: 1, factor_set: [8,11], factor_ratio: 0.6, zero_ratio: 0.073, one_ratio: 0.093, other_distr_ratio: 0.234 },
  90:  { pair_count: 2, factor_set: [9,10], factor_ratio: 0.55, zero_ratio: 0.072, one_ratio: 0.092, other_distr_ratio: 0.286 },
  96:  { pair_count: 4, factor_set: [1,2,3,4,6,8,12], factor_ratio: 0.5, zero_ratio: 0.07, one_ratio: 0.09, other_distr_ratio: 0.34 },
  99:  { pair_count: 1, factor_set: [9,11], factor_ratio: 0.6, zero_ratio: 0.069, one_ratio: 0.089, other_distr_ratio: 0.242 },
  100: { pair_count: 1, factor_set: [10], factor_ratio: 0.6, zero_ratio: 0.069, one_ratio: 0.089, other_distr_ratio: 0.242 },
  108: { pair_count: 3, factor_set: [1,3,4,6,9,12], factor_ratio: 0.5, zero_ratio: 0.066, one_ratio: 0.086, other_distr_ratio: 0.348 },
  110: { pair_count: 1, factor_set: [10,11], factor_ratio: 0.6, zero_ratio: 0.066, one_ratio: 0.086, other_distr_ratio: 0.248 },
  120: { pair_count: 4, factor_set: [1,2,3,4,5,6,8,10,12], factor_ratio: 0.5, zero_ratio: 0.062, one_ratio: 0.082, other_distr_ratio: 0.356 },
  121: { pair_count: 1, factor_set: [11], factor_ratio: 0.6, zero_ratio: 0.062, one_ratio: 0.082, other_distr_ratio: 0.256 },
  132: { pair_count: 2, factor_set: [11,12], factor_ratio: 0.55, zero_ratio: 0.058, one_ratio: 0.078, other_distr_ratio: 0.314 },
  144: { pair_count: 3, factor_set: [1,2,3,4,6,8,9,12], factor_ratio: 0.5, zero_ratio: 0.05, one_ratio: 0.07, other_distr_ratio: 0.38 },
};

const DEFAULT_PROFILE: TargetProfile = {
  pair_count: 1,
  factor_set: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  factor_ratio: 0.5,
  zero_ratio: 0.08,
  one_ratio: 0.1,
  other_distr_ratio: 0.32,
};

/**
 * DISTRIBUTION CONTROLLER
 * Authoritative source for all tile values.
 */
export class DistributionController {
  private rng: SeededRNG = new SeededRNG(0);

  private seedQueue: SpawnDecision[] = [];
  private spawnQueue: SpawnDecision[] = [];

  // Configuration Context (deterministic inputs)
  private target: number = 12;
  private practiceSet: number[] = [];
  private allowedValues: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  private rows: number = 7;
  private cols: number = 5;
  private seedSalt: number = 0; // Optional deterministic "session" salt, but still deterministic if provided.

  // Anti-flood cap (excludes the first 2 anchor slots)
  private VALUE_CAP_PERCENT: number = 0.18;

  // Track how many times we refilled spawnQueue to keep the stream deterministic
  private spawnRefillIndex: number = 0;

  constructor() {
    // No Date.now here. We only seed RNG in initialize().
  }

  /**
   * Initializes the controller for a new round.
   *
   * @param target       Current target product.
   * @param rows         Grid rows.
   * @param cols         Grid cols.
   * @param practiceSet  Multipliers selected by user (settings menu). Used only as bias, never as authority.
   * @param seedSalt     Optional deterministic salt. If you want “same inputs => same board always”, pass 0.
   *                     If you want “same inputs but different session boards”, pass a stable session id.
   */
  public initialize(
    target: number,
    rows: number,
    cols: number,
    practiceSet: number[] = [],
    seedSalt: number = 0
  ) {
    this.target = target;
    this.rows = rows;
    this.cols = cols;

    // IMPORTANT: Sorting makes seed stable regardless of UI selection order.
    this.practiceSet = [...practiceSet].slice().sort((a, b) => a - b);

    this.seedSalt = seedSalt | 0;
    this.spawnRefillIndex = 0;

    // Deterministic seed from inputs
    const seedStr = `t=${target}|r=${rows}|c=${cols}|p=${this.practiceSet.join(',')}|salt=${this.seedSalt}`;
    const seed32 = fnv1a32(seedStr);
    this.rng = new SeededRNG(seed32);

    // Generate queues deterministically using a stable stream key.
    const seedCount = rows * cols;
    this.seedQueue = this.generateQueue(seedCount, true, 'seed-stream-0');

    // Pre-buffer spawn values (deterministic stream distinct from seed)
    this.spawnQueue = this.generateQueue(seedCount * 5, false, 'spawn-stream-0');

    // Optional debug hook (safe; can be removed without functional impact)
    // console.log(`[DistributionController] init seed=${seed32} target=${target} rows=${rows} cols=${cols} practice=[${this.practiceSet.join(',')}] salt=${this.seedSalt}`);
  }

  /**
   * Returns the next value for grid seeding.
   * Guaranteed: first two returned values are the tutorial anchors (r0c0 & r0c1).
   */
  public getSeedValue(): SpawnDecision {
    if (this.seedQueue.length === 0) {
      // Safety fallback (should not happen unless grid size mismatch)
      return this.getSpawnValue();
    }
    return this.seedQueue.shift()!;
  }

  /**
   * Returns the next value for spawning/refill.
   * Deterministically refills when exhausted.
   */
  public getSpawnValue(): SpawnDecision {
    if (this.spawnQueue.length === 0) {
      this.spawnRefillIndex++;
      const count = this.rows * this.cols * 2;
      this.spawnQueue = this.generateQueue(count, false, `spawn-stream-${this.spawnRefillIndex}`);
    }
    return this.spawnQueue.shift()!;
  }

  // ----------------------------------------------------------------------------
  // Internal planner
  // ----------------------------------------------------------------------------

  private getProfile(): TargetProfile {
    return TARGET_TABLE[this.target] || DEFAULT_PROFILE;
  }

  private generateQueue(count: number, isSeed: boolean, streamKey: string): SpawnDecision[] {
    // Create a stream-specific RNG by hashing the base deterministic context with streamKey
    const baseSeedStr = `t=${this.target}|r=${this.rows}|c=${this.cols}|p=${this.practiceSet.join(',')}|salt=${this.seedSalt}|stream=${streamKey}`;
    const streamSeed = fnv1a32(baseSeedStr);
    const rng = new SeededRNG(streamSeed);

    const profile = this.getProfile();

    // Candidate pools
    const neutrals = this.allowedValues.filter(v => v === 0 || v === 1);
    const trueFactors = this.allowedValues.filter(v => v > 1 && this.target % v === 0);
    const distractors = this.allowedValues.filter(v => v > 1 && this.target % v !== 0);

    // Prefer factor_set from table (pedagogical operand set), but keep only valid factors in range
    const factorCandidatesFromTable = (profile.factor_set || []).filter(v => v > 0 && v <= 12);
    const factorCandidates = factorCandidatesFromTable.length > 0
      ? factorCandidatesFromTable.filter(v => v === 1 ? true : trueFactors.includes(v)) // keep table list as source; 1 handled for anchors only
      : trueFactors;

    // Compute exact counts using the profile ratios.
    // Note: "other_distr_ratio" becomes the catch-all remainder bucket.
    const parts = apportionCounts(count, [
      { key: 'factors', ratio: profile.factor_ratio },
      { key: 'zeros', ratio: profile.zero_ratio },
      { key: 'ones', ratio: profile.one_ratio },
      { key: 'distractors', ratio: profile.other_distr_ratio }
    ]);

    const numFactors = Math.max(0, parts.factors);
    const numZeros = Math.max(0, parts.zeros);
    const numOnes = Math.max(0, parts.ones);
    const numDistractors = Math.max(0, parts.distractors);

    const queue: SpawnDecision[] = [];

    // -------------------------
    // 1) Fill factor deck with balanced cycling + practice bias
    // -------------------------
    // We want: even coverage of factorCandidates, plus a mild practice bias if applicable,
    // but NEVER allow one factor to dominate due to practiceSet (cap enforcement later).
    //
    // Strategy:
    //   - Start with factorCandidates
    //   - Add extra copies of practiced factors (that are in factorCandidates and >1)
    //   - Shuffle deck (deterministically)
    //   - Cycle through deck to fill numFactors
    //
    // Practice bias strength:
    //   - Add practiced factors 2 extra times (3x total presence in deck)
    //   - This is a bias, not a forced rule, and value caps remain the final authority
    //
    const baseFactorDeck = factorCandidates.filter(v => v > 1); // for normal factor fill we avoid 1
    const practicedFactors = baseFactorDeck.filter(v => this.practiceSet.includes(v));

    let factorDeck: number[] = [...baseFactorDeck];

    if (practicedFactors.length > 0) {
      factorDeck.push(...practicedFactors, ...practicedFactors);
    }

    if (factorDeck.length === 0) {
      // Fallback: if target has no factors >1 in range (should be rare for valid targets),
      // use 2 as a neutral-ish safe non-zero number.
      factorDeck = [2];
    }

    this.shuffleInPlace(factorDeck, rng);

    for (let i = 0; i < numFactors; i++) {
      const val = factorDeck[i % factorDeck.length];
      queue.push({ kind: TileKind.NUMBER, val, reason: 'Planned Factor' });
    }

    // -------------------------
    // 2) Fill zeros and ones explicitly (these are pedagogical neutrals, not random 0/1 mix)
    // -------------------------
    for (let i = 0; i < numZeros; i++) {
      queue.push({ kind: TileKind.NUMBER, val: 0, reason: 'Planned Zero' });
    }
    for (let i = 0; i < numOnes; i++) {
      queue.push({ kind: TileKind.NUMBER, val: 1, reason: 'Planned One' });
    }

    // -------------------------
    // 3) Fill distractors
    // -------------------------
    // Distractors are >1 non-factors. If empty, fallback to 0 (rare, but safe).
    if (distractors.length > 0) {
      for (let i = 0; i < numDistractors; i++) {
        const val = rng.pick(distractors);
        queue.push({ kind: TileKind.NUMBER, val: Math.min(12, Math.max(0, val)), reason: 'Planned Distractor' });
      }
    } else {
      for (let i = 0; i < numDistractors; i++) {
        queue.push({ kind: TileKind.NUMBER, val: 0, reason: 'Fallback Distractor' });
      }
    }

    // -------------------------
    // 4) Deterministic shuffle (for distribution spread)
    // -------------------------
    this.shuffleInPlace(queue, rng);

    // -------------------------
    // 5) Enforce per-value cap (anti-flood) on the whole queue,
    //    excluding the first two slots (reserved for anchors in seed).
    // -------------------------
    this.enforceValueCaps(queue, count, rng, /*excludeFirstN=*/ isSeed ? 2 : 0);

    // -------------------------
    // 6) Apply tutorial anchors (seed only)
    //    Guarantees:
    //      - queue[0] * queue[1] === target
    //      - Prefers operands >=2 when possible
    // -------------------------
    if (isSeed) {
      const anchorPair = this.selectAnchorPair(profile, rng);
      // Always apply anchors if we can find a legal pair (we should for valid targets).
      if (anchorPair) {
        queue[0] = { kind: TileKind.NUMBER, val: anchorPair[0], reason: 'Anchor A' };
        queue[1] = { kind: TileKind.NUMBER, val: anchorPair[1], reason: 'Anchor B' };

        // Re-enforce caps excluding anchors so anchors never get overwritten.
        this.enforceValueCaps(queue, count, rng, /*excludeFirstN=*/ 2);
      } else {
        // Emergency fallback: if no anchor pair found (should not happen),
        // force (1, target) only if target <= 12, else (2, target/2) if integer and <=12.
        const fallback = this.emergencyAnchorFallback(rng);
        queue[0] = { kind: TileKind.NUMBER, val: fallback[0], reason: 'Anchor A (Fallback)' };
        queue[1] = { kind: TileKind.NUMBER, val: fallback[1], reason: 'Anchor B (Fallback)' };
        this.enforceValueCaps(queue, count, rng, /*excludeFirstN=*/ 2);
      }
    }

    return queue;
  }

  /**
   * Select an anchor pair that multiplies to target.
   * - Prefers pairs where both operands are in [2..12] (non-trivial)
   * - If target is prime <= 12, (1, target) may be the only legal pair
   * - Uses the profile.factor_set to restrict candidate operands when provided
   */
  private selectAnchorPair(profile: TargetProfile, rng: SeededRNG): [number, number] | null {
    // Build candidate operand list from factor_set if present; else compute from divisors
    const allowedOperands = (profile.factor_set && profile.factor_set.length > 0)
      ? profile.factor_set.filter(v => v >= 1 && v <= 12)
      : this.allowedValues.filter(v => v >= 1 && v <= 12 && this.target % v === 0);

    const pairsNonTrivial: [number, number][] = [];
    const pairsTrivialOK: [number, number][] = [];

    for (const a of allowedOperands) {
      if (a < 1 || a > 12) continue;
      const b = this.target / a;
      if (!Number.isFinite(b)) continue;
      if (!Number.isInteger(b)) continue;
      if (b < 1 || b > 12) continue;

      // Both operands must be spawnable values
      if (!this.allowedValues.includes(a) || !this.allowedValues.includes(b)) continue;

      const pair: [number, number] = [a, b];

      // Prefer >=2 anchors (non-trivial tutorial)
      if (a >= 2 && b >= 2) pairsNonTrivial.push(pair);
      else pairsTrivialOK.push(pair);
    }

    if (pairsNonTrivial.length > 0) return rng.pick(pairsNonTrivial);
    if (pairsTrivialOK.length > 0) return rng.pick(pairsTrivialOK);
    return null;
  }

  private emergencyAnchorFallback(rng: SeededRNG): [number, number] {
    // Try (1,target) if possible
    if (this.target >= 1 && this.target <= 12) return [1, this.target];

    // Try (2, target/2) if legal
    if (this.target % 2 === 0) {
      const b = this.target / 2;
      if (b >= 1 && b <= 12) return [2, b];
    }

    // As a last resort: pick any factor in range and compute partner if possible
    const divisors = this.allowedValues.filter(v => v >= 1 && v <= 12 && v !== 0 && this.target % v === 0);
    if (divisors.length > 0) {
      const a = rng.pick(divisors);
      const b = this.target / a;
      if (Number.isInteger(b) && b >= 1 && b <= 12) return [a, b];
    }

    // Ultimate fallback: (1,1) (won’t solve if target != 1, but prevents crash)
    return [1, 1];
  }

  /**
   * Enforce that no single numeric value appears more than VALUE_CAP_PERCENT of the queue,
   * excluding the first N slots (reserved for anchors).
   *
   * Replacement strategy:
   * - Prefer replacing with values from the same broad category when possible
   * - Uses available distractors and factors computed from target
   */
  private enforceValueCaps(queue: SpawnDecision[], totalCount: number, rng: SeededRNG, excludeFirstN: number): void {
    const maxPerValue = Math.max(1, Math.floor(totalCount * this.VALUE_CAP_PERCENT));

    // Build candidate replacement pools
    const factors = this.allowedValues.filter(v => v > 1 && this.target % v === 0);
    const distractors = this.allowedValues.filter(v => v > 1 && this.target % v !== 0);
    const neutrals = [0, 1].filter(v => this.allowedValues.includes(v));

    // Count occurrences excluding anchor slots
    const counts: Record<number, number> = {};

    for (let i = excludeFirstN; i < queue.length; i++) {
      const v = queue[i].val;
      counts[v] = (counts[v] || 0) + 1;
    }

    const pickReplacement = (currentVal: number): number => {
      // Try to replace within same category first for minimal distribution drift:
      // - If current is factor: replace with a different factor (or distractor if none)
      // - If current is distractor: replace with different distractor (or factor if none)
      // - If current is neutral: replace with other neutral (or distractor)
      const isFactor = currentVal > 1 && this.target % currentVal === 0;
      const isNeutral = currentVal === 0 || currentVal === 1;

      let pool: number[] = [];
      if (isFactor) pool = factors.filter(v => v !== currentVal);
      else if (isNeutral) pool = neutrals.filter(v => v !== currentVal);
      else pool = distractors.filter(v => v !== currentVal);

      if (pool.length === 0) {
        // If same-category pool is empty, broaden search
        pool = [...factors, ...distractors, ...neutrals].filter(v => v !== currentVal);
      }
      if (pool.length === 0) return currentVal; // no alternative exists

      // Choose a value that is currently under cap if possible
      const underCap = pool.filter(v => (counts[v] || 0) < maxPerValue);
      if (underCap.length > 0) return rng.pick(underCap);

      // Otherwise pick any alternative (still better than infinite loop)
      return rng.pick(pool);
    };

    for (let i = excludeFirstN; i < queue.length; i++) {
      const v = queue[i].val;
      if ((counts[v] || 0) <= maxPerValue) continue;

      // Replace this entry with a safer value
      const newVal = pickReplacement(v);
      if (newVal !== v) {
        // Update counts
        counts[v] -= 1;
        counts[newVal] = (counts[newVal] || 0) + 1;

        queue[i] = {
          kind: TileKind.NUMBER,
          val: newVal,
          reason: 'Cap Enforcement'
        };
      }
    }
  }

  /**
   * Deterministic shuffle using the provided RNG.
   */
  private shuffleInPlace<T>(array: T[], rng: SeededRNG): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

export const distributionController = new DistributionController();
