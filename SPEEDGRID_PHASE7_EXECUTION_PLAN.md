# SPEEDGRID PHASE 7 — EXECUTION PLAN

**Status:** Plan Only — No Code Written
**Branch:** `claude/audit-codebase-architecture-75LTi`
**Date:** 2026-03-12
**Depends on:** COMBINEGRID_CANONICAL_REFERENCE.md (Phase 6.5 lock)

---

## A. CONFIRMED REPOSITORY CONTEXT

### Current Branch
`claude/audit-codebase-architecture-75LTi`

### Closed Phases
| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Engine primitives (GridEngine, SpawnEngine, RNG, EngineSession) | Closed |
| 2 | Systems layer (GravitySystem, GravityAnimator, ScoreSystem, TimerSystem, ChainSelector) | Closed |
| 3 | Platform UI (HUDShell, ToastContext, tileStyles, animTokens, GameControlsLayer) | Closed |
| 4 | Grid layer stubs (GridBoard, GridTile, GridSizing, GridInputController) | Closed |
| 5 | Engine contract (GridGameRules.ts) | Closed |
| 6 | CombineGrid reconstruction | Closed |
| 6.5 | CombineGrid stabilization lock | **Closed — canonical reference locked** |

### Locked CombineGrid Reference Status
`COMBINEGRID_CANONICAL_REFERENCE.md` is the locked source of truth as of Phase 6.5.
- CombineGrid is **fully self-contained** inside `src/games/combine-grid/`
- Zero imports from `src/engine/`, `src/systems/`, `src/platform/ui/`
- State machine, scoring formula, coordinate convention, board type: all locked
- **Must not be modified during Phase 7 for any reason**

### Current SpeedGrid Status
`GameSelector.tsx` renders `PhasePlaceholder` for `game === "speed-grid"`.
No files exist under `src/games/speed-grid/`.

---

## B. PROPOSED SPEEDGRID FILE TREE

### Files to Create

```
src/games/speed-grid/
├── SpeedGridGame.tsx          ← Root component + reducer + effects
├── types.ts                   ← SGState, SGPhase, SGAction, SGTile (number alias)
├── constants.ts               ← ROWS, COLS, CHAIN_MIN_LENGTH, TIMER_WARNING_SECS
├── uiTokens.ts                ← SAFE_MARGIN, HUD_TOP_H, HUD_BOT_H, GAP, tile color config
└── components/
    ├── Board.tsx              ← Grid layout; owns pointer capture for chain gesture
    ├── SpeedTile.tsx          ← Single tile: chain-index badge, bonus glow, fall anim
    └── ResultScreen.tsx       ← Final score screen (mirrors CombineGrid pattern)
```

**Total: 8 new files.** All inside `src/games/speed-grid/`.

### Files to Modify

```
src/platform/GameSelector.tsx  ← Replace PhasePlaceholder with <SpeedGridGame onBack=…/>
                                  Add import for SpeedGridGame.
                                  Remove the commented Phase 7 import lines.
```

**Total: 1 file modified.** Two-line change only (import + conditional render swap).

### Files That Must NOT Be Created

The following are explicitly prohibited — the engine/systems layer already provides them:

| Prohibited file | Reason |
|----------------|--------|
| `src/games/speed-grid/services/GravityService.ts` | `src/systems/GravitySystem.ts` + `GravityAnimator.ts` cover this |
| `src/games/speed-grid/services/TargetGenerator.ts` | `src/engine/TargetGenerator.ts` covers this; stub forbidden by prior contract |
| `src/games/speed-grid/services/ScoreService.ts` | `src/systems/ScoreSystem.ts` covers this |
| `src/games/speed-grid/services/TimerService.ts` | `src/systems/TimerSystem.ts` covers this |
| `src/games/speed-grid/services/ChainService.ts` | `src/systems/ChainSelector.ts` covers this |
| Anything in `src/engine/` | Engine is closed — no new modules |
| Anything in `src/systems/` | Systems layer is closed — no new modules |
| Anything in `src/platform/ui/` | Platform UI is closed — no new modules |
| Anything in `src/grid/` | Grid layer stubs are closed — no new modules |

### Engine and System Imports SpeedGrid WILL Use

These are available, stable, and the correct import path for each concern:

