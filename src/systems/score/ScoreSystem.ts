
export class ScoringSystem {
  private score: number = 0;

  addScore(chainLength: number, targetValue: number) {
    const multiplier = Math.max(1, chainLength - 1);
    const points = targetValue * multiplier;
    this.score += points;
    return points;
  }

  getScore() {
    return this.score;
  }

  reset() {
    this.score = 0;
  }
}
