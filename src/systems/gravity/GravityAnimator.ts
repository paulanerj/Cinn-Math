
// src/systems/gravity/GravityAnimator.ts
//
// Shared GravityAnimator (visual only).
//
// ✅ requestAnimationFrame render loop
// ✅ cubic easing (easeOutCubic) for fall deceleration
// ✅ cascading wave via COLUMN_STAGGER (45ms) + TILE_STAGGER (18ms)
// ✅ translate3d for GPU acceleration
// ✅ spawn fade-in (opacity: 0 -> 1) + drop motion
// ✅ resolves only when all animations complete
//
// IMPORTANT SAFETY NOTES
// - This file is UI-only animation and does NOT alter grid logic.
// - It keeps the same public API used by SpeedGridGame.tsx:
//     GravityAnimator.animate(args, cfg)
// - CombineGrid is not forced to use this animator unless explicitly wired later.

import { EngineTile } from '../../engine/public';

/**
 * Minimal shared GridCell typing for animation purposes.
 * We only need (id, val) for rendering and identifying tiles.
 * The calling game can pass richer objects; TS structural typing will accept it.
 */
export interface GridCell extends EngineTile {
  id: string;
  key: string;
}

type Coord = { r: number; c: number };

type MoveRecord =
  | {
      type: 'move';
      id: string;
      val: number;
      from: Coord;
      to: Coord;
    }
  | {
      type: 'spawn';
      id: string;
      val: number;
      to: Coord;
    };

export type GravityAnimatorConfig = {
  // Spawn start offset above the grid (px)
  SPAWN_OFFSET?: number;

  // “Arcade feel” staggering
  COLUMN_STAGGER_MS?: number; // default 45
  TILE_STAGGER_MS?: number; // default 18

  // Optional minimum delay before spawns can begin (ms)
  PHASE_SPAWN_DELAY_MS?: number; // default 80

  // Optional duration controls (ms)
  MOVE_DURATION_MS?: number; // default 260
  SPAWN_DURATION_MS?: number; // default 320

  // Visual sizing (measured automatically if omitted)
  tileWidthPx?: number;
  tileHeightPx?: number;
};

export type GravityAnimatorArgs = {
  containerEl: HTMLElement; // must be position: relative (your grid container already is)
  preGrid: GridCell[][];
  postGrid: GridCell[][];

  // Used for measuring per-cell placement and for hiding “real” tiles while overlay animates
  getCellElementByCoord: (r: number, c: number) => HTMLElement | null;

  // Overlay lifecycle (caller creates an element that looks like a tile)
  createOverlayTile: (tile: { id: string; val: number }) => HTMLElement;
  destroyOverlayTile: (el: HTMLElement) => void;

  // Called immediately before animation starts so React can hide tiles that will be animated
  onWillAnimateIds?: (ids: Set<string>) => void;

  // Called when fully complete so React can unhide tiles
  onDidAnimateIds?: () => void;
};

type Body = {
  id: string;
  type: 'move' | 'spawn';
  el: HTMLElement;

  // start & end positions (relative to container)
  x0: number;
  y0: number;
  x1: number;
  y1: number;

  // timing
  delayMs: number;
  durationMs: number;

  // spawn fade control
  fade: boolean;

  settled: boolean;
};

