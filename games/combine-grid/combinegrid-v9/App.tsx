
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tile, GameEvent, Phase, TileKind, TargetSource, PracticeProfile } from './types';
import { GRID_CONFIG } from './constants';
import { FX_TIMING } from './fx/fxConfig';
import { GridEngine } from './services/GridEngine';
import { Solver } from './services/Solver';
import { TargetGenerator } from './services/TargetGenerator';
import Board, { BoardHandle } from './components/Board';
import SettingsModal from './components/SettingsModal';
import FlyoutPill from './components/FlyoutPill';
import { Trace } from './debug/trace';
import { SoundEngine } from './services/SoundEngine';

const DEFAULT_RECIPE = [12, 15, 24, 32, 56];

const App: React.FC = () => {
  const [grid, setGrid] = useState<(Tile | null)[][]>([]);
  const [history, setHistory] = useState<{
    grid: (Tile | null)[][];
    trophies: number;
    lastEq: string;
    lifetimeTrophies: number;
    milestones: Set<number>;
    pendingBomb: { r: number, c: number } | null;
  } | null>(null);

  const [events, setEvents] = useState<GameEvent[]>([]);
  
  // --- Target Engine Authority (Contract 1) ---
  const generatorRef = useRef<TargetGenerator | null>(null);
  const [targetValue, setTargetValue] = useState(GRID_CONFIG.TARGET_VALUE);
  
  // UI Authority State (Contract Restoration)
  const [mode, setMode] = useState<TargetSource>(TargetSource.RECIPE);
  const [practiceSet, setPracticeSet] = useState<number[]>([2, 3, 4, 5, 6]);
  const [recipeTargets, setRecipeTargets] = useState<number[]>(DEFAULT_RECIPE);

  const [rows, setRows] = useState(GRID_CONFIG.DEFAULT_ROWS);
  const [cols, setCols] = useState(GRID_CONFIG.DEFAULT_COLS);
  const [trophiesEarned, setTrophiesEarned] = useState(0);

  const [trophiesLifetimeEarned, setTrophiesLifetimeEarned] = useState(0);
  const [bombMilestonesTriggered, setBombMilestonesTriggered] = useState<Set<number>>(new Set());
  const [pendingBombRefillCell, setPendingBombRefillCell] = useState<{ r: number, c: number } | null>(null);

  const [lastEquation, setLastEquation] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>(Phase.PLAYING);
  const [flyout, setFlyout] = useState<{ id: string; text: string; fullEq: string; startPos: { x: number; y: number } } | null>(null);
  const [isTrackerFlashing, setIsTrackerFlashing] = useState(false);
  const [countingTrophyId, setCountingTrophyId] = useState<string | null>(null);

  const boardRef = useRef<BoardHandle>(null);
  const trackerRef = useRef<HTMLDivElement>(null);

  const initRound = useCallback((config?: {
    rows?: number;
    cols?: number;
    mode?: TargetSource;      // Explicit Mode Authority
    recipe?: number[];        // Explicit Recipe Authority
    practiceSet?: number[];   // Explicit Practice Authority
    indexShift?: number;
  }) => {
    const actionId = Trace.newActionId();
    const r = config?.rows ?? rows;
    const c = config?.cols ?? cols;
    
    // Resolve Authority values (Config > State > Default)
    const nextMode = config?.mode ?? mode;
    const nextPracticeSet = config?.practiceSet ?? practiceSet;
    const nextRecipe = config?.recipe ?? recipeTargets;

    // Initialize or Update Generator if configuration changed or first run
    if (!generatorRef.current || config?.mode || config?.recipe || config?.practiceSet) {
      const profile: PracticeProfile = {
        multipliers: nextPracticeSet,
        coMultiplierRange: [2, 12],
        excludeTrivial: true,
        scheduler: 'BAG'
      };
      
      generatorRef.current = new TargetGenerator(nextMode, profile, nextRecipe);
      
      // Update UI State Authorities
      if (config?.mode) setMode(config.mode);
      if (config?.practiceSet) setPracticeSet(config.practiceSet);
      if (config?.recipe) setRecipeTargets(config.recipe);
    }

    if (config?.rows) setRows(r);
    if (config?.cols) setCols(c);

    // Resolve Target
    let targetDef;
    if (config?.indexShift !== undefined) {
      targetDef = config.indexShift > 0 ? generatorRef.current.next() : generatorRef.current.prev();
      if (!targetDef) targetDef = generatorRef.current.current(); // Safety fallback
    } else {
      targetDef = generatorRef.current.current();
    }
    
    setTargetValue(targetDef.val);

    // Fix: Removed trophiesLifetimeEarned from seedGrid call as it only expects 3-4 arguments.
    const newGrid = GridEngine.seedGrid(r, c, targetDef.val, nextPracticeSet);
    setGrid(newGrid);

    setTrophiesEarned(0);
    setLastEquation('');
    setPhase(Phase.PLAYING);
    setHistory(null);
    setIsSettingsOpen(false);
    setFlyout(null);
    setCountingTrophyId(null);
    setPendingBombRefillCell(null);

    setEvents(prev => [...prev, {
      type: 'INIT',
      description: `Target: ${targetDef.val} (${targetDef.derivation})`,
      matrix: '',
      actionId,
      timestamp: Date.now()
    }]);
  }, [rows, cols, mode, practiceSet, recipeTargets]);

  useEffect(() => {
    initRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNextTarget = () => { SoundEngine.playTap(); initRound({ indexShift: 1 }); };
  const handlePrevTarget = () => { SoundEngine.playTap(); initRound({ indexShift: -1 }); };

  const startCountingSequence = useCallback(async () => {
    if (phase !== Phase.PLAYING) return;
    SoundEngine.playTap();
    setPhase(Phase.COUNTING);
    const trophies = grid.flat().filter(t => t?.kind === TileKind.TROPHY) as Tile[];
    let count = 0;

    for (const t of trophies) {
      setCountingTrophyId(t.id);
      SoundEngine.playCountStep(count);
      await new Promise(r => setTimeout(r, FX_TIMING.COUNT_STEP_MS));
      count++;
      setTrophiesEarned(count);
    }

    setCountingTrophyId(null);
    setTimeout(() => {
      SoundEngine.playResultsFanfare();
      setPhase(Phase.RESULTS);
    }, 600);
  }, [grid, phase]);

  const handleStateChange = useCallback((update: any, event: GameEvent) => {
    // 🎵 Sound Engine Event Routing
    switch(event.type) {
      case 'MERGE_STANDARD': SoundEngine.playMergeStandard(); break;
      case 'MERGE_TROPHY': SoundEngine.playMergeTrophy(); break;
      case 'MERGE_STONE': SoundEngine.playMergeStone(); break;
      case 'ZAP_TRIGGER': SoundEngine.playZapTrigger(); break;
      case 'ZAP_RESOLVE': SoundEngine.playZapResolve(); break;
      case 'BOMB_IGNITE': SoundEngine.playBombIgnite(); break;
      case 'BOMB_EXPLODED': SoundEngine.playBombExplode(); break;
      case 'SWAP_SUCCESS': SoundEngine.playSwap(); break;
      case 'SNAPBACK': SoundEngine.playSnapback(); break;
      case 'SPAWN_TILE': SoundEngine.playSpawn(); break;
    }

    let sideEffectEvents: GameEvent[] = [];

    if (event.type === 'MERGE_TROPHY' && event.sourceCell) {
      const newLifetime = trophiesLifetimeEarned + 1;
      setTrophiesLifetimeEarned(newLifetime);

      const milestones = [10, 20, 30];
      if (milestones.includes(newLifetime) && !bombMilestonesTriggered.has(newLifetime)) {
        setBombMilestonesTriggered(prev => {
          const next = new Set(prev);
          next.add(newLifetime);
          return next;
        });
        setPendingBombRefillCell(event.sourceCell);
        sideEffectEvents.push({
          type: 'BOMB_MILESTONE',
          description: `[BOMB_MILESTONE] trophiesLifetimeEarned=${newLifetime} cell=r${event.sourceCell.r}c${event.sourceCell.c} scheduled`,
          matrix: '',
          actionId: event.actionId
        });
      }
    }

    if (event.type === 'SPAWN_TILE' && event.spawnKind === TileKind.BOMB && pendingBombRefillCell) {
      if (event.sourceCell?.r === pendingBombRefillCell.r && event.sourceCell?.c === pendingBombRefillCell.c) {
        setPendingBombRefillCell(null);
        sideEffectEvents.push({
          type: 'BOMB_SPAWNED',
          description: `[BOMB_SPAWN] cell=r${event.sourceCell.r}c${event.sourceCell.c} consumedToken=true`,
          matrix: '',
          actionId: event.actionId
        });
      }
    }

    // FEATURE RESTORE: Only update equation pill immediately for non-trophies.
    if (event.equation && event.type !== 'MERGE_TROPHY') {
      setLastEquation(event.equation);
    }

    setGrid((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;

      if (event.type !== 'SPAWN_TILE' && event.type !== 'INIT' && event.type !== 'SNAPBACK') {
        setHistory({
          grid: prev,
          trophies: trophiesEarned,
          lastEq: lastEquation,
          lifetimeTrophies: trophiesLifetimeEarned,
          milestones: new Set(bombMilestonesTriggered),
          pendingBomb: pendingBombRefillCell
        });
      }

      if (event.type !== 'SNAPBACK' && event.type !== 'SPAWN_TILE') {
        const moveRemains = Solver.hasAnyLegalMove(next, targetValue);
        if (!moveRemains && next.flat().some(t => t?.kind === TileKind.TROPHY)) {
          setTimeout(startCountingSequence, FX_TIMING.DRY_DELAY_MS);
        }
      }

      return next;
    });

    setEvents(p => [...p, event, ...sideEffectEvents]);
  }, [trophiesEarned, lastEquation, targetValue, startCountingSequence, trophiesLifetimeEarned, bombMilestonesTriggered, pendingBombRefillCell]);

  const onTrophyCreated = (tile: Tile, startPos: { x: number; y: number }) => {
    setFlyout({
      id: Math.random().toString(36),
      text: `${tile.lineage} = ${tile.val}`,
      fullEq: `${tile.lineage} = ${tile.val}`,
      startPos
    });
  };

  const handleFlyoutComplete = () => {
    if (flyout?.fullEq) {
       setLastEquation(flyout.fullEq);
    }
    setFlyout(null);
    setIsTrackerFlashing(true);
    setTimeout(() => setIsTrackerFlashing(false), FX_TIMING.HUD_FLASH_MS);
  };

  const handleUndo = () => {
    SoundEngine.playTap();
    if (history && phase === Phase.PLAYING) {
      setGrid(history.grid);
      setTrophiesEarned(history.trophies);
      setLastEquation(history.lastEq);
      setTrophiesLifetimeEarned(history.lifetimeTrophies);
      setBombMilestonesTriggered(new Set(history.milestones));
      setPendingBombRefillCell(history.pendingBomb);
      setHistory(null);
    }
  };

  return (
    <div className="flex flex-col items-center h-[100dvh] bg-[#141416] text-white overflow-hidden font-sans">
      <div className="w-full max-w-[520px] sm:max-w-[600px] lg:max-w-[760px] h-full flex flex-col relative border-x border-white/5 bg-[#1a1a1c] overflow-hidden">

        <main className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-3 pt-4 sm:pt-6 relative overflow-hidden">
          <Board
            ref={boardRef}
            grid={grid}
            rows={rows}
            cols={cols}
            target={targetValue}
            practiceSet={practiceSet}
            trophyCount={trophiesEarned}
            lifetimeCount={trophiesLifetimeEarned}
            lastEquation={lastEquation}
            isTrackerFlashing={isTrackerFlashing}
            onStateChange={handleStateChange}
            onTrophyCreated={onTrophyCreated}
            onOpenSettings={() => { SoundEngine.playTap(); setIsSettingsOpen(true); }}
            isDimmed={phase === Phase.COUNTING}
            highlightedTileId={countingTrophyId || undefined}
            pendingBombRefillCell={pendingBombRefillCell}
            onBombSpawned={() => setPendingBombRefillCell(null)}
            trackerRef={trackerRef}
          />

          {phase === Phase.RESULTS && (
            <div className="absolute inset-0 z-[50000] bg-black/90 flex flex-col items-center justify-center p-12 animate-[slide-up_0.5s_cubic-bezier(.17,.67,.83,.67)]">
              <div className="bg-zinc-900 border border-white/10 p-10 rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col items-center w-full">
                <h2 className="text-3xl font-black text-amber-500 mb-1 uppercase italic tracking-tighter">Golden Batch</h2>
                <p className="text-base font-bold text-zinc-500 mb-8 tracking-[0.2em] uppercase">{trophiesEarned} Trophies Baked</p>
                <button
                  onClick={() => { SoundEngine.playTap(); initRound({ indexShift: 1 }); }}
                  className="bg-orange-600 w-full py-5 rounded-2xl font-black text-xl shadow-[0_8px_0_rgba(154,52,18,1)] hover:bg-orange-500 active:translate-y-1.5 active:shadow-none transition-all"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </main>

        <footer className="min-h-[98px] h-auto px-3 sm:px-5 py-4 shrink-0 pb-[calc(env(safe-area-inset-bottom)+6px)] z-50 border-t border-white/5 bg-[#1a1a1c]/90 backdrop-blur-md">
          <div className="flex items-center gap-3 w-full">
            <div className="flex gap-2 flex-1 min-w-0">
              <button
                onClick={handlePrevTarget}
                className="bg-[#242426] px-3 sm:px-4 py-3.5 rounded-[16px] font-bold text-[11px] uppercase text-white/90 tracking-widest shadow-md hover:text-white active:scale-95 transition-all border border-white/5"
              >
                Prev
              </button>
              <button
                onClick={handleNextTarget}
                className="bg-[#242426] px-3 sm:px-4 py-3.5 rounded-[16px] font-bold text-[11px] uppercase text-white/90 tracking-widest shadow-md hover:text-white active:scale-95 transition-all border border-white/5"
              >
                Next
              </button>
            </div>

            <button
              onClick={startCountingSequence}
              disabled={phase !== Phase.PLAYING}
              className="shrink-0 bg-gradient-to-b from-orange-500 to-orange-700 px-5 sm:px-7 py-3.5 rounded-[20px] font-black text-[12px] uppercase tracking-[0.18em] shadow-[0_7px_0_rgba(154,52,18,1)] hover:brightness-110 active:translate-y-1.5 active:shadow-none transition-all disabled:opacity-30 text-white border-t border-white/20 whitespace-nowrap"
            >
              Check Oven
            </button>

            <div className="flex gap-2.5 flex-1 min-w-0 justify-end">
              <button
                onClick={() => { SoundEngine.playTap(); initRound(); }}
                className="w-11 sm:w-12 h-11 sm:h-12 rounded-[16px] bg-[#242426] flex items-center justify-center text-white/85 shadow-md hover:text-white transition-all active:rotate-[-45deg] border border-white/5"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10" />
                  <path d="M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </button>

              <button
                onClick={handleUndo}
                disabled={!history}
                className={`w-11 sm:w-12 h-11 sm:h-12 rounded-[16px] bg-[#242426] flex items-center justify-center text-white/85 shadow-md hover:text-white transition-all active:scale-90 border border-white/5 ${!history ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {flyout && (
        <FlyoutPill
          text={flyout.text}
          startPos={flyout.startPos}
          endPos={{
            x: (trackerRef.current?.getBoundingClientRect().left || 0) + (trackerRef.current?.getBoundingClientRect().width || 0) / 2,
            y: (trackerRef.current?.getBoundingClientRect().top || 0) + (trackerRef.current?.getBoundingClientRect().height || 0) / 2
          }}
          onComplete={handleFlyoutComplete}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => { SoundEngine.playTap(); setIsSettingsOpen(false); }}
          onRestart={(config) => initRound({ ...config, indexShift: 0 })}
          currentRows={rows}
          currentCols={cols}
          currentMode={mode}
          currentPracticeSet={practiceSet}
          currentRecipe={recipeTargets}
          events={events}
          onClearLogs={() => { SoundEngine.playTap(); setEvents([]); }}
        />
      )}
    </div>
  );
};

export default App;
