import React from 'react';

const MODE_NAMES = {
  standard: 'Standard Arithmetic',
  skipcount: 'Skip Counting',
  multiplication: 'Multiplication Trainer',
  pattern: 'Pattern Logic'
};

export const SessionSummary = ({ finalResults, actions, sessionXP, config }) => {
  if (!finalResults) return null;

  return (
    <div className="sa-card p-8 text-center animate-pop w-full max-w-lg flex flex-col items-center">
      <div className="text-[var(--sa-primary-dark)] font-black text-sm uppercase tracking-widest mb-1">
        {MODE_NAMES[config.learningMode || 'standard']}
      </div>
      <h2 className="text-4xl font-black mb-2">{finalResults.endedEarly ? 'Session Ended' : 'Summary'}</h2>
      <div className="flex justify-center gap-2 my-4 text-5xl drop-shadow-md">
        {'⭐'.repeat(finalResults.stars)}{'☆'.repeat(3 - finalResults.stars)}
      </div>

      {sessionXP && (
        <div className="w-full bg-[var(--sa-primary-soft)] rounded-xl p-4 mb-6 border-2 border-[var(--sa-primary)] flex flex-col items-center">
          <div className="text-[var(--sa-success-dark)] font-black text-2xl mb-1">+{sessionXP.earned} XP Earned!</div>
          <div className="w-full h-3 bg-white rounded-full overflow-hidden mt-2 border border-[var(--sa-border)]">
            <div className="h-full bg-[var(--sa-warning)] transition-all duration-1000" style={{ width: `${sessionXP.progress}%` }}></div>
          </div>
          <div className="w-full flex justify-between text-xs font-bold text-[var(--sa-primary-dark)] mt-1">
            <span>Level {sessionXP.level}</span>
            <span>{sessionXP.progress} / 100</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 w-full text-left mb-6">
        <div className="sa-card !shadow-none p-3 flex flex-col items-center">
          <p className="text-[10px] font-black uppercase opacity-60">Accuracy</p>
          <p className="text-2xl font-black">{finalResults.accuracy}%</p>
        </div>
        <div className="sa-card !shadow-none p-3 flex flex-col items-center">
          <p className="text-[10px] font-black uppercase opacity-60">Best Streak</p>
          <p className="text-2xl font-black">{sessionXP?.bestStreak || 0}</p>
        </div>
      </div>

      <button onClick={() => actions.startGame()} className="w-full py-5 text-xl sa-btn !bg-[var(--sa-primary)] !text-white !border-[var(--sa-primary)]">
        PLAY AGAIN
      </button>
    </div>
  );
};
