

import { EngineSession, EngineTile } from '../../../src/engine/public';

const session = new EngineSession();

// Optional: subscribe to events for debugging or future features
const bus = session.getEventBus();
bus.subscribe("GRID_GENERATED", () => {
  // Safe hook for future metrics or debug logging
});

export type Operator = 'addition' | 'multiplication';

export const EngineAdapter = {
  initializeGame(rows: number, cols: number, operator: Operator) {
    const op = operator === 'addition' ? 'sum' : 'product';
    
    // Start engine in Solver mode via Session
    const engine = session.create({ seed: Date.now() }); // Use time seed for game randomness in production
    
    engine.startSolverGenerated({ rows, cols, operator: op });
    
    // Get initial grid (random numbers)
    const grid = engine.getInitialGrid(rows, cols);
    
    // Compute first target based on this grid
    const { target, solutionPath } = engine.computeSolverTargetFromExternalGrid({
      operator: op,
      gridVals: grid.map(r => r.map(c => c.val)),
      pathLenMin: 2,
      pathLenMax: 4
    });

    return { target, grid, solutionPath };
  },

  computeTarget(grid: EngineTile[][], operator: Operator) {
    const op = operator === 'addition' ? 'sum' : 'product';
    const engine = session.get();
    return engine.computeSolverTargetFromExternalGrid({
      operator: op,
      gridVals: grid.map(r => r.map(c => c.val)),
      pathLenMin: 2,
      pathLenMax: 4
    });
  },

  getRefill(): EngineTile {
    const engine = session.get();
    return engine.getRefillTile();
  }
};
