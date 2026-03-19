// ============================================================
// MODULE: multiplicationTraversal
// PURPOSE: Phase-based traversal for multiplication table practice.
//   Phase A (ascend): 1×base, 2×base, ... maxFactor×base
//   Phase B (descend): walks back down.
//   Phase C (mixed): random adjacent factors to challenge recall.
// NOTE: startNumber = factor (not the product), so UI displays "factor × base = ?"
// ============================================================
import { Telemetry } from '../Telemetry.js';

export const multiplicationTraversal = (state, config) => {
  const base = config.multBase || 4;
  const minF = 1;
  const maxF = Math.max(2, config.multMaxFactor || 12);
  let tState = state.traversalState || {};

  if (state.stepIndex === 0 || !tState.phase) {
    tState = {
      phase: 'ascend', currentFactor: minF - 1, minFactor: minF, maxFactor: maxF,
      hasReachedMax: false, hasReturnedToMin: false, coverageCyclesCompleted: 0, recentFactors: []
    };
  } else {
    tState.minFactor = minF; tState.maxFactor = maxF;
    if (tState.currentFactor > maxF) tState.currentFactor = maxF;
    if (tState.currentFactor < minF) tState.currentFactor = minF;
  }

  let prevFactor = tState.currentFactor;
  let nextFactor;
  let oldPhase = tState.phase;

  if (tState.phase === 'ascend') {
    nextFactor = prevFactor + 1;
    if (nextFactor >= tState.maxFactor) {
      nextFactor = tState.maxFactor; tState.phase = 'descend'; tState.hasReachedMax = true;
    }
  } else if (tState.phase === 'descend') {
    nextFactor = prevFactor - 1;
    if (nextFactor <= tState.minFactor) {
      nextFactor = tState.minFactor; tState.phase = 'mixed';
      tState.hasReturnedToMin = true; tState.coverageCyclesCompleted += 1;
    }
  } else {
    let candidates = [prevFactor + 1, prevFactor - 1, prevFactor + 2, prevFactor - 2]
      .filter(f => f >= tState.minFactor && f <= tState.maxFactor && f !== prevFactor);
    let valid = candidates.filter(f => !(tState.recentFactors || []).includes(f));
    if (valid.length === 0) valid = candidates;
    if (valid.length === 0) {
      nextFactor = tState.maxFactor === tState.minFactor ? tState.minFactor :
        (prevFactor === tState.maxFactor ? prevFactor - 1 : prevFactor + 1);
    } else {
      let step1 = valid.filter(f => Math.abs(f - prevFactor) === 1);
      let step2 = valid.filter(f => Math.abs(f - prevFactor) === 2);
      if (Math.random() < 0.60 && step1.length > 0) nextFactor = step1[Math.floor(Math.random() * step1.length)];
      else if (step2.length > 0) nextFactor = step2[Math.floor(Math.random() * step2.length)];
      else nextFactor = valid[Math.floor(Math.random() * valid.length)];
    }
  }

  if (oldPhase !== tState.phase) {
    Telemetry.log('TRAVERSAL_PHASE_CHANGE', { base, factor: nextFactor, oldPhase, newPhase: tState.phase });
  }
  Telemetry.log('TRAVERSAL_DECISION', { base, prevFactor, nextFactor, phase: tState.phase, moveSize: nextFactor - prevFactor });

  tState.recentFactors = tState.recentFactors || [];
  tState.recentFactors.push(nextFactor);
  if (tState.recentFactors.length > 4) tState.recentFactors.shift();
  tState.currentFactor = nextFactor;

  return {
    startNumber: nextFactor,       // factor shown in center circle
    nextValue: nextFactor * base,  // correct answer
    operation: '×',
    value: base,
    traversalState: tState,
    meta: {}
  };
};
