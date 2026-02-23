
import { TimerSystem } from '../timer/TimerSystem';

/**
 * Manages the core temporal loop of the game.
 * Currently wraps the TimerSystem but can be extended for frame-based updates.
 */
export class GameLoop {
  private timer: TimerSystem;

  constructor(
    duration: number, 
    onTick: (time: number) => void, 
    onEnd: () => void
  ) {
    this.timer = new TimerSystem(duration, onTick, onEnd);
  }

  start() {
    this.timer.start();
  }

  stop() {
    this.timer.stop();
  }

  addTime(seconds: number) {
    this.timer.addTime(seconds);
  }
}
