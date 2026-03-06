
import { GridEngine, PracticeProfile, EngineTile } from '../../../../src/engine/public';

// Singleton instance of the shared engine for this game module
const sharedEngine = new GridEngine();

export const PlatformEngineAdapter = {
  startPractice(multipliers: number[], coMin: number, coMax: number) {
    const profile = new PracticeProfile(multipliers, coMin, coMax);
    sharedEngine.startPractice(profile);
  },

  startRecipe(recipe: number[]) {
    sharedEngine.startRecipe(recipe);
  },

  startFreePlay() {
    sharedEngine.startFreePlay();
  },

  nextTarget(): number {
    return sharedEngine.nextTarget();
  },

  prevTarget(): number {
    return sharedEngine.prevTarget();
  },

  currentTarget(): number {
    return sharedEngine.currentTarget();
  },

  startRound(target: number, rows: number, cols: number, practiceSet: number[]) {
    sharedEngine.startRound(target, rows, cols, practiceSet);
  },

  getGrid(rows: number, cols: number): EngineTile[][] {
    return sharedEngine.getInitialGrid(rows, cols);
  },

  getRefillTile(): EngineTile {
    return sharedEngine.getRefillTile();
  }
};
