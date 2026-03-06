
import { FxType, BurstConfig } from './fxTypes';
import { FX_PHYSICS } from './fxConfig';

export const BURST_PRESETS: Record<FxType, BurstConfig> = {
  [FxType.TILE]: {
    count: 14, // mini burst
    sizeRatio: 6.2,
    vxMult: 9,
    vyMult: 12,
    vyOffset: 6,
    gravity: 0.5,
    decay: FX_PHYSICS.PARTICLE_DECAY
  },
  [FxType.BOMB]: {
    count: 44, // big burst
    sizeRatio: 5.4,
    vxMult: 22,
    vyMult: 22,
    vyOffset: 6,
    gravity: 0.55,
    decay: FX_PHYSICS.PARTICLE_DECAY
  },
  [FxType.ZAP]: {
    count: 32,
    sizeRatio: 6,
    vxMult: 24,
    vyMult: 24,
    vyOffset: 6,
    gravity: 0.45,
    decay: FX_PHYSICS.PARTICLE_DECAY
  }
};
