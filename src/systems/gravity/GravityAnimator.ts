import { GridMatrix, GravitySystem } from './GravitySystem';

export type AnimFrame = {
  grid: GridMatrix;
  tick: number;
};

export type GravityAnimation = {
  frames: AnimFrame[];
  totalTicks: number;
};

/**
 * GravityAnimator — produces a sequence of animation frames for gravity settling.
 * Each frame represents one tick of gravity applied.
 */
export class GravityAnimator {
  /**
   * Generate all intermediate frames from initial grid until settled.
   */
  static buildAnimation(initial: GridMatrix, maxTicks = 50): GravityAnimation {
    const frames: AnimFrame[] = [];
    let current = initial;

    for (let tick = 0; tick < maxTicks; tick++) {
      const result = GravitySystem.applyOneTick(current);
      frames.push({ grid: result.grid, tick });
      current = result.grid;
      if (result.settled) break;
    }

    return {
      frames,
      totalTicks: frames.length,
    };
  }

  /**
   * Play animation frames with a per-tick delay callback.
   * onFrame is called for each frame, onDone when animation completes.
   */
  static play(
    animation: GravityAnimation,
    tickDelayMs: number,
    onFrame: (frame: AnimFrame) => void,
    onDone: () => void
  ): () => void {
    let cancelled = false;
    let idx = 0;

    const step = () => {
      if (cancelled) return;
      if (idx >= animation.frames.length) {
        onDone();
        return;
      }
      onFrame(animation.frames[idx]);
      idx++;
      setTimeout(step, tickDelayMs);
    };

    setTimeout(step, 0);

    return () => { cancelled = true; };
  }
}
