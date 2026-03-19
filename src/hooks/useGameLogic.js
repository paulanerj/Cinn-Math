import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { SettingsStore } from '../engine/config.js';
import { statsTracker } from '../engine/StatsTracker.js';
import { XPTracker } from '../engine/XPTracker.js';
import { timingKernel } from '../engine/TimingKernel.js';
import { PhaseScheduler } from '../engine/PhaseScheduler.js';
import { modeController } from '../state/modeController.js';
import { gameEngine } from '../state/gameEngine.js';
import { telemetryGameReducer } from '../state/gameReducer.js';
import { useSound } from './useSound.js';

const INITIAL_STATE = {
  status: 'idle', currentNumber: 0, stepIndex: 0, steps: [],
  errorCount: 0, elapsedTime: 0, isPaused: false, lives: 3,
  distractors: [], flashState: null, shake: false, lastEvent: 'none',
  initError: null, timedOutLocked: false
};

export const useGameLogic = () => {
  const [config, setConfigState] = useState(() => SettingsStore.load());
  const setConfig = (newConfig) => { setConfigState(newConfig); SettingsStore.save(newConfig); };

  const [state, dispatch] = useReducer(telemetryGameReducer, INITIAL_STATE);

  const currentStep = state.steps && state.steps[state.stepIndex] ? state.steps[state.stepIndex] : null;
  const currentMode = currentStep ? currentStep.mode : config.activeMode;

  const [internalLastEvent, setInternalLastEvent] = useState(state.lastEvent);
  const sound = useSound(config.isMuted, internalLastEvent, currentMode === 'dark' && state.status === 'playing');

  const [pulseActive, setPulseActive] = useState(false);
  const requestRef = useRef(null);
  const darkStepAdvanceFiredRef = useRef(false);
  const [sessionXP, setSessionXP] = useState(null);
  const xpAwardedRef = useRef(false);
  const configRef = useRef(config);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { darkStepAdvanceFiredRef.current = false; }, [state.stepIndex]);

  // Clear visual effects after 400ms
  useEffect(() => {
    if (state.flashState || state.shake || state.lastEvent !== 'none') {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_EFFECTS' }), 400);
      return () => clearTimeout(t);
    }
  }, [state.flashState, state.shake, state.lastEvent]);

  useEffect(() => setInternalLastEvent(state.lastEvent), [state.lastEvent]);

  // Pulse on step advance
  useEffect(() => {
    if (state.status === 'playing') {
      setPulseActive(true);
      setInternalLastEvent('step_advance');
      const t = setTimeout(() => { setPulseActive(false); setInternalLastEvent('none'); }, 300);
      return () => clearTimeout(t);
    }
  }, [state.stepIndex]);

  // Elapsed time via rAF
  useEffect(() => {
    if (state.status !== 'playing' || state.isPaused) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }
    let lastTime = performance.now();
    const loop = (time) => {
      if (time - lastTime >= 1000) { dispatch({ type: 'TICK' }); lastTime = time; }
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [state.status, state.isPaused]);

  // Timer kernel lifecycle
  useEffect(() => {
    if (state.status === 'playing' && !state.isPaused && !state.flashState && currentStep) {
      if (currentMode !== 'dark' && state.timedOutLocked) { gameEngine.stopAll(); return; }
      const onExpire = () => {
        if (timingKernel.getRemaining() <= 0) dispatch({ type: 'TIMEOUT', config: configRef.current });
      };
      gameEngine.startStep(config, currentMode, state.stepIndex, currentStep.timerSeconds, onExpire);
    } else { gameEngine.stopAll(); }
    return () => gameEngine.stopAll();
  }, [state.stepIndex, state.status, state.isPaused, state.flashState, config, currentMode, currentStep, state.timedOutLocked]);

  // XP award on session end
  useEffect(() => {
    if (state.status === 'finished' && !xpAwardedRef.current) {
      xpAwardedRef.current = true;
      const stats = statsTracker.getFinalStats();
      const xpData = XPTracker.awardSessionXP(stats, config.learningMode);
      setSessionXP(xpData);
    }
    if (state.status === 'playing') { xpAwardedRef.current = false; setSessionXP(null); }
  }, [state.status, config.learningMode]);

  const startGame = useCallback((newConfig) => {
    const activeConfig = newConfig || config;
    if (newConfig) setConfig(newConfig);
    dispatch({ type: 'START_GAME', config: activeConfig });
  }, [config]);

  const advanceDarkStepNow = useCallback(() => {
    const cStep = state.steps && state.steps[state.stepIndex];
    if (!cStep || cStep.mode !== 'dark' || state.status !== 'playing' || state.isPaused || state.flashState) return;
    if (darkStepAdvanceFiredRef.current) return;
    darkStepAdvanceFiredRef.current = true;
    gameEngine.stopAll();
    dispatch({ type: 'TIMEOUT', config: configRef.current });
  }, [state.status, state.isPaused, state.flashState, state.steps, state.stepIndex]);

  const modeConfig = modeController.getModeConfig(currentMode);
  const finalResults = state.status === 'finished' ? statsTracker.getFinalStats() : null;

  const getActiveScene = () => {
    const step = state.stepIndex + 1;
    if (step <= 10) return 'sky';
    if (step <= 20) return 'sunset';
    if (step <= 30) return 'night';
    return 'space';
  };

  return {
    config,
    state: { ...state, currentMode },
    distractors: state.distractors,
    flashState: state.flashState,
    opUpdateAnim: pulseActive,
    sound,
    shake: state.shake,
    modeConfig,
    finalResults,
    sessionXP,
    activeScene: getActiveScene(),
    actions: {
      startGame,
      handleAnswer: (ans) => dispatch({ type: 'SUBMIT_ANSWER', answer: ans, config }),
      togglePause: () => dispatch({ type: 'TOGGLE_PAUSE' }),
      setConfig,
      earlyExit: () => dispatch({ type: 'EARLY_EXIT', config }),
      clearInitError: () => dispatch({ type: 'CLEAR_INIT_ERROR' }),
      advanceDarkStepNow
    }
  };
};
