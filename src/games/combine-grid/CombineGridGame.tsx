// ─────────────────────────────────────────────────────────────────────────────
// src/games/combine-grid/CombineGridGame.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// [PHASE 1]  Real pointer drag — pointerdown/pointermove/pointerup on the
//            outer container.  A ghost tile follows the pointer.  Adjacency
//            validation stays in the reducer; the UI only dispatches events.
//
// [PHASE 2]  tileOverlay — equation preview on the drop-target tile itself
//            (e.g. "3 × 4 = 12" in green / grey / red).
//
// [PHASE 3]  Merge-pop animation on the destination tile.
// [PHASE 4]  Spawn-pop animation on the respawned tile (src after DRAG_DROP).
// [PHASE 5]  Particle burst on trophy merges (result === target).
// [PHASE 6]  spawnTileWeighted — 10 % value-1 / 50 % factor / 40 % non-factor
//            used in the RESPAWNING effect and gravity refill spawnValue callback.
//
// [TASK 2]   mergeHighlight — drop-target border reflects result vs target.
// [TASK 4]   boardShaking / trophyPopups — celebration sequence on trophy.
// [TASK 5]   Synthesized Web Audio API sounds — no audio files required.
//
// [PURITY CONTRACT]
//   reducer()        — still pure; unchanged.
//   All PRNG calls   — in effects / spawn callbacks, never in reducer.
//   Particle dirs / Math.random() acceptable for pure-visual elements.
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
import { computeTileSize as gridComputeTileSize } from '../../grid/GridSizing';
import { tileBackground, DRAG_SRC_SHADOW } from './components/Tile';

// ── Tile size ─────────────────────────────────────────────────────────────────

function computeTileSize(): number {
  const availH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN * 2;
  const availW = window.innerWidth - SAFE_MARGIN * 2;
  return Math.min(gridComputeTileSize(availH, availW, ROWS, COLS), 80);
}

// ── Task 5: Synthesised sound engine ─────────────────────────────────────────
// Uses Web Audio API oscillators — no audio files needed.
// Math.random() for jitter is fine: pure-visual / audio layer.

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
    // Silently swallow audio errors — they must not affect game state.
  }
}

/** Drag-start: soft click */
function playSoundDragStart() { playTone(440, 0.05, 'triangle', 0.12); }
/** Valid merge (result < target): satisfying pop */
function playSoundMerge()     { playTone(523, 0.11, 'sine',     0.28); }
/** Trophy merge (result === target): ascending sparkle chime */
function playSoundTrophy() {
  playTone(784,  0.08, 'sine', 0.28, 0.00);
  playTone(1047, 0.08, 'sine', 0.28, 0.07);
  playTone(1319, 0.12, 'sine', 0.28, 0.14);
}
/** Invalid merge (result > target): muted thud */
function playSoundInvalid()   { playTone(160, 0.10, 'sawtooth', 0.18); }

// ── Trophy popup type ─────────────────────────────────────────────────────────

interface TrophyPopup {
  id: number;
  /** Viewport x of tile centre — used for fixed positioning. */
  x: number;
  /** Viewport y of tile centre — popup floats upward from here. */
  y: number;
}

// ── Particle type ─────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;    // fixed screen x of burst origin
  y: number;    // fixed screen y of burst origin
  angle: number;
  dist: number;
  color: string;
}

const PARTICLE_COLORS = [
  '#fbbf24', '#f59e0b', '#ef4444', '#22c55e',
  '#60a5fa', '#a78bfa', '#f472b6', '#fb923c',
];

