import React from 'react';

export const PauseOverlay = ({ state, actions }) => {
  if (!(state.isPaused && state.status === 'playing')) return null;
  return (
    <div
      className="absolute inset-0 bg-[var(--color-overlay-scrim)] backdrop-blur-sm z-[100] flex items-center justify-center cursor-pointer"
      onClick={actions.togglePause}
    >
      <div className="sa-card p-8 text-center animate-bounce-gentle border-4 !border-[var(--sa-primary)] pointer-events-none">
        <div className="text-[var(--sa-primary)] text-4xl font-black tracking-widest mb-2">PAUSED</div>
        <div className="opacity-80 text-sm font-bold uppercase tracking-widest">Tap anywhere to resume</div>
      </div>
    </div>
  );
};
