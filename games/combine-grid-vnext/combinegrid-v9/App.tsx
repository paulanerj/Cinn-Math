

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tile, GameEvent, Phase, TileKind, TargetSource } from './types';
import { GRID_CONFIG } from './constants';
import { FX_TIMING } from './fx/fxConfig';
import { GridEngine } from './services/GridEngine';
import { PlatformEngineAdapter } from './services/PlatformEngineAdapter';
import Board, { BoardHandle } from './components/Board';
import SettingsModal from './components/SettingsModal';
import FlyoutPill from './components/FlyoutPill';
import { Trace } from './debug/trace';
import { SoundEngine } from './services/SoundEngine';
import GameControlsLayer from '@/src/platform/controls/GameControlsLayer';
import GameHUD from '@/src/platform/hud/GameHUD';
import { useToast } from '@/src/platform/ui/ToastContext';

const DEFAULT_RECIPE = [12, 15, 24, 32, 56];
const BUILD_STAMP = "CG-STAMP-2";

interface CombineGridVNextGameProps {
  onBack?: () => void;
}

const CombineGridVNextGame: React.FC<CombineGridVNextGameProps> = ({ onBack }) => {
  const { addToast } = useToast();
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
  
  // Engine State Tracking
  const isEngineInitialized = useRef(false);
  const [targetValue, setTargetValue] = useState(GRID_CONFIG.TARGET_VALUE);
  
  // UI Authority State
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
  const [showNoMoves, setShowNoMoves] = useState(false);
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
    try {
      const actionId = Trace.newActionId();
      const r = config?.rows ?? rows;
      const c = config?.cols ?? cols;
      
      // Resolve Authority values (Config > State > Default)
      const nextMode = config?.mode ?? mode;
      const nextPracticeSet = config?.practiceSet ?? practiceSet;
      const nextRecipe = config?.recipe ?? recipeTargets;

      if (config?.rows) setRows(r);
      if (config?.cols) setCols(c);
      
      // Update UI State Authorities
      if (config?.mode) setMode(nextMode);
      if (config?.practiceSet) setPracticeSet(nextPracticeSet);
      if (config?.recipe) setRecipeTargets(nextRecipe);

      // Initialize Engine if configuration changed or first run
      const needsEngineReset = !isEngineInitialized.current || config?.mode || config?.recipe || config?.practiceSet;

      if (needsEngineReset) {
        if (nextMode === TargetSource.PRACTICE) {
          PlatformEngineAdapter.startPractice(nextPracticeSet, 2, 12);
        } else if (nextMode === TargetSource.RECIPE) {
          PlatformEngineAdapter.startRecipe(nextRecipe);
        } else {
          PlatformEngineAdapter.startFreePlay();
        }
        isEngineInitialized.current = true;
      }

      // Determine Target
      let val: number;
      if (config?.indexShift !== undefined) {
        if (config.indexShift > 0) val = PlatformEngineAdapter.nextTarget();
        else val = PlatformEngineAdapter.prevTarget();
      } else {
        val = PlatformEngineAdapter.currentTarget();
      }

      setTargetValue(val);

      // Generate Grid via Platform Engine
      PlatformEngineAdapter.startRound(val, r, c, nextPracticeSet);
      const engineGrid = PlatformEngineAdapter.getGrid(r, c);
      
      // Hydrate Engine Data into Game Tiles using Local Factory
      const newGrid = engineGrid.map((row, ri) => row.map((cell, ci) => {
        let kind = TileKind.NUMBER;
        switch(cell.kind) {
            case 'bomb': kind = TileKind.BOMB; break;
            case 'trophy': kind = TileKind.TROPHY; break;
            case 'op': kind = TileKind.OP; break;
            case 'blank': kind = TileKind.BLANK; break;
            case 'stone': kind = TileKind.STONE; break;
            default: kind = TileKind.NUMBER;
        }
        return GridEngine.createTile(ri, ci, kind, cell.val);
      }));
      setGrid(newGrid);

      setTrophiesEarned(0);
      setLastEquation('');
      setPhase(Phase.PLAYING);
      setShowNoMoves(false);
      setHistory(null);
      setIsSettingsOpen(false);
      setFlyout(null);
      setCountingTrophyId(null);
      setPendingBombRefillCell(null);

      setEvents(prev => [...prev, {
        type: 'INIT',
        description: `Target: ${val} (Mode: ${nextMode})`,
        matrix: '',
        actionId,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error("Failed to initialize round:", error);
      addToast("Failed to start round. Please try again.", "error");
    }
  }, [rows, cols, mode, practiceSet, recipeTargets, addToast]);

  useEffect(() => {
    initRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNextTarget = () => { SoundEngine.playTap(); initRound({ indexShift: 1 }); };
  const handlePrevTarget = () => { SoundEngine.playTap(); initRound({ indexShift: -1 }); };

  const startCountingSequence = useCallback(async () => {
    if (phase !== Phase.PLAYING) return;
    setShowNoMoves(false);
    SoundEngine.playTap();
    setPhase(Phase.COUNTING);
    const trophies = grid.flat().filter(t => t?.kind === TileKind.TROPHY) as Tile[];
    let count = 0;

    for (const t of trophies) {
      await new Promise(r => setTimeout(r, 500));
      count++;
      setTrophiesEarned(count);
      setCountingTrophyId(t.id);
      SoundEngine.playCountStep(count - 1);
    }

    setCountingTrophyId(null);
    SoundEngine.playResultsFanfare();
    setTimeout(() => {
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
        const flat = next.flat().filter(Boolean) as Tile[];
        const liveTileCount = flat.filter(t => t.kind === TileKind.NUMBER).length;
        const bombCount = flat.filter(t => t.kind === TileKind.BOMB).length;
        const deadTileCount = flat.filter(t => t.kind === TileKind.STONE).length;
        if (liveTileCount === 1 && bombCount === 0 && deadTileCount === 0) {
          setShowNoMoves(true);
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
    <div className="flex flex-col items-center h-[100dvh] bg-[#141416] text-white overflow-hidden font-sans game-ui">
      <div className="w-full max-w-[520px] sm:max-w-[600px] lg:max-w-[760px] h-full flex flex-col relative border-x border-white/5 bg-[#1a1a1c] overflow-hidden">

        <GameHUD
          target={targetValue}
          score={trophiesEarned}
          mode="CombineGrid"
          rightSlot={onBack ? (
            <button
              onClick={onBack}
              className="text-white/60 hover:text-white text-sm font-bold px-2 py-1 transition-colors"
            >
              ‹ Back
            </button>
          ) : undefined}
        />

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

          {showNoMoves && (
            <div className="absolute inset-0 z-[50000] bg-black/80 flex flex-col items-center justify-center">
              <div className="bg-zinc-900 border border-white/10 px-10 py-8 rounded-[32px] flex flex-col items-center shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">No moves left</h2>
                <p className="text-sm text-white/40 mt-2 uppercase tracking-widest">Counting trophies…</p>
              </div>
            </div>
          )}

          {phase === Phase.RESULTS && (
            <div className="absolute inset-0 z-[50000] bg-black/90 flex flex-col items-center justify-center p-12 animate-[slide-up_0.5s_cubic-bezier(.17,.67,.83,.67)]">
              <div className="bg-zinc-900 border border-white/10 p-10 rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col items-center w-full">
                <h2 className="text-3xl font-black text-amber-500 mb-1 uppercase italic tracking-tighter">Round Over</h2>
                <p className="text-base font-bold text-zinc-500 mb-8 tracking-[0.2em] uppercase">Final Trophies: {trophiesEarned}</p>
                <button
                  onClick={() => { SoundEngine.playTap(); initRound({ indexShift: 1 }); }}
                  className="bg-orange-600 w-full py-5 rounded-2xl font-black text-xl shadow-[0_8px_0_rgba(154,52,18,1)] hover:bg-orange-500 active:translate-y-1.5 active:shadow-none transition-all"
                >
                  Next Problem
                </button>
              </div>
            </div>
          )}
        </main>

        <GameControlsLayer
          onUndo={handleUndo}
          onReset={() => { SoundEngine.playTap(); initRound(); }}
          centerSlot={
            <div className="flex gap-2 items-center">
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
          }
        />
        <div className="absolute bottom-0 right-0 text-[8px] text-white/20 pr-1 pb-0.5 z-[60000] pointer-events-none select-none">{BUILD_STAMP}</div>
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

export default CombineGridVNextGame;
