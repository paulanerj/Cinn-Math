// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/CombineGridGame.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// [CRASH FIX NOTES — see GitHub issue]
//
//   BUG 1 — Missing frozenMask prop on <Board>
//     The reducer stores frozenMask in CGState but the previous render did NOT
//     pass it to <Board>.  Board's Tile loop then read frozenMask[r]?.[c] on
//     undefined, crashing with "Cannot read properties of undefined".
//     FIX: frozenMask={state.frozenMask} is now explicitly passed to <Board>.
//
//   BUG 2 — Undefined elements in position arrays
//     Any .map() / .some() on respawnPositions, zeroRespawnPositions,
//     clearingPositions, or the local spawnedPositions state could throw
//     "Cannot read properties of undefined (reading 'row')" if an element
//     is undefined.
//     FIX: All effects that map over position arrays first apply .filter(Boolean).
//          Board.tsx applies the same guard on its own copies of the arrays.
//
//   BUG 3 — Empty board on first render
//     initGame() now runs synchronously as the useReducer lazy initializer,
//     so the board is guaranteed to be a full ROWS×COLS matrix on the very
//     first paint.  Board renders a safe empty shell when grid.length === 0
//     as an additional belt-and-suspenders guard.
//
// [DEBUG]
//   A console.log("CGState", state) is emitted on every state change so the
//   actual reducer shape can be inspected in DevTools.  Remove once stable.
//
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import './animations.css';
import Board from './components/Board';
import ResultScreen from './components/ResultScreen';
import {
  ROWS,
  COLS,
  ROUNDS_PER_SESSION,
  ROUND_DURATION_SECS,
  CLEAR_MS,
  ROUND_OVER_AUTOADVANCE_MS,
} from './constants';
import { GAP, HUD_TOP_H, HUD_BOT_H, SAFE_MARGIN, BASE_RADIUS_PX } from './uiTokens';
import { GridPos } from './types';
import { CGState, Action, initGame, reducer } from './cgReducer';
import {
  makePrng,
  randomSeed,
  spawnTileWeighted,
  spawnBoard,
  gridFromSpawn,
  generateTarget,
  getProfile,
  DEFAULT_PROFILE_ID,
} from '../../engine/public';
import { runGravityOrchestrator } from '../../systems/GravityOrchestrator';
import { tileBackground, DRAG_SRC_SHADOW } from './components/Tile';

// ── Tile size ─────────────────────────────────────────────────────────────────

function computeTileSize(): number {
  const availH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN * 2;
  const availW = window.innerWidth - SAFE_MARGIN * 2;
  return Math.min(
    Math.floor(availH / ROWS),
    Math.floor(availW / COLS),
    80,
  );
}

// ── Synthesised sound engine ──────────────────────────────────────────────────

let _synthCtx: AudioContext | null = null;
function getSynthCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_synthCtx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) _synthCtx = new Ctor();
  }
  return _synthCtx;
}

function playTone(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.22,
  startOffset = 0,
): void {
  try {
    const ctx = getSynthCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + dur);
    osc.start(ctx.currentTime + startOffset);
    osc.stop(ctx.currentTime + startOffset + dur + 0.01);
  } catch {
    // Silently swallow audio errors.
  }
}

function playSoundDragStart() { playTone(440, 0.05, 'triangle', 0.12); }
function playSoundMerge()     { playTone(523, 0.11, 'sine',     0.28); }
function playSoundTrophy() {
  playTone(784,  0.08, 'sine', 0.28, 0.00);
  playTone(1047, 0.08, 'sine', 0.28, 0.07);
  playTone(1319, 0.12, 'sine', 0.28, 0.14);
}
function playSoundInvalid()   { playTone(160, 0.10, 'sawtooth', 0.18); }

// ── Trophy popup type ─────────────────────────────────────────────────────────

interface TrophyPopup {
  id: number;
  x: number;
  y: number;
}

// ── Particle type ─────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  dist: number;
  color: string;
}

const PARTICLE_COLORS = [
  '#fbbf24', '#f59e0b', '#ef4444', '#22c55e',
  '#60a5fa', '#a78bfa', '#f472b6', '#fb923c',
];

