// ============================================================
// MODULE: PhaseScheduler
// PURPOSE: Maps a step index to a game mode string by looping
//   through the configured phaseSequence array.
// CONTRACT: Pure function — no side-effects.
// ============================================================

export const PhaseScheduler = {
  getModeForStep(stepIndex, phaseSequence) {
    if (!phaseSequence || phaseSequence.length === 0) return 'normal';
    const loopLength = phaseSequence.reduce((acc, p) => acc + p.count, 0);
    if (loopLength === 0) return 'normal';
    let pos = stepIndex % loopLength;
    for (const phase of phaseSequence) {
      if (pos < phase.count) return phase.mode;
      pos -= phase.count;
    }
    return 'normal';
  }
};
