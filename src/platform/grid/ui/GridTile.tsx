/**
 * GridTile — shared tile visual component for all GridMath games.
 *
 * Applies the standard depth-shadow lighting model from tileStyles.ts:
 *  — base shadow (normal state)
 *  — drag shadow + scale (lifted state)
 *  — zap shadow (clear animation state)
 *  — specular highlight overlay
 *  — proportional typography via tileTypography()
 *
 * Game-specific visuals (color, label, icon) come in via props so this
 * component stays game-agnostic.
 *
 * Phase A — Shared UI Extraction. No game logic here.
 */

import React from 'react';
import {
  TILE_BASE_SHADOW,
  TILE_DRAG_SCALE,
  TILE_DRAG_SHADOW,
  TILE_ZAP_SHADOW,
  TILE_SOFT_SHADOW,
  TILE_SPECULAR_CLASSES,
  tileTypography,
} from '../../ui/tileStyles';
import { ANIM_FAST, ANIM_INTERACT } from '../../ui/animTokens';

export type TileVisualState = 'normal' | 'selected' | 'drag' | 'zap' | 'soft';

export interface GridTileProps {
  /** Tile pixel size (width = height) */
  cellSize: number;
  /** Background color CSS string (e.g. '#3b82f6') */
  bgColor: string;
  /** Text label to display in centre */
  label: string;
  /** Text color CSS string */
  textColor?: string;
  /** Visual state controls shadow + scale variant */
  state?: TileVisualState;
  /** Optional gap/margin inside the cell (default 2px) */
  gap?: number;
  /** Optional overlay element (e.g. factor glow badge, icon) */
  overlay?: React.ReactNode;
  /** Pointer event handlers (forwarded from GestureRouter) */
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerEnter?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  /** Optional extra className on the outer wrapper */
  className?: string;
}

function resolveBoxShadow(state: string): string {
  switch (state) {
    case 'drag':     return TILE_DRAG_SHADOW;
    case 'zap':      return TILE_ZAP_SHADOW;
    case 'soft':     return TILE_SOFT_SHADOW;
    default:         return TILE_BASE_SHADOW;
  }
}

/**
 * Single grid tile. Fills its cell with an inner-padded rounded rect.
 * All visual variants are driven by the `state` prop.
 */
export const GridTile: React.FC<GridTileProps> = ({
  cellSize,
  bgColor,
  label,
  textColor = '#ffffff',
  state = 'normal',
  gap = 2,
  overlay,
  onPointerDown,
  onPointerEnter,
  onPointerUp,
  className = '',
}) => {
  const isDrag = state === 'drag';
  const tileSize = cellSize - gap * 2;
  const typo = tileTypography(tileSize);
  const radius = Math.max(6, Math.round(tileSize * 0.14));

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${className}`}
      style={{ padding: gap }}
    >
      {/* Outer wrapper handles scale + transition */}
      <div
        style={{
          width: tileSize,
          height: tileSize,
          transform: isDrag ? `scale(${TILE_DRAG_SCALE})` : 'scale(1)',
          transition: `transform ${isDrag ? ANIM_INTERACT : ANIM_FAST}ms ease, box-shadow ${ANIM_FAST}ms ease`,
          borderRadius: radius,
          boxShadow: resolveBoxShadow(state),
          backgroundColor: bgColor,
          position: 'relative',
          overflow: 'hidden',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerUp={onPointerUp}
      >
        {/* Specular top-left highlight */}
        <div className={TILE_SPECULAR_CLASSES} />

        {/* Number label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: typo.fontSize,
            fontWeight: typo.fontWeight,
            color: textColor,
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>

        {/* Optional game-specific overlay (glow badge, icon, etc.) */}
        {overlay && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {overlay}
          </div>
        )}
      </div>
    </div>
  );
};

export default GridTile;