function easeOutCubic(t: number): number {
  // t in [0..1]
  return 1 - Math.pow(1 - t, 3);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function rectRelToContainer(containerRect: DOMRect, rect: DOMRect) {
  return {
    left: rect.left - containerRect.left,
    top: rect.top - containerRect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Compute which tiles are moves vs spawns, by comparing IDs between preGrid and postGrid.
 * This is animation-only: we do NOT decide gravity here, we only detect changes.
 */
function computeMoves(preGrid: GridCell[][], postGrid: GridCell[][]): MoveRecord[] {
  const prePos = new Map<string, Coord>();

  for (let r = 0; r < preGrid.length; r++) {
    for (let c = 0; c < preGrid[0].length; c++) {
      const t = preGrid[r][c];
      prePos.set(t.id, { r, c });
    }
  }

  const moves: MoveRecord[] = [];

  for (let r = 0; r < postGrid.length; r++) {
    for (let c = 0; c < postGrid[0].length; c++) {
      const t = postGrid[r][c];
      const from = prePos.get(t.id);

      if (!from) {
        moves.push({
          type: 'spawn',
          id: t.id,
          val: t.val,
          to: { r, c },
        });
      } else if (from.r !== r || from.c !== c) {
        moves.push({
          type: 'move',
          id: t.id,
          val: t.val,
          from,
          to: { r, c },
        });
      }
    }
  }

  return moves;
}

/**
 * Build stagger delays that create a “wave”:
 * delay = (col * COLUMN_STAGGER) + (indexWithinColumn * TILE_STAGGER)
 *
 * We do this separately for moves and spawns to keep the cascade pleasant.
 */
function buildColumnWaveDelays<T extends { to: Coord }>(
  records: T[],
  columnStaggerMs: number,
  tileStaggerMs: number
): Map<string, number> {
  // Group by column
  const byCol = new Map<number, T[]>();
  records.forEach((r) => {
    const col = r.to.c;
    const arr = byCol.get(col) ?? [];
    arr.push(r);
    byCol.set(col, arr);
  });

  // Within each column: bottom-first looks nicer
  byCol.forEach((arr) => {
    arr.sort((a, b) => b.to.r - a.to.r);
  });

  const delays = new Map<string, number>();

  byCol.forEach((arr, col) => {
    arr.forEach((rec, idx) => {
      // We rely on each record having an 'id' at runtime (MoveRecord does)
      const anyRec = rec as any;
      const id: string = anyRec.id;
      delays.set(id, col * columnStaggerMs + idx * tileStaggerMs);
    });
  });

  return delays;
}

export class GravityAnimator {
  static async animate(args: GravityAnimatorArgs, cfg: GravityAnimatorConfig = {}): Promise<void> {
    const {
      containerEl,
      preGrid,
      postGrid,
      getCellElementByCoord,
      createOverlayTile,
      destroyOverlayTile,
      onWillAnimateIds,
      onDidAnimateIds,
    } = args;

    // Defaults per directive
    const SPAWN_OFFSET = cfg.SPAWN_OFFSET ?? 120;

    const COLUMN_STAGGER_MS = cfg.COLUMN_STAGGER_MS ?? 45;
    const TILE_STAGGER_MS = cfg.TILE_STAGGER_MS ?? 18;

    const PHASE_SPAWN_DELAY_MS = cfg.PHASE_SPAWN_DELAY_MS ?? 80;

    const MOVE_DURATION_MS = cfg.MOVE_DURATION_MS ?? 260;
    const SPAWN_DURATION_MS = cfg.SPAWN_DURATION_MS ?? 320;

    const records = computeMoves(preGrid, postGrid);
    const animIds = new Set<string>(records.map((r) => r.id));
    onWillAnimateIds?.(animIds);

    // Measure container rect
    const containerRect = containerEl.getBoundingClientRect();

    // Determine tile size (fallback safe)
    let tileW = cfg.tileWidthPx;
    let tileH = cfg.tileHeightPx;

    if (!tileW || !tileH) {
      const sample = getCellElementByCoord(0, 0);
      if (sample) {
        const rr = sample.getBoundingClientRect();
        tileW = rr.width;
        tileH = rr.height;
      } else {
        tileW = 64;
        tileH = 64;
      }
    }

    // Precompute destination rects for all coords (relative to container)
    const cellRect = new Map<string, { left: number; top: number; width: number; height: number }>();
    for (let r = 0; r < postGrid.length; r++) {
      for (let c = 0; c < postGrid[0].length; c++) {
        const el = getCellElementByCoord(r, c);
        if (!el) continue;
        const rr = el.getBoundingClientRect();
        cellRect.set(`${r},${c}`, rectRelToContainer(containerRect, rr));
      }
    }

    const moveRecords = records.filter((r) => r.type === 'move') as Extract<MoveRecord, { type: 'move' }>[];
    const spawnRecords = records.filter((r) => r.type === 'spawn') as Extract<MoveRecord, { type: 'spawn' }>[];

    // Build wave delays
    const moveDelays = buildColumnWaveDelays(
      moveRecords.map((m) => ({ ...m, to: m.to })),
      COLUMN_STAGGER_MS,
      TILE_STAGGER_MS
    );
    const spawnDelays = buildColumnWaveDelays(
      spawnRecords.map((s) => ({ ...s, to: s.to })),
      COLUMN_STAGGER_MS,
      TILE_STAGGER_MS
    );

    // Create overlay bodies
    const bodies: Body[] = [];

    // Helper to initialize overlay element for translate3d animation
    const prepOverlayEl = (el: HTMLElement) => {
      el.style.position = 'absolute';
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.width = `${tileW}px`;
      el.style.height = `${tileH}px`;
      el.style.pointerEvents = 'none';
      el.style.willChange = 'transform, opacity';
      // Ensure it's on top of the grid tiles
      el.style.zIndex = '50';
    };

    // Moves: start at their old coord, end at their new coord
    moveRecords.forEach((m) => {
      const fromRect = cellRect.get(`${m.from.r},${m.from.c}`);
      const toRect = cellRect.get(`${m.to.r},${m.to.c}`);
      if (!fromRect || !toRect) return;

      const el = createOverlayTile({ id: m.id, val: m.val });
      prepOverlayEl(el);

      const delayMs = moveDelays.get(m.id) ?? 0;

      // initial pose
      el.style.transform = `translate3d(${toRect.left}px, ${fromRect.top}px, 0)`;

      bodies.push({
        id: m.id,
        type: 'move',
        el,
        x0: toRect.left,
        y0: fromRect.top,
        x1: toRect.left,
        y1: toRect.top,
        delayMs,
        durationMs: MOVE_DURATION_MS,
        fade: false,
        settled: false,
      });
    });

    // Spawns: start above and drop into place with fade-in
    spawnRecords.forEach((s) => {
      const toRect = cellRect.get(`${s.to.r},${s.to.c}`);
      if (!toRect) return;

      const el = createOverlayTile({ id: s.id, val: s.val });
      prepOverlayEl(el);

      const delayMs = spawnDelays.get(s.id) ?? 0;

      const startY = -SPAWN_OFFSET;

      el.style.opacity = '0';
      el.style.transform = `translate3d(${toRect.left}px, ${startY}px, 0)`;

      bodies.push({
        id: s.id,
        type: 'spawn',
        el,
        x0: toRect.left,
        y0: startY,
        x1: toRect.left,
        y1: toRect.top,
        delayMs,
        durationMs: SPAWN_DURATION_MS,
        fade: true,
        settled: false,
      });
    });

    // If nothing to animate, finish cleanly
    if (bodies.length === 0) {
      onDidAnimateIds?.();
      return;
    }

    // We enforce phase separation:
    // - run all moves first
    // - then enable spawns after moves are done + PHASE_SPAWN_DELAY_MS
    const moveBodies = bodies.filter((b) => b.type === 'move');
    const spawnBodies = bodies.filter((b) => b.type === 'spawn');

    const startTime = performance.now();

    // Spawns are effectively "disabled" until phase 2
    // We do that by adding a large extra offset until activation.
    let spawnPhaseActivatedAt: number | null = null;

    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const elapsed = now - startTime;

        // ---- Phase transition check ----
        if (spawnPhaseActivatedAt === null) {
          const movesDone = moveBodies.every((b) => b.settled);
          if (movesDone && elapsed >= PHASE_SPAWN_DELAY_MS) {
            spawnPhaseActivatedAt = now; // begins now
          }
        }

        // ---- Update bodies ----
        // Moves always run immediately (with their own per-body delays).
        // Spawns only run once spawnPhaseActivatedAt is set.
        let allDone = true;

        for (const b of bodies) {
          if (b.settled) continue;

          const isSpawn = b.type === 'spawn';
          if (isSpawn && spawnPhaseActivatedAt === null) {
            // Spawns not active yet
            allDone = false;
            continue;
          }

          // Determine the time base:
          // - Moves use global startTime
          // - Spawns use spawnPhaseActivatedAt (so their delays start “fresh”)
          const baseStart = isSpawn ? spawnPhaseActivatedAt! : startTime;
          const localElapsed = now - baseStart;

          // If still waiting for stagger delay
          if (localElapsed < b.delayMs) {
            allDone = false;
            continue;
          }

          const t = clamp01((localElapsed - b.delayMs) / b.durationMs);
          const e = easeOutCubic(t);

          const x = b.x0 + (b.x1 - b.x0) * e;
          const y = b.y0 + (b.y1 - b.y0) * e;

          b.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;

          if (b.fade) {
            // Fade in quickly at the start of the drop, then hold
            // (looks “graceful” and avoids popping)
            const fadeT = clamp01(t * 2.0); // fade completes by t=0.5
            b.el.style.opacity = String(fadeT);
          }

          if (t >= 1) {
            b.settled = true;

            // Ensure final exact pose
            b.el.style.transform = `translate3d(${b.x1}px, ${b.y1}px, 0)`;
            if (b.fade) b.el.style.opacity = '1';
          } else {
            allDone = false;
          }
        }

        if (allDone) {
          // Cleanup overlays
          bodies.forEach((b) => destroyOverlayTile(b.el));

          // Unhide real tiles
          onDidAnimateIds?.();

          resolve();
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }
}
