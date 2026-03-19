import { useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================
// MODULE: useSound
// PURPOSE: Bridges the Web Audio API to React's render cycle.
// LLM GUARDRAIL: Audio context requires user gesture to un-suspend.
//   tickIntervalRef uses native window.setInterval because React's
//   hook lifecycle breaks rhythmic audio.
// ============================================================
export const useSound = (isMuted, lastEvent, isTickingNeeded) => {
  const audioCtxRef = useRef(null);
  const tickIntervalRef = useRef(null);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtxRef.current = new AudioContextClass();
    return () => { if (audioCtxRef.current) audioCtxRef.current.close(); };
  }, []);

  const playTone = useCallback((freq, type, duration, startTime = 0, vol = 0.1) => {
    if (isMuted || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration);
  }, [isMuted]);

  const sounds = useMemo(() => ({
    correct:      () => { playTone(880, 'sine', 0.1); playTone(1760, 'sine', 0.1, 0.1); },
    incorrect:    () => { playTone(150, 'sawtooth', 0.3); },
    modeChange:   () => { playTone(440, 'sine', 0.1, 0); playTone(554, 'sine', 0.1, 0.1); playTone(659, 'sine', 0.4, 0.2); },
    click:        () => { playTone(600, 'triangle', 0.05); },
    win:          () => { playTone(523, 'sine', 0.5, 0); playTone(659, 'sine', 0.5, 0); playTone(783, 'sine', 0.5, 0); playTone(1046, 'sine', 0.8, 0.1); },
    stepComplete: () => { playTone(1200, 'sine', 0.08, 0, 0.04); }
  }), [playTone]);

  useEffect(() => {
    if (isMuted) return;
    switch (lastEvent) {
      case 'correct':     sounds.correct(); break;
      case 'incorrect':   sounds.incorrect(); break;
      case 'mode_change': sounds.modeChange(); break;
      case 'win':         sounds.win(); break;
      case 'start':       sounds.modeChange(); break;
      case 'step_advance': sounds.stepComplete(); break;
    }
  }, [lastEvent, isMuted, sounds]);

  useEffect(() => {
    if (isMuted || !isTickingNeeded) {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return;
    }
    const tickCallback = () => playTone(800, 'square', 0.05, 0, 0.02);
    if (!tickIntervalRef.current) {
      tickCallback();
      tickIntervalRef.current = window.setInterval(tickCallback, 1000);
    }
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [isMuted, isTickingNeeded, playTone]);

  return { playButtonClick: sounds.click };
};
