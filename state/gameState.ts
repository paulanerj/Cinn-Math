/**
 * @file state/gameState.ts
 * @description The core state management logic for the game using a reducer pattern.
 * @purpose This file centralizes all game state and the logic for how that state can change. It makes state transitions predictable, traceable, and easy to debug.
 * @ai-note This is the most important file for understanding the game's internal logic. All state changes happen here, triggered by `GameAction` types. When asked to modify game logic, your primary focus should be on how actions are handled in the `gameReducer`.
 */

import { GameStatus, GameScreen, TileType, Coords, ParticleType, NumberParticleType, StartGameConfig } from '../types';
import { DIFFICULTY_SETTINGS, GRID_SIZE, COMBO_DURATION_MS } from '../constants';
import { createInitialBoard } from '../gameLogic/boardUtils';
import { calculateSelectionValue } from '../gameLogic/matchLogic';

// --- STATE SHAPE ---

export interface GameState {
    // Screen and Status
    gameScreen: GameScreen;                 // Controls which major UI component is visible (start, game, themes)
    status: GameStatus;                     // The internal state machine for game logic (playing, paused, clearing, etc.)
    
    // Game Configuration
    config: StartGameConfig;                // Settings for the current game (mode, difficulty, etc.)
    
    // Board and Selection
    board: (TileType | null)[][];           // 2D array representing the game grid
    selectedCoords: Coords[];               // Array of coordinates for currently selected tiles
    isSelecting: boolean;                   // Flag for active drag selection
    
    // Core Game Metrics
    targetNumber: number;                   // The number players are trying to match
    timeLeft: number;                       // Remaining game time in seconds
    score: number;                          // Current score
    bestScore: number;                      // Highest score achieved (persisted)
    
    // Combo Tracking
    comboCount: number;                     // Current combo streak
    comboTimerKey: string;                  // Used to reset the combo bar CSS animation
    
    // UI/Animation State
    clearingCoords: Coords[];               // Coords of tiles being cleared after a match
    droppingTileIds: Set<string>;           // IDs of new tiles dropping in
    fallingOffTimeTileIds: Set<string>;     // IDs of time bonus tiles falling off the board
    incorrectSelection: string | null;      // A key to trigger the 'incorrect' animation
    isTargetMatched: boolean;               // Flag to trigger the target glow animation
    scoreJustUpdated: boolean;              // Flag to trigger the score flash animation
    
    // Effects State
    particles: ParticleType[];
    numberParticles: NumberParticleType[];
    announcements: { text: string; style: string; id: string }[];
    
    // Settings
    showValueIndicator: boolean;            // User preference for showing the value indicator on drag
    valueIndicator: { visible: boolean; value: number; x: number; y: number; }; // State for the drag value indicator
}

// --- INITIAL STATE ---

export const initialState: GameState = {
    gameScreen: 'start',
    status: 'ready',
    config: {
        mode: 'sum',
        difficulty: 'banana',
        selectionMode: 'tap',
    },
    board: [],
    selectedCoords: [],
    isSelecting: false,
    targetNumber: 0,
    timeLeft: 0,
    score: 0,
    bestScore: parseInt(localStorage.getItem('bestScore') || '0'),
    comboCount: 0,
    comboTimerKey: crypto.randomUUID(),
    clearingCoords: [],
    droppingTileIds: new Set(),
    fallingOffTimeTileIds: new Set(),
    incorrectSelection: null,
    isTargetMatched: false,
    scoreJustUpdated: false,
    particles: [],
    numberParticles: [],
    announcements: [],
    showValueIndicator: (localStorage.getItem('showValueIndicator') || 'true') === 'true',
    valueIndicator: { visible: false, value: 0, x: 0, y: 0 },
};

// --- ACTION DEFINITIONS ---