| Concern | Import path |
|---------|------------|
| Grid operations | `src/engine/GridEngine.ts` via `src/engine/public.ts` |
| Tile spawning | `src/engine/SpawnEngine.ts` via `src/engine/public.ts` |
| PRNG | `src/engine/rng.ts` via `src/engine/public.ts` |
| Practice profiles | `src/engine/PracticeProfile.ts` via `src/engine/public.ts` |
| Target generation | `src/engine/TargetGenerator.ts` via `src/engine/public.ts` |
| Session tracking | `src/engine/EngineSession.ts` via `src/engine/public.ts` |
| Gravity + metadata | `src/systems/GravitySystem.ts` |
| Gravity animation frames | `src/systems/GravityAnimator.ts` |
| Score + combo | `src/systems/ScoreSystem.ts` |
| Countdown timer | `src/systems/TimerSystem.ts` |
| Chain selection | `src/systems/ChainSelector.ts` |
| HUD chrome | `src/platform/ui/HUDShell.tsx` |
| Tile visual tokens | `src/platform/ui/tileStyles.ts` |
| Animation timing | `src/platform/ui/animTokens.ts` |
| Controls strip | `src/platform/controls/GameControlsLayer.tsx` |

---

## C. EXPECTED BEHAVIORAL MODEL

### Game Loop

SpeedGrid is a **single-session countdown game**, not a round-based game. There are no rounds. The player has one continuous countdown timer. When it expires, the session is over. This is the primary structural difference from CombineGrid.

```
IDLE (mount)
  │
  ▼
WAITING_TO_START
  │ (tap anywhere / first chain)
  ▼
PLAYING ◄──────────────────────────────┐
  │ chain committed → valid match       │
  ├──────────────────────────────────── │
  │   clearAndGravity()                 │
  │   generateTarget()                  │
  │   addTime() if bonus tiles cleared  │
  │   recordMatch() / combo++           │
  └──────────────────────────────────── ┘
  │ chain committed → invalid
  │   resetCombo()
  │   flash "Wrong"
  │
  │ timer expires (isExpired())
  ▼
GAME_OVER
  │
  ▼
ResultScreen → onBack → GameSelector(splash)
```

### Timer Flow

1. On mount: `createTimer(ROUND_DURATION_SECS, 'countdown')` — does NOT start yet.
2. On first valid gesture (or explicit "start" tap): `startTimer(state.timer)`.
3. `setInterval` fires every 1 000 ms while `phase === PLAYING`.
4. Each tick: `tick(state.timer)` → check `isExpired()`.
5. Check `isInWarningZone(state.timer, TIMER_WARNING_SECS)` → drive red color on progress bar.
6. `countdownProgress(state.timer)` drives the timer bar width (0.0–1.0).
7. When `isExpired()` → dispatch `TIMER_EXPIRED` → phase transitions to `GAME_OVER`.
8. On bonus tile cleared: `addTime(state.timer, BONUS_TIME_SECS)`.

**TimerSystem functions used:** `createTimer`, `startTimer`, `tick`, `isExpired`, `isInWarningZone`, `countdownProgress`, `addTime`.

### Selection Flow (Chain — drag gesture)

SpeedGrid selection is a **continuous pointer-drag chain** — not discrete taps.

```
pointer-down on tile (row, col)
  → startChain({row, col})
  → phase enters CHAINING sub-state

pointer-move enters new tile (row, col)
  → tryExtend(chain, {row, col}, isChebyshevAdjacent)
    ├── backtracks if pointer returns to second-to-last tile
    ├── rejects if not adjacent
    └── appends if new and adjacent
  → re-evaluate sum in real-time for live feedback display

pointer-up (anywhere)
  → commitChain(chain)
  → isChainReadyToEvaluate(chain, CHAIN_MIN_LENGTH)?
      YES → dispatch CHAIN_COMMITTED with positions
      NO  → dispatch CHAIN_CANCELLED
  → clearChain() after evaluation
```

**ChainSelector functions used:** `emptyChain`, `startChain`, `tryExtend`, `commitChain`, `clearChain`, `isInChain`, `chainIndexOf`, `isChainReadyToEvaluate`.

**Key difference from CombineGrid:** Adjacency is **required** here. The engine's `TargetGenerator.generateTarget()` also requires adjacency, so targets will always be reachable via a valid chain path. This is a design invariant that must be maintained.

