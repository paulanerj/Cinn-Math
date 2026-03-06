
class SoundEngineClass {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  private init() {
    if (!this.enabled) return;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Universal Tone Generator
   */
  private playTone(params: {
    freq: number | number[];
    type: OscillatorType;
    duration: number;
    volume: number;
    sweep?: { to: number; time: number; type?: 'exp' | 'linear' };
    rampTime?: number;
    delay?: number;
  }) {
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime + (params.delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const ramp = params.rampTime || 0.01;

    osc.type = params.type;

    // Use a local constant to help TypeScript narrow the type of freq correctly.
    const freq = params.freq;
    if (Array.isArray(freq)) {
      freq.forEach((f, i) => {
        osc.frequency.setValueAtTime(f, t + i * (params.duration / freq.length));
      });
    } else {
      osc.frequency.setValueAtTime(freq, t);
      if (params.sweep) {
        if (params.sweep.type === 'linear') {
          osc.frequency.linearRampToValueAtTime(params.sweep.to, t + params.sweep.time);
        } else {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, params.sweep.to), t + params.sweep.time);
        }
      }
    }

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(params.volume, t + ramp);
    gain.gain.exponentialRampToValueAtTime(0.001, t + params.duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + params.duration);
  }

  private playNoise(duration: number, volume: number, filterType?: BiquadFilterType, filterFreq?: number) {
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    if (filterType) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq || 1000, t);
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(this.ctx.destination);
    source.start(t);
  }

  // --- UI & Gestures ---
  public playTap() {
    this.playTone({ freq: 1200, type: 'sine', duration: 0.05, volume: 0.1 });
  }

  public playPickup() {
    this.playTone({ freq: 300, type: 'sine', duration: 0.1, volume: 0.05, sweep: { to: 600, time: 0.1 } });
  }

  public playSnapback() {
    this.playTone({ freq: 180, type: 'triangle', duration: 0.2, volume: 0.12, sweep: { to: 60, time: 0.2 } });
  }

  public playSwap() {
    this.playTone({ freq: 440, type: 'sine', duration: 0.08, volume: 0.05, sweep: { to: 880, time: 0.08 } });
  }

  // --- Core Mechanics ---
  public playMergeStandard() {
    this.playTone({ freq: 520, type: 'sine', duration: 0.15, volume: 0.15, sweep: { to: 260, time: 0.15 } });
  }

  public playMergeTrophy() {
    // Sparkling Arpeggio
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      this.playTone({ freq: f, type: 'square', duration: 0.5, volume: 0.04, delay: i * 0.06 });
    });
  }

  public playMergeStone() {
    this.playNoise(0.2, 0.1, 'lowpass', 200);
    this.playTone({ freq: 100, type: 'square', duration: 0.25, volume: 0.2, sweep: { to: 40, time: 0.25 } });
  }

  public playZapTrigger() {
    this.playTone({ freq: 110, type: 'sawtooth', duration: 1.5, volume: 0.08, sweep: { to: 220, time: 1.5 } });
  }

  public playZapResolve() {
    this.playNoise(0.1, 0.2, 'highpass', 2000);
    this.playTone({ freq: 900, type: 'sawtooth', duration: 0.12, volume: 0.15, sweep: { to: 100, time: 0.12 } });
  }

  public playBombIgnite() {
    this.playNoise(1.5, 0.05, 'highpass', 5000); // Fuse hiss
  }

  public playBombExplode() {
    this.playNoise(0.8, 0.4, 'lowpass', 100); // Sub rumble
    this.playTone({ freq: 60, type: 'sine', duration: 0.8, volume: 0.5, sweep: { to: 20, time: 0.8 } }); // Impact
  }

  public playSpawn() {
    this.playTone({ freq: 1600, type: 'sine', duration: 0.1, volume: 0.03, sweep: { to: 800, time: 0.1 } });
  }

  // --- Sequences ---
  public playCountStep(index: number) {
    const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    const f = scale[index % scale.length] * (1 + Math.floor(index / scale.length) * 0.5);
    this.playTone({ freq: f, type: 'sine', duration: 0.25, volume: 0.08 });
  }

  public playResultsFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => {
      this.playTone({ freq: f, type: 'square', duration: 0.6, volume: 0.1, delay: i * 0.15 });
    });
  }
}

export const SoundEngine = new SoundEngineClass();
