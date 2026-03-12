import React, { useEffect, useReducer, useRef, useState } from 'react';
import Board from './components/Board';
import ResultScreen from './components/ResultScreen';
import {
  ROWS,
  COLS,
  ROUNDS_PER_SESSION,
  ROUND_DURATION_SECS,
  CLEAR_MS,
  ROUND_OVER_AUTOADVANCE_MS,
  STALEMATE_VALID_THRESHOLD,
} from './constants';
import { HUD_TOP_H, HUD_BOT_H, SAFE_MARGIN } from './uiTokens';
import { GamePhase, Tile, GridPos } from './types';
import {
  createBoard,
  applyGravity,
  evaluateSelection,
  generateTarget,
  hasSolution,
} from './services/GridService';
import { toggleTile } from './services/SelectionService';

// ── State ─────────────────────────────────────────────────────────────────────

interface CGState {
  phase: GamePhase;
  mode: 'sum' | 'multiply';
  board: Tile[][];
  selection: GridPos[];
  target: number;
  selectionVal: number;
  score: number;
  roundScore: number;
  roundsCompleted: number;
  roundScores: number[];
  timeLeft: number;
  clearingPositions: GridPos[];
  newTileIds: Set<string>;
}

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'TICK' }
  | { type: 'TAP_TILE'; pos: GridPos }
  | { type: 'CLEAR_COMPLETE'; board: Tile[][]; newIds: Set<string>; target: number }
  | { type: 'ADVANCE_ROUND' }
  | { type: 'RESOLVE_STALEMATE' }
  | { type: 'PLAY_AGAIN' };

// ── Lazy initializer ──────────────────────────────────────────────────────────

function initGame(): CGState {
  const board = createBoard();
  return {
    phase: 'SELECTING',
    mode: 'sum',
    board,
    selection: [],
    target: generateTarget(board, 'sum'),
    selectionVal: 0,
    score: 0,
    roundScore: 0,
    roundsCompleted: 0,
    roundScores: [],
    timeLeft: ROUND_DURATION_SECS,
    clearingPositions: [],
    newTileIds: new Set(),
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

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
        const basePoints = newSel
          .map(({ r, c }) => state.board[r][c].val)
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
      // Wire stalemate: STALEMATE_VALID_THRESHOLD = 1 means we need ≥1 valid selection
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
        newTileIds: action.newIds,
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
      const board = createBoard();
      return {
        ...state,
        phase: 'SELECTING',
        board,
        target: generateTarget(board, state.mode),
        selection: [],
        selectionVal: 0,
        roundScore: 0,
        timeLeft: ROUND_DURATION_SECS,
        clearingPositions: [],
        newTileIds: new Set(),
      };
    }

    case 'RESOLVE_STALEMATE': {
      // Generate a new target for the same board and resume play
      const target = generateTarget(state.board, state.mode);
      return { ...state, phase: 'SELECTING', target };
    }

    case 'PLAY_AGAIN':
      return initGame();

    default:
      return state;
  }
}

// ── Tile size — restored to baseline formula ──────────────────────────────────

function computeTileSize(): number {
  const availH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN * 2 - 32;
  const availW = window.innerWidth - SAFE_MARGIN * 2 - 16;
  const byH = Math.floor(availH / ROWS);
  const byW = Math.floor(availW / COLS);
  return Math.min(byH, byW, 80);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CombineGridGame({ onBack }: { onBack?: () => void }) {
  const [state, dispatch] = useReducer(reducer, undefined, initGame);
  const [tileSize, setTileSize] = useState(computeTileSize);
  const isMounted = useRef(true);

  // Refs for stale-closure safety in setTimeout callbacks
  const latestBoard = useRef(state.board);
  const latestClearing = useRef(state.clearingPositions);
  latestBoard.current = state.board;
  latestClearing.current = state.clearingPositions;

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

  // Clear animation → apply gravity after CLEAR_MS
  useEffect(() => {
    if (state.phase !== 'CLEARING') return;
    const id = setTimeout(() => {
      if (!isMounted.current) return;
      const { board: newBoard, newIds } = applyGravity(
        latestBoard.current,
        latestClearing.current,
      );
      const target = generateTarget(newBoard, 'sum');
      dispatch({ type: 'CLEAR_COMPLETE', board: newBoard, newIds, target });
    }, CLEAR_MS);
    return () => clearTimeout(id);
  }, [state.phase]);

  // Auto-advance after ROUND_OVER
  useEffect(() => {
    if (state.phase !== 'ROUND_OVER') return;
    const id = setTimeout(() => {
      if (!isMounted.current) return;
      dispatch({ type: 'ADVANCE_ROUND' });
    }, ROUND_OVER_AUTOADVANCE_MS);
    return () => clearTimeout(id);
  }, [state.phase, state.roundsCompleted]);

  // Stalemate resolution — generate new target and resume
  useEffect(() => {
    if (state.phase !== 'STALEMATE') return;
    const id = setTimeout(() => {
      if (!isMounted.current) return;
      dispatch({ type: 'RESOLVE_STALEMATE' });
    }, 1500);
    return () => clearTimeout(id);
  }, [state.phase]);

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
          onTilePress={(pos) => dispatch({ type: 'TAP_TILE', pos })}
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
