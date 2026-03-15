# SpeedGrid Phase 7.5 — Canonical Reference

**Status**: Phase 7.5 Lock Document
**Scope**: Analysis and lock only. No code changes unless a factual error in the document requires a correction.
**Author**: Phase 7.5 audit, 2026-03-15

---

## 1. State Machine

### 1.1 Phases

```
SGPhase = 'WAITING_TO_START' | 'PLAYING' | 'CLEARING' | 'GAME_OVER'
```

| Phase | Description |
|---|---|
| `WAITING_TO_START` | Board visible, timer at full, waiting for first touch. No tick processing. |
| `PLAYING` | Timer running. Pointer input accepted. Chain may be built and committed. |
| `CLEARING` | A correct chain was committed. Gravity/refill effect is running. Timer continues to tick. |
| `GAME_OVER` | Timer expired. No input accepted. ResultScreen visible. |

### 1.2 Legal Transitions

```
WAITING_TO_START ──► PLAYING       (CHAIN_START while in WAITING_TO_START)
PLAYING          ──► CLEARING      (CHAIN_COMMIT with correct answer)
CLEARING         ──► PLAYING       (GRAVITY_DONE dispatched by effect)
PLAYING          ──► GAME_OVER     (TICK causes timer expiry)
CLEARING         ──► GAME_OVER     (TICK causes timer expiry during gravity)
GAME_OVER        ──► WAITING_TO_START  (PLAY_AGAIN replaces entire state)
```

There is no `PLAYING → WAITING_TO_START` transition mid-game. Play Again always resets to `WAITING_TO_START` with a fresh `initGame()` call.

### 1.3 Timer Transitions

- Timer is created via `createTimer(ROUND_DURATION_SECS, 'countdown')` in `initGame`.
- Timer is **not running** on entry to `WAITING_TO_START`.
- Timer starts (`startTimer`) inside the reducer on `CHAIN_START` when `phase === 'WAITING_TO_START'`.
- Every 1 second, a `useEffect` (setInterval) dispatches `TICK`.
- On `TICK`: reducer calls `tick(state.timer)`. If `isExpired(newTimer)` → phase transitions to `GAME_OVER`.
- `TICK` is processed in **both** `PLAYING` and `CLEARING`. The timer does not pause during gravity animation.
- `addTime(timer, seconds)` is called inside the reducer on a correct bonus-tile chain commit, before phase transitions to `CLEARING`. `addTime` clamps to `>= 0` and ignores product-mode (countdown only). It does **not** call `startTimer` again; the timer is already running.

### 1.4 Chain Lifecycle

```
emptyChain()              ← initial state; also after commit or wrong answer
startChain(pos)           ← CHAIN_START action
tryExtend(chain, pos)     ← CHAIN_EXTEND action (Chebyshev adjacency)
commitChain(chain)        ← CHAIN_COMMIT action (marks isActive=false, returns positions)
```

`tryExtend` rules (in priority order):
1. If `pos` equals `chain.positions[length-2]` → **backtrack**: pop the last position.
2. If `pos` is already in chain (but not second-to-last) → **ignore**.
3. If `pos` is not Chebyshev-adjacent to the last position → **ignore**.
4. Else → **extend**: push `pos`.

`isChainReadyToEvaluate(chain, CHAIN_MIN_LENGTH=2)` must be true before evaluation. Chains shorter than 2 tiles are discarded silently on `CHAIN_COMMIT`.

### 1.5 Correct-Answer Flow

Triggered inside reducer on `CHAIN_COMMIT` when:
- `isChainReadyToEvaluate(chain)` is true, AND
- `chainMatchesTarget(values, target, mode)` is true

Steps (all inside reducer, all pure):
1. Collect chain tile values from `state.grid`.
2. Count bonus tiles in chain: `bonusCount = chainPositions.filter(p => bonusMask[p.row][p.col]).length`.
3. `addTime(timer, bonusCount * BONUS_TIME_SECS)` — time reward, clamped ≥ 0.
4. `points = calculatePoints(chain.length * 10, score.comboCount)` — `ceil(base * multiplier)`, min 1.
5. `recordMatch(score, points)` — increments `score.score` and `score.comboCount`.
6. `chainsCompleted += 1`, `bonusesCollected += bonusCount`.
7. Clear chain to `emptyChain()`.
8. Phase → `CLEARING`.

