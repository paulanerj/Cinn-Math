import React, { useCallback, useEffect, useRef, useState } from 'react';
import SpeedGridHeader from './SpeedGridHeader';
import SpeedGridHUD from './SpeedGridHUD';
import { SpeedTile, SpeedGridState } from '../core/speedGridTypes';
import {
  makeInitialState,
  computeChainValue,
  refreshAfterHit,
  SPEED_ROWS,
  SPEED_COLS,
  GAME_DURATION_MS,
} from '../core/speedGridEngine';
import { ChainSelector, GridPos } from '../../../systems/input/ChainSelector';
import { HUD_TOP_H, HUD_BOT_H } from '../../../platform/ui/HUDShell';

interface Props {
  onBack?: () => void;
}

function tileColour(val: number, inChain: boolean): string {
  if (inChain) return 'bg-indigo-400 text-white border-indigo-600';
  if (val <= 3)  return 'bg-green-100 text-green-900 border-green-300';
  if (val <= 6)  return 'bg-amber-100 text-amber-900 border-amber-300';
  return 'bg-orange-200 text-orange-900 border-orange-400';
}

export default function SpeedGridGame({ onBack }: Props) {
  const [state, setState] = useState<SpeedGridState>(() => makeInitialState());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStateRef = useRef<{ active: boolean; chain: GridPos[] }>({ active: false, chain: [] });

  const [tileSize, setTileSize] = useState(56);

  useEffect(() => {
    function compute() {
      const avH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - 48;
      const avW = window.innerWidth - 24;
      const sz = Math.min(Math.floor(avH / SPEED_ROWS), Math.floor(avW / SPEED_COLS), 72);
      setTileSize(sz);
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Timer
  useEffect(() => {
    if (state.phase !== 'PLAYING') return;
    timerRef.current = setInterval(() => {
      setState(prev => {
        const next = prev.timeLeftMs - 250;
        if (next <= 0) return { ...prev, timeLeftMs: 0, phase: 'GAME_OVER' };
        return { ...prev, timeLeftMs: next };
      });
    }, 250);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.phase]);

  function posKey(p: GridPos) { return `${p.r},${p.c}`; }

  function chainHasPos(chain: GridPos[], pos: GridPos) {
    return chain.some(p => posKey(p) === posKey(pos));
  }

  const handlePointerDown = useCallback((pos: GridPos) => {
    if (state.phase !== 'PLAYING') return;
    touchStateRef.current = { active: true, chain: [pos] };
    setState(prev => ({ ...prev, chain: [pos], chainActive: true }));
  }, [state.phase]);

  const handlePointerEnter = useCallback((pos: GridPos) => {
    if (!touchStateRef.current.active || state.phase !== 'PLAYING') return;
    const cur = touchStateRef.current.chain;
    const newChain = (() => {
      const key = posKey(pos);
      const idx = cur.findIndex(p => posKey(p) === key);
      if (idx !== -1 && idx < cur.length - 1) return cur.slice(0, idx + 1);
      if (idx !== -1) return cur;
      const last = cur[cur.length - 1];
      const dr = Math.abs(last.r - pos.r);
      const dc = Math.abs(last.c - pos.c);
      if (dr <= 1 && dc <= 1) return [...cur, pos];
      return cur;
    })();
    touchStateRef.current.chain = newChain;
    setState(prev => ({ ...prev, chain: newChain }));
  }, [state.phase]);

  const handlePointerUp = useCallback(() => {
    if (!touchStateRef.current.active) return;
    touchStateRef.current.active = false;
    const chain = touchStateRef.current.chain;

    setState(prev => {
      const chainVal = computeChainValue(prev.grid, chain);
      if (chainVal === prev.target && chain.length >= 2) {
        const next = refreshAfterHit({ ...prev, hits: prev.hits + 1, score: prev.score + chain.length * 10 });
        return next;
      }
      return { ...prev, chain: [], chainActive: false, misses: prev.misses + 1 };
    });
  }, []);

  function restart() {
    setState(makeInitialState());
  }

  const chainValue = computeChainValue(state.grid, state.chain);

  if (state.phase === 'GAME_OVER') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-5 p-6">
        <span className="text-6xl">⚡</span>
        <h2 className="text-3xl font-extrabold text-indigo-700">Time's Up!</h2>
        <p className="text-xl text-gray-700">Score: <strong>{state.score}</strong></p>
        <p className="text-gray-500">Hits: {state.hits} · Misses: {state.misses}</p>
        <div className="flex gap-3 mt-4">
          <button onClick={restart} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold active:scale-95">Play Again</button>
          {onBack && <button onClick={onBack} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-2xl font-bold active:scale-95">Menu</button>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="game-ui min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 select-none"
      onPointerUp={handlePointerUp}
    >
      <SpeedGridHeader target={state.target} score={state.score} onBack={onBack} />

      <div
        className="flex items-center justify-center"
        style={{ paddingTop: HUD_TOP_H + 16, paddingBottom: HUD_BOT_H + 16 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${SPEED_COLS}, ${tileSize}px)`,
            gap: 3,
            touchAction: 'none',
          }}
        >
          {state.grid.map((row, r) =>
            row.map((tile, c) => {
              const pos = { r, c };
              const inChain = chainHasPos(state.chain, pos);
              const chainIdx = state.chain.findIndex(p => posKey(p) === posKey(pos));
              return (
                <div
                  key={tile.id}
                  onPointerDown={e => { e.preventDefault(); handlePointerDown(pos); }}
                  onPointerEnter={() => handlePointerEnter(pos)}
                  style={{ width: tileSize, height: tileSize, borderRadius: 12, cursor: 'pointer', userSelect: 'none' }}
                  className={`flex items-center justify-center font-black text-xl border-2 transition-all
                    ${tileColour(tile.val, inChain)}
                    ${inChain ? 'scale-105 shadow-md' : 'shadow-sm'}`}
                >
                  {tile.val}
                  {inChain && <span className="absolute text-xs text-white/70 top-0.5 right-1">{chainIdx + 1}</span>}
                </div>
              );
            })
          )}
        </div>
      </div>

      <SpeedGridHUD
        timeLeftMs={state.timeLeftMs}
        hits={state.hits}
        chainLength={state.chain.length}
        chainValue={chainValue}
        target={state.target}
      />
    </div>
  );
}
