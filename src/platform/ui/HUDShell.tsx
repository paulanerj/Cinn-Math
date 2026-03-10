// [ROLE] Shared HUD chrome components for game screens.
// Provides HUDTopBar (54 px fixed header), HUDBottomBar (bottom action row),
// and HUDIconBtn (standardised icon button used inside both bars).
//
// [WHY] CombineGrid and SpeedGrid share the same top/bottom chrome pattern.
// Centralising it here keeps visual consistency and reduces duplication.
//
// [INVARIANT] HUDTopBar height is 54 px. Any component that reserves space
// for the top bar (e.g. Board.tsx padding) must use this exact value.
// Do not change the height here without auditing every caller.
//
// [USAGE]
//   <HUDTopBar left={<HUDIconBtn .../>} center={<ScoreDisplay/>} right={<HUDIconBtn .../>} />
//   <HUDBottomBar>{children}</HUDBottomBar>

import React from 'react';

// ── HUDIconBtn ────────────────────────────────────────────────────────────────

interface HUDIconBtnProps {
  /** SVG path `d` attribute rendered as a white filled shape. */
  icon: string;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  /** Additional Tailwind classes for the outer button element. */
  className?: string;
}

/**
 * Standardised icon button used in HUDTopBar and HUDBottomBar.
 * Renders a 44×44 px touch target with a centred SVG icon.
 */
export const HUDIconBtn: React.FC<HUDIconBtnProps> = ({
  icon,
  onClick,
  label,
  disabled = false,
  className = '',
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={`
      relative flex items-center justify-center
      w-11 h-11 rounded-xl
      bg-white/10 active:bg-white/20
      transition-opacity duration-100
      ${disabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}
      ${className}
    `}
  >
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="white"
      aria-hidden="true"
    >
      <path d={icon} />
    </svg>
  </button>
);

// ── HUDTopBar ─────────────────────────────────────────────────────────────────

interface HUDTopBarProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

/**
 * Fixed 54 px top bar. Slots: left / center / right.
 * Positioned absolute at the top of its containing block so that the
 * game board can sit flush below it using paddingTop="54px".
 *
 * [INVARIANT] Height = 54 px. Do not change without auditing Board.tsx.
 */
export const HUDTopBar: React.FC<HUDTopBarProps> = ({ left, center, right }) => (
  <div
    className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-3"
    style={{ height: 54 }}
  >
    <div className="flex items-center gap-2 min-w-[44px]">{left}</div>
    <div className="flex items-center justify-center flex-1">{center}</div>
    <div className="flex items-center gap-2 min-w-[44px] justify-end">{right}</div>
  </div>
);

// ── HUDBottomBar ──────────────────────────────────────────────────────────────

interface HUDBottomBarProps {
  children: React.ReactNode;
}

/**
 * Bottom action row. Sits at the bottom of its containing block.
 * Provides consistent padding so controls don't crowd the screen edge.
 *
 * [USAGE] Place action buttons / controls as children. The bar does not
 * impose a fixed height — it grows with its content.
 */
export const HUDBottomBar: React.FC<HUDBottomBarProps> = ({ children }) => (
  <div
    className="absolute inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 pt-2 pb-4 px-4"
  >
    {children}
  </div>
);
