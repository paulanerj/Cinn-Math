# COMBINEGRID CANONICAL REFERENCE

**Status:** Phase 6.5 — Stabilization Lock
**Branch:** `claude/audit-codebase-architecture-75LTi`
**Date:** 2026-03-12
**Purpose:** Source of truth for CombineGrid architecture, engine boundary status, and multi-game readiness.

---

## 1. GAME STATE MACHINE

### States

```
SELECTING ──(TAP_TILE: match found)──────────► CLEARING
    ▲                                               │
    │                                        (CLEAR_MS = 320ms)
    │                                               │
    │                               ┌──────────────▼──────────────┐
    │                               │   CLEAR_COMPLETE dispatch    │
    │                               │   applyGravity()             │
    │                               │   generateTarget()           │
    │                               │   hasSolution()              │
    │                               └──────┬──────────────┬────────┘
    │                                      │              │
    │                              solvable=true    solvable=false
    │                               timeLeft>0           │
    │                                  │                 ▼
    │◄─────────────────────────────────┘           STALEMATE
    │                                                    │
    │           timeLeft=0 on TICK                (1500ms delay)
    │◄─── ADVANCE_ROUND ◄── ROUND_OVER ◄──────────────────┘
    │              │
    │    roundsCompleted >= ROUNDS_PER_SESSION
    │              │
    │              ▼
    └──────────► FINAL ──► ResultScreen (onBack → GameSelector)
```

### State Descriptions

| Phase | Accepts Input | Timer Active | Notes |
|-------|--------------|--------------|-------|
| `SELECTING` | Yes (TAP_TILE) | Yes (TICK every 1s) | Main gameplay phase |
| `CLEARING` | No | Yes (paused de facto — TICK guards `phase !== SELECTING`) | 320ms clear animation window |
| `STALEMATE` | No | No | Auto-resolves in 1500ms via RESOLVE_STALEMATE |
| `ROUND_OVER` | No | No | Auto-advances in 2000ms via ADVANCE_ROUND |
| `FINAL` | No | No | Renders ResultScreen; only exit is `onBack` |

### Legal Transitions

```
SELECTING     → CLEARING    (TAP_TILE: val === target && selection.length >= 2)
SELECTING     → ROUND_OVER  (TICK: timeLeft reaches 0, roundsCompleted < ROUNDS_PER_SESSION)
SELECTING     → FINAL       (TICK: timeLeft reaches 0, roundsCompleted >= ROUNDS_PER_SESSION)
CLEARING      → SELECTING   (CLEAR_COMPLETE: solvable=true, timeLeft>0)
CLEARING      → ROUND_OVER  (CLEAR_COMPLETE: solvable=true, timeLeft=0)
CLEARING      → STALEMATE   (CLEAR_COMPLETE: solvable=false)
STALEMATE     → SELECTING   (RESOLVE_STALEMATE: new target generated for same board)
ROUND_OVER    → SELECTING   (ADVANCE_ROUND: new board, timeLeft reset)
ROUND_OVER    → FINAL       (ADVANCE_ROUND: roundsCompleted >= ROUNDS_PER_SESSION)
FINAL         → (exit)      (onBack prop — returns to GameSelector)
```

### Unreachable / Reserved States

- `IDLE` — defined in `GamePhase` type but never entered. Was the mode-selector phase removed in Phase 6 correction. The type union retains it as a reserved value for possible future use.

---

## 2. DATA FLOW

### Input → Resolution Pipeline

