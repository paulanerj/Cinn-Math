// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/SpeedGridGame.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Root component for SpeedGrid. Owns the game reducer, all effects,
//        and the top-level render tree.  It is the only stateful component in
//        the SpeedGrid subtree — all children are presentational.
//
// [PROPS] { onBack: () => void }  — matches GameSelector's contract.
//         No other props. No additional context providers.
//
// [STATE MACHINE]
//   WAITING_TO_START → PLAYING (first pointer-down starts timer)
//   PLAYING → CLEARING         (valid chain committed)
//   CLEARING → PLAYING         (gravity anim + new target ready)
//   PLAYING → GAME_OVER        (timer expires)
//   GAME_OVER → WAITING_TO_START (Play Again — new PRNG + new board)
//
// [PURITY CONTRACT]
//   Reducer: pure — no PRNG, no timers, no async.
//   PRNG lives in prngRef (mutable ref). Effects read from stateRef.
//   All PRNG-derived values (new grid, new target) are computed in effects
//   and handed back via GRAVITY_DONE / PLAY_AGAIN actions.
//
// [PLATFORM WIRING]
//   - Uses HUDTopBar / HUDIconBtn from src/platform/ui/HUDShell.tsx
//   - Uses HUDBottomBar from src/platform/ui/HUDShell.tsx
//   - Does NOT duplicate ToastProvider (it is already in main.tsx)
//   - Does NOT call ReactDOM.createRoot()
//   - Cleans up all setInterval / setTimeout in useEffect return functions
//
// [BONUS MASK INVARIANT]
//   bonusMask[r][c] === true iff grid[r][c] is a bonus tile.
//   After gravity, applyBonusMaskGravity() remaps the mask using the same
//   compaction logic as GravitySystem — bonus status follows its tile.
//
// [RISK-3 / RISK-7] Scoring uses full ScoreSystem (combo multiplier).
//                   Bonus mask is tracked as a parallel boolean[][].
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

// ── Phase-7 telemetry helper (pure) ──────────────────────────────────────────

/** O(ROWS·COLS·8) Chebyshev solvability scan. Used by debug overlay. */
function boardHasTwoTileSolution(
  grid: number[][],
  target: number,
  rows: number,
  cols: number,
): boolean {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r2 = r + dr, c2 = c + dc;
          if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
          if (grid[r2][c2] === 0) continue;
          if (grid[r][c] + grid[r2][c2] === target) return true;
        }
      }
    }
  }
  return false;
}

// ── Engine imports (via public barrel) ───────────────────────────────────────
import {
  makePrng,
  randomSeed,
  spawnTile,
  generateTarget,
  evaluate,
  getProfile,
  DEFAULT_PROFILE_ID,
} from '../../engine/public';

// ── Reducer + initGame (pure, extracted for testability) ─────────────────────
import {
  initGame,
  sgReducer,
  applyBonusMaskGravity,
} from './sgReducer';

// ── System imports ────────────────────────────────────────────────────────────
import {
  isInWarningZone,
  countdownProgress,
} from '../../systems/TimerSystem';
import { nextMultiplier } from '../../systems/ScoreSystem';
import { applyGravity } from '../../systems/GravitySystem';
import {
  buildGravityFrames,
  gravityAnimTotalMs,
} from '../../systems/GravityAnimator';

// ── Platform UI ───────────────────────────────────────────────────────────────
import {
  HUDTopBar,
  HUDBottomBar,
  HUDIconBtn,
} from '../../platform/ui/HUDShell';

// ── SpeedGrid-local ───────────────────────────────────────────────────────────
import type { SGState, SGAction } from './types';
import {
  ROWS,
  COLS,
  CHAIN_MIN_LENGTH,
  TIMER_WARNING_SECS,
} from './constants';
import {
  HUD_TOP_H,
  HUD_BOT_H,
  computeTileSize,
} from './uiTokens';
import Board from './components/Board';
import ResultScreen from './components/ResultScreen';

// ── Icon paths ────────────────────────────────────────────────────────────────

// Material Design "arrow_back"
const ICON_BACK =
  'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z';

// (initGame, sgReducer, applyBonusMaskGravity imported from ./sgReducer)

// ── Component ─────────────────────────────────────────────────────────────────

interface SpeedGridGameProps {
  onBack: () => void;
}

