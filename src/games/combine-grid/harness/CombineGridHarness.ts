// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/harness/CombineGridHarness.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Deterministic test harness for CombineGrid game logic.
//        Zero React. Zero DOM. Synchronous resolution of all async effects.
//
// [PUBLIC API]
//   CGHarness.create(seed, profile?)        → CGHarness  (new session)
//   CGHarness.runVerificationMatrix()       → void (throws on first failure)
//
// [INSTANCE API — TAP path]
//   .tapSequence(positions)    → new CGHarness  (dispatch TAP_TILE per position)
//   .resolveGravity()          → new CGHarness  (synchronous orchestrator call)
//
// [INSTANCE API — DRAG path]
//   .dragMerge(src, dst)       → new CGHarness  (dispatch DRAG_START + DRAG_DROP)
//   .resolveRespawn()          → new CGHarness  (synchronous in-place respawn)
//
// [INSTANCE API — shared]
//   .advanceRound()            → new CGHarness  (synchronous ROUND_OVER effect)
//   .resolveStalemate()        → new CGHarness  (synchronous STALEMATE effect)
//   .getState()                → CGState
//
// [INVARIANT] Zero React imports. No DOM. No async. No setTimeout.
//
// [PIPELINE — TAP path]
//   1. Reducer owns all logical mutations (TAP_TILE clears board + bonusMask)
//   2. resolveGravity() reads state.board (already zeroed) + state.clearingPositions
//   3. runGravityOrchestrator produces new grid, bonusMask, target
//   4. CLEAR_COMPLETE dispatched — reducer applies result
//
// [PIPELINE — DRAG path]
//   1. dragMerge(src, dst) dispatches DRAG_START then DRAG_DROP
//   2. DRAG_DROP: merge applies immediately; src zeroed, respawnPositions=[src]
//      OR both cleared, respawnPositions=[src,dst]
//   3. resolveRespawn() mirrors RESPAWNING effect: spawns tile(s) in-place,
//      generates new target for full-clear, dispatches RESPAWN_COMPLETE
//   4. RESPAWN_COMPLETE: reducer fills positions, checks stalemate
// ─────────────────────────────────────────────────────────────────────────────

import {
  makePrng,
  spawnTile,
  spawnBoard,
  gridFromSpawn,
  generateTarget,
  getProfile,
  DEFAULT_PROFILE_ID,
} from '../../../engine/public';
import type { PracticeProfile } from '../../../engine/PracticeProfile';
import { runGravityOrchestrator } from '../../../systems/GravityOrchestrator';
import { initGame, reducer } from '../cgReducer';
import type { CGState } from '../cgReducer';
import { ROWS, COLS } from '../constants';

// ── Module-level helpers ──────────────────────────────────────────────────────

/** Deep equality for number[][]. */
function gridsEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

/** Deep equality for boolean[][]. */
function masksEqual(a: boolean[][], b: boolean[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

/** Throws a formatted VM assertion failure. */
function assertVM(cond: boolean, vmId: string, detail: string): void {
  if (!cond) throw new Error(`[VM-${vmId}] ${detail}`);
}

/**
 * Finds the first pair of distinct non-zero board positions whose values
 * sum to target. No adjacency constraint — mirrors CombineGrid's tap mechanic.
 * Returns null if no such pair exists.
 */
function findMatchingPair(
  board: number[][],
  target: number,
): [{ row: number; col: number }, { row: number; col: number }] | null {
  const cells: Array<{ row: number; col: number; val: number }> = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] !== 0) cells.push({ row: r, col: c, val: board[r][c] });
    }
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (cells[i].val * cells[j].val === target) {
        return [
          { row: cells[i].row, col: cells[i].col },
          { row: cells[j].row, col: cells[j].col },
        ];
      }
    }
  }
  return null;
}

// ── resolveGravitySync ────────────────────────────────────────────────────────

