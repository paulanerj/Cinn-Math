// ============================================================
// MODULE: XPTracker
// PURPOSE: Calculates and persists out-of-game XP and level progression.
// ============================================================
import { STORAGE_KEY_XP } from './config.js';

export const XPTracker = {
  load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_XP)) || {}; }
    catch(e) { return {}; }
  },
  save(data) { localStorage.setItem(STORAGE_KEY_XP, JSON.stringify(data)); },

  awardSessionXP(stats, mode) {
    const data = this.load();
    if (!data[mode]) data[mode] = { xp: 0, level: 1, bestStreak: 0, bestAccuracy: 0, sessionsPlayed: 0 };
    const mData = data[mode];

    let earned = stats.correct * 5;
    if (stats.incorrect === 0 && stats.timedOutCount === 0 && stats.totalAttempted > 0 && !stats.endedEarly) earned += 25;
    if (stats.accuracy >= 90) earned += 15;
    else if (stats.accuracy >= 75) earned += 8;
    if (!stats.endedEarly) earned += 10;

    let maxStreak = 0; let curStreak = 0;
    stats.steps.forEach(s => {
      if (s.correct) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
      else curStreak = 0;
    });
    if (maxStreak >= 10) earned += 10;

    mData.xp += earned;
    mData.level = Math.floor(mData.xp / 100) + 1;
    mData.bestStreak = Math.max(mData.bestStreak, maxStreak);
    mData.bestAccuracy = Math.max(mData.bestAccuracy, stats.accuracy);
    mData.sessionsPlayed += 1;

    this.save(data);
    return {
      earned, total: mData.xp, level: mData.level,
      progress: mData.xp % 100,
      bestStreak: mData.bestStreak, bestAccuracy: mData.bestAccuracy
    };
  }
};
