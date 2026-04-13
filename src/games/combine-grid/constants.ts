// Board geometry — 5 columns × 7 rows per CombineGrid Rulebook §3.
export const ROWS = 7;
export const COLS = 5;
export const ROUNDS_PER_SESSION = 5;
export const STALEMATE_VALID_THRESHOLD = 1;

export const ROUND_DURATION_SECS = 90;
export const CLEAR_MS = 320;
export const ROUND_OVER_AUTOADVANCE_MS = 2000;

export const TILE_VAL_MIN = 1;
export const TILE_VAL_MAX = 9;

// ── Special tile sentinels ────────────────────────────────────────────────────
// Stored as numeric values in board[][] so gravity (non-zero check) leaves them
// in place.  Normal tiles are 1–9; these are outside that range.
//
// ZERO_TILE_VALUE : live "zero" tile — displays as 0, triggers double-respawn.
// BOMB_TILE_VALUE : bomb tile — ignites on touch, destroys 3×3 after fuse.
export const ZERO_TILE_VALUE = 100;
export const BOMB_TILE_VALUE = 99;

// ── Bomb mechanics ────────────────────────────────────────────────────────────
export const BOMB_FUSE_MS = 2000;          // 2-second fuse before explosion
export const BOMB_TROPHIES_PER_SPAWN = 10; // one bomb spawns per N trophies
export const BOMB_STAGGER_MS = 100;        // stagger between blast tile clears
