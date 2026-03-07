import {PracticeProfile} from './PracticeProfile';
import {TargetGenerator} from './TargetGenerator';
import {SpawnEngine, EngineTile} from './SpawnEngine';
import {ENGINE_VERSION} from './version';
import {DeterministicRNG} from './rng';
export type EngineModeStr = 'PRACTICE' | 'RECIPE' | 'FREE_PLAY' | 'SOLVER_GENERATED';
export class GridEngine {
  private _profile: PracticeProfile | null = null;
  private _targets: number[] = [];
  private _index = 0;
  private _mode: EngineModeStr = 'PRACTICE';
  private _currentFreePlayTarget: number = 12;
  private _spawnEngine: SpawnEngine;
  private _seed: number | undefined;
  private _debug: boolean = false;
  private rng: DeterministicRNG;
  constructor(rngOrOptions?: DeterministicRNG | { seed?: number; debug?: boolean }) {
    if (rngOrOptions instanceof DeterministicRNG) {
      this.rng = rngOrOptions;
      this._seed = this.rng.getSeed();
      this._debug = false;
    } else {
      const options = rngOrOptions || {};
      this._seed = options.seed;
      this._debug = options.debug || false;

      const seedVal = this._seed !== undefined
        ? this._seed
        : (Date.now() ^ Math.floor(Math.random() * 0xffffffff));

      this.rng = new DeterministicRNG(seedVal);
    }
    this._spawnEngine = new SpawnEngine({ debug: this._debug });

    if (this._debug) {
      console.log(`[GridEngine] Initialized v${ENGINE_VERSION}`, { seed: this._seed });
    }
  }
  startPractice(p: PracticeProfile) {
    this._mode = 'PRACTICE';
    this._profile = p;
    this._targets = TargetGenerator.generatePracticeTargets(p);
    this._index = 0;
    if (this._debug) console.log(`[GridEngine] Mode: PRACTICE, Targets: ${this._targets.length}`);
  }
  startRecipe(recipe: number[]) {
    this._mode = 'RECIPE';
    this._targets = [...recipe];
    this._index = 0;
    if (this._debug) console.log(`[GridEngine] Mode: RECIPE, Targets: ${this._targets.length}`);
  }
  startFreePlay() {
    this._mode = 'FREE_PLAY';
    this._currentFreePlayTarget = this.rng.nextInt(10, 99);
    if (this._debug) console.log(`[GridEngine] Mode: FREE_PLAY`);
  }
  startSolverGenerated(config: { rows: number; cols: number; operator: 'sum' | 'product'; seed?: number }) {
    this._mode = 'SOLVER_GENERATED';
    const seedToUse = config.seed !== undefined ? config.seed : this.rng.getSeed();
    this._spawnEngine.initialize(0, config.rows, config.cols, [], seedToUse);
    if (this._debug) console.log(`[GridEngine] Mode: SOLVER_GENERATED`);
  }
  computeSolverTargetFromExternalGrid(params: {
    operator: 'sum' | 'product';
    gridVals: number[][];
    pathLenMin: number;
    pathLenMax: number;
  }): { target: number; solutionPath: {r:number; c:number}[] } {
    if (this._mode !== 'SOLVER_GENERATED') {
      console.warn("Calling computeSolverTargetFromExternalGrid but not in SOLVER_GENERATED mode.");
    }
    return this._spawnEngine.solverFindPath(params.gridVals, params.operator, params.pathLenMin, params.pathLenMax);
  }
  nextTarget() {
    if (this._mode === 'FREE_PLAY') {
      this._currentFreePlayTarget = this.rng.nextInt(10, 99);
      return this._currentFreePlayTarget;
    }
    if (this._mode === 'SOLVER_GENERATED') {
      return 0;
    }
    if (!this._targets.length) return 12;
    this._index = (this._index + 1) % this._targets.length;
    return this._targets[this._index];
  }
  prevTarget() {
    if (this._mode === 'FREE_PLAY') {
      this._currentFreePlayTarget = this.rng.nextInt(10, 99);
      return this._currentFreePlayTarget;
    }
    if (!this._targets.length) return 12;
    this._index = (this._index - 1 + this._targets.length) % this._targets.length;
    return this._targets[this._index];
  }
  currentTarget() {
    if (this._mode === 'FREE_PLAY') return this._currentFreePlayTarget;
    if (!this._targets.length) return 12;
    return this._targets[this._index];
  }
  startRound(target: number, rows: number, cols: number, practiceSet: number[]) {
    this._spawnEngine.initialize(target, rows, cols, practiceSet, this.rng.getSeed());
  }
  getInitialGrid(rows: number, cols: number): EngineTile[][] {
    if (this._mode === 'SOLVER_GENERATED') {
      return this._spawnEngine.solverGenerateGrid(rows, cols, 1, 9);
    }
    return this._spawnEngine.generateBoard(rows, cols);
  }
  getRefillTile(): EngineTile {
    return this._spawnEngine.getSpawnValue();
  }
  // Public Accessors for Read-Only State
  public get mode(): EngineModeStr { return this._mode; }
  public get targets(): ReadonlyArray<number> { return this._targets; }
  public get index(): number { return this._index; }
}
