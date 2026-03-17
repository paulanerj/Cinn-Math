// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/harness/SpeedGridHarness.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Deterministic test harness for SpeedGrid game logic.
//        Zero React. Zero DOM. Synchronous gravity resolution.
//        Exercises all items in the Phase-7 Verification Matrix.
//
// [WHY] The reducer and init logic in sgReducer.ts are pure functions that
//       can be driven headlessly. This harness lets us verify every invariant
//       of the state machine without mounting a React component, without a
//       browser, and without any timing or animation dependencies.
//
// [USAGE]
//   import { SGHarness } from './SpeedGridHarness';
//   const results = SGHarness.runAll();
//   console.log(results);
//
// [INVARIANT] Zero React imports. No DOM. No async. No setTimeout.
//             All gravity is resolved synchronously via resolveGravity().
// ─────────────────────────────────────────────────────────────────────────────

import {
  makePrng,
  spawnTile,
  generateTarget,
  getProfile,
  DEFAULT_PROFILE_ID,
  chainMatchesTarget,
} from '../../../engine/public';
import type { PracticeProfile } from '../../../engine/PracticeProfile';
import { applyGravity } from '../../../systems/GravitySystem';
import { initGame, sgReducer, applyBonusMaskGravity } from '../sgReducer';
import type { SGState, SGAction } from '../types';
import { ROWS, COLS, CHAIN_MIN_LENGTH } from '../constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HarnessTestResult {
  name: string;
  pass: boolean;
  error?: string;
}

