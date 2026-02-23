
import { EngineSession } from "../../engine/public";
import { ReplayRecorder } from "../../engine/replay/ReplayRecorder";

export class PlatformHealthCheck {

  static async runDiagnostics() {
    console.group("Platform Health Check");

    const session = EngineSession.getInstance();
    const recorder = new ReplayRecorder();

    console.log("1. Checking Initial State...");
    if (session.exists()) {
      console.warn("   Session exists (should be clean)");
      session.destroy();
    }
    const bus = session.getEventBus();
    bus.clear();
    
    if (bus.getListenerCount() !== 0) {
      console.error("   EventBus has lingering listeners:", bus.getListenerCount());
    } else {
      console.log("   EventBus clean");
    }

    console.log("2. Simulating 10 Rapid Cycles...");
    for (let i = 0; i < 10; i++) {
      session.create({ seed: 12345 + i });
      recorder.start(bus);
      
      bus.emit("ROUND_STARTED");
      bus.emit("GRID_GENERATED");
      
      recorder.stop();
      session.destroy();
      bus.clear();
    }

    console.log("3. Verifying Post-Cycle State...");
    const leaks = bus.getListenerCount();
    if (leaks > 0) {
      console.error(`   FAIL: ${leaks} listeners leaked!`);
    } else {
      console.log("   0 Listeners leaked");
    }

    if (session.exists()) {
      console.error("   FAIL: Session still exists");
    } else {
      console.log("   Session destroyed");
    }

    console.groupEnd();
  }

}

if (typeof window !== "undefined") {
  (window as any).PlatformHealthCheck = PlatformHealthCheck;
}
