import React from 'react';
import { Tile as TileType } from '../types';
import { BASE_RADIUS_PX, PAD } from '../uiTokens';

interface TileProps {
  tile: TileType;
  size: number;
  selected: boolean;
  clearing: boolean;
  onPress: () => void;
}

/** CombineGrid tile identity: orange-red-amber spectrum (values 1–9). */
function tileBackground(val: number): string {
  if (val <= 2) return '#7c2d12';
  if (val <= 4) return '#9a3412';
  if (val <= 6) return '#c2410c';
  if (val <= 8) return '#ea580c';
  return '#f97316';
}

const BASE_SHADOW =
  '0 2px 0 rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18)';
const SEL_SHADOW =
  '0 0 0 3px rgba(255,180,0,0.85), 0 4px 16px rgba(255,120,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)';

export default function Tile({ tile, size, selected, clearing, onPress }: TileProps) {
  const fontSize = size * 0.42;
  const radius = Math.min(BASE_RADIUS_PX, size * 0.28);

  return (
    <button
      onClick={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize,
        padding: PAD,
        border: selected
          ? '2px solid rgba(255,200,60,0.90)'
          : '2px solid rgba(0,0,0,0.18)',
        background: tileBackground(tile.val),
        boxShadow: selected ? SEL_SHADOW : BASE_SHADOW,
        color: '#ffffff',
        fontWeight: 900,
        opacity: clearing ? 0 : 1,
        transition: 'opacity 0.25s ease, transform 0.10s ease, box-shadow 0.10s ease',
        transform: selected ? 'scale(1.07)' : 'scale(1)',
        cursor: 'pointer',
        userSelect: 'none',
        flexShrink: 0,
      }}
      className="flex items-center justify-center select-none"
    >
      {tile.val}
    </button>
  );
}
