# CombineGrid Audit — Pre-Implementation Read-Only Report

> Scope: `games/combine-grid-vnext/combinegrid-v9/` and shared platform components it uses.
> Status: **READ-ONLY** — zero code changes made. Awaiting approval before implementing.

---

## PART 1 — AUTHORITATIVE ENTRY + FILE MAP

### 1.1 Canonical Entry Point

The **live CombineGrid** that players see is:

```
games/combine-grid-vnext/combinegrid-v9/App.tsx
  export default CombineGridVNextGame
```

**How it gets mounted:**

```
src/platform/GameSelector.tsx  (line 4)
  import CombineGridGame from "../../games/combine-grid-vnext/combinegrid-v9/App";

  {game === "combine-grid" && <CombineGridGame />}   // line 65
```

`GameSelector` is the default root. CombineGrid is the default selection (`useState<GameType>("combine-grid")`). The debug selector panel floats over it (`zIndex: 9999`) but is not part of the game layout.

> ⚠️ DEAD TREE: `games/combine-grid/` (without `-vnext`) exists alongside. It exports from the same internal `combinegrid-v9/App` but it is **NOT imported by GameSelector**. It is unused at runtime. All auditing below applies exclusively to the `-vnext` tree.

### 1.2 File Map (combine-grid-vnext/combinegrid-v9/)

| File | Owns |
|------|------|
| `App.tsx` | Root component: state, phases, event routing, layout shell |
| `types.ts` | All enums: `TileKind`, `Phase`, `TargetSource`, `GameEvent` interface |
| `constants.ts` | `GRID_CONFIG` (default rows/cols/target) |
| `components/Board.tsx` | Grid viewport, HUD overlay (target pill, equation tracker, settings gear), drag/drop logic |
| `components/Tile.tsx` | Individual tile rendering (color coding by kind) |
| `components/FlyoutPill.tsx` | Trophy earned flyout animation (tile → equation tracker) |
| `components/SettingsModal.tsx` | Full settings UI: grid size, mode, practice set, recipe, logs |
| `components/EquationTracker.tsx` | Equation display pill in Board HUD area |
| `components/ParticleLayer.tsx` | Particle effects layer (ref-based) |
| `components/OpsTray.tsx` | Legacy ops tray — not mounted in current App |
| `components/Controls.tsx` | Legacy debug controls — not mounted in current App |
| `components/Logger.tsx` | Debug event log — only mounted inside SettingsModal |
| `services/Engine.ts` | Pure tile merge evaluation: `evaluateInteraction()` |
| `services/GridEngine.ts` | Grid seeding: `seedGrid()`, `createTile()` |
| `services/Solver.ts` | Move validation: `hasAnyLegalMove()`, `hasImmediateSolve()` |
| `services/PlatformEngineAdapter.ts` | Adapter to shared platform engine (`src/engine/public`) for target generation |
| `services/TargetGenerator.ts` | Local generator (present but superseded by PlatformEngineAdapter in vnext) |
| `services/SoundEngine.ts` | All audio: `playMergeStandard`, `playMergeTrophy`, `playCountStep`, `playResultsFanfare`, etc. |
| `services/SwapResolver.ts` | Swap mechanic resolution |
| `services/DistributionController.ts` | Tile distribution management |
| `services/GridDistributionPolicy.ts` | Distribution policy rules |
| `services/mathpopSpawn.ts` | MathPop spawn helper |
| `fx/fxConfig.ts` | `FX_TIMING` constants (e.g. `DRY_DELAY_MS`, `COUNT_STEP_MS`, `HUD_FLASH_MS`) |
| `fx/fxRunner.ts`, `fxPresets.ts`, `fxTypes.ts` | FX system (particle/animation definitions) |
| `gravity/` | Gravity simulation (runner, moves, types, constants) |
| `debug/trace.ts` | `Trace.newActionId()` — action ID factory |
| `debug/gridDigest.ts`, `distributionAudit.ts` | Debug/audit utilities |
| `invariants.ts` | Grid invariant checks |
| `metadata.json` | Game metadata |

**Shared platform files used by CombineGrid-vnext:**

| File | Role |
|------|------|
| `src/platform/controls/GameControlsLayer.tsx` | Bottom control bar shell (Undo, Reset, Settings buttons + `centerSlot`) |
| `src/platform/hud/GameHUD.tsx` | Top HUD bar (Target, Score, Time, mode label) |
| `src/platform/ui/ToastContext.tsx` | Toast notification context (`addToast`) |
| `src/engine/public` | Shared engine (target generation, grid seeding) |

