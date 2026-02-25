

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { EngineAdapter, Operator } from '../adapter/EngineAdapter';
import { ChainSelector, ChainNode } from '../input/ChainSelector';
import { GravitySystem, GridCell } from '../gravity/GravitySystem';
import { TimerSystem } from '../timer/TimerSystem';
import { ScoringSystem } from '../scoring/ScoreSystem';
import { EngineTile } from '../../../src/engine/public';
import SettingsMenu from './SettingsMenu';
import { GamePhase } from '../core/GameState';
import { GravityAnimator } from '../gravity/GravityAnimator';
import GridViewport from '@/src/platform/grid/GridViewport';
import GameControlsLayer from '@/src/platform/controls/GameControlsLayer';
import { useGridMetrics } from '@/src/platform/grid/useGridMetrics';
import { useToast } from '@/src/platform/ui/ToastContext';
import SpeedGridHeader from './SpeedGridHeader';
import SpeedGridHUD from './SpeedGridHUD';

const ROWS = 6;
const COLS = 5;
const INITIAL_TIME = 90;

const toGridCell = (t: EngineTile): GridCell => ({
  ...t,
  id: Math.random().toString(36).substr(2, 9),
  key: Math.random().toString(36).substr(2, 9),
});

interface SpeedGridGameProps {
  onBack?: () => void;
}

