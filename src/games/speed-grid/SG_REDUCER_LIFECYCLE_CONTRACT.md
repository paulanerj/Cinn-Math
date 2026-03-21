# SpeedGrid Reducer Lifecycle Contract

**Frozen: Phase-8 Task-13**
**File: `src/games/speed-grid/SG_REDUCER_LIFECYCLE_CONTRACT.md`**

This document is the authoritative specification for `sgReducer` behavior.
It is a freeze artifact. All future changes to `sgReducer.ts` must be verified
against this contract, and this document must be updated if the contract changes.

---

## 1. Allowed Phases

SpeedGrid has exactly four phases. No other phase value is legal.

| Phase              | Meaning                                                              |
|--------------------|----------------------------------------------------------------------|
| `WAITING_TO_START` | Board visible; timer halted. Session begins on first pointer-down.   |
| `PLAYING`          | Timer running. Chain input enabled. Normal gameplay loop.            |
| `CLEARING`         | Valid chain committed. Gravity executing. All input locked.          |
| `GAME_OVER`        | Timer expired. Result screen shown. No input accepted.               |

**Source:** `types.ts` — `SGPhase` discriminated union (lines 36–40).

---

## 2. Allowed Actions

| Action              | Payload                                         | Purpose                                  |
|---------------------|-------------------------------------------------|------------------------------------------|
| `CHAIN_START`       | `pos: ChainPos`                                 | Begin a drag chain; start timer if idle. |
| `CHAIN_EXTEND`      | `pos: ChainPos`                                 | Extend or backtrack active chain.        |
| `CHAIN_COMMIT`      | _(none)_                                        | Evaluate chain against current target.   |
| `TICK`              | _(none)_                                        | Advance countdown by one second.         |
| `GRAVITY_DONE`      | `grid, bonusMask, target`                       | Install post-gravity board state.        |
| `CLEAR_WRONG_FLASH` | _(none)_                                        | Clear the wrong-answer flash flag.       |
| `PLAY_AGAIN`        | `newState: SGState`                             | Replace state wholesale for restart.     |

**Source:** `types.ts` — `SGAction` discriminated union (lines 110–154).

---

## 3. Legal Phase Transition Table

Each row shows: action → valid source phases → resulting phase.

| Action              | Valid In                           | Invalid In                              | Resulting Phase                                         |
|---------------------|------------------------------------|-----------------------------------------|---------------------------------------------------------|
| `CHAIN_START`       | `WAITING_TO_START`, `PLAYING`      | `CLEARING`, `GAME_OVER`                 | `WAITING_TO_START`→`PLAYING`; `PLAYING`→`PLAYING`      |
| `CHAIN_EXTEND`      | `WAITING_TO_START`, `PLAYING`      | `CLEARING`, `GAME_OVER`                 | Same phase (no transition)                              |
| `CHAIN_COMMIT`      | `PLAYING`                          | `WAITING_TO_START`, `CLEARING`, `GAME_OVER` | `PLAYING`→`CLEARING` (valid chain); else `PLAYING` |
| `TICK`              | `PLAYING`                          | `WAITING_TO_START`, `CLEARING`, `GAME_OVER` | `PLAYING` (timer running) or `PLAYING`→`GAME_OVER` |
| `GRAVITY_DONE`      | `CLEARING`                         | `WAITING_TO_START`, `PLAYING`, `GAME_OVER` | `CLEARING`→`PLAYING`                                |
| `CLEAR_WRONG_FLASH` | Any                                | _(none — always safe)_                  | Same phase (no transition)                              |
| `PLAY_AGAIN`        | Any                                | _(none — always safe)_                  | Phase of `action.newState` (always `WAITING_TO_START`)  |

---

## 4. Illegal Action Behavior

**Law: the reducer must return the current state unchanged when an action is
dispatched in an invalid phase.**

No exception is thrown. No state mutation occurs. The state object returned
must be reference-identical to the input state (`=== state`).

This rule applies to every guarded action. Specific guards:

- `CHAIN_START` outside `WAITING_TO_START`/`PLAYING` → `return state` (sgReducer.ts:106)
- `CHAIN_EXTEND` outside `WAITING_TO_START`/`PLAYING` → `return state` (sgReducer.ts:111)
- `CHAIN_COMMIT` outside `PLAYING` → `return state` (sgReducer.ts:128)
- `TICK` outside `PLAYING` → `return state` (sgReducer.ts:186)
- `GRAVITY_DONE` outside `CLEARING` → `return state` (sgReducer.ts:200)
- `default` (unknown action type) → `return state` (sgReducer.ts:219)

`CLEAR_WRONG_FLASH` and `PLAY_AGAIN` have no phase guard; they are always safe
to dispatch.

---

## 5. Reducer Purity Boundary

