# Combine Grid UI Contract

**Version:** 1.3
**Status:** LOCKED
**Established:** 2026-03-04
**Last revised:** 2026-03-04 (Phase 3B — Mobile Vertical Layout Optimization)
**Source of truth file:** `uiTokens.ts`
**Shared system root:** `src/platform/ui/` (animTokens.ts, tileStyles.ts, HUDShell.tsx)

---

## Overview

This document defines the invariant layout, geometry, factor, shadow, and z-index contracts for the CombineGrid game (`combinegrid-v9`). All values in this document are derived from the currently running, verified implementation.

**Absolute rule:** No changes to layout math, factor logic, tile geometry, or grid sizing may occur without explicitly updating this document and `uiTokens.ts` in the same commit.

The following files are under contract:
- `App.tsx`
- `components/Board.tsx`
- `components/Tile.tsx`
- `uiTokens.ts` (this document's source of truth)

The following **shared platform files** are used by CombineGrid and may not be modified to add game-specific logic:
- `src/platform/ui/animTokens.ts` — timing tokens only; no game logic
- `src/platform/ui/tileStyles.ts` — lighting model only; no factor/bomb/trophy logic
- `src/platform/ui/HUDShell.tsx` — structural layout only; no game state

---

## 1. Grid Dominance Policy

### Token values (from `uiTokens.ts`)

| Token | Value | Unit | Description |
|---|---|---|---|
| `SAFE_MARGIN` | 5 | px | Gap between board edge and viewport edge, each side |
| `BORDER_WIDTH` | 5 | px | Board border thickness, all sides |
| `GAP` | 2 | px | Gap between adjacent tiles |
| `PAD` | 6 | px | Board inner padding, all sides |

### Board width formula

```
targetBoardW = min(window.innerWidth − SAFE_MARGIN×2, parentContainerRect.width)
maxTileW     = floor((targetBoardW − BORDER_WIDTH×2 − (cols−1)×GAP − 2×PAD) / cols)
```

`boardW` in the render is **always derived from `tileSize`**, never set independently:

```
boardW = PAD×2 + cols×tileSize + (cols−1)×GAP + BORDER_WIDTH×2
```

This ensures the board never overflows the computed target width.

### Tile size resolution

```
tileSize = max(30, min(maxTileW, maxTileH, 110))
```

The `110` cap prevents oversized tiles on large screens. The `30` floor prevents unusable tiles.

### Height path

Height is **unchanged** by the Grid Dominance Policy. It is computed from the parent container height via `GRID_SCALE`:

```
usableH  = (parentRect.height − BORDER_WIDTH×2 − 4 − HUD_RESERVE_SPACE) × GRID_SCALE
maxTileH = floor((usableH − (rows−1)×GAP − 2×PAD) / rows)
```

`GRID_SCALE = 1.03` applies **only to the height path**. It is not applied to horizontal sizing.

### App.tsx layout requirements

- `<main>` must have **zero horizontal padding**.
- Vertical padding: `pt-2 pb-1 sm:pt-3 sm:pb-1` (Phase 3B: tightened from `pt-4 pb-2 sm:pt-6 sm:pb-3` — visual breathing room only, no effect on tile size calculation).
- `<main>` retains `overflow-hidden` (board fits within container; no clipping occurs by design).
- The outer `max-w-[520px] sm:max-w-[600px] lg:max-w-[760px]` container enforces the desktop cap.

### HUD chrome heights (Phase 3B)

| Element | Height | Source |
|---|---|---|
| HUDTopBar | 54px | `HUDShell.tsx` `h-[54px]` (was 58px in Rev 1.2) |
| HUDBottomBar | ~72px | `pt-2(8) + 48px icons + pb-4(16)` = 72px (was ~84px in Rev 1.2) |

**Rev 1.3 change:** Total chrome reduced by 16px (58→54 top, 84→72 bottom). This reclaims 16px of vertical space for the grid area on all viewport sizes. Tile size formula and grid math are **unchanged**; the tileSize increases organically as the parent container grows.

**Verified viewport fit (no scrolling required):**

| Viewport height | Main area | maxTileH (6-row grid) | Controls visible |
|---|---|---|---|
| 390px (landscape mobile) | 264px | 39px | ✓ |
| 430px | 304px | 46px | ✓ |
| 768px (tablet portrait) | 642px | 104px (capped 110) | ✓ |

### Behavior by viewport

| Viewport | Container width | targetBoardW | Governing constraint |
|---|---|---|---|
| ≤520px mobile | ≈viewport | `innerWidth − 10` | Viewport-driven |
| 520–600px tablet portrait | 520px | min(innerWidth−10, 520) | Container-capped |
| 600–760px tablet landscape | 600px | min(innerWidth−10, 600) | Container-capped |
| ≥760px desktop | 760px | min(innerWidth−10, 760) | Container-capped |

---

## 2. Tile Geometry Contract

### Token values (from `uiTokens.ts`)

| Token | Value | Unit | Applies to |
|---|---|---|---|
| `BASE_RADIUS_PX` | 16 | px | Tile corner radius (default) |

### Radius inventory

| Element | Value | Source |
|---|---|---|
| Tile corner radius | 16px | `BASE_RADIUS_PX` (via `uiTokens.ts`) |
| Board slot corner radius | 16px | hardcoded `'16px'` in Board.tsx (must match `BASE_RADIUS_PX`) |
| Equation pill (EquationTracker) | 24px (`rounded-3xl`) | Tailwind class |
| Bottom bar icon buttons | fully circular (`rounded-full`) | Tailwind class |
| Top bar target tile | 16px (`rounded-2xl`) | Tailwind class |
| Top bar back button | 16px (`rounded-2xl`) | Tailwind class |
| Bottom tray container | specified: 24px | reserved for future application |

### Rules

- No component may define a tile corner radius independently.
- The `lockedRadiusPx` prop on `<Tile>` is the **only** permitted override, used exclusively for tray preview tiles.
- Board slot radius must stay in sync with `BASE_RADIUS_PX`.

---

## 3. Factor Eligibility Contract

### Eligibility rule (locked — Option A)

A tile is eligible for factor glow if and only if:

```
tile.kind === TileKind.NUMBER  &&  tile.val !== 0  &&  target % tile.val === 0
```

This is evaluated in `Board.tsx` and passed to `<Tile>` as `isFactorOfTarget`.

**Inclusions (Option A):**
- `val === 1` is included (all non-zero values that divide target evenly)
- `val === target` is included (target divides itself)

**Exclusion:**
- `val === 0` is always excluded (division by zero)

### Safety net in Tile.tsx

Even if `isFactorOfTarget` is somehow passed as `true` for a zero tile, `Tile.tsx` applies a redundant guard:

```ts
const isFactor = isFactorOfTarget && tile.val !== 0 && !zapping && !isDragging;
```

### Visual variants

| Condition | Visual | CSS class | Animation |
|---|---|---|---|
| `val === 0` | No glow, never | — | — |
| `val === 1`, `isFactor` | Sky-blue ring | `factor-glow-one` | `factor-reveal-one` |
| `val > 1`, `isFactor` | Warm orange ring | `factor-glow` | `factor-reveal` |

### Token values (from `uiTokens.ts`)

| Token | Value | Role |
|---|---|---|
| `FACTOR_WARM_OUTLINE` | `rgba(249,115,22,0.75)` | Orange ring, settled state |
| `FACTOR_WARM_GLOW` | `rgba(249,115,22,0.40)` | Orange halo, settled state |
| `FACTOR_ONE_OUTLINE` | `rgba(56,189,248,0.75)` | Sky-blue ring, settled state |
| `FACTOR_ONE_GLOW` | `rgba(56,189,248,0.35)` | Sky-blue halo, settled state |
| `FACTOR_REVEAL_DURATION_MS` | `ANIM_REVEAL` (650ms) | ms, one-shot animation duration |

**Rev 1.1 change:** opacity raised (0.55→0.75 outline, 0.20–0.25→0.35–0.40 halo) for better readability on small screens. Warm/cool distinction preserved.

**Rev 1.2 change:** `FACTOR_REVEAL_DURATION_MS` now derives from `ANIM_REVEAL` in `src/platform/ui/animTokens.ts` instead of being a hardcoded literal. The value (650ms) is unchanged.

### Animation rules

- Both `factor-reveal` and `factor-reveal-one` are **one-shot** (`animation-fill-mode: forwards`).
- No infinite pulse. No looping.
- Animation replays correctly on tile remount (new round = new tile IDs).
- Factor glow is suppressed during drag (`isDragging`) and zap (`isZapTarget`).

---

## 4. Shadow Contract

### Shadow override priority (strict, top = highest)

```
1. Zap:         0 0 24px rgba(34,211,238,0.8), inset 0 0 12px rgba(34,211,238,0.3), 0 3px 0 rgba(0,0,0,0.2)
2. Drag:        0 20px 40px rgba(0,0,0,0.65), 0 6px 0 rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.15)
3. TrayOp:      none
4. isOneFactor: 0 0 0 3px FACTOR_ONE_OUTLINE, 0 0 16px FACTOR_ONE_GLOW, 0 4px 0 rgba(0,0,0,0.32)
5. isWarmFactor:0 0 0 3px FACTOR_WARM_OUTLINE, 0 0 16px FACTOR_WARM_GLOW, 0 4px 0 rgba(0,0,0,0.32)
6. baseShadow:  tile-type default (see table below)
```

**Rev 1.1 changes:**
- Drag shadow: stronger lift (`0 20px 40px` vs `0 16px 32px`) with inset shine
- Factor ring: 2px → 3px; glow radius: 10px → 16px

### Base shadow tokens (shared — from `src/platform/ui/tileStyles.ts`)

**Rev 1.2:** These are no longer local constants in Tile.tsx. They are imported from the shared `tileStyles.ts` module under `src/platform/ui/`. The values are unchanged from Rev 1.1.

| Export name | Value | Used by |
|---|---|---|
| `TILE_BASE_SHADOW` | `0 4px 0 rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.12)` | Colorful number tiles, bomb |
| `TILE_SOFT_SHADOW` | `0 3px 0 rgba(0,0,0,0.22)` | Zero, one, trophy |
| `TILE_DRAG_SHADOW` | `0 20px 40px rgba(0,0,0,0.65), 0 6px 0 rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.15)` | Drag state |
| `TILE_ZAP_SHADOW` | `0 0 24px rgba(34,211,238,0.8), inset 0 0 12px rgba(34,211,238,0.3), 0 3px 0 rgba(0,0,0,0.2)` | Zap state |
| `TILE_DRAG_SCALE` | `1.18` | Scale during drag |

**Rev 1.1 changes:** `TILE_BASE_SHADOW` gains top-shine inset + deeper bottom shadow. `TILE_SOFT_SHADOW` slightly stronger.

### Rules

- Drag, zap, and factor shadows are token-driven. They may not be written as arbitrary inline values.
- `baseShadow` is set once per tile type in `getVisuals()` and must not be overridden outside of the composition chain above.
- Overlay shadows (modals, flyout pill) are **exempt** from this contract; they are decorative and non-interactive.

---

## 5. Z-Index Contract

### Hierarchy (low to high)

| Layer | z-index | Component / element |
|---|---|---|
| Base tile | 10 | Tile outer wrapper (resting) |
| Bar chrome | 50 | Top bar, Bottom bar |
| Zap face | 50 | Tile inner div during zap (within tile stacking context) |
| Highlighted tile | 100 | Tile outer wrapper when `isHighlighted` |
| Particle layer | 100 | ParticleLayer (within Board stacking context) |
| Dragging tile | 1000 | Tile outer wrapper during drag |
| Settings modal | 2000 | SettingsModal (fixed) |
| Flyout pill | 10000 | FlyoutPill (fixed) |
| Phase overlays | 50000 | No Moves banner, Results screen |
| Debug stamp | 60000 | BUILD_STAMP label |

### Rules

- **No element may exceed z-60000** without an explicit contract update.
- `position: fixed` overlays (SettingsModal, FlyoutPill) are independent of the inner container stacking context.
- Phase overlays (z-50000) use `absolute` positioning within the inner container and override all tile/particle layers.

---

## 6. Revision Policy

To change any value or rule in this contract:

1. Update the relevant constant in `uiTokens.ts` (CombineGrid-specific) or the shared module (`animTokens.ts`, `tileStyles.ts`, `HUDShell.tsx`) as appropriate.
2. Update the affected component(s) to use the new value.
3. Update this document to reflect the new value and rationale.
4. All three changes must occur in the same commit.

**No partial updates permitted.** Contract drift (code and document disagree) is a defect.

### Shared module change rule

If a value in `src/platform/ui/animTokens.ts` or `tileStyles.ts` changes, **both** this document and any SpeedGrid documentation must be updated. Shared module values cascade to all games; treat changes as breaking.

### SpeedGrid integration checklist (when ready)

- [ ] Import `TILE_BASE_SHADOW`, `TILE_SOFT_SHADOW`, `TILE_DRAG_SHADOW`, `TILE_ZAP_SHADOW`, `TILE_DRAG_SCALE`, `tileTypography`, `TILE_SPECULAR_CLASSES` from `tileStyles.ts` in SpeedGrid tile renderer
- [ ] Wrap SpeedGrid header with `<HUDTopBar>` and controls with `<HUDBottomBar>`
- [ ] Replace SpeedGrid icon buttons with `<HUDIconBtn>`
- [ ] Import `ANIM_FAST`, `ANIM_INTERACT`, `ANIM_REVEAL` from `animTokens.ts` for all SpeedGrid animation durations
