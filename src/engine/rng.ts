
export class DeterministicRNG {

  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    // LCG constants (Numerical Recipes)
    this.state =
      (1664525 * this.state + 1013904223) >>> 0;

    return this.state / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(
      this.next() * (max - min + 1)
    ) + min;
  }

  getSeed(): number {
    return this.state;
  }

}
