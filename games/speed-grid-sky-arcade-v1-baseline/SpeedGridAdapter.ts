
import { GridEngine, EngineTile, TargetSource } from '../../src/engine/public';

const engine = new GridEngine({ seed: Date.now() }); // Use time seed for game randomness in production

export const SpeedGridAdapter = {
  initializeGame(rows: number, cols: number) {
    // Start engine in Solver mode
    engine.startSolverGenerated({ rows, cols, operator: 'product' });
    
    // Get initial grid (random numbers)
    const grid = engine.getInitialGrid(rows, cols);
    
    // Compute first target based on this grid
    const { target, solutionPath } = engine.computeSolverTargetFromExternalGrid({
      operator: 'product',
      gridVals: grid.map(r => r.map(c => c.val)),
      pathLenMin: 2,
      pathLenMax: 4
    });

    return { target, grid, solutionPath };
  },

  computeTarget(grid: EngineTile[][]) {
    return engine.computeSolverTargetFromExternalGrid({
      operator: 'product',
      gridVals: grid.map(r => r.map(c => c.val)),
      pathLenMin: 2,
      pathLenMax: 4
    });
  },

  getRefill(): EngineTile {
    return engine.getRefillTile();
  }
};
