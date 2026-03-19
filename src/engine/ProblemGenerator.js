// ============================================================
// MODULE: ProblemGenerator
// PURPOSE: Coordinates math parameters into UI-ready steps.
// LLM GUARDRAIL: Contains hard truthfulness rules:
//   - Enforces "normal" mode during Multiplication and Pattern.
//   - Generator must clamp starting values to prevent guaranteed failures on step 1.
// ============================================================
import { Telemetry } from './Telemetry.js';
import { EngineContractValidator } from './EngineContractValidator.js';
import { getCurriculumForStep } from './Curriculum.js';
import { PhaseScheduler } from './PhaseScheduler.js';
import { orchestrator } from './DifficultyOrchestrator.js';
import { MathTraversalEngine } from './traversal/index.js';
import { getRandomInt, randomElement, applyOp, decomposeStep } from './mathUtils.js';

export const ProblemGenerator = {
  generateSequence(startNumber, config) {
    const allowedMax = (config.targetNumber ?? 20) + (config.targetFlex ?? 0);
    let safeStartNumber = startNumber;
    if (config.learningMode === 'standard') {
      safeStartNumber = Math.min(startNumber, allowedMax);
    }
    Telemetry.log('GENERATOR_START', { startNumber: safeStartNumber, mode: config.learningMode });

    if (['skipcount', 'multiplication', 'pattern'].includes(config.learningMode)) {
      return this.buildPluginSequence(safeStartNumber, config);
    }

    for (let tries = 0; tries < 250; tries++) {
      const result = this.tryGeneratePath(safeStartNumber, config.totalSteps, config);
      if (result) return result;
    }

    Telemetry.log('GENERATOR_FAILSAFE_TRIGGERED', { reason: 'Path generation exhausted tries' });
    return null;
  },

  buildPluginSequence(startNumber, config) {
    const steps = [];
    let currentValue = startNumber;
    let traversalState = {};

    for (let i = 0; i < config.totalSteps; i++) {
      let mode = PhaseScheduler.getModeForStep(i, config.phaseSequence);
      // LLM GUARDRAIL: Enforce Mode Restrictions in the Engine
      if (config.learningMode === 'multiplication' || config.learningMode === 'pattern') mode = 'normal';

      let timerSeconds = config.quickMindInterval;
      if (mode === 'dark') timerSeconds = Math.max(timerSeconds, config.darkModeInterval || 5);
      if (config.learningMode === 'pattern') timerSeconds = 0;

      const state = { currentValue, stepIndex: i, totalSteps: config.totalSteps, traversalState };
      const result = MathTraversalEngine.getNextValue(state, config);
      const nextValue = result.nextValue;
      traversalState = result.traversalState;
      const op = result.operation || '+';
      const val = result.value || 0;
      const distractorCount = (i / config.totalSteps) >= 0.5 ? 3 : 2;

      const step = {
        startNumber: result.startNumber,
        operation: op, value: val,
        modifiers: [{ operation: op, value: val, position: 'bottom' }],
        mode, variable: undefined, correctAnswer: nextValue,
        distractorCount, timerSeconds,
        meta: result.meta || {}, _curriculumBlock: null
      };

      EngineContractValidator.validateStep(step);
      steps.push(step);
      Telemetry.log('GENERATOR_STEP_CREATED', { stepIndex: i, startNumber: step.startNumber, answer: step.correctAnswer });
      currentValue = nextValue;
    }
    return steps;
  },

  tryGeneratePath(startNumber, stepsNeeded, config) {
    orchestrator.reset();
    let currentVal = startNumber;
    const steps = [];
    let lastOp = null;
    const allowedMin = config.rangeMin ?? 0;
    const allowedMax = (config.targetNumber ?? 20) + (config.targetFlex ?? 0);

    for (let i = 0; i < stepsNeeded; i++) {
      const stepNumber = i + 1;
      let mode = PhaseScheduler.getModeForStep(i, config.phaseSequence);
      if (config.learningMode === 'multiplication' || config.learningMode === 'pattern') mode = 'normal';

      let tier = {
        rangeMax: config.rangeMax, modifiersMax: config.modifiersPerStep,
        distractorCount: 2, allowVariables: false, allowComplexOps: true,
        recommendedDarkTimer: config.darkModeInterval
      };
      let timerSeconds = config.quickMindInterval;
      let opsPool = [];
      let curriculumBlock = null;

      if (config.progressionMode === 'curriculum') {
        curriculumBlock = getCurriculumForStep(stepNumber);
        tier.rangeMax = curriculumBlock.rangeMax;
        tier.modifiersMax = curriculumBlock.modifiers;
        tier.distractorCount = curriculumBlock.distractors;
        tier.allowVariables = !!curriculumBlock.variables;
        tier.allowComplexOps = curriculumBlock.operations.includes('×') || curriculumBlock.operations.includes('÷');
        timerSeconds = curriculumBlock.timer;
        opsPool = ['+', '-', '×', '÷'].filter(op => config.opsEnabled[op] && curriculumBlock.operations.includes(op));
        if (opsPool.length === 0) opsPool = ['+'];
      } else {
        const profile = orchestrator.getNextStepProfile(i, stepsNeeded, config.phaseSequence);
        tier = { ...tier, ...profile.tier };
        opsPool = Object.keys(config.opsEnabled).filter(k => config.opsEnabled[k]);
        if (!tier.allowComplexOps) opsPool = opsPool.filter(o => o === '+' || o === '-');
        if (mode === 'dark') timerSeconds = Math.max(tier.recommendedDarkTimer || 5, config.darkModeInterval);
      }

      if (config.learningMode === 'pattern') timerSeconds = 0;
      opsPool.sort(() => Math.random() - 0.5);
      let foundStep = false;

      for (const op of opsPool) {
        if (op === '×' && lastOp === '×') continue;
        const val = this.selectOpValue(op, currentVal, tier.rangeMax, allowedMin, allowedMax);
        if (val === null) continue;
        const nextVal = applyOp(currentVal, op, val);
        if (nextVal === null || !Number.isInteger(nextVal) || nextVal < allowedMin || nextVal > allowedMax) continue;

        let variable = undefined, label = undefined;
        if (tier.allowVariables && Math.random() < 0.15) {
          const x = getRandomInt(2, Math.min(9, tier.rangeMax));
          if (val === x) label = 'x';
          else if (val === x * 2) label = '2x';
          if (label) variable = { name: 'x', value: x };
        }

        const modifiers = decomposeStep(op, val, tier.modifiersMax, tier.rangeMax, label);
        if (mode === 'dark') timerSeconds = Math.max(timerSeconds, config.darkModeInterval);
        if (modifiers.length === 3 && timerSeconds > 0) timerSeconds = Math.max(timerSeconds, 7);

        const step = {
          startNumber: currentVal, operation: op, value: val, modifiers, mode, variable,
          correctAnswer: nextVal, distractorCount: tier.distractorCount, timerSeconds,
          load: {}, _curriculumBlock: curriculumBlock
        };

        EngineContractValidator.validateStep(step);
        steps.push(step);
        Telemetry.log('GENERATOR_STEP_CREATED', { stepIndex: i, startNumber: step.startNumber, answer: step.correctAnswer });
        currentVal = nextVal;
        lastOp = op;
        foundStep = true;
        break;
      }
      if (!foundStep) return null;
    }
    return steps;
  },

  selectOpValue(op, curr, rangeMax, allowedMin, allowedMax) {
    if (op === '+') return getRandomInt(1, Math.min(rangeMax, Math.max(1, allowedMax - curr)));
    if (op === '-') return Math.max(1, curr - allowedMin) < 1 ? null : getRandomInt(1, Math.min(rangeMax, curr - allowedMin));
    if (op === '×') return curr < 2 || Math.floor(allowedMax / curr) < 2 ? null : getRandomInt(2, Math.min(rangeMax, Math.floor(allowedMax / curr)));
    const candidates = [];
    for (let i = 2; i <= Math.min(rangeMax, 10); i++) {
      if (curr % i === 0 && curr / i >= allowedMin && curr / i <= allowedMax) candidates.push(i);
    }
    return candidates.length ? randomElement(candidates) : null;
  },

  generateDistractors(correct, step, config) {
    const count = step.distractorCount || 1;
    const opts = new Set([correct]);

    if (config && config.learningMode === 'skipcount') {
      const sb = config.skipBase || 7;
      const cands = [-3, -2, -1, 1, 2, 3].map(o => correct + o * sb).filter(v => v > 0).sort(() => Math.random() - 0.5);
      for (const c of cands) { if (opts.size > count) break; opts.add(c); }
      let fallbackMult = Math.max(1, Math.round(correct / sb) + 4);
      while (opts.size <= count) { opts.add(fallbackMult * sb); fallbackMult++; }
      return Array.from(opts).sort(() => Math.random() - 0.5);
    }

    if (config && config.learningMode === 'multiplication') {
      const base = config.multBase || 4;
      const factor = Math.round(correct / base);
      const cands = [-3, -2, -1, 1, 2, 3].map(o => (factor + o) * base).filter(v => v > 0).sort(() => Math.random() - 0.5);
      for (const c of cands) { if (opts.size > count) break; opts.add(c); }
      let fallbackFactor = factor + 4;
      while (opts.size <= count) { opts.add(fallbackFactor * base); fallbackFactor++; }
      return Array.from(opts).sort(() => Math.random() - 0.5);
    }

    if (config && config.learningMode === 'pattern') {
      const pStep = step.value || 3;
      const cands = [correct - pStep, correct + pStep, correct - 1, correct + 1, correct - 2, correct + 2]
        .filter(v => v > 0 && v !== correct).sort(() => Math.random() - 0.5);
      for (const c of cands) { if (opts.size > count) break; opts.add(c); }
      let fallback = correct + 10;
      while (opts.size <= count) { fallback++; if (fallback > 0) opts.add(fallback); }
      return Array.from(opts).sort(() => Math.random() - 0.5);
    }

    const cands = [-3, -2, -1, 1, 2, 3].map(o => correct + o).filter(v => v > 0 && v !== correct).sort(() => Math.random() - 0.5);
    for (const c of cands) { if (opts.size > count) break; opts.add(c); }
    let attempts = 0;
    while (opts.size <= count && attempts < 100) {
      const d = getRandomInt(Math.max(1, correct - 10), correct + 10);
      if (d > 0) opts.add(d);
      attempts++;
    }
    let fallback = correct + 10;
    while (opts.size <= count) { fallback++; if (fallback > 0) opts.add(fallback); }
    return Array.from(opts).sort(() => Math.random() - 0.5);
  }
};
