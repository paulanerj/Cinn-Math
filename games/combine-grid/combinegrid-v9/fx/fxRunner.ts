
import { ParticleDef, BurstConfig } from './fxTypes';

export class FxRunner {
  static createBurst(
    x: number, 
    y: number, 
    baseSize: number, 
    color: string, 
    config: BurstConfig
  ): ParticleDef[] {
    const particles: ParticleDef[] = [];
    const size = baseSize / config.sizeRatio;
    
    for (let i = 0; i < config.count; i++) {
      particles.push({
        id: Math.random().toString(36).substr(2, 9),
        x: x + baseSize / 2,
        y: y + baseSize / 2,
        vx: (Math.random() - 0.5) * config.vxMult,
        vy: (Math.random() - 0.5) * config.vyMult - config.vyOffset,
        life: 1,
        color: config.color || color,
        size: size
      });
    }
    return particles;
  }
}