function resolveGravitySync(
  state: CGState,
  prng: () => number,
  profile: PracticeProfile,
): CGState {
  if (state.phase !== 'CLEARING') return state;

  if (process.env.NODE_ENV !== 'production') {
    if (state.clearingPositions.length === 0) {
      throw new Error(
        '[CG_HARNESS] Explicit Survivor Law violation: ' +
          'resolveGravitySync called with empty clearingPositions.',
      );
    }
  }

  const spawnCache: { value: number; isBonus: boolean }[][] =
    Array.from({ length: COLS }, () => []);

  const orchResult = runGravityOrchestrator({
    grid: state.board,
    bonusMask: state.bonusMask,
    clearedPositions: state.clearingPositions,
    rows: ROWS,
    cols: COLS,
    spawnValue: (col: number, spawnIndex: number) => {
      const sp = spawnTile(profile, prng);
      spawnCache[col][spawnIndex] = sp;
      return sp.value;
    },
    spawnBonus: (col: number, spawnIndex: number) => spawnCache[col][spawnIndex].isBonus,
    generateNextTarget: (settledGrid) =>
      generateTarget(settledGrid, ROWS, COLS, state.mode, profile, prng),
  });

  return reducer(state, {
    type: 'CLEAR_COMPLETE',
    board: orchResult.grid,
    bonusMask: orchResult.bonusMask,
    target: orchResult.target,
  });
}

// ── advanceRoundSync ──────────────────────────────────────────────────────────
//
// Mirrors the ROUND_OVER effect in CombineGridGame.tsx without timers.
// Spawns a fresh board, builds bonusMask from spawnedTiles.isBonus,
// generates a new target, and dispatches ADVANCE_ROUND.

function advanceRoundSync(
  state: CGState,
  prng: () => number,
  profile: PracticeProfile,
): CGState {
  const spawnedTiles = spawnBoard(ROWS, COLS, profile, prng);
  const board = gridFromSpawn(ROWS, COLS, spawnedTiles);
  const bonusMask: boolean[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => spawnedTiles[r * COLS + c].isBonus),
  );
  const target = generateTarget(board, ROWS, COLS, state.mode, profile, prng);
  return reducer(state, { type: 'ADVANCE_ROUND', board, bonusMask, target });
}

// ── resolveStalemateSync ──────────────────────────────────────────────────────
//
// Mirrors the STALEMATE effect in CombineGridGame.tsx without timers.
// Generates a new target from the current board and dispatches RESOLVE_STALEMATE.

function resolveStalemateSync(
  state: CGState,
  prng: () => number,
  profile: PracticeProfile,
): CGState {
  const target = generateTarget(state.board, ROWS, COLS, state.mode, profile, prng);
  return reducer(state, { type: 'RESOLVE_STALEMATE', target });
}

// ── resolveRespawnSync ────────────────────────────────────────────────────────
//
// Mirrors the RESPAWNING effect in CombineGridGame.tsx without timers.
// Fires when state.respawnPositions is non-empty (set by DRAG_DROP).
// Spawns one tile per position, generates a new target for full clears (2 positions),
// then dispatches RESPAWN_COMPLETE. Mirrors RESPAWNING effect exactly.

function resolveRespawnSync(
  state: CGState,
  prng: () => number,
  profile: PracticeProfile,
): CGState {
  if (state.respawnPositions.length === 0) return state;

  const positions = state.respawnPositions;

  const respawns = positions.map((pos) => {
    const sp = spawnTile(profile, prng);
    return { pos, value: sp.value, isBonus: sp.isBonus };
  });

  // Full clear (2 positions): generate a new target from the settled board.
  // Merge (1 position): target unchanged.
  let target = state.target;
  if (positions.length >= 2) {
    const settledBoard = state.board.map((row, r) =>
      row.map((val, c) => {
        const rsp = respawns.find((x) => x.pos.row === r && x.pos.col === c);
        return rsp !== undefined ? rsp.value : val;
      }),
    );
    target = generateTarget(settledBoard, ROWS, COLS, state.mode, profile, prng);
  }

  return reducer(state, { type: 'RESPAWN_COMPLETE', respawns, target });
}

// ── Replay types ─────────────────────────────────────────────────────────────

/** Post-gravity state captured at the end of one clear cycle. */
type CycleSnapshot = {
  /** Board after gravity + spawn has fully settled. */
  postGravityBoard: number[][];
  /** BonusMask after gravity evolution. */
  postGravityBonusMask: boolean[][];
  /** Target generated from the settled board. */
  target: number;
  /**
   * The zeroed positions on the pre-gravity board — derived by recording which
   * cells were 0 after the reducer's TAP_TILE clearing but before resolveGravity.
   * Used in replay to verify cleared cells match exactly (Section D).
   */
  preGravityZeroPositions: ReadonlyArray<{ row: number; col: number }>;
};

