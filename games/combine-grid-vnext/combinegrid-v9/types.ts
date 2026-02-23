
export enum TileKind {
  NUMBER = 'number',
  BOMB = 'bomb',
  TROPHY = 'trophy',
  OP = 'op',
  BLANK = 'blank',
  STONE = 'stone',
}

export enum Phase {
  PLAYING = 'PLAYING',
  IMPACT_TROPHY = 'IMPACT_TROPHY',
  FLYOUT_TROPHY = 'FLYOUT_TROPHY',
  DRY_WAIT = 'DRY_WAIT',
  COUNTING = 'COUNTING',
  RESULTS = 'RESULTS',
}

export enum EngineMode {
  MULTIPLY = 'MULTIPLY',
  BOMB = 'BOMB',
  SWAP = 'SWAP',
  COMBINE = 'COMBINE',
  REPLACE = 'REPLACE',
}

export enum AdjacencyMode {
  ORTHOGONAL = 'ORTHOGONAL',
  DIAGONAL = 'DIAGONAL',
  ALL_8 = 'ALL_8',
}

export enum TargetSource {
  RECIPE = 'RECIPE',
  PRACTICE = 'PRACTICE',
  FREE_PLAY = 'FREE_PLAY',
}

export interface PracticeProfile {
  multipliers: number[];
  coMultiplierRange: [number, number];
  excludeTrivial: boolean;
  scheduler: string;
}

export interface TargetDef {
  val: number;
  derivation: string;
  source: TargetSource;
}

export type OpType = '+' | '-' | '×' | '÷' | '=';

export interface Tile {
  id: string;
  r: number;
  c: number;
  kind: TileKind;
  val: number;
  op: OpType | null;
  fixed: boolean;
  lineage?: string; // e.g. "2 × 3 × 2"

  isDead?: boolean;
  isZapping?: boolean;
  isIgniting?: boolean;
}

export interface GameEvent {
  type:
    | 'MERGE_STANDARD'
    | 'MERGE_TROPHY'
    | 'MERGE_STONE'
    | 'ZAP_TRIGGER'
    | 'ZAP_RESOLVE'
    | 'BOMB_SPAWNED'
    | 'BOMB_EXPLODED'
    | 'BOMB_MILESTONE'
    | 'BOMB_IGNITE'
    | 'BOMB_DETONATE'
    | 'BOMB_POP'
    | 'SPAWN_TILE'
    | 'UNDO_APPLIED'
    | 'CHECK_OVEN'
    | 'ROUND_END'
    | 'INIT'
    | 'SWAP_SUCCESS'
    | 'SNAPBACK'
    | 'BOMB_MILESTONE' // Added to match usage
    | 'BOMB_SPAWNED'; // Added to match usage

  description: string;
  matrix: string;
  actionId: string;

  equation?: string;
  lineage?: string;
  sourceId?: string;
  targetId?: string;
  trophiesRemoved?: number;

  sourceCell?: { r: number; c: number };
  spawnKind?: TileKind;

  timestamp?: number;
  // Added result to track numerical outcome of operations for logging and audit trails
  result?: number;
}
