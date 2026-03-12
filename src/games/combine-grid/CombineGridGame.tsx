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
} from './constants';
import { HUD_TOP_H, HUD_BOT_H, SAFE_MARGIN, GAP } from './uiTokens';
import { GamePhase, Tile, GridPos, CombineMode } from './types';
import {
  createBoard,
  applyGravity,
  evaluateSelection,
  generateTarget,
} from './services/GridService';
import { toggleTile } from './services/SelectionService';

// ── State ─────────────────────────────────────────────────────────────────────

interface CGState {
  phase: GamePhase;
  mode: CombineMode;
  board: Tile[][];
  selection: GridPos[];
  target: number;
  selectionVal: number;
  score: number;
  roundScore: number;
  combo: number;
  comboResetKey: number;
  roundsCompleted: number;
  roundScores: number[];
  timeLeft: number;
  clearingPositions: GridPos[];
  newTileIds: Set<string>;
  shakeKey: number; // increments on wrong selection — drives shake animation
}

// ── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'BEGIN_GAME'; mode: CombineMode }
  | { type: 'TICK' }
  | { type: 'TAP_TILE'; pos: GridPos }
  | { type: 'CLEAR_COMPLETE'; board: Tile[][]; newIds: Set<string>; target: number }
  | { type: 'ADVANCE_ROUND' }
  | { type: 'PLAY_AGAIN' };

// ── Initial state ─────────────────────────────────────────────────────────────

const BLANK: CGState = {
  phase: 'IDLE',
  mode: 'sum',
  board: [],
  selection: [],
  target: 0,
  selectionVal: 0,
  score: 0,
  roundScore: 0,
  combo: 0,
  comboResetKey: 0,
  roundsCompleted: 0,
  roundScores: [],
  timeLeft: ROUND_DURATION_SECS,
  clearingPositions: [],
  newTileIds: new Set(),
  shakeKey: 0,
};

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: CGState, action: Action): CGState {
  switch (action.type) {
    case 'BEGIN_GAME': {
      const board = createBoard();
      return {
        ...BLANK,
        phase: 'SELECTING',
        mode: action.mode,
        board,
        target: generateTarget(board, action.mode),
        timeLeft: ROUND_DURATION_SECS,
      };
    }

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
          combo: 0,
          comboResetKey: state.comboResetKey + 1,
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
        return {
          ...state,
          selection: [],
          selectionVal: 0,
          shakeKey: state.shakeKey + 1,
          combo: 0,
          comboResetKey: state.comboResetKey + 1,
        };
      }

      // Match! (need at least 2 tiles)
      if (val === state.target && newSel.length >= 2) {
        const basePoints = newSel
          .map(({ r, c }) => state.board[r][c].val)
          .reduce((a, b) => a + b, 0);
        const multiplier = 1 + Math.floor(state.combo / 3) * 0.5;
        const points = Math.ceil(basePoints * multiplier);
        return {
          ...state,
          phase: 'CLEARING',
          selection: [],
          selectionVal: 0,
          clearingPositions: newSel,
          score: state.score + points,
          roundScore: state.roundScore + points,
          combo: state.combo + 1,
        };
      }

      return { ...state, selection: newSel, selectionVal: val };
    }

    case 'CLEAR_COMPLETE': {
      return {
        ...state,
        phase: state.timeLeft > 0 ? 'SELECTING' : 'ROUND_OVER',
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
        combo: 0,
        comboResetKey: state.comboResetKey + 1,
      };
    }

    case 'PLAY_AGAIN': {
      const board = createBoard();
      return {
        ...BLANK,
        phase: 'SELECTING',
        mode: state.mode,
        board,
        target: generateTarget(board, state.mode),
        timeLeft: ROUND_DURATION_SECS,
      };
    }

    default:
      return state;
  }
}

// ── Tile size ─────────────────────────────────────────────────────────────────

