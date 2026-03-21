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
} from './sgReducer';
import { applyBonusMaskGravity } from '../../systems/BonusMaskSystem';

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

// ── Telemetry types (module-level) ────────────────────────────────────────────
interface TelemetryEntry { type: string; ms: number }
interface PhaseEntry { from: SGState['phase']; to: SGState['phase']; ms: number }
interface TelemetryLog {
  actions: TelemetryEntry[];
  phases: PhaseEntry[];
  gravityEvents: number;
  spawnEvents: number;
  timerStartOrigin: string;
}
type FrozenSnap = TelemetryLog & { sgState: SGState };

// ── Component ─────────────────────────────────────────────────────────────────

interface SpeedGridGameProps {
  onBack: () => void;
}

export default function SpeedGridGame({ onBack }: SpeedGridGameProps) {
  // ── PRNG and profile ───────────────────────────────────────────────────────

  const profile = useMemo(() => getProfile(DEFAULT_PROFILE_ID), []);
  const prngRef = useRef(makePrng(randomSeed()));

  // ── Reducer ────────────────────────────────────────────────────────────────

  const [state, rawDispatch] = useReducer(
    sgReducer,
    undefined,
    () => initGame(profile, prngRef.current),
  );

  // stateRef mirrors state so effects can read the latest values without
  // listing every field as a dependency.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Telemetry tracking (refs — zero cost when overlay is hidden) ───────────

  const telemetryRef = useRef<TelemetryLog>({
    actions: [],
    phases: [],
    gravityEvents: 0,
    spawnEvents: 0,
    timerStartOrigin: 'none',
  });

  // ── wrongFlash race fix ────────────────────────────────────────────────────
  // The wrongFlash timer effect must restart its 600 ms window on *every*
  // CHAIN_COMMIT that produces a wrong answer — even when wrongFlash is already
  // true from a previous wrong answer.  If the effect depends only on
  // `state.wrongFlash` (a boolean), a second wrong answer within 600 ms does
  // not change the boolean, so the effect never re-fires and the old timer
  // fires prematurely.
  //
  // Fix: maintain a chainCommitSeq counter that increments on every
  // CHAIN_COMMIT dispatch (correct or wrong — we can't know the result here).
  // The wrongFlash timer effect depends on chainCommitSeq, so it re-fires and
  // resets its 600 ms window on every commit.  The `if (!state.wrongFlash)`
  // guard inside the effect discards no-op calls on correct commits.
  //
  // React 18 automatic batching merges rawDispatch + setChainCommitSeq into a
  // single re-render — no extra paint.
  const [chainCommitSeq, setChainCommitSeq] = useState(0);

  // BONUSMASK EVOLUTION STAGE-2
  // Captures the committed chain positions immediately before CHAIN_COMMIT
  // is dispatched. The CLEARING effect reads this ref to pass explicit
  // clearedPositions to applyBonusMaskGravity.
  //
  // Cannot read positions from the CLEARING effect's closure-captured `state`:
  // sgReducer sets chain → emptyChain() during CHAIN_COMMIT, so
  // state.chain.positions is [] by the time the CLEARING phase is observed.
  // This ref is set synchronously before rawDispatch, so it always contains
  // the pre-commit positions when the subsequent CLEARING effect fires.
  //
  // [Phase-8 Task-10] Explicit-only. Zero-inference permanently removed.
  const lastClearedPositionsRef = useRef<
    ReadonlyArray<{ row: number; col: number }>
  >([]);

  // Telemetry-aware dispatch wrapper. Wraps rawDispatch so all dispatch
  // call sites are unchanged while logging every action to telemetryRef.
  const dispatch = useCallback((action: SGAction) => {
    const log = telemetryRef.current;
    log.actions.push({ type: action.type, ms: Date.now() % 100000 });
    if (log.actions.length > 30) log.actions.shift();
    if (
      action.type === 'CHAIN_START' &&
      stateRef.current.phase === 'WAITING_TO_START'
    ) {
      log.timerStartOrigin = `CHAIN_START in WAITING_TO_START`;
    }
    if (action.type === 'CHAIN_COMMIT') {
      setChainCommitSeq((s) => s + 1);
      // BONUSMASK EVOLUTION STAGE-2: capture pre-commit chain positions.
      // stateRef.current is the last-rendered state (pre-commit). Chain is
      // still active here; the reducer will clear it during processing.
      // These positions become the authoritative clearedPositions for the
      // CLEARING effect that follows a valid commit.
      lastClearedPositionsRef.current = stateRef.current.chain.positions;
    }
    rawDispatch(action);
  }, [rawDispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase transition tracker — runs after every render, O(1) work.
  const prevPhaseRef = useRef<SGState['phase']>(state.phase);
  useEffect(() => {
    if (state.phase !== prevPhaseRef.current) {
      const log = telemetryRef.current;
      log.phases.push({ from: prevPhaseRef.current, to: state.phase, ms: Date.now() % 100000 });
      if (log.phases.length > 10) log.phases.shift();
      prevPhaseRef.current = state.phase;
    }
  });

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

    // Capture grid, mask, and mode directly from the effect closure — NOT from
    // stateRef.current.  `state` here is the value captured at the render that
    // scheduled this effect (the render that produced phase === 'CLEARING').
    // stateRef.current is updated on every render; if React batches a second
    // render before this effect runs (possible under concurrent mode), reading
    // stateRef.current would silently use a later state object, breaking the
    // "gravity runs on exactly the post-commit board" invariant.
    const clearGrid = state.grid;      // has 0s at cleared positions — commit-time snapshot
    const clearMask = state.bonusMask; // has false at cleared positions — commit-time snapshot
    const clearMode = state.mode;

    // Cache each SpawnedTile by (col, spawnIndex) so both spawnValue and
    // spawnBonus callbacks draw from the same spawnTile() call — one PRNG
    // token per tile, unchanged from before.
    const spawnCache: { value: number; isBonus: boolean }[][] =
      Array.from({ length: COLS }, () => []);

    // Apply gravity. spawnBonus is a pure cache lookup — no extra PRNG calls.
    const gravResult = applyGravity(
      clearGrid,
      ROWS,
      COLS,
      (col, spawnIndex) => {
        const sp = spawnTile(profile, prngRef.current);
        spawnCache[col][spawnIndex] = sp;
        return sp.value;
      },
      (col, spawnIndex) => spawnCache[col][spawnIndex].isBonus,
    );

    // Telemetry: count gravity event + tiles spawned this cycle.
    telemetryRef.current.gravityEvents += 1;
    telemetryRef.current.spawnEvents += gravResult.spawnBonusMap.reduce(
      (sum, col) => sum + col.length,
      0,
    );

    // [EXPLICIT SURVIVOR LAW — FROZEN, Phase-8 Task-10]
    // Survivor semantics are explicit-only. clearedPositions is authoritative.
    // Replay derives clearedPositions from the commit snapshot (chain.positions
    // captured before CHAIN_COMMIT). Zero-inference has been permanently removed.
    //
    // Source: lastClearedPositionsRef.current — captured from
    // stateRef.current.chain.positions immediately before CHAIN_COMMIT
    // dispatched (see dispatch wrapper above).  This is the authoritative
    // CLEARING snapshot: positions taken after commit but before gravity,
    // satisfying ClearedPositionsLaw and GravitySnapshotBoundaryLaw.
    const newBonusMask = applyBonusMaskGravity(
      clearMask,
      clearGrid,
      gravResult.spawnBonusMap,
      ROWS,
      COLS,
      lastClearedPositionsRef.current,
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
  // Depends on chainCommitSeq (not state.wrongFlash) so the 600 ms window
  // resets on every CHAIN_COMMIT — even when wrongFlash is already true.
  // The guard `if (!state.wrongFlash) return` discards no-op calls for
  // correct commits (where wrongFlash is false).
  // The effect's cleanup (return () => clearTimeout) runs when chainCommitSeq
  // changes, cancelling the old timer before the new one starts.

  useEffect(() => {
    if (!state.wrongFlash) return;
    const id = setTimeout(() => {
      dispatch({ type: 'CLEAR_WRONG_FLASH' });
    }, 600);
    return () => clearTimeout(id);
  }, [chainCommitSeq]); // eslint-disable-line react-hooks/exhaustive-deps
  // [NOTE] state.wrongFlash is read inside the effect; chainCommitSeq is the
  // trigger. dispatch is stable (useCallback). Omitting both from deps is safe.

  // ── Telemetry overlay controls ──────────────────────────────────────────────

  const [showTelemetry, setShowTelemetry] = useState(false);
  const [frozen, setFrozen] = useState<FrozenSnap | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Ctrl+Shift+D — toggle overlay visibility
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowTelemetry((v) => !v);
      }
      // Ctrl+Shift+F — freeze / thaw snapshot
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setFrozen((prev) =>
          prev
            ? null
            : {
                ...telemetryRef.current,
                actions: [...telemetryRef.current.actions],
                phases: [...telemetryRef.current.phases],
                sgState: stateRef.current,
              },
        );
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
      {showTelemetry && (() => {
        // When frozen, display snapshot; otherwise display live data.
        const ds = frozen?.sgState ?? state;
        const dl = frozen ?? telemetryRef.current;
        const hasSolution = boardHasTwoTileSolution(ds.grid, ds.target, ROWS, COLS);
        return (
          <div
            style={{
              position: 'absolute',
              top: HUD_TOP_H + 4,
              right: 8,
              background: 'rgba(0,0,0,0.88)',
              color: '#a3e635',
              fontSize: 11,
              fontFamily: 'monospace',
              padding: '8px 10px',
              borderRadius: 6,
              lineHeight: 1.55,
              pointerEvents: 'none',
              zIndex: 999,
              minWidth: 210,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#facc15', fontWeight: 700 }}>◈ SpeedGrid Telemetry</span>
              {frozen && (
                <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 10 }}>⊘ FROZEN</span>
              )}
            </div>

            {/* ── Reducer phase ─────────────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginBottom: 1 }}>REDUCER PHASE</div>
            <div>phase: <b style={{ color: '#facc15' }}>{ds.phase}</b></div>

            {/* ── Timer ─────────────────────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 4, marginBottom: 1 }}>TIMER</div>
            <div>
              remaining: <b>{ds.timer.remainingSeconds.toFixed(1)}s</b>
              {' '}({(countdownProgress(ds.timer) * 100).toFixed(0)}%)
            </div>
            <div>running: <b>{ds.timer.isRunning ? 'yes' : 'no'}</b></div>
            <div style={{ fontSize: 9, color: '#64748b' }}>
              origin: {dl.timerStartOrigin}
            </div>

            {/* ── Target + solvability ──────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 4, marginBottom: 1 }}>TARGET</div>
            <div>
              target: <b>{ds.target}</b>{'  '}
              2-tile:{' '}
              <b style={{ color: hasSolution ? '#a3e635' : '#ef4444' }}>
                {hasSolution ? 'YES' : 'NO'}
              </b>
            </div>

            {/* ── Score + combo ─────────────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 4, marginBottom: 1 }}>SCORING</div>
            <div>score: <b>{ds.score.score}</b>{'  '}combo: <b>{ds.score.comboCount}</b></div>
            <div>chains: <b>{ds.chainsCompleted}</b>{'  '}bonuses: <b>{ds.bonusesCollected}</b></div>

            {/* ── Active chain ──────────────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 4, marginBottom: 1 }}>CHAIN</div>
            <div>
              len: <b>{ds.chain.positions.length}</b>
              {'  '}{ds.chain.isActive ? '(active)' : '(idle)'}
            </div>

            {/* ── BonusMask live map ────────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 4, marginBottom: 2 }}>
              BONUS MASK ({ds.bonusMask.flat().filter(Boolean).length} active)
            </div>
            <div
              style={{
                display: 'inline-grid',
                gridTemplateColumns: `repeat(${COLS}, 10px)`,
                gap: 2,
              }}
            >
              {ds.bonusMask.flat().map((v, i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: v ? '#f97316' : '#1e293b',
                    border: '1px solid #334155',
                  }}
                />
              ))}
            </div>

            {/* ── Gravity / spawn events ────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 4, marginBottom: 1 }}>ENGINE EVENTS</div>
            <div>gravity: <b>{dl.gravityEvents}</b>{'  '}spawns: <b>{dl.spawnEvents}</b></div>

            {/* ── Phase transition log ──────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 4, marginBottom: 1 }}>
              PHASE LOG (last {dl.phases.length})
            </div>
            {dl.phases.length === 0 && (
              <div style={{ color: '#475569', fontSize: 9 }}>no transitions yet</div>
            )}
            {dl.phases.slice(-5).map((p, i) => (
              <div key={i} style={{ fontSize: 9, color: '#94a3b8' }}>
                {String(p.ms).padStart(5)} {p.from.slice(0, 4)}→{p.to.slice(0, 4)}
              </div>
            ))}

            {/* ── Reducer dispatch log ──────────────────────── */}
            <div style={{ color: '#64748b', fontSize: 9, marginTop: 4, marginBottom: 1 }}>
              DISPATCH LOG (last {Math.min(dl.actions.length, 8)})
            </div>
            {dl.actions.length === 0 && (
              <div style={{ color: '#475569', fontSize: 9 }}>no actions yet</div>
            )}
            {dl.actions.slice(-8).map((a, i) => (
              <div key={i} style={{ fontSize: 9, color: '#64748b' }}>
                {String(a.ms).padStart(5)} {a.type}
              </div>
            ))}

            {/* ── Footer ───────────────────────────────────── */}
            <div style={{ color: '#334155', marginTop: 6, fontSize: 9 }}>
              Ctrl+Shift+D hide{'  '}|{'  '}Ctrl+Shift+F {frozen ? 'thaw' : 'freeze'}
            </div>
          </div>
        );
      })()}

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
