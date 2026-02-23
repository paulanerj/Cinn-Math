
import { GravityMove, GravityMetrics, GravityRuntimeHooks } from './types';
import { GRAVITY_PHYSICS } from './constants';
import { TileKind } from '../types';
import { Trace } from '../debug/trace';

interface Body {
  id: string;
  col: number;
  y: number;
  vy: number;
  targetY: number;
  weight: number;
  settled: boolean;
  active: boolean; 
  type: 'move' | 'spawn';
}

/**
 * Deterministic jitter for spawn start positions based on ActionId.
 */
function getDeterministicOffset(actionId: string, col: number, index: number): number {
  const seed = actionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const val = Math.sin(seed + col * 13 + index * 37) * 10000;
  return Math.abs(val - Math.floor(val)) * 150;
}

const FAILSAFE_MAX_RUNTIME_MS = 2500;
const FAILSAFE_MAX_FRAMES = 240;

export function runGravity(
  moves: GravityMove[],
  metrics: GravityMetrics,
  hooks: GravityRuntimeHooks,
  actionId: string
): Promise<void> {
  return new Promise((resolve) => {
    // 0) Degenerate Case
    if (!moves || moves.length === 0) {
      Trace.log({ tag: 'GRAVITY', name: 'GRAVITY_NO_MOVES', actionId });
      hooks.onComplete();
      resolve();
      return;
    }

    const bodiesByCol = new Map<number, Body[]>();
    const allBodies: Body[] = [];
    let completed = false;

    const safeComplete = (reason: string) => {
      if (completed) return;
      completed = true;
      Trace.log({ tag: 'GRAVITY', name: 'GRAVITY_RESOLVE', actionId, detail: { reason } });
      hooks.onComplete();
      Trace.log({ tag: 'GRAVITY', name: 'GRAVITY_ONCOMPLETE_CALLED', actionId });
      resolve();
    };

    Trace.log({ tag: 'GRAVITY', name: 'GRAVITY_BEGIN', actionId, detail: { total: moves.length } });

    // 1) Initialize Move and Spawn bodies
    const moveMoves = moves.filter((m): m is Extract<GravityMove, { type: 'move' }> => m.type === 'move');
    const spawnMoves = moves.filter((m): m is Extract<GravityMove, { type: 'spawn' }> => m.type === 'spawn');

    // --- PHASE A: Existing Tiles (Moves)
    moveMoves.forEach((move) => {
      const dest = metrics.getPos(move.r, move.c);
      const currentY = hooks.getCurrentTileLocalY(move.id);
      
      // Fallback: start from the row above to prevent visual popping
      const fallbackStartY = metrics.getPos(Math.max(0, move.r - 1), move.c).y;
      const startY = currentY !== null ? currentY : fallbackStartY;

      const body: Body = {
        id: move.id, col: move.c, y: startY, vy: 0, targetY: dest.y, weight: 1.0, settled: false, active: true, type: 'move'
      };
      allBodies.push(body);
      const colBodies = bodiesByCol.get(move.c) || [];
      colBodies.push(body);
      bodiesByCol.set(move.c, colBodies);
      hooks.onStartMove(move, dest.x, startY, dest.y);
    });

    // --- PHASE B: New Tiles (Spawns)
    spawnMoves.forEach((move, idx) => {
      const dest = metrics.getPos(move.r, move.c);
      const jitter = getDeterministicOffset(actionId, move.c, idx);
      const startY = -GRAVITY_PHYSICS.SPAWN_OFFSET - jitter;
      const weight = move.data.kind === TileKind.BOMB ? 1.2 : 1.0;

      const body: Body = {
        id: move.id, col: move.c, y: startY, vy: 0, targetY: dest.y, weight, settled: false, active: false, type: 'spawn'
      };
      allBodies.push(body);
      const colBodies = bodiesByCol.get(move.c) || [];
      colBodies.push(body);
      bodiesByCol.set(move.c, colBodies);
    });

    const spawnCols = new Set<number>();
    spawnMoves.forEach((m) => spawnCols.add(m.c));
    const activatedSpawnCols = new Set<number>();

    Trace.log({ tag: 'GRAVITY', name: 'GRAVITY_PHASE_MOVES_BEGIN', actionId, detail: { moves: moveMoves.length, spawns: spawnMoves.length } });

    // 2) Animation Loop
    let frameCount = 0;
    const startTime = performance.now();

    const loop = (now: number) => {
      frameCount++;

      // Failsafe checks
      if (now - startTime > FAILSAFE_MAX_RUNTIME_MS || frameCount > FAILSAFE_MAX_FRAMES) {
        Trace.log({ tag: 'ERROR', name: 'GRAVITY_FAILSAFE_TRIGGERED', actionId, detail: { frames: frameCount, ms: now - startTime } });
        allBodies.forEach(b => { b.y = b.targetY; b.settled = true; hooks.updateOverlayTile(b.id, b.y); });
        safeComplete('failsafe');
        return;
      }

      if (frameCount % 30 === 0) {
        Trace.log({ tag: 'GRAVITY', name: 'GRAVITY_LOOP_FRAME', actionId, detail: { frame: frameCount, active: allBodies.filter(b => b.active && !b.settled).length } });
      }

      // Column-by-column spawn gating
      for (const col of spawnCols) {
        if (activatedSpawnCols.has(col)) continue;
        if (now - startTime < GRAVITY_PHYSICS.PHASE_SPAWN_DELAY_MS) continue;

        const colBodies = bodiesByCol.get(col) || [];
        const colMoves = colBodies.filter(b => b.type === 'move');
        
        // Clearance threshold: The entry slot (row 0) must be visually clear.
        const entryY = metrics.getPos(0, col).y;
        const clearanceThreshold = entryY + metrics.tileSize * 0.5;

        const isClear = colMoves.length === 0 || colMoves.every(b => b.settled || b.y >= clearanceThreshold);
        if (!isClear) continue;

        activatedSpawnCols.add(col);
        const colSpawns = colBodies.filter(b => b.type === 'spawn');
        Trace.log({ tag: 'GRAVITY', name: 'GRAVITY_COLUMN_GATE_OPEN', actionId, detail: { col, count: colSpawns.length } });
        colSpawns.forEach(b => {
          b.active = true;
          const moveData = spawnMoves.find(m => m.id === b.id);
          if (moveData) hooks.onStartMove(moveData, metrics.getPos(moveData.r, moveData.c).x, b.y, b.targetY);
        });
      }

      let activeInLoop = 0;
      allBodies.forEach(b => {
        if (!b.active || b.settled) return;

        // Physics integration
        b.vy += GRAVITY_PHYSICS.GRAVITY * b.weight;
        b.vy *= GRAVITY_PHYSICS.FRICTION;
        b.y += b.vy;

        // Collision logic
        if (b.y >= b.targetY) {
          b.y = b.targetY;
          b.vy *= -GRAVITY_PHYSICS.BOUNCE;
          if (Math.abs(b.vy) < GRAVITY_PHYSICS.SNAP) {
            b.y = b.targetY; b.vy = 0; b.settled = true;
            Trace.log({ tag: 'GRAVITY', name: 'GRAVITY_BODY_SETTLED', actionId, detail: { id: b.id, col: b.col } });
          }
        }

        if (isNaN(b.y)) {
          Trace.log({ tag: 'ERROR', name: 'PHYSICS_NAN_DETECTED', actionId, detail: { id: b.id } });
          b.y = b.targetY; b.settled = true;
        }

        hooks.updateOverlayTile(b.id, b.y);
        if (!b.settled) activeInLoop++;
      });

      const allSpawnsActivated = activatedSpawnCols.size === spawnCols.size;
      if (activeInLoop > 0 || !allSpawnsActivated) {
        requestAnimationFrame(loop);
      } else {
        safeComplete('natural');
      }
    };

    requestAnimationFrame(loop);
  });
}
