import { GridEngine } from "./GridEngine";
import { EngineConfig, EnginePublic } from "./public";
import { EngineEventBus } from "./events/EngineEventBus";
/**
 * EngineSession — SINGLETON AUTHORITY for engine lifecycle.
 */
export class EngineSession {
  private static instance: EngineSession | null = null;
  private engine: GridEngine | null = null;
  private config: EngineConfig | null = null;
  private seed: number | null = null;
  private eventBus: EngineEventBus;
  constructor() {
    if (EngineSession.instance) {
      return EngineSession.instance;
    }
    this.eventBus = new EngineEventBus();
    EngineSession.instance = this;
  }
  static getInstance(): EngineSession {
    if (!EngineSession.instance) {
      new EngineSession();
    }
    return EngineSession.instance!;
  }
  getEventBus(): EngineEventBus {
    return this.eventBus;
  }
  getSeed(): number {
    if (this.seed === null) {
      throw new Error("EngineSession: seed not initialized");
    }
    return this.seed;
  }
  create(config: EngineConfig): EnginePublic {
    this.destroy();
    this.seed = config.seed !== undefined ? config.seed : Date.now();
    this.config = { ...config, seed: this.seed };
    this.engine = new GridEngine(this.config);
    this.eventBus.resetSequence();
    this.eventBus.emit("SESSION_CREATED", { config: this.config }, this.seed);
    this.eventBus.emit("GRID_GENERATED");
    return this.engine;
  }
  get(): EnginePublic {
    if (!this.engine) {
      throw new Error("EngineSession: engine not initialized");
    }
    return this.engine;
  }
  reset(): EnginePublic {
    if (!this.config) {
      throw new Error("EngineSession: cannot reset before create()");
    }
    this.eventBus.emit("SESSION_RESET");
    return this.create(this.config);
  }
  destroy(): void {
    if (!this.engine) return;
    this.eventBus.emit("SESSION_DESTROYED");
    if (typeof (this.engine as any).destroy === "function") {
      (this.engine as any).destroy();
    }
    this.engine = null;
  }
  exists(): boolean {
    return this.engine !== null;
  }
}
