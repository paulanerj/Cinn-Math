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

// ── Engine imports (via public barrel) ───────────────────────────────────────
import {
  makePrng,
  randomSeed,
  spawnBoard,
  spawnTile,
  gridFromSpawn,
  generateTarget,
  evaluate,
  chainMatchesTarget,
  getProfile,
  DEFAULT_PROFILE_ID,
} from '../../engine/public';

// ── System imports ────────────────────────────────────────────────────────────
import {
  emptyChain,
  startChain,
  tryExtend,
  commitChain,
  isChainReadyToEvaluate,
} from '../../systems/ChainSelector';
import {
  createTimer,
  startTimer,
  tick,
  isExpired,
  isInWarningZone,
  countdownProgress,
  addTime,
} from '../../systems/TimerSystem';
import {
  createScoreState,
  calculatePoints,
  recordMatch,
  resetCombo,
  nextMultiplier,
} from '../../systems/ScoreSystem';
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
  ROUND_DURATION_SECS,
  BONUS_TIME_SECS,
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

// ── Bonus mask helpers ────────────────────────────────────────────────────────

/**
 * Applies the same column-compaction logic as GravitySystem to the bonus mask.
 * Called in the CLEARING effect after gravity so bonus status follows its tile.
 *
 * Algorithm (per column):
 *   1. Collect surviving tile bonus values bottom-to-top (grid[r][c] !== 0 = surviving).
 *   2. Place them at the bottom of the new mask (mirrors gravity compaction).
 *   3. Fill remaining top rows with spawn bonus values from spawnBonuses[col][spawnIdx].
 *
 * @param oldMask     bonusMask from state — has false at cleared positions.
 * @param preGravGrid The grid with 0s at cleared positions (pre-gravity, from reducer).
 * @param spawnBonuses [col][spawnIndex] → whether that newly spawned tile is bonus.
 * @param rows        ROWS constant.
 * @param cols        COLS constant.
 */
function applyBonusMaskGravity(
  oldMask: boolean[][],
  preGravGrid: number[][],
  spawnBonuses: boolean[][],
  rows: number,
  cols: number,
): boolean[][] {
  const newMask: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  );

  for (let c = 0; c < cols; c++) {
    // Collect surviving bonus values bottom-to-top (non-zero cells survived).
    const surviving: boolean[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (preGravGrid[r][c] !== 0) {
        surviving.push(oldMask[r][c]);
      }
    }
    // surviving[0] = bottom-most surviving tile; surviving[n-1] = topmost.
    // Place them at the bottom of the new column.
    for (let i = 0; i < surviving.length; i++) {
      newMask[rows - 1 - i][c] = surviving[i];
    }

    // Fill top rows with spawn bonuses.
    const spawnCount = rows - surviving.length;
    const colSpawns = spawnBonuses[c] ?? [];
    for (let i = 0; i < spawnCount; i++) {
      newMask[i][c] = colSpawns[i] ?? false;
    }
  }

  return newMask;
}

// ── initGame ─────────────────────────────────────────────────────────────────

/**
 * Produces the initial SGState for a new or restarted session.
 * Called once at mount and once per Play Again with a fresh PRNG.
 * Not a reducer — lives outside so it can access prng directly.
 */
