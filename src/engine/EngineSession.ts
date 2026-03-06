

import { GridEngine } from "./GridEngine";
import { EngineConfig, EnginePublic } from "./public";
import { EngineEventBus } from "./events/EngineEventBus";

/**
 * EngineSession
 *
 * SINGLETON AUTHORITY for engine lifecycle.
 *
 * Guarantees:
 *
 * - Only one authoritative engine session per runtime
 * - Deterministic seed preservation
 * - Deterministic event ordering
 * - Replay safety
 * - Adapter-safe access
 *
 * CombineGrid compatibility preserved (does not force migration).
 */

export class EngineSession {

  /**
   * Singleton instance
   */
  private static instance: EngineSession | null = null;

  /**
   * Authoritative engine instance
   */
  private engine: GridEngine | null = null;

  /**
   * Authoritative config
   */
  private config: EngineConfig | null = null;

  /**
   * Authoritative seed
   */
  private seed: number | null = null;

  /**
   * Deterministic event bus
   */
  private eventBus: EngineEventBus;

  /**
   * Constructor enforces singleton.
   * Public to maintain compatibility with legacy adapters using 'new'.
   */
  constructor() {
    if (EngineSession.instance) {
      return EngineSession.instance;
    }
    this.eventBus = new EngineEventBus();
    EngineSession.instance = this;
  }

  /**
   * Returns singleton authority instance.
   */
  static getInstance(): EngineSession {

    if (!EngineSession.instance) {
      new EngineSession();
    }

    return EngineSession.instance!;

  }

  /**
   * Returns deterministic event bus.
   */
  getEventBus(): EngineEventBus {
    return this.eventBus;
  }

  /**
   * Returns authoritative seed.
   */
  getSeed(): number {

    if (this.seed === null) {
      throw new Error("EngineSession: seed not initialized");
    }

    return this.seed;

  }

  /**
   * Creates new engine session.
   *
   * Deterministic seed authority established here.
   */
  create(config: EngineConfig): EnginePublic {

    this.destroy();

    // 1. Establish authoritative seed (Prevent drift)
    // If config provides a seed, use it. Otherwise, generate ONE authoritative seed.
    this.seed = config.seed !== undefined
      ? config.seed
      : Date.now();

    // 2. Store authoritative config with the explicit seed
    this.config = {
      ...config,
      seed: this.seed
    };

    // 3. Create Engine with authoritative config
    this.engine = new GridEngine(this.config);

    // 4. Reset Event Bus Sequence (Hard Lock)
    this.eventBus.resetSequence();

    // 5. Emit Lifecycle Events
    this.eventBus.emit("SESSION_CREATED", {
      config: this.config
    }, this.seed);

    this.eventBus.emit("GRID_GENERATED");

    return this.engine;

  }

  /**
   * Returns authoritative engine.
   */
  get(): EnginePublic {

    if (!this.engine) {
      throw new Error("EngineSession: engine not initialized");
    }

    return this.engine;

  }

  /**
   * Deterministic reset using same seed.
   */
  reset(): EnginePublic {

    if (!this.config) {
      throw new Error("EngineSession: cannot reset before create()");
    }

    this.eventBus.emit("SESSION_RESET");

    // Re-use authoritative config (guarantees same seed)
    return this.create(this.config);

  }

  /**
   * Safely destroys session.
   */
  destroy(): void {

    if (!this.engine) return;

    this.eventBus.emit("SESSION_DESTROYED");

    if (typeof (this.engine as any).destroy === "function") {
      (this.engine as any).destroy();
    }

    this.engine = null;

  }

  /**
   * Exists check.
   */
  exists(): boolean {
    return this.engine !== null;
  }

}
