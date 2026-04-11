// [ROLE] Public barrel export for the GridMath engine.
// All external consumers (games, platform components, tests) should import
// from this file, not from individual engine modules.
//
// [WHY] A barrel export lets us refactor internal engine file structure
// (e.g. splitting GridEngine.ts into multiple files) without touching any
// import in the games. The public surface is defined here; the internal
// layout is an implementation detail.
//
// [FUTURE] When new engine modules are added (e.g. HistoryEngine for undo,
// AnalyticsEngine for telemetry), add their exports here. Do not remove
// existing exports without a breaking-change audit.
//
// [LLM NOTE] Do not re-export GridGameRules.ts from here. That file is a
// types-only architectural contract for future games and is not part of the
// current engine's runtime surface. Games import GridGameRules directly for
// type-checking purposes when they implement the interface.
//
// [INVARIANT] Every public name exported from this file must come from a
// module that exists and compiles cleanly. No wildcard re-exports that could
// silently absorb broken modules.

// ── Version ───────────────────────────────────────────────────────────────────
export { ENGINE_VERSION } from './version';

// ── RNG ───────────────────────────────────────────────────────────────────────
export { makePrng, randomSeed, randomInt, randomPick } from './rng';
export type {} from './rng'; // no types to re-export from rng

// ── Practice profiles ─────────────────────────────────────────────────────────
export {
  PRACTICE_PROFILES,
  getProfile,
  DEFAULT_PROFILE_ID,
} from './PracticeProfile';
export type { PracticeProfile, ProfileId } from './PracticeProfile';

// ── Spawn engine ──────────────────────────────────────────────────────────────
export { spawnTile, spawnBoard, spawnColumn, spawnTileWeighted } from './SpawnEngine';
export type { SpawnedTile } from './SpawnEngine';

// ── Grid engine ───────────────────────────────────────────────────────────────
export {
  createGrid,
  emptyGrid,
  gridFromSpawn,
  getCellValue,
  inBounds,
  setCell,
  clearCells,
  applyGravity,
  swapCells,
  isOrthoAdjacent,
  isChebyshevAdjacent,
  sumPositions,
  productPositions,
} from './GridEngine';
export type { GravityResult } from './GridEngine';

// ── Target generator ──────────────────────────────────────────────────────────
export { generateTarget, evaluate, chainMatchesTarget } from './TargetGenerator';
export type { EvalMode } from './TargetGenerator';

// ── Session ───────────────────────────────────────────────────────────────────
export { createSession, addScore, incrementRound, elapsedMs } from './EngineSession';
export type { EngineSession } from './EngineSession';

// ── Events ────────────────────────────────────────────────────────────────────
export type {
  EngineEvent,
  EngineEventType,
  EngineEventPayload,
  EngineEventListener,
  EngineEventBase,
  TilesClearedPayload,
  ScoreUpdatedPayload,
  TargetMatchedPayload,
  NewTargetPayload,
  RoundCompletePayload,
  GameOverPayload,
  TimerTickPayload,
} from './events/EngineEvents';

// ── Replay ────────────────────────────────────────────────────────────────────
export { ReplayRecorder } from './replay/ReplayRecorder';
export type { ReplayFrame, ReplaySession, ReplayFrameKind } from './replay/ReplayTypes';
