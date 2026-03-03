
import React from 'react';
import { Tile as TileData, TileKind } from '../types';
import { COLORS } from '../constants';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BASE_RADIUS_PX  = 16;                            // unified base tile radius
const BOTTOM_SHADOW   = '0 3px 0 rgba(0,0,0,0.22)';   // standard depth
const BOTTOM_SHADOW_S = '0 2px 0 rgba(0,0,0,0.15)';   // softer (light-bg tiles)

// ── Factor glow tokens ─────────────────────────────────────────────────────────
const FACTOR_WARM_OUTLINE       = 'rgba(249,115,22,0.55)';  // orange ring (factors)
const FACTOR_WARM_GLOW          = 'rgba(249,115,22,0.25)';  // orange halo (factors)
const FACTOR_ONE_OUTLINE        = 'rgba(56,189,248,0.55)';  // sky-blue ring (val===1)
const FACTOR_ONE_GLOW           = 'rgba(56,189,248,0.20)';  // sky-blue halo (val===1)
const FACTOR_REVEAL_DURATION_MS = 650;

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

// ── Bomb icon (unchanged) ─────────────────────────────────────────────────────
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
function getVisuals(tile: TileData): {
  bg: string; text: string; textShadow: string; baseShadow: string;
} {
  if (tile.kind === TileKind.NUMBER) {
    // Zero — warmer white, inner ring, no text shadow
    if (tile.val === 0) return {
      bg:         '#fffbf5',
      text:       '#000000',
      textShadow: 'none',
      baseShadow: `inset 0 0 0 2px rgba(0,0,0,0.10), ${BOTTOM_SHADOW_S}`,
    };
    // One — pale sky blue, inner outline, no text shadow
    if (tile.val === 1) return {
      bg:         '#e0f2fe',
      text:       '#0369a1',
      textShadow: 'none',
      baseShadow: `inset 0 0 0 1.5px rgba(3,105,161,0.20), ${BOTTOM_SHADOW_S}`,
    };
    // Colorful number tiles — value-indexed palette, subtle text shadow
    const idx = Math.min(COLORS.values.length - 1, Math.max(0, tile.val - 1));
    return {
      bg:         COLORS.values[idx],
      text:       '#ffffff',
      textShadow: '0 1px 2px rgba(0,0,0,0.25)',
      baseShadow: BOTTOM_SHADOW,
    };
  }
  if (tile.kind === TileKind.TROPHY) return {
    bg:         '#fdf8f5',
    text:       '#d97706',
    textShadow: 'none',
    baseShadow: BOTTOM_SHADOW_S,
  };
  if (tile.kind === TileKind.BOMB) return {
    bg:         '#ef4444',
    text:       '#0b0b0c',
    textShadow: 'none',
    baseShadow: BOTTOM_SHADOW,
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

  const scale    = isDragging ? 1.15 : 1;
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
  const boxShadow =
    zapping      ? '0 0 24px rgba(34,211,238,0.8), inset 0 0 12px rgba(34,211,238,0.3), 0 3px 0 rgba(0,0,0,0.2)'
    : isDragging ? '0 16px 32px rgba(0,0,0,0.5), 0 4px 0 rgba(0,0,0,0.3)'
    : isTrayOp   ? 'none'
    : isOneFactor  ? `0 0 0 2px ${FACTOR_ONE_OUTLINE}, 0 0 10px ${FACTOR_ONE_GLOW}, 0 3px 0 rgba(0,0,0,0.22)`
    : isWarmFactor ? `0 0 0 2px ${FACTOR_WARM_OUTLINE}, 0 0 10px ${FACTOR_WARM_GLOW}, 0 3px 0 rgba(0,0,0,0.22)`
    : baseShadow;

  return (
    <div
      data-tile-id={tile.id}
      className={`absolute select-none touch-none transition-transform duration-150 ${isDragging ? 'z-[1000]' : 'z-10'} ${isHighlighted ? 'z-[100]' : ''}`}
      style={{ width: tileSize, height: tileSize, transform: `translate(${x}px, ${y}px) scale(${scale})` }}
    >
      <div
        className={`w-full h-full flex flex-col items-center justify-center border relative overflow-hidden transition-all duration-300 ${zapping ? 'ring-4 ring-cyan-400 z-50' : ''} ${isHighlighted ? 'ring-4 ring-white' : ''} ${isStone ? 'opacity-90' : ''} ${isWarmFactor ? 'factor-glow' : ''} ${isOneFactor ? 'factor-glow-one' : ''}`}
        style={{
          background:  bg,
          color:       text,
          borderRadius: radius,
          fontSize:    tileSize * 0.45,
          fontWeight:  900,
          boxShadow,
          animation:   zapping ? 'zap-jitter 0.08s infinite, zap-flash 0.3s infinite' : undefined,
          borderWidth: isStone ? '2px' : '1px',
          borderColor: isStone ? '#18181b' : 'rgba(0,0,0,0.12)',
        }}
      >
        {isTrophy && <span className="absolute top-1 text-[10px] text-amber-500/50">★</span>}
        {isStone  && <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/granite.png')]" />}

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

        {/* Specular highlight overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/20 to-transparent" />

        {isBomb && tile.isIgniting && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(circle at 75% 15%, rgba(255,210,120,0.45), transparent 45%), radial-gradient(circle at 70% 18%, rgba(255,120,80,0.35), transparent 55%)',
            animation:  'bomb-heat 0.35s infinite alternate',
          }} />
        )}
      </div>

      <style>{`
        @keyframes bomb-spark {
          from { transform: translateY(0) scale(1);       opacity: 0.75; }
          to   { transform: translateY(-2px) scale(1.35); opacity: 1;    }
        }
        @keyframes bomb-heat {
          from { opacity: 0.5;  }
          to   { opacity: 0.95; }
        }
        @keyframes zap-jitter {
          0%   { transform: translate(0,0);      }
          25%  { transform: translate(2px,-2px); }
          50%  { transform: translate(-2px,1px); }
          75%  { transform: translate(1px,2px);  }
          100% { transform: translate(0,0);      }
        }
        @keyframes zap-flash {
          0%, 100% { filter: brightness(1);                 }
          50%      { filter: brightness(1.5) saturate(1.5); }
        }
        @keyframes factor-reveal {
          0%   { box-shadow: 0 0 0 0   rgba(249,115,22,0),    0 3px 0 rgba(0,0,0,0.22); }
          45%  { box-shadow: 0 0 0 3px rgba(249,115,22,0.65), 0 0 14px rgba(249,115,22,0.35), 0 3px 0 rgba(0,0,0,0.22); }
          100% { box-shadow: 0 0 0 2px ${FACTOR_WARM_OUTLINE}, 0 0 10px ${FACTOR_WARM_GLOW}, 0 3px 0 rgba(0,0,0,0.22); }
        }
        .factor-glow {
          animation: factor-reveal ${FACTOR_REVEAL_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes factor-reveal-one {
          0%   { box-shadow: 0 0 0 0   rgba(56,189,248,0),    0 3px 0 rgba(0,0,0,0.22); }
          45%  { box-shadow: 0 0 0 3px rgba(56,189,248,0.65), 0 0 14px rgba(56,189,248,0.30), 0 3px 0 rgba(0,0,0,0.22); }
          100% { box-shadow: 0 0 0 2px ${FACTOR_ONE_OUTLINE}, 0 0 10px ${FACTOR_ONE_GLOW}, 0 3px 0 rgba(0,0,0,0.22); }
        }
        .factor-glow-one {
          animation: factor-reveal-one ${FACTOR_REVEAL_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default Tile;
