import React, { useCallback, useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import ResultScreen from './components/ResultScreen';
import { GridPos } from './types';
import {
  buildGrid,
  countValidPairs,
  countBombs,
  removeTiles,
  applyGravity,
  engineTileToTile,
} from './services/GridService';
import { emptySelection, selectTile, isPairComplete, pairMultiplies, Selection } from './services/SelectionService';
import { GridEngine } from '../../engine/GridEngine';
import { PracticeProfile } from '../../engine/PracticeProfile';
import { ROWS, COLS, ROUNDS_PER_SESSION, BUILD_STAMP, STALEMATE_VALID_THRESHOLD } from './constants';
import { Tile, GamePhase } from './types';
import { HUD_TOP_H, HUD_BOT_H, SAFE_MARGIN } from './uiTokens';
import { HUDTopBar, HUDBottomBar, HUDIconBtn } from '../../platform/ui/HUDShell';
import { useToast } from '../../platform/ui/ToastContext';

// BUILD_STAMP
const _STAMP = BUILD_STAMP;

interface Props {
  onBack?: () => void;
}

export default function CombineGridApp({ onBack }: Props) {
  const { showToast } = useToast();
  const engineRef = useRef<GridEngine | null>(null);
  const [grid, setGrid] = useState<Tile[][]>([]);
  const [target, setTarget] = useState(12);
  const [phase, setPhase] = useState<GamePhase>('IDLE');
  const [selection, setSelection] = useState<Selection>(emptySelection());
  const [trophies, setTrophies] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [tileSize, setTileSize] = useState(64);

  // Compute tile size from viewport
  useEffect(() => {
    function compute() {
      const availH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN * 2 - 32;
      const availW = window.innerWidth - SAFE_MARGIN * 2 - 16;
      const byH = Math.floor(availH / ROWS);
      const byW = Math.floor(availW / COLS);
      setTileSize(Math.min(byH, byW, 80));
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  function startRound(engine: GridEngine, t: number) {
    engine.startRound(t, ROWS, COLS, [2, 3, 4, 5, 6]);
    const engineGrid = engine.getInitialGrid(ROWS, COLS);
    const g = buildGrid(engineGrid, ROWS, COLS);
    setGrid(g);
    setTarget(t);
    setSelection(emptySelection());
    setPhase('IDLE');
  }

  useEffect(() => {
    const engine = new GridEngine();
    const profile = new PracticeProfile([2, 3, 4, 5, 6], 2, 12);
    engine.startPractice(profile);
    engineRef.current = engine;
    const t = engine.nextTarget();
    startRound(engine, t);
  }, []);

  function checkStalemate(g: Tile[][], t: number) {
    const valid = countValidPairs(g, t);
    const bombs = countBombs(g);
    if (valid <= STALEMATE_VALID_THRESHOLD && bombs === 0) {
      setPhase('STALEMATE');
    }
  }

  const handleTilePress = useCallback((pos: GridPos) => {
    if (phase !== 'IDLE' && phase !== 'SELECTING') return;

    const newSel = selectTile(selection, pos, grid);

    if (!isPairComplete(newSel)) {
      setSelection(newSel);
      setPhase('SELECTING');
      return;
    }

    const a = grid[newSel.first!.r][newSel.first!.c];
    const b = grid[newSel.second!.r][newSel.second!.c];

    // Handle bomb + any-factor
    const isBombPair = a.kind === 'bomb' || b.kind === 'bomb';
    const valid = isBombPair
      ? (a.kind === 'bomb' ? b : a).val > 0
      : a.val * b.val === target;

    if (valid) {
      setPhase('CLEARING');
      const positions = [newSel.first!, newSel.second!];

      setTimeout(() => {
        const cleared = removeTiles(grid, positions);
        const fallen = applyGravity(cleared);
        setGrid(fallen);
        setScore(s => s + 10 + (isBombPair ? 5 : 0));
        setSelection(emptySelection());

        // Refill top blank cells
        const engine = engineRef.current!;
        const next = fallen.map(row => row.map(t => ({ ...t })));
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (next[r][c].kind === 'blank') {
              next[r][c] = engineTileToTile(engine.getRefillTile());
            }
          }
        }
        setGrid(next);

        setTimeout(() => {
          checkStalemate(next, target);
          setPhase('IDLE');
        }, 100);
      }, 200);
    } else {
      showToast(`${a.val} × ${b.val} ≠ ${target}`);
      setSelection(emptySelection());
      setPhase('IDLE');
    }
  }, [grid, selection, phase, target, showToast]);

  function handleNext() {
    const engine = engineRef.current!;
    if (round >= ROUNDS_PER_SESSION) {
      setPhase('FINAL');
      return;
    }
    const t = engine.nextTarget();
    setRound(r => r + 1);
    startRound(engine, t);
  }

  function handleRestart() {
    const engine = new GridEngine();
    const profile = new PracticeProfile([2, 3, 4, 5, 6], 2, 12);
    engine.startPractice(profile);
    engineRef.current = engine;
    setTrophies(0);
    setScore(0);
    setRound(1);
    const t = engine.nextTarget();
    startRound(engine, t);
  }

  const isResultVisible = phase === 'ROUND_OVER' || phase === 'STALEMATE' || phase === 'FINAL';

  return (
    <div className="game-ui min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <HUDTopBar
        left={
          <button onClick={onBack} className="text-gray-500 text-sm font-medium active:opacity-60">
            ← Back
          </button>
        }
        center={
          <span className="text-indigo-700">
            Target: <strong className="text-2xl">{target}</strong>
          </span>
        }
        right={
          <span className="text-yellow-600 font-bold">🏆 {trophies}</span>
        }
      />

      <div
        className="flex flex-col items-center justify-center"
        style={{ paddingTop: HUD_TOP_H + SAFE_MARGIN, paddingBottom: HUD_BOT_H + SAFE_MARGIN }}
      >
        <div className="mb-2 text-xs text-gray-400">Round {round} / {ROUNDS_PER_SESSION} · Score {score}</div>
        {grid.length > 0 && (
          <Board
            grid={grid}
            selection={selection}
            tileSize={tileSize}
            onTilePress={handleTilePress}
          />
        )}
      </div>

      <HUDBottomBar>
        <HUDIconBtn onClick={() => setPhase('STALEMATE')} label="Give Up">🏳️</HUDIconBtn>
        <HUDIconBtn onClick={handleNext} label="Skip" disabled={round >= ROUNDS_PER_SESSION && phase !== 'FINAL'}>⏭️</HUDIconBtn>
      </HUDBottomBar>

      {isResultVisible && (
        <ResultScreen
          phase={phase}
          trophies={trophies}
          score={score}
          round={round}
          target={target}
          onNext={handleNext}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
