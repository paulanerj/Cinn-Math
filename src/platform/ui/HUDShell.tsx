/**
 * Shared HUD shell components for GridMath games.
 *
 * Provides the structural top-bar and bottom-tray layout used by CombineGrid
 * and (when ready) SpeedGrid. Game-specific content goes in via children slots.
 *
 * Components:
 *  HUDTopBar    — 58px top bar: flex row, dark bg, bottom border. Accepts any children.
 *  HUDBottomBar — Bottom icon tray: evenly-spaced, inset shadow, iOS safe-area padding.
 *  HUDIconBtn   — Rounded icon action button with depth shadow and fast transitions.
 *
 * SpeedGrid adoption guide:
 *  1. Replace SpeedGridHeader with <HUDTopBar> slotting:
 *       [back button] | [title/chip] | [operator dropdown]
 *  2. Replace SpeedGridHUD three-column layout with inline children inside <HUDTopBar>
 *     OR keep SpeedGridHUD and place it below <HUDTopBar> as a second bar.
 *  3. Replace any ad-hoc icon buttons with <HUDIconBtn>.
 *  4. Wrap bottom controls (New Game button + chain value) with <HUDBottomBar>.
 *
 * CombineGrid usage (current):
 *  App.tsx imports HUDTopBar, HUDBottomBar, HUDIconBtn and passes its existing
 *  children (back button, target tile, equation vault, icon buttons) unchanged.
 *  Zero behavior change — this is a layout extraction only.
 */

import React from 'react';
import { ANIM_FAST } from './animTokens';

// ── Top Bar ───────────────────────────────────────────────────────────────────

interface HUDTopBarProps {
  /** Content rendered inside the bar — back button, target, info slots, etc. */
  children: React.ReactNode;
  /** Optional extra className for game-specific overrides (avoid layout changes) */
  className?: string;
}

/**
 * Standard 58px top HUD bar.
 * Horizontal flex row with 12px gap and 16px side padding.
 * Dark background (#1a1a1c), bottom border, z-50.
 */
export const HUDTopBar: React.FC<HUDTopBarProps> = ({ children, className = '' }) => (
  <div
    className={`flex items-center gap-3 px-4 h-[58px] shrink-0 bg-[#1a1a1c] border-b border-white/[0.08] z-50 ${className}`}
  >
    {children}
  </div>
);

// ── Bottom Bar ────────────────────────────────────────────────────────────────

interface HUDBottomBarProps {
  /** Icon buttons or other controls — evenly distributed */
  children: React.ReactNode;
  /** Optional extra className for game-specific overrides */
  className?: string;
}

/**
 * Standard bottom icon tray.
 * justify-evenly, inset shadow, 24px bottom padding for iOS safe area.
 * Dark background (#111113), top border, z-50.
 */
export const HUDBottomBar: React.FC<HUDBottomBarProps> = ({ children, className = '' }) => (
  <div
    className={`flex items-center justify-evenly px-4 pt-3 pb-6 bg-[#111113] border-t border-white/[0.08] shrink-0 z-50 ${className}`}
    style={{ boxShadow: 'inset 0 4px 16px rgba(0,0,0,0.55)' }}
  >
    {children}
  </div>
);

// ── Icon Button ───────────────────────────────────────────────────────────────

interface HUDIconBtnProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional extra className for game-specific icon color or size overrides */
  className?: string;
}

/**
 * Standard 48×48px circular icon action button.
 * Depth shadow with inset shine. ANIM_FAST (100ms) transitions.
 * Hover: brightens bg. Active: scales down + darkens.
 */
export const HUDIconBtn: React.FC<HUDIconBtnProps> = ({ onClick, title, children, className = '' }) => (
  <button
    onClick={onClick}
    title={title}
    style={{ transitionDuration: `${ANIM_FAST}ms` }}
    className={`w-12 h-12 rounded-full bg-[#2a2a2d] border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white hover:bg-[#333336] active:scale-90 active:bg-[#222224] transition-all shadow-[0_4px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] shrink-0 ${className}`}
  >
    {children}
  </button>
);
