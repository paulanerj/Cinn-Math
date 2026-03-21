// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/harness/SpeedGridHarness.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Deterministic test harness for SpeedGrid game logic.
//        Zero React. Zero DOM. Synchronous gravity resolution.
//        Covers the full Phase-7 Verification Matrix (VM-1 through VM-22).
//
// [PUBLIC API]
//   SGHarness.runVerificationMatrix() → HarnessSuiteResult
//   SGHarness.runStressTest(seed, rounds) → StressTestResult
//   SGHarness.runChainPattern(pattern, seed?) → ChainPatternResult
//   SGHarness.create(seed) → SGHarness  (instance for one-off usage)
//
// [INSTANCE API]
//   .step(action)                → new SGHarness
//   .simulateChain(positions)    → new SGHarness
//   .resolveGravity()            → new SGHarness (synchronous, no timers)
//   .simulateTicks(n)            → new SGHarness
//   .assert(cond, msg)           → void (throws on failure)
//   .assertPhase(expected)       → void
//   .assertGridFull()            → void
//
// [INVARIANT] Zero React imports. No DOM. No async. No setTimeout.
// ─────────────────────────────────────────────────────────────────────────────

import {
  makePrng,
  spawnTile,
  generateTarget,
  getProfile,
  DEFAULT_PROFILE_ID,
} from '../../../engine/public';
import type { PracticeProfile } from '../../../engine/PracticeProfile';
import { applyGravity } from '../../../systems/GravitySystem';
import { initGame, sgReducer, applyBonusMaskGravity } from '../sgReducer';
import type { SGState, SGAction } from '../types';
import { ROWS, COLS } from '../constants';

// ── Public types ──────────────────────────────────────────────────────────────

export interface HarnessTestResult {
  name: string;
  pass: boolean;
  error?: string;
}

export interface HarnessSuiteResult {
  passed: number;
  failed: number;
  total: number;
  results: HarnessTestResult[];
}

export interface StressTestResult {
  /** Seed used for this run. */
  seed: number;
  /** Number of rounds requested. */
  rounds: number;
  /** Total chain attempts (correct + wrong). */
  chainsAttempted: number;
  /** Successful chains completed (via reducer state). */
  chainsCompleted: number;
  /** Wrong chain submissions that failed target check. */
  wrongChains: number;
  /** Bonus tiles cleared across all valid chains. */
  bonusesCollected: number;
  /** Final score at end of run. */
  finalScore: number;
  /** Phase when the run ended. */
  finalPhase: SGState['phase'];
  /** Sequence of targets generated (one per completed chain). */
  targetHistory: number[];
  /** Boards with no 2-tile solution found (potential deadlock signals). */
  deadlockProbeFailures: number;
}

/**
 * A single step in a scripted chain pattern.
 *
 * - `correct`   Find adjacent pair matching target, commit chain, resolve gravity.
 * - `wrong`     Find adjacent pair NOT matching target, commit chain.
 * - `short`     Submit a 1-tile chain (silently cancelled — tests CHAIN_MIN_LENGTH guard).
 * - `ticks`     Advance timer by n ticks (can trigger GAME_OVER).
 * - `gravity`   Explicitly resolve gravity if in CLEARING phase (no-op otherwise).
 */
export type ChainPatternStep =
  | { type: 'correct' }
  | { type: 'wrong' }
  | { type: 'short' }
  | { type: 'ticks'; n: number }
  | { type: 'gravity' };

export interface ChainPatternResult {
  /** Phase at end of pattern execution. */
  finalPhase: SGState['phase'];
  /** Score at end of pattern execution. */
  finalScore: number;
  /** Number of pattern steps actually executed (stops early on GAME_OVER). */
  stepsExecuted: number;
  /** Correct chains completed during pattern. */
  correctChains: number;
  /** Wrong chains submitted during pattern. */
  wrongChains: number;
  /** chainsCompleted from reducer state at end. */
  chainsCompleted: number;
}

// ── Module-level helpers ──────────────────────────────────────────────────────

