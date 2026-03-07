export type TimerState = {
  running: boolean;
  elapsed: number;   // ms
  limit: number;     // ms, 0 = no limit
  startedAt: number; // Date.now() snapshot
};

/**
 * TimerSystem — pure functional timer state management.
 * Actual time measurement uses Date.now(); state is updated by calling tick().
 */
export class TimerSystem {
  static create(limitMs: number = 0): TimerState {
    return { running: false, elapsed: 0, limit: limitMs, startedAt: 0 };
  }

  static start(state: TimerState): TimerState {
    return { ...state, running: true, startedAt: Date.now() };
  }

  static pause(state: TimerState): TimerState {
    const now = Date.now();
    const delta = state.running ? now - state.startedAt : 0;
    return { ...state, running: false, elapsed: state.elapsed + delta };
  }

  static reset(state: TimerState): TimerState {
    return { ...state, running: false, elapsed: 0, startedAt: 0 };
  }

  /**
   * Compute current elapsed without mutating state.
   */
  static getElapsed(state: TimerState): number {
    if (!state.running) return state.elapsed;
    return state.elapsed + (Date.now() - state.startedAt);
  }

  static getRemaining(state: TimerState): number {
    if (state.limit <= 0) return Infinity;
    return Math.max(0, state.limit - TimerSystem.getElapsed(state));
  }

  static isExpired(state: TimerState): boolean {
    if (state.limit <= 0) return false;
    return TimerSystem.getElapsed(state) >= state.limit;
  }

  /**
   * Produce a new state snapshotting current elapsed (for persistence/serialization).
   */
  static snapshot(state: TimerState): TimerState {
    const elapsed = TimerSystem.getElapsed(state);
    return { ...state, elapsed, startedAt: state.running ? Date.now() : 0 };
  }
}
