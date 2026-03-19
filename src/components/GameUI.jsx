import React, { useState, useEffect } from 'react';
import { SceneContainer } from './scenes/SceneContainer.jsx';
import { ParticleSystem } from './ui/ParticleSystem.jsx';
import { ProgressPill } from './ui/ProgressPill.jsx';
import { GameHeader } from './game/GameHeader.jsx';
import { GameBoard } from './game/GameBoard.jsx';
import { AnswerGrid } from './game/AnswerGrid.jsx';
import { PauseOverlay } from './game/PauseOverlay.jsx';
import { SessionSummary } from './game/SessionSummary.jsx';
import { StartScreen } from './screens/StartScreen.jsx';
import { OptionsMenu } from './settings/OptionsMenu.jsx';

// ============================================================
// MODULE: GameUI
// PURPOSE: Layout shell. Composes all game screens and overlays.
//   Pure rendering — receives all state and actions as props.
// LLM GUARDRAIL: Do not add logic here.
// ============================================================
export const GameUI = ({
  config, state, distractors, flashState, opUpdateAnim, sound,
  actions, shake, modeConfig, finalResults, sessionXP, activeScene, themeClass
}) => {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [localClicked, setLocalClicked] = useState(null);

  useEffect(() => { if (!flashState) setLocalClicked(null); }, [flashState]);

  const currentStep = state.steps && state.steps[state.stepIndex] ? state.steps[state.stepIndex] : null;
  const currentModeStr = currentStep ? currentStep.mode : 'normal';
  const isDark = currentModeStr === 'dark';

  return (
    <SceneContainer activeScene={activeScene} themeClass={themeClass} shake={shake}>
      <ParticleSystem trigger={flashState === 'correct'} isFinale={state.status === 'finished'} />

      <OptionsMenu
        config={config}
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        onApply={(nc) => { actions.setConfig(nc); actions.startGame(nc); setIsOptionsOpen(false); }}
      />

      {state.status !== 'idle' && (
        <GameHeader
          state={state} config={config}
          timerDuration={currentStep?.timerSeconds || 0}
          modeConfig={modeConfig} sound={sound}
          setIsOptionsOpen={setIsOptionsOpen}
        />
      )}

      {/* Curriculum debug overlay */}
      {config.progressionMode === 'curriculum' && currentStep && currentStep._curriculumBlock && state.status === 'playing' && config.learningMode === 'standard' && (
        <div className="fixed top-2 left-2 text-[10px] z-50 pointer-events-none sa-card p-2 shadow-sm text-left">
          <strong className="text-[var(--sa-primary-dark)]">Curriculum Step {state.stepIndex + 1}</strong><br/>
          Block: {currentStep._curriculumBlock.start}-{currentStep._curriculumBlock.end} | Rng: {currentStep._curriculumBlock.rangeMax}<br/>
          Mods: {currentStep._curriculumBlock.modifiers} | Ops: {currentStep._curriculumBlock.operations} | Tm: {currentStep._curriculumBlock.timer} | Var: {String(currentStep._curriculumBlock.variables)}
        </div>
      )}

      <main className="flex-1 w-full flex flex-col items-center justify-center z-10 px-4 min-h-0 py-2">
        {state.status === 'idle' ? (
          <StartScreen state={state} actions={actions} setIsOptionsOpen={setIsOptionsOpen} />
        ) : state.status === 'finished' ? (
          <SessionSummary finalResults={finalResults} sessionXP={sessionXP} config={config} actions={actions} />
        ) : (
          <React.Fragment>
            <ProgressPill state={state} config={config} />
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <GameBoard
                state={state} currentStep={currentStep}
                currentModeStr={currentModeStr} modeConfig={modeConfig}
                timerDuration={currentStep?.timerSeconds || 0}
                isDark={isDark} opUpdateAnim={opUpdateAnim}
                actions={actions} config={config}
              />
              <AnswerGrid
                distractors={distractors} state={state}
                flashState={flashState} isDark={isDark}
                actions={actions} localClicked={localClicked}
                setLocalClicked={setLocalClicked}
              />
            </div>
          </React.Fragment>
        )}
      </main>

      {state.status === 'playing' && (
        <div className="w-full max-w-md flex justify-center gap-6 pb-[env(safe-area-bottom)] py-4 z-10">
          <button onClick={actions.earlyExit} className="sa-pill w-16 h-16 flex items-center justify-center font-black text-2xl hover:scale-105 transition-transform">X</button>
          <button onClick={actions.togglePause} className="sa-pill w-16 h-16 flex items-center justify-center font-black text-2xl hover:scale-105 transition-transform">{state.isPaused ? '▶' : '||'}</button>
        </div>
      )}

      <PauseOverlay state={state} actions={actions} />
    </SceneContainer>
  );
};