function initGame(
  profile: ReturnType<typeof getProfile>,
  prng: () => number,
): SGState {
  const spawnedTiles = spawnBoard(ROWS, COLS, profile, prng);
  const grid = gridFromSpawn(ROWS, COLS, spawnedTiles);
  // Build the initial bonus mask from the spawn result.
  const bonusMask: boolean[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => spawnedTiles[r * COLS + c].isBonus),
  );
  const target = generateTarget(grid, ROWS, COLS, 'sum', profile, prng);

  return {
    phase: 'WAITING_TO_START',
    grid,
    bonusMask,
    chain: emptyChain(),
    target,
    mode: 'sum',
    timer: createTimer(ROUND_DURATION_SECS, 'countdown'),
    score: createScoreState(),
    chainsCompleted: 0,
    bonusesCollected: 0,
    wrongFlash: false,
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function sgReducer(state: SGState, action: SGAction): SGState {
  switch (action.type) {
    // ── Chain events ──────────────────────────────────────────────────────────

    case 'CHAIN_START': {
      // First gesture while waiting: start the timer simultaneously.
      if (state.phase === 'WAITING_TO_START') {
        return {
          ...state,
          phase: 'PLAYING',
          timer: startTimer(state.timer),
          chain: startChain(action.pos),
        };
      }
      if (state.phase === 'PLAYING') {
        return { ...state, chain: startChain(action.pos) };
      }
      return state;
    }

    case 'CHAIN_EXTEND': {
      if (state.phase !== 'PLAYING' && state.phase !== 'WAITING_TO_START')
        return state;
      if (!state.chain.isActive) return state;
      const newChain = tryExtend(state.chain, action.pos);
      // Bail early if chain didn't change (pointer still over same tile).
      if (newChain === state.chain) return state;
      return { ...state, chain: newChain };
    }

    case 'CHAIN_COMMIT': {
      if (state.phase !== 'PLAYING') return state;

      // Mark chain as inactive — positions remain for evaluation.
      const committed = commitChain(state.chain);

      // Too short — silently cancel.
      if (!isChainReadyToEvaluate(committed, CHAIN_MIN_LENGTH)) {
        return { ...state, chain: emptyChain() };
      }

      const positions = committed.positions;
      const values = positions.map((p) => state.grid[p.row][p.col]);

      // Wrong answer.
      if (!chainMatchesTarget(values, state.target, state.mode)) {
        return {
          ...state,
          chain: emptyChain(),
          score: resetCombo(state.score),
          wrongFlash: true,
        };
      }

      // Valid chain ─────────────────────────────────────────────────────────

      const bonusCount = positions.filter(
        (p) => state.bonusMask[p.row][p.col],
      ).length;

      const basePoints = evaluate(values, state.mode);
      const points = calculatePoints(basePoints, state.score.comboCount);
      const newScore = recordMatch(state.score, points);

      // Award bonus time for each bonus tile in the chain.
      let newTimer = state.timer;
      if (bonusCount > 0) {
        newTimer = addTime(newTimer, BONUS_TIME_SECS * bonusCount);
      }

      // Zero out cleared positions in grid and bonus mask so the CLEARING
      // effect can call applyGravity() directly on the already-cleared grid.
      const cleared = new Set(positions.map((p) => `${p.row},${p.col}`));
      const newGrid = state.grid.map((row, ri) =>
        row.map((v, ci) => (cleared.has(`${ri},${ci}`) ? 0 : v)),
      );
      const newBonusMask = state.bonusMask.map((row, ri) =>
        row.map((v, ci) => (cleared.has(`${ri},${ci}`) ? false : v)),
      );

      return {
        ...state,
        phase: 'CLEARING',
        grid: newGrid,
        bonusMask: newBonusMask,
        chain: emptyChain(),
        score: newScore,
        timer: newTimer,
        chainsCompleted: state.chainsCompleted + 1,
        bonusesCollected: state.bonusesCollected + bonusCount,
      };
    }

    // ── Timer ─────────────────────────────────────────────────────────────────

    case 'TICK': {
      if (state.phase !== 'PLAYING') return state;
      const newTimer = tick(state.timer);
      if (isExpired(newTimer)) {
        return {
          ...state,
          timer: newTimer,
          phase: 'GAME_OVER',
          chain: emptyChain(),
        };
      }
      return { ...state, timer: newTimer };
    }

    // ── Gravity resolved ──────────────────────────────────────────────────────

    case 'GRAVITY_DONE': {
      if (state.phase !== 'CLEARING') return state;
      return {
        ...state,
        phase: 'PLAYING',
        grid: action.grid,
        bonusMask: action.bonusMask,
        target: action.target,
      };
    }

    // ── UI feedback ───────────────────────────────────────────────────────────

    case 'CLEAR_WRONG_FLASH': {
      return { ...state, wrongFlash: false };
    }

    // ── Restart ───────────────────────────────────────────────────────────────

    case 'PLAY_AGAIN': {
      return action.newState;
    }

    default:
      return state;
  }
}

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