```
User tap
    │
    ▼
Board.tsx: onTilePress(pos: GridPos)
    │
    ▼
dispatch({ type: 'TAP_TILE', pos })
    │
    ▼
reducer / TAP_TILE case
    │
    ├── toggleTile(selection, pos)          [SelectionService.ts]
    │       → new GridPos[] selection
    │
    ├── evaluateSelection(board, newSel, mode)  [GridService.ts]
    │       → sum of tile values (mode='sum')
    │       → val > target? → reset selection (no state change)
    │
    ├── val === target && length >= 2?
    │       YES → basePoints = sum of selected tile values
    │             phase = CLEARING
    │             clearingPositions = newSel
    │             score += basePoints
    │             roundScore += basePoints
    │       NO  → store newSel + val in state
    │
    ▼ (if CLEARING)
useEffect [phase===CLEARING] fires after CLEAR_MS (320ms)
    │
    ├── applyGravity(board, clearingPositions)  [GridService.ts]
    │       → compacted board (Tile[][])
    │       → newIds: Set<string> (IDs of spawned tiles — vestigial, unused by UI)
    │
    ├── generateTarget(newBoard, 'sum')          [GridService.ts]
    │       → new target number
    │
    ▼
dispatch({ type: 'CLEAR_COMPLETE', board, newIds, target })
    │
    ├── hasSolution(board, target, mode)         [GridService.ts]
    │       → solvable: boolean
    │
    └── nextPhase = STALEMATE | SELECTING | ROUND_OVER
```

### Round Lifecycle

```
Session start
    │
    ▼
initGame() [lazy useReducer initializer]
    ├── createBoard()          → 6×4 Tile[][] with random vals [1..9]
    ├── generateTarget(board, 'sum')
    ├── phase = SELECTING
    ├── timeLeft = 30
    └── roundsCompleted = 0

Round active
    ├── TICK every 1s → timeLeft--
    ├── Player matches tiles → score/roundScore accumulate
    └── timeLeft → 0

ROUND_OVER (2s interstitial)
    └── ADVANCE_ROUND
            ├── createBoard()          → fresh board
            ├── generateTarget(board, 'sum')
            ├── roundScore = 0
            ├── timeLeft = 30
            └── roundsCompleted++

After ROUNDS_PER_SESSION (5) rounds → FINAL
    └── ResultScreen renders totalScore
```

---

## 3. SERVICE BOUNDARIES

### CombineGrid Internal Services

All services live inside `src/games/combine-grid/services/`. Zero imports from `src/engine/`, `src/systems/`, or `src/platform/`.

#### `GridService.ts`
| Export | Role | Notes |
|--------|------|-------|
| `createBoard()` | Creates fresh 6×4 `Tile[][]` using `crypto.randomUUID()` per tile | Uses local `randVal()` → `Math.random()` |
| `applyGravity(board, cleared)` | Compacts column, fills new tiles at top | Returns `{ board: Tile[][], newIds: Set<string> }`. newIds currently vestigial. |
| `evaluateSelection(board, selection, mode)` | Sum or product of selected tile values | mode hardcoded `'sum'` in all current call sites |
| `generateTarget(board, mode)` | Picks 2–3 random tiles, returns their sum | No adjacency requirement — tiles anywhere on board |
| `hasSolution(board, target, mode)` | Brute-force check: any 1/2/3-tile combination equals target? | O(n³) where n = ROWS×COLS = 24; always fast |

#### `SelectionService.ts`
| Export | Role | Notes |
|--------|------|-------|
| `toggleTile(current, pos)` | Add/remove a GridPos from selection | Returns new array (immutable) |
| `isSelected(selection, pos)` | Boolean presence check | Used by Board.tsx |
| `selectionIndex(selection, pos)` | 0-based index of pos, or -1 | Exported but not currently used by any component |

### Platform Services (NOT used by CombineGrid)

These exist in `src/platform/ui/` and `src/engine/` but CombineGrid does not import any of them:

| File | Intended Role | CombineGrid Status |
|------|--------------|-------------------|
| `src/platform/ui/tileStyles.ts` | Shared tile shadow/scale tokens | **NOT USED** (removed in Phase 6 correction — was an A-bucket violation) |
| `src/platform/ui/HUDShell.tsx` | Shared HUD top/bottom chrome | **NOT USED** |
| `src/platform/ui/animTokens.ts` | Shared animation timing constants | **NOT USED** |
| `src/platform/ui/ToastContext.tsx` | Toast notification system | **NOT USED** |
| `src/platform/controls/GameControlsLayer.tsx` | SpeedGrid control strip | **NOT USED** (SpeedGrid-specific) |
| `src/engine/GridEngine.ts` | Pure grid operations (createGrid, applyGravity, clearCells...) | **NOT USED** |
| `src/engine/TargetGenerator.ts` | Engine target generator (adjacency-based, profile-aware) | **NOT USED** |
| `src/engine/SpawnEngine.ts` | Tile spawning with practice profiles | **NOT USED** |
| `src/engine/EngineSession.ts` | Session tracking with localStorage best-score | **NOT USED** |
| `src/systems/GravitySystem.ts` | System-layer gravity (wraps engine, adds FallingTile metadata) | **NOT USED** |
| `src/systems/ScoreSystem.ts` | Combo + multiplier scoring | **NOT USED** |
| `src/systems/TimerSystem.ts` | Pure countdown/countup timer state | **NOT USED** |
| `src/engine/GridGameRules.ts` | Future game contract interface | **NOT USED** (types-only; CombineGrid explicitly not wired per its own LLM NOTE) |

