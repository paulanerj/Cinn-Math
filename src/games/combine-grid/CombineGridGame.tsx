import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
import { HUD_TOP_H, HUD_BOT_H, SAFE_MARGIN } from './uiTokens';
import { GamePhase, GridPos } from './types';
import { evaluateSelection, hasSolution } from './services/GridService';
import { toggleTile } from './services/SelectionService';
import {
  makePrng,
  randomSeed,
  spawnTile,
  spawnBoard,
  gridFromSpawn,
  generateTarget,
  getProfile,
  DEFAULT_PROFILE_ID,
  clearCells,
} from '../../engine/public';
import type { EvalMode } from '../../engine/public';
import { applyGravity } from '../../systems/GravitySystem';
import { computeTileSize as gridComputeTileSize } from '../../grid/GridSizing';

// ── State ─────────────────────────────────────────────────────────────────────

interface CGState {
  phase: GamePhase;
  mode: EvalMode;
  /** Board as a plain number[][]. 0 = empty cell (during gravity transition). */
  board: number[][];
  /** PRNG seed captured at session start — stored for replay readiness. */
  seed: number;
  selection: GridPos[];
  target: number;
  selectionVal: number;
  score: number;
  roundScore: number;
  roundsCompleted: number;
  roundScores: number[];
  timeLeft: number;
  clearingPositions: GridPos[];
}

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'TICK' }
  | { type: 'TAP_TILE'; pos: GridPos }
  | { type: 'CLEAR_COMPLETE'; board: number[][]; target: number }
  | { type: 'ADVANCE_ROUND'; board: number[][]; target: number }
  | { type: 'RESOLVE_STALEMATE'; target: number }
  | { type: 'PLAY_AGAIN'; newState: CGState };

// ── Lazy initializer ──────────────────────────────────────────────────────────

/**
 * Produces the initial CGState for a new session.
 * Takes profile, prng, and seed so PRNG consumption is seeded and recorded.
 *
 * [PURITY] Not a reducer. Called once at mount and once per PLAY_AGAIN.
 * The component owns profile and prngRef — they are passed in so initGame
 * has no hidden entropy dependencies.
 *
 * [SEED LAW] seed must be the exact uint32 used to construct prng via makePrng(seed).
 * CGState.seed stores this value for replay. Do NOT call randomSeed() here —
 * the caller is the entropy authority (Phase-8 Task-17 fix).
 */
