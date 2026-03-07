import { GridPos } from '../../../systems/input/ChainSelector';

export type SpeedTile = {
  id: string;
  val: number;
  kind: 'number' | 'blank';
};

export type SpeedGridState = {
  grid: SpeedTile[][];
  target: number;
  chain: GridPos[];
  chainActive: boolean;
  score: number;
  timeLeftMs: number;
  phase: 'PLAYING' | 'PAUSED' | 'GAME_OVER';
  hits: number;
  misses: number;
};
