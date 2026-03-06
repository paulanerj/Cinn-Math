/**
 * CombineGrid — Phase A+B entry point.
 *
 * Wires together:
 *   CombineGridModule  (game logic)
 *   GridRuntime        (tick loop + interaction dispatch)
 *   GestureRouter      (DOM events → GridInteraction)
 *   GridBoard          (shared board renderer)
 *   GridTile           (shared tile visuals)
 *   HUDTopBar / HUDBottomBar / HUDIconBtn  (shared HUD chrome)
 *   useGridMetrics     (responsive cell sizing)
 *
 * No game logic lives here — this is a thin view + wiring layer.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CombineGridModule }     from './CombineGridModule';
import { GridRuntime }           from '../../platform/grid/engine/GridRuntime';
import { GestureRouter }         from '../../platform/grid/input/GestureRouter';
import { GridBoard }             from '../../platform/grid/ui/GridBoard';
import { GridTile }              from '../../platform/grid/ui/GridTile';
import { HUDTopBar, HUDBottomBar, HUDIconBtn } from '../../platform/grid/ui/HUDShell';
import { useGridMetrics }        from '../../platform/grid/useGridMetrics';
import type { GridGameState }    from '../../platform/grid/engine/gridTypes';
import type { TileVisualState }  from '../../platform/grid/ui/GridTile';

const ROWS = 7;
const COLS = 5;

// ── Tile color palette (matches CombineGridModule) ──────────────────────────

const VALUE_COLORS: Record<number, string> = {
  1:  '#6b7280',
  2:  '#3b82f6',
  3:  '#10b981',
  4:  '#8b5cf6',
  5:  '#f59e0b',
  6:  '#ec4899',
  7:  '#ef4444',
  8:  '#06b6d4',
  9:  '#84cc16',
  10: '#f97316',
  11: '#a78bfa',
  12: '#14b8a6',
};

function tileColor(val: number): string {
  return VALUE_COLORS[val] ?? '#4b5563';
}

// ── Icons ────────────────────────────────────────────────────────────────────

const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconRefresh = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
}

export default function CombineGridGame({ onBack }: Props) {
  // ── Engine refs (stable across renders) ─────────────────────────────────
  const moduleRef  = useRef<CombineGridModule | null>(null);
  const runtimeRef = useRef<GridRuntime | null>(null);
  const gestureRef = useRef<GestureRouter | null>(null);
  const boardRef   = useRef<HTMLDivElement | null>(null);

  // ── View state ────────────────────────────────────────────────────────────
  const [gameState, setGameState] = useState<GridGameState | null>(null);

  // ── Grid sizing ───────────────────────────────────────────────────────────
  const { ref: viewportRef, metrics } = useGridMetrics(ROWS, COLS);
  const cellSize = metrics.cellSize;

  // ── onChange callback for GridRuntime ────────────────────────────────────
  const handleChange = useCallback(() => {
    if (moduleRef.current) {
      setGameState(moduleRef.current.getState());
    }
  }, []);

  // ── Bootstrap on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const mod     = new CombineGridModule();
    const runtime = new GridRuntime(mod, handleChange);
    moduleRef.current  = mod;
    runtimeRef.current = runtime;
    setGameState(mod.getState());
    runtime.start();

    return () => {
      gestureRef.current?.detach();
      gestureRef.current = null;
      runtime.destroy();
      moduleRef.current  = null;
      runtimeRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attach GestureRouter once the board div is mounted + sized ───────────
  const boardCallbackRef = useCallback((el: HTMLDivElement | null) => {
    // Detach previous router if the element changes
    gestureRef.current?.detach();
    gestureRef.current = null;
    boardRef.current = el;

    if (el && runtimeRef.current && cellSize > 0) {
      gestureRef.current = new GestureRouter(
        el,
        ROWS, COLS, cellSize,
        (interaction) => runtimeRef.current?.dispatch(interaction),
      );
    }
  }, [cellSize]);

  // Update GestureRouter dimensions when cellSize changes
  useEffect(() => {
    if (gestureRef.current && cellSize > 0) {
      gestureRef.current.updateDimensions(ROWS, COLS, cellSize);
    }
  }, [cellSize]);

  // Re-attach if el exists but router was never created (first sizing)
  useEffect(() => {
    if (!gestureRef.current && boardRef.current && runtimeRef.current && cellSize > 0) {
      gestureRef.current = new GestureRouter(
        boardRef.current,
        ROWS, COLS, cellSize,
        (interaction) => runtimeRef.current?.dispatch(interaction),
      );
    }
  }, [cellSize]);

  // ── New game ─────────────────────────────────────────────────────────────
  const handleNewGame = useCallback(() => {
    gestureRef.current?.detach();
    gestureRef.current = null;
    runtimeRef.current?.stop();

    const mod     = new CombineGridModule();
    const runtime = new GridRuntime(mod, handleChange);
    moduleRef.current  = mod;
    runtimeRef.current = runtime;
    setGameState(mod.getState());
    runtime.start();
  }, [handleChange]);

  // ── Render tile ──────────────────────────────────────────────────────────
  const renderTile = useCallback(
    (row: number, col: number, size: number) => {
      if (!gameState) return null;
      const cell = gameState.grid[row]?.[col];
      if (!cell) return null;

      let tileState: TileVisualState = 'normal';
      if (cell.selected) tileState = 'selected';

      const color = cell.kind === 'bomb'   ? '#ef4444'
                  : cell.kind === 'trophy' ? '#f59e0b'
                  : cell.kind === 'stone'  ? '#374151'
                  : tileColor(cell.val);

      const label = cell.kind === 'bomb'   ? '💣'
                  : cell.kind === 'trophy' ? '🏆'
                  : cell.kind === 'stone'  ? '◼'
                  : String(cell.val === 0 ? '' : cell.val);

      return (
        <GridTile
          key={cell.id}
          cellSize={size}
          bgColor={color}
          label={label}
          state={tileState}
        />
      );
    },
    [gameState],
  );

  // ── Layout ────────────────────────────────────────────────────────────────
  const target = gameState?.target ?? 0;
  const score  = gameState?.score  ?? 0;

  return (
    <div className="flex flex-col w-full h-full bg-[#111113]" style={{ userSelect: 'none' }}>

      {/* ── Top HUD ── */}
      <HUDTopBar>
        {onBack && (
          <HUDIconBtn onClick={onBack} title="Back">
            <IconBack />
          </HUDIconBtn>
        )}

        {/* Target */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">Target</span>
          <span
            className="text-white text-2xl font-black"
            style={{ minWidth: 48, textAlign: 'center' }}
          >
            {target}
          </span>
        </div>

        {/* Score */}
        <div className="flex flex-col items-end shrink-0">
          <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Score</span>
          <span className="text-white/90 text-base font-black">{score}</span>
        </div>
      </HUDTopBar>

      {/* ── Board ── */}
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 w-full flex items-center justify-center px-2 py-2 overflow-hidden"
      >
        <div
          ref={boardCallbackRef}
          style={{
            width:  cellSize > 0 ? cellSize * COLS : '100%',
            height: cellSize > 0 ? cellSize * ROWS : '100%',
          }}
        >
          {cellSize > 0 && gameState && (
            <GridBoard
              rows={ROWS}
              cols={COLS}
              cellSize={cellSize}
              renderTile={renderTile}
            />
          )}
        </div>
      </div>

      {/* ── Bottom HUD ── */}
      <HUDBottomBar>
        <HUDIconBtn onClick={handleNewGame} title="New Game">
          <IconRefresh />
        </HUDIconBtn>

        <div className="text-white/40 text-xs font-semibold text-center">
          Chain tiles<br />
          <span className="text-white/70">product = {target}</span>
        </div>

        {/* Spacer to balance the icon */}
        <div className="w-12" />
      </HUDBottomBar>

    </div>
  );
}
