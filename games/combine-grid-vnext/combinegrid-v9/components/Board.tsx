
/* ⚠ UI CONTRACT PROTECTED
 This file participates in the Combine Grid Layout Contract.
 Do not modify layout math, factor rules, tile geometry, or sizing constants
 without updating COMBINE_GRID_UI_CONTRACT.md.
 This system is intentionally deterministic. No visual changes without explicit contract revision.
*/

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';

import { Tile as TileData, TileKind, GameEvent } from '../types';
import { GridEngine } from '../services/GridEngine';
import { COLORS } from '../constants';
import { FX_TIMING } from '../fx/fxConfig';
import { FxType } from '../fx/fxTypes';
import Tile from './Tile';
import ParticleLayer, { ParticleHandle } from './ParticleLayer';
import { Trace } from '../debug/trace';
import { gridDigest } from '../debug/gridDigest';
import { resolveAdjacentTarget, Candidate } from '../services/SwapResolver';
import { Engine } from '../services/Engine';
import { getRefillTileForCell } from '../services/mathpopSpawn';
import { SoundEngine } from '../services/SoundEngine';
import { BORDER_WIDTH, SAFE_MARGIN, GAP, PAD } from '../uiTokens';

interface BoardProps {
  grid: (TileData | null)[][];
  rows: number;
  cols: number;
  target: number;
  practiceSet: number[];
  onStateChange: (update: any, event: GameEvent) => void;
  onTrophyCreated?: (tile: TileData, startPos: { x: number; y: number }) => void;
  isDimmed?: boolean;
  highlightedTileId?: string;
  pendingBombRefillCell?: { r: number; c: number } | null;
  onBombSpawned?: () => void;
}

export interface BoardHandle {
  getMetrics: () => { pad: number; gap: number; tileSize: number; boardRect: DOMRect | null };
}

/** 
 * LOCKED INVARIANTS (REV 3.3): Coordinate Offsets & Density Rules
 */
const HUD_RESERVE_SPACE = 0;  // HUD lives in App.tsx top bar now
// BORDER_WIDTH, SAFE_MARGIN imported from uiTokens
const DRAG_START_THRESHOLD = 10;
const BOMB_TAP_TIME_MS = 250;

/**
 * GRID_SCALE CONTRACT (Rev 1.1)
 * Mobile Density Preset A: 1.03 maximizes grid size while preserving full visibility
 * of the top HUD (target pill) and bottom action bar on mobile devices.
 */
const GRID_SCALE = 1.03;       // 🔒 LOCKED PRESET A (FINAL)