---

## 4. ENGINE BOUNDARY CONTRACT (CURRENT STATE)

### CombineGrid does NOT use the GridEngine layer.

CombineGrid is a **fully self-contained game** with its own implementations of every subsystem that the engine layer also provides. This is the current baseline state, explicitly preserved per Phase 6 correction rules.

#### Duplication Map

| Concern | CombineGrid implementation | Engine/Systems equivalent |
|---------|---------------------------|--------------------------|
| Board creation | `GridService.createBoard()` → `Tile[][]` | `GridEngine.createGrid()` + `SpawnEngine.spawnBoard()` → `number[][]` |
| Gravity | `GridService.applyGravity()` | `GravitySystem.applyGravity()` → `GridEngine.applyGravity()` |
| Target generation | `GridService.generateTarget()` (random 2-3 tiles, no adjacency) | `TargetGenerator.generateTarget()` (adjacency walk, profile-aware, PRNG-seeded) |
| Solvability check | `GridService.hasSolution()` (brute-force O(n³)) | None (engine has no equivalent — this is CombineGrid-specific logic) |
| Selection eval | `GridService.evaluateSelection()` | `GridEngine.sumPositions()` / `productPositions()` |
| Scoring | Inline in reducer: `basePoints = sum of tile values` | `ScoreSystem.calculatePoints()` + `recordMatch()` |
| Timer | Inline in reducer: `timeLeft--` on TICK | `TimerSystem.tick()` + `isExpired()` + `countdownProgress()` |
| Session tracking | Inline fields: `score`, `roundScore`, `roundsCompleted`, `roundScores[]` | `EngineSession` + `addScore()` + `incrementRound()` |
| RNG | `Math.random()` directly | `rng.makePrng()` (seeded, reproducible) |
| Tile ID | `crypto.randomUUID()` per tile | `SpawnedTile.id` from SpawnEngine |

#### Type System Divergence

| Concept | CombineGrid type | Engine type |
|---------|-----------------|-------------|
| Grid position | `GridPos = { r: number; c: number }` | `GridGameRules.GridPos = { row: number; col: number }` |
| Board cell | `Tile = { id, kind, val }` (object with metadata) | `number` (plain value) |
| Grid shape | `Tile[][]` | `number[][]` |

**The `r`/`c` vs `row`/`col` naming divergence is the most critical multi-game risk item.** See Section 6.

---

## 5. GRID HOST INVARIANTS

### 5.1 — CombineGrid does not mutate engine core

**CONFIRMED.** CombineGrid has zero imports from `src/engine/`. All state transitions are pure (reducer returns new state objects; `GridService` functions return new arrays). No mutable global state is modified.

### 5.2 — Board sizing independence

**CONFIRMED with one caveat.**

`computeTileSize()` in `CombineGridGame.tsx` computes tile pixel size from `window.innerWidth`/`window.innerHeight` and the locked layout constants in `uiTokens.ts`. The formula:

```ts
const availH = window.innerHeight - HUD_TOP_H - HUD_BOT_H - SAFE_MARGIN * 2 - 32;
const availW = window.innerWidth - SAFE_MARGIN * 2 - 16;
const byH = Math.floor(availH / ROWS);
const byW = Math.floor(availW / COLS);
return Math.min(byH, byW, 80);
```

