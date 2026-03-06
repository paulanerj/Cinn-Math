
import { EngineEvent, EngineEventType } from "./EngineEventTypes";

/**
 * EngineEventBus
 *
 * Deterministic event sequencing.
 */

export class EngineEventBus {

  private listeners: Map<EngineEventType, Set<(event: EngineEvent) => void>>;
  private globalListeners: Set<(event: EngineEvent) => void>;

  /**
   * Deterministic sequence counter
   */
  private sequence: number;

  constructor() {

    this.listeners = new Map();
    this.globalListeners = new Set();
    this.sequence = 0;

  }

  /**
   * Reset sequence counter (new session)
   */
  resetSequence(): void {
    this.sequence = 0;
  }

  emit(type: EngineEventType, data?: any, seed?: number): void {

    if (this.sequence < 0) {
      throw new Error("EventBus corrupted: sequence negative");
    }

    const event: EngineEvent = {

      type,
      sequence: this.sequence++,
      seed,
      data

    };

    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }

    this.globalListeners.forEach(listener => listener(event));

  }

  subscribe(
    type: EngineEventType,
    listener: (event: EngineEvent) => void
  ): () => void {

    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const set = this.listeners.get(type)!;

    set.add(listener);

    return () => set.delete(listener);

  }

  subscribeAll(listener: (event: EngineEvent) => void): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  getListenerCount(): number {
    let count = 0;
    this.listeners.forEach(set => count += set.size);
    count += this.globalListeners.size;
    return count;
  }

  clear(): void {

    this.listeners.clear();
    this.globalListeners.clear();

  }

}
