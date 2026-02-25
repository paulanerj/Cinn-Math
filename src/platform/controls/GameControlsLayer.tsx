

import React from "react";

interface Props {

  onNext?: () => void;

  onReset?: () => void;

  onUndo?: () => void;

  onSettings?: () => void;

  centerSlot?: React.ReactNode;

  /** Override label for the Next button. Defaults to "Next". */
  nextLabel?: string;

}

export default function GameControlsLayer({

  onNext,
  onReset,
  onUndo,
  onSettings,
  centerSlot,
  nextLabel = "Next",

}: Props) {

  return (

    <div className="w-full flex flex-col items-center justify-center gap-3 pb-6 pt-2 bg-[#1a1a1c] shrink-0 z-50 border-t border-white/5">

      {centerSlot}

      <div className="flex gap-3">

        {onUndo && (
          <button
            onClick={onUndo}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 border border-white/5"
          >
            Undo
          </button>
        )}

        {onReset && (
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 border border-white/5"
          >
            Reset
          </button>
        )}

        {onNext && (
          <button
            onClick={onNext}
            className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-all shadow-md active:scale-95 border-t border-white/20"
          >
            {nextLabel}
          </button>
        )}

        {onSettings && (
          <button
            onClick={onSettings}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 border border-white/5"
          >
            Settings
          </button>
        )}

      </div>

    </div>

  );

}
