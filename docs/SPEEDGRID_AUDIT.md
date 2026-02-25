# SpeedGrid Audit — SG-0

**Date:** 2026-02-25
**Branch:** claude/build-gridmath-system-KED9N

---

## 1. Exact Component Mounted When SpeedGrid Is Selected

| Item | Value |
|------|-------|
| **File** | `games/speed-grid/ui/SpeedGridGame.tsx` |
| **Export** | `default SpeedGridGame` (re-exported via `games/speed-grid/index.ts`) |
| **Selection** | Direct conditional render in `GameSelector.tsx` |

### How selection works

`src/platform/GameSelector.tsx` holds a `useState<GameType>("combine-grid")` and conditionally mounts:

```tsx
// GameSelector.tsx line 65-67
{game === "combine-grid" && <CombineGridGame />}
{game === "speed-grid" && <SpeedGridGame />}
```

There is also a lazy-import registry at `src/platform/registry.ts`, but it is **not used** by the live GameSelector — `SpeedGridGame` is imported statically at line 5.

---

## 2. SpeedGrid UI Components That Exist in the Repo

### Root / Entry

| File | Description |
|------|-------------|
| `games/speed-grid/ui/SpeedGridGame.tsx` | Root game component — mounts all sub-components |
| `games/speed-grid/index.ts` | Module entry re-export |

### HUD / Header

| File | Description |
|------|-------------|
| `src/platform/hud/GameHUD.tsx` | Shared HUD — renders **Target**, **Score** (left), **Timer** (center-absolute) |

### Grid / Viewport

| File | Description |
|------|-------------|
| `src/platform/grid/GridViewport.tsx` | Flex-1 container with `overflow-hidden`, `aspect-square` inner wrapper |
| `src/platform/grid/useGridMetrics.ts` | Hook that measures the viewport and computes `cellSize` |

### Controls / Footer

| File | Description |
|------|-------------|
| `src/platform/controls/GameControlsLayer.tsx` | Bottom bar — **Next** button, **Settings** button, `centerSlot` (shows running sum/product) |

### Modal — Game Over

Inline in `SpeedGridGame.tsx` (lines 325–340): `phase === 'GAMEOVER'` guard → **"TIME UP!"** overlay with **Play Again** button.

### Modal — Settings / Mode Selector

| File | Description |
|------|-------------|
| `games/speed-grid/ui/SettingsMenu.tsx` | Full-screen overlay; two buttons for **Addition** / **Multiply** mode |

### State / Engine

| File | Description |
|------|-------------|
| `games/speed-grid/core/GameState.ts` | Type definitions: `GamePhase`, `GameState` |
| `games/speed-grid/adapter/EngineAdapter.ts` | Wraps `EngineSession`; `initializeGame`, `computeTarget`, `getRefill` |
| `games/speed-grid/timer/TimerSystem.ts` | Re-export of `src/systems/time` |
| `games/speed-grid/scoring/ScoreSystem.ts` | Re-export of `src/systems/score` |
| `games/speed-grid/gravity/GravitySystem.ts` | Re-export of `src/systems/gravity` |

---

## 3. Why TARGET Is Not Visible — Root Cause

### Short answer: visual occlusion by the GameSelector debug panel

The HUD **is mounted**, TARGET **is in the DOM** with a valid value (`12` on init, updated from engine), and there is **no CSS clipping** on the HUD container. The HUD is not the problem.

### The occluder

`src/platform/GameSelector.tsx` renders an absolutely-positioned debug tab strip at the very start of its render tree:

```tsx
// GameSelector.tsx lines 20-62
<div style={{
  position: "absolute",
  top: 10,
  left: 10,
  zIndex: 9999,                        // ← much higher than anything in SpeedGridGame
  background: "rgba(0,0,0,0.65)",      // ← opaque enough to hide text behind it
  padding: 10,
  borderRadius: 10,
  display: "flex",
  gap: 8
}}>
  <button>CombineGrid</button>
  <button>SpeedGrid</button>
</div>
```