// Board outer padding — must match Board.tsx's padding:6.
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
    () => initGame(profile, prngRef.current, prngSeedRef.current),
  );

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

  /** Outer game container — used to setPointerCapture for drag tracking. */
  const containerRef = useRef<HTMLDivElement>(null);
  /** Board's outer padding box — used to compute tile screen centres (Phase 5). */
  const boardRef = useRef<HTMLDivElement>(null);

  // ── Phase 1: drag state ───────────────────────────────────────────────────────
  /** Viewport position of the pointer; null when no drag is active. */
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  /** The tile under the pointer during a drag (for eqOverlay + dropTarget). */
  const [hoverPos, setHoverPos] = useState<GridPos | null>(null);

  // ── Phase 3: merge-pop state ──────────────────────────────────────────────────
  const [poppingPos, setPoppingPos] = useState<GridPos | null>(null);

  // ── Phase 4: spawn-pop state ──────────────────────────────────────────────────
  const [spawnedPositions, setSpawnedPositions] = useState<GridPos[]>([]);

  // ── Phase 5: particle state ───────────────────────────────────────────────────
  const [particles, setParticles] = useState<Particle[]>([]);

  // ── Task 4: board shake + trophy popup state ──────────────────────────────────
  const [boardShaking, setBoardShaking] = useState(false);
  const [trophyPopups, setTrophyPopups] = useState<TrophyPopup[]>([]);

  // ── Countdown tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'SELECTING') return;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  // ── CLEARING effect: gravity + new target ─────────────────────────────────────
  // [PHASE 6] spawnValue now calls spawnTileWeighted(oldTarget, …) so refill
  // tiles are biased toward factors of the just-cleared target.
  useEffect(() => {
    if (state.phase !== 'CLEARING') return;

    const currentBoard = state.board;
    const clearing = state.clearingPositions;
    const currentMode = state.mode;
    const capturedTarget = state.target; // old target — used for factor weighting

    const spawnCache: { value: number; isBonus: boolean }[][] =
      Array.from({ length: COLS }, () => []);

    const orchResult = runGravityOrchestrator({
      grid: currentBoard,
      bonusMask: state.bonusMask,
      clearedPositions: clearing,
      rows: ROWS,
      cols: COLS,
      spawnValue: (col, spawnIndex) => {
        // Phase 6: weighted spawn using old target for factor guidance.
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
    const currentMode = state.mode;
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
  // [PHASE 4] Sets spawnedPositions so tiles play the spawn-pop animation.
  // [PHASE 6] Uses spawnTileWeighted so respawned tiles are factor-biased.
  // [TARGET LAW] Target is static for the full round — not regenerated here.
  useEffect(() => {
    if (state.respawnPositions.length === 0) return;

    const positions = state.respawnPositions;
    const capturedTarget = state.target; // static for round

    const respawns = positions.map((pos) => {
      // Phase 6: weighted distribution relative to current round target.
      const sp = spawnTileWeighted(capturedTarget, profile, prngRef.current);
      return { pos, value: sp.value, isBonus: sp.isBonus };
    });

    // Dispatch RESPAWN_COMPLETE after the clearing opacity animation completes.
    const spawnId = setTimeout(() => {
      if (!isMounted.current) return;
      dispatch({ type: 'RESPAWN_COMPLETE', respawns });
      // Phase 4: trigger spawn-pop animation on the newly filled positions.
      setSpawnedPositions([...positions]);
    }, CLEAR_MS);

    // Clear the spawn-pop flag after the animation finishes (~420 ms).
    const clearAnimId = setTimeout(() => {
      if (!isMounted.current) return;
      setSpawnedPositions([]);
    }, CLEAR_MS + 500);

    return () => {
      clearTimeout(spawnId);
      clearTimeout(clearAnimId);
    };
  }, [state.respawnPositions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 5: particle emitter ─────────────────────────────────────────────────

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
      // Spread particles evenly + small random jitter (Math.random() — pure visual).
      angle: (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.45,
      dist: 38 + Math.random() * 44,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    }));

    setParticles((prev) => [...prev, ...burst]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !burst.some((b) => b.id === p.id)));
    }, 750);
  }, [tileSize]);

  // ── Phase 1: pointer event handlers ──────────────────────────────────────────
  //
  // Architecture: all pointer events are handled on the outer container div.
  //   pointerdown — identify the source tile via data-row / data-col, dispatch
  //                 DRAG_START, capture the pointer so move/up always arrive.
  //   pointermove — update ghost position + hover tile for eqOverlay / dropTarget.
  //   pointerup   — identify the target tile, dispatch DRAG_DROP or DRAG_CANCEL.
  //                 Check for trophy merge before dispatching (Phase 3 & 5).
  //   pointercancel — abort drag cleanly.

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (state.phase !== 'SELECTING') return;
    const tileEl = (e.target as HTMLElement).closest('[data-row]') as HTMLElement | null;
    if (!tileEl) return;

    const row = parseInt(tileEl.dataset.row ?? '-1', 10);
    const col = parseInt(tileEl.dataset.col ?? '-1', 10);
    if (row < 0 || col < 0) return;
    // Don't start drag from a trophy tile (reducer also blocks this).
    if (state.trophyMask[row]?.[col]) return;

    // Prevent browser scroll / text-selection during drag.
    e.preventDefault();

    // Task 5: drag-start sound.
    playSoundDragStart();

    dispatch({ type: 'DRAG_START', pos: { row, col } });
    setGhostPos({ x: e.clientX, y: e.clientY });
    setHoverPos(null);

    // Capture so pointermove/pointerup always route to this element.
    containerRef.current?.setPointerCapture(e.pointerId);
  }, [state.phase, state.trophyMask]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (state.dragSource === null) return;
    setGhostPos({ x: e.clientX, y: e.clientY });

    // elementFromPoint ignores pointer capture — finds the visual tile under cursor.
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

  // Task 4: emit board-shake + score popup for a trophy merge.
  const emitTrophyCelebration = useCallback((dst: GridPos) => {
    const boardRect = boardRef.current?.getBoundingClientRect();

    // Board shake.
    setBoardShaking(true);
    setTimeout(() => setBoardShaking(false), 140);

    // Score popup "+1 trophy" anchored to tile centre in viewport coords.
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

        // Evaluate merge outcome before dispatch (board is still unmodified).
        const srcVal = state.board[src.row][src.col];
        const dstVal = state.board[dst.row][dst.col];
        const result = srcVal * dstVal;
        const isAdj = Math.max(
          Math.abs(src.row - dst.row),
          Math.abs(src.col - dst.col),
        ) === 1;
        const isTrophyMerge =
          isAdj &&
          result === state.target &&
          !state.trophyMask[src.row]?.[src.col] &&
          !state.trophyMask[dst.row]?.[dst.col] &&
          srcVal !== 0 &&
          dstVal !== 0;
        const isValidMerge =
          isAdj &&
          result < state.target &&
          !state.trophyMask[src.row]?.[src.col] &&
          !state.trophyMask[dst.row]?.[dst.col] &&
          srcVal !== 0 &&
          dstVal !== 0;
        const isInvalidMerge = isAdj && result > state.target;

        // ── Phase 5 + Task 4: trophy celebration sequence ───────────────────
        if (isTrophyMerge) {
          emitTrophyParticles(dst);
          emitTrophyCelebration(dst);
          playSoundTrophy();           // Task 5
        } else if (isValidMerge) {
          playSoundMerge();            // Task 5
        } else if (isInvalidMerge) {
          playSoundInvalid();          // Task 5
        }

        dispatch({ type: 'DRAG_DROP', src, dst });

        // ── Phase 3: merge-pop animation on destination ─────────────────────
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

  // dropTarget: hoverPos that is Chebyshev-adjacent (distance = 1) to dragSource.
  const dropTarget: GridPos | null = (() => {
    if (state.dragSource === null || hoverPos === null) return null;
    const adjacent =
      Math.max(
        Math.abs(hoverPos.row - state.dragSource.row),
        Math.abs(hoverPos.col - state.dragSource.col),
      ) === 1;
    return adjacent ? hoverPos : null;
  })();

  // Phase 2: equation overlay for the tile at dropTarget.
  const tileOverlay: { label: string; color: string } | null = (() => {
    if (state.dragSource === null) return null;
    const srcVal = state.board[state.dragSource.row][state.dragSource.col];
    if (dropTarget === null) return null;
    const dstVal = state.board[dropTarget.row][dropTarget.col];
    if (dstVal === 0) return null;
    const result = srcVal * dstVal;
    const color =
      result === state.target ? '#22c55e' : result > state.target ? '#ef4444' : '#d1d5db';
    return { label: `${srcVal}×${dstVal}=${result}`, color };
  })();

  // Task 2: merge highlight classification for the drop-target tile border.
  const mergeHighlight: 'invalid' | 'valid' | 'trophy' | null = (() => {
    if (state.dragSource === null || dropTarget === null) return null;
    const srcVal = state.board[state.dragSource.row][state.dragSource.col];
    const dstVal = state.board[dropTarget.row][dropTarget.col];
    if (dstVal === 0 || srcVal === 0) return null;
    const result = srcVal * dstVal;
    if (result === state.target) return 'trophy';
    if (result > state.target)  return 'invalid';
    return 'valid';
  })();

  // HUD equation preview (text below board — kept alongside tile overlay).
  const eqPreview = (() => {
    if (state.dragSource === null) return null;
    const srcVal = state.board[state.dragSource.row][state.dragSource.col];
    if (dropTarget === null) return { label: `${srcVal} ×  ?`, color: '#666' };
    const dstVal = state.board[dropTarget.row][dropTarget.col];
    if (dstVal === 0) return { label: `${srcVal} ×  ?`, color: '#666' };
    const result = srcVal * dstVal;
    const color =
      result === state.target ? '#22c55e' : result > state.target ? '#ef4444' : '#9ca3af';
    return { label: `${srcVal} × ${dstVal} = ${result}`, color };
  })();

  const timerPct = state.timeLeft / ROUND_DURATION_SECS;
  const timerColor =
    state.timeLeft <= 5 ? '#ef4444' : state.timeLeft <= 10 ? '#f97316' : '#22c55e';

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
          {state.roundsCompleted >= ROUNDS_PER_SESSION
            ? 'Calculating final score…'
            : 'Next round starting…'}
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

  // ── Ghost tile values (Phase 1) ───────────────────────────────────────────────
  const ghostVal =
    ghostPos && state.dragSource
      ? state.board[state.dragSource.row][state.dragSource.col]
      : 0;
  const ghostBg = state.dragSource ? tileBackground(ghostVal, false) : '#c2410c';
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
        // Phase 1: disable browser pan/zoom so pointer events are not swallowed.
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
        <Board
          grid={state.board}
          tileSize={tileSize}
          selection={state.selection}
          clearingPositions={state.clearingPositions}
          trophyMask={state.trophyMask}
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
        {/* Equation preview in HUD (Phase 2 complement — tile overlay is primary) */}
        <div style={{ fontSize: 13, fontWeight: 700, minHeight: 20 }}>
          {eqPreview !== null ? (
            <span style={{ color: eqPreview.color, fontSize: 16 }}>{eqPreview.label}</span>
          ) : (
            <span style={{ color: '#444' }}>Drag a tile onto an adjacent tile</span>
          )}
        </div>
        {/* Timer bar */}
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

      {/* ── Phase 1: Ghost tile ───────────────────────────────────────────────── */}
      {/* Rendered outside the board so it is not clipped.  position:fixed so it
          ignores the container's overflow:hidden. pointer-events:none so it
          never intercepts the pointermove/pointerup events.                     */}
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

      {/* ── Phase 5: Particles ────────────────────────────────────────────────── */}
      {/* position:fixed so they escape container overflow:hidden.               */}
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
            // CSS custom properties for per-particle direction.
            ['--pdx' as string]: `${Math.cos(p.angle) * p.dist}px`,
            ['--pdy' as string]: `${Math.sin(p.angle) * p.dist}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* ── Task 4: Trophy score popups ───────────────────────────────────────── */}
      {/* "+1 trophy" floats upward from the tile centre for 900 ms.             */}
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
            // translateX(-50%) is baked into the keyframe to keep the popup centred.
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