export default function SpeedGridGame({ onBack }: SpeedGridGameProps) {
  // ── PRNG and profile ───────────────────────────────────────────────────────

  const profile = useMemo(() => getProfile(DEFAULT_PROFILE_ID), []);
  const prngRef = useRef(makePrng(randomSeed()));

  // ── Reducer ────────────────────────────────────────────────────────────────

  const [state, dispatch] = useReducer(
    sgReducer,
    undefined,
    () => initGame(profile, prngRef.current),
  );

  // stateRef mirrors state so effects can read the latest values without
  // listing every field as a dependency.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Tile size ──────────────────────────────────────────────────────────────

  const [tileSize, setTileSize] = useState(() =>
    computeTileSize(window.innerWidth, window.innerHeight, ROWS, COLS),
  );

  useEffect(() => {
    const handleResize = () => {
      setTileSize(
        computeTileSize(window.innerWidth, window.innerHeight, ROWS, COLS),
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Timer effect ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'PLAYING') return;
    const id = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1_000);
    return () => clearInterval(id);
  }, [state.phase]);

  // ── Gravity + refill effect (fires when phase becomes CLEARING) ────────────

  useEffect(() => {
    if (state.phase !== 'CLEARING') return;

    let cancelled = false;

    // Capture current state synchronously — stateRef is up-to-date because
    // stateRef.current = state runs before effects (in render).
    const clearGrid = stateRef.current.grid;         // has 0s at cleared positions
    const clearMask = stateRef.current.bonusMask;    // has false at cleared positions
    const clearMode = stateRef.current.mode;

    // Track spawn bonuses in a closure-local array indexed [col][spawnIndex].
    const spawnBonuses: boolean[][] = Array.from({ length: COLS }, () => []);

    // Apply gravity. spawnValue closure tracks bonus status of new tiles.
    const gravResult = applyGravity(
      clearGrid,
      ROWS,
      COLS,
      (col, spawnIndex) => {
        const sp = spawnTile(profile, prngRef.current);
        spawnBonuses[col][spawnIndex] = sp.isBonus;
        return sp.value;
      },
    );

    // Remap bonus mask using same column-compaction as GravitySystem.
    const newBonusMask = applyBonusMaskGravity(
      clearMask,
      clearGrid,
      spawnBonuses,
      ROWS,
      COLS,
    );

    // Generate next target from the settled board.
    const newTarget = generateTarget(
      gravResult.grid,
      ROWS,
      COLS,
      clearMode,
      profile,
      prngRef.current,
    );

    // Compute animation duration and wait before re-enabling input.
    const frames = buildGravityFrames(
      gravResult.fallingTiles,
      gravResult.spawnedPositions,
    );
    const animMs = Math.max(gravityAnimTotalMs(frames), 350);

    const id = setTimeout(() => {
      if (!cancelled) {
        dispatch({
          type: 'GRAVITY_DONE',
          grid: gravResult.grid,
          bonusMask: newBonusMask,
          target: newTarget,
        });
      }
    }, animMs);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // [NOTE] profile and prngRef are stable (memo / ref) — omitting is safe.

  // ── Wrong flash clear ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!state.wrongFlash) return;
    const id = setTimeout(() => {
      dispatch({ type: 'CLEAR_WRONG_FLASH' });
    }, 600);
    return () => clearTimeout(id);
  }, [state.wrongFlash]);

  // ── Telemetry overlay (Ctrl+Shift+D) ──────────────────────────────────────

  const [showTelemetry, setShowTelemetry] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowTelemetry((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Play Again ─────────────────────────────────────────────────────────────

  const handlePlayAgain = useCallback(() => {
    // Re-seed PRNG so each restart produces a different board.
    prngRef.current = makePrng(randomSeed());
    const newState = initGame(profile, prngRef.current);
    dispatch({ type: 'PLAY_AGAIN', newState });
  }, [profile]);

  // ── Derived display values ─────────────────────────────────────────────────

  const timerProgress = countdownProgress(state.timer);
  const isWarning = isInWarningZone(state.timer, TIMER_WARNING_SECS);
  const remainingSecs = Math.ceil(state.timer.remainingSeconds);
  const multiplier = nextMultiplier(state.score);

  // Live chain sum shown while dragging.
  const chainSum =
    state.chain.positions.length > 0
      ? evaluate(
          state.chain.positions.map((p) => state.grid[p.row][p.col]),
          state.mode,
        )
      : null;

  // ── Game-over screen ───────────────────────────────────────────────────────

  if (state.phase === 'GAME_OVER') {
    return (
      <ResultScreen
        score={state.score}
        chainsCompleted={state.chainsCompleted}
        bonusesCollected={state.bonusesCollected}
        onPlayAgain={handlePlayAgain}
        onBack={onBack}
      />
    );
  }

  // ── Game screen ────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#141416',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Nunito, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* ── HUD Top ─────────────────────────────────────────────────────── */}
      <HUDTopBar
        left={
          <HUDIconBtn icon={ICON_BACK} onClick={onBack} label="Back to menu" />
        }
        center={
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {/* Score + combo multiplier */}
            <div
              style={{
                color: '#fff',
                fontWeight: 900,
                fontSize: 18,
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
              }}
            >
              {state.score.score}
              {state.score.comboCount >= CHAIN_MIN_LENGTH && (
                <span style={{ fontSize: 12, color: '#fbbf24' }}>
                  ×{multiplier.toFixed(1)}
                </span>
              )}
            </div>

            {/* Timer progress bar */}
            <div
              style={{
                width: 120,
                height: 5,
                background: '#2d2d2f',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${timerProgress * 100}%`,
                  height: '100%',
                  background: isWarning ? '#ef4444' : '#3b82f6',
                  borderRadius: 'inherit',
                  transition: 'width 0.9s linear, background 0.3s',
                }}
              />
            </div>
          </div>
        }
        right={
          state.phase !== 'WAITING_TO_START' ? (
            <div
              style={{
                color: isWarning ? '#ef4444' : '#94a3b8',
                fontSize: 13,
                fontWeight: 700,
                minWidth: 28,
                textAlign: 'right',
              }}
            >
              {remainingSecs}s
            </div>
          ) : undefined
        }
      />

      {/* ── Board area ───────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: HUD_TOP_H,
          left: 0,
          right: 0,
          bottom: HUD_BOT_H,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {/* Target display */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span style={{ color: '#64748b' }}>Target</span>
          <span
            style={{ color: '#3b82f6', fontSize: 22, fontWeight: 900 }}
          >
            {state.target}
          </span>

          {/* Live chain sum feedback */}
          {chainSum !== null && (
            <span
              style={{
                color:
                  chainSum === state.target
                    ? '#22c55e'
                    : '#94a3b8',
                fontSize: 14,
                transition: 'color 0.1s',
              }}
            >
              = {chainSum}
            </span>
          )}
        </div>

        {/* Wrong flash */}
        {state.wrongFlash && (
          <div
            style={{
              color: '#ef4444',
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 1,
            }}
          >
            Wrong!
          </div>
        )}

        {/* Waiting-to-start hint */}
        {state.phase === 'WAITING_TO_START' && (
          <div style={{ color: '#475569', fontSize: 13 }}>
            Drag tiles to start
          </div>
        )}

        {/* The board */}
        <Board
          grid={state.grid}
          bonusMask={state.bonusMask}
          chain={state.chain}
          tileSize={tileSize}
          dispatch={dispatch}
          phase={state.phase}
        />
      </div>

      {/* ── Telemetry overlay (Ctrl+Shift+D) ───────────────────────────── */}
      {showTelemetry && (
        <div
          style={{
            position: 'absolute',
            top: HUD_TOP_H + 4,
            right: 8,
            background: 'rgba(0,0,0,0.82)',
            color: '#a3e635',
            fontSize: 11,
            fontFamily: 'monospace',
            padding: '8px 10px',
            borderRadius: 6,
            lineHeight: 1.6,
            pointerEvents: 'none',
            zIndex: 999,
            minWidth: 200,
          }}
        >
          <div style={{ color: '#facc15', fontWeight: 700, marginBottom: 4 }}>
            ◈ SpeedGrid Telemetry
          </div>
          <div>phase: <b>{state.phase}</b></div>
          <div>target: <b>{state.target}</b></div>
          <div>
            timer: <b>{state.timer.remainingSeconds.toFixed(1)}s</b>
            {' '}({(countdownProgress(state.timer) * 100).toFixed(0)}%)
          </div>
          <div>score: <b>{state.score.score}</b></div>
          <div>combo: <b>{state.score.comboCount}</b></div>
          <div>chains: <b>{state.chainsCompleted}</b></div>
          <div>bonuses: <b>{state.bonusesCollected}</b></div>
          <div>
            chain len: <b>{state.chain.positions.length}</b>
            {state.chain.isActive ? ' (active)' : ' (idle)'}
          </div>
          <div>
            2-tile solution:{' '}
            <b style={{
              color: boardHasTwoTileSolution(state.grid, state.target, ROWS, COLS)
                ? '#a3e635' : '#ef4444',
            }}>
              {boardHasTwoTileSolution(state.grid, state.target, ROWS, COLS)
                ? 'YES' : 'NO'}
            </b>
          </div>
          <div style={{ color: '#64748b', marginTop: 4, fontSize: 10 }}>
            Ctrl+Shift+D to hide
          </div>
        </div>
      )}

      {/* ── HUD Bottom ──────────────────────────────────────────────────── */}
      <HUDBottomBar>
        <div style={{ color: '#475569', fontSize: 12 }}>
          Chains&nbsp;
          <span style={{ color: '#94a3b8', fontWeight: 700 }}>
            {state.chainsCompleted}
          </span>
        </div>

        {state.score.comboCount >= 2 && (
          <div
            style={{
              color: '#fbbf24',
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 0.5,
            }}
          >
            {state.score.comboCount}× Combo!
          </div>
        )}

        <div style={{ color: '#475569', fontSize: 12 }}>
          Bonus&nbsp;
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>
            {state.bonusesCollected}
          </span>
        </div>
      </HUDBottomBar>
    </div>
  );
}
