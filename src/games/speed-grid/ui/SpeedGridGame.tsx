/**
 * SpeedGridGame — Phase C SpeedGrid entry point.
 *
 * Wires together:
 *   SpeedGridModule  (game logic, tick-based timer)
 *   GridRuntime      (tick loop + interaction dispatch)
 *   GestureRouter    (DOM events → GridInteraction)
 *   GridBoard        (shared board renderer)
 *   GridTile         (shared tile visuals)
 *   HUDTopBar / HUDBottomBar / HUDIconBtn  (shared HUD chrome)
 *   useGridMetrics   (responsive cell sizing, capped at 110px)
 *
 * Phase C — SpeedGrid Consolidation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { SpeedGridModule }          from '../SpeedGridModule';
import { GridRuntime }              from '../../../platform/grid/engine/GridRuntime';
import { GestureRouter }            from '../../../platform/grid/input/GestureRouter';
import { GridBoard }                from '../../../platform/grid/ui/GridBoard';
import { GridTile }                 from '../../../platform/grid/ui/GridTile';
import { HUDTopBar, HUDBottomBar, HUDIconBtn } from '../../../platform/grid/ui/HUDShell';
import { useGridMetrics }           from '../../../platform/grid/useGridMetrics';
import type { GridGameState }       from '../../../platform/grid/engine/gridTypes';
import type { TileVisualState }     from '../../../platform/grid/ui/GridTile';

const ROWS = 6;
const COLS = 5;

// ── Tile color palette (blue/cyan theme for SpeedGrid) ──────────────────────

const SPEED_COLORS: Record<number, string> = {
  1: '#3b82f6',
  2: '#0ea5e9',
  3: '#06b6d4',
  4: '#0891b2',
  5: '#2563eb',
  6: '#0284c7',
  7: '#7c3aed',
  8: '#1d4ed8',
  9: '#0e7490',
};

function tileColor(val: number): string {
  return SPEED_COLORS[val] ?? '#3b82f6';
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void;
}

export default function SpeedGridGame({ onBack }: Props) {
  // ── Engine refs ──────────────────────────────────────────────────────────
  const moduleRef  = useRef<SpeedGridModule | null>(null);
  const runtimeRef = useRef<GridRuntime | null>(null);
  const gestureRef = useRef<GestureRouter | null>(null);
  const boardRef   = useRef<HTMLDivElement | null>(null);

  // ── View state ────────────────────────────────────────────────────────────
  const [gameState, setGameState] = useState<GridGameState | null>(null);
  const [operator, setOperator] = useState<'addition' | 'multiplication'>('addition');

  // ── Grid sizing ───────────────────────────────────────────────────────────
  const { ref: viewportRef, metrics } = useGridMetrics(ROWS, COLS);
  const cellSize = metrics.cellSize;

  // ── onChange callback ─────────────────────────────────────────────────────
  const handleChange = useCallback(() => {
    if (moduleRef.current) {
      setGameState(moduleRef.current.getState());
    }
  }, []);

  // ── Bootstrap on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const mod     = new SpeedGridModule(operator);
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

  // ── Attach GestureRouter once board div is mounted + sized ────────────────
  const boardCallbackRef = useCallback((el: HTMLDivElement | null) => {
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

  // ── New game ──────────────────────────────────────────────────────────────
  const handleNewGame = useCallback((newOp?: 'addition' | 'multiplication') => {
    gestureRef.current?.detach();
    gestureRef.current = null;
    runtimeRef.current?.stop();

    const op  = newOp ?? operator;
    const mod     = new SpeedGridModule(op);
    const runtime = new GridRuntime(mod, handleChange);
    moduleRef.current  = mod;
    runtimeRef.current = runtime;
    setGameState(mod.getState());
    runtime.start();
  }, [handleChange, operator]);

  const handleOperatorChange = useCallback((op: 'addition' | 'multiplication') => {
    setOperator(op);
    handleNewGame(op);
  }, [handleNewGame]);

  // ── Render tile ───────────────────────────────────────────────────────────
  const renderTile = useCallback(
    (row: number, col: number, size: number) => {
      if (!gameState) return null;
      const cell = gameState.grid[row]?.[col];
      if (!cell) return null;

      const tileState: TileVisualState = cell.selected ? 'selected' : 'normal';
      const bgColor = cell.selected ? '#f59e0b' : tileColor(cell.val);
      const label = String(cell.val);

      return (
        <GridTile
          key={cell.id}
          cellSize={size}
          bgColor={bgColor}
          label={label}
          state={tileState}
        />
      );
    },
    [gameState],
  );

  // ── Derived state ─────────────────────────────────────────────────────────
  const target        = gameState?.target ?? 0;
  const score         = gameState?.score  ?? 0;
  const timeRemaining = gameState?.timeRemaining ?? 90;
  const isGameOver    = gameState?.phase === 'gameover';

  // Running chain value (computed without extra state)
  const chainVal = gameState?.grid.flat()
    .filter(c => c.selected)
    .reduce(
      (acc, c) => operator === 'addition' ? acc + c.val : acc * c.val,
      operator === 'addition' ? 0 : 1
    ) ?? 0;

  // Time color-coding
  const timeColor = timeRemaining >= 30 ? '#ffffff'
                  : timeRemaining >= 10 ? '#facc15'  // yellow-400
                  : '#f87171';                         // red-400

  return (
    <div className="flex flex-col w-full h-full bg-[#111113]" style={{ userSelect: 'none' }}>

      {/* ── Top HUD ── */}
      <HUDTopBar>
        {onBack && (
          <HUDIconBtn onClick={onBack} title="Back">
            <IconBack />
          </HUDIconBtn>
        )}

        {/* Timer */}
        <div className="flex flex-col items-center shrink-0">
          <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Time</span>
          <span className="text-xl font-black" style={{ color: timeColor, minWidth: 36, textAlign: 'center' }}>
            {timeRemaining}
          </span>
        </div>

        {/* Target */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">Target</span>
          <span className="text-white text-2xl font-black" style={{ minWidth: 48, textAlign: 'center' }}>
            {target}
          </span>
        </div>

        {/* Operator toggle */}
        <button
          onClick={() => handleOperatorChange(operator === 'addition' ? 'multiplication' : 'addition')}
          className="shrink-0 px-3 py-1 rounded-lg bg-white/10 text-white/70 text-sm font-bold hover:bg-white/20 transition-colors"
          title="Toggle operator"
        >
          {operator === 'addition' ? '+' : '×'}
        </button>
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
        <HUDIconBtn onClick={() => handleNewGame()} title="New Game">
          <IconRefresh />
        </HUDIconBtn>

        {/* Running chain value */}
        <div className="text-center">
          {chainVal > 0 ? (
            <span className={`text-lg font-black ${chainVal === target ? 'text-green-400' : 'text-white/70'}`}>
              {operator === 'addition' ? 'Sum' : 'Product'}: {chainVal}
            </span>
          ) : (
            <span className="text-white/30 text-xs font-semibold uppercase tracking-widest">Drag to chain</span>
          )}
        </div>

        {/* Score */}
        <div className="flex flex-col items-end shrink-0">
          <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Score</span>
          <span className="text-white/90 text-base font-black">{score}</span>
        </div>
      </HUDBottomBar>

      {/* ── Game Over overlay ── */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <div className="bg-[#1a1a2e] p-8 rounded-3xl border border-blue-500/30 flex flex-col items-center shadow-2xl">
            <h2 className="text-4xl font-black text-white mb-2">TIME UP!</h2>
            <p className="text-blue-300 text-lg mb-6">
              Final Score: <span className="text-amber-400 font-bold">{score}</span>
            </p>
            <button
              onClick={() => handleNewGame()}
              className="bg-amber-500 hover:bg-amber-600 text-black px-8 py-3 rounded-xl font-black uppercase tracking-wider shadow-lg transition-transform active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