**ChainPos type:** `{ row: number; col: number }` — matches `ChainSelector.ts` and the engine's coordinate convention. **This is different from CombineGrid's `{ r, c }`.**

### Chain Evaluation Flow

```
CHAIN_COMMITTED received (positions: ChainPos[])
  │
  ├── values = positions.map(p => grid[p.row][p.col])
  ├── chainMatchesTarget(values, state.target, state.mode) ?
  │     TRUE:
  │       basePoints = evaluate(values, state.mode)
  │       points = calculatePoints(basePoints, score.comboCount)
  │       score  = recordMatch(score, points)
  │       bonus tiles in selection? → addTime(timer, BONUS_TIME_SECS * bonusCount)
  │       clear positions → clearAndGravity()
  │       generateTarget(newGrid, rows, cols, mode, profile, prng)
  │       phase → CLEARING (await gravity anim) → PLAYING
  │     FALSE:
  │       score = resetCombo(score)
  │       flash "Wrong" feedback
  │       clearChain()
```

**TargetGenerator functions used:** `generateTarget`, `evaluate`, `chainMatchesTarget`.
**ScoreSystem functions used:** `calculatePoints`, `recordMatch`, `resetCombo`, `comboMultiplier`, `nextMultiplier`.

### Scoring Flow

SpeedGrid uses `ScoreSystem.ts` in full — including combo multiplier. This is an intentional behavioral difference from CombineGrid:

| | CombineGrid | SpeedGrid |
|-|------------|----------|
| Base points | Sum of selected tile values | Sum (or product) of chain values |
| Combo multiplier | None (flat 1×) | Yes — `comboMultiplier(comboCount)` |
| Combo reset | Not applicable | On wrong chain — `resetCombo()` |
| Score display | Integer score | Integer score + current multiplier badge |

### Game-Over Flow

```
isExpired(timer) === true
  └── dispatch TIMER_EXPIRED
        │
        ├── phase = GAME_OVER
        ├── clearInterval (tick)
        └── render ResultScreen:
              totalScore, bonusesCollected, chainsCompleted
              [Play Again] → dispatch PLAY_AGAIN → initGame()
              [Back]       → onBack() → GameSelector splash
```

### Restart Flow

```
dispatch PLAY_AGAIN
  → initGame():
      board  = gridFromSpawn(ROWS, COLS, spawnBoard(ROWS, COLS, profile, prng))
      timer  = createTimer(ROUND_DURATION_SECS)   ← NOT started yet
      score  = createScoreState()
      target = generateTarget(board, ROWS, COLS, mode, profile, prng)
      phase  = WAITING_TO_START
```

The session PRNG must be re-seeded on restart so boards are different each session. Use `makePrng(randomSeed())`.

### Back-to-Splash Flow

```
Any phase → user taps Back (HUDTopBar left slot)
  → clearInterval / clearTimeout (all active timers)
  → onBack() is called
  → GameSelector sets game = "splash"
  → SpeedGridGame is unmounted (useEffect cleanup fires)
  → CombineGrid and SpeedGrid share no state — unmount is clean
```

---

## D. COMPARISON AGAINST COMBINEGRID

### What Must Stay Shared at the Platform Level

These are platform invariants. SpeedGrid must conform to them exactly:

| Item | Platform invariant | Why |
|------|-------------------|-----|
| `HUD_TOP_H` | 54 px | Matches `HUDShell.tsx` and CombineGrid's `uiTokens.ts`. SpeedGrid's own `uiTokens.ts` must use the same value. |
| `ToastProvider` | Must be a descendant | SpeedGrid may call `useToast()` for error messages. Provider lives in `main.tsx` — no action needed. |
| Game mount/unmount boundary | `GameSelector` mounts one game at a time | SpeedGrid must clean up all intervals/timeouts in `useEffect` return functions. |
| Background color | `#141416` | Shared visual language across both games. |
| `onBack: () => void` prop | Required on root component | `GameSelector` passes this. SpeedGrid must accept it identically. |
| No shared mutable state | Games must be fully self-contained | SpeedGrid state lives exclusively inside `SpeedGridGame.tsx` reducer. |

### What Must Stay Game-Specific

These must NOT be unified or shared during Phase 7:

| Item | CombineGrid | SpeedGrid | Why not unified |
|------|------------|----------|----------------|
| Board type | `Tile[][]` (object with id/kind/val) | `number[][]` (value only) | Different rendering models; forced unification risks breaking CG |
| Coordinate type | `GridPos = { r, c }` | `ChainPos = { row, col }` | Accepted divergence (RISK-1 in canonical ref) |
| Gravity implementation | `GridService.applyGravity()` (own) | `GravitySystem.clearAndGravity()` (platform) | CG gravity is locked; premature unification is prohibited |
| Selection model | Tap-pair accumulation | Pointer-drag chain | Fundamentally different interaction; no shared abstraction |
| Target generation | `GridService.generateTarget()` (random, no adjacency) | `TargetGenerator.generateTarget()` (adjacency walk, profile-aware) | Different algorithms; different gameplay contracts |
| Scoring | Flat sum, no combo | Full `ScoreSystem` with combo | Intentional gameplay difference |
| Timer | Inline `timeLeft` integer | `TimerSystem.TimerState` | CG timer is locked; SG uses system layer |
| Session structure | 5 rounds, 30 s each | Single countdown, 60 s | Core game structure difference |
| HUD chrome | Inline `div` layout | `HUDShell` components | CG does not use HUDShell; adding it to CG would break the lock |
| Tile visual tokens | Inline styles | `tileStyles.ts` tokens | CG removed tileStyles in Phase 6 correction; SG uses them intentionally |
| `uiTokens.ts` | `src/games/combine-grid/uiTokens.ts` | `src/games/speed-grid/uiTokens.ts` | Each game owns its own layout tokens privately |
| `ResultScreen.tsx` | Locked in CG | New in SG | Not shared — different data shown |

### What Must Not Be Forcibly Unified Yet

The following are tempting unification targets but must be deferred past Phase 7:

1. **`GridPos` / `ChainPos` naming** — Two different coordinate shapes will coexist. A future convergence phase may migrate CombineGrid to `{ row, col }`. Not during Phase 7.
2. **`GridBoard.tsx` adoption** — Both games' `Board.tsx` files are frozen during Phases 1–8 per contract §4. SpeedGrid writes its own `Board.tsx` and does not import `GridBoard`.
3. **`GridTile.tsx` adoption** — Same restriction. SpeedGrid writes its own `SpeedTile.tsx`.
4. **`GridGameRules` wiring** — Neither game implements this interface yet. Not during Phase 7.
5. **Shared `ResultScreen`** — Different data, different visual intent. Do not extract a shared component yet.

---

## E. PLATFORM RISK ANALYSIS

### RISK-1 — `GridPos` / Coordinate Shape Mismatch (HIGH — Accepted)

**CombineGrid:** `GridPos = { r: number; c: number }` (own `types.ts`)
**SpeedGrid:** will use `ChainPos = { row: number; col: number }` (from `ChainSelector.ts`)
**Engine/Systems layer:** uses `{ row: number; col: number }` throughout

**Risk level in Phase 7:** LOW (controlled). SpeedGrid will use `row`/`col` natively because its chain system is `ChainSelector.ts` which already uses that shape. There is no cross-game sharing of position types, so no collision occurs at runtime. The naming divergence is entirely contained within each game boundary.

**Action required:** None. Document the divergence in Phase 7 completion notes. Do not attempt to rename CombineGrid's `{r, c}` during this phase.

**Stop condition trigger:** If any code path during Phase 7 requires passing a `ChainPos` to a CombineGrid function, or vice versa — STOP. This would indicate an unintended coupling that must be resolved architecturally first.

---

### RISK-2 — Gravity Duplication (MEDIUM — Managed)

**CombineGrid:** uses `GridService.applyGravity(board: Tile[][], cleared: GridPos[])` — own implementation, locked.
**SpeedGrid:** will use `GravitySystem.clearAndGravity(grid: number[][], ...)` → delegates to `GridEngine.applyGravity()`.

These operate on different board types (`Tile[][]` vs `number[][]`) so they cannot be accidentally confused. No deduplication is possible or desirable at this phase.

**Risk:** If a gravity bug is found in one, the other will not automatically receive the fix. This is accepted technical debt, documented in the canonical reference (RISK-2).

