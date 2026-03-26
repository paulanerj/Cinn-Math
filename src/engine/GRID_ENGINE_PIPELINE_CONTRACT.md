# Grid Engine Pipeline Contract

**Status:** FROZEN — Phase-9
**Applies to:** All grid-based games in this codebase (CombineGrid, SpeedGrid, future games)

---

## Purpose

This document defines the non-negotiable execution pipeline that all grid games must follow. It was established after Phase-9 alignment work and must not be violated by future features or refactors. Any deviation constitutes an architectural regression.

---

## STAGE 1 — Input

The component layer captures user interaction and translates it into a dispatch call.

- Touch/pointer events are handled in the component
- No state mutation occurs at this stage
- The action payload carries only the minimum data needed (e.g., `pos: GridPos`, not computed board state)

---

## STAGE 2 — Reducer Transformation

The reducer receives the action and computes the next logical state.

**Rules:**

- The reducer is a **pure function**: `(state, action) → state`
- **No PRNG calls** — `Math.random()`, `makePrng()`, `randomSeed()`, or any entropy source is forbidden
- **No side effects** — no `setTimeout`, no DOM reads, no refs, no logging
- All PRNG-derived values (new boards, new targets, spawn values) are computed in effects and passed in via action payloads
- **Clearing happens here** — grid cells for the committed selection are zeroed inside the reducer before transitioning to the clearing phase

**What "clearing" means in the reducer:**

```typescript
// Pattern used by both SpeedGrid (CHAIN_COMMIT) and CombineGrid (TAP_TILE):
const posSet = new Set(positions.map((p) => `${p.row},${p.col}`));
const clearedGrid = state.grid.map((row, ri) =>
  row.map((v, ci) => (posSet.has(`${ri},${ci}`) ? 0 : v)),
);
// Return state with clearedGrid and phase: 'CLEARING'
```

This is an immutable transformation. The original state is never mutated.

---

## STAGE 3 — Clearing State

After the reducer returns, the game is in its clearing phase with:

- **Grid/board already zeroed** at the committed positions — the effect does not need to zero anything
- **Cleared positions** stored explicitly in state or in a synchronous ref captured before dispatch — never inferred from grid zeros
- Phase flag set to the game's clearing phase identifier (`'CLEARING'` in both current games)

**Cleared positions must always be explicit.** Inferring cleared positions by scanning for zero cells is permanently forbidden. Zero cells can exist for reasons other than the current clear (e.g., spawned gaps during gravity).

---

## STAGE 4 — Orchestration

A `useEffect` fires when the phase transitions to the clearing phase. This effect is the **only** layer that calls `runGravityOrchestrator`.

**Rules:**

- The effect reads `state.board` / `state.grid` directly as the pre-gravity input — no transformation
- The effect reads cleared positions from `state.clearingPositions` or a synchronous ref
- `runGravityOrchestrator` owns: gravity application, bonus mask gravity, new tile spawning, new target generation
- The effect does **not** mutate any state directly — it only dispatches when the orchestrator completes
- PRNG calls occur inside the orchestrator callbacks (`spawnValue`, `generateNextTarget`) — not in the reducer

---

## STAGE 5 — Commit

When the orchestrator finishes, the effect dispatches a commit action carrying the new board, mask, and target.

- SpeedGrid: `GRAVITY_DONE` — carries `grid`, `bonusMask`, `target`
- CombineGrid: `CLEAR_COMPLETE` — carries `board`, `target`

The reducer applies these values to state, clearing the clearing-phase flag, and the cycle is complete.

---

## Hard Rules

These rules have no exceptions. Each is a named invariant.

### Rule 1 — Reducer Owns All Logical Mutations

All logical state transitions — selection, scoring, clearing, phase advancement — happen inside the reducer. Effects are orchestration wrappers, not state machines.

### Rule 2 — Effects Never Modify Board Data

Effects pass data to the orchestrator and dispatch results back. An effect must never construct a new board by transformation (e.g., zeroing cells) before passing it anywhere. The board that enters the effect is the board that enters the orchestrator.

### Rule 3 — Orchestrator Owns All Gravity and Spawn Logic

`runGravityOrchestrator` is the single entry point for gravity, bonus mask gravity, tile spawning, and next-target generation. Calling `applyGravity` directly at game level is forbidden. Duplicating any part of the orchestrator's logic in an effect or reducer is forbidden.

### Rule 4 — No PRNG Inside Reducer

The reducer must be deterministic given identical inputs. PRNG calls introduce hidden entropy and break replay determinism. All randomness enters through action payloads computed in effects.

### Rule 5 — No Clearing Logic Outside Reducer

Cells must be zeroed before the orchestrator sees the board. Zeroing cells inside an effect before passing to the orchestrator is forbidden. The reducer is the exclusive owner of this step.

### Rule 6 — Cleared Positions Must Be Explicit

`clearedPositions` passed to `runGravityOrchestrator` must derive from the committed selection (chain positions or tap selection), not from scanning the grid for zero values. Zero-inference is permanently removed.