---

## PART 2 — BOTTOM CONTROL BAR TRUTH TABLE

**Architecture note:** CombineGrid-vnext uses `GameControlsLayer` (shared platform component) for its bottom bar shell. The `Prev`, `Check Oven`, and `Next` buttons are passed as a `centerSlot` ReactNode prop. `Undo`, `Reset`, and `Settings` are wired via named props.

### 2.1 Prev Button

**Where rendered:** `App.tsx` line 352–356, inside `centerSlot` prop passed to `GameControlsLayer`

```tsx
// App.tsx lines 351-356
<button
  onClick={handlePrevTarget}
  className="bg-[#242426] px-3 sm:px-4 py-3.5 rounded-[16px] font-bold text-[11px] uppercase
             text-white/90 tracking-widest shadow-md hover:text-white active:scale-95
             transition-all border border-white/5"
>
  Prev
</button>
```

**Handler:** `handlePrevTarget` (App.tsx line 160):
```ts
const handlePrevTarget = () => { SoundEngine.playTap(); initRound({ indexShift: -1 }); };
```

**What it changes:** Calls `initRound({ indexShift: -1 })` → calls `PlatformEngineAdapter.prevTarget()` → decrements the shared engine's internal index → seeds a fresh grid for the previous target value. Resets: grid, trophiesEarned (→0), lastEquation, phase (→PLAYING), history (→null), flyout, countingTrophyId, pendingBombRefillCell.

---

### 2.2 Next Button

**Where rendered:** `App.tsx` line 366–371, inside `centerSlot` prop

```tsx
// App.tsx lines 366-371
<button
  onClick={handleNextTarget}
  className="bg-[#242426] px-3 sm:px-4 py-3.5 rounded-[16px] font-bold text-[11px] uppercase
             text-white/90 tracking-widest shadow-md hover:text-white active:scale-95
             transition-all border border-white/5"
>
  Next
</button>
```

**Handler:** `handleNextTarget` (App.tsx line 159):
```ts
const handleNextTarget = () => { SoundEngine.playTap(); initRound({ indexShift: 1 }); };
```

**What it changes:** Calls `initRound({ indexShift: 1 })` → calls `PlatformEngineAdapter.nextTarget()` → advances the shared engine's index → new target + new grid. Same full reset as Prev.

---

### 2.3 Check Oven Button

**Where rendered:** `App.tsx` lines 358–364, inside `centerSlot` prop

```tsx
// App.tsx lines 358-364
<button
  onClick={startCountingSequence}
  disabled={phase !== Phase.PLAYING}
  className="shrink-0 bg-gradient-to-b from-orange-500 to-orange-700 px-5 sm:px-7 py-3.5
             rounded-[20px] font-black text-[12px] uppercase tracking-[0.18em]
             shadow-[0_7px_0_rgba(154,52,18,1)] hover:brightness-110
             active:translate-y-1.5 active:shadow-none transition-all disabled:opacity-30
             text-white border-t border-white/20 whitespace-nowrap"
>
  Check Oven
</button>
```

**Handler:** `startCountingSequence` (App.tsx lines 162–182)

**What it does:** Triggers the end-of-round counting sequence manually. Disabled when `phase !== Phase.PLAYING`. See Part 4 for full counting sequence details.

**Dependency audit:** Check Oven is the **only** way to manually trigger the end sequence. Auto-trigger (stalemate detection) also calls the same function but only when `!moveRemains && trophies.length > 0`.

---

### 2.4 Undo Button

**Where rendered:** `GameControlsLayer.tsx` lines 41–48 (renders when `onUndo` prop is provided)

```tsx
// GameControlsLayer.tsx lines 41-48
{onUndo && (
  <button onClick={onUndo} className="...">
    Undo
  </button>
)}
```

**Wired from App.tsx line 346:**
```tsx
<GameControlsLayer
  onUndo={handleUndo}
  ...
/>
```

**Handler:** `handleUndo` (App.tsx lines 284–295):
```ts
const handleUndo = () => {
  SoundEngine.playTap();
  if (history && phase === Phase.PLAYING) {
    setGrid(history.grid);
    setTrophiesEarned(history.trophies);
    setLastEquation(history.lastEq);
    setTrophiesLifetimeEarned(history.lifetimeTrophies);
    setBombMilestonesTriggered(new Set(history.milestones));
    setPendingBombRefillCell(history.pendingBomb);
    setHistory(null);
  }
};
```