const Board = forwardRef<BoardHandle, BoardProps>(
  (
    {
      grid,
      rows,
      cols,
      target,
      practiceSet,
      onStateChange,
      onTrophyCreated,
      isDimmed,
      highlightedTileId,
      pendingBombRefillCell,
      onBombSpawned,
    },
    ref
  ) => {
    const [tileSize, setTileSize] = useState(72);
    const gap = GAP;         // 🔒 REV 3.3 Density (source: uiTokens)
    const pad = PAD;         // 🔒 REV 3.3 Density (source: uiTokens)

    const [dragInfo, setDragInfo] = useState<{
      id: string;
      sx: number;
      sy: number;
      cx: number;
      cy: number;
      startTime: number;
      isDragging: boolean;
      actionId: string;
    } | null>(null);

    const [zappingIds, setZappingIds] = useState<Set<string>>(new Set());
    const [isShaking, setIsShaking] = useState(false);
    const [locked, setLocked] = useState(false);
    const [ignitingBombId, setIgnitingBombId] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const particleRef = useRef<ParticleHandle>(null);
    const spawnTimers = useRef<Map<string, number>>(new Map());
    const bombTimerRef = useRef<number | null>(null);
    const zapTimerRef  = useRef<number | null>(null);

    const bombRefillToken = useRef(pendingBombRefillCell);
    useEffect(() => { bombRefillToken.current = pendingBombRefillCell; }, [pendingBombRefillCell]);

    // Unmount cleanup: cancel in-flight timers so no setState fires after unmount
    useEffect(() => {
      return () => {
        if (bombTimerRef.current) clearTimeout(bombTimerRef.current);
        if (zapTimerRef.current)  clearTimeout(zapTimerRef.current);
        spawnTimers.current.forEach(t => clearTimeout(t));
      };
    }, []);

    useImperativeHandle(ref, () => ({
      getMetrics: () => ({
        pad, gap, tileSize,
        boardRect: containerRef.current?.getBoundingClientRect() || null
      })
    }));

    const getPos = useCallback(
      (r: number, c: number) => ({
        x: pad + c * (tileSize + gap),
        y: pad + r * (tileSize + gap)
      }),
      [pad, tileSize, gap]
    );

    useEffect(() => {
      const updateSize = () => {
        const parent = containerRef.current?.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        
        // Width-first (Mobile Grid Dominance Policy):
        // targetBoardW = viewport − SAFE_MARGIN×2, capped by container on larger screens.
        const targetBoardW = Math.min(window.innerWidth - SAFE_MARGIN * 2, rect.width);
        const maxTileW = Math.floor((targetBoardW - BORDER_WIDTH * 2 - (cols - 1) * gap - 2 * pad) / cols);

        // Height: unchanged — parent height with GRID_SCALE multiplier.
        const usableH = (rect.height - BORDER_WIDTH * 2 - 4 - HUD_RESERVE_SPACE) * GRID_SCALE;

        if (maxTileW <= 0 || usableH <= 0) return;
        const maxTileH = Math.floor((usableH - (rows - 1) * gap - 2 * pad) / rows);
        
        setTileSize(Math.max(30, Math.min(maxTileW, maxTileH, 110)));
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }, [rows, cols, gap, pad]);

    const refillCell = useCallback(
      (r: number, c: number, delay: number, actionId: string) => {
        const key = `${r}-${c}`;
        if (spawnTimers.current.has(key)) clearTimeout(spawnTimers.current.get(key));
        const timer = window.setTimeout(() => {
          spawnTimers.current.delete(key);
          const decision = getRefillTileForCell({
            r, c, target, practiceSet,
            pendingBombRefillCell: bombRefillToken.current || null
          });
          
          onStateChange(
            (prev: (TileData | null)[][]) => {
              if (!prev[r] || prev[r][c] !== null) return prev;
              if (decision.consumedBombToken) onBombSpawned?.();
              const newTile = GridEngine.createTile(r, c, decision.kind, decision.val);
              return prev.map((row, ri) => row.map((t, ci) => (ri === r && ci === c ? newTile : t)));
            },
            { 
              type: 'SPAWN_TILE', 
              description: decision.desc, 
              matrix: '', 
              actionId, 
              timestamp: Date.now(), 
              sourceCell: { r, c },
              spawnKind: decision.kind
            }
          );
        }, delay);
        spawnTimers.current.set(key, timer);
      },
      [target, practiceSet, onStateChange, onBombSpawned]
    );

    const handlePointerDown = (e: React.PointerEvent) => {
      if (locked || isDimmed || ignitingBombId) return;
      const tileEl = (e.target as HTMLElement).closest('[data-tile-id]');
      if (!tileEl) return;
      const id = tileEl.getAttribute('data-tile-id')!;
      const t = grid.flat().find(x => x?.id === id);
      
      if (!t || t.fixed) return;

      SoundEngine.playPickup();
      
      containerRef.current?.setPointerCapture(e.pointerId);
      setDragInfo({ 
        id, 
        sx: e.clientX, 
        sy: e.clientY, 
        cx: e.clientX, 
        cy: e.clientY, 
        startTime: Date.now(), 
        isDragging: false, 
        actionId: Trace.newActionId() 
      });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragInfo) return;
      const dx = e.clientX - dragInfo.sx;
      const dy = e.clientY - dragInfo.sy;
      const isDragging = dragInfo.isDragging || Math.sqrt(dx * dx + dy * dy) > DRAG_START_THRESHOLD;
      setDragInfo({ ...dragInfo, cx: e.clientX, cy: e.clientY, isDragging });
    };

    const triggerGoldenSequence = (tile: TileData, startPos: { x: number; y: number }) => {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), FX_TIMING.SHAKE_MS);
      if (onTrophyCreated) onTrophyCreated(tile, startPos);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!dragInfo) return;
      const { id: sourceId, isDragging, startTime, actionId, sx, sy } = dragInfo;
      setDragInfo(null);
      try { containerRef.current?.releasePointerCapture(e.pointerId); } catch {}
      
      const source = grid.flat().find(x => x?.id === sourceId);
      if (!source) return;

      if (!isDragging && Date.now() - startTime < BOMB_TAP_TIME_MS) {
        if (source.kind === TileKind.BOMB) {
          setLocked(true); 
          setIgnitingBombId(source.id);
          onStateChange((prev: any) => prev.map((row: any) => row.map((t: any) => (t?.id === source.id ? { ...t, isIgniting: true } : t))), { type: 'BOMB_IGNITE', description: 'Bomb ignite', matrix: '', actionId, timestamp: Date.now() });
          
          bombTimerRef.current = window.setTimeout(() => {
            const { grid: nextGrid, explodedIds, trophiesCount } = GridEngine.explode(grid, source.r, source.c);
            explodedIds.forEach(id => {
              const t = grid.flat().find(x => x?.id === id);
              if (t) {
                const pos = getPos(t.r, t.c);
                particleRef.current?.trigger(FxType.BOMB, pos.x, pos.y, COLORS.kinds[t.kind] || '#fff', tileSize);
                refillCell(t.r, t.c, FX_TIMING.REFILL_DELAY_MS, actionId);
              }
            });
            onStateChange(nextGrid, { type: 'BOMB_EXPLODED', description: 'Boom', matrix: gridDigest(nextGrid), actionId, trophiesRemoved: trophiesCount });
            setIgnitingBombId(null); 
            setLocked(false);
          }, FX_TIMING.BOMB_IGNITE_MS);
        } else {
            // Re-trigger snapback sound on immediate drop if picked up and let go
            SoundEngine.playSnapback();
        }
        return;
      }

      if (!isDragging) {
         SoundEngine.playSnapback();
         return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const pointerStartLocal = {
        x: sx - rect.left - BORDER_WIDTH,
        y: sy - rect.top - BORDER_WIDTH
      };
      const pointerEndLocal = {
        x: e.clientX - rect.left - BORDER_WIDTH,
        y: e.clientY - rect.top - BORDER_WIDTH
      };

      const candidates: Candidate[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = source.r + dr, nc = source.c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const t = grid[nr][nc];
            if (t) {
              const p = getPos(nr, nc);
              candidates.push({ 
                r: nr, 
                c: nc, 
                center: { x: p.x + tileSize / 2, y: p.y + tileSize / 2 } 
              });
            }
          }
        }
      }

      const resolution = resolveAdjacentTarget({ sourceCell: source, candidates, pointerEndLocal, pointerStartLocal, tileSize });

      if (!resolution.ok || !resolution.targetCell) {
        onStateChange(grid, { type: 'SNAPBACK', description: resolution.reason || 'SNAPBACK:RESOLVER_FAILED', matrix: '', actionId });
        return;
      }

      const targetTile = grid[resolution.targetCell.r][resolution.targetCell.c];
      if (!targetTile) return;

      const trophyInvolved = source.kind === TileKind.TROPHY || targetTile.kind === TileKind.TROPHY;
      const bombInvolved = source.kind === TileKind.BOMB || targetTile.kind === TileKind.BOMB;

      if (bombInvolved) {
        if (trophyInvolved) {
          onStateChange(
            (prev: any) => prev.map((row: any) => row.map((t: any) => 
              t?.id === source.id ? { ...targetTile, r: source.r, c: source.c } : 
              t?.id === targetTile.id ? { ...source, r: targetTile.r, c: targetTile.c } : t
            )),
            { 
              type: 'SWAP_SUCCESS', 
              description: 'Bomb Trophy Swap', 
              matrix: gridDigest(grid), 
              actionId,
              sourceCell: { r: source.r, c: source.c } 
            }
          );
        } else {
          onStateChange(grid, { type: 'SNAPBACK', description: 'SNAPBACK:BOMB_DRAG_WITHOUT_TROPHY', matrix: '', actionId });
        }
        return;
      }

      if (targetTile.fixed && !trophyInvolved) {
        onStateChange(grid, { type: 'SNAPBACK', description: 'SNAPBACK:TARGET_FIXED_NO_TROPHY', matrix: '', actionId });
        return;
      }

      if (trophyInvolved) {
        onStateChange(
          (prev: any) => prev.map((row: any) => row.map((t: any) => 
            t?.id === source.id ? { ...targetTile, r: source.r, c: source.c } : 
            t?.id === targetTile.id ? { ...source, r: targetTile.r, c: targetTile.c } : t
          )),
          { 
            type: 'SWAP_SUCCESS', 
            description: 'Swap Success', 
            matrix: gridDigest(grid), 
            actionId,
            sourceCell: { r: source.r, c: source.c } 
          }
        );
      } else if (source.val === 0 || targetTile.val === 0) {
        setLocked(true);
        setZappingIds(new Set([source.id, targetTile.id]));
        onStateChange((prev: any) => prev.map((row: any) => row.map((t: any) => (t?.id === source.id || t?.id === targetTile.id ? { ...t!, val: 0, isZapping: true } : t))), { type: 'ZAP_TRIGGER', description: 'Zap!', matrix: '', actionId });
        zapTimerRef.current = window.setTimeout(() => {
          // Trigger particle burst for the zapped tiles
          const sPos = getPos(source.r, source.c);
          const tPos = getPos(targetTile.r, targetTile.c);
          particleRef.current?.trigger(FxType.ZAP, sPos.x, sPos.y, '#22d3ee', tileSize);
          particleRef.current?.trigger(FxType.ZAP, tPos.x, tPos.y, '#22d3ee', tileSize);

          setZappingIds(new Set()); 
          setLocked(false);
          onStateChange((prev: any) => prev.map((row: any) => row.map((t: any) => (t?.id === source.id || t?.id === targetTile.id ? null : t))), { type: 'ZAP_RESOLVE', description: 'Zap Clear', matrix: '', actionId });
          refillCell(source.r, source.c, 60, actionId); 
          refillCell(targetTile.r, targetTile.c, 60, actionId);
        }, FX_TIMING.ZAP_DELAY_MS);
      } else {
        const evaluation = Engine.evaluateInteraction(source, targetTile, target);

        if (evaluation.event === 'MERGE_TROPHY') {
          const p = getPos(targetTile.r, targetTile.c);
          const startPos = {
            x: rect.left + p.x + tileSize / 2,
            y: rect.top + p.y + tileSize / 2
          };
          const resultTile = { ...targetTile, ...evaluation } as TileData;
          triggerGoldenSequence(resultTile, startPos);
        }

        onStateChange(
          (prev: any) => prev.map((row: any) => row.map((t: any) => 
            t?.id === targetTile.id ? { ...t, kind: evaluation.kind, val: evaluation.val, lineage: evaluation.lineage, fixed: evaluation.fixed } : 
            t?.id === source.id ? null : t
          )),
          { 
            type: evaluation.event, 
            description: evaluation.description, 
            equation: evaluation.description, 
            lineage: evaluation.lineage, 
            matrix: gridDigest(grid), 
            actionId, 
            sourceCell: { r: source.r, c: source.c },
            result: evaluation.val 
          }
        );
        refillCell(source.r, source.c, FX_TIMING.REFILL_DELAY_MS, actionId);
      }
    };

    const boardW = pad * 2 + cols * tileSize + (cols - 1) * gap + BORDER_WIDTH * 2;
    const boardH = pad * 2 + rows * tileSize + (rows - 1) * gap + BORDER_WIDTH * 2 + HUD_RESERVE_SPACE;

    return (
      <div
        ref={containerRef}
        className={`relative bg-[#2a221a] border-[5px] border-[#3a322a] rounded-[22px] shadow-2xl select-none touch-none overflow-visible transition-opacity duration-500 ${isShaking ? 'animate-[shake_0.3s_both]' : ''} ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
        style={{ width: boardW, height: boardH }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Playfield Area */}
        <div className="absolute inset-0" style={{ top: 0 }}>
          <ParticleLayer ref={particleRef} />
          {Array.from({ length: rows }).map((_, r) => Array.from({ length: cols }).map((_, c) => {
            const p = getPos(r, c);
            return <div key={`${r}-${c}`} className="absolute bg-white/[0.03]" style={{ width: tileSize, height: tileSize, borderRadius: '16px', transform: `translate(${p.x}px, ${p.y}px)` }} />;
          }))}
          {grid.flat().filter(Boolean).map(tile => {
            const p = getPos(tile!.r, tile!.c);
            const dragging = dragInfo?.id === tile!.id && dragInfo.isDragging;
            const isFactorOfTarget =
              tile!.kind === TileKind.NUMBER &&
              tile!.val !== 0 &&
              target % tile!.val === 0;
            return <Tile
              key={tile!.id}
              tile={{ ...tile!, isIgniting: tile!.id === ignitingBombId ? true : tile!.isIgniting }}
              tileSize={tileSize}
              x={p.x + (dragging ? dragInfo!.cx - dragInfo!.sx : 0)}
              y={p.y + (dragging ? dragInfo!.cy - dragInfo!.sy : 0)}
              isDragging={dragging}
              isZapTarget={zappingIds.has(tile!.id)}
              isHighlighted={highlightedTileId === tile!.id}
              isFactorOfTarget={isFactorOfTarget}
            />;
          })}
        </div>
      </div>
    );
  }
);

export default Board;
