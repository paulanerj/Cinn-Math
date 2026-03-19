// ============================================================
// MODULE: modeController
// PURPOSE: Maps game mode strings to their behavioral capability flags.
// ============================================================

export const modeController = {
  getModeConfig(mode) {
    const map = {
      normal:   { usesStepTimer: true,  usesRingTimer: true,  usesDarkStopwatch: false },
      qmm:      { usesStepTimer: true,  usesRingTimer: true,  usesDarkStopwatch: false },
      survival: { usesStepTimer: true,  usesRingTimer: true,  usesDarkStopwatch: false },
      dark:     { usesStepTimer: false, usesRingTimer: false, usesDarkStopwatch: true  },
    };
    return map[mode] || map.normal;
  }
};
