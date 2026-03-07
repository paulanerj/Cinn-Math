import { EngineEventBus } from "../events/EngineEventBus";
import { EngineEvent } from "../events/EngineEventTypes";
export interface ReplayLog {
  seed?: number;
  events: EngineEvent[];
}
export class ReplayRecorder {
  private log: ReplayLog = { events: [] };
  private unsubscribe?: () => void;
  private maxEvents = 5000;
  start(bus: EngineEventBus, seed?: number) {
    if (this.unsubscribe) {
      throw new Error("ReplayRecorder already active");
    }
    this.log = {
      seed,
      events: []
    };
    this.unsubscribe = bus.subscribeAll((event) => {
      if (this.log.events.length >= this.maxEvents) {
        console.warn("ReplayRecorder: Max events limit reached (" + this.maxEvents + "). Stopping recording.");
        this.stop();
        return;
      }
      this.log.events.push(event);
    });
  }
  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }
  getLog(): ReplayLog {
    return this.log;
  }
  clear() {
    this.log = { events: [] };
  }
}
