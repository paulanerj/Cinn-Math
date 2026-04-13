// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/components/Tile.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// Visual identity — "physical tabletop puzzle made of polished matte stone
// and ceramic pieces with premium mobile-game charm."
//
// Material language:
//   • Soft matte-polished stone / ceramic surface
//   • Gentle marbling (layered radial gradients baked into each color family)
//   • Numbers look carved / inset — warm ivory with subtle depth shadow
//   • Special tiles (trophy, frozen, zero, bomb) have distinct identities
//
// [PURITY] Pure presentational component. No dispatch, no PRNG.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { BASE_RADIUS_PX, PAD } from '../uiTokens';
import { ZERO_TILE_VALUE, BOMB_TILE_VALUE } from '../constants';

// ── Tile color families ───────────────────────────────────────────────────────

interface ColorFamily {
  base: string;   // darkest tone (bottom gradient)
  mid: string;    // middle tone
  top: string;    // lightest tone (top specular)
  marble: string; // marble vein highlight tint
}

const COLOR_FAMILIES: Record<number, ColorFamily> = {
  1:  { base: '#C45070', mid: '#D9607F', top: '#EE809A', marble: 'rgba(255,180,200,0.18)' }, // coral/pink
  2:  { base: '#4A9490', mid: '#5AABA6', top: '#72C2BC', marble: 'rgba(180,240,235,0.18)' }, // teal
  3:  { base: '#4E7EC0', mid: '#6090D0', top: '#7AACE0', marble: 'rgba(180,210,255,0.18)' }, // blue
  4:  { base: '#8A60B0', mid: '#9F78C8', top: '#B898DC', marble: 'rgba(220,195,255,0.18)' }, // lavender
  5:  { base: '#B89030', mid: '#CEAA40', top: '#E4C458', marble: 'rgba(255,240,170,0.18)' }, // warm yellow
  6:  { base: '#50924A', mid: '#62A85A', top: '#7CC070', marble: 'rgba(190,240,185,0.18)' }, // green
  7:  { base: '#C07040', mid: '#D4895A', top: '#E8A878', marble: 'rgba(255,215,180,0.18)' }, // peach
  8:  { base: '#A04070', mid: '#B85888', top: '#D07CA2', marble: 'rgba(255,190,215,0.18)' }, // rose
  9:  { base: '#B84030', mid: '#D05545', top: '#E87060', marble: 'rgba(255,185,170,0.18)' }, // deep red
};

function getFamily(val: number): ColorFamily {
  return COLOR_FAMILIES[Math.min(Math.max(val, 1), 9)] ?? COLOR_FAMILIES[9]!;
}

// ── Background builders ───────────────────────────────────────────────────────

/**
 * Builds the CSS background string for a tile.
 * Marble effect = two radial "cloud" highlights layered over a linear gradient.
 */
export function tileBackground(val: number, isTrophy: boolean, isFrozen?: boolean): string {
  if (isTrophy) {
    return [
      'radial-gradient(ellipse at 22% 18%, rgba(255,252,200,0.45) 0%, transparent 42%)',
      'radial-gradient(ellipse at 72% 78%, rgba(180,100,0,0.25) 0%, transparent 38%)',
      'linear-gradient(148deg, #F6D040 0%, #D4A020 38%, #B07800 100%)',
    ].join(', ');
  }
  if (isFrozen) {
    return [
      'radial-gradient(ellipse at 22% 18%, rgba(210,230,250,0.35) 0%, transparent 42%)',
      'radial-gradient(ellipse at 68% 75%, rgba(70,90,110,0.20) 0%, transparent 38%)',
      'linear-gradient(148deg, #8DAABB 0%, #6A8898 42%, #506070 100%)',
    ].join(', ');
  }
  if (val === ZERO_TILE_VALUE) {
    return [
      'radial-gradient(ellipse at 25% 20%, rgba(255,255,250,0.40) 0%, transparent 44%)',
      'radial-gradient(ellipse at 68% 72%, rgba(180,165,150,0.18) 0%, transparent 38%)',
      'linear-gradient(148deg, #EDE4D5 0%, #D8CDBC 42%, #C4B8A8 100%)',
    ].join(', ');
  }
  if (val === BOMB_TILE_VALUE) {
    return [
      'radial-gradient(ellipse at 22% 18%, rgba(80,20,20,0.40) 0%, transparent 40%)',
      'radial-gradient(ellipse at 68% 75%, rgba(160,30,30,0.20) 0%, transparent 38%)',
      'linear-gradient(148deg, #3A1A1A 0%, #2A1212 42%, #1A0A0A 100%)',
    ].join(', ');
  }
  if (val <= 0) return '#1f1f23'; // empty / dead

  const f = getFamily(val);
  return [
    `radial-gradient(ellipse at 22% 18%, rgba(255,255,255,0.22) 0%, transparent 42%)`,
    `radial-gradient(ellipse at 68% 75%, ${f.marble} 0%, transparent 38%)`,
    `linear-gradient(148deg, ${f.top} 0%, ${f.mid} 42%, ${f.base} 100%)`,
  ].join(', ');
}