const SpeedGridGame: React.FC<SpeedGridGameProps> = ({ onBack }) => {
  const { addToast } = useToast();
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [target, setTarget] = useState(12);
  const [solutionPath, setSolutionPath] = useState<{ r: number; c: number }[]>([]);
  const [selectedChain, setSelectedChain] = useState<string[]>([]);
  const [currentValue, setCurrentValue] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);

  const [phase, setPhase] = useState<GamePhase>('LOADING');
  const [operator, setOperator] = useState<Operator>('addition');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  const selectorRef = useRef<ChainSelector>(new ChainSelector());
  const timerRef = useRef<TimerSystem | null>(null);
  const scorerRef = useRef<ScoringSystem>(new ScoringSystem());
  const gridRef = useRef<HTMLDivElement>(null);

  // Use platform grid metrics hook
  const { ref: metricsRef, metrics } = useGridMetrics(ROWS, COLS);

  const DEBUG_SHOW_PATH = false;

  const startRound = useCallback((op: Operator) => {
    try {
      const { target: t, grid: g, solutionPath: path } = EngineAdapter.initializeGame(ROWS, COLS, op);
      setTarget(t);
      setSolutionPath(path);
      setGrid(g.map((row) => row.map(toGridCell)));

      setAnimatingIds(new Set());
      selectorRef.current.clear();
      setSelectedChain([]);
      setCurrentValue(op === 'addition' ? 0 : 1);

      setPhase('READY');
      setScore(0);
      scorerRef.current.reset();

      timerRef.current?.stop();
      timerRef.current = new TimerSystem(
        INITIAL_TIME,
        (t2) => setTimeLeft(t2),
        () => setPhase('GAMEOVER')
      );
      timerRef.current.start();
    } catch (error) {
      console.error("Failed to start round:", error);
      addToast("Failed to start round. Please try again.", "error");
    }
  }, [addToast]);

  useEffect(() => {
    startRound(operator);
    return () => timerRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOperatorChange = (newOp: Operator) => {
    setOperator(newOp);
    startRound(newOp);
    setIsSettingsOpen(false);
  };

  const updateSelection = () => {
    const chain = selectorRef.current.getChain();
    setSelectedChain(chain.map((n) => n.id));
    setCurrentValue(selectorRef.current.evaluateProduct(operator));
  };

  const handlePointerDown = (r: number, c: number, cell: GridCell) => {
    if (phase !== 'READY') return;
    const node: ChainNode = { r, c, val: cell.val, id: cell.id };
    selectorRef.current.start(node);
    updateSelection();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (phase !== 'READY') return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const tileEl = el?.closest('[data-grid-coord]');
    if (tileEl) {
      const [r, c] = tileEl.getAttribute('data-grid-coord')!.split(',').map(Number);
      const cell = grid[r][c];
      if (selectorRef.current.addToChain({ r, c, val: cell.val, id: cell.id })) {
        updateSelection();
      }
    }
  };

  const handlePointerUp = async () => {
    if (phase !== 'READY') return;

    const value = selectorRef.current.evaluateProduct(operator);

    const chain = selectorRef.current.getChain();
    selectorRef.current.clear();
    setSelectedChain([]);
    setCurrentValue(operator === 'addition' ? 0 : 1);

    if (value !== target) return;

    scorerRef.current.addScore(chain.length, target);
    setScore(scorerRef.current.getScore());
    timerRef.current?.addTime(2);

    setPhase('SOLVING');

    await new Promise<void>((res) => setTimeout(() => res(), 120));

    setPhase('GRAVITY');

    const removedIds = new Set<string>(chain.map((n) => n.id));
    const postGrid = GravitySystem.computeGravity(grid, removedIds, () => EngineAdapter.getRefill()).finalGrid;

    const container = gridRef.current;

    if (container) {
      await GravityAnimator.animate(
        {
          containerEl: container,
          preGrid: grid,
          postGrid,
          getCellElementByCoord: (r, c) =>
            container.querySelector(`[data-grid-coord="${r},${c}"]`) as HTMLElement | null,

          createOverlayTile: (tile) => {
            const wrapper = document.createElement('div');
            wrapper.className = "w-full h-full flex items-center justify-center p-1 select-none";
            const el = document.createElement('div');
            el.className = 'w-full h-full flex items-center justify-center rounded-xl text-2xl font-black bg-white text-sky-900 shadow-sm select-none';
            el.textContent = String(tile.val);
            wrapper.appendChild(el);
            container.appendChild(wrapper);
            return wrapper;
          },

          destroyOverlayTile: (el) => {
            el.remove();
          },

          onWillAnimateIds: (ids) => {
            setAnimatingIds(new Set(ids));
          },

          onDidAnimateIds: () => {
            setAnimatingIds(new Set());
          },
        },
        {
          SPAWN_OFFSET: 120,
          TILE_STAGGER_MS: 25,
          COLUMN_STAGGER_MS: 30,
          PHASE_SPAWN_DELAY_MS: 120,
        }
      );
    }

    setGrid(postGrid);
    const { target: newT, solutionPath: newPath } = EngineAdapter.computeTarget(postGrid, operator);
    setTarget(newT);
    setSolutionPath(newPath);
    setPhase('READY');
  };

  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (r: number, c: number, cell: GridCell) => {
    setIsDragging(true);
    handlePointerDown(r, c, cell);
  };

  const onMouseEnter = (r: number, c: number, cell: GridCell) => {
    if (phase !== 'READY') return;
    if (!isDragging) return;

    if (selectorRef.current.addToChain({ r, c, val: cell.val, id: cell.id })) {
      updateSelection();
    }
  };

  const onMouseUp = () => {
    setIsDragging(false);
    void handlePointerUp();
  };

  const handleNext = () => {
    startRound(operator);
  };

  const { cellSize } = metrics;

  return (
    <div className="flex flex-col h-full w-full bg-[#1a1a1c] text-white game-ui">
      {/* SpeedGrid-specific top header: Back / title / mode dropdown */}
      <SpeedGridHeader
        onBack={onBack}
        operator={operator}
        onOperatorChange={handleOperatorChange}
      />

      {/* HUD: TARGET | TIME | SCORE — three-column SpeedGrid-specific layout */}
      <SpeedGridHUD
        target={target}
        time={timeLeft}
        score={score}
      />

      {/* Drag hint */}
      <div className="text-center text-white/30 text-[10px] font-bold uppercase tracking-[0.2em] py-1.5 shrink-0 select-none border-b border-white/5">
        DRAG TO CHAIN TILES
      </div>

      {/* Grid Area - Dominant */}
      <GridViewport>
        <div 
          ref={metricsRef}
          className="w-full h-full relative z-0 flex items-center justify-center"
          onMouseUp={onMouseUp}
          onTouchEnd={() => void handlePointerUp()}
          onTouchMove={handleTouchMove}
        >
          {cellSize > 0 && (
            <div
              ref={gridRef}
              className="bg-sky-950/50 rounded-2xl border border-sky-600/20 shadow-2xl relative select-none"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
              }}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  const isSelected = selectedChain.includes(cell.id);
                  const isHint = DEBUG_SHOW_PATH && solutionPath.some((p) => p.r === r && p.c === c);
                  const isOverlayAnimatingThisTile = animatingIds.has(cell.id);

                  return (
                    <div
                      key={cell.key}
                      data-grid-coord={`${r},${c}`}
                      data-tile-id={cell.id}
                      onMouseDown={() => onMouseDown(r, c, cell)}
                      onMouseEnter={() => onMouseEnter(r, c, cell)}
                      className="w-full h-full p-1 select-none" 
                      style={{ 
                        width: cellSize, 
                        height: cellSize,
                      }}
                    >
                      <div className={`
                        w-full h-full
                        rounded-xl flex items-center justify-center
                        text-2xl font-black cursor-pointer
                        transition-all duration-150 transform
                        select-none
                        ${isOverlayAnimatingThisTile ? 'opacity-0 pointer-events-none' : ''}
                        ${
                          isSelected
                            ? 'bg-amber-500 text-white scale-110 shadow-[0_0_15px_rgba(245,158,11,0.6)] z-10'
                            : isHint
                            ? 'bg-green-900/50 text-sky-200 border-2 border-green-500'
                            : 'bg-white text-sky-900 shadow-sm hover:bg-sky-50'
                        }
                      `}
                      >
                        {cell.val}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </GridViewport>

      {/* Shared Controls Layer — onSettings omitted: "New Game" is the sole button
           and renders centered. Mode changes are available via the header dropdown. */}
      <GameControlsLayer
        onNext={handleNext}
        nextLabel="New Game"
        centerSlot={
          <div className="h-10 flex items-center justify-center">
            {selectedChain.length > 0 ? (
              <div className="bg-sky-950/80 px-5 py-1.5 rounded-full border border-sky-500/30 shadow-lg pointer-events-auto flex items-center gap-2">
                <span className="text-sky-300 text-xs font-bold uppercase">
                  {operator === 'addition' ? 'Sum:' : 'Product:'}
                </span>
                <span className={`text-lg font-bold ${currentValue === target ? 'text-green-400' : currentValue > target ? 'text-red-400' : 'text-white'}`}>
                  {currentValue}
                </span>
              </div>
            ) : (
              <div className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                Select Tiles
              </div>
            )}
          </div>
        }
      />

      {/* Game Over Modal */}
      {phase === 'GAMEOVER' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <div className="bg-sky-900 p-8 rounded-3xl border border-sky-500/30 flex flex-col items-center shadow-2xl">
            <h2 className="text-4xl font-black text-white mb-2">TIME UP!</h2>
            <p className="text-sky-300 text-lg mb-6">
              Final Score: <span className="text-amber-400 font-bold">{score}</span>
            </p>
            <button
              onClick={() => startRound(operator)}
              className="bg-amber-500 hover:bg-amber-600 text-black px-8 py-3 rounded-xl font-black uppercase tracking-wider shadow-lg transition-transform active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentOperator={operator}
        onOperatorChange={handleOperatorChange}
      />
    </div>
  );
};

export default SpeedGridGame;
