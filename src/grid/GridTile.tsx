// [ROLE] Base tile stub with documented visual-state extension points.
// [STATUS] Phase 5 stub — available but not required by games during Phases 1–8.
// [CONTRACT] REBUILD_CONTRACT.md §4
//
// Renders a plain square div with minimal styling and visual-state props that
// future game tile components may extend or replace. This component has no
// behavior — no event handlers, no animation, no game logic.
//
// EXTENSION POINTS (documented for Phase 6+ game tile implementations):
//   isSelected   — tile is part of an active drag or chain selection
//   isHighlighted — tile is highlighted by a hint, path indicator, or bonus flag
//   value        — numeric tile value (stub renders it for dev inspection;
//                  game Tile components will replace this with their own layout)
//
// HARD RESTRICTIONS:
//   - NO onClick, onPointerDown, or any event-handler props.
//   - NO animation, NO game-specific visual states (trophy, stone, bomb, etc.).
//   - Must not import from src/games/, src/platform/, or src/systems/.
//   - CombineGrid and SpeedGrid use their own Tile.tsx during reconstruction.
//     They must NOT import GridTile during Phases 1–8.

import React from 'react';

export interface GridTileProps {
  /** Tile size in CSS pixels (width and height). Must match the board's cellSize. */
  size: number;

  /**
   * Numeric value displayed on the tile.
   * Undefined renders an empty slot (useful for testing board geometry).
   */
  value?: number;

  /**
   * Whether this tile is in a selected state (e.g. part of an active chain or
   * drag gesture). Renders a subtle highlight. Default: false.
   */
  isSelected?: boolean;

  /**
   * Whether this tile is in a highlighted state (e.g. path hint, bonus
   * indicator, or chain preview). Renders a lighter highlight. Default: false.
   */
  isHighlighted?: boolean;

  /** Additional CSS class names to apply to the tile element. */
  className?: string;
}

/**
 * GridTile — base tile stub.
 *
 * A plain square div sized to `size × size` pixels with documented visual-state
 * props. Intended as a development aid and future migration scaffold — game
 * implementations will extend or replace this with their own Tile components
 * (e.g. CombineGrid's components/Tile.tsx, SpeedGrid's SpeedTile.tsx).
 *
 * This component intentionally has no pointer-event handlers. All input
 * handling lives in the game layer.
 */
export function GridTile({
  size,
  value,
  isSelected    = false,
  isHighlighted = false,
  className,
}: GridTileProps): React.ReactElement {
  // Background varies by visual state. These values are intentionally minimal
  // and will be replaced when game Tile components adopt this stub.
  const background = isSelected
    ? 'rgba(255, 255, 255, 0.25)'
    : isHighlighted
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(255, 255, 255, 0.06)';

  return (
    <div
      className={className}
      // data-* attributes allow visual state inspection in DevTools without
      // coupling to class names or CSS modules.
      data-selected={isSelected    || undefined}
      data-highlighted={isHighlighted || undefined}
      style={{
        width:           `${size}px`,
        height:          `${size}px`,
        boxSizing:       'border-box',
        position:        'relative',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background,
        borderRadius:    8,
        // No transform:scale, no zoom — contract §2.
        // No transition — games supply their own animation.
      }}
    >
      {value !== undefined && (
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            userSelect:         'none',
            pointerEvents:      'none',
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