The effect fires on CLEARING and handles gravity asynchronously. The reducer never clears the grid directly.

### 1.6 Wrong-Answer Flow

Triggered on `CHAIN_COMMIT` when `isChainReadyToEvaluate` is true but `chainMatchesTarget` is false:

1. `resetCombo(score)` — resets `comboCount` to 0, increments `comboResetKey`.
2. `wrongFlash = true`.
3. Chain cleared to `emptyChain()`.
4. Phase stays `PLAYING`.

A `useEffect` watching `state.wrongFlash` sets a 600ms setTimeout to dispatch `CLEAR_WRONG_FLASH`. No penalty to score or timer.

### 1.7 Game-Over Flow

1. `TICK` fires while in `PLAYING` or `CLEARING`.
2. Reducer calls `tick(timer)`. `isExpired(newTimer)` returns true.
3. Phase → `GAME_OVER`. Chain cleared. Timer left as expired (remainingSeconds = 0).
4. React renders `<ResultScreen score bonusesCollected chainsCompleted onPlayAgain onBack />`.
5. User taps Play Again → `handlePlayAgain()` in game component calls `initGame(profile, prng.current)` then dispatches `PLAY_AGAIN { newState }`.
6. Reducer replaces the entire state with `newState`. Phase becomes `WAITING_TO_START`.

---

## 2. Data Flow

### 2.1 Pointer Input → ChainSelector → Evaluation → Score/Timer Update → Clear → Gravity → Target Regeneration

```
pointerdown (Board div)
  └─► tileAt(clientX, clientY)  [hit-test using boardRef.getBoundingClientRect() + stride]
      └─► dispatch(CHAIN_START { pos })
          └─► reducer:
              if WAITING_TO_START: startTimer(timer), phase → PLAYING
              startChain(pos) → chain = { positions:[pos], isActive:true }

pointermove (captured on board div)
  └─► tileAt(clientX, clientY)
      └─► if new tile: dispatch(CHAIN_EXTEND { pos })
          └─► reducer: tryExtend(chain, pos, isChebyshevAdjacent)
              → backtrack / ignore / extend

pointerup (board div)
  └─► releasePointerCapture
      └─► dispatch(CHAIN_COMMIT)
          └─► reducer:
              commitChain(chain) → isActive=false
              isChainReadyToEvaluate(chain, 2)?
                NO  → emptyChain(), stay PLAYING
                YES → extract values from grid at chain positions
                      chainMatchesTarget(values, target, mode)?
                        WRONG → resetCombo, wrongFlash=true, emptyChain(), stay PLAYING
                        CORRECT →
                          bonusCount = count chain positions where bonusMask[row][col]
                          addTime(timer, bonusCount * BONUS_TIME_SECS)
                          points = calculatePoints(chain.length * 10, comboCount)
                          recordMatch(score, points)
                          chainsCompleted++, bonusesCollected += bonusCount
                          emptyChain()
                          phase → CLEARING

useEffect [phase === 'CLEARING']:
  └─► read stateRef.current (to avoid stale closure)
      └─► applyGravity(grid, ROWS, COLS, spawnValue)  [GravitySystem]
          → GravityApplicationResult { grid, fallingTiles, spawnedPositions, spawnCountPerCol }
      └─► spawnBonuses = spawnedPositions.map(() => prng() < bonusTileProbability)
      └─► applyBonusMaskGravity(oldMask, preGravGrid, spawnBonuses, ROWS, COLS)
          → new bonusMask (column compaction mirrors grid gravity)
      └─► buildGravityFrames(fallingTiles, spawnedPositions)  [GravityAnimator]
      └─► generateTarget(newGrid, ROWS, COLS, mode, profile, prng.current)  [engine]
      └─► setTimeout(gravityAnimTotalMs(frames)):
          dispatch(GRAVITY_DONE { grid: newGrid, bonusMask: newBonusMask, target: newTarget })

reducer handles GRAVITY_DONE:
  └─► state.grid    ← newGrid
      state.bonusMask ← newBonusMask
      state.target  ← newTarget
      phase → PLAYING
```