/** The tap positions and recorded outcome for one clear cycle. */
type ReplayStep = {
  positions: ReadonlyArray<{ row: number; col: number }>;
  snapshot: CycleSnapshot;
};

/** The complete log produced by recordSession. */
export type CGReplayLog = {
  seed: number;
  steps: ReplayStep[];
};

/** The result returned by recordSession. */
export type CGRecordResult = {
  log: CGReplayLog;
  finalState: CGState;
};

// ── recordSession ─────────────────────────────────────────────────────────────
//
// Drives a harness for `steps` tap+gravity cycles. After each tap (pre-gravity),
// captures which cells are 0 (the cleared positions). After resolveGravity,
// captures the full post-gravity snapshot. Both are stored in the step log.

function recordSession(
  seed: number,
  steps: number,
  profile: PracticeProfile,
): CGRecordResult {
  let harness = CGHarness.create(seed, profile);
  const log: CGReplayLog = { seed, steps: [] };

  for (let i = 0; i < steps; i++) {
    const state = harness.getState();
    const pair = findMatchingPair(state.board, state.target);
    if (pair === null) {
      throw new Error(
        `[CG_REPLAY] recordSession step ${i}: no matching pair found — ` +
          `target=${state.target}. generateTarget guarantee violated.`,
      );
    }

    // Advance to CLEARING — reducer zeros cleared cells in board + bonusMask.
    const afterTap = harness.tapSequence(pair);
    const clearingState = afterTap.getState();

    // Derive pre-gravity zero positions from the post-tap board.
    // These are the cells that the reducer zeroed at TAP_TILE time.
    const preGravityZeroPositions: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (clearingState.board[r][c] === 0) {
          preGravityZeroPositions.push({ row: r, col: c });
        }
      }
    }

    // Resolve gravity and capture the settled state.
    const afterGravity = afterTap.resolveGravity();
    const settledState = afterGravity.getState();

    log.steps.push({
      positions: pair,
      snapshot: {
        postGravityBoard: settledState.board.map((row) => [...row]),
        postGravityBonusMask: settledState.bonusMask.map((row) => [...row]),
        target: settledState.target,
        preGravityZeroPositions,
      },
    });

    harness = afterGravity;
  }

  return { log, finalState: harness.getState() };
}

// ── replaySession ─────────────────────────────────────────────────────────────
//
// Reconstructs the PRNG from log.seed and replays each step.
// At each cycle:
//   1. Re-runs tap sequence through reducer.
//   2. Verifies pre-gravity zero positions match the recorded snapshot (Section D).
//   3. Resolves gravity.
//   4. Compares post-gravity board, bonusMask, and target against snapshot.
// Throws on first mismatch with coordinate-level detail.

function replaySession(log: CGReplayLog, profile: PracticeProfile): CGState {
  let harness = CGHarness.create(log.seed, profile);

  for (let i = 0; i < log.steps.length; i++) {
    const step = log.steps[i];
    const snap = step.snapshot;

    // Re-run taps — reducer clears board + bonusMask.
    const afterTap = harness.tapSequence(step.positions);
    const clearingState = afterTap.getState();

    // Section D: verify zeroed cells match the recorded pre-gravity zero positions.
    // Build a set from the recorded zeros for O(1) lookup.
    const recordedZeroSet = new Set(
      snap.preGravityZeroPositions.map((p) => `${p.row},${p.col}`),
    );
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const isZeroNow = clearingState.board[r][c] === 0;
        const wasZeroRecorded = recordedZeroSet.has(`${r},${c}`);
        if (isZeroNow !== wasZeroRecorded) {
          throw new Error(
            `[VM-CG-9] step ${i} pre-gravity zero mismatch at [${r}][${c}]: ` +
              `replay=${isZeroNow} recorded=${wasZeroRecorded}`,
          );
        }
      }
    }

    // Resolve gravity and compare per-cycle snapshot.
    const afterGravity = afterTap.resolveGravity();
    const settledState = afterGravity.getState();

    if (settledState.target !== snap.target) {
      throw new Error(
        `[VM-CG-9] step ${i} target mismatch: ` +
          `replay=${settledState.target} recorded=${snap.target}`,
      );
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (settledState.board[r][c] !== snap.postGravityBoard[r][c]) {
          throw new Error(
            `[VM-CG-9] step ${i} board mismatch at [${r}][${c}]: ` +
              `replay=${settledState.board[r][c]} recorded=${snap.postGravityBoard[r][c]}`,
          );
        }
        if (settledState.bonusMask[r][c] !== snap.postGravityBonusMask[r][c]) {
          throw new Error(
            `[VM-CG-9] step ${i} bonusMask mismatch at [${r}][${c}]: ` +
              `replay=${settledState.bonusMask[r][c]} recorded=${snap.postGravityBonusMask[r][c]}`,
          );
        }
      }
    }

    harness = afterGravity;
  }

  return harness.getState();
}

