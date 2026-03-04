
/* ⚠ UI CONTRACT PROTECTED
 This file participates in the Combine Grid Layout Contract.
 Do not modify layout math, factor rules, tile geometry, or sizing constants
 without updating COMBINE_GRID_UI_CONTRACT.md.
 This system is intentionally deterministic. No visual changes without explicit contract revision.
*/

import React from 'react';
import { Tile as TileData, TileKind } from '../types';
import { COLORS } from '../constants';
import {
  BASE_RADIUS_PX,
  FACTOR_WARM_OUTLINE,
  FACTOR_WARM_GLOW,
  FACTOR_ONE_OUTLINE,
  FACTOR_ONE_GLOW,
} from '../uiTokens';
import {
  TILE_BASE_SHADOW,
  TILE_SOFT_SHADOW,
  TILE_DRAG_SCALE,
  TILE_DRAG_SHADOW,
  TILE_ZAP_SHADOW,
  TILE_SPECULAR_CLASSES,
  tileTypography,
} from '@/src/platform/ui/tileStyles';
import { ANIM_FAST, ANIM_INTERACT } from '@/src/platform/ui/animTokens';

interface TileProps {
  tile: TileData & { isIgniting?: boolean };
  tileSize: number;
  x: number;
  y: number;
  isDragging?:       boolean;
  isZapTarget?:      boolean;
  isHighlighted?:    boolean;
  isTrayOp?:         boolean;
  lockedRadiusPx?:   number;
  isFactorOfTarget?: boolean;
}

// ── Bomb icon (CombineGrid-specific) ──────────────────────────────────────────
const BombIcon: React.FC<{ size: number }> = ({ size }) => {
  const s = Math.max(22, Math.floor(size * 0.9));
  return (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M44 12c6-2 11 1 12 7" stroke="#0b0b0c" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M59 8l-3 2 3 2-3 2 3 2" stroke="#0b0b0c" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="28" cy="36" r="18" fill="#0b0b0c" />
      <path d="M18 30c2-6 8-10 14-10" stroke="rgba(255,255,255,0.12)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="33" y="18" width="14" height="8" rx="4" fill="#0b0b0c" />
    </svg>
  );
};

