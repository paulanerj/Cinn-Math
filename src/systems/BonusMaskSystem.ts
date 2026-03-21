// ─────────────────────────────────────────────────────────────────────────────
// src/systems/BonusMaskSystem.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Bonus mask gravity for the GridMath platform.
//        Tracks which tiles carry a bonus flag through gravity compaction events.
//        Extracted from sgReducer.ts (Phase-8) so that future games can use
//        bonus mask tracking without importing SpeedGrid internals.
//
// [WHY]  The bonus mask is a platform-level concern, not a SpeedGrid-specific
//        concern. Any grid game that supports bonus tiles needs this logic.
//        Keeping it here prevents future games from reimplementing it or
//        importing a game-local module.
//
// [INVARIANT] bonusMask[r][c] === true iff the tile at (r,c) is a bonus tile.
//             Mask dimensions always equal the grid dimensions.
// ─────────────────────────────────────────────────────────────────────────────

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ClearedPositionsLaw                                       Phase-8 Task-8│
// │                                                                         │
// │ • clearedPositions is the EXACT set of grid coordinates cleared by the  │
// │   most recent valid CHAIN_COMMIT.                                       │
// │ • Coordinates are taken from the reducer's CHAIN_COMMIT snapshot,       │
// │   BEFORE any gravity mutation.                                          │
// │ • No position outside that commit snapshot may appear in               │
// │   clearedPositions.                                                     │
// │ • Duplicates are FORBIDDEN.                                             │
// │ • Order is irrelevant; set semantics apply.                             │
// │ • clearedPositions must be derivable deterministically from:            │
// │     – preGravGrid (the post-clear grid where cleared cells are 0)       │
// │     – state.chain.positions (single-chain era)                          │
// │ • clearedPositions is NOT recorded for replay; it is re-derived.        │
// │                                                                         │
// │ This law exists to enable future multi-chain union clears without       │
// │ changing BonusMask semantics.                                           │
// └─────────────────────────────────────────────────────────────────────────┘

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ GravitySnapshotBoundaryLaw                                Phase-8 Task-8│
// │ (dual-path assertion removed Phase-8 Task-10; explicit semantics frozen)│
// │                                                                         │
// │ • preGravGrid is the reducer grid AFTER CHAIN_COMMIT mutation           │
// │   (cleared tiles set to zero) and BEFORE any GravitySystem call.       │
// │ • clearedPositions refers to positions that were non-zero BEFORE commit │
// │   and are zero AFTER commit.                                            │
// │ • AssertClearedPositionsIntegrity verifies snapshot timing correctness. │
// └─────────────────────────────────────────────────────────────────────────┘

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ LAW — Explicit Survivor Semantics                        Phase-8 Task-10│
// │                                                                         │
// │ applyBonusMaskGravity REQUIRES clearedPositions.                        │
// │ Zero-inference survivor detection has been permanently removed.         │
// │ All callers must supply clearedPositions derived from chain commit.     │
// │ Replay systems must re-derive clearedPositions via grid diff.           │
// │ This law is frozen.                                                     │
// └─────────────────────────────────────────────────────────────────────────┘

/**
 * Applies the same column-compaction logic as GravitySystem to the bonus mask.
 * Called after gravity so bonus status follows its tile.
 *
 * Algorithm (per column):
 *   1. Collect surviving tile bonus values (tiles NOT in clearedPositions), bottom-to-top.
 *   2. Place them at the bottom of the new mask (mirrors gravity compaction).
 *   3. Fill remaining top rows with spawn bonuses from spawnBonuses[col][idx].
 *
 * Survivor semantics: a tile at (r,c) survives iff its position is NOT present
 * in clearedPositions. Zero-inference (preGravGrid[r][c] !== 0) has been
 * permanently removed (Phase-8 Task-10).
 */
export function applyBonusMaskGravity(
  oldMask: boolean[][],
  preGravGrid: number[][],
  spawnBonuses: boolean[][],
  rows: number,
  cols: number,
  clearedPositions: ReadonlyArray<{ row: number; col: number }>,
): boolean[][] {
  // --- AssertClearedPositionsIntegrity (Phase-8 Task-8, retained Task-10) ---
  // Validates ClearedPositionsLaw before any mask computation:
  //   1. No duplicates: Set key count must equal array length.
  //   2. Every declared cleared position must be zero in preGravGrid
  //      (confirming GravitySnapshotBoundaryLaw — snapshot taken post-commit).
  if (process.env.NODE_ENV !== 'production') {
    const keySet = new Set<string>(
      clearedPositions.map(({ row, col }) => `${row},${col}`),
    );
    if (keySet.size !== clearedPositions.length) {
      throw new Error(
        `[BONUSMASK] AssertClearedPositionsIntegrity: ` +
          `duplicate positions detected. ` +
          `array length=${clearedPositions.length}, unique=${keySet.size}.`,
      );
    }
    for (const { row, col } of clearedPositions) {
      if (preGravGrid[row]?.[col] !== 0) {
        throw new Error(
          `[BONUSMASK] AssertClearedPositionsIntegrity: ` +
            `position [${row},${col}] is declared cleared but ` +
            `preGravGrid[${row}][${col}]=${String(preGravGrid[row]?.[col])} (expected 0). ` +
            `Snapshot timing violation — preGravGrid must be post-commit.`,
        );
      }
    }
  }

  // Build O(1) lookup set from authoritative cleared list.
  // Survivor = tile position NOT present in clearedPositions.
  const clearedSet = new Set<string>(
    clearedPositions.map(({ row, col }) => `${row},${col}`),
  );

  return _computeBonusMask(
    oldMask,
    rows,
    cols,
    spawnBonuses,
    (r, c) => !clearedSet.has(`${r},${c}`),
  );
}

/**
 * Column-compaction kernel for bonus mask gravity.
 * isSurvivor returns true when the tile at (r, c) survived the clear.
 * Caller must derive isSurvivor from clearedPositions (explicit law).
 */
function _computeBonusMask(
  oldMask: boolean[][],
  rows: number,
  cols: number,
  spawnBonuses: boolean[][],
  isSurvivor: (r: number, c: number) => boolean,
): boolean[][] {
  const newMask: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  );

  for (let c = 0; c < cols; c++) {
    const surviving: boolean[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (isSurvivor(r, c)) {
        surviving.push(oldMask[r][c]);
      }
    }
    for (let i = 0; i < surviving.length; i++) {
      newMask[rows - 1 - i][c] = surviving[i];
    }
    const spawnCount = rows - surviving.length;
    const colSpawns = spawnBonuses[c] ?? [];
    for (let i = 0; i < spawnCount; i++) {
      newMask[i][c] = colSpawns[i] ?? false;
    }
  }

  return newMask;
}