const BOARD_PAD = 6;

// ── Component ─────────────────────────────────────────────────────────────────

export default function CombineGridGame({ onBack }: { onBack?: () => void }) {
  // ── Engine setup ─────────────────────────────────────────────────────────────
  const profile = useMemo(() => getProfile(DEFAULT_PROFILE_ID), []);
  const prngSeedRef = useRef(randomSeed());
  const prngRef = useRef(makePrng(prngSeedRef.current));

  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    // Lazy initializer: board is fully populated before the first render.
    () => initGame(profile, prngRef.current, prngSeedRef.current),
  );

  // DEBUG — log state shape on every change so shape mismatches are immediately
  // visible in the browser console.  Remove once the build is stable.
  useEffect(() => {
    console.log('CGState', {
      phase: state.phase,
      boardSize: `${state.board.length}×${state.board[0]?.length ?? 0}`,
      frozenMask: state.frozenMask,
      trophyMask: state.trophyMask,
      zeroRespawnPositions: state.zeroRespawnPositions,
      respawnPositions: state.respawnPositions,
      clearingPositions: state.clearingPositions,
    });
  }, [state]);

  // ── Layout ───────────────────────────────────────────────────────────────────
  const [tileSize, setTileSize] = useState(computeTileSize);
  useEffect(() => {
    const handler = () => setTileSize(computeTileSize());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef     = useRef<HTMLDivElement>(null);

  // ── Drag state ────────────────────────────────────────────────────────────────
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<GridPos | null>(null);

  // ── Animation state ───────────────────────────────────────────────────────────
  const [poppingPos, setPoppingPos]         = useState<GridPos | null>(null);
  const [spawnedPositions, setSpawnedPositions] = useState<GridPos[]>([]);
  const [particles, setParticles]           = useState<Particle[]>([]);
  const [boardShaking, setBoardShaking]     = useState(false);
  const [trophyPopups, setTrophyPopups]     = useState<TrophyPopup[]>([]);

  // ── Countdown tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'SELECTING') return;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  // ── CLEARING effect: gravity + new target ─────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'CLEARING') return;

    const currentBoard  = state.board;
    const clearing      = state.clearingPositions;
    const currentMode   = state.mode;
    const capturedTarget = state.target;

    const spawnCache: { value: number; isBonus: boolean }[][] =
      Array.from({ length: COLS }, () => []);

    const orchResult = runGravityOrchestrator({
      grid: currentBoard,
      bonusMask: state.bonusMask,
      clearedPositions: clearing,
      rows: ROWS,
      cols: COLS,
      spawnValue: (col, spawnIndex) => {
        const sp = spawnTileWeighted(capturedTarget, profile, prngRef.current);
        spawnCache[col][spawnIndex] = sp;
        return sp.value;
      },
      spawnBonus: (col, spawnIndex) => spawnCache[col][spawnIndex]?.isBonus ?? false,
      generateNextTarget: (settledGrid) =>
        generateTarget(settledGrid, ROWS, COLS, currentMode, profile, prngRef.current),
    });

    const id = setTimeout(() => {
      if (!isMounted.current) return;
      dispatch({
        type: 'CLEAR_COMPLETE',
        board: orchResult.grid,
        bonusMask: orchResult.bonusMask,
        target: orchResult.target,
      });
    }, CLEAR_MS);

    return () => clearTimeout(id);
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ROUND_OVER effect: spawn fresh board for next round ───────────────────────
  useEffect(() => {
    if (state.phase !== 'ROUND_OVER') return;
    const currentMode = state.mode;
    const id = setTimeout(() => {
      if (!isMounted.current) return;
      const spawnedTiles = spawnBoard(ROWS, COLS, profile, prngRef.current);
      const board = gridFromSpawn(ROWS, COLS, spawnedTiles);
      const bonusMask: boolean[][] = Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => spawnedTiles[r * COLS + c].isBonus),
      );
      const target = generateTarget(board, ROWS, COLS, currentMode, profile, prngRef.current);
      dispatch({ type: 'ADVANCE_ROUND', board, bonusMask, target });
    }, ROUND_OVER_AUTOADVANCE_MS);
    return () => clearTimeout(id);
  }, [state.phase, state.roundsCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── STALEMATE effect: generate a new target for the same board ────────────────
  useEffect(() => {
    if (state.phase !== 'STALEMATE') return;
    const currentBoard = state.board;
    const currentMode  = state.mode;
    const id = setTimeout(() => {
      if (!isMounted.current) return;
      const target = generateTarget(
        currentBoard, ROWS, COLS, currentMode, profile, prngRef.current,
      );
      dispatch({ type: 'RESOLVE_STALEMATE', target });
    }, 1500);
    return () => clearTimeout(id);
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RESPAWNING effect: in-place tile refill after drag-merge ──────────────────
  useEffect(() => {
    // Defensive filter: drop any undefined entries before iterating.
    const positions = (state.respawnPositions ?? []).filter(Boolean) as GridPos[];
    if (positions.length === 0) return;

    const capturedTarget = state.target;

    const respawns = positions.map((pos) => {
      const sp = spawnTileWeighted(capturedTarget, profile, prngRef.current);
      return { pos, value: sp.value, isBonus: sp.isBonus };
    });

    const spawnId = setTimeout(() => {
      if (!isMounted.current) return;
      dispatch({ type: 'RESPAWN_COMPLETE', respawns });
      setSpawnedPositions([...positions]);
    }, CLEAR_MS);

    const clearAnimId = setTimeout(() => {
      if (!isMounted.current) return;
      setSpawnedPositions([]);
    }, CLEAR_MS + 500);

    return () => {
      clearTimeout(spawnId);
      clearTimeout(clearAnimId);
    };
  }, [state.respawnPositions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ZERO-RESPAWN effect: zero-interaction tile refill ─────────────────────────
  useEffect(() => {
    // Defensive filter: drop any undefined entries before iterating.
    const positions = (state.zeroRespawnPositions ?? []).filter(Boolean) as GridPos[];
    if (positions.length === 0) return;

    const capturedTarget = state.target;

    // Zero-interaction uses a flat distribution biased toward factors and 1s.
    const respawns = positions.map((pos) => {
      const sp = spawnTileWeighted(capturedTarget, profile, prngRef.current);
      return { pos, value: sp.value, isBonus: sp.isBonus };
    });

    const spawnId = setTimeout(() => {
      if (!isMounted.current) return;
      dispatch({ type: 'RESPAWN_COMPLETE', respawns });
      setSpawnedPositions([...positions]);
    }, CLEAR_MS);

    const clearAnimId = setTimeout(() => {
      if (!isMounted.current) return;
      setSpawnedPositions([]);
    }, CLEAR_MS + 500);

    return () => {
      clearTimeout(spawnId);
      clearTimeout(clearAnimId);
    };
  }, [state.zeroRespawnPositions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Particle emitter ──────────────────────────────────────────────────────────
  const emitTrophyParticles = useCallback((dst: GridPos) => {
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    const cellSize = tileSize + GAP;
    const cx = boardRect.left + BOARD_PAD + dst.col * cellSize + tileSize / 2;
    const cy = boardRect.top  + BOARD_PAD + dst.row * cellSize + tileSize / 2;
    const count = 14;
    const burst: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: cx,
      y: cy,
      angle: (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.45,
      dist: 38 + Math.random() * 44,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    }));
    setParticles((prev) => [...prev, ...burst]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !burst.some((b) => b.id === p.id)));
    }, 750);
  }, [tileSize]);

  // ── Pointer event handlers ────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (state.phase !== 'SELECTING') return;
    const tileEl = (e.target as HTMLElement).closest('[data-row]') as HTMLElement | null;
    if (!tileEl) return;
    const row = parseInt(tileEl.dataset.row ?? '-1', 10);
    const col = parseInt(tileEl.dataset.col ?? '-1', 10);
    if (row < 0 || col < 0) return;
    if (state.trophyMask?.[row]?.[col]) return;
    e.preventDefault();
    playSoundDragStart();
    dispatch({ type: 'DRAG_START', pos: { row, col } });
    setGhostPos({ x: e.clientX, y: e.clientY });
    setHoverPos(null);
    containerRef.current?.setPointerCapture(e.pointerId);
  }, [state.phase, state.trophyMask]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (state.dragSource === null) return;
    setGhostPos({ x: e.clientX, y: e.clientY });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tileEl = el?.closest('[data-row]') as HTMLElement | null;
    if (tileEl) {
      const row = parseInt(tileEl.dataset.row ?? '-1', 10);
      const col = parseInt(tileEl.dataset.col ?? '-1', 10);
      if (row >= 0 && col >= 0) {
        setHoverPos({ row, col });
        return;
      }
    }
    setHoverPos(null);
  }, [state.dragSource]);

  const emitTrophyCelebration = useCallback((dst: GridPos) => {
    const boardRect = boardRef.current?.getBoundingClientRect();
    setBoardShaking(true);
    setTimeout(() => setBoardShaking(false), 140);
    if (boardRect) {
      const cellSize = tileSize + GAP;
      const px = boardRect.left + BOARD_PAD + dst.col * cellSize + tileSize / 2;
      const py = boardRect.top  + BOARD_PAD + dst.row * cellSize + tileSize / 2;
      const popup: TrophyPopup = { id: Date.now(), x: px, y: py };
      setTrophyPopups((prev) => [...prev, popup]);
      setTimeout(() => {
        setTrophyPopups((prev) => prev.filter((p) => p.id !== popup.id));
      }, 950);
    }
  }, [tileSize]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (state.dragSource === null) {
      setGhostPos(null);
      return;
    }
    containerRef.current?.releasePointerCapture(e.pointerId);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tileEl = el?.closest('[data-row]') as HTMLElement | null;
    if (tileEl) {
      const row = parseInt(tileEl.dataset.row ?? '-1', 10);
      const col = parseInt(tileEl.dataset.col ?? '-1', 10);
      if (row >= 0 && col >= 0) {
        const dst = { row, col };
        const src = state.dragSource;
        const srcVal = state.board[src.row]?.[src.col] ?? 0;
        const dstVal = state.board[dst.row]?.[dst.col] ?? 0;
        const result  = srcVal * dstVal;
        const isAdj   = Math.max(
          Math.abs(src.row - dst.row),
          Math.abs(src.col - dst.col),
        ) === 1;
        const isTrophyMerge =
          isAdj &&
          result === state.target &&
          !state.trophyMask?.[src.row]?.[src.col] &&
          !state.trophyMask?.[dst.row]?.[dst.col] &&
          srcVal !== 0 && dstVal !== 0;
        const isValidMerge =
          isAdj &&
          result < state.target &&
          !state.trophyMask?.[src.row]?.[src.col] &&
          !state.trophyMask?.[dst.row]?.[dst.col] &&
          srcVal !== 0 && dstVal !== 0;
        const isInvalidMerge = isAdj && result > state.target;

        if (isTrophyMerge) {
          emitTrophyParticles(dst);
          emitTrophyCelebration(dst);
          playSoundTrophy();
        } else if (isValidMerge) {
          playSoundMerge();
        } else if (isInvalidMerge) {
          playSoundInvalid();
        }

        dispatch({ type: 'DRAG_DROP', src, dst });
        setPoppingPos(dst);
        setTimeout(() => setPoppingPos(null), 380);
      } else {
        dispatch({ type: 'DRAG_CANCEL' });
      }
    } else {
      dispatch({ type: 'DRAG_CANCEL' });
    }
    setGhostPos(null);
    setHoverPos(null);
  }, [state.dragSource, state.board, state.target, state.trophyMask,
      emitTrophyParticles, emitTrophyCelebration]);

  const handlePointerCancel = useCallback(() => {
    if (state.dragSource !== null) dispatch({ type: 'DRAG_CANCEL' });
    setGhostPos(null);
    setHoverPos(null);
  }, [state.dragSource]);

  // ── Derived display values ────────────────────────────────────────────────────

  const dropTarget: GridPos | null = (() => {
    if (state.dragSource === null || hoverPos === null) return null;
    const adjacent =
      Math.max(
        Math.abs(hoverPos.row - state.dragSource.row),
        Math.abs(hoverPos.col - state.dragSource.col),
      ) === 1;
    return adjacent ? hoverPos : null;
  })();

  const tileOverlay: { label: string; color: string } | null = (() => {
    if (state.dragSource === null) return null;
    const srcVal = state.board[state.dragSource.row]?.[state.dragSource.col] ?? 0;
    if (dropTarget === null) return null;
    const dstVal = state.board[dropTarget.row]?.[dropTarget.col] ?? 0;
    if (dstVal === 0) return null;
    const result = srcVal * dstVal;
    const color  =
      result === state.target ? '#22c55e' : result > state.target ? '#ef4444' : '#d1d5db';
    return { label: `${srcVal}×${dstVal}=${result}`, color };
  })();

  const mergeHighlight: 'invalid' | 'valid' | 'trophy' | null = (() => {
    if (state.dragSource === null || dropTarget === null) return null;
    const srcVal = state.board[state.dragSource.row]?.[state.dragSource.col] ?? 0;
    const dstVal = state.board[dropTarget.row]?.[dropTarget.col] ?? 0;
    if (dstVal === 0 || srcVal === 0) return null;
    const result = srcVal * dstVal;
    if (result === state.target) return 'trophy';
    if (result > state.target)  return 'invalid';
    return 'valid';
  })();

  const eqPreview = (() => {
    if (state.dragSource === null) return null;
    const srcVal = state.board[state.dragSource.row]?.[state.dragSource.col] ?? 0;
    if (dropTarget === null) return { label: `${srcVal} ×  ?`, color: '#666' };
    const dstVal = state.board[dropTarget.row]?.[dropTarget.col] ?? 0;
    if (dstVal === 0) return { label: `${srcVal} ×  ?`, color: '#666' };
    const result = srcVal * dstVal;
    const color  =
      result === state.target ? '#22c55e' : result > state.target ? '#ef4444' : '#9ca3af';
    return { label: `${srcVal} × ${dstVal} = ${result}`, color };
  })();

  const timerPct   = state.timeLeft / ROUND_DURATION_SECS;
  const timerColor =
    state.timeLeft <= 5  ? '#ef4444' :
    state.timeLeft <= 10 ? '#f97316' : '#22c55e';

  // ── Early renders ─────────────────────────────────────────────────────────────

  if (state.phase === 'FINAL') {
    return <ResultScreen totalScore={state.score} onBack={onBack ?? (() => {})} />;
  }

  if (state.phase === 'ROUND_OVER') {
    return (
      <div style={centeredScreen}>
        <div style={{ color: '#e67e22', fontSize: 13, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>
          Round {state.roundsCompleted} Complete
        </div>
        <div style={{ color: '#fff', fontSize: 52, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>
          {state.roundScore}
        </div>
        <div style={{ color: '#666', fontSize: 13, fontWeight: 700, marginTop: 4 }}>Round Score</div>
        <div style={{ color: '#444', fontSize: 12, marginTop: 18 }}>
          {state.roundsCompleted >= ROUNDS_PER_SESSION ? 'Calculating final score…' : 'Next round starting…'}
        </div>
      </div>
    );
  }

  if (state.phase === 'STALEMATE') {
    return (
      <div style={centeredScreen}>
        <div style={{ color: '#888', fontSize: 14, fontWeight: 700 }}>
          No valid moves — reshuffling…
        </div>
      </div>
    );
  }

  // ── Ghost tile values ─────────────────────────────────────────────────────────
  const ghostVal =
    ghostPos && state.dragSource
      ? (state.board[state.dragSource.row]?.[state.dragSource.col] ?? 0)
      : 0;
  const ghostBg     = state.dragSource ? tileBackground(ghostVal, false) : '#c2410c';
  const ghostRadius = Math.min(BASE_RADIUS_PX, tileSize * 0.28);

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#141416',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'Nunito, sans-serif',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* ── HUD top ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          height: HUD_TOP_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${SAFE_MARGIN + 8}px`,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <Stat label="ROUND" value={`${state.roundsCompleted + 1}/${ROUNDS_PER_SESSION}`} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            TARGET ×
          </div>
          <div
            style={{
              color: '#e67e22',
              fontSize: 30,
              fontWeight: 900,
              lineHeight: 1,
              textShadow: '0 0 16px rgba(230,126,34,0.55)',
            }}
          >
            {state.target}
          </div>
        </div>
        <Stat label="SCORE" value={String(state.score)} />
      </div>

      {/* ── Board ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/*
          FIX: frozenMask prop was previously omitted, causing Board to receive
          undefined for frozenMask and crash when accessing frozenMask[r][c].
          It is now explicitly passed on every render.
        */}
        <Board
          grid={state.board}
          tileSize={tileSize}
          selection={state.selection}
          clearingPositions={state.clearingPositions}
          trophyMask={state.trophyMask}
          frozenMask={state.frozenMask}
          ignitedBombPos={null}
          bombFuseProgress={0}
          dragSource={state.dragSource}
          dropTarget={dropTarget}
          poppingPos={poppingPos}
          spawnedPositions={spawnedPositions}
          tileOverlay={tileOverlay}
          mergeHighlight={mergeHighlight}
          isShaking={boardShaking}
          boardRef={boardRef}
        />
      </div>

      {/* ── HUD bottom ───────────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          height: HUD_BOT_H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: `0 ${SAFE_MARGIN + 8}px`,
          boxSizing: 'border-box',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, minHeight: 20 }}>
          {eqPreview !== null ? (
            <span style={{ color: eqPreview.color, fontSize: 16 }}>{eqPreview.label}</span>
          ) : (
            <span style={{ color: '#444' }}>Drag a tile onto an adjacent tile</span>
          )}
        </div>
        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${timerPct * 100}%`,
              background: timerColor,
              borderRadius: 3,
              transition: 'width 0.95s linear, background 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* ── Ghost tile ────────────────────────────────────────────────────────── */}
      {ghostPos && state.dragSource && (
        <div
          style={{
            position: 'fixed',
            left: ghostPos.x - tileSize / 2,
            top: ghostPos.y - tileSize / 2,
            width: tileSize,
            height: tileSize,
            borderRadius: ghostRadius,
            background: ghostBg,
            color: '#fff',
            fontSize: tileSize * 0.42,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.82,
            transform: 'scale(1.12)',
            pointerEvents: 'none',
            zIndex: 50,
            boxShadow: DRAG_SRC_SHADOW,
            border: '2px solid rgba(100,160,255,0.90)',
            fontFamily: 'Nunito, sans-serif',
            userSelect: 'none',
          }}
        >
          {ghostVal === 0 ? '·' : ghostVal}
        </div>
      )}

      {/* ── Particles ─────────────────────────────────────────────────────────── */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.x - 5,
            top: p.y - 5,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: p.color,
            pointerEvents: 'none',
            zIndex: 60,
            animation: 'cgParticleBurst 0.68s ease-out forwards',
            ['--pdx' as string]: `${Math.cos(p.angle) * p.dist}px`,
            ['--pdy' as string]: `${Math.sin(p.angle) * p.dist}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* ── Trophy score popups ───────────────────────────────────────────────── */}
      {trophyPopups.map((popup) => (
        <div
          key={popup.id}
          style={{
            position: 'fixed',
            left: popup.x,
            top: popup.y - tileSize / 2 - 8,
            pointerEvents: 'none',
            zIndex: 70,
            color: '#ffd700',
            fontWeight: 900,
            fontSize: 15,
            textShadow: '0 1px 6px rgba(0,0,0,0.70)',
            whiteSpace: 'nowrap',
            animation: 'cgScorePopup 0.9s ease-out forwards',
          }}
        >
          +1 trophy
        </div>
      ))}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 52 }}>
      <div style={{ color: '#666', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</div>
      <div style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const centeredScreen: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: '#141416',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  fontFamily: 'Nunito, sans-serif',
};