// ── Visual derivation (pure, no side-effects) ─────────────────────────────────
// Uses TILE_BASE_SHADOW / TILE_SOFT_SHADOW from shared tileStyles.ts.
// Stone baseShadow is CombineGrid-specific (inset texture shadow).
function getVisuals(tile: TileData): {
  bg: string; text: string; textShadow: string; baseShadow: string;
} {
  if (tile.kind === TileKind.NUMBER) {
    // Zero — warmer white, inner ring, no text shadow
    if (tile.val === 0) return {
      bg:         '#fffbf5',
      text:       '#000000',
      textShadow: 'none',
      baseShadow: `inset 0 0 0 2px rgba(0,0,0,0.10), ${TILE_SOFT_SHADOW}`,
    };
    // One — pale sky blue, inner outline, no text shadow
    if (tile.val === 1) return {
      bg:         '#e0f2fe',
      text:       '#0369a1',
      textShadow: 'none',
      baseShadow: `inset 0 0 0 1.5px rgba(3,105,161,0.20), ${TILE_SOFT_SHADOW}`,
    };
    // Colorful number tiles — value-indexed palette, subtle text shadow
    const idx = Math.min(COLORS.values.length - 1, Math.max(0, tile.val - 1));
    return {
      bg:         COLORS.values[idx],
      text:       '#ffffff',
      textShadow: '0 1px 2px rgba(0,0,0,0.25)',
      baseShadow: TILE_BASE_SHADOW,
    };
  }
  if (tile.kind === TileKind.TROPHY) return {
    bg:         '#fdf8f5',
    text:       '#d97706',
    textShadow: 'none',
    baseShadow: TILE_SOFT_SHADOW,
  };
  if (tile.kind === TileKind.BOMB) return {
    bg:         '#ef4444',
    text:       '#0b0b0c',
    textShadow: 'none',
    baseShadow: TILE_BASE_SHADOW,
  };
  if (tile.kind === TileKind.STONE) return {
    bg:         'linear-gradient(145deg, #3f3f46, #71717a)',
    text:       '#e4e4e7',
    textShadow: 'none',
    baseShadow: 'inset 0 2px 4px rgba(0,0,0,0.40), 0 2px 0 rgba(0,0,0,0.20)',
  };
  // OP, BLANK, fallback
  return {
    bg:         COLORS.kinds[tile.kind] || '#333',
    text:       '#ffffff',
    textShadow: 'none',
    baseShadow: 'none',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
const Tile: React.FC<TileProps> = ({
  tile, tileSize, x, y,
  isDragging, isZapTarget, isHighlighted,
  isTrayOp, lockedRadiusPx, isFactorOfTarget,
}) => {
  const { bg, text, textShadow, baseShadow } = getVisuals(tile);

  // Drag scale and transitions from shared tokens (TILE_DRAG_SCALE = 1.18, ANIM_INTERACT = 150ms)
  const scale    = isDragging ? TILE_DRAG_SCALE : 1;
  const isTrophy = tile.kind === TileKind.TROPHY;
  const isStone  = tile.kind === TileKind.STONE;
  const zapping  = isZapTarget || (tile as any).isZapping;
  const isBomb   = tile.kind === TileKind.BOMB;
  // Factor glow only visible in resting state; zero is explicitly excluded
  const isFactor     = isFactorOfTarget && tile.val !== 0 && !zapping && !isDragging;
  const isOneFactor  = isFactor && tile.val === 1;
  const isWarmFactor = isFactor && tile.val !== 1;

  const radius = lockedRadiusPx !== undefined ? `${lockedRadiusPx}px` : `${BASE_RADIUS_PX}px`;

  // ── Shadow composition ─────────────────────────────────────────────────────
  // Priority: zap > drag > trayOp > factor-one > factor-warm > base
  // Shared tokens handle zap, drag. Factor ring/glow from uiTokens (CombineGrid-specific).
  const boxShadow =
    zapping        ? TILE_ZAP_SHADOW
    : isDragging   ? TILE_DRAG_SHADOW
    : isTrayOp     ? 'none'
    : isOneFactor  ? `0 0 0 3px ${FACTOR_ONE_OUTLINE}, 0 0 16px ${FACTOR_ONE_GLOW}, 0 4px 0 rgba(0,0,0,0.32)`
    : isWarmFactor ? `0 0 0 3px ${FACTOR_WARM_OUTLINE}, 0 0 16px ${FACTOR_WARM_GLOW}, 0 4px 0 rgba(0,0,0,0.32)`
    : baseShadow;

  return (
    <div
      data-tile-id={tile.id}
      className={`absolute select-none touch-none transition-transform ${isDragging ? 'z-[1000]' : 'z-10'} ${isHighlighted ? 'z-[100]' : ''}`}
      style={{
        width: tileSize,
        height: tileSize,
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        transitionDuration: `${ANIM_INTERACT}ms`,
      }}
    >
      <div
        className={`w-full h-full flex flex-col items-center justify-center border relative overflow-hidden transition-all ${zapping ? 'ring-4 ring-cyan-400 z-50' : ''} ${isHighlighted ? 'ring-4 ring-white' : ''} ${isStone ? 'opacity-90' : ''} ${isWarmFactor ? 'factor-glow' : ''} ${isOneFactor ? 'factor-glow-one' : ''}`}
        style={{
          background:         bg,
          color:              text,
          borderRadius:       radius,
          ...tileTypography(tileSize),
          boxShadow,
          animation:          zapping ? 'zap-jitter 0.08s infinite, zap-flash 0.3s infinite' : undefined,
          borderWidth:        isStone ? '2px' : '1px',
          borderColor:        isStone ? '#18181b' : 'rgba(0,0,0,0.12)',
          transitionDuration: `${ANIM_FAST}ms`,
        }}
      >
        {isTrophy && <span className="absolute top-1 text-[10px] text-amber-500/50">★</span>}
        {isStone  && <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 6px)', backgroundSize: '6px 6px' }} />}

        {isBomb ? (
          <div className="relative z-10 flex flex-col items-center justify-center">
            <BombIcon size={tileSize} />
            {tile.isIgniting && (
              <div className="absolute -top-1 right-2">
                <span className="block w-2.5 h-2.5 rounded-full" style={{
                  background: '#ffd166',
                  boxShadow:  '0 0 12px rgba(255,209,102,0.95), 0 0 26px rgba(255,209,102,0.65)',
                  animation:  'bomb-spark 0.14s infinite alternate',
                }} />
              </div>
            )}
          </div>
        ) : (
          <span
            className={`relative z-10 transition-transform ${zapping ? 'scale-125' : ''} ${isStone ? 'opacity-60 grayscale' : ''}`}
            style={{ textShadow }}
          >
            {tile.kind === TileKind.OP ? (tile as any).op : tile.val}
          </span>
        )}

        {/* Specular highlight overlay — shared TILE_SPECULAR_CLASSES from tileStyles.ts */}
        <div className={TILE_SPECULAR_CLASSES} />

        {isBomb && tile.isIgniting && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(circle at 75% 15%, rgba(255,210,120,0.45), transparent 45%), radial-gradient(circle at 70% 18%, rgba(255,120,80,0.35), transparent 55%)',
            animation:  'bomb-heat 0.35s infinite alternate',
          }} />
        )}
      </div>

    </div>
  );
};

export default Tile;
