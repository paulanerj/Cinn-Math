// ============================================================
// MODULE: StatsTracker
// PURPOSE: Tracks in-game performance for the current session.
// SIDE EFFECTS: Calls LearningProgressMap on each answer.
// INVARIANT: reset() is called on every START_GAME dispatch.
// ============================================================
import { Telemetry } from './Telemetry.js';
import { LearningProgressMap } from './LearningProgressMap.js';

class StatsTracker {
  constructor() { this.reset(); }

  reset() {
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.timeoutCount = 0;
    this.steps = [];
    this.endedEarly = false;
    this.currentStepStart = 0;
  }

  setEndedEarly(v) { this.endedEarly = v; }

  startStep() { this.currentStepStart = performance.now(); }

  isInteractive(mode) { return mode === 'normal' || mode === 'qmm'; }

  recordCorrect(stepIndex, mode, stepData) {
    if (this.isInteractive(mode)) this.correctCount++;
    const timeTaken = performance.now() - this.currentStepStart;
    this.steps.push({ step: stepIndex, correct: true, timeTakenMs: timeTaken, timedOut: false, mode });
    Telemetry.log('ANSWER_CORRECT', { timeTaken, mode, stepIndex });
    if (stepData && stepData.operation === '×') {
      LearningProgressMap.recordMultiplicationAttempt(stepData.value, stepData.startNumber, true);
    }
  }

  recordIncorrect(stepIndex, mode, stepData, selectedAnswer) {
    if (this.isInteractive(mode)) this.incorrectCount++;
    const timeTaken = performance.now() - this.currentStepStart;
    this.steps.push({ step: stepIndex, correct: false, timeTakenMs: timeTaken, timedOut: false, mode });
    Telemetry.log('ANSWER_INCORRECT', { selectedAnswer, correctValue: stepData?.correctAnswer, timeTaken });
    if (stepData && stepData.operation === '×') {
      LearningProgressMap.recordMultiplicationAttempt(stepData.value, stepData.startNumber, false);
    }
  }

  recordTimeout(stepIndex, mode, stepData) {
    const interactive = this.isInteractive(mode);
    if (interactive) this.timeoutCount++;
    this.steps.push({ step: stepIndex, correct: !interactive, timeTakenMs: performance.now() - this.currentStepStart, timedOut: true, mode });
    if (interactive && stepData && stepData.operation === '×') {
      LearningProgressMap.recordMultiplicationAttempt(stepData.value, stepData.startNumber, false);
    }
  }

  getFinalStats() {
    const total = this.steps.filter(s => this.isInteractive(s.mode)).length;
    let stars = 1;
    if (this.endedEarly) stars = 0;
    else if (this.incorrectCount === 0) stars = this.timeoutCount === 0 ? 3 : 2;
    return {
      correct: this.correctCount,
      incorrect: this.incorrectCount,
      totalAttempted: total,
      accuracy: total > 0 ? Math.round((this.correctCount / total) * 1000) / 10 : 0,
      timedOutCount: this.timeoutCount,
      stars,
      steps: [].concat(this.steps),
      endedEarly: this.endedEarly
    };
  }
}

// Singleton — reset() is called on START_GAME
export const statsTracker = new StatsTracker();
