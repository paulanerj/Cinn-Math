
import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { FxType, ParticleDef } from '../fx/fxTypes';
import { BURST_PRESETS } from '../fx/fxPresets';
import { FxRunner } from '../fx/fxRunner';

export interface ParticleHandle {
  /**
   * Triggers a visual effect at the specified coordinates.
   * @param type The type of effect to trigger (TILE, BOMB, ZAP)
   * @param x X coordinate
   * @param y Y coordinate
   * @param color Base color for the effect
   * @param baseSize Size reference (usually tile size)
   */
  trigger: (type: FxType, x: number, y: number, color: string, baseSize: number) => void;
  
  // Legacy support for older calls if any remain (can be mapped to trigger)
  spawnBurst: (x: number, y: number, color: string, baseSize: number, type?: string) => void;
}

const ParticleLayer = forwardRef<ParticleHandle, {}>(({}, ref) => {
  const [particles, setParticles] = useState<ParticleDef[]>([]);
  const frameRef = useRef<number>(0);

  const trigger = useCallback((type: FxType, x: number, y: number, color: string, baseSize: number) => {
    const config = BURST_PRESETS[type];
    if (!config) return;

    const newParticles = FxRunner.createBurst(x, y, baseSize, color, config);
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Backwards compatibility wrapper for spawnBurst
  const spawnBurst = useCallback((x: number, y: number, color: string, baseSize: number, typeString: string = 'tile') => {
    let type = FxType.TILE;
    if (typeString === 'bomb') type = FxType.BOMB;
    if (typeString === 'zap') type = FxType.ZAP;
    
    trigger(type, x, y, color, baseSize);
  }, [trigger]);

  useImperativeHandle(ref, () => ({
    trigger,
    spawnBurst,
    // Deprecated alias
    spawn: (x, y, color, baseSize) => spawnBurst(x, y, color, baseSize, 'tile') 
  }));

  useEffect(() => {
    const loop = () => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.5, // Gravity is approximated here per frame or could be in config if passed through
            life: p.life - 0.04 // Could also look up decay from config if attached to particle
          }))
          .filter(p => p.life > 0)
      );

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: p.life,
            transform: `translate(${p.x}px, ${p.y}px)`,
            filter: p.color === '#ffffff' ? 'blur(1px) brightness(2)' : 'none'
          }}
        />
      ))}
    </div>
  );
});

export default ParticleLayer;