**Action required:** None for Phase 7. SpeedGrid uses the platform gravity stack; CombineGrid uses its own. The implementations will diverge over time — this is intentional.

---

### RISK-3 — Scoring Duplication (LOW — Asymmetric by Design)

**CombineGrid:** flat `score += sum_of_selected_vals`. No `ScoreSystem` involvement.
**SpeedGrid:** `ScoreSystem.calculatePoints()` + `recordMatch()` + `resetCombo()`. Full combo system.

These are not duplicates — they are intentionally different scoring philosophies. There is no code duplication because CombineGrid does not use `ScoreSystem` at all.

**Risk:** Future pressure to "add combos to CombineGrid" using the same `ScoreSystem`. This must not happen in Phase 7 — it would require unlocking the CombineGrid canonical reference.

**Action required:** None.

---

### RISK-4 — Timer Duplication (LOW — Asymmetric by Design)

**CombineGrid:** `timeLeft: number` decremented in reducer. Locked.
**SpeedGrid:** `TimerSystem.TimerState` managed via pure state transitions. Active architecture.

These are not runtime conflicts — each game owns its own timer state. CombineGrid's timer is simpler and locked; SpeedGrid's uses the full system.

**Risk:** None at Phase 7. Future risk: if CombineGrid ever needs `addTime()` (time-bonus tiles), it will need to either adopt `TimerSystem` or re-implement `addTime()` inline — and the two will diverge.

**Action required:** None for Phase 7.

---

### RISK-5 — UI Drift (LOW — Structurally Isolated)

**CombineGrid HUD:** hand-rolled `div` layout with inline styles. Does not use `HUDShell`.
**SpeedGrid HUD:** will use `HUDTopBar`, `HUDBottomBar`, `HUDIconBtn` from `HUDShell.tsx`.

Both must respect `HUD_TOP_H = 54 px`. SpeedGrid uses the platform component which enforces this via its own hardcoded `height: 54`. SpeedGrid's `uiTokens.ts` must also declare `HUD_TOP_H = 54` to match, even though it won't render its own version of the bar.

**Risk:** SpeedGrid's tile visual tokens (`tileStyles.ts`) produce a different visual weight than CombineGrid's inline tile styles. This is correct and acceptable — both games are visually consistent within themselves. They are not required to be pixel-identical to each other.

**Action required:** SpeedGrid's `uiTokens.ts` must declare `HUD_TOP_H = 54`. Verify this matches `HUDShell.tsx` before writing the board sizing formula.

---

### RISK-6 — Board Sizing Drift (LOW — Independent Formulas)

**CombineGrid:** `computeTileSize()` in `CombineGridGame.tsx` uses magic offsets (`-32`, `-16`) against `window.innerWidth/Height`. Locked.
**SpeedGrid:** will write its own `computeTileSize()` in `SpeedGridGame.tsx`. Should follow the canonical formula in `src/grid/GridSizing.ts`.

Both produce an integer pixel tile size. They will produce different values if the board dimensions differ (CombineGrid: 6×4; SpeedGrid: TBD — likely 5×4 or 6×4).

**Risk:** If SpeedGrid uses different ROWS/COLS than CombineGrid, the tile sizes will naturally differ. This is correct behavior, not a bug.

**Stop condition trigger:** If SpeedGrid's board sizing formula produces fractional pixels or tiles that overflow the viewport on any tested screen size — STOP and correct the formula before proceeding.

**Action required:** SpeedGrid's sizing formula must use `Math.floor` for both axes, cap at `MAX_TILE_SIZE` (96 px per `GridSizing.ts`), and account for `HUD_TOP_H` (54), its own `HUD_BOT_H`, and a `SAFE_MARGIN`. It must not copy CombineGrid's magic `(-32)` / `(-16)` offsets — those are CG-specific artifact values. Derive SpeedGrid's offsets from its own layout constants explicitly.

---

### RISK-7 — Bonus Tile State (MEDIUM — New Concept)

SpeedGrid introduces **bonus tiles** (`isBonus: boolean` from `SpawnEngine.SpawnedTile`). CombineGrid has no bonus tiles. The `SpawnEngine` already supports `isBonus` — SpeedGrid will consume it.