function computeTileSize(): number {
  const availH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN * 2 - 20;
  const availW = window.innerWidth - SAFE_MARGIN * 2 - 16;
  const byH = Math.floor((availH - (ROWS - 1) * GAP) / ROWS);
  const byW = Math.floor((availW - (COLS - 1) * GAP) / COLS);
  return Math.min(byH, byW, 80);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CombineGridGame({ onBack }: { onBack?: () => void }) {
  const [state, dispatch] = useReducer(reducer, BLANK);
  const [tileSize, setTileSize] = useState(computeTileSize);
  const [isShaking, setIsShaking] = useState(false);
  const isMounted = useRef(true);

  // Keep a ref to the latest state values needed inside setTimeout closures
  const latestBoard = useRef(state.board);
  const latestClearing = useRef(state.clearingPositions);
  const latestMode = useRef(state.mode);
  latestBoard.current = state.board;
  latestClearing.current = state.clearingPositions;
  latestMode.current = state.mode;

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

  // Clear animation → gravity after CLEAR_MS
  useEffect(() => {
    if (state.phase !== 'CLEARING') return;
    const id = setTimeout(() => {
      if (!isMounted.current) return;
      const { board: newBoard, newIds } = applyGravity(
        latestBoard.current,
        latestClearing.current,
      );
      const target = generateTarget(newBoard, latestMode.current);
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

  // Shake animation trigger
  useEffect(() => {
    if (state.shakeKey === 0) return;
    setIsShaking(true);
    const id = setTimeout(() => setIsShaking(false), 350);
    return () => clearTimeout(id);
  }, [state.shakeKey]);

  // ── Render: FINAL ───────────────────────────────────────────────────────────
  if (state.phase === 'FINAL') {
    return (
      <ResultScreen
        totalScore={state.score}
        roundScores={state.roundScores}
        mode={state.mode}
        onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN' })}
        onBack={onBack ?? (() => {})}
      />
    );
  }

  // ── Render: IDLE — mode selector ────────────────────────────────────────────
  if (state.phase === 'IDLE') {
    return (
      <div style={fullScreen}>
        <div style={{ color: '#e67e22', fontSize: 13, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 4 }}>
          CombineGrid
        </div>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 12 }}>
          Choose Mode
        </div>
        <button
          onClick={() => dispatch({ type: 'BEGIN_GAME', mode: 'sum' })}
          style={modeBtn('#e67e22', 'rgba(154,52,18,1)')}
        >
          ＋ Addition
        </button>
        <button
          onClick={() => dispatch({ type: 'BEGIN_GAME', mode: 'multiply' })}
          style={{ ...modeBtn('#8b5cf6', 'rgba(76,29,149,1)') }}
        >
          × Multiply
        </button>
        <button
          onClick={onBack}
          style={{ marginTop: 8, padding: '12px 32px', borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#888', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Render: ROUND_OVER interstitial ─────────────────────────────────────────
  if (state.phase === 'ROUND_OVER') {
    return (
      <div style={fullScreen}>
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

  // ── Render: Main game (SELECTING | CLEARING) ────────────────────────────────
  const timerPct = state.timeLeft / ROUND_DURATION_SECS;
  const timerColor =
    state.timeLeft <= 5 ? '#ef4444' : state.timeLeft <= 10 ? '#f97316' : '#22c55e';
  const modeSymbol = state.mode === 'sum' ? '+' : '×';

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
            TARGET {modeSymbol}
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
          newTileIds={state.newTileIds}
          onTilePress={(pos) => dispatch({ type: 'TAP_TILE', pos })}
          shake={isShaking}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Selection readout */}
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
          {/* Combo badge */}
          {state.combo > 0 && (
            <div
              key={state.comboResetKey}
              style={{
                background: 'rgba(230,126,34,0.14)',
                border: '1px solid rgba(230,126,34,0.35)',
                borderRadius: 8,
                padding: '2px 10px',
                color: '#e67e22',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {state.combo}× COMBO
            </div>
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

const fullScreen: React.CSSProperties = {
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

function modeBtn(bg: string, shadow: string): React.CSSProperties {
  return {
    width: 240,
    padding: '18px 0',
    borderRadius: 18,
    border: 'none',
    background: bg,
    color: '#fff',
    fontSize: 17,
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: 1,
    boxShadow: `0 5px 0 ${shadow}`,
  };
}
