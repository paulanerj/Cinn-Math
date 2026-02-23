
import React from 'react';
import { Tile as TileData, TileKind } from '../types';
import { COLORS } from '../constants';

interface TileProps {
  tile: TileData & { isIgniting?: boolean };
  tileSize: number;
  x: number;
  y: number;
  isDragging?: boolean;
  isZapTarget?: boolean;
  isHighlighted?: boolean;
  isTrayOp?: boolean;
  lockedRadiusPx?: number;
}

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

const Tile: React.FC<TileProps> = ({ tile, tileSize, x, y, isDragging, isZapTarget, isHighlighted, isTrayOp, lockedRadiusPx }) => {
  const getStyle = () => {
    if (tile.val === 0 && tile.kind === TileKind.NUMBER) return { bg: '#ffffff', text: '#000000' };
    if (tile.val === 1 && tile.kind === TileKind.NUMBER) return { bg: '#bae6fd', text: '#000000' };

    let bg = COLORS.kinds[tile.kind] || '#333';
    let text = 'white';

    if (tile.kind === TileKind.TROPHY) {
      bg = '#fdf8f5';
      text = '#d97706';
    } else if (tile.kind === TileKind.BOMB) {
      bg = '#ef4444';
      text = '#0b0b0c';
    } else if (tile.kind === TileKind.STONE) {
      bg = 'linear-gradient(145deg, #3f3f46, #71717a)';
      text = '#e4e4e7';
    } else if (tile.kind === TileKind.NUMBER) {
      const idx = Math.min(COLORS.values.length - 1, Math.max(0, tile.val - 1));
      bg = COLORS.values[idx];
    }

    return { bg, text };
  };

  const { bg, text } = getStyle();
  const scale = isDragging ? 1.15 : 1;
  const isTrophy = tile.kind === TileKind.TROPHY;
  const isStone = tile.kind === TileKind.STONE;
  const zapping = isZapTarget || (tile as any).isZapping;
  const isBomb = tile.kind === TileKind.BOMB;

  return (
    <div
      data-tile-id={tile.id}
      className={`absolute select-none touch-none transition-transform duration-150 ${isDragging ? 'z-[1000]' : 'z-10'} ${isHighlighted ? 'z-[100]' : ''}`}
      style={{
        width: tileSize,
        height: tileSize,
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
      }}
    >
      <div
        className={`w-full h-full flex flex-col items-center justify-center font-black border border-black/20 relative overflow-hidden transition-all duration-300 ${zapping ? 'ring-4 ring-cyan-400 z-50' : ''} ${isHighlighted ? 'ring-4 ring-white' : ''} ${isStone ? 'opacity-90' : ''}`}
        style={{
          background: bg,
          color: text,
          borderRadius: lockedRadiusPx !== undefined ? `${lockedRadiusPx}px` : '6px',
          fontSize: tileSize * 0.45,
          boxShadow: zapping 
            ? '0 0 30px rgba(34,211,238,0.8), inset 0 0 15px rgba(34,211,238,0.4)'
            : isDragging 
            ? '0 20px 40px rgba(0,0,0,0.5)' 
            : isTrayOp 
            ? 'none' 
            : isStone 
            ? 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.2)'
            : `0 ${tileSize / 12}px 0 rgba(0,0,0,0.2)`,
          animation: zapping ? 'zap-jitter 0.08s infinite, zap-flash 0.3s infinite' : undefined,
          borderWidth: isStone ? '3px' : '1px',
          borderColor: isStone ? '#18181b' : 'rgba(0,0,0,0.2)',
        }}
      >
        {isTrophy && <span className="absolute top-1 text-[10px] text-amber-500/50">★</span>}
        {isStone && <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/granite.png')]" />}

        {isBomb ? (
          <div className="relative z-10 flex flex-col items-center justify-center">
            <BombIcon size={tileSize} />
            {tile.isIgniting && (
              <div className="absolute -top-1 right-2">
                <span className="block w-2.5 h-2.5 rounded-full" style={{ background: '#ffd166', boxShadow: '0 0 12px rgba(255,209,102,0.95), 0 0 26px rgba(255,209,102,0.65)', animation: 'bomb-spark 0.14s infinite alternate' }} />
              </div>
            )}
          </div>
        ) : (
          <span className={`relative z-10 transition-transform ${zapping ? 'scale-125' : ''} ${isStone ? 'opacity-60 grayscale' : ''}`}>
            {tile.kind === TileKind.OP ? (tile as any).op : tile.val}
          </span>
        )}

        <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br from-white/20 to-transparent opacity-50 ${zapping ? 'bg-cyan-300/60 animate-pulse mix-blend-overlay' : ''}`} />
        {isBomb && tile.isIgniting && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 75% 15%, rgba(255,210,120,0.45), transparent 45%), radial-gradient(circle at 70% 18%, rgba(255,120,80,0.35), transparent 55%)', animation: 'bomb-heat 0.35s infinite alternate' }} />
        )}
      </div>
      <style>{`
        @keyframes bomb-spark { from { transform: translateY(0) scale(1); opacity: 0.75; } to { transform: translateY(-2px) scale(1.35); opacity: 1; } }
        @keyframes bomb-heat { from { opacity: 0.5; } to { opacity: 0.95; } }
        @keyframes zap-jitter { 
          0% { transform: translate(0,0); }
          25% { transform: translate(2px,-2px); }
          50% { transform: translate(-2px,1px); }
          75% { transform: translate(1px,2px); }
          100% { transform: translate(0,0); }
        }
        @keyframes zap-flash {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.5) saturate(1.5); }
        }
      `}</style>
    </div>
  );
};

export default Tile;