This panel is a **sibling** of `<SpeedGridGame />` in the DOM and is positioned in the same stacking context. Stacking order within a context follows z-index, so:

| Element | z-index | Paints |
|---------|---------|--------|
| Debug tab panel | 9999 | Last (on top) |
| GameHUD (inside SpeedGridGame) | 50 (`z-50`) | Below debug panel |

The GameHUD renders Target and Score in its **left section** starting at approximately `x = 16px` (from `px-4`), `y ≈ 30px` (vertically centred in the 60 px bar). The debug panel occupies roughly `x: 10–250 px, y: 10–70 px` — exactly covering that region.

The **Timer** escapes occlusion because it is rendered as:

```tsx
// GameHUD.tsx line 61
<div className="absolute left-1/2 -translate-x-1/2 ...">
  {time}s
</div>
```

`left-1/2` centres it in the viewport (≈ 50 % of width), well outside the `left: 10` debug panel.

### Code proof — HUD is correctly wired

```tsx
// SpeedGridGame.tsx lines 32, 228-233
const [target, setTarget] = useState(12);   // ← initialised to 12

<GameHUD
  target={target}   // ← always defined (≥ 12)
  score={score}
  time={timeLeft}
  mode="SpeedGrid"
/>
```

```tsx
// GameHUD.tsx lines 42-47
{target !== undefined && (
  <div className="flex items-center gap-1">
    <span className="text-white/60 text-xs uppercase">Target</span>
    <span className="text-white text-lg font-black">{target}</span>
  </div>
)}
```

`target` is never `undefined` — the guard is always true. The element exists in the DOM. It is simply painted beneath the debug panel's opaque background.

### Summary

| Hypothesis | Verdict |
|-----------|---------|
| HUD not mounted | ✗ — `<GameHUD>` is at line 228 of `SpeedGridGame.tsx` |
| HUD renders null due to missing state | ✗ — `target` initialised to `12`; guard `!== undefined` always passes |
| CSS clipping (`overflow: hidden`) | ✗ — GameHUD has `shrink-0`; only `GridViewport` has `overflow-hidden` (grid area only) |
| Visual occlusion by debug tab panel (z: 9999 > z: 50) | **✓ — ROOT CAUSE** |

---

## 4. HUD Elements — Inventory vs Contract

| Contract item | In DOM? | Visible? | Notes |
|--------------|---------|----------|-------|
| TARGET ## | ✓ | ✗ | Occluded by debug panel |
| Score | ✓ | ✗ | Occluded by debug panel |
| Timer | ✓ | ✓ | Centred, outside debug panel footprint |
| Multiply dropdown / mode selector | ✓ | ✓ (behind Settings button) | `SettingsMenu.tsx` — opens on Settings click |
| "Drag to chain tiles" hint | partial | ✓ | "Select Tiles" text in `GameControlsLayer` center slot when chain is empty |
| New Game button | ✓ | ✓ | "Next" button in `GameControlsLayer` |
| Time Up modal + Play Again | ✓ | ✓ (when `phase === 'GAMEOVER'`) | Inline in `SpeedGridGame.tsx` |

---

## 5. SG-1 Fix Applied

**File changed:** `src/platform/GameSelector.tsx`

The wrapper div was given `position: "relative"` (so the absolute child anchors within it rather than an arbitrary ancestor), and the debug panel's `top` was made conditional:

```diff
-<div style={{ width: "100%", height: "100%" }}>
+<div style={{ width: "100%", height: "100%", position: "relative" }}>

   <div style={{
     position: "absolute",
-    top: 10,
+    top: game === "speed-grid" ? 68 : 10,   // clear the 60 px GameHUD when SpeedGrid active
     left: 10,
     zIndex: 9999,
     ...
   }}>
```

- When **CombineGrid** is active: panel stays at `top: 10` → **pixel-identical to current deployed build** ✓
- When **SpeedGrid** is active: panel moves to `top: 68` (8 px below the 60 px GameHUD) → TARGET and Score are no longer occluded ✓