// ── Shadow tokens ─────────────────────────────────────────────────────────────

export const DRAG_SRC_SHADOW =
  '0 0 0 3px rgba(100,160,255,0.90), 0 6px 20px rgba(60,100,220,0.40), inset 0 1px 0 rgba(255,255,255,0.25)';

const BASE_SHADOW =
  '0 3px 0 rgba(0,0,0,0.30), 0 5px 12px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22)';
const SEL_SHADOW =
  '0 0 0 3px rgba(255,180,0,0.85), 0 4px 16px rgba(255,120,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)';
const TROPHY_SHADOW =
  '0 0 14px rgba(255,200,0,0.65), 0 0 0 2px #E8B800, 0 4px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,230,0.40)';
const FROZEN_SHADOW =
  '0 0 10px rgba(160,200,230,0.45), 0 0 0 1.5px #90B8CC, 0 3px 0 rgba(0,0,0,0.28), inset 0 1px 0 rgba(220,235,245,0.35)';
const DROP_INVALID_SHADOW =
  '0 0 0 3px rgba(239,68,68,0.90), 0 4px 16px rgba(220,38,38,0.40), inset 0 1px 0 rgba(255,255,255,0.20)';
const DROP_VALID_SHADOW =
  '0 0 0 3px rgba(96,165,250,0.85), 0 4px 16px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.20)';
const DROP_TROPHY_SHADOW =
  '0 0 0 3px rgba(255,215,0,0.95), 0 4px 20px rgba(255,215,0,0.55), inset 0 1px 0 rgba(255,255,255,0.30)';
const BOMB_SHADOW =
  '0 0 8px rgba(180,0,0,0.35), 0 3px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)';

// ── Props ─────────────────────────────────────────────────────────────────────

