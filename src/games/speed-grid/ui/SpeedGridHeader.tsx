import React from 'react';
import { HUDTopBar } from '../../../platform/ui/HUDShell';

interface SpeedGridHeaderProps {
  target: number;
  score: number;
  onBack?: () => void;
}

export default function SpeedGridHeader({ target, score, onBack }: SpeedGridHeaderProps) {
  return (
    <HUDTopBar
      left={
        onBack ? (
          <button onClick={onBack} className="text-gray-500 text-sm font-medium active:opacity-60">
            ← Back
          </button>
        ) : undefined
      }
      center={
        <span className="text-indigo-700">
          Target: <strong className="text-2xl">{target}</strong>
        </span>
      }
      right={
        <span className="text-gray-700 font-bold">⭐ {score}</span>
      }
    />
  );
}