**Risk:** Bonus tile positions must be tracked separately from the grid value grid (`number[][]` stores only values). SpeedGrid will need a parallel `boolean[][]` bonus mask in its game state. This is the correct approach per `GridEngine.ts` documentation (comment on `gridFromSpawn`).

**Action required:** SpeedGrid's `SGState` must include a `bonusMask: boolean[][]` field. This mask must be updated by `applyGravity` pass — bonus status of falling tiles must shift with them. This is the most complex state management task in Phase 7.

**Stop condition trigger:** If there is no clean way to propagate `bonusMask` through `GravitySystem.applyGravity()` without modifying `GravitySystem.ts` — STOP and ask before proceeding. `GravitySystem` returns `fallingTiles` with `fromRow`/`toRow` metadata that should be sufficient to remap the mask without touching the system file. Verify this before writing any gravity-related code.

---

## F. STOP CONDITIONS

The following conditions require an immediate stop and a question before any code is written:

| # | Condition | Why |
|---|-----------|-----|
| S1 | Any planned SpeedGrid import requires modifying a file in `src/engine/`, `src/systems/`, or `src/platform/` (other than the one-line GameSelector wiring) | Phase boundary violation — engine/systems/platform are closed |
| S2 | SpeedGrid needs a `GridPos`-like type that is neither `ChainPos {row,col}` nor compatible with `ChainSelector.ts` | Architectural ambiguity — must clarify coordinate contract first |
| S3 | `GravitySystem.clearAndGravity()` cannot propagate `bonusMask` without internal modification | `GravitySystem` is a closed file — stop and design a workaround at the game layer |
| S4 | `TargetGenerator.generateTarget()` returns targets that are not reachable via an adjacency-valid chain on the current board | Generator contract broken — stop and verify adjacency assumptions |
| S5 | SpeedGrid's board sizing formula produces overflow at any standard viewport (375px, 390px, 414px wide, 667px–844px tall) | Layout contract failure — stop and re-derive formula |
| S6 | `GameControlsLayer` props need to change to support SpeedGrid | Platform component modification required — stop and assess scope |
| S7 | SpeedGrid requires a new HUD component not present in `HUDShell.tsx` | Platform UI modification required — stop and assess scope |
| S8 | Any SpeedGrid code path would read or write CombineGrid state, components, or constants | Cross-game coupling — must be zero |
| S9 | SpeedGrid's `ResultScreen` would need to import from CombineGrid to share a component | Stop — these are separate components in separate directories |
| S10 | The `WAITING_TO_START` phase turns out to be unnecessary and SpeedGrid should auto-start | Stop and confirm the intended UX before encoding it in the state machine |

---

## G. VERIFICATION CHECKLIST

### Build Checks
- [ ] `tsc --noEmit` passes with zero errors after all SpeedGrid files are written
- [ ] No `any` type escapes in SpeedGrid (unless pre-existing in engine layer)
- [ ] No circular imports introduced (SpeedGrid → platform → SpeedGrid)
- [ ] `GameSelector.tsx` still compiles; `CombineGridGame` import is unchanged
- [ ] All engine/system imports in SpeedGrid resolve to files that already exist

### Architecture Checks
- [ ] `src/games/speed-grid/` imports nothing from `src/games/combine-grid/`
- [ ] `src/games/combine-grid/` imports nothing from `src/games/speed-grid/`
- [ ] SpeedGrid has zero imports from `src/grid/GridBoard.tsx` or `src/grid/GridTile.tsx`
- [ ] SpeedGrid has zero imports from `src/grid/GridInputController.ts` or `src/grid/GridSizing.ts`
- [ ] SpeedGrid's `Board.tsx` owns all pointer-event handling (no shared input controller)
- [ ] SpeedGrid's `ResultScreen.tsx` is a standalone component
- [ ] `SpeedGridGame.tsx` accepts exactly `{ onBack: () => void }` — no additional props
- [ ] All `useEffect` hooks in `SpeedGridGame.tsx` have cleanup functions (clear intervals/timeouts)
- [ ] `isMounted` ref pattern (or equivalent AbortController) used for all async dispatches
- [ ] `GameSelector.tsx` modification is limited to: one new import + one conditional render swap

