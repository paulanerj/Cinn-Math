export type CellState = {
  val: number;
  kind: string;
  id: string;
  falling?: boolean;
};

export type GridMatrix = CellState[][];

export type GravityResult = {
  grid: GridMatrix;
  moved: boolean;
  settled: boolean;
};

/**
 * GravitySystem — pure functional tile-fall logic.
 * Tiles fall downward (increasing row index). Empty cells are represented by val === -1 or kind === 'empty'.
 */
export class GravitySystem {
  static isEmpty(cell: CellState): boolean {
    return cell.kind === 'empty' || cell.val === -1;
  }

  /**
   * Apply one tick of gravity: each tile that has an empty cell directly below it falls down by one.
   * Returns the new grid and whether any tiles moved.
   */
  static applyOneTick(grid: GridMatrix): GravityResult {
    const rows = grid.length;
    if (rows === 0) return { grid, moved: false, settled: true };
    const cols = grid[0].length;
    // Deep clone
    const next: GridMatrix = grid.map(row => row.map(cell => ({ ...cell })));
    let moved = false;

    for (let r = rows - 2; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const cell = next[r][c];
        const below = next[r + 1][c];
        if (!GravitySystem.isEmpty(cell) && GravitySystem.isEmpty(below)) {
          next[r + 1][c] = { ...cell, falling: true };
          next[r][c] = { ...below, falling: false };
          moved = true;
        }
      }
    }

    const settled = !moved;
    return { grid: next, moved, settled };
  }

  /**
   * Apply gravity until fully settled. Returns final settled grid.
   */
  static applyUntilSettled(grid: GridMatrix, maxTicks = 50): GridMatrix {
    let current = grid;
    for (let i = 0; i < maxTicks; i++) {
      const result = GravitySystem.applyOneTick(current);
      current = result.grid;
      if (result.settled) break;
    }
    return current;
  }

  /**
   * Remove matching cells (set to empty), then apply gravity.
   */
  static removeAndSettle(
    grid: GridMatrix,
    positions: { r: number; c: number }[],
    emptyTemplate: CellState
  ): GridMatrix {
    const next: GridMatrix = grid.map(row => row.map(cell => ({ ...cell })));
    for (const { r, c } of positions) {
      next[r][c] = { ...emptyTemplate, kind: 'empty', val: -1 };
    }
    return GravitySystem.applyUntilSettled(next);
  }
}