type StartGameAction = { type: 'START_GAME'; payload: StartGameConfig };
type PauseGameAction = { type: 'PAUSE_GAME' };
type ResumeGameAction = { type: 'RESUME_GAME' };
type RestartGameAction = { type: 'RESTART_GAME' };
type ReturnToMenuAction = { type: 'RETURN_TO_MENU' };
type NavigateThemesAction = { type: 'NAVIGATE_THEMES' };
type NavigateBackAction = { type: 'NAVIGATE_BACK'; payload: GameScreen };
type TickAction = { type: 'TICK' };
type GameOverAction = { type: 'GAME_OVER' };
type PointerDownAction = { type: 'POINTER_DOWN'; payload: Coords | null };
type PointerMoveAction = { type: 'POINTER_MOVE'; payload: { coords: Coords | null; clientX: number; clientY: number } };
type PointerUpAction = { type: 'POINTER_UP' };
type MatchSuccessAction = { type: 'MATCH_SUCCESS'; payload: { points: number; coordsToClear: Coords[] } };
type MatchFailureAction = { type: 'MATCH_FAILURE' };
type FinishClearingAction = { type: 'FINISH_CLEARING'; payload: { nextBoard: (TileType | null)[][], droppedIds: Set<string>} };
type StartBonusFallAction = { type: 'START_BONUS_FALL'; payload: { timeTiles: Set<string>, timeToAdd: number } };
type FinishBonusFallAction = { type: 'FINISH_BONUS_FALL'; payload: { nextBoard: (TileType | null)[][], droppedIds: Set<string>} };
type FinishTurnAction = { type: 'FINISH_TURN'; payload: { newTarget: number } };
type ResetAnimationsAction = { type: 'RESET_ANIMATIONS' };
type AddAnnouncementAction = { type: 'ADD_ANNOUNCEMENT'; payload: { text: string; style?: string; } };
type RemoveAnnouncementAction = { type: 'REMOVE_ANNOUNCEMENT'; payload: string };
type RemoveParticleAction = { type: 'REMOVE_PARTICLE'; payload: string };
type RemoveNumberParticleAction = { type: 'REMOVE_NUMBER_PARTICLE'; payload: string };
type ToggleValueIndicatorAction = { type: 'TOGGLE_VALUE_INDICATOR' };

export type GameAction =
  | StartGameAction | PauseGameAction | ResumeGameAction | RestartGameAction | ReturnToMenuAction
  | NavigateThemesAction | NavigateBackAction | TickAction | GameOverAction
  | PointerDownAction | PointerMoveAction | PointerUpAction
  | MatchSuccessAction | MatchFailureAction | FinishClearingAction
  | StartBonusFallAction | FinishBonusFallAction | FinishTurnAction
  | ResetAnimationsAction | AddAnnouncementAction | RemoveAnnouncementAction | RemoveParticleAction | RemoveNumberParticleAction
  | ToggleValueIndicatorAction;


// --- REDUCER FUNCTION ---

/**
 * @function gameReducer
 * @description The main reducer function. It takes the current state and an action, and returns the new state.
 * @param state The current GameState.
 * @param action The GameAction to be processed.
 * @returns The new GameState.
 * @ai-note This pure function is the "heart" of the game's logic. All state transitions are defined here. It should contain no side effects (like timeouts or API calls).
 */