### 2.2 Bonus Tile Propagation Flow

```
initGame():
  spawnBoard(ROWS, COLS, profile, prng) → SpawnedTile[] { value, isBonus }
  bonusMask[row][col] = SpawnedTile.isBonus

  PLAYING: bonusMask is read-only

  CHAIN_COMMIT (correct):
    bonusCount = chain positions where bonusMask[row][col] === true
    addTime(timer, bonusCount * BONUS_TIME_SECS)
    bonusesCollected += bonusCount
    → phase CLEARING (grid not yet mutated by reducer)

  CLEARING effect:
    grid  ← clearCells(grid, chainPositions) [implicit: GravitySystem does this]
    grid  ← applyGravity (column compact + refill with spawnValue)
    spawnBonuses[i] = (prng() < profile.bonusTileProbability)  ← per spawned position
    bonusMask ← applyBonusMaskGravity(old, preGravGrid, spawnBonuses, ROWS, COLS)

  applyBonusMaskGravity algorithm:
    For each column:
      Walk top-to-bottom collecting surviving non-zero cells from preGravGrid
      For each surviving cell in column: bonusMask[newRow][col] = oldMask[oldRow][col]
      For each spawned refill position: bonusMask[row][col] = spawnBonuses[spawnIndex]
```

### 2.3 bonusMask Lifecycle

| Moment | Operation |
|---|---|
| `initGame()` | Created as `boolean[][]` from `SpawnedTile.isBonus` |
| During `PLAYING` | Read-only. Rendered by Board/SpeedTile for gold border display. |
| `CHAIN_COMMIT` correct | Read to count bonus tiles in chain. Not mutated. |
| CLEARING effect | Recomputed via `applyBonusMaskGravity`. Delivered via `GRAVITY_DONE`. |
| `GRAVITY_DONE` reducer | Replaced atomically in state. |
| `PLAY_AGAIN` | Replaced by new `initGame()` result. |

`bonusMask` never leaves the SpeedGrid game layer. No engine function receives or returns it.

---

## 3. Service and System Boundaries

### 3.1 Systems Used by SpeedGrid

| System | File | Role |
|---|---|---|
| ChainSelector | `src/systems/ChainSelector.ts` | Chain state machine: start, extend, commit, query |
| TimerSystem | `src/systems/TimerSystem.ts` | Countdown timer: create, start, tick, addTime, expire |
| ScoreSystem | `src/systems/ScoreSystem.ts` | Score + combo: calculatePoints, recordMatch, resetCombo, nextMultiplier |
| GravitySystem | `src/systems/GravitySystem.ts` | Apply gravity to grid post-clear; produce falling/spawn metadata |
| GravityAnimator | `src/systems/GravityAnimator.ts` | Compute animation frame schedule; total duration |

### 3.2 Engine APIs Used by SpeedGrid

All accessed through `src/engine/public.ts` barrel:

| API | Source Module | Usage |
|---|---|---|
| `makePrng`, `randomSeed` | `rng.ts` | PRNG creation in `initGame` |
| `spawnBoard`, `spawnTile`, `spawnColumn` | `SpawnEngine.ts` | Initial board spawn, refill spawning |
| `gridFromSpawn` | `GridEngine.ts` | Build `number[][]` from `SpawnedTile[]` |
| `generateTarget` | `TargetGenerator.ts` | Target regeneration after gravity |
| `evaluate`, `chainMatchesTarget` | `TargetGenerator.ts` | Correct-answer check in reducer |
| `getProfile`, `DEFAULT_PROFILE_ID` | `PracticeProfile.ts` | Profile access via `useMemo` |

**Engine APIs explicitly NOT used by SpeedGrid**: `EngineSession`, `ReplayRecorder`, `EngineEvents`, `GridGameRules`, `createGrid`, `emptyGrid`, `clearCells`, `setCell`, `swapCells`, `isOrthoAdjacent`. These are available via the barrel but SpeedGrid does not import them.

### 3.3 Logic That Lives in the SpeedGrid Game Layer

The following logic is **not** delegated to any engine or system. It lives in `SpeedGridGame.tsx`:

