
import { TargetSource, PracticeProfile, TargetDef } from '../types';

interface TargetSelectionResult {
  target: number;
  derivation: {
    operandA: number;
    operandB: number;
    explanation: string;
  };
  source: TargetSource;
  sequenceIndex: number;
  timestamp: number;
}

export class TargetGenerator {
  private mode: TargetSource;
  private profile: PracticeProfile;
  private recipe: number[];
  private currentIndex: number = -1;

  constructor(mode: TargetSource, profile: PracticeProfile, recipe: number[]) {
    this.mode = mode;
    this.profile = profile;
    this.recipe = recipe;
  }

  public next(): TargetDef {
    this.currentIndex++;
    return this.generate();
  }

  public prev(): TargetDef | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.generate();
    }
    return null;
  }

  public current(): TargetDef {
    if (this.currentIndex < 0) this.currentIndex = 0;
    return this.generate();
  }

  private generate(): TargetDef {
    const selection = this.selectTarget();
    return {
      val: selection.target,
      derivation: selection.derivation.explanation,
      source: selection.source
    };
  }

  private selectTarget(): TargetSelectionResult {
    const timestamp = Date.now();
    
    if (this.mode === TargetSource.RECIPE) {
      const safeRecipe = (this.recipe && this.recipe.length > 0) ? this.recipe : [12];
      const idx = this.currentIndex % safeRecipe.length;
      const target = safeRecipe[idx];
      return {
        target,
        derivation: {
          operandA: 0, 
          operandB: 0,
          explanation: `Recipe #${idx + 1}`
        },
        source: TargetSource.RECIPE,
        sequenceIndex: idx,
        timestamp
      };
    } 
    
    if (this.mode === TargetSource.PRACTICE) {
      const multipliers = this.profile.multipliers;
      const validMultipliers = (multipliers && multipliers.length > 0) ? multipliers : [2, 3, 4, 5];
      
      const m = validMultipliers[Math.floor(Math.random() * validMultipliers.length)];
      const range = this.profile.coMultiplierRange || [2, 12];
      const co = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
      const target = m * co;

      return {
        target,
        derivation: {
          operandA: m,
          operandB: co,
          explanation: `${m} × ${co}`
        },
        source: TargetSource.PRACTICE,
        sequenceIndex: this.currentIndex,
        timestamp
      };
    }

    const target = Math.floor(Math.random() * 90) + 10;
    return {
      target,
      derivation: {
        operandA: 0,
        operandB: 0,
        explanation: 'Free Play'
      },
      source: TargetSource.FREE_PLAY,
      sequenceIndex: this.currentIndex,
      timestamp
    };
  }
}