**What it changes:** Restores previous snapshot of: grid, trophiesEarned, lastEquation, trophiesLifetimeEarned, bombMilestonesTriggered, pendingBombRefillCell. Single-level undo only (`history` holds exactly 1 snapshot; cleared after use). Guard: disabled when `!history` or `phase !== PLAYING`.

---

### 2.5 Reset Button

**Where rendered:** `GameControlsLayer.tsx` lines 50–57 (renders when `onReset` prop is provided)

```tsx
// GameControlsLayer.tsx lines 50-57
{onReset && (
  <button onClick={onReset} className="...">
    Reset
  </button>
)}
```

**Wired from App.tsx line 347:**
```tsx
onReset={() => { SoundEngine.playTap(); initRound(); }}
```

**What it changes:** Calls `initRound()` with no config → calls `PlatformEngineAdapter.currentTarget()` (no index shift) → re-seeds the grid with the **same** target. Full round reset (same target, fresh grid).

---

### 2.6 Settings Button

**Two entry points:**

**A) Board HUD gear button** (primary, always visible):
`Board.tsx` lines 428–434:
```tsx
<button
  onClick={onOpenSettings}
  className="absolute w-12 h-12 rounded-2xl bg-[#3a322a] flex items-center justify-center
             text-white/80 shadow-lg active:scale-90 transition-transform border border-white/5"
  style={{ right: pad, top: (HUD_RESERVE_SPACE - 48) / 2 }}
>
  <svg ...><!-- gear icon --></svg>
</button>
```
Wired from App.tsx line 321: `onOpenSettings={() => { SoundEngine.playTap(); setIsSettingsOpen(true); }}`

**B) GameControlsLayer Settings button** (secondary, renders when `onSettings` prop provided):
`App.tsx` line 348: `onSettings={() => { SoundEngine.playTap(); setIsSettingsOpen(true); }}`

Both set `isSettingsOpen = true` → mounts `SettingsModal`.

**SettingsModal contents:** Grid size (rows/cols), target mode (Recipe/Practice/FreePlay), practice multiplier set, recipe targets, event log viewer with clear. Calls `onRestart(config)` → `initRound({ ...config, indexShift: 0 })`.

---

## PART 3 — CURRENT END CONDITION

### 3.1 How CombineGrid decides the game ends

There are **two** paths, both call `startCountingSequence()`:

**Path A — Automatic (stalemate detection):** `App.tsx` lines 253–258:
```ts
if (event.type !== 'SNAPBACK' && event.type !== 'SPAWN_TILE') {
  const moveRemains = Solver.hasAnyLegalMove(next, targetValue);
  if (!moveRemains && next.flat().some(t => t?.kind === TileKind.TROPHY)) {
    setTimeout(startCountingSequence, FX_TIMING.DRY_DELAY_MS);
  }
}
```
Guard: fires **only if** `!moveRemains` **AND** at least one TROPHY exists on the grid.
Delay: `FX_TIMING.DRY_DELAY_MS` (typically 1200ms) before calling `startCountingSequence`.

**Path B — Manual (Check Oven button):** App.tsx line 359:
```tsx
<button onClick={startCountingSequence} disabled={phase !== Phase.PLAYING}>
  Check Oven
</button>
```
Fires immediately when player presses it, regardless of move availability or trophy count.

### 3.2 Is "Check Oven" required to end the game?

**No** — the auto path (Path A) works independently. However, Path A has a critical gap: it only fires when trophies exist. If the player reaches a stalemate with **zero trophies**, the game is permanently stuck — no automatic end, and Check Oven becomes the only escape.

### 3.3 Existing move-detection function

`Solver.hasAnyLegalMove(grid, target)` — `services/Solver.ts` lines 5–27:

```ts
static hasAnyLegalMove(grid: (Tile | null)[][], target: number): boolean {
  const rows = grid.length, cols = grid[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t1 = grid[r][c];
      if (!t1 || t1.kind === TileKind.STONE) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const t2 = grid[nr][nc];
            if (!t2 || t2.kind === TileKind.STONE) continue;
            if (t1.kind === TileKind.TROPHY || t2.kind === TileKind.TROPHY) return true;
            if (t1.val === 0 || t2.val === 0) return true;
            return true;  // ← Any non-stone adjacent pair = legal move
          }
        }
      }
    }
  }
  return false;
}
```