- `applyBonusMaskGravity` — bonus mask column compaction after gravity. Mirrors the grid compaction algorithm but for booleans. This is intentionally co-located because bonusMask is a game-layer concept.
- `initGame(profile, prng)` — wires engine calls together to produce initial `SGState`.
- PRNG management — `prngRef` keeps the seeded PRNG across renders. Effects advance the PRNG for spawning. The reducer is pure and never touches the PRNG directly.
- Tile sizing — `computeTileSize` and resize `useEffect` via `uiTokens.ts`.
- Derived display values — `timerProgress`, `isWarning`, `remainingSecs`, `multiplier`, `chainSum` are all computed during render from state.

### 3.4 Duplication Relative to CombineGrid

| Concern | SpeedGrid | CombineGrid | Notes |
|---|---|---|---|
| Gravity | `GravitySystem` + engine `applyGravity` | Local `applyGravity` in `GridService.ts` | Parallel implementations |
| Target generation | Engine `TargetGenerator` | Local `generateTarget` in `GridService.ts` | Parallel implementations |
| PRNG | Seeded `makePrng` (engine) | `Math.random()` directly | Different contracts |
| Tile sizing | `uiTokens.computeTileSize` | Inline in `CombineGridGame.tsx` | Same formula, different location |
| HUD layout | `HUDShell.tsx` (platform) | Inline JSX in `CombineGridGame.tsx` | SpeedGrid uses shared platform |
| Result screen | `ResultScreen.tsx` (local component) | Local result inline (partially) | Different designs |

---

## 4. Grid Host Invariants

### 4.1 Board Sizing Authority

`SpeedGridGame.tsx` is the sole authority over tile size. It:
- Subscribes to `window.resize` via `useEffect`
- Calls `computeTileSize(window.innerWidth, window.innerHeight, ROWS, COLS)` from `uiTokens.ts`
- Stores result in `tileSize` via `useState`
- Passes `tileSize` to `Board` and `SpeedTile`

`ROWS = 5`, `COLS = 4` are defined in `src/games/speed-grid/constants.ts` and are the only source of truth for grid dimensions.

### 4.2 Zero Cross-Game Imports

SpeedGrid imports nothing from `src/games/combine-grid/`. CombineGrid imports nothing from `src/games/speed-grid/`. This boundary is currently clean.

### 4.3 Platform Token Usage

SpeedGrid uses exactly these platform-layer tokens:
- `src/platform/ui/HUDShell.tsx` — `HUDTopBar`, `HUDBottomBar`, `HUDIconBtn`
- `src/platform/ui/tileStyles.ts` — `TILE_BASE_SHADOW`, `TILE_ZAP_SHADOW`, `tileTypography`, `TILE_SPECULAR_CLASSES`

SpeedGrid does **not** use: `animTokens.ts`, `ToastContext.tsx`, `GameControlsLayer.tsx`.

All other styling tokens are local to `src/games/speed-grid/uiTokens.ts`.

### 4.4 bonusMask Containment at Game Layer

`bonusMask: boolean[][]` is declared in `SGState` (game-layer types). It is:
- Created in `initGame` (game layer)
- Recomputed in the CLEARING `useEffect` via `applyBonusMaskGravity` (game layer)
- Passed to `Board` and `SpeedTile` as props (render only)
- Never passed to any engine or system function

No engine or system module has any knowledge of `bonusMask`. Its lifecycle is fully contained.

### 4.5 Reducer Purity

`sgReducer(state, action): SGState` is a pure function. It:
- Takes no arguments beyond `state` and `action`
- Calls no external services, no `Math.random()`, no `Date.now()`, no `localStorage`
- Does not mutate state (all transitions produce new objects)
- Does not access `prngRef` — PRNG is advanced only in effects and passed via action payloads

The PRNG lives in `prngRef` (a React ref). Effects read `prngRef.current`, advance it, and dispatch the computed results as actions. This is the purity contract.

### 4.6 Effect Cleanup Guarantees

| Effect | Cleanup |
|---|---|
| Resize listener | `window.removeEventListener('resize', onResize)` |
| Timer tick (setInterval) | `clearInterval(id)` |
| CLEARING gravity (setTimeout) | `clearTimeout(id)` — critical: prevents stale GRAVITY_DONE after phase change |
| Wrong flash (setTimeout) | `clearTimeout(id)` |

