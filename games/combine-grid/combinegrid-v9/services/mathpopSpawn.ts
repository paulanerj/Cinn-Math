
import { TileKind } from '../types';
import { distributionController } from './DistributionController';

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

  const decision = distributionController.getSpawnValue();

  return {
    kind: decision.kind,
    val: decision.val,
    desc: decision.reason,
    consumedBombToken: false
  };
}
