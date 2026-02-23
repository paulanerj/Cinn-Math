
import { TileKind } from '../types';
import { PlatformEngineAdapter } from './PlatformEngineAdapter';

interface RefillContext {
  r: number;
  c: number;
  target: number;
  practiceSet?: number[];
  pendingBombRefillCell: { r: number; c: number } | null;
}

export function getRefillTileForCell(ctx: RefillContext) {
  const isMilestone = ctx.pendingBombRefillCell && 
                     ctx.pendingBombRefillCell.r === ctx.r && 
                     ctx.pendingBombRefillCell.c === ctx.c;

  if (isMilestone) {
    return {
      kind: TileKind.BOMB,
      val: 0,
      desc: 'Milestone Bomb Spawned',
      consumedBombToken: true
    };
  }

  // Use Platform Engine for all spawn logic
  const engineTile = PlatformEngineAdapter.getRefillTile();

  // Map Engine types to Game types
  let gameKind = TileKind.NUMBER;
  switch (engineTile.kind) {
    case 'bomb': gameKind = TileKind.BOMB; break;
    case 'trophy': gameKind = TileKind.TROPHY; break;
    case 'op': gameKind = TileKind.OP; break;
    case 'blank': gameKind = TileKind.BLANK; break;
    case 'stone': gameKind = TileKind.STONE; break;
    default: gameKind = TileKind.NUMBER;
  }

  return {
    kind: gameKind,
    val: engineTile.val,
    desc: engineTile.reason || 'Refill',
    consumedBombToken: false
  };
}
