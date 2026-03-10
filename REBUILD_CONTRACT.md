# Rebuild Contract
**Project:** Cinn Math — GridMath Platform
**Status:** LOCKED
**Established:** 2026-03-10
**Authority:** Baseline Reconstruction Packet (ARCHITECTURE.md, FOLDER_STRUCTURE.md, PRESERVED_MODULES.md)

---

> This document is a hard constraint document, not a guideline.
> Every rule below is binding for the duration of the reconstruction build (Phases 1–8).
> No rule may be relaxed without explicit written approval from the project owner.
> Improvement, refactoring, and convergence are deferred to post-verification phases.

---

## 1. Runtime Entry Chain (Locked)

The one and only permitted runtime boot path is:

```
index.html
  → src/main.tsx
    → GameSelector
      → CombineGridGame   (game === "combine-grid")
      → SpeedGridGame     (game === "speed-grid")
```

**Rules:**
- `src/main.tsx` is the single `ReactDOM.createRoot()` call in the entire project.
- No other file may call `ReactDOM.createRoot()` or `ReactDOM.render()`.
- The following file **must not exist** in the rebuilt project because it creates a competing root:
  - `src/games/combine-grid/index.tsx`
- No alternate entry points, no legacy root wrappers, no duplicate app shells.

**Verification:** `grep -r "ReactDOM.createRoot\|ReactDOM.render" src/` must return exactly one result: `src/main.tsx`.

---

## 2. Board Geometry Rules (Locked)

**Default board dimensions:**
| Property | Value |
|---|---|
| Rows | 7 |
| Columns | 5 |

SpeedGrid may override `rows` if required by its game design but must still use the same layout math formula.

**Authoritative tile size formula:**
```ts
tileSize = Math.min(
  Math.floor(availableHeight / rows),
  Math.floor(availableWidth / cols),
  MAX_TILE_SIZE
)
```

**Forbidden:**
- Any `transform: scale(...)` applied to the board or its container after tile size is computed.
- Any CSS `zoom`, `scale`, or viewport-unit upscaling used to "fit" the board post-render.
- Tile size set independently of the above formula.

The board must fit the available container by computing the correct tile size upfront, not by scaling a fixed-size board afterward.

---

## 3. CombineGrid UI Contract (Locked)

The file `src/games/combine-grid/COMBINE_GRID_UI_CONTRACT.md` defines a protected layout, geometry, factor, shadow, and z-index contract.

**During reconstruction (Phases 1–8), the following files are read-only for logic and layout:**

| File | Protected Sections |
|---|---|
| `src/games/combine-grid/components/Board.tsx` | All sizing math: `GRID_SCALE`, `SAFE_MARGIN`, `BORDER_WIDTH`, `GAP`, `PAD`, `maxTileW`, `maxTileH`, `tileSize` derivation |
| `src/games/combine-grid/components/Tile.tsx` | All visual logic: `getVisuals()`, shadow composition, factor glow, typography |
| `src/games/combine-grid/uiTokens.ts` | All token values |

**Import path updates to these files are permitted. Logic changes are not.**

`src/grid/GridSizing.ts` **must not be imported by any CombineGrid file** during Phases 1–8.

CombineGrid adopting `GridSizing.ts` is a future convergence task, planned after verified feature parity.

---

## 4. Shared Grid Layer (Structural Only)

The following files exist in `src/grid/` but serve as **future migration targets only** during reconstruction:

| File | Role During Reconstruction |
|---|---|
| `src/grid/GridBoard.tsx` | Structural slot renderer — available but not required by games yet |
| `src/grid/GridTile.tsx` | Base lighting model tile — available but not required by games yet |
| `src/grid/GridSizing.ts` | Documented formula stub — not imported by any game |
| `src/grid/GridInputController.ts` | Empty placeholder — not imported by any game |

**Restrictions:**
- `GridBoard.tsx` must not use a render-prop pattern. It renders grid slots only. Games render their own tile components into those slots.
- `GridInputController.ts` must remain unwired during Phases 6 and 7.
- `GridSizing.ts` must remain unwired during Phases 6 and 7.
- CombineGrid must continue using its own `components/Board.tsx` as its board renderer.

**Verification:** `grep -r "from.*src/grid/" src/games/` must return zero results after Phase 8.

---

## 5. Interaction Rules (Locked)

