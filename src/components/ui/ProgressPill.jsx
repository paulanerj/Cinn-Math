import React from 'react';

// PURPOSE: Unified single-layer progress indicator combining steps, lives, and visual fill.
export const ProgressPill = ({ state, config }) => {
  const progressPercent = Math.min(100, Math.max(0, (state.stepIndex / Math.max(1, config.totalSteps)) * 100));
  const displayLives = config.activeMode === 'survival' ? state.lives : Math.max(0, 3 - state.errorCount);

  return (
    <div className="w-full max-w-md px-6 z-10 mb-4 shrink-0">
      <div className="relative w-full h-10 bg-white rounded-full border-2 border-[var(--sa-border)] overflow-hidden shadow-sm flex items-center">
        {/* Fill Bar */}
        <div
          className="absolute left-0 top-0 bottom-0 bg-[var(--sa-primary)] transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
        {/* Text Overlay */}
        <div className="relative z-10 w-full flex justify-between px-5 text-[11px] md:text-xs font-black uppercase tracking-widest text-[var(--sa-text)] pointer-events-none">
          <span>Step {state.stepIndex + 1} / {config.totalSteps}</span>
          <span>❤ {displayLives}</span>
        </div>
      </div>
    </div>
  );
};
