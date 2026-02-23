
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
import EquationVault from './EquationTracker';
import ParticleLayer, { ParticleHandle } from './ParticleLayer';
import { Trace } from '../debug/trace';
import { gridDigest } from '../debug/gridDigest';
import { resolveAdjacentTarget, Candidate } from '../services/SwapResolver';
import { Engine } from '../services/Engine';
import { getRefillTileForCell } from '../services/mathpopSpawn';
import { SoundEngine } from '../services/SoundEngine';

interface BoardProps {
  grid: (TileData | null)[][];
  rows: number;
  cols: number;
  target: number;
  practiceSet: number[];
  trophyCount: number;
  lifetimeCount: number;
  lastEquation: string;
  isTrackerFlashing: boolean;
  onStateChange: (update: any, event: GameEvent) => void;
  onTrophyCreated?: (tile: TileData, startPos: { x: number; y: number }) => void;
  onOpenSettings?: () => void;
  isDimmed?: boolean;
  highlightedTileId?: string;
  pendingBombRefillCell?: { r: number; c: number } | null;
  onBombSpawned?: () => void;
  trackerRef?: React.RefObject<HTMLDivElement | null>;
}

export interface BoardHandle {
  getMetrics: () => { pad: number; gap: number; tileSize: number; boardRect: DOMRect | null };
}

/** 
 * LOCKED INVARIANTS (REV 3.3): Coordinate Offsets & Density Rules
 */
const HUD_RESERVE_SPACE = 60; // 🔒 Grid Growth Rule
const BORDER_WIDTH = 5; 
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
      trophyCount,
      lifetimeCount,
      lastEquation,
      isTrackerFlashing,
      onStateChange,
      onTrophyCreated,
      onOpenSettings,
      isDimmed,
      highlightedTileId,
      pendingBombRefillCell,
      onBombSpawned,
      trackerRef
    },
    ref
  ) => {
    const [tileSize, setTileSize] = useState(72);
    const gap = 2;           // 🔒 REV 3.3 Density
    const pad = 6;           // 🔒 REV 3.3 Density

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

    const bombRefillToken = useRef(pendingBombRefillCell);
    useEffect(() => { bombRefillToken.current = pendingBombRefillCell; }, [pendingBombRefillCell]);

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
        
        // 🔒 USABLE DIMENSION CONTRACT: Applying growth multiplier only here.
        const usableW = (rect.width - BORDER_WIDTH * 2 - 4) * GRID_SCALE;
        const usableH = (rect.height - BORDER_WIDTH * 2 - 4 - HUD_RESERVE_SPACE) * GRID_SCALE;
        
        if (usableW <= 0 || usableH <= 0) return;
        const maxTileW = Math.floor((usableW - (cols - 1) * gap - 2 * pad) / cols);
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
          
          window.setTimeout(() => {
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
        y: sy - rect.top - BORDER_WIDTH - HUD_RESERVE_SPACE 
      };
      const pointerEndLocal = { 
        x: e.clientX - rect.left - BORDER_WIDTH, 
        y: e.clientY - rect.top - BORDER_WIDTH - HUD_RESERVE_SPACE 
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
        setTimeout(() => {
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
            y: rect.top + p.y + HUD_RESERVE_SPACE + tileSize / 2 
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
        {/* HUD Area (Target Pill, Equation Tracker, Settings) */}
        <div className="absolute top-0 left-0 w-full" style={{ height: HUD_RESERVE_SPACE }}>
          {/* Target Pill */}
          <div className="absolute bg-white text-black w-12 h-12 rounded-2xl shadow-2xl flex items-center justify-center border-b-[5px] border-zinc-300" style={{ left: pad, top: (HUD_RESERVE_SPACE - 48) / 2 }}>
            <span className="text-xl font-black">{target}</span>
            <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-white shadow-sm animate-bounce">{lifetimeCount}</div>
          </div>
          
          {/* Equation Tracker (Relocated to center-left) */}
          <div className="absolute" style={{ left: pad + 48 + 10, top: (HUD_RESERVE_SPACE - 48) / 2 }}>
            <EquationVault 
              ref={trackerRef}
              equation={lastEquation} 
              isFlashing={isTrackerFlashing} 
            />
          </div>

          {/* Settings Control (RELOCATED TO TOP RIGHT per UI Contract) */}
          <button 
             onClick={onOpenSettings}
             className="absolute w-12 h-12 rounded-2xl bg-[#3a322a] flex items-center justify-center text-white/80 shadow-lg active:scale-90 transition-transform border border-white/5"
             style={{ right: pad, top: (HUD_RESERVE_SPACE - 48) / 2 }}
          >
             <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38(1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
          </button>
        </div>

        {/* Playfield Area */}
        <div className="absolute inset-0" style={{ top: HUD_RESERVE_SPACE }}>
          <ParticleLayer ref={particleRef} />
          {Array.from({ length: rows }).map((_, r) => Array.from({ length: cols }).map((_, c) => {
            const p = getPos(r, c);
            return <div key={`${r}-${c}`} className="absolute bg-white/[0.03]" style={{ width: tileSize, height: tileSize, borderRadius: '6px', transform: `translate(${p.x}px, ${p.y}px)` }} />;
          }))}
          {grid.flat().filter(Boolean).map(tile => {
            const p = getPos(tile!.r, tile!.c);
            const dragging = dragInfo?.id === tile!.id && dragInfo.isDragging;
            return <Tile 
              key={tile!.id} 
              tile={{ ...tile!, isIgniting: tile!.id === ignitingBombId ? true : tile!.isIgniting }} 
              tileSize={tileSize} 
              x={p.x + (dragging ? dragInfo!.cx - dragInfo!.sx : 0)} 
              y={p.y + (dragging ? dragInfo!.cy - dragInfo!.sy : 0)} 
              isDragging={dragging} 
              isZapTarget={zappingIds.has(tile!.id)} 
              isHighlighted={highlightedTileId === tile!.id} 
            />;
          })}
        </div>
      </div>
    );
  }
);

export default Board;
