export const ROWS = 6;
export const COLS = 4;

/** How many bombs per board */
export const BOMB_COUNT = 2;
/** How many trophies per board */
export const TROPHY_COUNT = 1;

/** Auto-stalemate fires when validCount === 1 && bombCount === 0 */
export const STALEMATE_VALID_THRESHOLD = 1;

/** Rounds per session */
export const ROUNDS_PER_SESSION = 5;

/** Build stamp — bump when board logic changes */
export const BUILD_STAMP = 'CG-STAMP-2';

/** Practice multipliers for default session */
export const DEFAULT_PRACTICE_MULTIPLIERS = [2, 3, 4, 5, 6];
