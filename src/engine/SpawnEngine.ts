export interface EngineTile {
  kind: 'number' | 'bomb' | 'trophy' | 'op' | 'blank' | 'stone';
  val: number;
  reason?: string;
}
export interface SpawnDecision {
  kind: 'number' | 'bomb' | 'trophy' | 'op' | 'blank' | 'stone';
  val: number;
  reason: string;
}
class SeededRNG {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed >>> 0;
  }
  next(): number {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(minInclusive: number, maxInclusive: number): number {
    const r = this.next();
    return Math.floor(r * (maxInclusive - minInclusive + 1)) + minInclusive;
  }
  pick<T>(arr: T[]): T {
    if (arr.length === 0) throw new Error("Cannot pick from empty array");
    return arr[this.nextInt(0, arr.length - 1)];
  }
}
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
function apportionCounts(total: number, parts: Array<{ key: string; ratio: number }>): Record<string, number> {
  const raw = parts.map(p => ({
    key: p.key,
    exact: total * p.ratio,
    floor: Math.floor(total * p.ratio),
    frac: (total * p.ratio) - Math.floor(total * p.ratio)
  }));
  let used = raw.reduce((a, b) => a + b.floor, 0);
  let remaining = total - used;
  raw.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < raw.length && remaining > 0; i++) {
    raw[i].floor += 1;
    remaining -= 1;
  }
  const out: Record<string, number> = {};
  for (const r of raw) out[r.key] = r.floor;
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  if (sum !== total) {
    const lastKey = raw[raw.length - 1].key;
    out[lastKey] = (out[lastKey] || 0) + (total - sum);
  }
  return out;
}
type TargetProfile = {
  pair_count: number;
  factor_set: number[];
  factor_ratio: number;
  zero_ratio: number;
  one_ratio: number;
  other_distr_ratio: number;
};
const TARGET_TABLE: Record<number, TargetProfile> = {
  12:  { pair_count: 3, factor_set: [1,2,3,4,6,12], factor_ratio: 0.5,  zero_ratio: 0.096, one_ratio: 0.116, other_distr_ratio: 0.288 },
};
const DEFAULT_PROFILE: TargetProfile = {
  pair_count: 1,
  factor_set: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  factor_ratio: 0.5,
  zero_ratio: 0.08,
  one_ratio: 0.1,
  other_distr_ratio: 0.32,
};
export class SpawnEngine {
  private rng: SeededRNG = new SeededRNG(0);
  private seedQueue: SpawnDecision[] = [];
  private spawnQueue: SpawnDecision[] = [];
  private target: number = 12;
  private practiceSet: number[] = [];
  private allowedValues: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  private rows: number = 7;
  private cols: number = 5;
  private seedSalt: number = 0;
  private VALUE_CAP_PERCENT: number = 0.18;
  private spawnRefillIndex: number = 0;
  private debug: boolean = false;
  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug || false;
  }
  public initialize(
    target: number,
    rows: number,
    cols: number,
    practiceSet: number[] = [],
    seedSalt: number = 0
  ) {
    this.target = target;
    this.rows = rows;
    this.cols = cols;
    this.practiceSet = [...practiceSet].slice().sort((a, b) => a - b);
    this.seedSalt = seedSalt | 0;
    this.spawnRefillIndex = 0;
    const seedStr = `t=${target}|r=${rows}|c=${cols}|p=${this.practiceSet.join(',')}|salt=${this.seedSalt}`;
    const seed32 = fnv1a32(seedStr);
    this.rng = new SeededRNG(seed32);
    const seedCount = rows * cols;
    this.seedQueue = this.generateQueue(seedCount, true, 'seed-stream-0');
    this.spawnQueue = this.generateQueue(seedCount * 5, false, 'spawn-stream-0');
    if (this.debug) {
      console.log(`[SpawnEngine] Initialized. Target:${target}, Seed:${seed32}`);
    }
  }
  public generateBoard(rows: number, cols: number): EngineTile[][] {
    const board: EngineTile[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: EngineTile[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(this.getSeedValue());
      }
      board.push(row);
    }
    return board;
  }
  public getSeedValue(): SpawnDecision {
    if (this.seedQueue.length === 0) return this.getSpawnValue();
    return this.seedQueue.shift()!;
  }
  public getSpawnValue(): SpawnDecision {
    if (this.spawnQueue.length === 0) {
      this.spawnRefillIndex++;
      const count = this.rows * this.cols * 2;
      this.spawnQueue = this.generateQueue(count, false, `spawn-stream-${this.spawnRefillIndex}`);
    }
    return this.spawnQueue.shift()!;
  }
  public solverGenerateGrid(rows: number, cols: number, minVal: number, maxVal: number): EngineTile[][] {
    const grid: EngineTile[][] = [];
    for(let r=0; r<rows; r++) {
      const row: EngineTile[] = [];
      for(let c=0; c<cols; c++) {
        const val = this.rng.nextInt(minVal, maxVal);
        row.push({ kind: 'number', val, reason: 'Solver Gen' });
      }
      grid.push(row);
    }
    return grid;
  }
  public solverFindPath(
    grid: EngineTile[][] | number[][],
    op: 'sum' | 'product',
    lenMin: number,
    lenMax: number
  ): { target: number, solutionPath: {r:number, c:number}[] } {

    const numGrid: number[][] = (typeof grid[0][0] === 'number')
      ? grid as number[][]
      : (grid as EngineTile[][]).map(r => r.map(t => t.val));
    const rows = numGrid.length;
    const cols = numGrid[0].length;
    const MAX_ATTEMPTS = 200;
    const BOUNDS = op === 'sum'
      ? { min: 4, max: 40 }
      : { min: 6, max: 144 };
    for(let i=0; i<MAX_ATTEMPTS; i++) {
      const len = this.rng.nextInt(lenMin, lenMax);
      const startR = this.rng.nextInt(0, rows-1);
      const startC = this.rng.nextInt(0, cols-1);

      const path: {r:number, c:number}[] = [{r: startR, c: startC}];
      const visited = new Set<string>();
      visited.add(`${startR},${startC}`);
      let currR = startR;
      let currC = startC;
      let validPath = true;
      for(let k=1; k<len; k++) {
        const neighbors = [];
        for(let dr=-1; dr<=1; dr++) {
          for(let dc=-1; dc<=1; dc++) {
            if(dr===0 && dc===0) continue;
            const nr = currR + dr;
            const nc = currC + dc;
            if(nr>=0 && nr<rows && nc>=0 && nc<cols && !visited.has(`${nr},${nc}`)) {
              neighbors.push({r: nr, c: nc});
            }
          }
        }
        if(neighbors.length === 0) {
          validPath = false;
          break;
        }
        const next = this.rng.pick(neighbors);
        path.push(next);
        visited.add(`${next.r},${next.c}`);
        currR = next.r;
        currC = next.c;
      }
      if(validPath) {
        let target = op === 'sum' ? 0 : 1;
        for(const p of path) {
          const v = numGrid[p.r][p.c];
          if(op === 'sum') target += v;
          else target *= v;
        }
        if(target >= BOUNDS.min && target <= BOUNDS.max) {
          return { target, solutionPath: path };
        }
      }
    }
    const fallbackPath = [];
    let fr=0, fc=0;
    const fallbackLen = lenMin;
    let target = op === 'sum' ? 0 : 1;

    for(let k=0; k<fallbackLen; k++) {
      if(fc >= cols) { fc = 0; fr++; }
      if(fr >= rows) break;
      fallbackPath.push({r: fr, c: fc});
      const v = numGrid[fr][fc];
      if(op === 'sum') target += v;
      else target *= v;
      fc++;
    }

    if (this.debug) console.warn("[SpawnEngine] Solver fallback used");
    return { target, solutionPath: fallbackPath };
  }
  private getProfile(): TargetProfile {
    return TARGET_TABLE[this.target] || DEFAULT_PROFILE;
  }
  private generateQueue(count: number, isSeed: boolean, streamKey: string): SpawnDecision[] {
    const baseSeedStr = `t=${this.target}|r=${this.rows}|c=${this.cols}|p=${this.practiceSet.join(',')}|salt=${this.seedSalt}|stream=${streamKey}`;
    const streamSeed = fnv1a32(baseSeedStr);
    const rng = new SeededRNG(streamSeed);
    const profile = this.getProfile();
    const trueFactors = this.allowedValues.filter(v => v > 1 && this.target % v === 0);
    const distractors = this.allowedValues.filter(v => v > 1 && this.target % v !== 0);
    const factorCandidates = trueFactors;
    const parts = apportionCounts(count, [
      { key: 'factors', ratio: profile.factor_ratio },
      { key: 'zeros', ratio: profile.zero_ratio },
      { key: 'ones', ratio: profile.one_ratio },
      { key: 'distractors', ratio: profile.other_distr_ratio }
    ]);
    const numFactors = Math.max(0, parts.factors);
    const numZeros = Math.max(0, parts.zeros);
    const numOnes = Math.max(0, parts.ones);
    const numDistractors = Math.max(0, parts.distractors);
    const queue: SpawnDecision[] = [];
    const baseFactorDeck = factorCandidates.filter(v => v > 1);
    const practicedFactors = baseFactorDeck.filter(v => this.practiceSet.includes(v));
    let factorDeck: number[] = [...baseFactorDeck];
    if (practicedFactors.length > 0) factorDeck.push(...practicedFactors, ...practicedFactors);
    if (factorDeck.length === 0) factorDeck = [2];
    this.shuffleInPlace(factorDeck, rng);
    for (let i = 0; i < numFactors; i++) {
      const val = factorDeck[i % factorDeck.length];
      queue.push({ kind: 'number', val, reason: 'Planned Factor' });
    }
    for (let i = 0; i < numZeros; i++) queue.push({ kind: 'number', val: 0, reason: 'Planned Zero' });
    for (let i = 0; i < numOnes; i++) queue.push({ kind: 'number', val: 1, reason: 'Planned One' });
    if (distractors.length > 0) {
      for (let i = 0; i < numDistractors; i++) {
        const val = rng.pick(distractors);
        queue.push({ kind: 'number', val: Math.min(12, Math.max(0, val)), reason: 'Planned Distractor' });
      }
    } else {
      for (let i = 0; i < numDistractors; i++) {
        queue.push({ kind: 'number', val: 0, reason: 'Fallback Distractor' });
      }
    }
    this.shuffleInPlace(queue, rng);
    this.enforceValueCaps(queue, count, rng, isSeed ? 2 : 0);
    if (isSeed) {
      const anchorPair = this.selectAnchorPair(profile, rng);
      if (anchorPair) {
        queue[0] = { kind: 'number', val: anchorPair[0], reason: 'Anchor A' };
        queue[1] = { kind: 'number', val: anchorPair[1], reason: 'Anchor B' };
        this.enforceValueCaps(queue, count, rng, 2);
      } else {
        const fallback = this.emergencyAnchorFallback(rng);
        queue[0] = { kind: 'number', val: fallback[0], reason: 'Anchor A (Fallback)' };
        queue[1] = { kind: 'number', val: fallback[1], reason: 'Anchor B (Fallback)' };
        this.enforceValueCaps(queue, count, rng, 2);
      }
    }
    return queue;
  }
  private selectAnchorPair(profile: TargetProfile, rng: SeededRNG): [number, number] | null {
    const allowedOperands = this.allowedValues.filter(v => v >= 1 && v <= 12 && this.target % v === 0);
    const pairs: [number, number][] = [];
    for (const a of allowedOperands) {
      const b = this.target / a;
      if (Number.isInteger(b) && b >= 1 && b <= 12 && this.allowedValues.includes(b)) {
        pairs.push([a, b]);
      }
    }
    if (pairs.length > 0) return rng.pick(pairs);
    return null;
  }
  private emergencyAnchorFallback(rng: SeededRNG): [number, number] {
    if (this.target >= 1 && this.target <= 12) return [1, this.target];
    if (this.target % 2 === 0) {
      const b = this.target / 2;
      if (b >= 1 && b <= 12) return [2, b];
    }
    return [1, 1];
  }
  private enforceValueCaps(queue: SpawnDecision[], totalCount: number, rng: SeededRNG, excludeFirstN: number): void {
    const maxPerValue = Math.max(1, Math.floor(totalCount * this.VALUE_CAP_PERCENT));
    const counts: Record<number, number> = {};
    for (let i = excludeFirstN; i < queue.length; i++) {
      const v = queue[i].val;
      counts[v] = (counts[v] || 0) + 1;
    }
    for (let i = excludeFirstN; i < queue.length; i++) {
      const v = queue[i].val;
      if ((counts[v] || 0) <= maxPerValue) continue;

      const newVal = (v + 1) % 13;
      counts[v]--;
      counts[newVal] = (counts[newVal] || 0) + 1;
      queue[i] = { kind: 'number', val: newVal, reason: 'Cap Enforcement' };
    }
  }
  private shuffleInPlace<T>(array: T[], rng: SeededRNG): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
