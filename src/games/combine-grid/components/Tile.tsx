// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/components/Tile.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// [PHASE 1]  Pointer events — no onClick/onMouseEnter.  All pointer handling
//            is lifted to CombineGridGame's container div.  Tile carries
//            data-row / data-col attributes so elementFromPoint() can identify
//            which tile is under the pointer during drag.
//
// [PHASE 2]  eqOverlay — shows "A × B = R" tooltip floating above the drop-
//            target tile while a drag is in progress.
//
// [PHASE 3]  isPopping  — triggers cgTilePop keyframe on merge destination.
// [PHASE 4]  isSpawning — triggers cgTileSpawn keyframe on respawned tile.
//
// [TASK 1]   isTrophy — gold gradient, gold glow, cgTrophyPulse animation.
// [TASK 2]   mergeHighlight — drop-target border/shadow varies by result.
//
// [PURITY]   Pure presentational component.  No dispatch, no PRNG.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { BASE_RADIUS_PX, PAD } from '../uiTokens';

// ── Props ─────────────────────────────────────────────────────────────────────

interface TileProps {
  val: number;
  size: number;
  /** Row index — written as data-row so the drag handler can read it. */
  row: number;
  /** Col index — written as data-col so the drag handler can read it. */
  col: number;
  selected: boolean;
  clearing: boolean;
  isDragSource?: boolean;
  isDropTarget?: boolean;
  isTrophy?: boolean;
  /** Phase 3: triggers cgTilePop animation (merge destination received a value). */
  isPopping?: boolean;
  /** Phase 4: triggers cgTileSpawn animation (tile just appeared from respawn). */
  isSpawning?: boolean;
  /**
   * Task 2: merge result classification for the drop-target tile.
   * 'invalid' = result > target (red border)
   * 'valid'   = result < target (neutral blue)
   * 'trophy'  = result === target (gold glow)
   * Only set on the tile at dropTarget when a drag is active.
   */
  mergeHighlight?: 'invalid' | 'valid' | 'trophy';
  /**
   * Phase 2: equation preview shown as a tooltip above the drop-target tile.
   * Only set on the tile at dropTarget position when a drag is in progress.
   */
  eqOverlay?: { label: string; color: string };
  /** React 19: key is now explicit in JSX element types. */
  key?: React.Key;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Background colour for a tile by value.
 * Exported so CombineGridGame can apply the same colour to the ghost tile.
 * For trophy tiles the caller should use the gold gradient CSS directly.
 */
export function tileBackground(val: number, isTrophy: boolean): string {
  if (isTrophy) return 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 45%, #d97706 100%)';
  if (val <= 0) return '#1f1f23'; // zero / dead tile — near-black
  if (val <= 2) return '#7c2d12';
  if (val <= 4) return '#9a3412';
  if (val <= 6) return '#c2410c';
  if (val <= 8) return '#ea580c';
  return '#f97316';
}

// Shadow tokens — exported so ghost tile in CombineGridGame can match.
export const DRAG_SRC_SHADOW =
  '0 0 0 3px rgba(100,160,255,0.90), 0 4px 16px rgba(80,120,255,0.40), inset 0 1px 0 rgba(255,255,255,0.25)';

const BASE_SHADOW =
  '0 2px 0 rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18)';
const SEL_SHADOW =
  '0 0 0 3px rgba(255,180,0,0.85), 0 4px 16px rgba(255,120,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)';
// Task 1 — Trophy: gold glow as specified.
const TROPHY_SHADOW =
  '0 0 12px rgba(255,215,0,0.6), 0 0 0 2px #ffd700, inset 0 1px 0 rgba(255,255,255,0.30)';
// Task 2 — Drop-target shadows vary by merge result.
const DROP_INVALID_SHADOW =
  '0 0 0 3px rgba(239,68,68,0.90), 0 4px 16px rgba(220,38,38,0.40), inset 0 1px 0 rgba(255,255,255,0.20)';
const DROP_VALID_SHADOW =
  '0 0 0 3px rgba(96,165,250,0.85), 0 4px 16px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.20)';
const DROP_TROPHY_SHADOW =
  '0 0 0 3px rgba(255,215,0,0.95), 0 4px 20px rgba(255,215,0,0.55), inset 0 1px 0 rgba(255,255,255,0.30)';

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
  isPopping,
  isSpawning,
  mergeHighlight,
  eqOverlay,
}: TileProps) {
  const radius = Math.min(BASE_RADIUS_PX, size * 0.28);

  // Task 2: drop-target shadow depends on mergeHighlight when a drag is active.
  const dropTargetShadow =
    mergeHighlight === 'invalid' ? DROP_INVALID_SHADOW
    : mergeHighlight === 'trophy' ? DROP_TROPHY_SHADOW
    : DROP_VALID_SHADOW;

  const boxShadow = isTrophy
    ? TROPHY_SHADOW
    : isDragSource
    ? DRAG_SRC_SHADOW
    : isDropTarget
    ? dropTargetShadow
    : selected
    ? SEL_SHADOW
    : BASE_SHADOW;

  // Task 2: border colour matches the merge highlight classification.
  const dropTargetBorder =
    mergeHighlight === 'invalid' ? '2px solid rgba(239,68,68,0.90)'
    : mergeHighlight === 'trophy' ? '2px solid #ffd700'
    : '2px solid rgba(96,165,250,0.85)';

  const border = isTrophy
    ? '2px solid #ffd700'           // Task 1: spec-exact gold border
    : isDragSource
    ? '2px solid rgba(100,160,255,0.90)'
    : isDropTarget
    ? dropTargetBorder
    : selected
    ? '2px solid rgba(255,200,60,0.90)'
    : '2px solid rgba(0,0,0,0.18)';

  // Base scale for non-animated states (trophy tiles are never drag/drop targets).
  const baseScale = isDragSource || isDropTarget || selected ? 'scale(1.07)' : 'scale(1)';

  // Active CSS animation — cgTilePop / cgTileSpawn / cgTrophyPulse.
  // Task 1: trophy tiles play infinite pulse unless another animation is active.
  // Keyframe animations own the transform property during playback so we
  // suppress the inline transform while any animation is running.
  const animation = isSpawning
    ? 'cgTileSpawn 0.42s ease-out'
    : isPopping
    ? 'cgTilePop 0.35s ease-out'
    : isTrophy
    ? 'cgTrophyPulse 2.2s ease-in-out infinite'
    : undefined;

  return (
    <button
      // Phase 1: data attributes for pointer-event tile identification.
      data-row={row}
      data-col={col}
      style={{
        position: 'relative',   // needed for eqOverlay absolute positioning
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: size * 0.42,
        padding: PAD,
        border,
        background: tileBackground(val, isTrophy ?? false),
        boxShadow,
        color: isTrophy ? '#fde68a' : '#ffffff',
        fontWeight: 900,
        opacity: clearing ? 0 : 1,
        // Remove transform transition during animations to avoid conflict.
        transition: animation
          ? 'opacity 0.25s ease, box-shadow 0.10s ease'
          : 'opacity 0.25s ease, transform 0.10s ease, box-shadow 0.10s ease',
        // Omit transform when animation is active — keyframes take ownership.
        transform: animation ? undefined : baseScale,
        animation,
        cursor: isTrophy ? 'default' : 'pointer',
        userSelect: 'none',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',  // let eqOverlay tooltip escape the tile bounds
      }}
      // No onClick — pointer handling is lifted to the container (Phase 1).
    >
      {val === 0 ? '·' : val}

      {/* Phase 2 — equation preview tooltip floating above the drop-target tile. */}
      {eqOverlay && (
        <span
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 5,
            background: 'rgba(0,0,0,0.88)',
            color: eqOverlay.color,
            padding: '3px 6px',
            borderRadius: 5,
            fontSize: Math.max(11, size * 0.19),
            fontWeight: 900,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
            lineHeight: '1.3',
            boxShadow: '0 2px 8px rgba(0,0,0,0.55)',
            letterSpacing: '0.3px',
          }}
        >
          {eqOverlay.label}
        </span>
      )}
    </button>
  );
}
