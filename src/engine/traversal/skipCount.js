// ============================================================
// MODULE: skipCountTraversal
// PURPOSE: Phase-based traversal for skip counting practice.
//   Phase A (ascend): walks up multiples of base.
//   Phase B (descend): walks back down.
//   Phase C (mixed): random adjacent steps to challenge recall.
// ============================================================
import { Telemetry } from '../Telemetry.js';

export const skipCountTraversal = (state, config) => {
  const base = config.skipBase || 7;
  let rMin = config.rangeMin !== undefined ? config.rangeMin : 0;
  let rMax = config.rangeMax !== undefined ? config.rangeMax : 100;
  let minF = Math.max(1, Math.ceil(rMin / base));
  let maxF = Math.max(minF + 1, Math.floor(rMax / base));
  let tState = state.traversalState || {};

  if (state.stepIndex === 0 || !tState.phase) {
    tState = {
      phase: 'ascend', currentFactor: minF, minFactor: minF, maxFactor: maxF,
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
  tState.recentFactors.push(prevFactor);
  if (tState.recentFactors.length > 4) tState.recentFactors.shift();
  tState.currentFactor = nextFactor;

  let startValue = prevFactor * base;
  let nextValue = nextFactor * base;
  let move = nextValue - startValue;

  return {
    startNumber: startValue,
    nextValue: nextValue,
    operation: move >= 0 ? '+' : '-',
    value: Math.abs(move),
    traversalState: tState,
    meta: {}
  };
};
