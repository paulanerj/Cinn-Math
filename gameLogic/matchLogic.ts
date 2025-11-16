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
