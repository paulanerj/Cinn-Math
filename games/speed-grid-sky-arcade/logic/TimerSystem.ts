
export class TimerSystem {
  private timeLeft: number;
  private timerId: number | null = null;
  private onTick: (time: number) => void;
  private onEnd: () => void;

  constructor(durationSeconds: number, onTick: (t: number) => void, onEnd: () => void) {
    this.timeLeft = durationSeconds;
    this.onTick = onTick;
    this.onEnd = onEnd;
  }

  start() {
    if (this.timerId) return;
    this.timerId = window.setInterval(() => {
      this.timeLeft--;
      this.onTick(this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stop();
        this.onEnd();
      }
    }, 1000);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  addTime(seconds: number) {
    this.timeLeft += seconds;
    this.onTick(this.timeLeft);
  }

  getTime(): number {
    return this.timeLeft;
  }
}
