import { SpeedTile, SpeedGridState } from './speedGridTypes';
import { GridPos } from '../../../systems/input/ChainSelector';

let _id = 1;
function mkId() { return `sg${_id++}`; }

export const SPEED_ROWS = 5;
export const SPEED_COLS = 5;
export const GAME_DURATION_MS = 90_000;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateGrid(): SpeedTile[][] {
  const grid: SpeedTile[][] = [];
  for (let r = 0; r < SPEED_ROWS; r++) {
    const row: SpeedTile[] = [];
    for (let c = 0; c < SPEED_COLS; c++) {
      row.push({ id: mkId(), val: randInt(1, 9), kind: 'number' });
    }
    grid.push(row);
  }
  return grid;
}

export function generateTarget(grid: SpeedTile[][]): number {
  // Pick two random adjacent tiles and multiply
  const r1 = randInt(0, SPEED_ROWS - 1);
  const c1 = randInt(0, SPEED_COLS - 1);
  const r2 = Math.min(SPEED_ROWS - 1, r1 + 1);
  const c2 = Math.min(SPEED_COLS - 1, c1 + 1);
  return grid[r1][c1].val * grid[r2][c2].val;
}

export function computeChainValue(grid: SpeedTile[][], chain: GridPos[]): number {
  if (chain.length === 0) return 0;
  return chain.reduce((prod, p) => prod * grid[p.r][p.c].val, 1);
}

export function makeInitialState(): SpeedGridState {
  const grid = generateGrid();
  const target = generateTarget(grid);
  return {
    grid,
    target,
    chain: [],
    chainActive: false,
    score: 0,
    timeLeftMs: GAME_DURATION_MS,
    phase: 'PLAYING',
    hits: 0,
    misses: 0,
  };
}

export function refreshAfterHit(state: SpeedGridState): SpeedGridState {
  // Regenerate grid and target after successful hit
  const grid = generateGrid();
  const target = generateTarget(grid);
  return { ...state, grid, target, chain: [], chainActive: false };
}