// ── CGHarness ─────────────────────────────────────────────────────────────────

export class CGHarness {
  private readonly _state: CGState;
  private readonly _prng: () => number;
  private readonly _profile: PracticeProfile;

  private constructor(
    state: CGState,
    prng: () => number,
    profile: PracticeProfile,
  ) {
    this._state = state;
    this._prng = prng;
    this._profile = profile;
  }

  /** Creates a new harness with a seeded PRNG and initial game state. */
  static create(seed: number, profile?: PracticeProfile): CGHarness {
    const p = profile ?? getProfile(DEFAULT_PROFILE_ID);
    const prng = makePrng(seed);
    const state = initGame(p, prng, seed);
    return new CGHarness(state, prng, p);
  }

  /**
   * Dispatches TAP_TILE for each position in order through the reducer.
   * If the last position completes a match, phase transitions to CLEARING.
   */
  tapSequence(positions: ReadonlyArray<{ row: number; col: number }>): CGHarness {
    let state = this._state;
    for (const pos of positions) {
      state = reducer(state, { type: 'TAP_TILE', pos });
    }
    return new CGHarness(state, this._prng, this._profile);
  }

  /**
   * Synchronously resolves one gravity cycle (mirrors CLEARING effect).
   * No-op if not in CLEARING phase.
   */
  resolveGravity(): CGHarness {
    const nextState = resolveGravitySync(this._state, this._prng, this._profile);
    return new CGHarness(nextState, this._prng, this._profile);
  }

  /**
   * Dispatches DRAG_START then DRAG_DROP for the given source and destination.
   * After this call, state will have respawnPositions set if the drop was valid.
   * Call resolveRespawn() to complete the in-place refill.
   */
  dragMerge(
    src: { row: number; col: number },
    dst: { row: number; col: number },
  ): CGHarness {
    let state = this._state;
    state = reducer(state, { type: 'DRAG_START', pos: src });
    state = reducer(state, { type: 'DRAG_DROP', src, dst });
    return new CGHarness(state, this._prng, this._profile);
  }

  /**
   * Synchronously resolves one in-place respawn cycle (mirrors RESPAWNING effect).
   * No-op if respawnPositions is empty.
   */
  resolveRespawn(): CGHarness {
    const nextState = resolveRespawnSync(this._state, this._prng, this._profile);
    return new CGHarness(nextState, this._prng, this._profile);
  }

  /**
   * Synchronously spawns a fresh board for the next round (mirrors ROUND_OVER effect).
   * Consumes PRNG tokens identically to the component effect.
   */
  advanceRound(): CGHarness {
    const nextState = advanceRoundSync(this._state, this._prng, this._profile);
    return new CGHarness(nextState, this._prng, this._profile);
  }

  /**
   * Synchronously generates a new target from the current board (mirrors STALEMATE effect).
   * Consumes one generateTarget PRNG sequence identically to the component effect.
   */
  resolveStalemate(): CGHarness {
    const nextState = resolveStalemateSync(this._state, this._prng, this._profile);
    return new CGHarness(nextState, this._prng, this._profile);
  }

  /** Returns the current CGState. */
  getState(): CGState {
    return this._state;
  }

  /**
   * Records N tap+gravity cycles from the given seed.
   * Returns the action log and the final state after all cycles.
   */
  static recordSession(seed: number, steps: number, profile?: PracticeProfile): CGRecordResult {
    return recordSession(seed, steps, profile ?? getProfile(DEFAULT_PROFILE_ID));
  }