/**
 * Synchronously resolves one gravity cycle from a CLEARING state.
 * Mirrors the async CLEARING effect in SpeedGridGame.tsx without timers.
 *
 * clearedPositions is the authoritative set of committed chain positions
 * (same source as component's lastClearedPositionsRef). Callers must supply
 * a non-empty array — explicit survivor semantics only (Phase-8 Task-10).
 */
function resolveGravitySync(
  state: SGState,
  prng: () => number,
  profile: PracticeProfile,
  clearedPositions: ReadonlyArray<{ row: number; col: number }>,
): SGState {
  if (state.phase !== 'CLEARING') return state;

  // Explicit Survivor Law (Phase-8 Task-10): harness must always provide
  // clearedPositions derived from the CHAIN_COMMIT snapshot.
  if (process.env.NODE_ENV !== 'production') {
    if (clearedPositions.length === 0) {
      throw new Error(
        '[BONUSMASK] Explicit Survivor Law violation: ' +
          'resolveGravitySync received empty clearedPositions. ' +
          'Harness must supply positions from simulateChain() commit snapshot.',
      );
    }
  }

  // Cache each SpawnedTile by (col, spawnIndex) so both spawnValue and
  // spawnBonus callbacks draw from the same spawnTile() call — one PRNG
  // token per tile, unchanged from before.
  const spawnCache: { value: number; isBonus: boolean }[][] =
    Array.from({ length: COLS }, () => []);

  const gravResult = applyGravity(
    state.grid,
    ROWS,
    COLS,
    (col: number, spawnIndex: number) => {
      const sp = spawnTile(profile, prng);
      spawnCache[col][spawnIndex] = sp;
      return sp.value;
    },
    (col: number, spawnIndex: number) => spawnCache[col][spawnIndex].isBonus,
  );

  // Source: clearedPositions from simulateChain() — the positions array
  // captured at CHAIN_COMMIT, identical to lastClearedPositionsRef in the
  // component. Passed directly; no fallback (Explicit Survivor Law).
  const newBonusMask = applyBonusMaskGravity(
    state.bonusMask,
    state.grid,
    gravResult.spawnBonusMap,
    ROWS,
    COLS,
    clearedPositions,
  );

  const newTarget = generateTarget(
    gravResult.grid,
    ROWS,
    COLS,
    state.mode,
    profile,
    prng,
  );

  return sgReducer(state, {
    type: 'GRAVITY_DONE',
    grid: gravResult.grid,
    bonusMask: newBonusMask,
    target: newTarget,
  });
}

/**
 * Finds the first Chebyshev-adjacent pair that sums to `target`.
 * Returns null if none found.
 */
function findAdjacentPairForTarget(
  grid: number[][],
  target: number,
): [{ row: number; col: number }, { row: number; col: number }] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === 0) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r2 = r + dr, c2 = c + dc;
          if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) continue;
          if (grid[r2][c2] === 0) continue;
          if (grid[r][c] + grid[r2][c2] === target) {
            return [{ row: r, col: c }, { row: r2, col: c2 }];
          }
        }
      }
    }
  }
  return null;
}

/**
 * Finds the first Chebyshev-adjacent pair that does NOT sum to `target`.
 * Returns null if every adjacent pair matches target (degenerate board).
 */
function findWrongAdjacentPair(
  grid: number[][],
  target: number,
): [{ row: number; col: number }, { row: number; col: number }] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === 0) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r2 = r + dr, c2 = c + dc;
          if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) continue;
          if (grid[r2][c2] === 0) continue;
          if (grid[r][c] + grid[r2][c2] !== target) {
            return [{ row: r, col: c }, { row: r2, col: c2 }];
          }
        }
      }
    }
  }
  return null;
}

