import React from 'react';

/** Top bar height in px — locked across all game views */
export const HUD_TOP_H = 54;
/** Bottom bar height in px */
export const HUD_BOT_H = 52;

interface HUDTopBarProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function HUDTopBar({ left, center, right }: HUDTopBarProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-3 bg-white/90 backdrop-blur z-30 border-b border-gray-200"
      style={{ height: HUD_TOP_H }}
    >
      <div className="flex items-center gap-2 min-w-0">{left}</div>
      <div className="flex-1 text-center font-bold text-gray-700 truncate px-2">{center}</div>
      <div className="flex items-center gap-2 min-w-0 justify-end">{right}</div>
    </div>
  );
}

interface HUDBottomBarProps {
  children: React.ReactNode;
}

export function HUDBottomBar({ children }: HUDBottomBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-3 bg-white/90 backdrop-blur z-30 border-t border-gray-200"
      style={{ height: HUD_BOT_H }}
    >
      {children}
    </div>
  );
}

interface HUDIconBtnProps {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function HUDIconBtn({ onClick, label, children, disabled }: HUDIconBtnProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-0.5 text-xs text-gray-600 disabled:opacity-40 active:scale-95 transition-transform"
    >
      <span className="text-xl leading-none">{children}</span>
      <span>{label}</span>
    </button>
  );
}
