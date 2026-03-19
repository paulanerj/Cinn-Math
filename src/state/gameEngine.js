// ============================================================
// MODULE: gameEngine
// PURPOSE: Coordinator between the React state machine and the TimingKernel.
// INVARIANT: Singleton — one instance shared across the app lifecycle.
// ============================================================
import { timingKernel } from '../engine/TimingKernel.js';
import { statsTracker } from '../engine/StatsTracker.js';
import { modeController } from './modeController.js';

export const gameEngine = {
  currentStepIndex: -1,

  startStep(config, currentModeStr, stepIndex, durationSeconds, onExpire) {
    const modeConfig = modeController.getModeConfig(currentModeStr);
    const isNewStep = stepIndex !== this.currentStepIndex;
    this.currentStepIndex = stepIndex;

    if (isNewStep) statsTracker.startStep(stepIndex + 1);
    if (!isNewStep && timingKernel.getRemaining() > 0) return timingKernel.resume();
    if (durationSeconds <= 0) return timingKernel.stop();

    if (modeConfig.usesDarkStopwatch) {
      timingKernel.startStep({ mode: 'dark', durationSeconds, onExpire });
    } else if (modeConfig.usesStepTimer && config.timerOn) {
      timingKernel.startStep({ mode: 'normal', durationSeconds, onExpire });
    } else {
      timingKernel.stop();
    }
  },

  stopAll() { timingKernel.pause(); }
};