/** Count true values in a boolean[][]. */
function countBonuses(mask: boolean[][]): number {
  return mask.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

// ── SGHarness ─────────────────────────────────────────────────────────────────

export class SGHarness {
  readonly state: SGState;
  readonly prng: () => number;
  readonly profile: PracticeProfile;

  // Committed chain positions from the most recent valid CHAIN_COMMIT.
  // Captured by simulateChain(); forwarded by resolveGravity() to
  // resolveGravitySync() as the authoritative clearedPositions.
  // Not part of SGState — harness-only bookkeeping.
  private readonly lastClearedPositions: ReadonlyArray<{
    row: number;
    col: number;
  }>;

  private constructor(
    state: SGState,
    prng: () => number,
    profile: PracticeProfile,
    lastClearedPositions: ReadonlyArray<{ row: number; col: number }> = [],
  ) {
    this.state = state;
    this.prng = prng;
    this.profile = profile;
    this.lastClearedPositions = lastClearedPositions;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /** Creates a harness seeded with `seed`. Same seed always produces same board. */
  static create(seed: number): SGHarness {
    const profile = getProfile(DEFAULT_PROFILE_ID);
    const prng = makePrng(seed);
    const state = initGame(profile, prng);
    return new SGHarness(state, prng, profile);
  }

  // ── Instance step primitives ─────────────────────────────────────────────

  /** Dispatches a single action and returns a new harness with updated state. */
  step(action: SGAction): SGHarness {
    const next = sgReducer(this.state, action);
    return new SGHarness(next, this.prng, this.profile);
  }

  /**
   * Simulates a full drag chain: CHAIN_START → CHAIN_EXTENDs → CHAIN_COMMIT.
   * Each consecutive pair of positions must be Chebyshev-adjacent.
   *
   * If the commit produces a CLEARING transition, positions are stored as
   * lastClearedPositions so resolveGravity() can forward them as the
   * authoritative clearedPositions (Explicit Survivor Law).
   */
  simulateChain(positions: Array<{ row: number; col: number }>): SGHarness {
    if (positions.length === 0) return this;
    let h: SGHarness = this.step({ type: 'CHAIN_START', pos: positions[0] });
    for (let i = 1; i < positions.length; i++) {
      h = h.step({ type: 'CHAIN_EXTEND', pos: positions[i] });
    }
    const afterCommit = h.step({ type: 'CHAIN_COMMIT' });
    // Capture positions when a valid commit fires CLEARING.
    // Source: positions arg — same authoritative source as lastClearedPositionsRef.
    if (afterCommit.state.phase === 'CLEARING') {
      return new SGHarness(
        afterCommit.state,
        afterCommit.prng,
        afterCommit.profile,
        positions,
      );
    }
    return afterCommit;
  }

  /**
   * Synchronously resolves one CLEARING cycle → PLAYING.
   * No-op if not in CLEARING phase.
   *
   * Forwards lastClearedPositions (captured by simulateChain on valid commit)
   * to resolveGravitySync as the authoritative clearedPositions.
   */
  resolveGravity(): SGHarness {
    const next = resolveGravitySync(
      this.state,
      this.prng,
      this.profile,
      this.lastClearedPositions,
    );
    return new SGHarness(next, this.prng, this.profile);
  }

  /** Dispatches n TICK actions. Stops early if GAME_OVER is reached. */
  simulateTicks(n: number): SGHarness {
    let h: SGHarness = this;
    for (let i = 0; i < n; i++) {
      if (h.state.phase === 'GAME_OVER') break;
      h = h.step({ type: 'TICK' });
    }
    return h;
  }

  // ── Assertions ───────────────────────────────────────────────────────────

  /** Throws if condition is false. */
  assert(condition: boolean, msg: string): void {
    if (!condition) throw new Error(`Assertion failed: ${msg}`);
  }

  assertPhase(expected: SGState['phase']): void {
    this.assert(
      this.state.phase === expected,
      `Expected phase ${expected}, got ${this.state.phase}`,
    );
  }

  assertGridFull(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.assert(
          this.state.grid[r][c] !== 0,
          `Grid has empty cell at [${r}][${c}]`,
        );
      }
    }
  }

  // ── Static harness APIs ───────────────────────────────────────────────────

  /**
   * Runs the full Phase-7 Verification Matrix (22 items).
   * All tests are deterministic, seed-driven, and isolated.
   */
  static runVerificationMatrix(): HarnessSuiteResult {
    const results: HarnessTestResult[] = [];

    function run(name: string, fn: () => void): void {
      try {
        fn();
        results.push({ name, pass: true });
      } catch (e) {
        results.push({
          name,
          pass: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // ── Category 1: Initial state invariants ─────────────────────────────

    run('VM-1: initGame → WAITING_TO_START', () => {
      SGHarness.create(42).assertPhase('WAITING_TO_START');
    });

    run('VM-2: initial board has no empty cells', () => {
      SGHarness.create(42).assertGridFull();
    });

    run('VM-3: board dimensions are ROWS×COLS', () => {
      const h = SGHarness.create(42);
      h.assert(h.state.grid.length === ROWS, `grid.length should be ${ROWS}`);
      h.assert(h.state.grid[0].length === COLS, `grid[0].length should be ${COLS}`);
    });

    run('VM-4: bonusMask dimensions match grid on init', () => {
      const h = SGHarness.create(42);
      h.assert(h.state.bonusMask.length === ROWS, 'bonusMask row count mismatch');
      h.assert(h.state.bonusMask[0].length === COLS, 'bonusMask col count mismatch');
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          h.assert(
            typeof h.state.bonusMask[r][c] === 'boolean',
            `bonusMask[${r}][${c}] is not boolean`,
          );
        }
      }
    });

    // ── Category 2: Timer lifecycle ──────────────────────────────────────

    run('VM-5: timer not running in WAITING_TO_START', () => {
      const h = SGHarness.create(42);
      h.assert(!h.state.timer.isRunning, 'Timer should not be running before first gesture');
    });

    run('VM-6: first CHAIN_START starts timer + transitions to PLAYING', () => {
      const h = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      h.assertPhase('PLAYING');
      h.assert(h.state.timer.isRunning, 'Timer should be running after first gesture');
    });

    run('VM-7: TICK decrements remaining seconds', () => {
      const h0 = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const before = h0.state.timer.remainingSeconds;
      const after = h0.step({ type: 'TICK' }).state.timer.remainingSeconds;
      h0.assert(after < before, 'remainingSeconds should decrease after TICK');
    });

    run('VM-8: timer expiry transitions to GAME_OVER', () => {
      SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .simulateTicks(65)
        .assertPhase('GAME_OVER');
    });

    // ── Category 3: Chain lifecycle ──────────────────────────────────────

    run('VM-9: CHAIN_START in PLAYING creates active chain', () => {
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .step({ type: 'CHAIN_COMMIT' })
        .step({ type: 'CHAIN_START', pos: { row: 1, col: 1 } });
      h.assert(h.state.chain.isActive, 'Chain should be active');
      h.assert(h.state.chain.positions.length === 1, 'Chain should have 1 tile');
    });

    run('VM-10: CHAIN_EXTEND appends Chebyshev-adjacent tile', () => {
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .step({ type: 'CHAIN_EXTEND', pos: { row: 0, col: 1 } });
      h.assert(h.state.chain.positions.length === 2, 'Chain should have 2 tiles');
    });

    run('VM-11: CHAIN_EXTEND rejects non-adjacent tile', () => {
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .step({ type: 'CHAIN_EXTEND', pos: { row: 4, col: 3 } });
      h.assert(h.state.chain.positions.length === 1, 'Chain should still have 1 tile');
    });

    run('VM-12: CHAIN_COMMIT < min length cancels silently', () => {
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .step({ type: 'CHAIN_COMMIT' }); // 1 tile only
      h.assert(h.state.chain.positions.length === 0, 'Chain should be empty');
      h.assert(!h.state.chain.isActive, 'Chain should be inactive');
      h.assertPhase('PLAYING');
    });

    run('VM-13: wrong chain resets combo and sets wrongFlash', () => {
      const h0 = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const wrongPair = findWrongAdjacentPair(h0.state.grid, h0.state.target);
      if (!wrongPair) throw new Error('Degenerate board: all pairs match target');
      const h = h0.simulateChain(wrongPair);
      h.assert(h.state.wrongFlash === true, 'wrongFlash should be set');
      h.assert(h.state.score.comboCount === 0, 'combo should be reset to 0');
      h.assertPhase('PLAYING');
    });

    run('VM-14: correct chain → CLEARING + chainsCompleted increments', () => {
      const h0 = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const pair = findAdjacentPairForTarget(h0.state.grid, h0.state.target);
      if (!pair) throw new Error('No adjacent pair found on seed 42');
      const h = h0.simulateChain(pair);
      h.assertPhase('CLEARING');
      h.assert(h.state.chainsCompleted === 1, 'chainsCompleted should be 1');
    });

    // ── Category 4: Gravity propagation ─────────────────────────────────

    run('VM-15: after gravity board has no empty cells', () => {
      const h0 = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const pair = findAdjacentPairForTarget(h0.state.grid, h0.state.target);
      if (!pair) throw new Error('No pair found');
      const h = h0.simulateChain(pair).resolveGravity();
      h.assertPhase('PLAYING');
      h.assertGridFull();
    });

    run('VM-16: GRAVITY_DONE transitions to PLAYING', () => {
      const h0 = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const pair = findAdjacentPairForTarget(h0.state.grid, h0.state.target);
      if (!pair) throw new Error('No pair found');
      SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .simulateChain(pair)
        .resolveGravity()
        .assertPhase('PLAYING');
    });

    // ── Category 5: BonusMask propagation ───────────────────────────────

    run('VM-17: bonusMask dimensions correct after gravity', () => {
      const h0 = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const pair = findAdjacentPairForTarget(h0.state.grid, h0.state.target);
      if (!pair) throw new Error('No pair found');
      const h = h0.simulateChain(pair).resolveGravity();
      h.assert(h.state.bonusMask.length === ROWS, `bonusMask rows should be ${ROWS}`);
      h.assert(h.state.bonusMask[0].length === COLS, `bonusMask cols should be ${COLS}`);
    });

    run('VM-18: bonusMask structural integrity over 5 rounds', () => {
      let h = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      for (let round = 0; round < 5; round++) {
        if (h.state.phase === 'GAME_OVER') break;
        const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
        if (!pair) break;
        h = h.simulateChain(pair).resolveGravity();
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            h.assert(
              typeof h.state.bonusMask[r][c] === 'boolean',
              `bonusMask[${r}][${c}] not boolean at round ${round + 1}`,
            );
          }
        }
      }
    });

    run('VM-19: bonus count never exceeds ROWS×COLS', () => {
      let h = SGHarness.create(55).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      for (let round = 0; round < 8; round++) {
        if (h.state.phase === 'GAME_OVER') break;
        const bonusCount = countBonuses(h.state.bonusMask);
        h.assert(bonusCount <= ROWS * COLS, `bonusCount ${bonusCount} exceeds ${ROWS * COLS}`);
        const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
        if (!pair) break;
        h = h.simulateChain(pair).resolveGravity();
      }
    });

    // ── Category 6: Target solvability ──────────────────────────────────

    run('VM-20: new target has adjacent solution after 3 rounds', () => {
      let h = SGHarness.create(99).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      for (let round = 0; round < 3; round++) {
        const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
        if (!pair) throw new Error(`No pair at round ${round}`);
        h = h.simulateChain(pair).resolveGravity();
      }
      const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
      h.assert(pair !== null, 'Target must be achievable on refilled board');
    });

    // ── Category 7: Phase transitions ────────────────────────────────────

    run('VM-21: PLAY_AGAIN resets to WAITING_TO_START', () => {
      const profile = getProfile(DEFAULT_PROFILE_ID);
      const prng2 = makePrng(7);
      const newState = initGame(profile, prng2);
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .simulateTicks(65)
        .step({ type: 'PLAY_AGAIN', newState });
      h.assertPhase('WAITING_TO_START');
      h.assertGridFull();
      h.assert(!h.state.timer.isRunning, 'Timer should not run after PLAY_AGAIN');
      h.assert(h.state.chainsCompleted === 0, 'chainsCompleted should reset');
      h.assert(h.state.score.score === 0, 'score should reset');
    });

    // ── Category 8: Game-over resolution ────────────────────────────────

    run('VM-22: GAME_OVER — score preserved, chain cleared', () => {
      let h = SGHarness.create(42).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      // Build score with a few chains
      for (let i = 0; i < 3; i++) {
        const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
        if (!pair) break;
        h = h.simulateChain(pair).resolveGravity();
      }
      const scoreBefore = h.state.score.score;
      const chainsBefore = h.state.chainsCompleted;
      h = h.simulateTicks(65);
      h.assertPhase('GAME_OVER');
      h.assert(h.state.score.score === scoreBefore, 'Score should be preserved at GAME_OVER');
      h.assert(h.state.chainsCompleted === chainsBefore, 'chainsCompleted preserved at GAME_OVER');
      h.assert(h.state.chain.positions.length === 0, 'Chain cleared at GAME_OVER');
      h.assert(!h.state.chain.isActive, 'Chain inactive at GAME_OVER');
    });

    // ── Category 9: Replay determinism ──────────────────────────────────

    run('VM-23: same seed produces identical initial board', () => {
      const h1 = SGHarness.create(12345);
      const h2 = SGHarness.create(12345);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          h1.assert(
            h1.state.grid[r][c] === h2.state.grid[r][c],
            `Grid mismatch at [${r}][${c}]`,
          );
        }
      }
      h1.assert(h1.state.target === h2.state.target, 'Targets must match for same seed');
    });

    run('VM-24: same seed produces identical state after same action sequence', () => {
      const action = { type: 'CHAIN_START' as const, pos: { row: 2, col: 1 } };
      const r1 = SGHarness.create(77).step(action);
      const r2 = SGHarness.create(77).step(action);
      r1.assert(r1.state.phase === r2.state.phase, 'Phase mismatch');
      r1.assert(r1.state.timer.isRunning === r2.state.timer.isRunning, 'Timer mismatch');
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          r1.assert(r1.state.grid[r][c] === r2.state.grid[r][c], `Grid mismatch at [${r}][${c}]`);
        }
      }
    });

    // ── Category 10: Reducer purity ──────────────────────────────────────

    run('VM-25: reducer purity — same inputs produce same phase output', () => {
      // Drive two harnesses identically to the same state, apply the same
      // action, and verify the outputs match.
      const seq = [
        { type: 'CHAIN_START' as const, pos: { row: 0, col: 0 } },
        { type: 'CHAIN_EXTEND' as const, pos: { row: 0, col: 1 } },
      ];
      let h1 = SGHarness.create(33);
      let h2 = SGHarness.create(33);
      for (const a of seq) {
        h1 = h1.step(a);
        h2 = h2.step(a);
      }
      // Both should be identical; one more step should produce identical output.
      const commit = { type: 'CHAIN_COMMIT' as const };
      const o1 = h1.step(commit);
      const o2 = h2.step(commit);
      o1.assert(o1.state.phase === o2.state.phase, 'Reducer output phase differs');
      o1.assert(
        o1.state.chain.positions.length === o2.state.chain.positions.length,
        'Reducer output chain length differs',
      );
    });

    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    return { passed, failed, total: results.length, results };
  }

  /** Backward-compatible alias for runVerificationMatrix(). */
  static runAll(): HarnessSuiteResult {
    return SGHarness.runVerificationMatrix();
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Seeded multi-round stress test.
   *
   * Simulates up to `rounds` successful chain completions starting from `seed`.
   * When no adjacent solution exists, submits a wrong chain and continues.
   * Stops early on GAME_OVER.
   *
   * @param seed   Deterministic PRNG seed — same seed always produces same run.
   * @param rounds Maximum number of successful chains to attempt.
   */
  static runStressTest(seed: number, rounds: number): StressTestResult {
    let h = SGHarness.create(seed).step({
      type: 'CHAIN_START',
      pos: { row: 0, col: 0 },
    });

    let chainsAttempted = 0;
    let wrongChains = 0;
    let completedRounds = 0;
    let deadlockProbeFailures = 0;
    const targetHistory: number[] = [h.state.target];

    // Safety: never loop more than rounds * 20 iterations to avoid infinite loops
    // on degenerate boards (e.g., no adjacent pairs for any target).
    const maxIter = rounds * 20;

    for (let i = 0; i < maxIter && completedRounds < rounds; i++) {
      if (h.state.phase === 'GAME_OVER') break;
      if (h.state.phase === 'CLEARING') {
        h = h.resolveGravity();
        continue;
      }

      const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
      chainsAttempted++;

      if (pair) {
        h = h.simulateChain(pair);
        if (h.state.phase === 'CLEARING') {
          h = h.resolveGravity();
          completedRounds++;
          targetHistory.push(h.state.target);
          // Probe 2-tile solvability on refilled board
          if (!findAdjacentPairForTarget(h.state.grid, h.state.target)) {
            deadlockProbeFailures++;
          }
        }
      } else {
        // No solution found — record probe failure and submit wrong chain
        deadlockProbeFailures++;
        const wrongPair = findWrongAdjacentPair(h.state.grid, h.state.target);
        if (wrongPair) {
          h = h.simulateChain(wrongPair);
          wrongChains++;
        } else {
          break; // Board has no adjacent pairs at all — cannot continue
        }
      }
    }

    return {
      seed,
      rounds,
      chainsAttempted,
      chainsCompleted: h.state.chainsCompleted,
      wrongChains,
      bonusesCollected: h.state.bonusesCollected,
      finalScore: h.state.score.score,
      finalPhase: h.state.phase,
      targetHistory,
      deadlockProbeFailures,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Executes a scripted chain pattern against a seeded game.
   *
   * Pattern steps:
   *   `correct`      Find + commit correct adjacent pair; auto-resolves gravity.
   *   `wrong`        Find + commit wrong adjacent pair (stays in PLAYING).
   *   `short`        Commit a 1-tile chain (tests min-length guard).
   *   `ticks n`      Advance timer n ticks (may trigger GAME_OVER).
   *   `gravity`      Resolve gravity if in CLEARING (no-op otherwise).
   *
   * @param pattern  Sequence of steps to execute.
   * @param seed     Deterministic seed (default: 42).
   */
  static runChainPattern(
    pattern: ChainPatternStep[],
    seed: number = 42,
  ): ChainPatternResult {
    // Auto-start game: transition from WAITING_TO_START to PLAYING.
    let h = SGHarness.create(seed).step({
      type: 'CHAIN_START',
      pos: { row: 0, col: 0 },
    });
    // That CHAIN_START also begins a chain — cancel it immediately.
    h = h.step({ type: 'CHAIN_COMMIT' });

    let stepsExecuted = 0;
    let correctChains = 0;
    let wrongChains = 0;

    for (const step of pattern) {
      if (h.state.phase === 'GAME_OVER') break;
      stepsExecuted++;

      switch (step.type) {
        case 'correct': {
          if (h.state.phase === 'CLEARING') h = h.resolveGravity();
          if (h.state.phase !== 'PLAYING') break;
          const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
          if (!pair) break; // no solution available — step is skipped
          h = h.simulateChain(pair);
          correctChains++;
          // Auto-resolve gravity so next step always starts in PLAYING.
          if (h.state.phase === 'CLEARING') h = h.resolveGravity();
          break;
        }

        case 'wrong': {
          if (h.state.phase !== 'PLAYING') break;
          const wrongPair = findWrongAdjacentPair(h.state.grid, h.state.target);
          if (!wrongPair) break;
          h = h.simulateChain(wrongPair);
          wrongChains++;
          break;
        }

        case 'short': {
          if (h.state.phase !== 'PLAYING') break;
          // Submit a 1-tile chain — always silently cancelled.
          h = h.step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
          h = h.step({ type: 'CHAIN_COMMIT' });
          break;
        }

        case 'ticks': {
          h = h.simulateTicks(step.n);
          break;
        }

        case 'gravity': {
          if (h.state.phase === 'CLEARING') h = h.resolveGravity();
          break;
        }
      }
    }

    return {
      finalPhase: h.state.phase,
      finalScore: h.state.score.score,
      stepsExecuted,
      correctChains,
      wrongChains,
      chainsCompleted: h.state.chainsCompleted,
    };
  }
}
