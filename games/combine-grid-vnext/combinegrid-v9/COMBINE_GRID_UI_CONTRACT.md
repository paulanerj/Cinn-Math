# Combine Grid UI Contract

**Version:** 1.0
**Status:** LOCKED
**Established:** 2026-03-04
**Source of truth file:** `uiTokens.ts`

---

## Overview

This document defines the invariant layout, geometry, factor, shadow, and z-index contracts for the CombineGrid game (`combinegrid-v9`). All values in this document are derived from the currently running, verified implementation.

**Absolute rule:** No changes to layout math, factor logic, tile geometry, or grid sizing may occur without explicitly updating this document and `uiTokens.ts` in the same commit.

The following files are under contract:
- `App.tsx`
- `components/Board.tsx`
- `components/Tile.tsx`
- `uiTokens.ts` (this document's source of truth)

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
- Vertical padding is preserved: `pt-4 pb-2 sm:pt-6 sm:pb-3`.
- `<main>` retains `overflow-hidden` (board fits within container; no clipping occurs by design).
- The outer `max-w-[520px] sm:max-w-[600px] lg:max-w-[760px]` container enforces the desktop cap.

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
| `FACTOR_WARM_OUTLINE` | `rgba(249,115,22,0.55)` | Orange ring, settled state |
| `FACTOR_WARM_GLOW` | `rgba(249,115,22,0.25)` | Orange halo, settled state |
| `FACTOR_ONE_OUTLINE` | `rgba(56,189,248,0.55)` | Sky-blue ring, settled state |
| `FACTOR_ONE_GLOW` | `rgba(56,189,248,0.20)` | Sky-blue halo, settled state |
| `FACTOR_REVEAL_DURATION_MS` | `650` | ms, one-shot animation duration |

### Animation rules

- Both `factor-reveal` and `factor-reveal-one` are **one-shot** (`animation-fill-mode: forwards`).
- No infinite pulse. No looping.
- Animation replays correctly on tile remount (new round = new tile IDs).
- Factor glow is suppressed during drag (`isDragging`) and zap (`isZapTarget`).

---

## 4. Shadow Contract

### Shadow override priority (strict, top = highest)

```
1. Zap:         0 0 24px rgba(34,211,238,0.8), inset 0 0 12px rgba(34,211,238,0.3), ...
2. Drag:        0 16px 32px rgba(0,0,0,0.5), 0 4px 0 rgba(0,0,0,0.3)
3. TrayOp:      none
4. isOneFactor: 0 0 0 2px FACTOR_ONE_OUTLINE, 0 0 10px FACTOR_ONE_GLOW, BOTTOM_SHADOW
5. isWarmFactor:0 0 0 2px FACTOR_WARM_OUTLINE, 0 0 10px FACTOR_WARM_GLOW, BOTTOM_SHADOW
6. baseShadow:  tile-type default (see table below)
```

### Base shadow tokens (local to Tile.tsx — not in uiTokens.ts)

| Constant | Value | Used by |
|---|---|---|
| `BOTTOM_SHADOW` | `0 3px 0 rgba(0,0,0,0.22)` | Colorful number tiles, bomb |
| `BOTTOM_SHADOW_S` | `0 2px 0 rgba(0,0,0,0.15)` | Zero, one, trophy |

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

1. Update the relevant constant in `uiTokens.ts`.
2. Update the affected component(s) to use the new value.
3. Update this document to reflect the new value and rationale.
4. All three changes must occur in the same commit.

**No partial updates permitted.** Contract drift (code and document disagree) is a defect.
