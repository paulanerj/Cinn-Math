import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
import { GridPos } from './types';
import { CGState, Action, initGame, reducer } from './cgReducer';
import {
  makePrng,
  randomSeed,
  spawnTile,
  spawnBoard,
  gridFromSpawn,
  generateTarget,
  getProfile,
  DEFAULT_PROFILE_ID,
} from '../../engine/public';
import { runGravityOrchestrator } from '../../systems/GravityOrchestrator';
import { computeTileSize as gridComputeTileSize } from '../../grid/GridSizing';

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
  const [hoverPos, setHoverPos] = useState<GridPos | null>(null);
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

    // Snapshot at CLEARING entry — board already has cleared cells zeroed
    // (reducer applied clearCells in TAP_TILE before transitioning to CLEARING).
    const currentBoard = state.board;
    const clearing = state.clearingPositions;
    const currentMode = state.mode;

    const preGravBoard = currentBoard;

    // Cache each spawn so spawnValue and spawnBonus share the same token.
    const spawnCache: { value: number; isBonus: boolean }[][] =
      Array.from({ length: COLS }, () => []);

    // [GRAVITY ORCHESTRATOR — Phase-9 Task-5]
    // bonusMask is now real state (no more all-false shim).
    // Reducer already zeroed cleared positions in bonusMask before CLEARING.
    // orchResult.bonusMask carries the post-gravity evolved mask back to state.
    const orchResult = runGravityOrchestrator({
      grid: preGravBoard,
      bonusMask: state.bonusMask,
      clearedPositions: clearing,
      rows: ROWS,
      cols: COLS,
      spawnValue: (col, spawnIndex) => {
        const sp = spawnTile(profile, prngRef.current);
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
  // [NOTE] profile and prngRef are stable (memo / ref) — omitting is safe.

  // ── ROUND_OVER effect: spawn fresh board for next round ─────────────────────

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

  // ── RESPAWNING effect: in-place tile refill after drag-merge ────────────────
  // Fires when DRAG_DROP sets respawnPositions (1 pos for merge, 2 for clear).
  // Spawns fresh tile(s) from the PRNG, generates a new target for full clears,
  // then dispatches RESPAWN_COMPLETE after CLEAR_MS so the opacity animation plays.
  // [STATIC RESPAWN] No gravity, no column collapse — tiles refill in-place.
  // [PURITY] All PRNG calls happen here, not in the reducer.

  useEffect(() => {
    if (state.respawnPositions.length === 0) return;

    // Snapshot respawnPositions and board at effect-entry. Do not read stateRef.
    const positions = state.respawnPositions;
    const currentBoard = state.board;
    const currentMode = state.mode;
    const currentTarget = state.target;

    // Spawn one tile per position — consumes PRNG tokens for each.
    const respawns = positions.map((pos) => {
      const sp = spawnTile(profile, prngRef.current);
      return { pos, value: sp.value, isBonus: sp.isBonus };
    });

    // Full clear (both tiles removed, positions.length >= 2): generate a new target
    // from the settled board (zeros filled with respawn values).
    // Merge (only src removed, positions.length === 1): target is unchanged.
    let target = currentTarget;
    if (positions.length >= 2) {
      const settledBoard = currentBoard.map((row, r) =>
        row.map((val, c) => {
          const rsp = respawns.find((x) => x.pos.row === r && x.pos.col === c);
          return rsp !== undefined ? rsp.value : val;
        }),
      );
      target = generateTarget(settledBoard, ROWS, COLS, currentMode, profile, prngRef.current);
    }

    const id = setTimeout(() => {
      if (!isMounted.current) return;
      dispatch({ type: 'RESPAWN_COMPLETE', respawns, target });
    }, CLEAR_MS);

    return () => clearTimeout(id);
  }, [state.respawnPositions]); // eslint-disable-line react-hooks/exhaustive-deps
  // [NOTE] profile and prngRef are stable (memo / ref) — omitting is safe.

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

  // ── Drag interaction handlers ────────────────────────────────────────────────
  // First tap on a tile: DRAG_START (sets dragSource, highlights tile blue).
  // Second tap on any tile: DRAG_DROP (reducer validates adjacency and evaluates).
  // Reducer returns { dragSource: null } on invalid drop — visually snaps back.
  const handleTilePress = useCallback((pos: GridPos) => {
    if (state.phase !== 'SELECTING') return;
    if (state.dragSource === null) {
      dispatch({ type: 'DRAG_START', pos });
    } else {
      dispatch({ type: 'DRAG_DROP', src: state.dragSource, dst: pos });
      setHoverPos(null);
    }
  }, [state.phase, state.dragSource]);

  const handleTileHover = useCallback((pos: GridPos) => {
    if (state.dragSource !== null) setHoverPos(pos);
  }, [state.dragSource]);

  // Compute drop target: hoverPos that is adjacent (Chebyshev = 1) to dragSource.
  const dropTarget: GridPos | null = (() => {
    if (state.dragSource === null || hoverPos === null) return null;
    const adjacent =
      Math.max(
        Math.abs(hoverPos.row - state.dragSource.row),
        Math.abs(hoverPos.col - state.dragSource.col),
      ) === 1;
    return adjacent ? hoverPos : null;
  })();

  // Equation preview (pure UI — reducer never produces strings).
  const eqPreview = (() => {
    if (state.dragSource === null) return null;
    const srcVal = state.board[state.dragSource.row][state.dragSource.col];
    if (dropTarget === null) return { label: `${srcVal} ×  ?`, color: '#888' };
    const dstVal = state.board[dropTarget.row][dropTarget.col];
    if (dstVal === 0) return { label: `${srcVal} ×  ?`, color: '#888' };
    const result = srcVal * dstVal;
    const color =
      result === state.target ? '#22c55e' : result > state.target ? '#ef4444' : '#aaa';
    return { label: `${srcVal} × ${dstVal} = ${result}`, color };
  })();

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
      onMouseLeave={() => {
        if (state.dragSource !== null) {
          dispatch({ type: 'DRAG_CANCEL' });
          setHoverPos(null);
        }
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

      {/* ── Board ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Board
          grid={state.board}
          tileSize={tileSize}
          selection={state.selection}
          clearingPositions={state.clearingPositions}
          dragSource={state.dragSource}
          dropTarget={dropTarget}
          onTilePress={handleTilePress}
          onTileHover={handleTileHover}
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
        {/* Equation preview (Section E — pure UI, no reducer strings) */}
        <div style={{ fontSize: 13, fontWeight: 700, minHeight: 20 }}>
          {eqPreview !== null ? (
            <span style={{ color: eqPreview.color, fontSize: 16 }}>{eqPreview.label}</span>
          ) : (
            <span style={{ color: '#444' }}>Tap a tile to start a merge</span>
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