  /**
   * Replays a log produced by recordSession.
   * Reconstructs PRNG from log.seed; re-runs every tap sequence and resolveGravity.
   * Returns the replayed final state.
   */
  static replaySession(log: CGReplayLog, profile?: PracticeProfile): CGState {
    return replaySession(log, profile ?? getProfile(DEFAULT_PROFILE_ID));
  }

  // ── Verification Matrix ────────────────────────────────────────────────────

  /**
   * Runs VM-CG-1 through VM-CG-7.
   * Throws on the first failure with a message of the form:
   *   [VM-CG-N] <description of what failed>
   *
   * All VMs use deterministic seeds — no randomness.
   */
  static runVerificationMatrix(): void {
    const SEED_A = 99_999;
    const SEED_B = 12_345;

    // ── VM-CG-1: same seed → identical initial board, bonusMask, target ──────

    {
      const a = CGHarness.create(SEED_A).getState();
      const b = CGHarness.create(SEED_A).getState();

      assertVM(gridsEqual(a.board, b.board), 'CG-1', 'initial board differs for same seed');
      assertVM(masksEqual(a.bonusMask, b.bonusMask), 'CG-1', 'initial bonusMask differs for same seed');
      assertVM(a.target === b.target, 'CG-1', `initial target differs: ${a.target} vs ${b.target}`);
      assertVM(a.seed === SEED_A, 'CG-1', `state.seed not stored: expected ${SEED_A}, got ${a.seed}`);

      // Different seeds must not collide.
      const c = CGHarness.create(SEED_B).getState();
      assertVM(!gridsEqual(a.board, c.board), 'CG-1', 'different seeds produced identical boards (collision)');
    }

    // ── VM-CG-2: same tapSequence on same seed → identical pre-gravity state ─

    {
      const stateA = CGHarness.create(SEED_A).getState();
      const pair = findMatchingPair(stateA.board, stateA.target);
      assertVM(pair !== null, 'CG-2', 'no matching pair found on initial board — generateTarget guarantee violated');

      const positions = pair!;

      const afterA = CGHarness.create(SEED_A).tapSequence(positions).getState();
      const afterB = CGHarness.create(SEED_A).tapSequence(positions).getState();

      assertVM(afterA.phase === 'CLEARING', 'CG-2', `expected CLEARING after valid tapSequence, got ${afterA.phase}`);
      assertVM(gridsEqual(afterA.board, afterB.board), 'CG-2', 'board differs after same tapSequence on same seed');
      assertVM(masksEqual(afterA.bonusMask, afterB.bonusMask), 'CG-2', 'bonusMask differs after same tapSequence on same seed');
      assertVM(afterA.target === afterB.target, 'CG-2', `target differs: ${afterA.target} vs ${afterB.target}`);
    }

    // ── VM-CG-3: tapSequence + resolveGravity → identical post-gravity state ─

    {
      const stateA = CGHarness.create(SEED_A).getState();
      const pair = findMatchingPair(stateA.board, stateA.target)!;

      const afterA = CGHarness.create(SEED_A).tapSequence(pair).resolveGravity().getState();
      const afterB = CGHarness.create(SEED_A).tapSequence(pair).resolveGravity().getState();

      assertVM(gridsEqual(afterA.board, afterB.board), 'CG-3', 'post-gravity board differs for same seed');
      assertVM(masksEqual(afterA.bonusMask, afterB.bonusMask), 'CG-3', 'post-gravity bonusMask differs for same seed');
      assertVM(afterA.target === afterB.target, 'CG-3', `post-gravity target differs: ${afterA.target} vs ${afterB.target}`);
    }

    // ── VM-CG-4: bonusMask dimensions always equal board dimensions ───────────

    {
      // Check at init.
      const s0 = CGHarness.create(SEED_A).getState();
      assertVM(s0.board.length === ROWS, 'CG-4', `board rows at init: expected ${ROWS}, got ${s0.board.length}`);
      assertVM(s0.bonusMask.length === ROWS, 'CG-4', `bonusMask rows at init: expected ${ROWS}, got ${s0.bonusMask.length}`);
      for (let r = 0; r < ROWS; r++) {
        assertVM(s0.board[r].length === COLS, 'CG-4', `board[${r}].length at init: expected ${COLS}, got ${s0.board[r].length}`);
        assertVM(s0.bonusMask[r].length === COLS, 'CG-4', `bonusMask[${r}].length at init: expected ${COLS}, got ${s0.bonusMask[r].length}`);
      }

      // Check after tap (CLEARING state).
      const pair = findMatchingPair(s0.board, s0.target)!;
      const s1 = CGHarness.create(SEED_A).tapSequence(pair).getState();
      assertVM(s1.board.length === ROWS, 'CG-4', `board rows in CLEARING: expected ${ROWS}, got ${s1.board.length}`);
      assertVM(s1.bonusMask.length === ROWS, 'CG-4', `bonusMask rows in CLEARING: expected ${ROWS}, got ${s1.bonusMask.length}`);
      for (let r = 0; r < ROWS; r++) {
        assertVM(s1.board[r].length === COLS, 'CG-4', `board[${r}].length in CLEARING: expected ${COLS}`);
        assertVM(s1.bonusMask[r].length === COLS, 'CG-4', `bonusMask[${r}].length in CLEARING: expected ${COLS}`);
      }

      // Check after gravity (post-CLEAR_COMPLETE).
      const s2 = CGHarness.create(SEED_A).tapSequence(pair).resolveGravity().getState();
      assertVM(s2.board.length === ROWS, 'CG-4', `board rows post-gravity: expected ${ROWS}, got ${s2.board.length}`);
      assertVM(s2.bonusMask.length === ROWS, 'CG-4', `bonusMask rows post-gravity: expected ${ROWS}, got ${s2.bonusMask.length}`);
      for (let r = 0; r < ROWS; r++) {
        assertVM(s2.board[r].length === COLS, 'CG-4', `board[${r}].length post-gravity: expected ${COLS}`);
        assertVM(s2.bonusMask[r].length === COLS, 'CG-4', `bonusMask[${r}].length post-gravity: expected ${COLS}`);
      }
    }

    // ── VM-CG-5: board[r][c] === 0 in CLEARING → bonusMask[r][c] === false ───

    {
      const s0 = CGHarness.create(SEED_A).getState();
      const pair = findMatchingPair(s0.board, s0.target)!;
      const s1 = CGHarness.create(SEED_A).tapSequence(pair).getState();

      assertVM(s1.phase === 'CLEARING', 'CG-5', `expected CLEARING phase, got ${s1.phase}`);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (s1.board[r][c] === 0) {
            assertVM(
              s1.bonusMask[r][c] === false,
              'CG-5',
              `board[${r}][${c}] === 0 but bonusMask[${r}][${c}] === true — mask not cleared`,
            );
          }
        }
      }
    }

    // ── VM-CG-6: ROUND_OVER regeneration is deterministic for same sequence ───

    {
      // Drive both harnesses through tap + gravity to advance PRNG to same position,
      // then call advanceRound() on both. Results must be identical.
      const s0 = CGHarness.create(SEED_A).getState();
      const pair = findMatchingPair(s0.board, s0.target)!;

      const postGravA = CGHarness.create(SEED_A).tapSequence(pair).resolveGravity();
      const postGravB = CGHarness.create(SEED_A).tapSequence(pair).resolveGravity();

      const afterA = postGravA.advanceRound().getState();
      const afterB = postGravB.advanceRound().getState();

      assertVM(gridsEqual(afterA.board, afterB.board), 'CG-6', 'ADVANCE_ROUND board differs for same seed + same prior sequence');
      assertVM(masksEqual(afterA.bonusMask, afterB.bonusMask), 'CG-6', 'ADVANCE_ROUND bonusMask differs for same seed + same prior sequence');
      assertVM(afterA.target === afterB.target, 'CG-6', `ADVANCE_ROUND target differs: ${afterA.target} vs ${afterB.target}`);
      assertVM(afterA.phase === 'SELECTING', 'CG-6', `expected SELECTING after ADVANCE_ROUND, got ${afterA.phase}`);
    }

    // ── VM-CG-7: STALEMATE target regeneration is deterministic ──────────────
    //
    // Two harnesses driven to same state (same PRNG position via identical
    // tap + gravity). resolveStalemate() consumes one generateTarget sequence
    // from each. Results must be identical.

    {
      const s0 = CGHarness.create(SEED_A).getState();
      const pair = findMatchingPair(s0.board, s0.target)!;

      const postGravA = CGHarness.create(SEED_A).tapSequence(pair).resolveGravity();
      const postGravB = CGHarness.create(SEED_A).tapSequence(pair).resolveGravity();

      const afterA = postGravA.resolveStalemate().getState();
      const afterB = postGravB.resolveStalemate().getState();

      assertVM(afterA.target === afterB.target, 'CG-7', `STALEMATE target differs: ${afterA.target} vs ${afterB.target}`);
      // Board and bonusMask must be unchanged by stalemate resolution.
      assertVM(gridsEqual(afterA.board, afterB.board), 'CG-7', 'board changed during STALEMATE resolution');
      assertVM(masksEqual(afterA.bonusMask, afterB.bonusMask), 'CG-7', 'bonusMask changed during STALEMATE resolution');
    }

    // ── VM-CG-8: replay produces identical final state ────────────────────────
    //
    // recordSession drives 5 cycles and logs each tap sequence.
    // replaySession reconstructs PRNG from seed and re-runs those sequences.
    // Final board, bonusMask, target, and phase must match exactly.
    // Coordinate-level detail provided for any mismatch.

    {
      const REPLAY_STEPS = 5;
      const profile = getProfile(DEFAULT_PROFILE_ID);
      const { log, finalState: recorded } = recordSession(SEED_A, REPLAY_STEPS, profile);
      const replayed = replaySession(log, profile);

      assertVM(
        recorded.phase === replayed.phase,
        'CG-8',
        `phase mismatch: recorded=${recorded.phase} replayed=${replayed.phase}`,
      );

      assertVM(
        recorded.target === replayed.target,
        'CG-8',
        `target mismatch: recorded=${recorded.target} replayed=${replayed.target}`,
      );

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          assertVM(
            recorded.board[r][c] === replayed.board[r][c],
            'CG-8',
            `board mismatch at [${r}][${c}]: recorded=${recorded.board[r][c]} replayed=${replayed.board[r][c]}`,
          );
          assertVM(
            recorded.bonusMask[r][c] === replayed.bonusMask[r][c],
            'CG-8',
            `bonusMask mismatch at [${r}][${c}]: recorded=${recorded.bonusMask[r][c]} replayed=${replayed.bonusMask[r][c]}`,
          );
        }
      }
    }

    // ── VM-CG-9: per-cycle snapshot validation ────────────────────────────────
    //
    // replaySession now validates at every cycle, not just final state.
    // Verifies pre-gravity zero positions, post-gravity board, bonusMask,
    // and target at each step. Any mismatch throws with step + coordinate detail.
    // A passing run proves that each cycle — not just the end state — is
    // deterministically reproduced from (seed, action log).

    {
      const REPLAY_STEPS = 5;
      const profile = getProfile(DEFAULT_PROFILE_ID);
      // recordSession builds the log with per-cycle snapshots.
      const { log } = recordSession(SEED_A, REPLAY_STEPS, profile);
      // replaySession validates per-cycle — throws on first mismatch.
      // If it returns without throwing, all cycles matched.
      replaySession(log, profile);
      // Verify the log contains snapshots for every step.
      assertVM(
        log.steps.length === REPLAY_STEPS,
        'CG-9',
        `log.steps.length=${log.steps.length}, expected ${REPLAY_STEPS}`,
      );
      for (let i = 0; i < log.steps.length; i++) {
        const snap = log.steps[i].snapshot;
        assertVM(
          snap.postGravityBoard.length === ROWS,
          'CG-9',
          `step ${i} snapshot board rows: expected ${ROWS}, got ${snap.postGravityBoard.length}`,
        );
        assertVM(
          snap.postGravityBonusMask.length === ROWS,
          'CG-9',
          `step ${i} snapshot bonusMask rows: expected ${ROWS}, got ${snap.postGravityBonusMask.length}`,
        );
        assertVM(
          snap.preGravityZeroPositions.length >= 2,
          'CG-9',
          `step ${i} preGravityZeroPositions has fewer than 2 entries — tap pair must zero at least 2 cells`,
        );
      }
    }
  }
}
