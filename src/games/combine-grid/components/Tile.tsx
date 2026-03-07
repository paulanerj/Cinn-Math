import React from 'react';
import { Tile as TileType } from '../types';
import { BASE_RADIUS_PX, PAD } from '../uiTokens';

interface TileProps {
  tile: TileType;
  size: number;
  selected?: boolean;
  onPress?: () => void;
}

function tileColour(tile: TileType): string {
  if (tile.kind === 'blank') return 'bg-gray-100';
  if (tile.kind === 'bomb')  return 'bg-red-500 text-white';
  if (tile.kind === 'trophy') return 'bg-yellow-400 text-yellow-900';
  if (tile.kind === 'stone') return 'bg-gray-400 text-gray-200';
  // number
  const v = tile.val;
  if (v === 0) return 'bg-slate-200 text-slate-500';
  if (v === 1) return 'bg-blue-100 text-blue-700';
  if (v <= 3)  return 'bg-green-200 text-green-900';
  if (v <= 6)  return 'bg-lime-200 text-lime-900';
  if (v <= 9)  return 'bg-amber-200 text-amber-900';
  return 'bg-orange-300 text-orange-900';
}

function tileLabel(tile: TileType): string {
  if (tile.kind === 'bomb')   return '💣';
  if (tile.kind === 'trophy') return '🏆';
  if (tile.kind === 'stone')  return '🪨';
  if (tile.kind === 'blank')  return '';
  return String(tile.val);
}

export default function Tile({ tile, size, selected, onPress }: TileProps) {
  const colourClass = tileColour(tile);
  const label = tileLabel(tile);

  const fontSize = size * 0.42;
  const radius = Math.min(BASE_RADIUS_PX, size * 0.28);

  return (
    <button
      onClick={onPress}
      disabled={tile.kind === 'blank' || tile.kind === 'stone'}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize,
        padding: PAD,
        border: selected ? '3px solid #6366f1' : '2px solid rgba(0,0,0,0.08)',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 0.1s, border-color 0.1s',
        boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.3)' : '0 1px 3px rgba(0,0,0,0.12)',
      }}
      className={`flex items-center justify-center font-bold select-none active:scale-95 ${colourClass}`}
    >
      {label}
    </button>
  );
}
