export type TileKind = 'number' | 'bomb' | 'trophy' | 'blank' | 'stone';

export type Tile = {
  id: string;
  kind: TileKind;
  val: number;
  selected?: boolean;
  clearing?: boolean;
  falling?: boolean;
};

export type GridPos = { r: number; c: number };

export type SelectionPair = [GridPos, GridPos] | null;

export type GamePhase =
  | 'IDLE'
  | 'SELECTING'
  | 'CLEARING'
  | 'FALLING'
  | 'REFILLING'
  | 'ROUND_OVER'
  | 'STALEMATE'
  | 'FINAL';

export type RoundResult = {
  trophies: number;
  rounds: number;
  score: number;
};
