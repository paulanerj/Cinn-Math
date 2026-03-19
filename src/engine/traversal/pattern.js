// ============================================================
// MODULE: patternTraversal
// PURPOSE: Generates arithmetic sequences for "continue the pattern" questions.
//   Sequence direction (ascending/descending) is controlled by progress through session.
// ============================================================

export const patternTraversal = (state, config) => {
  const stepSize = config.patternStep || 3;
  const maxVal = config.patternMaxValue || 60;
  const len = config.patternLength || 4;
  const allowRev = config.patternAllowReverse ?? true;
  const { stepIndex, totalSteps } = state;
  const progress = totalSteps > 0 ? stepIndex / totalSteps : 0;
  let isReverse = allowRev && progress >= 0.5 && Math.random() > 0.5;

  let actualStep = stepSize;
  if (progress >= 0.33) actualStep = stepSize + Math.floor(Math.random() * 3);

  let start, sequence, nextValue;
  if (isReverse) {
    let maxStart = maxVal;
    let minStart = actualStep * len + 1;
    if (minStart > maxStart) maxStart = minStart + 10;
    start = Math.floor(Math.random() * (maxStart - minStart)) + minStart;
    sequence = Array.from({ length: len - 1 }, (_, i) => start - i * actualStep);
    nextValue = start - (len - 1) * actualStep;
  } else {
    let maxStart = maxVal - (actualStep * len);
    if (maxStart < 1) maxStart = 10;
    start = Math.floor(Math.random() * Math.max(1, maxStart)) + 1;
    sequence = Array.from({ length: len - 1 }, (_, i) => start + i * actualStep);
    nextValue = start + (len - 1) * actualStep;
  }

  return {
    startNumber: start,
    nextValue: nextValue,
    operation: 'pattern',
    value: actualStep,
    meta: { sequence, isReverse },
    traversalState: {}
  };
};