function initGame(
  profile: ReturnType<typeof getProfile>,
  prng: () => number,
  seed: number,
): CGState {
  const spawnedTiles = spawnBoard(ROWS, COLS, profile, prng);
  const board = gridFromSpawn(ROWS, COLS, spawnedTiles);
  const target = generateTarget(board, ROWS, COLS, 'sum', profile, prng);
  return {
    phase: 'SELECTING',
    mode: 'sum',
    board,
    seed,
    selection: [],
    target,
    selectionVal: 0,
    score: 0,
    roundScore: 0,
    roundsCompleted: 0,
    roundScores: [],
    timeLeft: ROUND_DURATION_SECS,
    clearingPositions: [],
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────
//
// [PURITY CONTRACT] The reducer is a pure function. It never calls Math.random(),
// Date.now(), or any PRNG. All PRNG-derived values (new boards, new targets)
// are computed in effects and passed into the reducer via action payloads.

function reducer(state: CGState, action: Action): CGState {
  switch (action.type) {
    case 'TICK': {
      if (state.phase !== 'SELECTING') return state;
      const next = state.timeLeft - 1;
      if (next <= 0) {
        const roundScores = [...state.roundScores, state.roundScore];
        const roundsCompleted = state.roundsCompleted + 1;
        return {
          ...state,
          timeLeft: 0,
          roundScores,
          roundsCompleted,
          phase: roundsCompleted >= ROUNDS_PER_SESSION ? 'FINAL' : 'ROUND_OVER',
          selection: [],
          selectionVal: 0,
          clearingPositions: [],
        };
      }
      return { ...state, timeLeft: next };
    }

    case 'TAP_TILE': {
      if (state.phase !== 'SELECTING') return state;
      const newSel = toggleTile(state.selection, action.pos);
      const val = evaluateSelection(state.board, newSel, state.mode);

      // Over target → error, reset selection
      if (val > state.target) {
        return { ...state, selection: [], selectionVal: 0 };
      }

      // Match! (need at least 2 tiles)
      if (val === state.target && newSel.length >= 2) {
        // Score = sum of selected values (base points regardless of mode)
        const basePoints = newSel
          .map(({ row, col }) => state.board[row][col])
          .reduce((a, b) => a + b, 0);
        return {
          ...state,
          phase: 'CLEARING',
          selection: [],
          selectionVal: 0,
          clearingPositions: newSel,
          score: state.score + basePoints,
          roundScore: state.roundScore + basePoints,
        };
      }

      return { ...state, selection: newSel, selectionVal: val };
    }

    case 'CLEAR_COMPLETE': {
      const solvable = hasSolution(action.board, action.target, state.mode);
      const nextPhase = !solvable
        ? 'STALEMATE'
        : state.timeLeft > 0
        ? 'SELECTING'
        : 'ROUND_OVER';
      return {
        ...state,
        phase: nextPhase,
        board: action.board,
        target: action.target,
        clearingPositions: [],
        selection: [],
        selectionVal: 0,
      };
    }

    case 'ADVANCE_ROUND': {
      if (state.roundsCompleted >= ROUNDS_PER_SESSION) {
        return { ...state, phase: 'FINAL' };
      }
      return {
        ...state,
        phase: 'SELECTING',
        board: action.board,
        target: action.target,
        selection: [],
        selectionVal: 0,
        roundScore: 0,
        timeLeft: ROUND_DURATION_SECS,
        clearingPositions: [],
      };
    }

    case 'RESOLVE_STALEMATE': {
      return { ...state, phase: 'SELECTING', target: action.target };
    }

    case 'PLAY_AGAIN':
      return action.newState;

    default:
      return state;
  }
}

// ── Tile size — delegated to GridSizing canonical formula ─────────────────────

function computeTileSize(): number {
  const availH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN * 2;
  const availW = window.innerWidth - SAFE_MARGIN * 2;
  return Math.min(gridComputeTileSize(availH, availW, ROWS, COLS), 80);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CombineGridGame({ onBack }: { onBack?: () => void }) {
  // Stable profile and seeded PRNG ref (mirrors SpeedGrid's pattern).
  const profile = useMemo(() => getProfile(DEFAULT_PROFILE_ID), []);
  // [SEED LAW — Phase-8 Task-17] Capture seed before constructing PRNG so both
  // prngRef and CGState.seed are bound to the exact same uint32. prngSeedRef holds
  // the seed; prngRef holds the PRNG built from it. The lazy reducer initializer
  // passes both into initGame so CGState.seed === the runtime PRNG seed.
  const prngSeedRef = useRef(randomSeed());
  const prngRef = useRef(makePrng(prngSeedRef.current));

  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => initGame(profile, prngRef.current, prngSeedRef.current),
  );
  const [tileSize, setTileSize] = useState(computeTileSize);
  const isMounted = useRef(true);

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const handler = () => setTileSize(computeTileSize());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Countdown tick
  useEffect(() => {
    if (state.phase !== 'SELECTING') return;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  // ── CLEARING effect: gravity + new target ───────────────────────────────────
  // [PURITY] Captures state from the CLEARING-entry closure. Never reads
  // stateRef — the phase dependency guarantees a fresh closure per transition.

  useEffect(() => {
    if (state.phase !== 'CLEARING') return;

    // Snapshot at CLEARING entry — board still has the clearing tile values
    // (they're shown as fading via CSS opacity). Zero them for gravity.
    const currentBoard = state.board;
    const clearing = state.clearingPositions;
    const currentMode = state.mode;

    const preGravBoard = clearCells(currentBoard, clearing);

    // Cache each spawn so spawnValue and spawnBonus share the same token.
    const spawnCache: { value: number; isBonus: boolean }[][] =
      Array.from({ length: COLS }, () => []);

    const gravResult = applyGravity(
      preGravBoard,
      ROWS,
      COLS,
      (col, spawnIndex) => {
        const sp = spawnTile(profile, prngRef.current);
        spawnCache[col][spawnIndex] = sp;
        return sp.value;
      },
      (col, spawnIndex) => spawnCache[col][spawnIndex]?.isBonus ?? false,
    );

    const target = generateTarget(
      gravResult.grid,
      ROWS,
      COLS,
      currentMode,
      profile,
      prngRef.current,
    );

    const id = setTimeout(() => {
      if (!isMounted.current) return;
      dispatch({ type: 'CLEAR_COMPLETE', board: gravResult.grid, target });
    }, CLEAR_MS);

    return () => clearTimeout(id);
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // [NOTE] profile and prngRef are stable (memo / ref) — omitting is safe.

  // ── ROUND_OVER effect: spawn fresh board for next round ─────────────────────

  useEffect(() => {
    if (state.phase !== 'ROUND_OVER') return;
    const id = setTimeout(() => {
      if (!isMounted.current) return;
      const spawnedTiles = spawnBoard(ROWS, COLS, profile, prngRef.current);
      const board = gridFromSpawn(ROWS, COLS, spawnedTiles);
      const target = generateTarget(board, ROWS, COLS, 'sum', profile, prngRef.current);
      dispatch({ type: 'ADVANCE_ROUND', board, target });
    }, ROUND_OVER_AUTOADVANCE_MS);
    return () => clearTimeout(id);
  }, [state.phase, state.roundsCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── STALEMATE effect: generate a new target for the same board ──────────────

  useEffect(() => {
    if (state.phase !== 'STALEMATE') return;

    // Capture board from the STALEMATE-entry closure.
    const currentBoard = state.board;
    const currentMode = state.mode;

    const id = setTimeout(() => {
      if (!isMounted.current) return;
      const target = generateTarget(
        currentBoard,
        ROWS,
        COLS,
        currentMode,
        profile,
        prngRef.current,
      );
      dispatch({ type: 'RESOLVE_STALEMATE', target });
    }, 1500);
    return () => clearTimeout(id);
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render: FINAL ───────────────────────────────────────────────────────────
  if (state.phase === 'FINAL') {
    return (
      <ResultScreen
        totalScore={state.score}
        onBack={onBack ?? (() => {})}
      />
    );
  }

  // ── Render: ROUND_OVER interstitial ─────────────────────────────────────────
  if (state.phase === 'ROUND_OVER') {
    return (
      <div style={centeredScreen}>
        <div style={{ color: '#e67e22', fontSize: 13, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>
          Round {state.roundsCompleted} Complete
        </div>
        <div style={{ color: '#fff', fontSize: 52, fontWeight: 900, lineHeight: 1, marginTop: 4 }}>
          {state.roundScore}
        </div>
        <div style={{ color: '#666', fontSize: 13, fontWeight: 700, marginTop: 4 }}>
          Round Score
        </div>
        <div style={{ color: '#444', fontSize: 12, marginTop: 18 }}>
          {state.roundsCompleted >= ROUNDS_PER_SESSION
            ? 'Calculating final score…'
            : 'Next round starting…'}
        </div>
      </div>
    );
  }

  // ── Render: STALEMATE ────────────────────────────────────────────────────────
  if (state.phase === 'STALEMATE') {
    return (
      <div style={centeredScreen}>
        <div style={{ color: '#888', fontSize: 14, fontWeight: 700 }}>
          No valid moves — reshuffling…
        </div>
      </div>
    );
  }

  // ── Render: Main game (SELECTING | CLEARING) ────────────────────────────────
  const timerPct = state.timeLeft / ROUND_DURATION_SECS;
  const timerColor =
    state.timeLeft <= 5 ? '#ef4444' : state.timeLeft <= 10 ? '#f97316' : '#22c55e';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#141416',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'Nunito, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ── HUD top ─────────────────────────────────────────────────────────── */}
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
            TARGET +
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

      {/* ── Board ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Board
          grid={state.board}
          tileSize={tileSize}
          selection={state.selection}
          clearingPositions={state.clearingPositions}
          onTilePress={(pos: GridPos) => dispatch({ type: 'TAP_TILE', pos })}
        />
      </div>

      {/* ── HUD bottom ──────────────────────────────────────────────────────── */}
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
        {/* Selection value readout */}
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {state.selectionVal > 0 ? (
            <span>
              <span style={{ color: '#fff', fontSize: 16 }}>{state.selectionVal}</span>
              <span style={{ color: '#555', fontSize: 12 }}> / {state.target}</span>
            </span>
          ) : (
            <span style={{ color: '#444' }}>Select tiles</span>
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
