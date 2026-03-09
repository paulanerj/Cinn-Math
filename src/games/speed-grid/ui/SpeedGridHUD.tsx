import React from 'react';
import { HUDBottomBar } from '../../../platform/ui/HUDShell';

interface SpeedGridHUDProps {
  timeLeftMs: number;
  hits: number;
  chainLength: number;
  chainValue: number;
  target: number;
  onRestart?: () => void;
  onBack?: () => void;
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function SpeedGridHUD({ timeLeftMs, hits, chainLength, chainValue, target, onRestart, onBack }: SpeedGridHUDProps) {
  const isClose = timeLeftMs < 15_000;
  const chainMatch = chainLength > 0 && chainValue === target;

  return (
    <HUDBottomBar>
      {onBack && (
        <button onClick={onBack} className="flex flex-col items-center gap-0.5 text-xs text-gray-500 active:opacity-60">
          <span className="text-xl leading-none">←</span>
          <span>Back</span>
        </button>
      )}
      <div className={`text-lg font-black ${isClose ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
        ⏱ {formatTime(timeLeftMs)}
      </div>
      <div className="text-gray-600 text-sm font-semibold">
        Hits: <strong>{hits}</strong>
      </div>
      {chainLength > 0 && (
        <div className={`text-sm font-bold ${chainMatch ? 'text-green-600' : 'text-indigo-500'}`}>
          Chain: {chainValue} {chainMatch ? '✓' : ''}
        </div>
      )}
      {onRestart && (
        <button onClick={onRestart} className="flex flex-col items-center gap-0.5 text-xs text-gray-500 active:opacity-60">
          <span className="text-xl leading-none">↺</span>
          <span>Restart</span>
        </button>
      )}
    </HUDBottomBar>
  );
}
