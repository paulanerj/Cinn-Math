import React from 'react';
import { Tile as TileType } from '../types';
import { BASE_RADIUS_PX } from '../uiTokens';
import {
  TILE_BASE_SHADOW,
  TILE_ZAP_SHADOW,
  TILE_DRAG_SHADOW,
} from '../../../platform/ui/tileStyles';

interface TileProps {
  tile: TileType;
  size: number;
  selected: boolean;
  selectionOrder: number; // 0-based index in selection, -1 if not selected
  clearing: boolean;
  isNew: boolean;
  onPress: () => void;
}

// Tile background colours keyed by value range and selection state
function tileBg(val: number, selected: boolean, clearing: boolean): string {
  if (clearing) return '#f97316'; // orange flash during clear
  if (selected) return '#ea580c'; // deep orange when selected
  if (val <= 3) return '#2a2a30';
  if (val <= 6) return '#252530';
  return '#1e1e28';
}

function tileTextColor(selected: boolean, clearing: boolean): string {
  if (clearing || selected) return '#fff';
  return '#e5e7eb';
}

export default function Tile({
  tile,
  size,
  selected,
  selectionOrder,
  clearing,
  isNew,
  onPress,
}: TileProps) {
  const fontSize = Math.round(size * 0.40);
  const radius = Math.min(BASE_RADIUS_PX, size * 0.28);
  const bg = tileBg(tile.val, selected, clearing);
  const color = tileTextColor(selected, clearing);

  const boxShadow = clearing
    ? TILE_ZAP_SHADOW
    : selected
    ? TILE_DRAG_SHADOW
    : TILE_BASE_SHADOW;

  const transform = clearing
    ? 'scale(0.85)'
    : selected
    ? 'scale(1.06)'
    : 'scale(1)';

  const opacity = clearing ? 0.4 : 1;

  const animStyle: React.CSSProperties = isNew
    ? { animation: 'tileSpawn 0.28s cubic-bezier(0.34,1.56,0.64,1) both' }
    : {};

  return (
    <button
      onClick={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize,
        background: bg,
        color,
        border: selected
          ? '2.5px solid rgba(251,146,60,0.90)'
          : '2px solid rgba(255,255,255,0.07)',
        boxShadow,
        transform,
        opacity,
        transition:
          'transform 0.12s ease, opacity 0.18s ease, background 0.12s ease, box-shadow 0.12s ease',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontFamily: 'Nunito, sans-serif',
        userSelect: 'none',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        ...animStyle,
      }}
    >
      {tile.val}
      {/* Selection order badge */}
      {selected && selectionOrder >= 0 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 4,
            fontSize: Math.max(9, Math.round(size * 0.2)),
            fontWeight: 900,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1,
          }}
        >
          {selectionOrder + 1}
        </span>
      )}
    </button>
  );
}