`ROWS` and `COLS` are imported from `constants.ts`, not hardcoded. The formula is self-contained and does not depend on any engine sizing utilities (`src/grid/GridSizing.ts` exists but is not used).

**Caveat:** The `-32` and `-16` offsets are magic numbers whose derivation is not documented. If `HUD_TOP_H` or `HUD_BOT_H` change, these offsets will need manual re-derivation. `src/grid/GridSizing.ts` exists specifically to solve this problem for future games — CombineGrid predates its use.

### 5.3 — No shared UI token leakage

**CONFIRMED.** After the Phase 6 correction:

- CombineGrid does **not** import from `src/platform/ui/tileStyles.ts`.
- CombineGrid does **not** import from `src/platform/ui/HUDShell.tsx`.
- CombineGrid does **not** import from `src/platform/ui/animTokens.ts`.
- CombineGrid does **not** import from `src/platform/ui/ToastContext.tsx`.

CombineGrid's own layout tokens live exclusively in `src/games/combine-grid/uiTokens.ts`, which is not imported by any platform or engine file. The token layer is private to the game.

### 5.4 — GameSelector boundary

`GameSelector.tsx` mounts/unmounts CombineGrid via a single conditional render:

```tsx
{game === "combine-grid" && (
  <CombineGridGame onBack={() => setGame("splash")} />
)}
```

`GameSelector` owns no game logic, no game state, and no game constants. The only coupling is the `onBack` prop, which is a plain `() => void` callback. **This boundary is clean.**

`ToastProvider` wraps `GameSelector` in `main.tsx` but CombineGrid does not call `useToast()`. The provider is present but inert from CombineGrid's perspective.

---

## 6. MULTI-GAME RISKS

### RISK-1 — `GridPos` naming collision (HIGH)

**Nature:** CombineGrid uses `{ r: number; c: number }` for grid coordinates. The engine contract (`GridGameRules.ts`) uses `{ row: number; col: number }`. The systems layer (`GravitySystem.ts`) and `GridEngine.ts` also use `row`/`col`.

**Impact when SpeedGrid is added:** SpeedGrid will almost certainly use the engine's `GridGameRules.GridPos` shape (`row`/`col`), creating two incompatible coordinate types coexisting in the codebase. Any utility shared between games (e.g. a future shared `Board` component) must pick one or accept both.

**Resolution options:**
- A: Keep divergence permanently — each game owns its coordinate type, no sharing.
- B: Migrate CombineGrid to `row`/`col` in a future phase (mechanical find/replace, low risk).
- C: Create a platform adapter type. Not recommended (adds complexity for no gain).

**Recommendation:** Accept divergence for now (Option A). Flag for Option B if a shared Board component is ever needed.

---

### RISK-2 — Gravity duplication (MEDIUM)

**Nature:** `GridService.applyGravity()` operates on `Tile[][]` (object arrays). `GravitySystem.applyGravity()` operates on `number[][]` (value arrays). They implement the same column-compaction algorithm independently.

**Impact:** If a gravity bug is found and fixed in `GravitySystem.ts`, the same fix must be manually applied to `GridService.ts`. The implementations will drift.

**Resolution options:**
- A: Accept duplication — CombineGrid's Tile-object model is fundamentally different from the numeric grid model.
- B: Extract the compaction algorithm into a shared pure utility (no React, no types) that both can call.

**Current state:** Option A is the Phase 6.5 lock position. No action required now.

---

### RISK-3 — Target generation divergence (MEDIUM)

**Nature:** `GridService.generateTarget()` picks 2–3 **random tiles from anywhere on the board** (no adjacency requirement) using `Math.random()`. `TargetGenerator.generateTarget()` walks **adjacent tiles** with a seeded PRNG and applies practice profile range constraints.

**Impact:** CombineGrid targets can be formed from non-adjacent tiles. When/if CombineGrid migrates to the engine's TargetGenerator, target difficulty will change (adjacency reduces the space of valid targets). This is a **gameplay behavior change**, not just a refactor.

**Resolution:** This divergence should be documented as intentional. CombineGrid's mechanics do not require adjacency — any tile on the board can be selected freely. If CombineGrid ever migrates to the engine's generator, the adjacency constraint must be removed from that generator first.