---

## Parity Check — Current Conformance

Both games conform to this contract as of Phase-9.

### SpeedGrid

| Stage | File | Implementation |
|---|---|---|
| Input | `SpeedGridGame.tsx` | Pointer events → `CHAIN_COMMIT` dispatch |
| Reducer clearing | `sgReducer.ts:170–173` | Inline pos-set map zeroes grid at `CHAIN_COMMIT` |
| Clearing state | `sgReducer.ts:178–188` | Phase `'CLEARING'`, zeroed grid returned |
| Cleared positions | `SpeedGridGame.tsx:258` | `lastClearedPositionsRef` set synchronously before dispatch |
| Orchestration | `SpeedGridGame.tsx:329` | `runGravityOrchestrator` called in CLEARING effect |
| Commit | `SpeedGridGame.tsx:362` | `GRAVITY_DONE` dispatched with `grid`, `bonusMask`, `target` |

### CombineGrid

| Stage | File | Implementation |
|---|---|---|
| Input | `CombineGridGame.tsx` | Tile press → `TAP_TILE` dispatch |
| Reducer clearing | `cgReducer.ts:138–141` | Inline pos-set map zeroes board at `TAP_TILE` match |
| Clearing state | `cgReducer.ts:142–151` | Phase `'CLEARING'`, zeroed board returned |
| Cleared positions | `cgReducer.ts:148` | `clearingPositions: newSel` stored in state |
| Orchestration | `CombineGridGame.tsx:257` | `runGravityOrchestrator` called in CLEARING effect |
| Commit | `CombineGridGame.tsx:127` | `CLEAR_COMPLETE` dispatched with `board`, `target` |

---

## How Drift Can Occur

### Moving clearing back into the effect

```typescript
// VIOLATION — effect zeroes board before passing to orchestrator:
const preGravBoard = clearCells(state.board, state.clearingPositions);
const orchResult = runGravityOrchestrator({ grid: preGravBoard, ... });
```

**Why it is dangerous:** The reducer's returned board no longer represents the logical post-clear state. Snapshot-based replay validation reads `state.board` at CLEARING entry and expects it to be zeroed. Any harness, test, or future replay system that snapshots state at phase transitions will see inconsistent data. The mismatch is invisible at runtime but breaks all determinism proofs.

### Adding PRNG inside the reducer

```typescript
// VIOLATION — reducer calls PRNG directly:
case 'CHAIN_COMMIT': {
  const newTarget = generateTarget(newGrid, ROWS, COLS, mode, profile, prng()); // FORBIDDEN
  return { ...state, grid: newGrid, target: newTarget };
}
```

**Why it is dangerous:** The reducer is no longer a pure function. Replaying the same action sequence will produce different outputs depending on PRNG state at call time. Unit tests cannot exercise the reducer in isolation. The same sequence of dispatched actions produces non-deterministic state transitions.

### Duplicating gravity logic outside the orchestrator

```typescript
// VIOLATION — effect applies gravity manually instead of delegating:
useEffect(() => {
  if (state.phase !== 'CLEARING') return;
  const newGrid = applyGravity(state.grid, ...); // direct call — FORBIDDEN
  dispatch({ type: 'CLEAR_COMPLETE', board: newGrid });
}, [state.phase]);
```

**Why it is dangerous:** The orchestrator enforces the correct sequence: `applyGravity` → `applyBonusMaskGravity` → `generateNextTarget`. Bypassing it silently drops steps (bonus mask evolution, target regeneration from settled grid). Two code paths now implement "gravity" with diverging behavior. Future orchestrator changes will not propagate to the bypassed path.

### Inferring cleared positions from grid zeros

```typescript
// VIOLATION — deriving cleared positions by scanning for zero cells:
const clearedPositions = [];
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++)
    if (state.grid[r][c] === 0) clearedPositions.push({ row: r, col: c });
```

**Why it is dangerous:** Zero cells can exist for reasons unrelated to the current clear — e.g., cells that were already empty before the chain, cells zeroed by a previous round. Inferred positions do not match the actual committed selection. The orchestrator's bonus mask logic and spawn index calculations depend on exact cleared positions; wrong positions produce wrong spawn slot allocation and wrong mask evolution.

---

## Dependency Direction

The dependency graph is strictly one-way:

```
engine/
  ← systems/GravityOrchestrator
    ← games/speed-grid/sgReducer
    ← games/speed-grid/SpeedGridGame
    ← games/combine-grid/cgReducer
    ← games/combine-grid/CombineGridGame
```

- `engine` never imports `systems` or `games`
- `systems` never imports `games`
- `cgReducer` and `sgReducer` never import from each other
- `cgReducer` has no React imports; `sgReducer` has no React imports

---

## Change Control

Any change to this contract requires:

1. Explicit PM sign-off naming this document
2. Both games updated simultaneously to preserve parity
3. All harness tests (SpeedGridHarness VM-26 through VM-33) re-verified
4. This document updated to reflect the new canonical pipeline
