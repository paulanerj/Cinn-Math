
import React, { useEffect, useState, useRef } from 'react';
import { SpeedGridAdapter } from './SpeedGridAdapter';
import { ChainSelector, ChainNode } from './logic/ChainSelector';
import { GravityEngine, GridCell } from './logic/GravityEngine';
import { TimerSystem } from './logic/TimerSystem';
import { ScoringSystem } from './logic/ScoringSystem';
import { EngineTile } from '../../src/engine/public';

const ROWS = 6;
const COLS = 5;
const INITIAL_TIME = 90;

const toGridCell = (t: EngineTile): GridCell => ({
  ...t,
  id: Math.random().toString(36).substr(2, 9),
  key: Math.random().toString(36).substr(2, 9)
});

const SpeedGridGame: React.FC = () => {
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [target, setTarget] = useState(12);
  const [solutionPath, setSolutionPath] = useState<{r:number, c:number}[]>([]); // Debug
  const [selectedChain, setSelectedChain] = useState<string[]>([]);
  const [currentProduct, setCurrentProduct] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [gameState, setGameState] = useState<'LOADING' | 'PLAYING' | 'GAMEOVER'>('LOADING');

  const selectorRef = useRef<ChainSelector>(new ChainSelector());
  const timerRef = useRef<TimerSystem | null>(null);
  const scorerRef = useRef<ScoringSystem>(new ScoringSystem());
  const gridRef = useRef<HTMLDivElement>(null);

  // Debug flag
  const DEBUG_SHOW_PATH = false; 

  useEffect(() => {
    // 1. Init Game (Engine owns initial generation)
    const { target: t, grid: g, solutionPath: path } = SpeedGridAdapter.initializeGame(ROWS, COLS);
    setTarget(t);
    setSolutionPath(path);
    setGrid(g.map(row => row.map(toGridCell)));
    setGameState('PLAYING');
    
    timerRef.current = new TimerSystem(
      INITIAL_TIME,
      (t) => setTimeLeft(t),
      () => setGameState('GAMEOVER')
    );
    timerRef.current.start();

    return () => timerRef.current?.stop();
  }, []);

  const handlePointerDown = (r: number, c: number, cell: GridCell) => {
    if (gameState !== 'PLAYING') return;
    const node: ChainNode = { r, c, val: cell.val, id: cell.id };
    selectorRef.current.start(node);
    updateSelection();
  };

  const updateSelection = () => {
    const chain = selectorRef.current.getChain();
    setSelectedChain(chain.map(n => n.id));
    setCurrentProduct(selectorRef.current.evaluateProduct());
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
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

  const handlePointerUp = () => {
    if (gameState !== 'PLAYING') return;
    const product = selectorRef.current.evaluateProduct();
    
    if (product === target) {
      // --- SUCCESS FLOW ---
      const chain = selectorRef.current.getChain();
      
      // 1. Scoring
      scorerRef.current.addScore(chain.length, target);
      setScore(scorerRef.current.getScore());
      timerRef.current?.addTime(2); 

      // 2. Gravity & Refill (Game owns gravity, Engine owns refills)
      const removedIds = new Set<string>(chain.map(n => n.id));
      const newGrid = GravityEngine.applyGravity(grid, removedIds);
      setGrid(newGrid);

      // 3. Generate New Target (Engine Authority)
      // Engine inspects the *new* grid and picks a guaranteed solvable path
      const { target: newT, solutionPath: newPath } = SpeedGridAdapter.computeTarget(newGrid);
      setTarget(newT);
      setSolutionPath(newPath);
    }
    
    // Reset Selection
    selectorRef.current.clear();
    setSelectedChain([]);
    setCurrentProduct(1);
  };

  const [isDragging, setIsDragging] = useState(false);
  const onMouseDown = (r: number, c: number, cell: GridCell) => {
    setIsDragging(true);
    handlePointerDown(r, c, cell);
  };
  const onMouseEnter = (r: number, c: number, cell: GridCell) => {
    if (isDragging) {
      if (selectorRef.current.addToChain({ r, c, val: cell.val, id: cell.id })) {
        updateSelection();
      }
    }
  };
  const onMouseUp = () => {
    setIsDragging(false);
    handlePointerUp();
  };

  return (
    <div 
      className="flex flex-col items-center justify-center h-screen bg-sky-900 text-white font-sans touch-none select-none"
      onMouseUp={onMouseUp}
      onTouchEnd={handlePointerUp}
      onTouchMove={handleTouchMove}
    >
      {/* HUD */}
      <div className="w-full max-w-md flex justify-between items-center p-6 bg-sky-800/50 backdrop-blur-md border-b border-sky-600/30">
        <div className="flex flex-col items-center">
          <span className="text-sky-300 text-xs font-bold uppercase tracking-widest">Target</span>
          <span className="text-4xl font-black text-white">{target}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sky-300 text-xs font-bold uppercase tracking-widest">Time</span>
          <span className={`text-2xl font-black font-mono ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sky-300 text-xs font-bold uppercase tracking-widest">Score</span>
          <span className="text-2xl font-black text-amber-400">{score}</span>
        </div>
      </div>

      {/* Product Preview */}
      <div className="h-16 flex items-center justify-center">
        {selectedChain.length > 0 && (
          <div className="bg-sky-950/80 px-6 py-2 rounded-full border border-sky-500/30 shadow-lg">
             <span className="text-sky-300 mr-2">Current:</span>
             <span className={`text-xl font-bold ${currentProduct === target ? 'text-green-400' : currentProduct > target ? 'text-red-400' : 'text-white'}`}>
               {currentProduct}
             </span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div 
        ref={gridRef}
        className="grid gap-2 p-4 bg-sky-950/50 rounded-2xl border border-sky-600/20 shadow-2xl"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {grid.map((row, r) => row.map((cell, c) => {
          const isSelected = selectedChain.includes(cell.id);
          const isHint = DEBUG_SHOW_PATH && solutionPath.some(p => p.r === r && p.c === c);
          
          return (
            <div
              key={cell.key}
              data-grid-coord={`${r},${c}`}
              onMouseDown={() => onMouseDown(r, c, cell)}
              onMouseEnter={() => onMouseEnter(r, c, cell)}
              className={`
                w-16 h-16 sm:w-20 sm:h-20 
                rounded-xl flex items-center justify-center 
                text-2xl font-black cursor-pointer 
                transition-all duration-150 transform
                ${isSelected 
                  ? 'bg-amber-500 text-white scale-110 shadow-[0_0_15px_rgba(245,158,11,0.6)] z-10' 
                  : isHint 
                    ? 'bg-green-900/50 text-sky-200 border-2 border-green-500' 
                    : 'bg-white text-sky-900 shadow-sm hover:bg-sky-50'}
              `}
            >
              {cell.val}
            </div>
          );
        }))}
      </div>

      {/* Game Over Modal */}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-sky-900 p-8 rounded-3xl border border-sky-500/30 flex flex-col items-center shadow-2xl">
            <h2 className="text-4xl font-black text-white mb-2">TIME UP!</h2>
            <p className="text-sky-300 text-lg mb-6">Final Score: <span className="text-amber-400 font-bold">{score}</span></p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-600 text-black px-8 py-3 rounded-xl font-black uppercase tracking-wider shadow-lg transition-transform active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeedGridGame;
