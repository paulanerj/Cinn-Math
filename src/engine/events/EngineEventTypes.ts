export type EngineEventType =
  | "SESSION_CREATED"
  | "SESSION_DESTROYED"
  | "SESSION_RESET"
  | "ROUND_STARTED"
  | "GRID_GENERATED"
  | "TARGET_SELECTED"
  | "TILE_REFILLED"
  | "GRID_UPDATED";
export interface EngineEvent {
  type: EngineEventType;
  /**
   * Deterministic event index
   */
  sequence: number;
  /**
   * Deterministic seed authority
   */
  seed?: number;
  /**
   * Optional structured event data
   */
  data?: any;
}