`sgReducer` is a pure function. It must satisfy all of the following:

| Constraint                     | Status   | Evidence                                                          |
|--------------------------------|----------|-------------------------------------------------------------------|
| No PRNG consumption            | Frozen   | No `prng` / `random` / `Math.random` call site in sgReducer.ts   |
| No time consumption            | Frozen   | No `Date.now` / `performance.now` in sgReducer.ts                 |
| No async work                  | Frozen   | No `Promise` / `setTimeout` / `await` in sgReducer.ts            |
| No gravity computation         | Frozen   | No `GravitySystem` import in sgReducer.ts                         |
| No target generation           | Frozen   | Target received via `GRAVITY_DONE` payload; not computed here     |
| No BonusMask gravity           | Frozen   | No `applyBonusMaskGravity` call in sgReducer body                 |
| Entropy via precomputed payload| Frozen   | All entropy-derived values arrive in `GRAVITY_DONE` and `PLAY_AGAIN` |

The re-export of `applyBonusMaskGravity` at line 54 of sgReducer.ts is a
backward-compatibility shim only. The function body lives in
`src/systems/BonusMaskSystem.ts`. The reducer body itself never calls it.

**`initGame` is not the reducer.** It accepts a `prng` argument and is called
once per session at mount and once per restart. It is exempt from reducer purity
rules. It must not be called inside `sgReducer`.

---

## 6. GRAVITY_DONE Contract

`GRAVITY_DONE` is the **exclusive** mechanism for exiting `CLEARING` phase.

### Law

1. `GRAVITY_DONE` is the only action that transitions `CLEARING → PLAYING`.
2. The reducer never computes gravity internally.
3. The reducer accepts only a postcomputed gravity payload: the fully-settled
   `grid`, the remapped `bonusMask`, and the next `target`.
4. All three payload fields are computed by the component's CLEARING effect
   (SpeedGridGame.tsx) before dispatch. The reducer installs them verbatim.
5. No other action may exit `CLEARING`. If any action other than `GRAVITY_DONE`
   (or the always-safe `CLEAR_WRONG_FLASH` / `PLAY_AGAIN`) is dispatched in
   `CLEARING`, the reducer returns unchanged state.

### Caller Obligations (SpeedGridGame.tsx)

The component CLEARING effect must:
- Call `GravitySystem.applyGravity` to compute the settled grid and spawn map.
- Call `BonusMaskSystem.applyBonusMaskGravity` with explicit `clearedPositions`
  (Explicit Survivor Law, Phase-8 Task-10).
- Call `generateTarget` to produce the next target.
- Dispatch `GRAVITY_DONE` with all three results.

The reducer trusts these values unconditionally. No re-validation occurs.

---

## 7. wrongFlash Clearance Obligation

`wrongFlash` is set to `true` by a wrong `CHAIN_COMMIT` (sgReducer.ts:146).

### Law

1. `wrongFlash === true` must be transient — it must be cleared within a
   bounded time after it is set.
2. The reducer alone cannot clear it on a timer. The caller must dispatch
   `CLEAR_WRONG_FLASH` after the feedback animation has played.
3. The component (SpeedGridGame.tsx) owns this obligation: after every
   `CHAIN_COMMIT`, a 600 ms `setTimeout` fires `CLEAR_WRONG_FLASH` if
   `state.wrongFlash === true`.
4. The 600 ms window restarts on **every** `CHAIN_COMMIT` via `chainCommitSeq`
   (not `state.wrongFlash`) to handle rapid successive wrong answers correctly.
5. `CLEAR_WRONG_FLASH` is a no-op when `wrongFlash === false` (safe to dispatch).

### Reducer Guarantee

`CLEAR_WRONG_FLASH` has no phase guard. It is always applied regardless of
current phase. This is intentional: the flash timer can theoretically fire
while in `CLEARING` or `GAME_OVER`.

---

## 8. Replay Determinism Assumptions

### Deterministic State Fields

All `SGState` fields are deterministic given:
- A fixed PRNG seed (controls `initGame` board spawn).
- A fixed action sequence with identical payloads.

No field in `SGState` contains entropy that was not delivered via a PRNG-seeded
payload at spawn time or via a `GRAVITY_DONE` payload.

### Caller Obligations for Replay

| Obligation | Owner |
|---|---|
| Re-derive `clearedPositions` from chain commit snapshot | Caller (replay system) |
| Re-run `GravitySystem.applyGravity` with same PRNG seed | Caller |
| Re-run `BonusMaskSystem.applyBonusMaskGravity` with same `clearedPositions` | Caller |
| Re-run `generateTarget` with same PRNG state | Caller |
| Supply identical `GRAVITY_DONE` payload | Caller |

### Replay Inputs (action types that advance game state deterministically)