The CLEARING effect captures `stateRef.current` (not state via closure) so it always reads the latest state at the moment the timeout fires. `stateRef` is updated on every render via a synchronous assignment.

---

## 5. Divergence from CombineGrid

### 5.1 Interaction Model

| | SpeedGrid | CombineGrid |
|---|---|---|
| Model | Chain-drag (pointer capture) | Tap-to-toggle |
| Coordinate type | `ChainPos { row, col }` | `GridPos { r, c }` |

**Classification**: Intentional game-specific difference.
Both games are spatial tile selectors but the interaction paradigm is fundamentally different. SpeedGrid is drag-based and continuous; CombineGrid is discrete and tap-based. These must never be unified into a shared interaction model.

### 5.2 Board Data Type

| | SpeedGrid | CombineGrid |
|---|---|---|
| Cell type | `number` (raw value) | `Tile { id, kind, val }` |
| Secondary layer | `bonusMask: boolean[][]` | `kind` field on each Tile |
| Grid type | `number[][]` | `Tile[][]` |

**Classification**: Intentional game-specific difference.
SpeedGrid uses a flat numeric grid + a parallel boolean mask for performance and reducer simplicity. CombineGrid uses rich tile objects because it needs stable identity (`id`) for React reconciliation and `kind` for multi-tile-type rendering. These representations serve different needs and should not be normalized.

### 5.3 PRNG Strategy

| | SpeedGrid | CombineGrid |
|---|---|---|
| RNG | Seeded mulberry32 via engine | `Math.random()` directly |
| Replay support | Foundation present (ReplayRecorder exists) | Not supported |

**Classification**: Platform asymmetry to tolerate for now.
SpeedGrid's seeded PRNG makes behavior deterministic and reproducible. CombineGrid's use of `Math.random()` makes it non-deterministic. This is a known divergence. Normalizing CombineGrid to use the seeded engine PRNG is a Phase 8+ task, not a Phase 7.5 concern.

### 5.4 Scoring System

| | SpeedGrid | CombineGrid |
|---|---|---|
| System | `ScoreSystem` (combo multiplier, up to 5×) | Inline sum of tile values |
| Combo | Yes (`comboCount`, `comboResetKey`) | No |
| Points formula | `ceil(chainLength * 10 * multiplier)` | Sum of selected `tile.val` |

**Classification**: Intentional game-specific difference.
SpeedGrid scoring is combo-driven to reward speed and streaks. CombineGrid scoring is value-driven to reward strategic selection. Do not unify.

### 5.5 Timer System

| | SpeedGrid | CombineGrid |
|---|---|---|
| System | `TimerSystem` (pure state machine) | Raw `timeLeft: number` in CGState |
| Bonus time | `addTime(timer, seconds)` | Not supported |
| Warning zone | `isInWarningZone(timer, TIMER_WARNING_SECS)` | Not implemented |

**Classification**: Future unification candidate.
CombineGrid's raw `timeLeft` counter could be replaced with `TimerSystem` in Phase 8. This is low risk and high value. Not urgent for Phase 7.5 lock.

### 5.6 Gravity System

| | SpeedGrid | CombineGrid |
|---|---|---|
| System | `GravitySystem` → delegates to `GridEngine.applyGravity` | Local `applyGravity` in `GridService.ts` |
| Animation | `GravityAnimator` (scheduled frames, per-row delays) | None (instant, 320ms CLEAR_MS timeout only) |
| Bonus mask gravity | `applyBonusMaskGravity` (game layer) | N/A |

**Classification**: Future unification candidate (gravity algorithm), Platform asymmetry to tolerate (animation).
The core compaction algorithm is duplicated between `GridEngine.applyGravity` and CombineGrid's `GridService.applyGravity`. This is Phase 8+ work.

### 5.7 Phase Structure

| | SpeedGrid | CombineGrid |
|---|---|---|
| Phases | 4: WAITING_TO_START, PLAYING, CLEARING, GAME_OVER | 6: IDLE, SELECTING, CLEARING, ROUND_OVER, STALEMATE, FINAL |
| Session structure | Single continuous 60s session | 5 rounds × 30s each |
| Stalemate detection | None | `hasSolution()` brute force |

