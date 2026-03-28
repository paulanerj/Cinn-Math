/**
 * CombineGrid — single-file standalone build
 * Inlines: engine (SpawnEngine, GridEngine, PracticeProfile, DeterministicRNG,
 * TargetGenerator), all services, all UI tokens, platform HUD + Toast, and
 * all game components.
 *
 * Last-commit parity: Board renders at exact computed size — no GRID_SCALE
 * upscale applied (removed in Phase 1 layout recovery).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Layout / UI tokens
// ─────────────────────────────────────────────────────────────────────────────

const SAFE_MARGIN  = 5;   // px — outer safe area margin
const BORDER_WIDTH = 5;   // px — tile border (token kept for reference)
const GAP          = 2;   // px — grid gap
const PAD          = 6;   // px — tile inner padding
const BASE_RADIUS_PX = 16; // px — tile border radius
const HUD_TOP_H    = 54;  // px
const HUD_BOT_H    = 52;  // px

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Game constants
// ─────────────────────────────────────────────────────────────────────────────

const ROWS                   = 6;
const COLS                   = 4;
const BOMB_COUNT             = 2;   // kept for reference
const TROPHY_COUNT           = 1;   // kept for reference
const STALEMATE_VALID_THRESHOLD = 1;
const ROUNDS_PER_SESSION     = 5;
const BUILD_STAMP            = 'CG-STAMP-2';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Types
// ─────────────────────────────────────────────────────────────────────────────

type TileKind = 'number' | 'bomb' | 'trophy' | 'blank' | 'stone';

type Tile = {
  id: string;
  kind: TileKind;
  val: number;
  selected?: boolean;
  clearing?: boolean;
  falling?: boolean;
};

type GridPos = { r: number; c: number };

type GamePhase =
  | 'IDLE'
  | 'SELECTING'
  | 'CLEARING'
  | 'FALLING'
  | 'REFILLING'
  | 'ROUND_OVER'
  | 'STALEMATE'
  | 'FINAL';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Engine — DeterministicRNG (LCG, Numerical Recipes constants)
// ─────────────────────────────────────────────────────────────────────────────

class DeterministicRNG {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  getSeed(): number { return this.state; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Engine — SpawnEngine
// ─────────────────────────────────────────────────────────────────────────────

interface EngineTile {
  kind: 'number' | 'bomb' | 'trophy' | 'op' | 'blank' | 'stone';
  val: number;
  reason?: string;
}

interface SpawnDecision {
  kind: 'number' | 'bomb' | 'trophy' | 'op' | 'blank' | 'stone';
  val: number;
  reason: string;
}

class SeededRNG {
  private seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  next(): number {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(minInclusive: number, maxInclusive: number): number {
    return Math.floor(this.next() * (maxInclusive - minInclusive + 1)) + minInclusive;
  }
  pick<T>(arr: T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
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

function apportionCounts(
  total: number,
  parts: Array<{ key: string; ratio: number }>,
): Record<string, number> {
  const raw = parts.map(p => ({
    key: p.key,
    exact: total * p.ratio,
    floor: Math.floor(total * p.ratio),
    frac: (total * p.ratio) - Math.floor(total * p.ratio),
  }));
  let remaining = total - raw.reduce((a, b) => a + b.floor, 0);
  raw.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < raw.length && remaining > 0; i++) { raw[i].floor++; remaining--; }
  const out: Record<string, number> = {};
  for (const r of raw) out[r.key] = r.floor;
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  if (sum !== total) out[raw[raw.length - 1].key] += total - sum;
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
  12: { pair_count: 3, factor_set: [1,2,3,4,6,12], factor_ratio: 0.5, zero_ratio: 0.096, one_ratio: 0.116, other_distr_ratio: 0.288 },
};

const DEFAULT_PROFILE: TargetProfile = {
  pair_count: 1,
  factor_set: [2,3,4,5,6,7,8,9,10,11,12],
  factor_ratio: 0.5,
  zero_ratio: 0.08,
  one_ratio: 0.1,
  other_distr_ratio: 0.32,
};

class SpawnEngine {
  private rng: SeededRNG = new SeededRNG(0);
  private seedQueue: SpawnDecision[] = [];
  private spawnQueue: SpawnDecision[] = [];
  private target = 12;
  private practiceSet: number[] = [];
  private allowedValues = [0,1,2,3,4,5,6,7,8,9,10,11,12];
  private rows = 7;
  private cols = 5;
  private seedSalt = 0;
  private VALUE_CAP_PERCENT = 0.18;
  private spawnRefillIndex = 0;

  initialize(target: number, rows: number, cols: number, practiceSet: number[] = [], seedSalt = 0) {
    this.target = target;
    this.rows = rows;
    this.cols = cols;
    this.practiceSet = [...practiceSet].sort((a, b) => a - b);
    this.seedSalt = seedSalt | 0;
    this.spawnRefillIndex = 0;
    const seedStr = `t=${target}|r=${rows}|c=${cols}|p=${this.practiceSet.join(',')}|salt=${this.seedSalt}`;
    this.rng = new SeededRNG(fnv1a32(seedStr));
    this.seedQueue  = this.generateQueue(rows * cols,     true,  'seed-stream-0');
    this.spawnQueue = this.generateQueue(rows * cols * 5, false, 'spawn-stream-0');
  }

  generateBoard(rows: number, cols: number): EngineTile[][] {
    const board: EngineTile[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: EngineTile[] = [];
      for (let c = 0; c < cols; c++) row.push(this.getSeedValue());
      board.push(row);
    }
    return board;
  }

  getSeedValue(): SpawnDecision {
    return this.seedQueue.length ? this.seedQueue.shift()! : this.getSpawnValue();
  }

  getSpawnValue(): SpawnDecision {
    if (!this.spawnQueue.length) {
      this.spawnRefillIndex++;
      this.spawnQueue = this.generateQueue(
        this.rows * this.cols * 2, false,
        `spawn-stream-${this.spawnRefillIndex}`,
      );
    }
    return this.spawnQueue.shift()!;
  }

  private getProfile(): TargetProfile {
    return TARGET_TABLE[this.target] || DEFAULT_PROFILE;
  }

  private generateQueue(count: number, isSeed: boolean, streamKey: string): SpawnDecision[] {
    const baseSeedStr = `t=${this.target}|r=${this.rows}|c=${this.cols}|p=${this.practiceSet.join(',')}|salt=${this.seedSalt}|stream=${streamKey}`;
    const rng = new SeededRNG(fnv1a32(baseSeedStr));
    const profile = this.getProfile();
    const trueFactors = this.allowedValues.filter(v => v > 1 && this.target % v === 0);
    const distractors  = this.allowedValues.filter(v => v > 1 && this.target % v !== 0);
    const parts = apportionCounts(count, [
      { key: 'factors',     ratio: profile.factor_ratio },
      { key: 'zeros',       ratio: profile.zero_ratio },
      { key: 'ones',        ratio: profile.one_ratio },
      { key: 'distractors', ratio: profile.other_distr_ratio },
    ]);

    const queue: SpawnDecision[] = [];
    const baseFactorDeck = trueFactors.filter(v => v > 1);
    const practicedFactors = baseFactorDeck.filter(v => this.practiceSet.includes(v));
    let factorDeck = [...baseFactorDeck];
    if (practicedFactors.length > 0) factorDeck.push(...practicedFactors, ...practicedFactors);
    if (factorDeck.length === 0) factorDeck = [2];
    this.shuffleInPlace(factorDeck, rng);

    for (let i = 0; i < parts.factors; i++)
      queue.push({ kind: 'number', val: factorDeck[i % factorDeck.length], reason: 'Planned Factor' });
    for (let i = 0; i < parts.zeros; i++)
      queue.push({ kind: 'number', val: 0, reason: 'Planned Zero' });
    for (let i = 0; i < parts.ones; i++)
      queue.push({ kind: 'number', val: 1, reason: 'Planned One' });
    if (distractors.length > 0) {
      for (let i = 0; i < parts.distractors; i++)
        queue.push({ kind: 'number', val: Math.min(12, Math.max(0, rng.pick(distractors))), reason: 'Planned Distractor' });
    } else {
      for (let i = 0; i < parts.distractors; i++)
        queue.push({ kind: 'number', val: 0, reason: 'Fallback Distractor' });
    }

    this.shuffleInPlace(queue, rng);
    this.enforceValueCaps(queue, count, rng, isSeed ? 2 : 0);

    if (isSeed) {
      const anchor = this.selectAnchorPair(profile, rng) ?? this.emergencyAnchorFallback(rng);
      queue[0] = { kind: 'number', val: anchor[0], reason: 'Anchor A' };
      queue[1] = { kind: 'number', val: anchor[1], reason: 'Anchor B' };
      this.enforceValueCaps(queue, count, rng, 2);
    }
    return queue;
  }

  private selectAnchorPair(profile: TargetProfile, rng: SeededRNG): [number, number] | null {
    const ops = this.allowedValues.filter(v => v >= 1 && v <= 12 && this.target % v === 0);
    const pairs: [number, number][] = [];
    for (const a of ops) {
      const b = this.target / a;
      if (Number.isInteger(b) && b >= 1 && b <= 12 && this.allowedValues.includes(b)) pairs.push([a, b]);
    }
    return pairs.length ? rng.pick(pairs) : null;
  }

  private emergencyAnchorFallback(rng: SeededRNG): [number, number] {
    if (this.target >= 1 && this.target <= 12) return [1, this.target];
    if (this.target % 2 === 0) { const b = this.target / 2; if (b <= 12) return [2, b]; }
    return [1, 1];
  }

  private enforceValueCaps(queue: SpawnDecision[], totalCount: number, rng: SeededRNG, excludeFirstN: number) {
    const max = Math.max(1, Math.floor(totalCount * this.VALUE_CAP_PERCENT));
    const counts: Record<number, number> = {};
    for (let i = excludeFirstN; i < queue.length; i++) counts[queue[i].val] = (counts[queue[i].val] || 0) + 1;
    for (let i = excludeFirstN; i < queue.length; i++) {
      const v = queue[i].val;
      if ((counts[v] || 0) <= max) continue;
      const nv = (v + 1) % 13;
      counts[v]--;
      counts[nv] = (counts[nv] || 0) + 1;
      queue[i] = { kind: 'number', val: nv, reason: 'Cap Enforcement' };
    }
  }

  private shuffleInPlace<T>(array: T[], rng: SeededRNG) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Engine — PracticeProfile & TargetGenerator
// ─────────────────────────────────────────────────────────────────────────────

class PracticeProfile {
  constructor(
    public readonly multipliers: number[],
    public readonly coMin: number,
    public readonly coMax: number,
  ) { Object.freeze(this); }
}

class TargetGenerator {
  static generatePracticeTargets(p: PracticeProfile): number[] {
    const s = new Set<number>();
    for (const m of p.multipliers)
      for (let i = p.coMin; i <= p.coMax; i++) s.add(m * i);
    return Array.from(s).sort((a, b) => a - b);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Engine — GridEngine
// ─────────────────────────────────────────────────────────────────────────────

class GridEngine {
  private _profile: PracticeProfile | null = null;
  private _targets: number[] = [];
  private _index = 0;
  private _spawnEngine = new SpawnEngine();
  private rng: DeterministicRNG;

  constructor(seed?: number) {
    const s = seed !== undefined ? seed : (Date.now() ^ Math.floor(Math.random() * 0xffffffff));
    this.rng = new DeterministicRNG(s);
  }

  startPractice(p: PracticeProfile) {
    this._profile = p;
    this._targets = TargetGenerator.generatePracticeTargets(p);
    this._index = 0;
  }

  nextTarget(): number {
    if (!this._targets.length) return 12;
    this._index = (this._index + 1) % this._targets.length;
    return this._targets[this._index];
  }

  startRound(target: number, rows: number, cols: number, practiceSet: number[]) {
    this._spawnEngine.initialize(target, rows, cols, practiceSet, this.rng.getSeed());
  }

  getInitialGrid(rows: number, cols: number): EngineTile[][] {
    return this._spawnEngine.generateBoard(rows, cols);
  }

  getRefillTile(): EngineTile {
    return this._spawnEngine.getSpawnValue();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: GridService
// ─────────────────────────────────────────────────────────────────────────────

let _idCounter = 1;
function newId(): string { return `t${_idCounter++}`; }

function engineTileToTile(et: EngineTile): Tile {
  return { id: newId(), kind: et.kind as Tile['kind'], val: et.val };
}

function buildGrid(engineTiles: EngineTile[][], rows: number, cols: number): Tile[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => engineTileToTile(engineTiles[r][c])),
  );
}

function countValidPairs(grid: Tile[][], target: number): number {
  let count = 0;
  const flat = grid.flat().filter(t => t.kind === 'number');
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++)
      if (flat[i].val * flat[j].val === target) count++;
  return count;
}

function countBombs(grid: Tile[][]): number {
  return grid.flat().filter(t => t.kind === 'bomb').length;
}

function removeTiles(grid: Tile[][], positions: GridPos[]): Tile[][] {
  const posSet = new Set(positions.map(p => `${p.r},${p.c}`));
  return grid.map((row, r) =>
    row.map((tile, c) =>
      posSet.has(`${r},${c}`) ? { ...tile, kind: 'blank' as Tile['kind'], val: 0 } : tile,
    ),
  );
}

function applyGravity(grid: Tile[][]): Tile[][] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next = grid.map(row => row.map(t => ({ ...t })));
  for (let c = 0; c < cols; c++) {
    let writeR = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (next[r][c].kind !== 'blank') {
        next[writeR][c] = { ...next[r][c] };
        if (writeR !== r) next[r][c] = { id: newId(), kind: 'blank', val: 0 };
        writeR--;
      }
    }
  }
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: SelectionService
// ─────────────────────────────────────────────────────────────────────────────

type Selection = { first: GridPos | null; second: GridPos | null };

function emptySelection(): Selection { return { first: null, second: null }; }

function selectTile(sel: Selection, pos: GridPos, grid: Tile[][]): Selection {
  const tile = grid[pos.r][pos.c];
  if (tile.kind === 'blank' || tile.kind === 'stone') return sel;
  if (!sel.first) return { ...sel, first: pos };
  if (sel.first.r === pos.r && sel.first.c === pos.c) return emptySelection();
  return { first: sel.first, second: pos };
}

function isPairComplete(sel: Selection): sel is { first: GridPos; second: GridPos } {
  return sel.first !== null && sel.second !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Platform — Toast
// ─────────────────────────────────────────────────────────────────────────────

type ToastItem = { id: number; message: string; type?: 'info' | 'success' | 'error' };
type ToastContextValue = {
  showToast: (message: string, type?: ToastItem['type']) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
let _nextToastId = 1;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = _nextToastId++;
    setToasts(prev => [...prev, { id, message, type }]);
    timers.current.set(id, setTimeout(() => dismiss(id), 2200));
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-lg text-white ${
              t.type === 'error' ? 'bg-red-500' : t.type === 'success' ? 'bg-green-500' : 'bg-gray-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Platform — HUD Shell
// ─────────────────────────────────────────────────────────────────────────────

function HUDTopBar({ left, center, right }: { left?: React.ReactNode; center?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-3 bg-white/90 backdrop-blur z-30 border-b border-gray-200"
      style={{ height: HUD_TOP_H }}
    >
      <div className="flex items-center gap-2 min-w-0">{left}</div>
      <div className="flex-1 text-center font-bold text-gray-700 truncate px-2">{center}</div>
      <div className="flex items-center gap-2 min-w-0 justify-end">{right}</div>
    </div>
  );
}

function HUDBottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-3 bg-white/90 backdrop-blur z-30 border-t border-gray-200"
      style={{ height: HUD_BOT_H }}
    >
      {children}
    </div>
  );
}

function HUDIconBtn({ onClick, label, children, disabled }: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-0.5 text-xs text-gray-600 disabled:opacity-40 active:scale-95 transition-transform"
    >
      <span className="text-xl leading-none">{children}</span>
      <span>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Component — TileCell
// ─────────────────────────────────────────────────────────────────────────────

function tileColour(tile: Tile): string {
  if (tile.kind === 'blank')  return 'bg-gray-100';
  if (tile.kind === 'bomb')   return 'bg-red-500 text-white';
  if (tile.kind === 'trophy') return 'bg-yellow-400 text-yellow-900';
  if (tile.kind === 'stone')  return 'bg-gray-400 text-gray-200';
  const v = tile.val;
  if (v === 0) return 'bg-slate-200 text-slate-500';
  if (v === 1) return 'bg-blue-100 text-blue-700';
  if (v <= 3)  return 'bg-green-200 text-green-900';
  if (v <= 6)  return 'bg-lime-200 text-lime-900';
  if (v <= 9)  return 'bg-amber-200 text-amber-900';
  return 'bg-orange-300 text-orange-900';
}

function tileLabel(tile: Tile): string {
  if (tile.kind === 'bomb')   return '💣';
  if (tile.kind === 'trophy') return '🏆';
  if (tile.kind === 'stone')  return '🪨';
  if (tile.kind === 'blank')  return '';
  return String(tile.val);
}

function TileCell({ tile, size, selected, onPress }: {
  tile: Tile;
  size: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <button
      onClick={onPress}
      disabled={tile.kind === 'blank' || tile.kind === 'stone'}
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(BASE_RADIUS_PX, size * 0.28),
        fontSize: size * 0.42,
        padding: PAD,
        border: selected ? '3px solid #6366f1' : '2px solid rgba(0,0,0,0.08)',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 0.1s, border-color 0.1s',
        boxShadow: selected
          ? '0 0 0 3px rgba(99,102,241,0.3)'
          : '0 1px 3px rgba(0,0,0,0.12)',
      }}
      className={`flex items-center justify-center font-bold select-none active:scale-95 ${tileColour(tile)}`}
    >
      {tileLabel(tile)}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Component — Board
// No GRID_SCALE upscale applied (removed in Phase 1 layout recovery)
// ─────────────────────────────────────────────────────────────────────────────

function posKey(p: GridPos) { return `${p.r},${p.c}`; }

function Board({ grid, selection, tileSize, onTilePress }: {
  grid: Tile[][];
  selection: Selection;
  tileSize: number;
  onTilePress: (pos: GridPos) => void;
}) {
  const selectedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (selection.first)  keys.add(posKey(selection.first));
    if (selection.second) keys.add(posKey(selection.second));
    return keys;
  }, [selection]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${grid[0]?.length ?? COLS}, ${tileSize}px)`,
        gap: GAP,
      }}
    >
      {grid.map((row, r) =>
        row.map((tile, c) => (
          <TileCell
            key={tile.id}
            tile={tile}
            size={tileSize}
            selected={selectedKeys.has(posKey({ r, c }))}
            onPress={() => onTilePress({ r, c })}
          />
        )),
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Component — ResultScreen
// ─────────────────────────────────────────────────────────────────────────────

function ResultScreen({ phase, trophies, score, round, target, onNext, onRestart }: {
  phase: GamePhase;
  trophies: number;
  score: number;
  round: number;
  target: number;
  onNext: () => void;
  onRestart: () => void;
}) {
  if (phase === 'FINAL') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/95 z-50 gap-5 p-6">
        <span className="text-6xl">🏆</span>
        <h2 className="text-3xl font-extrabold text-indigo-700">Final Trophies</h2>
        <p className="text-5xl font-black text-yellow-500">{trophies}</p>
        <p className="text-gray-600 text-lg">Score: <strong>{score}</strong></p>
        <button
          onClick={onRestart}
          className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-lg font-bold shadow-lg active:scale-95"
        >
          Play Again
        </button>
      </div>
    );
  }

  if (phase === 'ROUND_OVER' || phase === 'STALEMATE') {
    const isFinalRound = round >= ROUNDS_PER_SESSION;
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/95 z-50 gap-4 p-6">
        <span className="text-5xl">{phase === 'STALEMATE' ? '😅' : '✅'}</span>
        <h2 className="text-2xl font-bold text-gray-800">
          {phase === 'STALEMATE' ? 'No More Moves!' : 'Round Over!'}
        </h2>
        <p className="text-gray-500">Target was <strong className="text-indigo-600">{target}</strong></p>
        <p className="text-gray-700">Trophies: <strong className="text-yellow-500">{trophies} 🏆</strong></p>
        <p className="text-gray-600">Score: <strong>{score}</strong></p>
        <button
          onClick={isFinalRound ? onRestart : onNext}
          className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-lg font-bold shadow-lg active:scale-95"
        >
          {isFinalRound ? 'See Final Trophies' : 'Next Problem'}
        </button>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Main game component
// ─────────────────────────────────────────────────────────────────────────────

const _STAMP = BUILD_STAMP;

function CombineGridApp({ onBack }: { onBack?: () => void }) {
  const { showToast } = useToast();
  const engineRef = useRef<GridEngine | null>(null);
  const [grid, setGrid] = useState<Tile[][]>([]);
  const [target, setTarget] = useState(12);
  const [phase, setPhase] = useState<GamePhase>('IDLE');
  const [selection, setSelection] = useState<Selection>(emptySelection());
  const [trophies, setTrophies] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [tileSize, setTileSize] = useState(64);

  // Compute tile size from viewport — no scale-up applied
  useEffect(() => {
    function compute() {
      const availH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN * 2 - 32;
      const availW = window.innerWidth - SAFE_MARGIN * 2 - 16;
      setTileSize(Math.min(Math.floor(availH / ROWS), Math.floor(availW / COLS), 80));
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  function startRound(engine: GridEngine, t: number) {
    engine.startRound(t, ROWS, COLS, [2, 3, 4, 5, 6]);
    setGrid(buildGrid(engine.getInitialGrid(ROWS, COLS), ROWS, COLS));
    setTarget(t);
    setSelection(emptySelection());
    setPhase('IDLE');
  }

  useEffect(() => {
    const engine = new GridEngine();
    engine.startPractice(new PracticeProfile([2, 3, 4, 5, 6], 2, 12));
    engineRef.current = engine;
    startRound(engine, engine.nextTarget());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function checkStalemate(g: Tile[][], t: number) {
    if (countValidPairs(g, t) <= STALEMATE_VALID_THRESHOLD && countBombs(g) === 0) {
      setPhase('STALEMATE');
    }
  }

  const handleTilePress = useCallback((pos: GridPos) => {
    if (phase !== 'IDLE' && phase !== 'SELECTING') return;

    const newSel = selectTile(selection, pos, grid);
    if (!isPairComplete(newSel)) {
      setSelection(newSel);
      setPhase('SELECTING');
      return;
    }

    const a = grid[newSel.first!.r][newSel.first!.c];
    const b = grid[newSel.second!.r][newSel.second!.c];
    const isBombPair = a.kind === 'bomb' || b.kind === 'bomb';
    const valid = isBombPair
      ? (a.kind === 'bomb' ? b : a).val > 0
      : a.val * b.val === target;

    if (valid) {
      setPhase('CLEARING');
      const positions = [newSel.first!, newSel.second!];

      setTimeout(() => {
        const fallen = applyGravity(removeTiles(grid, positions));
        setScore(s => s + 10 + (isBombPair ? 5 : 0));
        setSelection(emptySelection());

        const engine = engineRef.current!;
        const next = fallen.map(row => row.map(t => ({ ...t })));
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (next[r][c].kind === 'blank')
              next[r][c] = engineTileToTile(engine.getRefillTile());

        setGrid(next);
        setTimeout(() => { checkStalemate(next, target); setPhase('IDLE'); }, 100);
      }, 200);
    } else {
      showToast(`${a.val} × ${b.val} ≠ ${target}`);
      setSelection(emptySelection());
      setPhase('IDLE');
    }
  }, [grid, selection, phase, target, showToast]);

  function handleNext() {
    const engine = engineRef.current!;
    if (round >= ROUNDS_PER_SESSION) { setPhase('FINAL'); return; }
    const t = engine.nextTarget();
    setRound(r => r + 1);
    startRound(engine, t);
  }

  function handleRestart() {
    const engine = new GridEngine();
    engine.startPractice(new PracticeProfile([2, 3, 4, 5, 6], 2, 12));
    engineRef.current = engine;
    setTrophies(0);
    setScore(0);
    setRound(1);
    startRound(engine, engine.nextTarget());
  }

  const isResultVisible = phase === 'ROUND_OVER' || phase === 'STALEMATE' || phase === 'FINAL';

  return (
    <div className="game-ui min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <HUDTopBar
        left={
          <button onClick={onBack} className="text-gray-500 text-sm font-medium active:opacity-60">
            ← Back
          </button>
        }
        center={
          <span className="text-indigo-700">
            Target: <strong className="text-2xl">{target}</strong>
          </span>
        }
        right={<span className="text-yellow-600 font-bold">🏆 {trophies}</span>}
      />

      <div
        className="flex flex-col items-center justify-center"
        style={{ paddingTop: HUD_TOP_H + SAFE_MARGIN, paddingBottom: HUD_BOT_H + SAFE_MARGIN }}
      >
        <div className="mb-2 text-xs text-gray-400">
          Round {round} / {ROUNDS_PER_SESSION} · Score {score}
        </div>
        {grid.length > 0 && (
          <Board
            grid={grid}
            selection={selection}
            tileSize={tileSize}
            onTilePress={handleTilePress}
          />
        )}
      </div>

      <HUDBottomBar>
        <HUDIconBtn onClick={() => setPhase('STALEMATE')} label="Give Up">🏳️</HUDIconBtn>
        <HUDIconBtn
          onClick={handleNext}
          label="Skip"
          disabled={round >= ROUNDS_PER_SESSION && phase !== 'FINAL'}
        >
          ⏭️
        </HUDIconBtn>
      </HUDBottomBar>

      {isResultVisible && (
        <ResultScreen
          phase={phase}
          trophies={trophies}
          score={score}
          round={round}
          target={target}
          onNext={handleNext}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: Root export — wraps the game in its required providers
// ─────────────────────────────────────────────────────────────────────────────

export default function CombineGridStandalone({ onBack }: { onBack?: () => void }) {
  return (
    <ToastProvider>
      <CombineGridApp onBack={onBack} />
    </ToastProvider>
  );
}