---

### RISK-4 — Scoring is inline, not via ScoreSystem (LOW-MEDIUM)

**Nature:** CombineGrid computes points inline in the reducer:

```ts
const basePoints = newSel
  .map(({ r, c }) => state.board[r][c].val)
  .reduce((a, b) => a + b, 0);
```

`ScoreSystem.ts` provides `calculatePoints()`, `recordMatch()`, `comboMultiplier()` etc. CombineGrid uses none of them.

**Impact:** CombineGrid has no combo multiplier in the current baseline. If a combo system is added in a future phase, it must use `ScoreSystem` to stay consistent with SpeedGrid's scoring feel. Adding combo by reinventing the formula in the reducer (as was done in the pre-Phase-6 build) produces drift.

**Lock position:** CombineGrid's flat scoring is intentional at this phase. `ScoreSystem` is available when needed.

---

### RISK-5 — Timer is inline, not via TimerSystem (LOW)

**Nature:** CombineGrid's countdown is a raw `timeLeft: number` field decremented by `TICK` actions in the reducer. `TimerSystem.ts` provides `tick()`, `isExpired()`, `countdownProgress()`, `addTime()` etc. CombineGrid uses none of them.

**Impact:** CombineGrid cannot receive time-bonus mechanics (e.g. clearing a row adds 3 seconds) without re-implementing `addTime()` manually. When SpeedGrid is built with `TimerSystem`, the two timers will be independently debugged.

**Lock position:** The inline timer is acceptable at this phase. `TimerSystem` is available if time-bonus mechanics are added.

---

### RISK-6 — `newTileIds` vestige in state (NEGLIGIBLE)

**Nature:** `newTileIds: Set<string>` is populated in `CLEAR_COMPLETE` and stored in `CGState`, but no component consumes it. It was the driver for the removed spawn animation.

**Impact:** Zero. Dead state field. Minor memory cost (small Set per clear).

**Lock position:** Retain as-is. Remove in a future cleanup pass if state shape is revised for another reason.

---

### RISK-7 — `crypto.randomUUID()` for tile IDs (LOW)

**Nature:** Every newly spawned tile gets a UUID via `crypto.randomUUID()`. This is non-deterministic and non-reproducible, meaning CombineGrid sessions cannot be replayed via `ReplayRecorder` (which requires seeded PRNG-based board state).

**Impact:** Not a problem at Phase 6.5. Becomes relevant only if CombineGrid implements the `GridGameRules` contract and opts into the engine's replay system.

---

## 7. FILE INVENTORY (LOCKED STATE)

### `src/games/combine-grid/` — 9 files, all self-contained

| File | Lines | Role | External imports |
|------|-------|------|-----------------|
| `CombineGridGame.tsx` | 427 | Root component + reducer + all effects | React, own files only |
| `types.ts` | 17 | `TileKind`, `Tile`, `GridPos`, `GamePhase` | None |
| `constants.ts` | 11 | All numeric game constants | None |
| `uiTokens.ts` | 10 | All layout/spacing constants | None |
| `services/GridService.ts` | 121 | Board creation, gravity, eval, target, solvability | `../types`, `../constants` |
| `services/SelectionService.ts` | 21 | toggleTile, isSelected, selectionIndex | `../types` |
| `components/Tile.tsx` | 36 | Single tile button | `../types`, `../uiTokens` |
| `components/Board.tsx` | 51 | Grid layout of Tile components | `./Tile`, `../types`, `../uiTokens`, `../services/SelectionService` |
| `components/ResultScreen.tsx` | 62 | Final score screen | React |

**Total: 756 lines across 9 files. Zero imports from `src/engine/`, `src/systems/`, or `src/platform/ui/`.**

### `src/platform/` — entry router only

| File | Imports CombineGrid? | Notes |
|------|---------------------|-------|
| `GameSelector.tsx` | Yes — `CombineGridGame` | Clean: only passes `onBack` prop |

### Platform/Engine layers (exist, not used by CombineGrid)

`src/engine/` — 9 files
`src/systems/` — 5 files
`src/platform/ui/` — 4 files
`src/platform/controls/` — 1 file
`src/grid/` — 4 files

