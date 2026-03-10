// [ROLE] Bottom control bar for SpeedGrid.
// Renders a row of action buttons (Next, Reset, Undo, Settings) plus an
// optional center slot for game-specific content (e.g. a target display).
//
// [WHY] SpeedGrid needs a fixed control strip beneath the board. Extracting
// it here keeps SpeedGridGame.tsx focused on game logic only.
//
// [INVARIANT] This component is purely presentational — it fires callbacks
// via props and holds no state. The parent owns all game state.
//
// [USAGE]
//   <GameControlsLayer
//     onNext={handleNext}
//     onReset={handleReset}
//     onUndo={handleUndo}
//     onSettings={handleSettings}
//     centerSlot={<TargetDisplay value={target} />}
//     undoDisabled={historyEmpty}
//   />

import React from 'react';
import { HUDIconBtn } from '../ui/HUDShell';

// ── SVG icon paths (Material-style, 24×24 viewBox) ───────────────────────────

const ICON_NEXT =
  'M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z';

const ICON_RESET =
  'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z';

const ICON_UNDO =
  'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z';

const ICON_SETTINGS =
  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z';

// ── Component ─────────────────────────────────────────────────────────────────

interface GameControlsLayerProps {
  onNext: () => void;
  onReset: () => void;
  onUndo: () => void;
  onSettings: () => void;
  /** Optional slot rendered between the left and right button groups. */
  centerSlot?: React.ReactNode;
  nextDisabled?: boolean;
  undoDisabled?: boolean;
}

/**
 * Bottom action strip used by SpeedGrid.
 * Layout: [Next] [Reset] ... [centerSlot] ... [Undo] [Settings]
 */
export const GameControlsLayer: React.FC<GameControlsLayerProps> = ({
  onNext,
  onReset,
  onUndo,
  onSettings,
  centerSlot,
  nextDisabled = false,
  undoDisabled = false,
}) => (
  <div className="flex items-center justify-between w-full px-3 py-2 gap-2">
    {/* Left group */}
    <div className="flex items-center gap-2">
      <HUDIconBtn icon={ICON_NEXT} onClick={onNext} label="Next round" disabled={nextDisabled} />
      <HUDIconBtn icon={ICON_RESET} onClick={onReset} label="Reset" />
    </div>

    {/* Center slot */}
    {centerSlot && (
      <div className="flex-1 flex items-center justify-center">
        {centerSlot}
      </div>
    )}

    {/* Right group */}
    <div className="flex items-center gap-2">
      <HUDIconBtn icon={ICON_UNDO} onClick={onUndo} label="Undo" disabled={undoDisabled} />
      <HUDIconBtn icon={ICON_SETTINGS} onClick={onSettings} label="Settings" />
    </div>
  </div>
);

export default GameControlsLayer;