**Classification**: Intentional game-specific difference.
SpeedGrid's single-session model and CombineGrid's multi-round model are defining characteristics of each game. Round structure, ROUND_OVER, and FINAL phases are CombineGrid-specific. Do not import or unify.

### 5.8 Bonus Tile System

| | SpeedGrid | CombineGrid |
|---|---|---|
| Bonus tiles | Yes (time bonus on collection) | No |
| Special tile kinds | None (all tiles are `number`) | bomb, trophy, stone, blank |

**Classification**: Intentional game-specific difference.

### 5.9 HUD Architecture

| | SpeedGrid | CombineGrid |
|---|---|---|
| HUD | Uses `HUDShell` (platform shared) | Inline HUD JSX in CombineGridGame.tsx |
| Grid sizing | `uiTokens.computeTileSize` (local util) | Inline in CombineGridGame.tsx |

**Classification**: Future unification candidate.
CombineGrid should adopt `HUDShell` in Phase 8. Not a Phase 7.5 concern.

---

## 6. SpeedGrid Phase 7.5 Lock

### 6.1 Constants That Must Not Drift

```
src/games/speed-grid/constants.ts:
  ROWS = 5                      ← board height; Board and bonusMask are sized to this
  COLS = 4                      ← board width; same
  CHAIN_MIN_LENGTH = 2          ← below this, CHAIN_COMMIT is a silent no-op
  TIMER_WARNING_SECS = 10       ← threshold for HUD warning state
  ROUND_DURATION_SECS = 60      ← initial timer value; PracticeProfile.timeLimitSeconds
                                   is separate and not used for timer init (medium profile = 60)
  BONUS_TIME_SECS = 3           ← seconds added per bonus tile in a committed chain
```

If `ROWS` or `COLS` change, `applyBonusMaskGravity`, `Board`, `SpeedTile`, `computeTileSize`, and `initGame` must all be reviewed. These constants are a structural invariant.

### 6.2 Files That Must Not Be Casually Edited

| File | Reason |
|---|---|
| `src/games/speed-grid/SpeedGridGame.tsx` | Houses reducer, initGame, applyBonusMaskGravity, all 4 effects, purity contract |
| `src/games/speed-grid/types.ts` | Canonical SGState and SGAction shapes; changes ripple everywhere |
| `src/games/speed-grid/constants.ts` | Structural constants (see above) |
| `src/systems/ChainSelector.ts` | Shared by both games; backtrack/adjacency logic is load-bearing |
| `src/systems/TimerSystem.ts` | Shared; addTime clamping and expiry semantics affect game correctness |
| `src/systems/ScoreSystem.ts` | Shared; comboMultiplier tiers affect game balance |
| `src/engine/GridEngine.ts` | Engine gravity is depended on by GravitySystem |
| `src/engine/TargetGenerator.ts` | generateTarget fallback logic is subtle (random pair → 10) |

### 6.3 Behaviors That Are Sensitive

1. **Timer starts on first touch, not on game mount.** `WAITING_TO_START` is an intentional UX feature allowing the player to see the board before the clock starts. Do not move timer start to `initGame` or `useEffect`.

2. **Timer ticks during CLEARING.** The game does not pause for gravity animation. This is intentional — the game stays under pressure. Do not add a phase guard to the tick effect.

3. **PRNG advances only in effects, never in reducer.** The `prngRef.current` is called in the CLEARING effect for bonus tile spawning, and by `handlePlayAgain` for `initGame`. The reducer is pure. This split is load-bearing for correctness and future replay support.

4. **`applyBonusMaskGravity` uses `preGravGrid`, not `newGrid`.** It inspects the pre-gravity grid to determine which cells were occupied (and their old row positions) before compaction. Using `newGrid` here would produce incorrect mask remapping. This is subtle and must not be "cleaned up".

5. **`stateRef` used in CLEARING effect.** The effect captures `stateRef.current` to avoid stale closures. Any refactor that removes `stateRef` and reads state via closure will produce stale reads when the component re-renders during the timeout window.

6. **`GRAVITY_DONE` delivers target atomically with grid.** The new target is generated in the effect (where the PRNG lives) and delivered as part of the same action. This prevents a render frame where the grid is updated but the target is stale. Do not split into two actions.

