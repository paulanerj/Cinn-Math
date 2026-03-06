/**
 * GridRuntime — minimal host for a GridGameModule.
 *
 * Responsibilities (and ONLY these):
 *  1. Drive the game loop via requestAnimationFrame → module.tick(dt)
 *  2. Deliver GridInteraction objects to module.onInteraction()
 *  3. Notify a single subscriber when state may have changed
 *
 * GridRuntime has zero game logic. It is a thin scheduling shell.
 *
 * Phase B — Grid Runtime Foundation.
 *
 * Usage:
 *   const runtime = new GridRuntime(module, onChange);
 *   runtime.start();
 *   // ... player interaction arrives ...
 *   runtime.dispatch({ type: 'CHAIN_SELECT', ... });
 *   // ... component unmounts ...
 *   runtime.stop();
 */

import type { GridGameModule, GridInteraction } from './gridTypes';

/** Called after every tick and every interaction so the view can re-render. */
export type StateChangeCallback = () => void;

/** Maximum dt cap (ms) — prevents spiral of death after tab switches */
const MAX_DT_MS = 100;

export class GridRuntime {
  private module: GridGameModule;
  private onChange: StateChangeCallback;
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;
  private running = false;

  constructor(module: GridGameModule, onChange: StateChangeCallback) {
    this.module = module;
    this.onChange = onChange;
  }

  /** Start the game loop. Safe to call multiple times (idempotent). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = null;
    this.rafId = requestAnimationFrame(this.loop);
  }

  /** Stop the game loop. The module is NOT destroyed — call destroy() for that. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTimestamp = null;
  }

  /**
   * Deliver a player interaction to the hosted module.
   * Triggers onChange so the view re-renders after the interaction is processed.
   */
  dispatch(interaction: GridInteraction): void {
    this.module.onInteraction(interaction);
    this.onChange();
  }

  /**
   * Stop the loop and destroy the module.
   * Call this when the game component unmounts.
   */
  destroy(): void {
    this.stop();
    this.module.destroy();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private loop = (timestamp: number): void => {
    if (!this.running) return;

    const dt = this.lastTimestamp === null
      ? 0
      : Math.min(timestamp - this.lastTimestamp, MAX_DT_MS);
    this.lastTimestamp = timestamp;

    this.module.tick(dt);
    this.onChange();

    this.rafId = requestAnimationFrame(this.loop);
  };
}