- `CHAIN_START` (pos must be identical)
- `CHAIN_EXTEND` (pos must be identical)
- `CHAIN_COMMIT` (no payload — deterministic from prior chain state)
- `TICK` (no payload)
- `GRAVITY_DONE` (payload must be recomputed from same PRNG state and clearedPositions)
- `PLAY_AGAIN` (newState must be recomputed from same PRNG seed)

### Derived Outputs (not replay inputs)

- `wrongFlash` — derived from chain evaluation result; re-derived in replay.
- `CLEAR_WRONG_FLASH` — timer-driven; not a replay input.
- `score`, `chainsCompleted`, `bonusesCollected` — accumulate deterministically
  from chain evaluation; they are outputs, not inputs.

### clearedPositions Replay Law (Phase-8 Task-8)

`clearedPositions` is **never serialized** and **never stored in SGState**.
It is re-derived from the chain commit snapshot at replay time via:
- `state.chain.positions` (captured pre-commit), or
- Grid diff: positions where `preGravGrid[r][c] === 0` and `preCommitGrid[r][c] !== 0`.

This law is enforced in `BonusMaskSystem.ts` via `AssertClearedPositionsIntegrity`
(dev-mode only) and in `SpeedGridHarness.ts` via the Explicit Survivor Law assertion.

### Multi-Chain Forward Guard (Phase-8 Task-8)

`CHAIN_COMMIT` currently assumes a single active chain.
In the multi-chain era, `clearedPositions` will become the union of all
committed chains. The reducer must not encode single-chain assumptions in
logic that would survive a multi-chain refactor. The current guard comment
at sgReducer.ts:119–123 marks this boundary.

---

## 9. Transition Table — Compact Reference

```
WAITING_TO_START ──CHAIN_START──► PLAYING
WAITING_TO_START ──CHAIN_EXTEND──► WAITING_TO_START  (no-op — chain not started yet)
WAITING_TO_START ──[any other]──► WAITING_TO_START   (unchanged)

PLAYING ──CHAIN_START──► PLAYING    (restarts chain)
PLAYING ──CHAIN_EXTEND──► PLAYING   (extends chain)
PLAYING ──CHAIN_COMMIT (valid)──► CLEARING
PLAYING ──CHAIN_COMMIT (wrong)──► PLAYING  (wrongFlash=true, combo reset)
PLAYING ──CHAIN_COMMIT (too short)──► PLAYING  (chain cancelled silently)
PLAYING ──TICK (timer running)──► PLAYING
PLAYING ──TICK (timer expired)──► GAME_OVER
PLAYING ──[any other]──► PLAYING    (unchanged)

CLEARING ──GRAVITY_DONE──► PLAYING
CLEARING ──[any other except CLEAR_WRONG_FLASH/PLAY_AGAIN]──► CLEARING  (unchanged)

GAME_OVER ──[any except CLEAR_WRONG_FLASH/PLAY_AGAIN]──► GAME_OVER  (unchanged)

[any phase] ──CLEAR_WRONG_FLASH──► same phase  (wrongFlash cleared)
[any phase] ──PLAY_AGAIN──► WAITING_TO_START   (full state replacement)
```

---

## 10. Contract Conformance Summary

| Contract Item | Verified In Code | Notes |
|---|---|---|
| Four phases only | types.ts:36–40 | SGPhase union |
| Seven action types | types.ts:110–154 | SGAction union |
| CHAIN_START phase guard | sgReducer.ts:95–106 | WAITING_TO_START → PLAYING; PLAYING → PLAYING; else unchanged |
| CHAIN_EXTEND phase guard | sgReducer.ts:110–111 | Returns state if not PLAYING or WAITING_TO_START |
| CHAIN_COMMIT phase guard | sgReducer.ts:128 | Returns state if not PLAYING |
| TICK phase guard | sgReducer.ts:186 | Returns state if not PLAYING |
| GRAVITY_DONE phase guard | sgReducer.ts:200 | Returns state if not CLEARING |
| default guard | sgReducer.ts:219 | Returns state for unknown actions |
| Reducer contains no PRNG | sgReducer.ts (full) | No random/Math.random/prng in body |
| Reducer contains no time | sgReducer.ts (full) | No Date.now/performance.now in body |
| Reducer contains no gravity | sgReducer.ts (full) | No GravitySystem import |
| GRAVITY_DONE is sole CLEARING exit | sgReducer.ts:199–208 | Only case branch that transitions from CLEARING |
| wrongFlash clearance | SpeedGridGame.tsx:385–391 | 600 ms setTimeout → CLEAR_WRONG_FLASH |
| clearedPositions not in SGState | types.ts (full) | No clearedPositions field |
| initGame not called in reducer | sgReducer.ts (full) | initGame is a standalone export |
