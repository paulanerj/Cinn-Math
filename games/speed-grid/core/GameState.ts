
// games/speed-grid/core/GameState.ts
import { GridCell } from '../gravity/GravitySystem';

export type GamePhase =
  | 'LOADING'
  | 'READY'
  | 'SELECTING'
  | 'SOLVING'
  | 'GRAVITY'
  | 'REFILL'
  | 'GAMEOVER';

export interface GameState {
  grid: GridCell[][];
  target: number;
  score: number;
  timeLeft: number;
  operator: 'addition' | 'multiplication';
  solutionPath: { r: number; c: number }[];
  phase: GamePhase;
}