> ⚠️ **Logic note:** The `return true` on line 20 triggers for **any** adjacent non-stone pair regardless of whether the merge is mathematically useful. `hasAnyLegalMove` returns `false` only when the grid contains only isolated tiles (no non-STONE tile has any non-STONE neighbor). This is effectively an "is the board totally isolated?" check, not a semantic "is there a productive move?" check.

`hasImmediateSolve(grid, target)` also exists (lines 29–48) but is **not currently called anywhere** in App.tsx — it is unused at runtime.

---

## PART 4 — TROPHY SYSTEM AUDIT

### 4.1 What is a trophy tile?

A TROPHY tile is created when two NUMBER tiles are merged and their product **exactly equals** `targetValue`.

**Creation logic** — `services/Engine.ts` lines 40–43:
```ts
if (res === targetValue) {
  kind = TileKind.TROPHY;
  event = 'MERGE_TROPHY';
}
```
Result: the merged cell becomes `TileKind.TROPHY` with `val = targetValue`.

If the product **exceeds** target: STONE (permanent, unmovable).
If the product is **less than** target: NUMBER (still playable).

### 4.2 When do trophies increase?

`trophiesEarned` is incremented **only inside `startCountingSequence()`** (lines 169–174), not at the moment of merge:
```ts
for (const t of trophies) {
  setCountingTrophyId(t.id);
  SoundEngine.playCountStep(count);
  await new Promise(r => setTimeout(r, FX_TIMING.COUNT_STEP_MS));
  count++;
  setTrophiesEarned(count);  // increments one per animation step
}
```
`trophiesLifetimeEarned` is incremented immediately on each `MERGE_TROPHY` event (App.tsx line 202–203):
```ts
if (event.type === 'MERGE_TROPHY' && event.sourceCell) {
  const newLifetime = trophiesLifetimeEarned + 1;
  setTrophiesLifetimeEarned(newLifetime);
```

### 4.3 Where is trophy count stored?

| Variable | Scope | Reset on |
|---|---|---|
| `trophiesEarned` | Session (current round) | `initRound()` → set to 0 |
| `trophiesLifetimeEarned` | Cumulative (in-memory only) | Never (lost on page refresh) |
| `countingTrophyId` | Animation cursor | Cleared at end of counting sequence |

No persistence layer (localStorage, server) exists.

### 4.4 How is trophy count displayed?

**A) Board HUD Target Pill badge** (`Board.tsx` line 415):
```tsx
<div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5
               rounded-full font-bold border border-white shadow-sm animate-bounce">
  {lifetimeCount}
</div>
```
Shows `trophiesLifetimeEarned` (cumulative) as a bouncing amber badge on the target pill.

**B) Platform GameHUD** (`App.tsx` line 301–305):
```tsx
<GameHUD
  target={targetValue}
  score={trophiesEarned}
  mode="CombineGrid"
/>
```
Shows `trophiesEarned` (session) as "Score" in the top HUD bar.

**C) Phase.RESULTS modal** (`App.tsx` line 332–333):
```tsx
<h2 ...>Golden Batch</h2>
<p ...>{trophiesEarned} Trophies Baked</p>
```
Shows session trophies in the end-of-round splash.

### 4.5 Existing animations/sounds for trophy earn

- `SoundEngine.playMergeTrophy()` — plays immediately on `MERGE_TROPHY` event (App.tsx line 188)
- `FlyoutPill` component — animates equation text from tile location → equation tracker in Board HUD. Triggered by `onTrophyCreated` callback (App.tsx lines 266–273). Shows "Trophy Earned" text at animation peak, plays `mergeTrophy` sound.
- `SoundEngine.playCountStep(count)` — plays during counting sequence, once per trophy (line 171)
- `SoundEngine.playResultsFanfare()` — plays when transitioning to RESULTS phase (line 179)
- Board dims to 30% opacity during COUNTING phase: `isDimmed={phase === Phase.COUNTING}` (line 322)
- Currently counting trophy is highlighted via `highlightedTileId={countingTrophyId}` (line 323)

### 4.6 Existing final scoring / end screen logic

**Phase.COUNTING** — `startCountingSequence()` (App.tsx lines 162–182):
1. Guard: `if (phase !== Phase.PLAYING) return;`
2. Sets `phase = COUNTING`
3. Iterates all TROPHY tiles on grid, highlights each, plays a sound, waits `COUNT_STEP_MS`
4. After loop: clears `countingTrophyId`, waits 600ms, plays fanfare, sets `phase = RESULTS`

