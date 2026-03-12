export type TileKind = 'number' | 'bomb' | 'trophy' | 'blank' | 'stone';

export type Tile = {
  id: string;
  kind: TileKind;
  val: number;
};

export type GridPos = { r: number; c: number };

export type GamePhase =
  | 'IDLE'
  | 'SELECTING'
  | 'CLEARING'
  | 'ROUND_OVER'
  | 'STALEMATE'
  | 'FINAL';

export type CombineMode = 'sum' | 'multiply';
