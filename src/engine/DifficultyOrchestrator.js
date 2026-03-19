// ============================================================
// MODULE: DifficultyOrchestrator
// PURPOSE: Adaptive difficulty engine. Tracks skill level across
//   a session and produces per-step difficulty profiles.
// INVARIANT: Singleton — reset() is called on START_GAME.
// ============================================================
import { clamp } from './mathUtils.js';
import { PhaseScheduler } from './PhaseScheduler.js';

class DifficultyOrchestrator {
  constructor() { this.reset(); }

  getRandomSpikeInterval() { return Math.floor(Math.random() * 3) + 7; }

  reset() {
    this.lastMode = 'normal';
    this.skill = 0.5;
    this.last10Results = [];
    this.stepsSinceLastSpike = 0;
    this.nextSpikeInterval = this.getRandomSpikeInterval();
  }

  recordStepResult(correct) {
    const perf = correct ? 1 : 0;
    this.skill = this.skill * 0.9 + perf * 0.1;
    this.last10Results.push(perf);
    if (this.last10Results.length > 10) this.last10Results.shift();
  }

  getNextStepProfile(stepIndex, totalSteps, phaseSequence) {
    const mode = PhaseScheduler.getModeForStep(stepIndex, phaseSequence);
    const progress = totalSteps > 0 ? clamp(stepIndex / totalSteps, 0, 1) : 0;
    const k = 8, midpoint = 0.65;
    const logisticProgress = 1 / (1 + Math.exp(-k * (progress - midpoint)));

    let accuracy = 0.5;
    if (this.last10Results.length > 0) {
      const sum = this.last10Results.reduce((a, b) => a + b, 0);
      accuracy = sum / this.last10Results.length;
    }
    const skillAdjustment = 0.7 + accuracy * 0.6;
    let difficulty = clamp(logisticProgress * skillAdjustment, 0, 1);

    this.stepsSinceLastSpike++;
    if (this.stepsSinceLastSpike >= this.nextSpikeInterval) {
      difficulty += 0.1;
      this.stepsSinceLastSpike = 0;
      this.nextSpikeInterval = this.getRandomSpikeInterval();
    }
    difficulty = clamp(difficulty, 0, 1);

    const timerSeconds = Math.max(5, 12 - difficulty * 7);
    const rangeMax = Math.round(5 + difficulty * 20);
    let modifiersMax = 1;
    if (difficulty < 0.45) modifiersMax = 1;
    else if (difficulty < 0.85) modifiersMax = (stepIndex % 2 === 0) ? 1 : 2;
    else modifiersMax = (stepIndex % 2 === 0) ? 2 : 3;

    this.lastMode = mode;
    return {
      mode,
      tier: {
        startStep: stepIndex, rangeMax, modifiersMax,
        distractorCount: Math.round(1 + difficulty * 2),
        allowVariables: difficulty > 0.80,
        allowComplexOps: difficulty > 0.6,
        recommendedDarkTimer: timerSeconds
      }
    };
  }

  calculateLoad() { return {}; }
}

export const orchestrator = new DifficultyOrchestrator();