All available for SpeedGrid and future games. None imported by CombineGrid.

---

## 8. CONSTANTS REFERENCE (LOCKED)

### Game constants (`constants.ts`)

| Constant | Value | Role |
|----------|-------|------|
| `ROWS` | 6 | Board row count |
| `COLS` | 4 | Board column count |
| `ROUNDS_PER_SESSION` | 5 | Rounds before FINAL |
| `STALEMATE_VALID_THRESHOLD` | 1 | Imported for traceability; check done via `hasSolution()` |
| `ROUND_DURATION_SECS` | 30 | Timer start value per round |
| `CLEAR_MS` | 320 | Delay before gravity after a match |
| `ROUND_OVER_AUTOADVANCE_MS` | 2000 | Delay before advancing from ROUND_OVER |
| `TILE_VAL_MIN` | 1 | Minimum spawned tile value |
| `TILE_VAL_MAX` | 9 | Maximum spawned tile value |

### Layout tokens (`uiTokens.ts`)

| Token | Value | Role |
|-------|-------|------|
| `SAFE_MARGIN` | 5 | Horizontal/vertical edge padding (px) |
| `BORDER_WIDTH` | 5 | Unused in current render (retained for contract) |
| `GAP` | 2 | Grid gap between tiles (px) |
| `PAD` | 6 | Tile inner padding (px) |
| `BASE_RADIUS_PX` | 16 | Maximum tile border-radius (px) |
| `GRID_SCALE` | 1.03 | Unused in current render (retained for contract) |
| `HUD_TOP_H` | 54 | Top HUD height (px) — must match platform HUDTopBar |
| `HUD_BOT_H` | 52 | Bottom HUD height (px) |

---

## 9. PHASE 6.5 LOCK DECLARATION

The following are **locked** and must not change without a new phase declaration:

1. **State machine:** All six `GamePhase` values and all legal transitions described in Section 1.
2. **Scoring formula:** `basePoints = sum of selected tile values`, no multiplier.
3. **Mode:** Hardcoded `'sum'`. The `mode` field in `CGState` is typed `'sum' | 'multiply'` but is always `'sum'` at initialization and never changes.
4. **Tile value range:** `TILE_VAL_MIN = 1`, `TILE_VAL_MAX = 9`, uniform random distribution via `Math.random()`.
5. **Target generation:** Any 2–3 random tiles, no adjacency constraint, `mode='sum'`.
6. **Solvability check:** `hasSolution()` brute-force O(n³) for 1/2/3-tile combinations.
7. **Service isolation:** Zero imports from `src/engine/`, `src/systems/`, `src/platform/ui/`.
8. **Coordinate convention:** `{ r, c }` (not `{ row, col }`).
9. **Board type:** `Tile[][]` with `{ id: string, kind: TileKind, val: number }` per cell.
10. **Layout formula:** `computeTileSize()` exactly as written in `CombineGridGame.tsx:181–187`.

---

## 10. PHASE 7 PREREQUISITES (SpeedGrid)

Before SpeedGrid can be added without breaking CombineGrid:

| Prerequisite | Status |
|-------------|--------|
| GameSelector boundary is clean (onBack only) | ✓ Done |
| ToastProvider is inert to CombineGrid | ✓ Done |
| Platform UI layer unused by CombineGrid (no leakage) | ✓ Done |
| CombineGrid state is fully self-contained | ✓ Done |
| Engine layer is idle (no shared mutable state) | ✓ Done |
| `GridPos` naming divergence is documented | ✓ Documented (RISK-1) |
| SpeedGrid must use `PhasePlaceholder` until Phase 7 completes | ✓ In place |

SpeedGrid can be built entirely independently in `src/games/speed-grid/`. It may use `src/engine/`, `src/systems/`, `src/platform/ui/`, and `src/grid/` freely without touching any CombineGrid file.

The one shared mutation point: `GameSelector.tsx` will need one additional conditional render block for SpeedGrid. This is a two-line change that does not affect CombineGrid's render path.

---

*This document is the Phase 6.5 lock record. Any deviation from the locked items in Section 9 requires a new phase declaration and fidelity audit.*