interface TileProps {
  val: number;
  size: number;
  row: number;
  col: number;
  selected: boolean;
  clearing: boolean;
  isDragSource?: boolean;
  isDropTarget?: boolean;
  isTrophy?: boolean;
  isFrozen?: boolean;
  /** True when a bomb is actively burning (fuse animation).                   */
  isBombLit?: boolean;
  isPopping?: boolean;
  isSpawning?: boolean;
  mergeHighlight?: 'invalid' | 'valid' | 'trophy';
  eqOverlay?: { label: string; color: string };
  key?: React.Key;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function TrophyIcon({ size }: { size: number }) {
  const s = size * 0.52;
  return (
    <svg
      width={s} height={s}
      viewBox="0 0 36 36"
      fill="none"
      style={{ position: 'absolute', top: '4%', left: '50%', transform: 'translateX(-50%)', opacity: 0.55 }}
    >
      {/* Cup */}
      <path d="M9 5 H27 L24 20 Q22 28 18 28 Q14 28 12 20 Z"
            fill="rgba(255,240,150,0.75)" stroke="rgba(200,150,0,0.5)" strokeWidth="1" />
      {/* Handles */}
      <path d="M9 7 Q2 7 3 16 Q4 21 9 19" fill="rgba(255,220,100,0.60)" />
      <path d="M27 7 Q34 7 33 16 Q32 21 27 19" fill="rgba(255,220,100,0.60)" />
      {/* Stem */}
      <rect x="16" y="28" width="4" height="4" rx="1" fill="rgba(220,180,60,0.80)" />
      {/* Base */}
      <rect x="12" y="32" width="12" height="2.5" rx="1.5" fill="rgba(220,180,60,0.80)" />
      {/* Star */}
      <path d="M18 10 L19.2 13.6 L23 13.6 L20 15.8 L21.2 19.4 L18 17.2 L14.8 19.4 L16 15.8 L13 13.6 L16.8 13.6 Z"
            fill="rgba(255,250,180,0.85)" />
    </svg>
  );
}

function BombIcon({ size, isLit }: { size: number; isLit: boolean }) {
  const s = size * 0.58;
  return (
    <svg
      width={s} height={s}
      viewBox="0 0 40 40"
      fill="none"
      style={{ position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)' }}
    >
      {/* Body */}
      <circle cx="20" cy="26" r="12" fill="#CC2222" stroke="#991111" strokeWidth="1.5" />
      {/* Shine */}
      <ellipse cx="16" cy="21" rx="4" ry="2.5" fill="rgba(255,150,150,0.4)" />
      {/* Neck */}
      <rect x="18" y="12" width="4" height="6" rx="2" fill="#666" />
      {/* Fuse */}
      <path
        d="M20 12 Q24 6 28 8 Q30 10 26 12"
        stroke={isLit ? '#FF8800' : '#888'}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        style={isLit ? { animation: 'cgFuseGlow 0.4s ease-in-out infinite' } : undefined}
      />
      {/* Ember spark when lit */}
      {isLit && (
        <circle cx="26.5" cy="11.5" r="2.5" fill="#FFCC00">
          <animate attributeName="opacity" values="1;0.4;1" dur="0.3s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

// ── Countdown ring for ignited bomb ──────────────────────────────────────────

function BombCountdownRing({ size, progress }: { size: number; progress: number }) {
  const r = size * 0.44;
  const circ = 2 * Math.PI * r;
  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {/* Background ring */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke="rgba(255,50,50,0.2)" strokeWidth={3} />
      {/* Progress ring — red, drains as fuse burns */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="#FF3300"
        strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.1s linear' }}
      />
    </svg>
  );
}

// ── Number display ────────────────────────────────────────────────────────────

function TileNumber({
  val, size, isTrophy, isFrozen,
}: { val: number; size: number; isTrophy: boolean; isFrozen: boolean }) {
  const display = isTrophy
    ? String(val)
    : isFrozen
    ? String(val)
    : val === ZERO_TILE_VALUE
    ? '0'
    : val <= 0
    ? '·'
    : String(val);

  const color = isTrophy
    ? 'rgba(255, 252, 195, 0.96)'
    : isFrozen
    ? 'rgba(210, 230, 245, 0.90)'
    : val === ZERO_TILE_VALUE
    ? 'rgba(110, 95, 80, 0.88)'
    : 'rgba(255, 248, 235, 0.95)';

  // Carved-ceramic shadow: drop shadow below + faint inner-glow above.
  const textShadow = isTrophy
    ? '0 1px 4px rgba(100,60,0,0.5), 0 0 14px rgba(255,240,120,0.4)'
    : isFrozen
    ? '0 1px 3px rgba(30,50,70,0.5), 0 0 8px rgba(170,210,240,0.3)'
    : val === ZERO_TILE_VALUE
    ? '0 1px 2px rgba(80,60,40,0.35)'
    : '0 1px 3px rgba(0,0,0,0.35), 0 0 10px rgba(255,240,200,0.20)';

  return (
    <span
      style={{
        position: 'relative',
        zIndex: 2,
        fontSize: size * (isTrophy ? 0.36 : 0.42),
        fontWeight: 900,
        color,
        textShadow,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        marginTop: isTrophy ? '32%' : 0, // push number down below trophy icon
        fontFamily: 'inherit',
      }}
    >
      {display}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Tile({
  val,
  size,
  row,
  col,
  selected,
  clearing,
  isDragSource,
  isDropTarget,
  isTrophy,
  isFrozen,
  isBombLit,
  isPopping,
  isSpawning,
  mergeHighlight,
  eqOverlay,
}: TileProps) {
  const radius = Math.min(BASE_RADIUS_PX, size * 0.28);
  const isBomb = val === BOMB_TILE_VALUE;
  const isZero = val === ZERO_TILE_VALUE;

  // ── Box shadow ──────────────────────────────────────────────────────────────
  const dropTargetShadow =
    mergeHighlight === 'invalid' ? DROP_INVALID_SHADOW
    : mergeHighlight === 'trophy' ? DROP_TROPHY_SHADOW
    : DROP_VALID_SHADOW;

  const boxShadow = isTrophy
    ? TROPHY_SHADOW
    : isFrozen
    ? FROZEN_SHADOW
    : isBomb
    ? BOMB_SHADOW
    : isDragSource
    ? DRAG_SRC_SHADOW
    : isDropTarget
    ? dropTargetShadow
    : selected
    ? SEL_SHADOW
    : BASE_SHADOW;

  // ── Border ──────────────────────────────────────────────────────────────────
  const dropTargetBorder =
    mergeHighlight === 'invalid' ? '2px solid rgba(239,68,68,0.90)'
    : mergeHighlight === 'trophy' ? '2px solid #E8B800'
    : '2px solid rgba(96,165,250,0.85)';

  const border = isTrophy
    ? '2px solid #C8A000'
    : isFrozen
    ? '1.5px solid #7AABBD'
    : isBomb
    ? '1.5px solid #5A1A1A'
    : isZero
    ? '1.5px solid rgba(160,140,120,0.5)'
    : isDragSource
    ? '2px solid rgba(100,160,255,0.90)'
    : isDropTarget
    ? dropTargetBorder
    : selected
    ? '2px solid rgba(255,200,60,0.90)'
    : '1.5px solid rgba(0,0,0,0.14)';

  // ── Animation ───────────────────────────────────────────────────────────────
  const baseScale = isDragSource || isDropTarget || selected ? 'scale(1.07)' : 'scale(1)';

  const animation = isSpawning
    ? 'cgTileSpawn 0.42s ease-out'
    : isPopping
    ? 'cgTilePop 0.35s ease-out'
    : isTrophy
    ? 'cgTrophyPulse 2.2s ease-in-out infinite'
    : isBomb && !isBombLit
    ? 'cgBombIdle 2s ease-in-out infinite'
    : val === 1 && !isTrophy && !isFrozen
    ? 'cgOneGlow 3s ease-in-out infinite'
    : undefined;

  // ── Cursor ──────────────────────────────────────────────────────────────────
  // Frozen tiles cannot initiate drags; bomb tiles ignite on touch (cursor: crosshair).
  const cursor = isTrophy || isFrozen
    ? 'default'
    : isBomb
    ? 'crosshair'
    : 'pointer';

  const bg = tileBackground(val, isTrophy ?? false, isFrozen);

  return (
    <button
      data-row={row}
      data-col={col}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: size * 0.42,
        padding: PAD,
        border,
        background: bg,
        boxShadow,
        color: isTrophy ? 'rgba(255,252,195,0.96)' : '#fff',
        fontWeight: 900,
        opacity: clearing ? 0 : 1,
        transition: animation
          ? 'opacity 0.25s ease, box-shadow 0.10s ease'
          : 'opacity 0.25s ease, transform 0.10s ease, box-shadow 0.10s ease',
        transform: animation ? undefined : baseScale,
        animation,
        cursor,
        userSelect: 'none',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      {/* Trophy icon (sits behind the number visually) */}
      {isTrophy && <TrophyIcon size={size} />}

      {/* Bomb icon */}
      {isBomb && <BombIcon size={size} isLit={isBombLit ?? false} />}

      {/* Bomb countdown ring overlay */}
      {isBomb && isBombLit && (
        <BombCountdownRing size={size} progress={0.5 /* updated by parent */} />
      )}

      {/* Number (hidden for bomb tiles — the icon says it all) */}
      {!isBomb && (
        <TileNumber
          val={val}
          size={size}
          isTrophy={isTrophy ?? false}
          isFrozen={isFrozen ?? false}
        />
      )}

      {/* Frozen cracked overlay — thin diagonal line pattern */}
      {isFrozen && (
        <svg
          width="100%" height="100%"
          viewBox="0 0 40 40"
          fill="none"
          style={{
            position: 'absolute', top: 0, left: 0,
            borderRadius: radius, pointerEvents: 'none', opacity: 0.22,
          }}
        >
          <line x1="0" y1="14" x2="18" y2="0" stroke="white" strokeWidth="1" />
          <line x1="22" y1="40" x2="40" y2="26" stroke="white" strokeWidth="1" />
          <line x1="0" y1="30" x2="12" y2="40" stroke="white" strokeWidth="0.8" />
          <line x1="28" y1="0" x2="40" y2="8"  stroke="white" strokeWidth="0.8" />
        </svg>
      )}

      {/* Equation preview tooltip floating above the drop-target tile. */}
      {eqOverlay && (
        <span
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 5,
            background: 'rgba(10,8,6,0.92)',
            color: eqOverlay.color,
            padding: '3px 7px',
            borderRadius: 6,
            fontSize: Math.max(11, size * 0.19),
            fontWeight: 900,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
            lineHeight: '1.3',
            boxShadow: '0 2px 8px rgba(0,0,0,0.55)',
            letterSpacing: '0.3px',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          {eqOverlay.label}
        </span>
      )}
    </button>
  );
}
