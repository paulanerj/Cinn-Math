export type GridPos = { row: number; col: number };

export type GamePhase =
  | 'SELECTING'
  | 'CLEARING'
  | 'ROUND_OVER'
  | 'STALEMATE'
  | 'FINAL';
