// [ROLE] Generates achievable target numbers for GridMath games.
// A target is only useful if the player can actually reach it given the
// current board state. TargetGenerator finds a random path of adjacent tiles
// and returns their sum or product as the next target.
//
// [WHY] Presenting an unreachable target is a game-breaking frustration.
// By deriving targets from actual board paths, we guarantee solvability while
// keeping targets varied and unpredictable.
//
// [FUTURE] When a new game mode uses a different validity criterion (e.g.
// targets must be prime, or targets are always within a fixed range regardless
// of board content), add a new generator variant here rather than changing
// generateTarget(), which SpeedGrid already relies on.
//
// [LLM NOTE] generateTarget is the replacement for the deprecated
// src/games/combine-grid/services/TargetGenerator.ts stub. The real logic
// always lived here; the service file was an empty re-export placeholder.
// Do not recreate the service stub — it is in the prohibited list (contract §9).
//
// [INVARIANT] generateTarget always returns a positive integer ≥ 2.
//             It must not return 0 or 1 (both are trivially achievable and
//             produce no interesting gameplay). The fallback value is 10.

import type { PracticeProfile } from './PracticeProfile';
import { randomInt } from './rng';

/** The operation used to evaluate a selection of tile values. */
export type EvalMode = 'sum' | 'product';

/**
 * Generates a target number by walking a random path of 2–3 adjacent number
 * tiles on the current grid and evaluating the path under the given mode.
 *
 * The algorithm:
 * 1. Pick a random non-zero starting cell.
 * 2. Walk 1–2 random orthogonal neighbours (each non-zero, not already visited).
 * 3. Evaluate the collected values under `mode`.
 * 4. If the result falls within the profile's target range, return it.
 * 5. Otherwise, fall back to a random pair from the full board.
 * 6. If the fallback also fails, return 10.
 *
 * This is a direct descendant of findPathForTarget() from the original
 * Cinnamoroll boardUtils.ts, adapted to the GridEngine's number[][] grid type.
 *
 * @param grid     The current board (number[][], 0 = empty).
 * @param rows     Number of rows (must match grid.length).
 * @param cols     Number of columns.
 * @param mode     'sum' or 'product'.
 * @param profile  Active practice profile (used for target range clamping).
 * @param prng     Session PRNG — must be the same generator used by SpawnEngine.
 */
export function generateTarget(
  grid: number[][],
  rows: number,
  cols: number,
  mode: EvalMode,
  profile: PracticeProfile,
  prng: () => number,
): number {
  const targetMin = mode === 'sum' ? profile.targetSumMin : profile.targetProductMin;
  const targetMax = mode === 'sum' ? profile.targetSumMax : profile.targetProductMax;

  // Collect all non-zero cell positions.
  const cells: { r: number; c: number; v: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r]?.[c] ?? 0;
      if (v > 0) cells.push({ r, c, v });
    }
  }

  if (cells.length < 2) return 10; // Board is nearly empty — safe fallback.

  // Attempt to find a valid path.
  const MAX_ATTEMPTS = 20;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Step 1: random start cell.
    const startIdx = Math.floor(prng() * cells.length);
    const start = cells[startIdx];
    const path: { r: number; c: number; v: number }[] = [start];
    const visited = new Set<string>([`${start.r},${start.c}`]);

    // Step 2: extend by 1–2 steps.
    const targetLen = randomInt(prng, 2, 3);
    for (let step = 1; step < targetLen; step++) {
      const last = path[path.length - 1];
      // Orthogonal neighbours only (matching SpeedGrid's sum-chain expectation).
      const neighbours = [
        { r: last.r - 1, c: last.c },
        { r: last.r + 1, c: last.c },
        { r: last.r,     c: last.c - 1 },
        { r: last.r,     c: last.c + 1 },
      ].filter(
        ({ r, c }) =>
          r >= 0 && r < rows &&
          c >= 0 && c < cols &&
          !visited.has(`${r},${c}`) &&
          (grid[r]?.[c] ?? 0) > 0,
      );
      if (neighbours.length === 0) break;
      const next = neighbours[Math.floor(prng() * neighbours.length)];
      path.push({ r: next.r, c: next.c, v: grid[next.r][next.c] });
      visited.add(`${next.r},${next.c}`);
    }

    if (path.length < 2) continue;

    // Step 3: evaluate.
    const result = evaluate(path.map((p) => p.v), mode);

    // Step 4: range check.
    if (result >= targetMin && result <= targetMax) return result;
  }

  // Step 5: fallback — random pair from the board.
  const shuffled = [...cells].sort(() => prng() - 0.5);
  const pair = shuffled.slice(0, 2);
  if (pair.length === 2) {
    const fallback = evaluate([pair[0].v, pair[1].v], mode);
    if (fallback >= 2) return fallback;
  }

  // Step 6: hard fallback.
  return 10;
}

/**
 * Evaluates a list of tile values under the given mode.
 * Returns the sum or product of the values.
 *
 * [INVARIANT] values.length ≥ 1.
 */
export function evaluate(values: number[], mode: EvalMode): number {
  if (mode === 'sum') {
    return values.reduce((a, b) => a + b, 0);
  }
  return values.reduce((a, b) => a * b, 1);
}

/**
 * Returns true if the given chain of values exactly equals the target under mode.
 * Used by SpeedGrid to validate chain submissions.
 */
export function chainMatchesTarget(
  values: number[],
  target: number,
  mode: EvalMode,
): boolean {
  return evaluate(values, mode) === target;
}