**Phase.RESULTS modal** (App.tsx lines 329–342):
```tsx
{phase === Phase.RESULTS && (
  <div className="absolute inset-0 z-[50000] bg-black/90 flex flex-col items-center justify-center
                  p-12 animate-[slide-up_0.5s_cubic-bezier(.17,.67,.83,.67)]">
    <div className="bg-zinc-900 border border-white/10 p-10 rounded-[40px] ...">
      <h2 className="text-3xl font-black text-amber-500 mb-1 uppercase italic tracking-tighter">
        Golden Batch
      </h2>
      <p className="text-base font-bold text-zinc-500 mb-8 tracking-[0.2em] uppercase">
        {trophiesEarned} Trophies Baked
      </p>
      <button
        onClick={() => { SoundEngine.playTap(); initRound({ indexShift: 1 }); }}
        className="bg-orange-600 w-full py-5 rounded-2xl font-black text-xl ..."
      >
        Continue
      </button>
    </div>
  </div>
)}
```
Z-index: `z-[50000]` — above everything. Slide-up animation on appear. CTA: "Continue" → `initRound({ indexShift: 1 })` (next target).

---

## PART 5 — "NEXT PROBLEM" / PROGRESSION AUDIT

### 5.1 Does CombineGrid have a problem index/level system?

**Yes.** The progression system is the `PlatformEngineAdapter` wrapping a shared `GridEngine` singleton (`src/engine/public`).

**Internal state:** The shared engine maintains a `currentIndex` (internal to the platform engine, not directly accessible as state). `PlatformEngineAdapter` exposes:
- `nextTarget()` — advances index, returns next target value
- `prevTarget()` — decrements index, returns previous target value
- `currentTarget()` — returns current index's target without shifting

### 5.2 Does Next/Prev already advance a problem stream?

**Yes.** Both buttons call `initRound({ indexShift: ±1 })`, which routes to:
```ts
if (config?.indexShift > 0) val = PlatformEngineAdapter.nextTarget();
else val = PlatformEngineAdapter.prevTarget();
```

In `RECIPE` mode (the default), the recipe is `[12, 15, 24, 32, 56]`. Index cycles modulo recipe length (wraps around at end). So the stream is: 12 → 15 → 24 → 32 → 56 → 12 → 15 → ...

In `PRACTICE` mode: each call generates a fresh random target from the multiplier set.

### 5.3 Canonical progression function

The canonical "advance to next problem" call is:
```ts
initRound({ indexShift: 1 })
```
This is already used by:
- The existing "Continue" button in Phase.RESULTS modal (line 335)
- The `Next` button in the control bar (line 159: `handleNextTarget`)

No new progression infrastructure is needed. "Next Problem" button should call `initRound({ indexShift: 1 })` — the same call already wired to "Continue".

---

## PART 6 — RISK + RECOMMENDED IMPLEMENTATION PLAN (NO CODE)

### 6.1 Summary of What Needs to Change

Based on the audit:

| Requirement | Current State | Gap |
|---|---|---|
| Remove Check Oven | Exists at App.tsx lines 358–364, inside `centerSlot` | Delete 7-line button block |
| Auto-gameover on no moves | Fires only when `!moveRemains && trophies.length > 0` | Must also fire when `trophies.length === 0` |
| Phase 1: "No moves left" announcement | Does not exist | New: brief overlay or toast before counting |
| Phase 2: Trophy count-up | Already implemented in `startCountingSequence()` | No change needed |
| Phase 3: Final splash — "FINAL TROPHIES: {n}" + "Next Problem" | Exists as "Golden Batch" / "{n} Trophies Baked" / "Continue" | Change title text, subtitle text, button label |

### 6.2 Smallest Safe Implementation Plan

**Step A — Remove Check Oven** (App.tsx, centerSlot)
- Delete the `<button onClick={startCountingSequence} ...>Check Oven</button>` block (lines 358–364).
- Leave Prev and Next buttons in place. No layout changes needed — `centerSlot` is a flex row and will simply center the remaining two buttons.
- `startCountingSequence` itself is still called by auto-detection and remains intact.

