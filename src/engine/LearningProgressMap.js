// ============================================================
// MODULE: LearningProgressMap
// PURPOSE: Adaptive knowledge tracking. Tracks which specific math facts are mastered.
// CONTRACT:
//   - INPUTS: base (e.g. 7), factor (e.g. 4), boolean correctness.
//   - SIDE EFFECTS: Reads/Writes to localStorage ('speedMathProgress'). Emits Telemetry.
// INVARIANTS / LOCKED RULES:
//   - Mastery requires: attempts >= 5 AND correct rate >= 90% AND streak >= 3.
// WHY THIS EXISTS: Provides the data layer required for Adaptive Traversal
//   (so the engine can hunt for weak facts later).
// ============================================================
import { Telemetry } from './Telemetry.js';

const STORAGE_KEY_PROGRESS = 'speedMathProgress';

export const LearningProgressMap = {
  load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS)) || { multiplication: {} }; }
    catch(e) { return { multiplication: {} }; }
  },
  save(data) { localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(data)); },

  recordMultiplicationAttempt(base, factor, isCorrect) {
    const data = this.load();
    const key = `${base}x${factor}`;
    if (!data.multiplication[key]) {
      data.multiplication[key] = { attempts: 0, correct: 0, streak: 0, lastSeen: null };
    }
    const rec = data.multiplication[key];
    rec.attempts += 1;
    if (isCorrect) { rec.correct += 1; rec.streak += 1; } else { rec.streak = 0; }
    rec.lastSeen = Date.now();
    this.save(data);
    const isNowMastered = this.isMastered(base, factor);
    Telemetry.log('MASTERY_UPDATE', { factKey: key, attempts: rec.attempts, correct: rec.correct, streak: rec.streak, mastered: isNowMastered });
  },

  isMastered(base, factor) {
    const data = this.load();
    const key = `${base}x${factor}`;
    const rec = data.multiplication[key];
    if (!rec) return false;
    return rec.attempts >= 5 && (rec.correct / rec.attempts) >= 0.9 && rec.streak >= 3;
  },

  getMultiplicationMastery(base) {
    const data = this.load();
    let res = { mastered: 0, learning: 0, weak: 0 };
    for (let i = 1; i <= 12; i++) {
      const rec = data.multiplication[`${base}x${i}`];
      if (!rec) res.weak++;
      else if (this.isMastered(base, i)) res.mastered++;
      else if (rec.correct / rec.attempts < 0.6) res.weak++;
      else res.learning++;
    }
    return res;
  }
};
