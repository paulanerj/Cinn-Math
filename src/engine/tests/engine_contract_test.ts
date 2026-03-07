import { GridEngine } from '../GridEngine';
import { PracticeProfile } from '../PracticeProfile';
const TEST_LOG: string[] = [];
function log(msg: string) { TEST_LOG.push(msg); console.log(msg); }
function assert(condition: boolean, msg: string) {
  if (!condition) {
    const err = `[FAIL] ${msg}`;
    log(err);
    throw new Error(err);
  }
  log(`[PASS] ${msg}`);
}
export function runEngineContractTests() {
  log("Starting Engine Contract Tests...");
  const engine = new GridEngine();
  try {
    log("--- Test 1: Practice Targets ---");
    const profile = new PracticeProfile([7], 2, 5);
    engine.startPractice(profile);
    const targets = new Set<number>();
    for (let i = 0; i < 10; i++) targets.add(engine.nextTarget());
    assert(targets.has(14), "Generated target 14");
    assert(targets.has(21), "Generated target 21");
    assert(targets.has(28), "Generated target 28");
    assert(targets.has(35), "Generated target 35");
    assert(!targets.has(12), "Did not generate invalid target 12");
    log("--- Test 2: Recipe Targets ---");
    const recipe = [100, 200, 300];
    engine.startRecipe(recipe);
    assert(engine.nextTarget() === 200, "Sequence 1 is 200 (index 1)");
    assert(engine.nextTarget() === 300, "Sequence 2 is 300");
    assert(engine.nextTarget() === 100, "Sequence 3 loops to 100");
    log("--- Test 3: Free Play ---");
    engine.startFreePlay();
    const t1 = engine.nextTarget();
    assert(t1 >= 10 && t1 <= 100, `Free Play target ${t1} in range`);
    log("--- Test 4: Board Structure ---");
    const ROWS = 6, COLS = 4;
    engine.startRound(12, ROWS, COLS, [2,3]);
    const grid = engine.getInitialGrid(ROWS, COLS);
    assert(grid.length === ROWS, "Rows match");
    assert(grid[0].length === COLS, "Cols match");
    const a = grid[0][0].val;
    const b = grid[0][1].val;
    assert(a * b === 12, `Anchors multiply to target: ${a} * ${b} = 12`);
    log("--- Test 5: Refill Consistency ---");
    const refill = engine.getRefillTile();
    assert(refill.kind !== undefined, "Refill has kind");
    assert(typeof refill.val === 'number', "Refill has value");
    log("--- Test 6: Distribution Heuristic ---");
    let factors = 0;
    let zeros = 0;
    const totalTiles = ROWS * COLS;
    grid.flat().forEach(t => {
      if (t.val > 1 && 12 % t.val === 0) factors++;
      if (t.val === 0) zeros++;
    });
    const factorRatio = factors / totalTiles;
    assert(factorRatio > 0.3, `Factor density sufficient (${(factorRatio*100).toFixed(1)}%)`);
    assert(zeros > 0, "Contains zeros");
    log("--- Test 7: Solver Generated Mode ---");
    const seed = 12345;
    const engineA = new GridEngine({ seed });
    engineA.startSolverGenerated({ rows: 5, cols: 5, operator: 'product' });
    const gridA = engineA.getInitialGrid(5, 5);
    const targetA = engineA.computeSolverTargetFromExternalGrid({
        operator: 'product',
        gridVals: gridA.map(r => r.map(c => c.val)),
        pathLenMin: 2,
        pathLenMax: 4
    });
    const engineB = new GridEngine({ seed });
    engineB.startSolverGenerated({ rows: 5, cols: 5, operator: 'product' });
    const gridB = engineB.getInitialGrid(5, 5);
    const targetB = engineB.computeSolverTargetFromExternalGrid({
        operator: 'product',
        gridVals: gridB.map(r => r.map(c => c.val)),
        pathLenMin: 2,
        pathLenMax: 4
    });
    assert(JSON.stringify(gridA) === JSON.stringify(gridB), "Solver Grid Generation is Deterministic");
    assert(targetA.target === targetB.target, "Solver Target Generation is Deterministic");
    assert(JSON.stringify(targetA.solutionPath) === JSON.stringify(targetB.solutionPath), "Solver Path is Deterministic");
    let calcTarget = 1;
    for(const p of targetA.solutionPath) {
        calcTarget *= gridA[p.r][p.c].val;
    }
    assert(calcTarget === targetA.target, `Solution Path Validates: ${calcTarget} === ${targetA.target}`);
    log("ALL ENGINE TESTS PASSED");
    return true;
  } catch (e) {
    console.error(e);
    log("TESTS FAILED");
    return false;
  }
}
if (typeof window !== 'undefined') {
  (window as any).runEngineTests = runEngineContractTests;
}
