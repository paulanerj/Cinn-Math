import React from 'react';

export const AnswerGrid = ({ distractors, state, flashState, isDark, actions, localClicked, setLocalClicked }) => (
  <div className={`grid ${distractors.length === 4 ? 'grid-cols-2' : distractors.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-4 w-full max-w-lg px-4 ${isDark ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
    {distractors.map((ans, i) => {
      const isSelected = localClicked === ans;
      let activeClass = '';
      if (flashState === 'incorrect' && isSelected) activeClass = 'sa-btn--incorrect scale-95';
      else if (flashState === 'incorrect') activeClass = 'opacity-50 grayscale';

      return (
        <button
          key={`${state.stepIndex}-${i}`}
          onClick={() => { setLocalClicked(ans); actions.handleAnswer(ans); }}
          disabled={isDark || !!flashState || state.isPaused}
          className={`sa-btn h-16 md:h-20 text-2xl md:text-3xl font-bold ${activeClass}`}
        >
          {ans}
        </button>
      );
    })}
  </div>
);
