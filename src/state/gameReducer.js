// ============================================================
// MODULE: gameReducer
// PURPOSE: Master state machine for the application.
// CONTRACT: Pure state transitions based on UI/Timer events.
// SIDE EFFECTS: Mutates global singletons statsTracker and orchestrator during transitions.
// INVARIANTS / LOCKED RULES:
//   - DO NOT mutate state.steps array.
//   - State transitions must remain: 'idle' -> 'playing' -> 'finished'.
// ============================================================
import { Telemetry } from '../engine/Telemetry.js';
import { statsTracker } from '../engine/StatsTracker.js';
import { orchestrator } from '../engine/DifficultyOrchestrator.js';
import { ProblemGenerator } from '../engine/ProblemGenerator.js';
import { EngineContractValidator } from '../engine/EngineContractValidator.js';
import { PhaseScheduler } from '../engine/PhaseScheduler.js';
import { saveHighScore } from '../engine/config.js';
import { getRandomInt } from '../engine/mathUtils.js';
import { gameEngine } from './gameEngine.js';

export const GameStateMachine = {
  isValidTransition(from, to) {
    if (from === 'idle')     return to === 'playing';
    if (from === 'playing')  return to === 'paused' || to === 'finished' || to === 'playing';
    if (from === 'paused')   return to === 'playing' || to === 'finished';
    if (from === 'finished') return to === 'playing' || to === 'idle';
    return false;
  },
  canSubmitAnswer(status, isEffectActive) { return status === 'playing' && !isEffectActive; }
};

