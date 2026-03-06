
import React, { useEffect, useState } from 'react';
import { FX_TIMING } from '../fx/fxConfig';
import { SoundEngine } from '../services/SoundEngine';

interface FlyoutPillProps {
  text: string;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  onComplete: () => void;
}

const FlyoutPill: React.FC<FlyoutPillProps> = ({ text, startPos, endPos, onComplete }) => {
  const [phase, setPhase] = useState<'start' | 'peak' | 'end'>('start');

  useEffect(() => {
    const peakTimer = setTimeout(() => {
      setPhase('peak');
      // Subtle sparkle sound when it hits the center
      SoundEngine.playMergeTrophy();
    }, FX_TIMING.FLY_IN_MS);
    
    const endTimer = setTimeout(() => setPhase('end'), FX_TIMING.FLY_IN_MS + FX_TIMING.PEAK_HOLD_MS);
    const cleanupTimer = setTimeout(onComplete, FX_TIMING.FLY_IN_MS + FX_TIMING.PEAK_HOLD_MS + FX_TIMING.FLY_OUT_MS);

    return () => {
      clearTimeout(peakTimer);
      clearTimeout(endTimer);
      clearTimeout(cleanupTimer);
    };
  }, [onComplete]);

  // Center Screen for Peak
  const peakPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  let currentPos = startPos;
  let scale = 1;
  let opacity = 0.8;

  if (phase === 'peak') {
    currentPos = peakPos;
    scale = 1.35;
    opacity = 1.0;
  } else if (phase === 'end') {
    currentPos = endPos;
    scale = 0.1;
    opacity = 0.2;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    top: 0,
    transform: `translate(${currentPos.x}px, ${currentPos.y}px) translate(-50%, -50%) scale(${scale})`,
    opacity,
    transition: phase === 'peak' 
      ? `transform ${FX_TIMING.FLY_IN_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${FX_TIMING.FLY_IN_MS}ms ease`
      : phase === 'end'
      ? `transform ${FX_TIMING.FLY_OUT_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${FX_TIMING.FLY_OUT_MS}ms ease`
      : 'none',
    zIndex: 10000,
    pointerEvents: 'none',
  };

  const parts = text.split('=');
  const lhs = parts[0]?.trim() ?? '';
  const rhs = parts[1]?.trim() ?? '';

  return (
    <div style={style} className="flex flex-col items-center">
      <div className="bg-white text-black px-6 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-b-4 border-zinc-300 flex items-center gap-3">
        <span className="text-zinc-500 font-bold text-lg">{lhs}</span>
        <span className="text-black font-black text-xl">=</span>
        <span className="text-orange-600 font-black text-2xl">{rhs}</span>
        {phase === 'peak' && (
          <div className="absolute -top-4 -right-4 animate-bounce">
            <span className="text-2xl">✨</span>
          </div>
        )}
      </div>
      {phase === 'peak' && (
        <div className="mt-4 text-white font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
          Trophy Earned
        </div>
      )}
    </div>
  );
};

export default FlyoutPill;
