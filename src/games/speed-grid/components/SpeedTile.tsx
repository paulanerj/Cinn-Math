// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/components/SpeedTile.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Single SpeedGrid tile. Purely presentational — no event handlers,
//        no state, no dispatch.  All visual state is derived from props.
//
// [WHY SEPARATE FROM COMBINEGRID TILE] SpeedGrid tiles use a different board
//        type (number vs Tile object), a different colour palette, and display
//        chain-index badges and bonus indicators not present in CombineGrid.
//        Do not import or share this component with CombineGrid.
//
// [INVARIANT] tileSize is always a positive integer (Board.tsx guards this).
//             value > 0 for live tiles; Board.tsx does not render tiles with
//             value === 0 (cleared cells are not visible).
//
// [PLATFORM TOKENS] Borrows TILE_BASE_SHADOW, TILE_ZAP_SHADOW, tileTypography,
//        and TILE_SPECULAR_CLASSES from src/platform/ui/tileStyles.ts.
//        SpeedGrid-specific colour config lives in ../uiTokens.ts.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  TILE_BASE_SHADOW,
  TILE_ZAP_SHADOW,
  tileTypography,
  TILE_SPECULAR_CLASSES,
} from '../../../platform/ui/tileStyles';
import {
  tileBaseColor,
  CHAIN_HIGHLIGHT_COLOR,
  BONUS_GLOW,
  BONUS_BORDER_COLOR,
  BONUS_BORDER_WIDTH,
  TILE_TEXT_COLOR,
} from '../uiTokens';
import type { SGPhase } from '../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface SpeedTileProps {
  /** Numeric value displayed on the tile. Must be > 0. */
  value: number;
  /** True if this tile carries a time-bonus effect. */
  isBonus: boolean;
  /** True if this tile is currently part of the active chain. */
  isInChain: boolean;
  /**
   * Position of this tile in the chain (0 = first selected).
   * -1 when isInChain is false.
   */
  chainIndex: number;
  /** Computed tile size in CSS pixels (integer, ≥ 1). */
  tileSize: number;
  /** Current game phase — reserved for future phase-specific visual states. */
  phase: SGPhase;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SpeedTile({
  value,
  isBonus,
  isInChain,
  chainIndex,
  tileSize,
}: SpeedTileProps) {
  const { fontSize, lineHeight } = tileTypography(tileSize);
  const borderRadius = Math.round(tileSize * 0.18);

  // ── Shadow / border ───────────────────────────────────────────────────────

  // In-chain tiles get the platform zap glow.
  // Bonus tiles (not in chain) get their own gold glow.
  // All others get the standard resting shadow.
  const boxShadow = isInChain
    ? TILE_ZAP_SHADOW
    : isBonus
    ? BONUS_GLOW
    : TILE_BASE_SHADOW;

  const border =
    isBonus && !isInChain
      ? `${BONUS_BORDER_WIDTH}px solid ${BONUS_BORDER_COLOR}`
      : undefined;

  // ── Scale ─────────────────────────────────────────────────────────────────

  // Tiles in the chain pop slightly to give tactile feedback.
  const transform = isInChain ? 'scale(1.09)' : 'scale(1)';

  // ── Badge sizes ───────────────────────────────────────────────────────────

  const badgeFontSize = Math.max(8, Math.round(tileSize * 0.22));
  const bonusDotSize = Math.max(6, Math.round(tileSize * 0.14));

  return (
    <div
      style={{
        position: 'relative',
        width: tileSize,
        height: tileSize,
        borderRadius,
        background: tileBaseColor(value),
        boxShadow,
        border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        lineHeight,
        fontWeight: 900,
        color: TILE_TEXT_COLOR,
        fontFamily: 'Nunito, sans-serif',
        overflow: 'hidden',
        transition: 'transform 0.10s ease, box-shadow 0.10s ease',
        transform,
        userSelect: 'none',
        cursor: 'default',
        willChange: 'transform',
      }}
    >
      {/* Specular highlight stripe across the top edge */}
      <div className={TILE_SPECULAR_CLASSES} />

      {/* Chain-active yellow overlay */}
      {isInChain && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: CHAIN_HIGHLIGHT_COLOR,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tile value label */}
      <span style={{ position: 'relative', zIndex: 1 }}>{value}</span>

      {/* Chain-index badge: shows the tile's position in the chain */}
      {isInChain && chainIndex >= 0 && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 4,
            fontSize: badgeFontSize,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          {chainIndex + 1}
        </div>
      )}

      {/* Bonus indicator dot — top-left corner, only when not chained */}
      {isBonus && !isInChain && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            width: bonusDotSize,
            height: bonusDotSize,
            borderRadius: '50%',
            background: BONUS_BORDER_COLOR,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