7. **Chain input is gated on `phase === 'PLAYING' || phase === 'WAITING_TO_START'`.** `Board.isInteractive` is false during CLEARING and GAME_OVER. Do not broaden this gate.

### 6.4 Things Future LLMs Must Not Unify Prematurely

- **Do not unify `ChainPos { row, col }` and `GridPos { r, c }`.** These serve different games with different coordinate conventions. Renaming one to match the other will break either SpeedGrid or CombineGrid.

- **Do not replace `number[][]` grid with `Tile[][]`.** SpeedGrid's flat numeric grid is intentional. It enables simple sum/product evaluation, clean gravity, and a separate `bonusMask`. Adding a Tile wrapper would complicate the reducer without benefit.

- **Do not extract `applyBonusMaskGravity` into a shared system.** `bonusMask` is a game-layer concept. Moving it to a system would introduce game-specific knowledge into a platform layer.

- **Do not "simplify" `initGame` by calling `startTimer` at mount.** The `WAITING_TO_START` phase is a deliberate UX design decision, not leftover scaffolding.

- **Do not apply CombineGrid's `GridService` gravity to SpeedGrid or vice versa.** They serve different grid types (`Tile[][]` vs `number[][]`) and have different contracts.

- **Do not add a `hasSolution` check to SpeedGrid.** CombineGrid has stalemate detection because its tap-select model can deadlock. SpeedGrid's chain-drag model does not deadlock in the same way; a player can always chain any 2 adjacent tiles.

- **Do not move target generation into the reducer.** It requires PRNG advancement, which is a side effect. It belongs in the CLEARING effect.

---

## 7. Phase 8 Readiness Verdict

**Verdict: Ready for cross-game platform review, with one known asymmetry to document before starting.**

SpeedGrid is stable. Its reducer is pure, its effects clean up correctly, its systems are well-bounded, its constants are locked, and its bonusMask lifecycle is contained. No correctness issues are known.

The one asymmetry to document before Phase 8 begins:

> **CombineGrid does not use `HUDShell`, `TimerSystem`, or the seeded PRNG.** Phase 8's cross-game platform review will need to decide whether CombineGrid should adopt these platform primitives, or whether the divergence is acceptable. This decision should be made deliberately at the start of Phase 8, not discovered mid-sprint.

SpeedGrid should be treated as the **reference implementation** for platform integration during Phase 8.

---

## Summary

### What Is Stable

- SpeedGrid reducer is pure and correct
- `applyBonusMaskGravity` correctly mirrors grid gravity on the boolean mask
- All 4 effects have cleanup; no known leak or stale-dispatch paths
- ChainSelector, TimerSystem, ScoreSystem, GravitySystem are clean pure modules
- Engine barrel is well-factored; SpeedGrid uses only what it needs
- Board input gating is correct across all 4 phases
- PRNG is seeded and advances only in effects (replay-ready)
- System boundaries are clean: no cross-game imports
- Platform token usage is minimal and correct (HUDShell + tileStyles only)
- bonusMask is fully contained at the game layer

### What Is Risky

- `applyBonusMaskGravity` is subtle (uses `preGravGrid`, not `newGrid`) — easy to accidentally break in a refactor
- `stateRef` pattern is non-obvious — a cleanup pass could accidentally remove it
- `GRAVITY_DONE` delivers target atomically — splitting this into two actions would introduce a frame of stale target display
- Timer ticking during CLEARING is intentional but looks like a bug to new readers
- CombineGrid gravity is a parallel implementation that could drift further from engine gravity without being noticed

### What Must Be Protected Next

- `SPEEDGRID_CANONICAL_REFERENCE.md` (this file) — must travel with the codebase into Phase 8
- `src/games/speed-grid/constants.ts` — ROWS/COLS/BONUS_TIME_SECS must not drift
- The `WAITING_TO_START` → `PLAYING` timer-start-on-first-touch behavior
- The purity contract: reducer never touches PRNG or Date.now()
- The `applyBonusMaskGravity` pre-gravity-grid argument — must remain `preGravGrid` not `newGrid`
- Cross-game import isolation — `src/games/speed-grid/` and `src/games/combine-grid/` must stay fully decoupled
