/**
 * @file gameLogic/matchLogic.ts
 * @description Centralizes logic for validating matches and calculating selection values.
 * @purpose To provide pure, testable functions related to player selections, separating this logic from both the state reducer and the side-effect controller.
 * @ai-note This module is the source of truth for "what a selection is worth".
 */
import { Coords, TileType, GameMode } from '../types';

/**
 * @function calculateSelectionValue
 * @description Calculates the total value of selected tiles based on the game mode.
 * @param coords The array of selected coordinates.
 * @param board The current game board.
 * @param mode The current game mode ('sum' or 'multiply').
 * @returns The calculated value. Returns 0 for 'sum' or 1 for 'multiply' if no number tiles are selected.
 */
export const calculateSelectionValue = (coords: Coords[], board: (TileType | null)[][], mode: GameMode): number => {
    const selectedNumberTiles = coords
        .map(({ row, col }) => board[row]?.[col])
        .filter((t): t is TileType => !!t && t.type === 'number');

    if (selectedNumberTiles.length === 0) {
        return mode === 'sum' ? 0 : 1;
    }

    if (mode === 'sum') {
        return selectedNumberTiles.reduce((sum, tile) => sum + (tile.value as number), 0);
    } else {
        return selectedNumberTiles.reduce((prod, tile) => prod * (tile.value as number), 1);
    }
};

// ─── Move scanner ─────────────────────────────────────────────────────────────

export type ScanResult = {
    hasMove: boolean;
    /** combine: a valid tile path exists; bomb: a bomb+dead action exists */
    reasons: { combine: boolean; bomb: boolean };
    /** Example path coords when hasMove is true, for debug display */
    exampleMove: Coords[] | null;
};

/**
 * @function scanForMoves
 * @description Determines whether at least one legal combine exists on the board
 * for the given targetNumber.
 *
 * Approach:
 *   Exhaustively tests paths of 1–3 adjacent tiles (8-neighbour, matching the
 *   drag-mode adjacency rule used by the player's own selection) starting from
 *   every number tile on the board.  For each candidate path it calls
 *   calculateSelectionValue — the exact same function used to validate a real
 *   player selection — and compares the result to targetNumber.
 *
 *   Starting only from number tiles is sufficient: 'time' tiles contribute 0
 *   to the value (they are filtered out inside calculateSelectionValue), so any
 *   path value is determined solely by the number tiles it contains.  A path
 *   like [time, number, time] is found by starting at the number tile and
 *   extending in both directions.
 *
 *   bomb / dead tile actions are not present in this build; reasons.bomb is
 *   always false.
 *
 * @param grid       Current settled board (all nulls already filled by gravity).
 * @param targetNumber  The target the player must match on the next turn.
 * @param mode       Game mode ('sum' | 'multiply').
 * @param gridSize   Board dimension (typically GRID_SIZE = 5).
 */
export const scanForMoves = (
    grid: (TileType | null)[][],
    targetNumber: number,
    mode: GameMode,
    gridSize: number,
): ScanResult => {
    const inBounds = (r: number, c: number) => r >= 0 && r < gridSize && c >= 0 && c < gridSize;

    // All 8 directions (matching the drag-mode adjacency check: abs(Δr)≤1 && abs(Δc)≤1).
    const dirs: [number, number][] = [
        [-1, -1], [-1, 0], [-1, 1],
        [ 0, -1],          [ 0, 1],
        [ 1, -1], [ 1, 0], [ 1, 1],
    ];

    // Collect every number-tile coordinate as a potential path start.
    const numCoords: Coords[] = [];
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (grid[r]?.[c]?.type === 'number') numCoords.push({ row: r, col: c });
        }
    }

    // ── Length-1: single number tile equals target ────────────────────────────
    for (const a of numCoords) {
        if (calculateSelectionValue([a], grid, mode) === targetNumber) {
            return { hasMove: true, reasons: { combine: true, bomb: false }, exampleMove: [a] };
        }
    }

    // ── Length-2: a → b (any 8-neighbour), a is a number tile ────────────────
    for (const a of numCoords) {
        for (const [dr, dc] of dirs) {
            const br = a.row + dr, bc = a.col + dc;
            if (!inBounds(br, bc) || !grid[br]?.[bc]) continue;
            const path: Coords[] = [a, { row: br, col: bc }];
            if (calculateSelectionValue(path, grid, mode) === targetNumber) {
                return { hasMove: true, reasons: { combine: true, bomb: false }, exampleMove: path };
            }
        }
    }

    // ── Length-3: a → b → c (8-neighbour each step, c ≠ a) ──────────────────
    for (const a of numCoords) {
        for (const [dr1, dc1] of dirs) {
            const br = a.row + dr1, bc = a.col + dc1;
            if (!inBounds(br, bc) || !grid[br]?.[bc]) continue;
            for (const [dr2, dc2] of dirs) {
                const cr = br + dr2, cc = bc + dc2;
                if (!inBounds(cr, cc)) continue;
                if (cr === a.row && cc === a.col) continue; // no revisiting start tile
                if (!grid[cr]?.[cc]) continue;
                const path: Coords[] = [a, { row: br, col: bc }, { row: cr, col: cc }];
                if (calculateSelectionValue(path, grid, mode) === targetNumber) {
                    return { hasMove: true, reasons: { combine: true, bomb: false }, exampleMove: path };
                }
            }
        }
    }

    // No path of length 1–3 matched the target.
    return { hasMove: false, reasons: { combine: false, bomb: false }, exampleMove: null };
};
