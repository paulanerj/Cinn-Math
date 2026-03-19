import React from 'react';

export const GameHeader = ({ state, config, timerDuration, modeConfig, sound, setIsOptionsOpen }) => (
  <header className="header-text w-full max-w-md flex justify-between items-center p-4 z-10 shrink-0 h-20 text-[var(--sa-text)]">
    <button
      onClick={() => { sound.playButtonClick(); setIsOptionsOpen(true); }}
      className="sa-pill px-5 py-2 font-bold shadow-sm"
    >
      MENU
    </button>
    <div className={`text-3xl font-black tabular-nums tracking-wider bg-[var(--sa-overlay)] px-4 py-1 rounded-full border border-[var(--sa-border)] shadow-sm ${timerDuration > 0 && config.timerOn && !modeConfig.usesDarkStopwatch ? 'visible' : 'invisible'}`}>
      {state.elapsedTime}s
    </div>
  </header>
);
