import React from 'react';

export const StartScreen = ({ state, actions, setIsOptionsOpen }) => {
  if (state.status !== 'idle') return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6">
      <div className="z-10 flex flex-col items-center text-center text-[var(--sa-text)]">
        <div className="text-8xl mb-8 animate-bounce-gentle" style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.25))' }}>☁️</div>
        <h1 className="text-6xl font-black mb-8 drop-shadow-lg tracking-tight bg-[var(--sa-overlay)] px-8 py-3 rounded-3xl border border-[var(--sa-border)]">SpeedMath</h1>

        {state.initError && (
          <div className="w-full max-w-md sa-card p-4 mb-6 text-sm leading-snug">
            <div className="font-black mb-1">Cannot start session</div>
            <div className="opacity-90 mb-3">{state.initError}</div>
            <button onClick={actions.clearInitError} className="sa-btn px-4 py-2 font-black">Dismiss</button>
          </div>
        )}

        <button onClick={() => actions.startGame()} className="px-12 py-5 sa-btn !bg-[var(--sa-primary)] !text-[var(--sa-text-inverse)] text-3xl font-black shadow-xl">
          START GAME
        </button>
        <button onClick={() => setIsOptionsOpen(true)} className="mt-6 px-8 py-3 sa-btn font-black text-[var(--sa-text-muted)] shadow-md">
          ⚙️ SETTINGS
        </button>
      </div>
    </div>
  );
};
