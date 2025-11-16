/**
 * @file gameLogic/boardUtils.ts
 * @description Utility functions for managing the game board's state.
 * @purpose This file contains pure functions that handle the creation of tiles, the application of gravity, and other board transformations. They do not have side effects and are easily testable.
 * @ai-note When a task involves changing how the board is generated or how tiles fall, this is the file to modify. The `applyGravity` function is the core of the post-match board update logic.
 */
// FIX: GRID_SIZE is exported from constants.ts, not types.ts
import { TileType, Difficulty, GameMode } from '../types';
import { DIFFICULTY_SETTINGS, GRID_SIZE } from '../constants';

/**
 * @function createNumberTile
 * @description Creates a new tile with a random number value based on the current difficulty.
 * @param {Difficulty} difficulty The game difficulty, which determines the range of numbers.
 * @returns {TileType} A new number tile object.
 */
export const createNumberTile = (difficulty: Difficulty): TileType => {
    const { min, max } = DIFFICULTY_SETTINGS[difficulty].tileRange;
    return { id: crypto.randomUUID(), value: Math.floor(Math.random() * (max - min + 1)) + min, type: 'number' };
};

/**
 * @function createTimeTile
 * @description Creates a new time bonus tile.
 * @returns {TileType} A new time tile object.
 */
export const createTimeTile = (): TileType => ({ id: crypto.randomUUID(), value: 'CINNAMOROLL', type: 'time' });

/**
 * @function createInitialBoard
 * @description Generates a brand new game board filled with number tiles.
 * @param {Difficulty} difficulty The game difficulty.
 * @returns An object containing the new board and a Set of all tile IDs, used for the initial drop animation.
 */
export const createInitialBoard = (difficulty: Difficulty) => {
    const board = Array.from({ length: GRID_SIZE }, () => 
        Array.from({ length: GRID_SIZE }, () => createNumberTile(difficulty))
    );
    const allIds = new Set(board.flat().map(t => t.id));
    return { board, allIds };
}

/**
 * @function applyGravity
 * @description Simulates gravity on the board. Cleared tiles (null) are filled by tiles from above, and new tiles are generated at the top.
 * @param currentBoard The board state after tiles have been cleared (set to null).
 * @param gameMode The current game mode.
 * @param difficulty The current game difficulty.
 * @returns An object containing the next board state and a Set of the newly dropped tile IDs for animation.
 */
export const applyGravity = (currentBoard: (TileType | null)[][], gameMode: GameMode, difficulty: Difficulty) => {
    const newBoard = currentBoard.map(row => [...row]);
    const droppedTileIds = new Set<string>();
    const probability = DIFFICULTY_SETTINGS[difficulty].timeTileProbability[gameMode];

    for (let c = 0; c < GRID_SIZE; c++) {
        let emptyRow = -1;
        // Find the lowest empty spot in the column
        for (let r = GRID_SIZE - 1; r >= 0; r--) {
            if (newBoard[r][c] === null && emptyRow === -1) {
                emptyRow = r;
            } else if (newBoard[r][c] !== null && emptyRow !== -1) {
                // If we have a tile and an empty spot below it, move the tile down.
                newBoard[emptyRow][c] = newBoard[r][c];
                newBoard[r][c] = null;
                emptyRow--; // The next empty spot is now one row higher
            }
        }
        // Fill any remaining empty spots at the top of the column with new tiles.
        for (let r = emptyRow; r >= 0; r--) {
            const newTile = Math.random() < probability ? createTimeTile() : createNumberTile(difficulty);
            newBoard[r][c] = newTile;
            droppedTileIds.add(newTile.id);
        }
    }
    return { nextBoard: newBoard, droppedIds: droppedTileIds };
};

/**
 * @function findPathForTarget
 * @description A utility to generate a plausible target number by finding a random path of adjacent tiles on the board.
 * @param board The current game board.
 * @returns A new target number, or 10 if a path cannot be found.
 * @ai-note This ensures that the target number is always achievable, improving gameplay fairness. If this logic is too simple or complex, it can be adjusted here.
 */
export const findPathForTarget = (board: (TileType | null)[][], gameMode: GameMode): number => {
    const numberTiles = board.flat().filter((t): t is TileType => !!t && t.type === 'number');
    if (numberTiles.length < 2) return 10; // Default target if board is empty

    // Find a random starting tile
    let startRow, startCol;
    do {
        startRow = Math.floor(Math.random() * GRID_SIZE);
        startCol = Math.floor(Math.random() * GRID_SIZE);
    } while (board[startRow][startCol]?.type !== 'number');

    const path = [{row: startRow, col: startCol}];
    const visited = new Set([`${startRow},${startCol}`]);
    const pathLength = Math.floor(Math.random() * 2) + 2; // Path of 2 or 3 tiles

    for(let i = 0; i < pathLength - 1; i++) {
        const last = path[path.length - 1];
        const neighbors = [
            {r: last.row - 1, c: last.col}, {r: last.row + 1, c: last.col},
            {r: last.row, c: last.col - 1}, {r: last.row, c: last.col + 1}
        ].filter(({r,c}) => 
            r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && // a valid coordinate
            !visited.has(`${r},${c}`) && // not already in the path
            board[r][c]?.type === 'number' // is a number tile
        );

        if (neighbors.length > 0) {
            const next = neighbors[Math.floor(Math.random() * neighbors.length)];
            path.push({row: next.r, col: next.c});
            visited.add(`${next.r},${next.c}`);
        } else {
            break; // No valid neighbors, path ends here
        }
    }

    const targetTiles = path.map(p => board[p.row][p.col]).filter((t): t is TileType => !!t);

    if (targetTiles.length < 2) {
        // Fallback if we couldn't create a long enough path
        const randomTiles = [...numberTiles].sort(() => 0.5 - Math.random()).slice(0, 2);
        if(randomTiles.length < 2) return 10;
        return gameMode === 'sum' 
            ? randomTiles.reduce((sum, tile) => sum + (tile.value as number), 0)
            : randomTiles.reduce((prod, tile) => prod * (tile.value as number), 1);
    }

    return gameMode === 'sum' 
        ? targetTiles.reduce((sum, tile) => sum + (tile.value as number), 0)
        : targetTiles.reduce((prod, tile) => prod * (tile.value as number), 1);
};