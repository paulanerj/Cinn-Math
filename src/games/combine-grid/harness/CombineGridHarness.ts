// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/harness/CombineGridHarness.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Deterministic test harness for CombineGrid game logic.
//        Zero React. Zero DOM. Synchronous gravity resolution.
//
// [PUBLIC API]
//   CGHarness.create(seed, profile?)  → CGHarness  (new session)
//
// [INSTANCE API]
//   .tapSequence(positions)    → new CGHarness  (dispatch TAP_TILE per position)
//   .resolveGravity()          → new CGHarness  (synchronous orchestrator call)
//   .getState()                → CGState
//
// [INVARIANT] Zero React imports. No DOM. No async. No setTimeout.
//
// [PIPELINE] Mirrors production exactly:
//   1. Reducer owns all logical mutations (TAP_TILE clears board + bonusMask)
//   2. resolveGravity() reads state.board (already zeroed) + state.clearingPositions
//   3. runGravityOrchestrator produces new grid, bonusMask, target
//   4. CLEAR_COMPLETE dispatched — reducer applies result
// ─────────────────────────────────────────────────────────────────────────────

import {
  makePrng,
  spawnTile,
  generateTarget,
  getProfile,
  DEFAULT_PROFILE_ID,
} from '../../../engine/public';
import type { PracticeProfile } from '../../../engine/PracticeProfile';
import { runGravityOrchestrator } from '../../../systems/GravityOrchestrator';
import { initGame, reducer } from '../cgReducer';
import type { CGState } from '../cgReducer';
import { ROWS, COLS } from '../constants';

// ── resolveGravitySync ────────────────────────────────────────────────────────
//
// Synchronously runs one gravity cycle from a CLEARING state.
// Mirrors the async CLEARING effect in CombineGridGame.tsx without timers.
//
// [PIPELINE CONTRACT]
// - state.board is already zeroed (reducer did this in TAP_TILE)
// - state.clearingPositions is explicit (never inferred from grid zeros)
// - orchResult.bonusMask is always persisted via CLEAR_COMPLETE

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
          'resolveGravitySync called with empty clearingPositions. ' +
          'TAP_TILE match branch must have set clearingPositions before CLEARING.',
      );
    }
  }

  // Cache each SpawnedTile by (col, spawnIndex) so spawnValue and spawnBonus
  // draw from the same spawnTile() call — one PRNG token per tile.
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

  /**
   * Creates a new harness with a seeded PRNG and an initial game state.
   *
   * @param seed    - Uint32 seed passed to makePrng(). Stored in state.seed.
   * @param profile - Practice profile (defaults to DEFAULT_PROFILE_ID).
   */
  static create(seed: number, profile?: PracticeProfile): CGHarness {
    const p = profile ?? getProfile(DEFAULT_PROFILE_ID);
    const prng = makePrng(seed);
    const state = initGame(p, prng, seed);
    return new CGHarness(state, prng, p);
  }

  /**
   * Dispatches a TAP_TILE action for each position in order.
   *
   * Positions are expected to form a valid selection that matches the target.
   * The reducer handles match detection — if the last position completes a
   * match the phase transitions to CLEARING automatically.
   *
   * Returns a new CGHarness with the resulting state. Immutable — `this` is
   * not modified.
   */
  tapSequence(positions: ReadonlyArray<{ row: number; col: number }>): CGHarness {
    let state = this._state;
    for (const pos of positions) {
      state = reducer(state, { type: 'TAP_TILE', pos });
    }
    return new CGHarness(state, this._prng, this._profile);
  }

  /**
   * Synchronously resolves one gravity cycle when the harness is in CLEARING.
   *
   * Calls runGravityOrchestrator with:
   *   - state.board (already zeroed by reducer)
   *   - state.bonusMask (already cleared by reducer)
   *   - state.clearingPositions (explicit — never inferred)
   *
   * Dispatches CLEAR_COMPLETE and returns a new harness with applied result.
   * No-op if not in CLEARING phase.
   */
  resolveGravity(): CGHarness {
    const nextState = resolveGravitySync(this._state, this._prng, this._profile);
    return new CGHarness(nextState, this._prng, this._profile);
  }

  /** Returns the current CGState. */
  getState(): CGState {
    return this._state;
  }
}
