// ─────────────────────────────────────────────────────────────────────────────
// src/systems/GravityOrchestrator.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Gravity pipeline orchestrator. Owns the full gravity resolution
//        sequence for SpeedGrid (and any future grid game that follows the
//        same clear→compact→refill→retarget lifecycle).
//
// [PIPELINE]
//   1. Grid compaction  — via GravitySystem.applyGravity()
//   2. Bonus mask remap — via BonusMaskSystem.applyBonusMaskGravity()
//   3. Spawn map applied inside applyGravity (spawnValue / spawnBonus closures)
//   4. Target regeneration triggered — caller provides generateNextTarget()
//   5. GRAVITY_DONE payload assembled and returned
//
// [PURITY CONTRACT]
//   • Pure deterministic — given identical inputs, always returns identical output.
//   • Synchronous — no Promises, no timers, no setTimeout.
//   • Zero PRNG ownership — the orchestrator never calls a PRNG directly.
//     Callers supply spawnValue / spawnBonus closures backed by their own PRNG,
//     and a generateNextTarget callback backed by their own PRNG.
//     The orchestrator merely calls these at the right moment in the pipeline.
//   • Zero React imports — no JSX, no hooks, no component types.
//   • Zero game imports — no SpeedGrid types, no CombineGrid types.
//   • Zero DOM access — no window, document, or browser globals.
//
// [REPLAY COMPATIBILITY LAW — frozen Phase-8 Task-14]
//   • GravityOrchestrator is replay-safe.
//   • In replay mode, call runGravityOrchestrator() synchronously.
//   • The orchestrator must not own entropy; replay provides deterministic
//     spawnValue / spawnBonus / generateNextTarget closures driven by a
//     seeded PRNG whose token sequence reproduces the original run.
//   • clearedPositions must NOT be recorded for replay. It is re-derived
//     from chain.positions at the commit snapshot (ClearedPositionsLaw).
//
// [ENTROPY BOUNDARY — frozen Phase-8 Task-14]
//   This file contains zero PRNG calls. Grep proof:
//     grep -E "prng|random|Math\.random|Date\.now|performance\.now"
//     → zero results (verified at commit time).
//
// [IMPORT GRAPH]
//   GravityOrchestrator imports:
//     • src/systems/GravitySystem.ts   (applyGravity, FallingTile, SpawnedPosition)
//     • src/systems/BonusMaskSystem.ts (applyBonusMaskGravity)
//   GravityOrchestrator is NOT imported by:
//     • sgReducer.ts   — reducer purity boundary unchanged
//     • CombineGridGame.tsx — CombineGrid has its own pipeline
// ─────────────────────────────────────────────────────────────────────────────

import { applyGravity } from './GravitySystem';
import type { FallingTile, SpawnedPosition } from './GravitySystem';
import { applyBonusMaskGravity } from './BonusMaskSystem';

// ── Input / output types ──────────────────────────────────────────────────────

/**
 * All inputs required to run one gravity cycle.
 *
 * [PURITY NOTE] spawnValue, spawnBonus, and generateNextTarget are callbacks
 * supplied by the caller. They may close over a PRNG, but the orchestrator
 * itself never holds or advances a PRNG — it only invokes the callbacks at
 * the correct points in the pipeline.
 *
 * [INVARIANT] spawnValue and spawnBonus must be backed by the same underlying
 *             spawn source: spawnBonus(col, i) must reflect the bonus status of
 *             the tile whose value was returned by spawnValue(col, i).
 *             Callers satisfy this by capturing both fields from the same
 *             spawnTile() call and providing lookup closures over a shared cache.
 *
 * [INVARIANT] clearedPositions must be derived from the CHAIN_COMMIT snapshot
 *             BEFORE any gravity mutation (ClearedPositionsLaw / GravitySnapshotBoundaryLaw).
 */
export interface GravityOrchestratorInput {
  /**
   * Post-commit board — cleared cells are 0, survivors are non-zero.
   * Taken from state.grid immediately after CHAIN_COMMIT, before gravity.
   */
  grid: number[][];

  /**
   * Post-commit bonus mask — cleared cells are false, survivors retain
   * their prior bonus flags. Same snapshot timing as grid.
   */
  bonusMask: boolean[][];

  /**
   * Authoritative set of grid coordinates cleared by the most recent valid
   * CHAIN_COMMIT. Must be non-empty (Explicit Survivor Law, Phase-8 Task-10).
   * Re-derived by replay — never serialised as part of replay payload.
   */
  clearedPositions: ReadonlyArray<{ row: number; col: number }>;

  /** Board row count. */
  rows: number;

  /** Board column count. */
  cols: number;