### CombineGrid Interaction Model
```
pointer down on tile → drag to adjacent tile
pointer up → resolve swap/merge
  result === target   → MERGE_TROPHY (trophy tile created)
  result > target     → MERGE_STONE  (stone tile, fixed)
  result < target     → MERGE_STANDARD (number tile, playable)
zero tile involved    → ZAP sequence
bomb tile tapped      → BOMB_IGNITE sequence
no adjacent moves     → stalemate detection → startCountingSequence
```

Implemented in: `src/games/combine-grid/components/Board.tsx` (`handlePointerDown`, `handlePointerMove`, `handlePointerUp`)

### SpeedGrid Interaction Model
```
pointer down on tile → start chain
pointer move to adjacent tile → extend chain (diagonal allowed)
pointer move back to previous tile → backtrack chain
pointer up → evaluate chain
  chain value === target → score + gravity + refill + new target
  chain value !== target → discard chain, no penalty
```

Implemented in: `src/games/speed-grid/SpeedGridGame.tsx` (`handleGridPointerDown`, `handleGridPointerMove`, `handleGridPointerUp`)

**Neither interaction system may be redesigned, consolidated, or replaced during reconstruction.**

---

## 6. Systems Layer (Locked)

The following systems must be moved to `src/systems/` (flat structure) with import path updates only. Zero logic changes.

| System | Source Path | Target Path |
|---|---|---|
| GravitySystem | `src/systems/gravity/GravitySystem.ts` | `src/systems/GravitySystem.ts` |
| GravityAnimator | `src/systems/gravity/GravityAnimator.ts` | `src/systems/GravityAnimator.ts` |
| ChainSelector | `src/systems/input/ChainSelector.ts` | `src/systems/ChainSelector.ts` |
| ScoreSystem | `src/systems/score/ScoreSystem.ts` | `src/systems/ScoreSystem.ts` |
| TimerSystem | `src/systems/time/TimerSystem.ts` | `src/systems/TimerSystem.ts` |

SpeedGrid's game-level re-export bridges (e.g. `src/games/speed-grid/gravity/GravitySystem.ts`) must be updated to point to the new flat paths. No other changes.

---

## 7. Reconstruction Principle

```
Structure correction without behavior change.
```

The rebuilt project must produce **identical runtime behavior** to the exported baseline in `CODEBASE_EXPORT.txt`.

The only permitted changes during Phases 1–8 are:
- File locations (moves within the target folder structure)
- Import path strings (updated to reflect new locations)
- One file rename: `App.tsx` → `CombineGridGame.tsx` (exported component name updated accordingly)
- Deletion of prohibited files (competing roots, deprecated stubs)

Everything else is frozen.

---

## 8. Verification Requirement

Before Phase 9 (hyper-commenting) may begin, all of the following must be confirmed:

| Check | Method |
|---|---|
| CombineGrid boots and runs correctly | Manual: launch, play a round, check HUD, settings, undo, reset |
| SpeedGrid boots and runs correctly | Manual: launch, drag chain, verify score/timer, game over flow |
| Both games launch from GameSelector splash | Manual: verify back buttons return to splash |
| No legacy paths remain | `grep -r "platform/grid/ui\|platform/controls\|platform/hud" src/` returns zero results |
| No duplicate entry points | `grep -r "ReactDOM.createRoot\|ReactDOM.render" src/` returns exactly one result |
| No game imports from `src/grid/` | `grep -r "from.*src/grid/" src/games/` returns zero results |
| Build completes without TypeScript errors | `npm run build` exits 0 |

Phase 9 begins only after all eight checks pass.

---

## 9. Files Prohibited in Rebuilt Project

These files must not exist:

| File | Reason |
|---|---|
| `src/games/combine-grid/index.tsx` | Competing ReactDOM root |
| `src/games/combine-grid/services/DistributionController.ts` | Explicitly deprecated stub |
| `src/games/combine-grid/services/TargetGenerator.ts` | Deprecated stub (logic lives in `src/engine/`) |
| `src/games/combine-grid/services/GridDistributionPolicy.ts` | Deprecated empty export |
| `src/games/combine-grid/components/Controls.tsx` | Not mounted, dead code |
| `src/games/combine-grid/components/OpsTray.tsx` | Not mounted, dead code |
| `src/ui/settings/` (entire folder) | Orphaned legacy files, no active game imports them |
| `src/platform/grid/` (entire folder) | Superseded by `src/grid/` stub layer |

---

## 10. Change Control

Any deviation from this contract during Phases 1–8 requires:
1. A written description of what is being changed and why
2. Explicit approval from the project owner
3. An update to this document before the change is implemented

**No silent improvements. No mid-build refactors. No "while I'm here" changes.**

---

*Contract locked. Implementation begins on owner approval.*
