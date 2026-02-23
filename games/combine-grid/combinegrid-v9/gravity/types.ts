
import { Tile } from '../types';

export type GravityMove =
  | { type: 'move'; id: string; r: number; c: number }
  | { type: 'spawn'; id: string; r: number; c: number; data: Tile };

export type GravityMetrics = {
  tileSize: number;
  gap: number;
  pad: number;
  rows: number;
  cols: number;
  getPos: (r: number, c: number) => { x: number; y: number };
  boardRect: DOMRect | null;
};

export type GravityRuntimeHooks = {
  /** Injects a tile into the visual overlay layer */
  onStartMove: (move: GravityMove, x: number, startY: number, targetY: number) => void;
  /** Updates vertical position of an overlay tile */
  updateOverlayTile: (id: string, y: number) => void;
  /** Requests current visual Y of a tile to prevent 'snapping' from origin */
  getCurrentTileLocalY: (id: string) => number | null;
  /** Signals that all bodies (Moves + Spawns) have settled */
  onComplete: () => void;
};
