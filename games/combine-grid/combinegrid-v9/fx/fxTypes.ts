
export enum FxType {
  TILE = 'TILE',
  BOMB = 'BOMB',
  ZAP = 'ZAP'
}

export interface ParticleDef {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface BurstConfig {
  count: number;
  sizeRatio: number; // fraction of baseSize
  vxMult: number;
  vyMult: number;
  vyOffset: number;
  gravity: number;
  decay: number;
  color?: string; // Optional override
}