export const gameReducer = (state: GameState, action: GameAction): GameState => {
    switch (action.type) {
        
        // --- Game Flow Actions ---

        case 'START_GAME': {
            const { difficulty } = action.payload;
            const newBoardData = createInitialBoard(difficulty);
            return {
                ...initialState,
                gameScreen: 'game',
                status: 'playing',
                config: action.payload,
                board: newBoardData.board,
                timeLeft: DIFFICULTY_SETTINGS[difficulty].initialTime,
                droppingTileIds: newBoardData.allIds,
                bestScore: state.bestScore, // Carry over best score
                showValueIndicator: state.showValueIndicator, // Carry over setting
            };
        }

        case 'RESTART_GAME': {
            const { difficulty } = state.config;
            const newBoardData = createInitialBoard(difficulty);
            return {
                ...initialState,
                gameScreen: 'game',
                status: 'playing',
                config: state.config,
                board: newBoardData.board,
                timeLeft: DIFFICULTY_SETTINGS[difficulty].initialTime,
                droppingTileIds: newBoardData.allIds,
                bestScore: state.bestScore,
                showValueIndicator: state.showValueIndicator,
            };
        }
            
        case 'PAUSE_GAME':
            return { ...state, status: 'paused' };
        
        case 'RESUME_GAME':
            return { ...state, status: 'playing' };

        case 'RETURN_TO_MENU':
            return { ...state, gameScreen: 'start', status: 'ready' };
        
        case 'NAVIGATE_THEMES':
            return { ...state, gameScreen: 'themes' };
        
        case 'NAVIGATE_BACK':
            return { ...state, gameScreen: action.payload };

        case 'TICK':
            return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
        
        case 'GAME_OVER':
            return { ...state, status: 'gameOver' };

        // --- Player Interaction Actions ---
        
        case 'POINTER_DOWN':
            if (!action.payload || state.status !== 'playing') return state;
            
            if (state.config.selectionMode === 'tap') {
                const isSelected = state.selectedCoords.some(c => c.row === action.payload!.row && c.col === action.payload!.col);
                const newSelection = isSelected
                    ? state.selectedCoords.filter(c => c.row !== action.payload!.row || c.col !== action.payload!.col)
                    : [...state.selectedCoords, action.payload];
                return { ...state, selectedCoords: newSelection };
            }
            // Drag mode
            const initialSelection = [action.payload];
            const initialValue = calculateSelectionValue(initialSelection, state.board, state.config.mode);
            return { 
                ...state, 
                isSelecting: true, 
                selectedCoords: initialSelection,
                valueIndicator: { ...state.valueIndicator, visible: true, value: initialValue }
            };
            
        case 'POINTER_MOVE': {
            const { clientX, clientY } = action.payload;

            // Always update position, even if there's no valid tile coord
            if (!state.isSelecting || !action.payload.coords) {
                 return { ...state, valueIndicator: { ...state.valueIndicator, x: clientX, y: clientY } };
            }
            
            const { coords } = action.payload;
            const { selectedCoords, board, config } = state;

            // CRITICAL FIX: Prevent crash if POINTER_MOVE fires after selection is cleared.
            if (selectedCoords.length === 0) {
                return { ...state, valueIndicator: { ...state.valueIndicator, x: clientX, y: clientY, visible: false } };
            }
            
            // Handle backtracking
            if (selectedCoords.length > 1) {
                const secondToLast = selectedCoords[selectedCoords.length - 2];
                if (secondToLast.row === coords.row && secondToLast.col === coords.col) {
                    const newSelection = selectedCoords.slice(0, -1);
                    const newValue = calculateSelectionValue(newSelection, board, config.mode);
                    return { 
                        ...state, 
                        selectedCoords: newSelection,
                        valueIndicator: { visible: true, value: newValue, x: clientX, y: clientY }
                    };
                }
            }

            const isAlreadySelected = selectedCoords.some(c => c.row === coords.row && c.col === coords.col);
            if (isAlreadySelected) {
                return { ...state, valueIndicator: { ...state.valueIndicator, x: clientX, y: clientY } };
            }

            const lastCoord = selectedCoords[selectedCoords.length - 1];
            const isAdjacent = Math.abs(lastCoord.row - coords.row) <= 1 && Math.abs(lastCoord.col - coords.col) <= 1;

            if (isAdjacent) {
                const newSelection = [...selectedCoords, coords];
                const newValue = calculateSelectionValue(newSelection, board, config.mode);
                return { 
                    ...state, 
                    selectedCoords: newSelection,
                    valueIndicator: { visible: true, value: newValue, x: clientX, y: clientY }
                };
            }
            return { ...state, valueIndicator: { ...state.valueIndicator, x: clientX, y: clientY } };
        }

        case 'POINTER_UP':
            return { ...state, isSelecting: false, valueIndicator: {...state.valueIndicator, visible: false} };

        // --- Match Logic Actions ---

        case 'MATCH_SUCCESS': {
            const newScore = state.score + action.payload.points;
            const newBestScore = Math.max(state.bestScore, newScore);
            localStorage.setItem('bestScore', String(newBestScore));
            return {
                ...state,
                score: newScore,
                bestScore: newBestScore,
                scoreJustUpdated: true,
                isTargetMatched: true,
                comboCount: state.comboCount + 1,
                comboTimerKey: crypto.randomUUID(),
                status: 'clearing',
                selectedCoords: [], // Clear selection immediately
                clearingCoords: action.payload.coordsToClear, // FIX: Set coords to be cleared
            };
        }

        case 'MATCH_FAILURE':
            return {
                ...state,
                incorrectSelection: crypto.randomUUID(),
                selectedCoords: [],
            };
        
        // --- Turn/Animation Sequence Actions ---
        
        case 'FINISH_CLEARING':
            return { ...state, status: 'falling', board: action.payload.nextBoard, droppingTileIds: action.payload.droppedIds, clearingCoords: [] };
        
        case 'START_BONUS_FALL':
            return { ...state, fallingOffTimeTileIds: action.payload.timeTiles, timeLeft: state.timeLeft + action.payload.timeToAdd };

        case 'FINISH_BONUS_FALL':
            return { ...state, board: action.payload.nextBoard, droppingTileIds: action.payload.droppedIds, fallingOffTimeTileIds: new Set() };
            
        case 'FINISH_TURN':
            return { ...state, status: 'playing', targetNumber: action.payload.newTarget };

        case 'RESET_ANIMATIONS':
            return {
                ...state,
                scoreJustUpdated: false,
                isTargetMatched: false,
                incorrectSelection: null,
                droppingTileIds: new Set(),
            };
        
        // --- Effects Actions ---
        
        case 'ADD_ANNOUNCEMENT':
            const newAnnouncement = { text: action.payload.text, style: action.payload.style || 'text-pink-500', id: crypto.randomUUID() };
            return { ...state, announcements: [...state.announcements, newAnnouncement] };

        case 'REMOVE_ANNOUNCEMENT':
            return { ...state, announcements: state.announcements.filter(a => a.id !== action.payload) };

        case 'REMOVE_PARTICLE':
            return { ...state, particles: state.particles.filter(p => p.id !== action.payload) };

        case 'REMOVE_NUMBER_PARTICLE':
            return { ...state, numberParticles: state.numberParticles.filter(p => p.id !== action.payload) };
            
        case 'TOGGLE_VALUE_INDICATOR':
            return { ...state, showValueIndicator: !state.showValueIndicator };

        default:
            return state;
    }
};