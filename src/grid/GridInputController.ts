// [ROLE] Future unified pointer-event normaliser for grid-based games.
// [STATUS] Phase 5 placeholder — empty, not imported by any game during Phases 1–8.
// [CONTRACT] REBUILD_CONTRACT.md §4
//
// This file exists to:
//   1. Reserve the module path in the src/grid/ layer.
//   2. Document the intended future responsibility of this module.
//   3. Prevent name-drift in later phases (contract §4 names this file explicitly).
//
// Intended future responsibility (post-Phase-8 convergence):
//   Translate raw PointerEvent / TouchEvent / MouseEvent streams into normalised
//   GridPointerEvents carrying grid-relative (row, col) coordinates and a phase
//   discriminant (start | move | end | cancel). Games register a handler; the
//   controller fires normalised events. This decouples game logic from browser
//   pointer semantics and enables touch + mouse + stylus support uniformly.
//
// Current games (CombineGrid, SpeedGrid) each own their own pointer handlers
// in their respective game files during reconstruction. They must NOT import
// this module until the post-Phase-8 convergence task explicitly wires them.
//
// DO NOT add runtime code or exports to this file during Phases 1–8.
// DO NOT import this file from src/games/ during Phases 1–8.