**Step B — Fix stalemate detection to fire on zero trophies**
- App.tsx line 255: Change the guard condition from:
  ```ts
  if (!moveRemains && next.flat().some(t => t?.kind === TileKind.TROPHY)) {
  ```
  to:
  ```ts
  if (!moveRemains) {
  ```
- This causes the end sequence to trigger even on a zero-trophy stalemate. No other logic changes needed.

**Step C — Add Phase 1: "No moves left" announcement**
- Two viable approaches:

  **Option C1 (preferred): `addToast` call before counting**
    - Before calling `startCountingSequence`, call `addToast("No moves left!", "info")` (or similar).
    - Add a small delay (e.g. 800ms) so the toast is visible before the COUNTING phase begins.
    - Risk: minimal — `useToast` already imported and used in App.tsx (line 22).
    - Limitation: toast is ephemeral and overlapping with board; may not feel like a formal "announcement."

  **Option C2: Inline announcement state**
    - Add `const [showNoMoves, setShowNoMoves] = useState(false)` state.
    - When stalemate detected: set `showNoMoves = true`, wait 1–1.5s, then call `startCountingSequence`.
    - Render a simple `{showNoMoves && <NoMovesOverlay />}` inside the `<main>` block, similar to the RESULTS modal (`absolute inset-0 z-[50000]`).
    - Clear `showNoMoves` at start of `startCountingSequence` (or on `initRound`).
    - Risk: slightly more state, but fully local to App.tsx. Cleanest UX — full-screen announcement.
    - **Recommended** for UX fidelity.

  > No new component file is strictly needed. The overlay can be an inline JSX fragment in App.tsx (same pattern as the RESULTS modal). If it grows beyond ~15 lines, extract to `components/NoMovesOverlay.tsx` — also CombineGrid-local, no shared component changes.

**Step D — Update Phase.RESULTS modal text**
- `App.tsx` lines 332–333: Change three text strings only:
  - `"Golden Batch"` → `"GAME OVER"` (or whatever final title the user specifies)
  - `"{trophiesEarned} Trophies Baked"` → `"FINAL TROPHIES: {trophiesEarned}"`
  - `"Continue"` → `"Next Problem"`
- No structural JSX changes, no logic changes, no z-index changes (already `z-[50000]`).

### 6.3 Risks and Ambiguities

| Risk | Severity | Notes |
|---|---|---|
| `startCountingSequence` has guard `if (phase !== Phase.PLAYING) return` | Safe | Guard is correct — prevents double-fire. Stalemate detection only fires from PLAYING state. |
| Zero-trophy stalemate path skips COUNTING phase animation | Low | `startCountingSequence` already handles empty trophies array gracefully — the for-loop runs zero iterations, then transitions to RESULTS after 600ms. No change needed. |
| `Solver.hasAnyLegalMove` returns `true` for virtually any board with adjacent non-stone pairs | Known limitation | This is a known simplification. The function is not semantically smart — it just checks adjacency, not productive moves. This is acceptable for the current implementation. No change needed. |
| `addToast` approach (Option C1) may not be visually prominent enough | Medium | Toast notifications are typically small and may not feel like a game moment. Option C2 (overlay) is recommended for UX quality. |
| Removing Check Oven with no trophy-count stalemate fix: player stuck forever with 0 trophies | **High — must fix together** | Step B (fix stalemate detection) MUST accompany Step A (remove Check Oven). These must be in the same commit. |
| Phase.RESULTS modal uses `{trophiesEarned}` which is set during COUNTING | Safe | `trophiesEarned` is updated live during counting; by the time RESULTS phase shows, it reflects the final count. |
| `GameControlsLayer` `onSettings` prop wired in vnext | Noted | CombineGrid-vnext passes `onSettings` to GameControlsLayer (line 348), rendering a "Settings" text button in the lower bar alongside Undo/Reset. This is separate from the Board HUD gear button. Both open the same modal. This is existing behavior; no change needed unless the user wants to remove the duplicate Settings entry. |

### 6.4 Files That Will Change

Only **one file** needs to change for all four steps:

```
games/combine-grid-vnext/combinegrid-v9/App.tsx
```

Optionally, if the "No moves left" overlay is extracted for cleanliness:
```
games/combine-grid-vnext/combinegrid-v9/components/NoMovesOverlay.tsx  (NEW, if needed)
```

**No shared platform files need to change** (GameControlsLayer, GameHUD, ToastContext).
**No SpeedGrid files touch** this work.

---

*Audit complete. No code has been modified. Awaiting approval to proceed with implementation.*
