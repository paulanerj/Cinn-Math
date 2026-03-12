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
          ? '2px solid rgba(255,180,0,0.80)'
          : '2px solid rgba(0,0,0,0.08)',
        opacity: clearing ? 0.4 : 1,
      }}
      className="flex items-center justify-center font-bold select-none"
    >
      {tile.val}
    </button>
  );
}
