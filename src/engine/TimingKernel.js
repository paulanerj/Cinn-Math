// ============================================================
// MODULE: TimingKernel
// PURPOSE: Decoupled timer mechanism. Owns a single interval.
// INVARIANT: Singleton — only one TimingKernel exists.
// ============================================================

class TimingKernel {
  constructor() { this.stop(); }

  startStep(config) {
    this.stop();
    this.activeMode = config.mode;
    this.duration = config.durationSeconds;
    this.remaining = config.durationSeconds;
    this.callbacks = { onTick: config.onTick, onExpire: config.onExpire };
    if (this.activeMode === 'none') return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (!this.isRunning) return;
    this.remaining--;
    if (this.callbacks.onTick) this.callbacks.onTick(this.remaining, this.duration);
    if (this.remaining <= 0) {
      this.stop();
      if (this.callbacks.onExpire) this.callbacks.onExpire();
    }
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.remaining = 0;
    this.activeMode = 'none';
  }

  pause() {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  resume() {
    if (this.isRunning) return;
    if (this.activeMode !== 'none' && this.remaining > 0) {
      this.isRunning = true;
      this.intervalId = setInterval(() => this.tick(), 1000);
    }
  }

  getRemaining() { return this.remaining; }
}

export const timingKernel = new TimingKernel();
