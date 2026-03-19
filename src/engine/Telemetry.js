// ============================================================
// MODULE: Telemetry (Event Trace System)
// PURPOSE: Deep event telemetry for tracking system logic, traversal, and state drift.
// CONTRACT:
//   - INPUTS: Timestamps, string event types, arbitrary JSON payloads.
//   - SIDE EFFECTS: Mutates internal array. Exposes window methods.
// INVARIANTS / LOCKED RULES:
//   - Max buffer size is 5000 to prevent memory leaks in long sessions.
// WHY THIS EXISTS: Allows engineers/LLMs to reproduce exactly why the generator chose a
//   specific number, or why an answer failed.
// SAFE TO CHANGE: Buffer size, format of console log.
// RETEST CHECKLIST: window.printTelemetry() must work in browser console.
// ============================================================
import { DEBUG_TELEMETRY } from './constants.js';

export const Telemetry = {
  events: [],
  maxEvents: 5000,
  log(type, payload = {}, gameStep = null, mode = null, configSnapshot = null) {
    const ev = { timestamp: Date.now(), type, payload, gameStep, mode, configSnapshot };
    this.events.push(ev);
    if (this.events.length > this.maxEvents) this.events.shift();
    if (DEBUG_TELEMETRY) console.log(`[Telemetry] ${type}`, payload);
  },
  exportJSON() { return JSON.stringify(this.events, null, 2); },
  print() {
    console.table(this.events.map(e => ({
      Time: new Date(e.timestamp).toISOString().split('T')[1],
      Type: e.type,
      Payload: JSON.stringify(e.payload).substring(0, 100)
    })));
  }
};

// Expose to browser console for developer use
window.printTelemetry = () => Telemetry.print();
window.exportTelemetryJSON = () => Telemetry.exportJSON();
