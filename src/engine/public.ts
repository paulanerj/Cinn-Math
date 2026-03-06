
import { GridEngine } from './GridEngine';

export { GridEngine };
export { PracticeProfile } from './PracticeProfile';
export { EngineTile } from './SpawnEngine';
export { EngineSession } from './EngineSession';
export { EngineEventBus } from "./events/EngineEventBus";
export type { EngineEvent, EngineEventType } from "./events/EngineEventTypes";

export type EngineConfig = { seed?: number; debug?: boolean };
export type EnginePublic = GridEngine;

export enum TargetSource {
  RECIPE = 'RECIPE',
  PRACTICE = 'PRACTICE',
  FREE_PLAY = 'FREE_PLAY',
  SOLVER_GENERATED = 'SOLVER_GENERATED',
}
