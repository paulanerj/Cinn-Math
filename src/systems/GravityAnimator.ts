// ─────────────────────────────────────────────────────────────────────────────
// src/systems/GravityAnimator.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Converts GravitySystem's movement metadata into a set of per-tile
//        animation descriptors. Game components consume these descriptors to
//        drive CSS transitions or React state without needing to compute
//        fall distances themselves.
//
// [WHY]  GravitySystem knows WHAT moved; GravityAnimator knows HOW to
//        describe that movement in animation terms. Keeping them separate
//        means GravitySystem stays pure data, and GravityAnimator can be
//        evolved independently (e.g. adding stagger timing, spring physics,
//        bounce easing) without touching gravity logic.
//
// [FUTURE] When a game needs custom animation curves (e.g. elastic bounce for
//          a "heavy block" tile), extend GravityAnimFrame with an optional
//          `easing` field. Existing callers that don't set it get the default.
//          Do not make easing mandatory — that would break every existing game.
//
// [LLM NOTE] This file produces plain data objects. It does not import React,
//            does not set CSS properties, and does not touch the DOM. The game
//            component translates GravityAnimFrames into whatever animation
//            mechanism it uses (CSS transitions, Framer Motion, etc.).
//
// [INVARIANT] All durations are in milliseconds.
//             delayMs is the time to wait before the animation starts.
//             durationMs is the time the animation takes once it begins.
//             totalMs = delayMs + durationMs.
// ─────────────────────────────────────────────────────────────────────────────

import type { FallingTile, SpawnedPosition } from './GravitySystem';

// ── Public types ──────────────────────────────────────────────────────────────

/** How a tile enters the board for the first time (spawned from above). */
export type SpawnStyle = 'fall-in' | 'pop' | 'instant';

/**
 * Animation descriptor for a tile that was already on the board and fell down.
 *
 * [INVARIANT] distanceRows ≥ 1. Tiles never fall zero or negative rows.
 */
export interface FallAnimFrame {
  kind: 'fall';
  col: number;
  fromRow: number;
  toRow: number;
  distanceRows: number;
  value: number;
  /** Delay before this tile starts moving. Used for cascade stagger. */
  delayMs: number;
  /** Duration of the fall animation. Scales with distance. */
  durationMs: number;
}

/**
 * Animation descriptor for a tile that was newly spawned at the top.
 *
 * [INVARIANT] spawnIndex is the tile's position in the spawn batch for its
 *             column (0 = topmost). Used to compute stagger delay.
 */
export interface SpawnAnimFrame {
  kind: 'spawn';
  row: number;
  col: number;
  value: number;
  spawnIndex: number;
  style: SpawnStyle;
  delayMs: number;
  durationMs: number;
}

/** Union of all animation frame types produced by GravityAnimator. */
export type GravityAnimFrame = FallAnimFrame | SpawnAnimFrame;

// ── Timing constants ──────────────────────────────────────────────────────────

/**
 * Base duration (ms) for a tile falling one row.
 * Total fall duration = BASE_FALL_MS + distance * PER_ROW_MS.
 */
const BASE_FALL_MS = 60;
const PER_ROW_MS = 30;

/** Duration for a newly spawned tile to fall in from above the board. */
const SPAWN_FALL_MS = 180;

/**
 * Stagger delay per column index.
 * Column 0 starts first; each subsequent column is delayed slightly.
 */
const COL_STAGGER_MS = 20;

/**
 * Stagger delay per row within a spawn batch in one column.
 * Tiles higher up in the spawn batch start slightly earlier.
 */
const SPAWN_ROW_STAGGER_MS = 25;

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Builds the full set of animation frames for one gravity application.
 *
 * Falls and spawns are timed so that:
 * - Falling tiles animate first (they are already on the board).
 * - Spawned tiles begin after the longest falling tile in their column has
 *   settled, so they don't overlap visually.
 *
 * @param fallingTiles   From GravityApplicationResult.fallingTiles.
 * @param spawnedPositions  From GravityApplicationResult.spawnedPositions.
 * @param spawnStyle     How spawned tiles should enter. Default: 'fall-in'.
 */
export function buildGravityFrames(
  fallingTiles: FallingTile[],
  spawnedPositions: SpawnedPosition[],
  spawnStyle: SpawnStyle = 'fall-in',
): GravityAnimFrame[] {
  const frames: GravityAnimFrame[] = [];

  // ── Fall frames ────────────────────────────────────────────────────────────

  // Track the latest end-time per column so spawn frames can start after.
  const colFallEndMs: Record<number, number> = {};

  for (const ft of fallingTiles) {
    const distance = ft.toRow - ft.fromRow;
    const delayMs = ft.col * COL_STAGGER_MS;
    const durationMs = BASE_FALL_MS + distance * PER_ROW_MS;
    const endMs = delayMs + durationMs;

    frames.push({
      kind: 'fall',
      col: ft.col,
      fromRow: ft.fromRow,
      toRow: ft.toRow,
      distanceRows: distance,
      value: ft.value,
      delayMs,
      durationMs,
    });

    colFallEndMs[ft.col] = Math.max(colFallEndMs[ft.col] ?? 0, endMs);
  }

  // ── Spawn frames ───────────────────────────────────────────────────────────

  // Group spawned positions by column for stagger ordering.
  const byCol: Record<number, SpawnedPosition[]> = {};
  for (const sp of spawnedPositions) {
    (byCol[sp.col] ??= []).push(sp);
  }

  for (const [colStr, positions] of Object.entries(byCol)) {
    const col = Number(colStr);
    // Sort by row ascending (topmost spawns first in the stagger sequence).
    const sorted = [...positions].sort((a, b) => a.row - b.row);
    const fallEndMs = colFallEndMs[col] ?? 0;

    sorted.forEach((sp, idx) => {
      const delayMs = fallEndMs + idx * SPAWN_ROW_STAGGER_MS;
      frames.push({
        kind: 'spawn',
        row: sp.row,
        col: sp.col,
        value: sp.value,
        spawnIndex: idx,
        style: spawnStyle,
        delayMs,
        durationMs: SPAWN_FALL_MS,
      });
    });
  }

  return frames;
}

/**
 * Returns the total animation duration (ms) for a set of gravity frames —
 * i.e. the time until the last frame has finished playing.
 *
 * [USAGE] Games call this to know when it is safe to unlock input again.
 *
 * [INVARIANT] Returns 0 if frames is empty (no animation needed).
 */
export function gravityAnimTotalMs(frames: GravityAnimFrame[]): number {
  if (frames.length === 0) return 0;
  return Math.max(...frames.map((f) => f.delayMs + f.durationMs));
}
