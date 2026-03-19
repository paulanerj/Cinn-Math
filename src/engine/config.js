// ============================================================
// MODULE: App Configuration & Storage
// PURPOSE: Schema definition for game rules and persistence.
// ============================================================

export const DEFAULT_CONFIG = {
  learningMode: 'standard',
  skipBase: 7, skipMaxStep: 2, skipPresentationStyle: 'mixed', skipOscillation: true,
  multBase: 4, multMaxFactor: 12, multMaxStep: 2, multAllowReverse: true,
  patternStep: 3, patternMaxValue: 60, patternLength: 4, patternAllowReverse: true,
  presentationMode: 'standard', progressionMode: 'curriculum', scriptId: 'beginner_addition_10',
  rangeMin: 2, rangeMax: 70, totalSteps: 50, targetNumber: 20, targetFlex: 0,
  opsEnabled: { '+': true, '-': true, '×': true, '÷': true },
  isMuted: false, timerOn: true, quickMindInterval: 10, darkModeInterval: 5,
  modifiersPerStep: 2, activeMode: 'normal', enableVariables: false, stopwatchSkin: 'cinnamoroll',
  phaseSequence: [
    { mode: 'normal', count: 3 },
    { mode: 'qmm',    count: 3 },
    { mode: 'dark',   count: 3 },
    { mode: 'qmm',    count: 5 },
  ]
};

export const STORAGE_KEY_SETTINGS = 'speedMathSettings';
export const STORAGE_KEY_SCORES   = 'speedMathHighScores';
export const STORAGE_KEY_XP       = 'sa_xp_data';

export const SettingsStore = {
  load() {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      const saved = savedRaw ? JSON.parse(savedRaw) : {};
      return {
        ...DEFAULT_CONFIG,
        ...saved,
        opsEnabled: { ...DEFAULT_CONFIG.opsEnabled, ...(saved.opsEnabled || {}) },
        phaseSequence: saved.phaseSequence || DEFAULT_CONFIG.phaseSequence
      };
    } catch(e) { return { ...DEFAULT_CONFIG }; }
  },
  save(config) { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(config)); }
};

export const getHighScores = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SCORES) || '[]'); }
  catch(e) { return []; }
};

export const saveHighScore = (score, totalSteps, time) => {
  const existing = getHighScores();
  existing.push({ date: new Date().toLocaleDateString(), score, totalSteps, time });
  existing.sort((a, b) => {
    const ratioA = a.score / a.totalSteps, ratioB = b.score / b.totalSteps;
    if (ratioA !== ratioB) return ratioB - ratioA;
    return a.time - b.time;
  });
  localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(existing.slice(0, 5)));
};