export interface HarnessSuiteResult {
  passed: number;
  failed: number;
  results: HarnessTestResult[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Synchronously resolves one gravity cycle from a CLEARING state.
 * Mirrors the async CLEARING effect in SpeedGridGame.tsx but runs
 * synchronously so tests can call it without timers.
 */
function resolveGravity(
  state: SGState,
  prng: () => number,
  profile: PracticeProfile,
): SGState {
  if (state.phase !== 'CLEARING') return state;

  const spawnBonuses: boolean[][] = Array.from({ length: COLS }, () => []);

  const gravResult = applyGravity(
    state.grid,
    ROWS,
    COLS,
    (col: number, spawnIndex: number) => {
      const sp = spawnTile(profile, prng);
      spawnBonuses[col][spawnIndex] = sp.isBonus;
      return sp.value;
    },
  );

  const newBonusMask = applyBonusMaskGravity(
    state.bonusMask,
    state.grid,
    spawnBonuses,
    ROWS,
    COLS,
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
 * Finds the first pair of adjacent tiles (Chebyshev) on the board that sums
 * to `target`. Returns the two positions, or null if none found.
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

// ── SGHarness ─────────────────────────────────────────────────────────────────

export class SGHarness {
  readonly state: SGState;
  readonly prng: () => number;
  readonly profile: PracticeProfile;

  private constructor(
    state: SGState,
    prng: () => number,
    profile: PracticeProfile,
  ) {
    this.state = state;
    this.prng = prng;
    this.profile = profile;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /** Creates a harness seeded with `seed`. Pass 0 for a fixed seed. */
  static create(seed: number): SGHarness {
    const profile = getProfile(DEFAULT_PROFILE_ID);
    const prng = makePrng(seed);
    const state = initGame(profile, prng);
    return new SGHarness(state, prng, profile);
  }

  // ── Step primitives ──────────────────────────────────────────────────────

  /** Dispatches a single action and returns a new harness with updated state. */
  step(action: SGAction): SGHarness {
    const next = sgReducer(this.state, action);
    return new SGHarness(next, this.prng, this.profile);
  }

  /**
   * Simulates a full drag chain: CHAIN_START → CHAIN_EXTENDs → CHAIN_COMMIT.
   * Positions must be a valid path (each pair Chebyshev-adjacent).
   */
  simulateChain(positions: Array<{ row: number; col: number }>): SGHarness {
    if (positions.length === 0) return this;
    let h: SGHarness = this.step({ type: 'CHAIN_START', pos: positions[0] });
    for (let i = 1; i < positions.length; i++) {
      h = h.step({ type: 'CHAIN_EXTEND', pos: positions[i] });
    }
    return h.step({ type: 'CHAIN_COMMIT' });
  }

  /**
   * Synchronously resolves one CLEARING cycle and returns a harness in
   * PLAYING phase with the settled board and new target.
   * No-op if not in CLEARING phase.
   */
  resolveGravity(): SGHarness {
    const next = resolveGravity(this.state, this.prng, this.profile);
    return new SGHarness(next, this.prng, this.profile);
  }

  /** Dispatches `n` TICK actions. Stops early if GAME_OVER is reached. */
  simulateTicks(n: number): SGHarness {
    let h: SGHarness = this;
    for (let i = 0; i < n; i++) {
      if (h.state.phase === 'GAME_OVER') break;
      h = h.step({ type: 'TICK' });
    }
    return h;
  }

  // ── Assertion helpers ────────────────────────────────────────────────────

  /** Throws with `msg` if `condition` is false. */
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

  // ── Verification Matrix (18 items) ───────────────────────────────────────

  static runAll(): HarnessSuiteResult {
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

    // ── VM-1: initGame produces WAITING_TO_START ──────────────────────────
    run('VM-1: initGame → WAITING_TO_START', () => {
      const h = SGHarness.create(42);
      h.assertPhase('WAITING_TO_START');
    });

    // ── VM-2: Board is fully populated on init ────────────────────────────
    run('VM-2: initial board has no empty cells', () => {
      const h = SGHarness.create(42);
      h.assertGridFull();
    });

    // ── VM-3: Board is ROWS×COLS ──────────────────────────────────────────
    run('VM-3: board dimensions are ROWS×COLS', () => {
      const h = SGHarness.create(42);
      h.assert(h.state.grid.length === ROWS, `grid.length should be ${ROWS}`);
      h.assert(
        h.state.grid[0].length === COLS,
        `grid[0].length should be ${COLS}`,
      );
    });

    // ── VM-4: Timer not running in WAITING_TO_START ───────────────────────
    run('VM-4: timer is not running before first gesture', () => {
      const h = SGHarness.create(42);
      h.assert(!h.state.timer.isRunning, 'Timer should not be running yet');
    });

    // ── VM-5: CHAIN_START in WAITING_TO_START → PLAYING + timer running ───
    run('VM-5: first CHAIN_START starts timer + transitions to PLAYING', () => {
      const h = SGHarness.create(42);
      const h2 = h.step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      h2.assertPhase('PLAYING');
      h2.assert(h2.state.timer.isRunning, 'Timer should be running after first gesture');
      h2.assert(h2.state.chain.isActive, 'Chain should be active');
    });

    // ── VM-6: CHAIN_START in PLAYING starts new chain ─────────────────────
    run('VM-6: CHAIN_START in PLAYING creates active chain', () => {
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .step({ type: 'CHAIN_COMMIT' })
        .step({ type: 'CHAIN_START', pos: { row: 1, col: 1 } });
      h.assertPhase('PLAYING');
      h.assert(h.state.chain.isActive, 'Chain should be active');
      h.assert(
        h.state.chain.positions.length === 1,
        'Chain should have exactly 1 tile after CHAIN_START',
      );
    });

    // ── VM-7: CHAIN_EXTEND adds adjacent tile ─────────────────────────────
    run('VM-7: CHAIN_EXTEND appends Chebyshev-adjacent tile', () => {
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .step({ type: 'CHAIN_EXTEND', pos: { row: 0, col: 1 } });
      h.assert(
        h.state.chain.positions.length === 2,
        'Chain should have 2 tiles after one extend',
      );
    });

    // ── VM-8: CHAIN_EXTEND ignores non-adjacent tile ──────────────────────
    run('VM-8: CHAIN_EXTEND rejects non-adjacent tile', () => {
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .step({ type: 'CHAIN_EXTEND', pos: { row: 4, col: 3 } }); // far away
      h.assert(
        h.state.chain.positions.length === 1,
        'Chain should still have 1 tile after rejected extend',
      );
    });

    // ── VM-9: CHAIN_COMMIT too short → cancel + empty chain ──────────────
    run('VM-9: CHAIN_COMMIT with < CHAIN_MIN_LENGTH tiles cancels silently', () => {
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .step({ type: 'CHAIN_COMMIT' }); // only 1 tile — below min
      h.assert(
        h.state.chain.positions.length === 0,
        'Chain should be empty after too-short commit',
      );
      h.assert(!h.state.chain.isActive, 'Chain should be inactive');
      // Still in same phase (PLAYING after starting was triggered by CHAIN_START)
      h.assert(
        h.state.phase === 'PLAYING',
        'Should remain in PLAYING after short commit',
      );
    });

    // ── VM-10: Wrong answer resets combo + sets wrongFlash ────────────────
    run('VM-10: wrong answer resets combo and sets wrongFlash', () => {
      const h0 = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });

      // Find a pair that does NOT sum to target
      const grid = h0.state.grid;
      const target = h0.state.target;
      let wrongPair: [{ row: number; col: number }, { row: number; col: number }] | null = null;
      outer: for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c] === 0) continue;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const r2 = r + dr, c2 = c + dc;
              if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) continue;
              if (grid[r2][c2] === 0) continue;
              if (grid[r][c] + grid[r2][c2] !== target) {
                wrongPair = [{ row: r, col: c }, { row: r2, col: c2 }];
                break outer;
              }
            }
          }
        }
      }
      if (!wrongPair) {
        // All adjacent pairs happen to sum to target; skip
        throw new Error('Skipped: all adjacent pairs match target (degenerate board)');
      }

      const h = h0.simulateChain(wrongPair);
      h.assert(h.state.wrongFlash === true, 'wrongFlash should be set');
      h.assert(h.state.score.comboCount === 0, 'combo should be reset to 0');
      h.assertPhase('PLAYING');
    });

    // ── VM-11: Correct answer → CLEARING phase ────────────────────────────
    run('VM-11: correct chain → transitions to CLEARING', () => {
      const h0 = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const pair = findAdjacentPairForTarget(h0.state.grid, h0.state.target);
      if (!pair) throw new Error('No adjacent pair found for target on seed 42');
      const h = h0.simulateChain(pair);
      h.assertPhase('CLEARING');
      h.assert(h.state.chainsCompleted === 1, 'chainsCompleted should be 1');
    });

    // ── VM-12: CLEARING → gravity fills board (no zeros) ─────────────────
    run('VM-12: after gravity board has no empty cells', () => {
      const h0 = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const pair = findAdjacentPairForTarget(h0.state.grid, h0.state.target);
      if (!pair) throw new Error('No adjacent pair found for target on seed 42');
      const h = h0.simulateChain(pair).resolveGravity();
      h.assertPhase('PLAYING');
      h.assertGridFull();
    });

    // ── VM-13: bonusMask dimensions match grid after gravity ──────────────
    run('VM-13: bonusMask is ROWS×COLS after gravity', () => {
      const h0 = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const pair = findAdjacentPairForTarget(h0.state.grid, h0.state.target);
      if (!pair) throw new Error('No adjacent pair found');
      const h = h0.simulateChain(pair).resolveGravity();
      h.assert(
        h.state.bonusMask.length === ROWS,
        `bonusMask rows should be ${ROWS}`,
      );
      h.assert(
        h.state.bonusMask[0].length === COLS,
        `bonusMask cols should be ${COLS}`,
      );
    });

    // ── VM-14: New target is achievable after gravity ─────────────────────
    run('VM-14: new target has at least one solution on refilled board', () => {
      // Run 3 complete rounds to exercise target regeneration
      let h = SGHarness.create(99).step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      for (let round = 0; round < 3; round++) {
        const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
        if (!pair) throw new Error(`No pair found at round ${round}`);
        h = h.simulateChain(pair).resolveGravity();
      }
      // Target on the final board must have a solution
      const pair = findAdjacentPairForTarget(h.state.grid, h.state.target);
      h.assert(pair !== null, 'Target must be achievable after 3 rounds');
    });

    // ── VM-15: GRAVITY_DONE transitions back to PLAYING ───────────────────
    run('VM-15: GRAVITY_DONE transitions to PLAYING', () => {
      const h0 = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const pair = findAdjacentPairForTarget(h0.state.grid, h0.state.target);
      if (!pair) throw new Error('No pair found');
      const h = h0.simulateChain(pair).resolveGravity();
      h.assertPhase('PLAYING');
    });

    // ── VM-16: TICK decrements remaining time ─────────────────────────────
    run('VM-16: TICK decrements remaining seconds', () => {
      const h0 = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      const before = h0.state.timer.remainingSeconds;
      const h1 = h0.step({ type: 'TICK' });
      const after = h1.state.timer.remainingSeconds;
      h0.assert(after < before, 'remainingSeconds should decrease after TICK');
    });

    // ── VM-17: Enough TICKs → GAME_OVER ──────────────────────────────────
    run('VM-17: timer expiry transitions to GAME_OVER', () => {
      const h0 = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } });
      // A TICK decrements by 1s; ROUND_DURATION_SECS is 60.
      // Dispatch 65 ticks — enough to exhaust any timer.
      const h = h0.simulateTicks(65);
      h.assertPhase('GAME_OVER');
    });

    // ── VM-18: PLAY_AGAIN produces fresh WAITING_TO_START state ──────────
    run('VM-18: PLAY_AGAIN resets to fresh WAITING_TO_START', () => {
      const profile = getProfile(DEFAULT_PROFILE_ID);
      const prng2 = makePrng(7);
      const newState = initGame(profile, prng2);
      const h = SGHarness.create(42)
        .step({ type: 'CHAIN_START', pos: { row: 0, col: 0 } })
        .simulateTicks(65) // go to GAME_OVER
        .step({ type: 'PLAY_AGAIN', newState });
      h.assertPhase('WAITING_TO_START');
      h.assertGridFull();
      h.assert(!h.state.timer.isRunning, 'Timer should not be running on fresh state');
      h.assert(h.state.chainsCompleted === 0, 'chainsCompleted should reset to 0');
      h.assert(h.state.score.score === 0, 'score should reset to 0');
    });

    // ── Summary ───────────────────────────────────────────────────────────

    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    return { passed, failed, results };
  }
}