### Drift Checks
- [ ] SpeedGrid's `HUD_TOP_H` constant in `uiTokens.ts` equals exactly `54`
- [ ] Background color `#141416` is consistent with CombineGrid and splash screen
- [ ] SpeedGrid's `onBack` prop calls `onBack()` directly without wrapping or transforming
- [ ] SpeedGrid's `computeTileSize()` uses `Math.floor` for both axes and caps at `MAX_TILE_SIZE` (96)
- [ ] SpeedGrid does not introduce any new React context providers or global state
- [ ] `ToastProvider` is NOT duplicated inside `SpeedGridGame.tsx` (it is already in `main.tsx`)
- [ ] `ReactDOM.createRoot()` is NOT called anywhere in SpeedGrid (only in `main.tsx`)

### Fidelity Checks
- [ ] Chain adjacency uses `isChebyshevAdjacent` (8-directional) matching `ChainSelector` default
- [ ] Backtrack gesture (pointer returns to second-to-last tile) correctly shrinks the chain
- [ ] Invalid chain (wrong sum) resets combo via `resetCombo()` and clears the chain
- [ ] Valid chain clears matched tiles, triggers gravity, generates new target
- [ ] Bonus tiles in a valid chain trigger `addTime(timer, BONUS_TIME_SECS)`
- [ ] `bonusMask` shifts correctly after gravity (falling tile carries its bonus status)
- [ ] Timer bar driven by `countdownProgress()` — updates every tick
- [ ] Warning zone color change fires at `isInWarningZone(timer, TIMER_WARNING_SECS)`
- [ ] `isExpired()` triggers game-over dispatch in the same tick it becomes true
- [ ] Score display shows current combo multiplier when combo ≥ 1
- [ ] Restart via [Play Again] produces a new PRNG seed (boards differ across restarts)
- [ ] [Back] from both `ResultScreen` and in-game HUD correctly calls `onBack()`

---

---

## H. REPLAY DERIVATION RULE — ClearedPositions (Phase-8 Task-8)

**Status:** Documentation only — no replay code modified.

### Rule

> The replay engine MUST NOT record `clearedPositions` as a serialized field.
> `clearedPositions` is re-derived deterministically on replay from the reducer
> state, not replayed from a stored list.

### Derivation Algorithm

On replay of a `CHAIN_COMMIT` event, the engine derives `clearedPositions` as:

```
clearedPositions = diff(preCommitGrid, postCommitGrid)
                 = { (r, c) | preCommitGrid[r][c] !== 0
                              AND postCommitGrid[r][c] === 0 }
```

Equivalently, during live play (single-chain era):

```
clearedPositions = state.chain.positions  (at commit snapshot)
```

Both derivations are deterministic from the reducer snapshot sequence and
produce identical results. The grid-diff form is preferred for replay because
it does not depend on the chain object being present in the replay log.

### Rationale

- Recording `clearedPositions` would couple replay format to BonusMask
  evolution stage, breaking replay files across Stage-1 → Stage-3 migration.
- Re-derivation guarantees replay determinism independent of BonusMask
  evolution progress.
- In the multi-chain era, `clearedPositions` will become the union of all
  committed chains. Re-derivation from the grid diff naturally handles this
  without replay format changes.

### Invariant

If the replay-derived `clearedPositions` ever differs from the live-computed
`clearedPositions`, the replay is corrupt. The `AssertClearedPositionsIntegrity`
dev assertion in `applyBonusMaskGravity` will catch this during dev replay runs.

---

## VERDICT

**SpeedGrid is safe to restore directly now.** Every system SpeedGrid depends on is already in place and closed: `ChainSelector.ts`, `GravitySystem.ts`, `GravityAnimator.ts`, `ScoreSystem.ts`, `TimerSystem.ts`, `TargetGenerator.ts`, `SpawnEngine.ts`, `PracticeProfile.ts`, `HUDShell.tsx`, `GameControlsLayer.tsx`, and `tileStyles.ts` all exist, are documented, and are importable without modification. The platform boundary (`GameSelector.tsx`) requires only a two-line wiring change. CombineGrid's lock is not threatened by anything in this plan — the two games share no files, no state, no components, and no coordinate types. The one non-trivial implementation challenge is the `bonusMask` propagation through `GravitySystem`, but this is solvable at the game layer using the `fallingTiles` metadata that `GravitySystem` already returns, so no platform-level correction is required first. Phase 7 can begin on code immediately.