  /**
   * Value factory for newly spawned tiles.
   * (col, spawnIndex) → tile value.
   * spawnIndex 0 = topmost spawned tile in the column.
   * Must be backed by a caller-owned PRNG or spawn cache.
   */
  spawnValue: (col: number, spawnIndex: number) => number;

  /**
   * Bonus flag factory for newly spawned tiles.
   * (col, spawnIndex) → isBonus.
   * Must be a pure lookup into the same spawn data source as spawnValue.
   * No PRNG calls here — the orchestrator relies on this contract.
   */
  spawnBonus: (col: number, spawnIndex: number) => boolean;

  /**
   * Target generation callback, called once with the settled grid.
   * The orchestrator triggers the call after gravity settles
   * ("target regeneration trigger") but does not perform generation itself.
   * Caller supplies PRNG-backed implementation.
   */
  generateNextTarget: (settledGrid: number[][]) => number;
}

/**
 * The complete GRAVITY_DONE payload, ready for the reducer.
 * Also includes animation metadata (fallingTiles / spawnedPositions)
 * for callers that drive tile-fall animations (e.g. SpeedGridGame.tsx).
 *
 * [INVARIANT] The GRAVITY_DONE payload structure is:
 *   { grid, bonusMask, target }
 * This is identical to the SGAction 'GRAVITY_DONE' shape in types.ts.
 * The animation fields (fallingTiles, spawnedPositions, spawnBonusMap)
 * are extra; the reducer ignores them.
 */
export interface GravityOrchestratorResult {
  /** Settled grid after compaction + refill. New canonical board state. */
  grid: number[][];

  /** Remapped bonus mask after compaction. Bonus status follows its tile. */
  bonusMask: boolean[][];

  /** Next target generated from the settled board. */
  target: number;

  /** Per-tile fall metadata for drop-distance animations. */
  fallingTiles: FallingTile[];

  /** Per-tile spawn metadata for fall-in-from-above animations. */
  spawnedPositions: SpawnedPosition[];

  /**
   * Bonus flags for every spawned tile, indexed [col][spawnIndex].
   * Passed through from GravitySystem for telemetry / parity checks.
   */
  spawnBonusMap: boolean[][];
}

// ── Core pipeline function ────────────────────────────────────────────────────

/**
 * Runs the full gravity resolution pipeline for one clear→compact→refill cycle.
 *
 * Pipeline:
 *   1. Grid compaction via GravitySystem (tiles fall, empty top cells filled
 *      by spawnValue/spawnBonus closures).
 *   2. Bonus mask remapping via BonusMaskSystem (bonus flags follow tiles,
 *      spawn bonus flags applied to new tiles).
 *   3. Target regeneration triggered (generateNextTarget called with settled grid).
 *   4. GRAVITY_DONE payload assembled and returned.
 *
 * [INVARIANT] Pure — no side effects, no mutations of input arrays.
 * [INVARIANT] Synchronous — call synchronously in both live and replay paths.
 * [INVARIANT] Zero entropy — all PRNG-backed values arrive via input callbacks.
 */
export function runGravityOrchestrator(
  input: GravityOrchestratorInput,
): GravityOrchestratorResult {
  const {
    grid,
    bonusMask,
    clearedPositions,
    rows,
    cols,
    spawnValue,
    spawnBonus,
    generateNextTarget,
  } = input;

  // ── Step 1: Grid compaction via GravitySystem ─────────────────────────────
  // Existing non-zero tiles fall to fill 0-cells; top cells filled by spawnValue.
  // spawnBonus is called as a pure lookup — no PRNG calls inside applyGravity.
  const gravResult = applyGravity(grid, rows, cols, spawnValue, spawnBonus);

  // ── Step 2: Bonus mask remapping via BonusMaskSystem ─────────────────────
  // Survivor tiles: positions NOT in clearedPositions (Explicit Survivor Law).
  // Spawn tiles: bonus flags from gravResult.spawnBonusMap.
  // BonusMaskSystem runs AssertClearedPositionsIntegrity in dev mode.
  const newBonusMask = applyBonusMaskGravity(
    bonusMask,
    grid, // preGravGrid — post-commit, zeros at cleared positions
    gravResult.spawnBonusMap,
    rows,
    cols,
    clearedPositions,
  );

  // ── Step 3 + 4: Trigger target regeneration + assemble GRAVITY_DONE payload
  // generateNextTarget is called once with the settled (post-gravity) grid.
  // The caller provides the PRNG-backed implementation; we only trigger it.
  const newTarget = generateNextTarget(gravResult.grid);

  return {
    grid: gravResult.grid,
    bonusMask: newBonusMask,
    target: newTarget,
    fallingTiles: gravResult.fallingTiles,
    spawnedPositions: gravResult.spawnedPositions,
    spawnBonusMap: gravResult.spawnBonusMap,
  };
}