export const gameReducer = (state, action) => {
  const step = state.steps && state.steps[state.stepIndex];
  const isSystemTick = ['TICK', 'TOGGLE_PAUSE', 'CLEAR_EFFECTS', 'CLEAR_INIT_ERROR', 'EARLY_EXIT'].includes(action.type);

  // Dark mode blocks all input except SUBMIT_ANSWER and TIMEOUT
  if (state.status === 'playing' && step && step.mode === 'dark' && !isSystemTick) {
    if (action.type !== 'SUBMIT_ANSWER' && action.type !== 'TIMEOUT') return state;
  }

  switch (action.type) {
    case 'START_GAME': {
      if (!GameStateMachine.isValidTransition(state.status, 'playing')) return state;
      statsTracker.reset(); orchestrator.reset(); gameEngine.currentStepIndex = -1;

      let startNum = getRandomInt(action.config.rangeMin, action.config.rangeMax);
      if (action.config.learningMode === 'skipcount') {
        const sb = action.config.skipBase || 7;
        const rMin = action.config.rangeMin || 0;
        const rMax = action.config.rangeMax || 100;
        let startMultMin = Math.ceil(rMin / sb);
        let startMultMax = Math.floor(rMax / sb);
        if (startMultMin > startMultMax) startMultMax = startMultMin;
        startNum = sb * getRandomInt(startMultMin, startMultMax);
      }

      const steps = ProblemGenerator.generateSequence(startNum, action.config);
      if (!steps) return { ...state, status: 'idle', initError: 'Generator failed to create a valid step path.' };

      const initNum = steps[0].startNumber !== undefined ? steps[0].startNumber : startNum;
      const distractors = ProblemGenerator.generateDistractors(steps[0].correctAnswer, steps[0], action.config);
      EngineContractValidator.validateGeneratedStep(steps[0], distractors);

      return {
        status: 'playing', currentNumber: initNum, stepIndex: 0, steps,
        errorCount: 0, elapsedTime: 0, isPaused: false,
        lives: action.config.activeMode === 'survival' ? 3 : 999,
        distractors, flashState: null, shake: false, lastEvent: 'start', initError: null, timedOutLocked: false
      };
    }

    case 'TICK':
      return (!GameStateMachine.canSubmitAnswer(state.status, false) || state.isPaused)
        ? state : { ...state, elapsedTime: state.elapsedTime + 1 };

    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused };

    case 'SUBMIT_ANSWER': {
      if (!GameStateMachine.canSubmitAnswer(state.status, !!state.flashState)) return state;
      const step = state.steps[state.stepIndex];
      const isCorrect = action.answer === step.correctAnswer;

      if (action.config.progressionMode === 'adaptive') orchestrator.recordStepResult(isCorrect);

      if (isCorrect) {
        statsTracker.recordCorrect(state.stepIndex + 1, step.mode, step);
        if (state.stepIndex >= state.steps.length - 1) {
          saveHighScore(statsTracker.getFinalStats().correct, state.steps.length, state.elapsedTime);
          return { ...state, status: 'finished', lastEvent: 'win', flashState: 'correct' };
        }
        const nextStep = state.steps[state.stepIndex + 1];
        const nxtNum = nextStep.startNumber !== undefined ? nextStep.startNumber : step.correctAnswer;
        const distractors = ProblemGenerator.generateDistractors(nextStep.correctAnswer, nextStep, action.config);
        EngineContractValidator.validateGeneratedStep(nextStep, distractors);
        return {
          ...state, currentNumber: nxtNum, stepIndex: state.stepIndex + 1,
          distractors, flashState: 'correct', timedOutLocked: false,
          lastEvent: nextStep.mode !== step.mode ? 'mode_change' : 'correct'
        };
      }

      statsTracker.recordIncorrect(state.stepIndex + 1, step.mode, step, action.answer);
      const lives = Math.max(0, state.lives - 1);
      if (action.config.activeMode === 'survival' && lives <= 0) {
        statsTracker.setEndedEarly(true);
        saveHighScore(statsTracker.getFinalStats().correct, state.steps.length, state.elapsedTime);
        return { ...state, errorCount: state.errorCount + 1, lives: 0, status: 'finished', flashState: 'incorrect', lastEvent: 'incorrect' };
      }
      return { ...state, errorCount: state.errorCount + 1, lives, flashState: 'incorrect', shake: true, lastEvent: 'incorrect' };
    }

    case 'TIMEOUT': {
      const step = state.steps[state.stepIndex];
      statsTracker.recordTimeout(state.stepIndex + 1, step.mode, step);
      if (action.config.progressionMode === 'adaptive' && step.mode !== 'dark') orchestrator.recordStepResult(false);

      if (step.mode === 'dark') {
        if (state.stepIndex >= state.steps.length - 1) {
          saveHighScore(statsTracker.getFinalStats().correct, state.steps.length, state.elapsedTime);
          return { ...state, status: 'finished', lastEvent: 'timeout' };
        }
        const nextStep = state.steps[state.stepIndex + 1];
        const nxtNum = nextStep.startNumber !== undefined ? nextStep.startNumber : step.correctAnswer;
        const distractors = ProblemGenerator.generateDistractors(nextStep.correctAnswer, nextStep, action.config);
        EngineContractValidator.validateGeneratedStep(nextStep, distractors);
        return {
          ...state, currentNumber: nxtNum, stepIndex: state.stepIndex + 1,
          distractors, timedOutLocked: false,
          lastEvent: nextStep.mode !== step.mode ? 'mode_change' : 'timeout'
        };
      } else {
        const lives = Math.max(0, state.lives - (action.config.activeMode === 'survival' ? 1 : 0));
        if (action.config.activeMode === 'survival' && lives <= 0) {
          statsTracker.setEndedEarly(true);
          saveHighScore(statsTracker.getFinalStats().correct, state.steps.length, state.elapsedTime);
          return { ...state, errorCount: state.errorCount + 1, lives: 0, status: 'finished', flashState: 'incorrect', lastEvent: 'timeout' };
        }
        return { ...state, lives, timedOutLocked: true, lastEvent: 'timeout' };
      }
    }

    case 'EARLY_EXIT':
      statsTracker.setEndedEarly(true);
      return { ...state, status: 'finished', lastEvent: 'none' };

    case 'CLEAR_EFFECTS':
      return { ...state, flashState: null, shake: false, lastEvent: 'none' };

    case 'CLEAR_INIT_ERROR':
      return { ...state, initError: null };

    default:
      return state;
  }
};

// ============================================================
// MODULE: telemetryGameReducer (Wrapper)
// PURPOSE: Intercepts gameReducer transitions to log Telemetry.
// WHY THIS EXISTS: Keeps telemetry side-effects out of the pure reducer.
// ============================================================
export const telemetryGameReducer = (state, action) => {
  const nextState = gameReducer(state, action);
  if (action.type !== 'TICK' && action.type !== 'CLEAR_EFFECTS') {
    Telemetry.log('STATE_TRANSITION', { action: action.type, nextStateStatus: nextState.status, step: nextState.stepIndex });
  }
  if (action.type === 'START_GAME') {
    Telemetry.log('SESSION_START', { config: action.config });
    Telemetry.log('SETTINGS_APPLIED', { config: action.config });
  }
  return nextState;
};
