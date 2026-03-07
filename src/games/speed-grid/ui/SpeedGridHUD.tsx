import React from 'react';
import { HUDBottomBar } from '../../../platform/ui/HUDShell';

interface SpeedGridHUDProps {
  timeLeftMs: number;
  hits: number;
  chainLength: number;
  chainValue: number;
  target: number;
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function SpeedGridHUD({ timeLeftMs, hits, chainLength, chainValue, target }: SpeedGridHUDProps) {
  const isClose = timeLeftMs < 15_000;
  const chainMatch = chainLength > 0 && chainValue === target;

  return (
    <HUDBottomBar>
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
    </HUDBottomBar>
  );
}
