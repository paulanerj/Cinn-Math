// PURPOSE: Shared pure math helpers used across the engine.
// CONTRACT: No side-effects, no imports, no state.

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const applyOp = (a, op, b) =>
  op === '+' ? a + b :
  op === '-' ? a - b :
  op === '×' ? a * b :
  (a % b === 0 ? a / b : null);

// PURPOSE: Splits a single net operation into 1-3 visible modifier bubbles.
// INVARIANTS: If op is × or ÷, always returns a single modifier regardless of count.
export const decomposeStep = (op, val, count, rangeMax, variableLabel) => {
  if (variableLabel) return [{ operation: op, value: val, text: variableLabel, position: 'bottom' }];
  if (op === '×' || op === '÷' || count === 1) return [{ operation: op, value: val, position: 'bottom' }];
  const net = op === '+' ? val : -val;
  const makeMod = (n, pos) => ({ operation: n >= 0 ? '+' : '-', value: Math.abs(n), position: pos });
  let pA = getRandomInt(net - rangeMax, net + rangeMax) || 1;
  if (count === 2) return [makeMod(pA, 'left'), makeMod(net - pA, 'right')];
  let pB = getRandomInt((net - pA) - rangeMax, (net - pA) + rangeMax) || 1;
  return [makeMod(pA, 'left'), makeMod(pB, 'right'), makeMod(net - pA - pB, 'bottom')];
};
