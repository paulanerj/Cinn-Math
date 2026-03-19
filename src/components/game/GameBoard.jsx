import React from 'react';
import { ProblemTypeEngine } from '../../engine/ProblemTypeEngine.js';
import { Clock } from '../ui/Clock.jsx';
import { StopwatchSVG } from '../ui/StopwatchSVG.jsx';
import { ModifierBubble } from '../ui/ModifierBubble.jsx';
import { ProblemContextPanel, PromptTitle } from '../ui/ProblemContextPanel.jsx';

// ============================================================
// MODULE: GameBoard
// PURPOSE: Core render target for generated math step objects.
// STATE OWNERSHIP: Derived pure props only.
// LLM GUARDRAIL: Do not put logic here. This component blindly
//   formats whatever ProblemTypeEngine passes it.
// ============================================================
export const GameBoard = ({ state, currentStep, currentModeStr, modeConfig, timerDuration, isDark, opUpdateAnim, actions, config }) => {
  const problem = ProblemTypeEngine.createProblem(currentStep, state.currentNumber, config);

  return (
    <div className={`relative flex flex-col items-center justify-center shrink-0 mb-6 w-full max-w-sm min-h-[320px] transition-opacity`}>

      {(config.learningMode !== 'standard' && currentModeStr !== 'qmm') && (
        <div className="absolute -top-12 text-[var(--sa-primary-dark)] text-[10px] md:text-xs font-black uppercase tracking-widest bg-[var(--sa-overlay)] px-4 py-1.5 rounded-full border border-[var(--sa-border)] drop-shadow-sm z-40">
          {config.learningMode === 'skipcount' ? 'Skip Counting' :
           config.learningMode === 'multiplication' ? 'Multiplication Trainer' : 'Pattern Logic'}
        </div>
      )}

      {currentStep && currentStep.variable && config.learningMode === 'standard' && (
        <div className="absolute -top-8 right-4 sa-card px-4 py-2 text-lg font-black z-30 border-[var(--sa-focus)]">
          <span className="italic">{currentStep.variable.name}</span> = {currentStep.variable.value}
        </div>
      )}

      {/* Context Area Top */}
      <div className="absolute top-0 w-full flex flex-col items-center z-30 pointer-events-none">
        {problem?.promptTitle && <PromptTitle title={problem.promptTitle} />}
        {problem?.context && <ProblemContextPanel context={problem.context} />}
      </div>

      <div
        onClick={actions.advanceDarkStepNow}
        className={`central-circle absolute inset-0 m-auto w-48 h-48 md:w-56 md:h-56 bg-[var(--sa-card)] rounded-full border-[6px] border-[var(--sa-primary)] shadow-xl flex items-center justify-center z-20
          ${currentModeStr === 'qmm' ? '!border-[var(--sa-warning)]' : ''}
          ${isDark ? '!bg-slate-800 !border-slate-600' : ''}
          ${opUpdateAnim ? 'scale-105' : 'scale-100'} transition-transform`}
      >
        {modeConfig.usesRingTimer && (
          <div className="absolute inset-0 -m-2">
            <Clock key={state.stepIndex} duration={timerDuration} mode={currentModeStr} isPaused={state.isPaused || !!state.flashState} />
          </div>
        )}

        {currentModeStr === 'dark' ? (
          <div className="absolute inset-0 z-50 text-[var(--sa-focus)] animate-darkfade">
            <StopwatchSVG key={state.stepIndex} duration={timerDuration} isRunning={!state.isPaused && !state.flashState} />
          </div>
        ) : (
          <div className="relative z-10 font-black tracking-tighter text-[var(--sa-text)] flex flex-col items-center justify-center w-full px-4 text-center">
            {(currentModeStr === 'qmm' || currentModeStr === 'hidden') ? (
              <span className="text-6xl text-[var(--sa-warning)]">?</span>
            ) : (
              <span className="whitespace-nowrap text-6xl">
                {problem?.centerValue ?? state.currentNumber}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Render Modifiers Only for Standard Type */}
      {problem?.type === 'standard' && problem.modifiers && problem.modifiers.map((mod, i) => (
        <ModifierBubble
          key={`${state.stepIndex}-${i}`}
          op={mod.operation} val={mod.value} text={mod.text}
          pos={mod.position} isDark={isDark}
        />
      ))}
    </div>
  );
};
