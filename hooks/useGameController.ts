/**
 * @file hooks/useGameController.ts
 * @description A custom hook that contains the game's logic and side effects.
 * @purpose This hook acts as the "controller" in a Model-View-Controller sense. It observes the game state and dispatches actions to the reducer to drive the game forward. It's responsible for all timers, animation sequencing, and game rule enforcement.
 * @ai-note This is the "brain" of the application's interactivity. All side effects (setTimeout, setInterval) are managed here. When a request involves changing the *flow* of the game (e.g., "add a 1-second delay after a match"), this is the file to modify. It uses the `state` to know what to do and the `dispatch` function to trigger the next state change.
 */
// FIX: Import React to provide namespace for React.Dispatch
import React, { useEffect, useCallback, useRef } from 'react';
// FIX: GameState and GameAction are exported from gameState.ts, not types.ts
import { GameState, GameAction } from '../state/gameState';
import { TileType, SoundHook } from '../types';
import { useGameSounds } from './useGameSounds';
import { useIsMounted } from './useIsMounted';
import { DROP_ANIMATION_DURATION, CLEAR_ANIMATION_DURATION, FALL_OFF_ANIMATION_DURATION, COMBO_DURATION_MS, TIME_BONUS, GRID_SIZE } from '../constants';
import { findPathForTarget, applyGravity } from '../gameLogic/boardUtils';
import { calculateSelectionValue } from '../gameLogic/matchLogic';

export const useGameController = (
    state: GameState,
    dispatch: React.Dispatch<GameAction>,
    soundMap: Partial<Record<SoundHook, string>>,
    volume: number
) => {
    const { status, selectedCoords, board, config, comboCount, targetNumber } = state;
    const playSound = useGameSounds(soundMap, volume);
    const isMounted = useIsMounted();
    const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Game Timer ---
    useEffect(() => {
        if (status !== 'playing') return;
        const interval = setInterval(() => {
            dispatch({ type: 'TICK' });
        }, 1000);
        return () => clearInterval(interval);
    }, [status, dispatch]);

    // --- Check for Game Over ---
    useEffect(() => {
        if (status === 'playing' && state.timeLeft <= 0) {
            dispatch({ type: 'GAME_OVER' });
        }
    }, [state.timeLeft, status, dispatch]);

    // --- Initial Board Setup & Target Generation ---
    useEffect(() => {
        if (status === 'playing' && targetNumber === 0) {
            // After the initial drop animation, generate the first target
            setTimeout(() => {
                if (!isMounted.current) return;
                const newTarget = findPathForTarget(board, config.mode);
                dispatch({ type: 'FINISH_TURN', payload: { newTarget } });
                dispatch({ type: 'RESET_ANIMATIONS' }); // Clear dropping state
            }, DROP_ANIMATION_DURATION);
        }
    }, [status, targetNumber, board, config.mode, dispatch, isMounted]);

    // --- Selection Logic and Match Checking ---
    const checkMatch = useCallback(() => {
        if (selectedCoords.length === 0) return;
        
        // A selection is only valid if it contains at least one number tile.
        const hasNumberTile = selectedCoords.some(c => board[c.row]?.[c.col]?.type === 'number');
        if (!hasNumberTile) {
            // For drag mode, an all-special-tile selection is an error on pointer up.
            if (config.selectionMode === 'drag' && !state.isSelecting) {
                dispatch({ type: 'MATCH_FAILURE' });
            }
            // For tap mode, we just wait for more tiles.
            return;
        }

        const currentVal = calculateSelectionValue(selectedCoords, board, config.mode);
        
        // --- SUCCESS CONDITION (applies to both modes) ---
        if (currentVal === targetNumber) {
            const selectedNumberTiles = selectedCoords.map(({ row, col }) => board[row][col]).filter(t => t?.type === 'number');
            const points = selectedNumberTiles.reduce((sum, tile) => sum + (tile!.value as number), 0) * (1 + comboCount * 0.1);
            const comboSfx = `match_L${Math.min(comboCount, 3) + 1}` as SoundHook;
            playSound(soundMap[comboSfx] ? comboSfx : 'match_L1');
            
            if (comboCount > 0 && (comboCount + 1) % 3 === 0) {
                playSound('combo');
                dispatch({ type: 'ADD_ANNOUNCEMENT', payload: { text: `${comboCount + 1}x COMBO!` }});
            }

            dispatch({ type: 'MATCH_SUCCESS', payload: { points: Math.ceil(points), coordsToClear: selectedCoords } });
            return; // Match found, no need to check for failure
        }
        
        // --- FAILURE CONDITIONS (mode-specific) ---
        // For 'tap' mode, fail immediately if the value exceeds the target.
        if (config.selectionMode === 'tap' && currentVal > targetNumber) {
            playSound('error');
            dispatch({ type: 'MATCH_FAILURE' });
        }
        // For 'drag' mode, only fail on pointer up if the value is not the target.
        else if (config.selectionMode === 'drag' && !state.isSelecting && currentVal !== targetNumber) {
            playSound('error');
            dispatch({ type: 'MATCH_FAILURE' });
        }

    }, [selectedCoords, board, config.mode, targetNumber, comboCount, dispatch, playSound, soundMap, state.isSelecting]);

    // This effect triggers the checkMatch logic based on selection mode
    useEffect(() => {
        if (status !== 'playing') return;

        // For 'tap' mode, check after every selection change.
        if (config.selectionMode === 'tap') {
            checkMatch();
        }
        
        // For 'drag' mode, check only on pointer up to prevent premature failure.
        if (config.selectionMode === 'drag' && !state.isSelecting) {
            checkMatch();
        }

    }, [selectedCoords, status, config.selectionMode, state.isSelecting, checkMatch]);


    // --- Post-Match Animation and Turn Flow ---
    useEffect(() => {
        if (status === 'clearing' && state.clearingCoords.length > 0) { // check clearingCoords to avoid re-triggering
            // 1. Animation is happening based on `clearingCoords`.
            // 2. After clearing animation, apply gravity
            setTimeout(() => {
                if (!isMounted.current) return;
                let boardAfterClear = board.map(r => [...r]);
                state.clearingCoords.forEach(({ row, col }) => { boardAfterClear[row][col] = null; });
                const { nextBoard, droppedIds } = applyGravity(boardAfterClear, config.mode, config.difficulty);
                dispatch({ type: 'FINISH_CLEARING', payload: { nextBoard, droppedIds } });
            }, CLEAR_ANIMATION_DURATION);
        }
    }, [status, board, config, dispatch, isMounted, state.clearingCoords]);


    useEffect(() => {
        if (status === 'falling') {
            // This status is set after gravity is applied. Now check for time bonuses.
            setTimeout(() => {
                if (!isMounted.current) return;
                const timeBonuses = new Set<string>();
                for (let c = 0; c < GRID_SIZE; c++) {
                    const tile = state.board[GRID_SIZE - 1]?.[c];
                    if (tile?.type === 'time') timeBonuses.add(tile.id);
                }

                if (timeBonuses.size > 0) {
                    playSound('bonus');
                    // 3a. Time bonus found, start fall-off animation
                    dispatch({ type: 'START_BONUS_FALL', payload: { timeTiles: timeBonuses, timeToAdd: TIME_BONUS * timeBonuses.size } });
                    
                    // 4a. After fall-off, apply gravity again
                    setTimeout(() => {
                        if (!isMounted.current) return;
                        let boardAfterBonus = state.board.map(row => row.map(tile => timeBonuses.has(tile?.id || '') ? null : tile));
                        const { nextBoard, droppedIds } = applyGravity(boardAfterBonus, config.mode, config.difficulty);
                        dispatch({ type: 'FINISH_BONUS_FALL', payload: { nextBoard, droppedIds } });

                        // 5a. After final gravity, generate new target and finish turn
                        setTimeout(() => {
                             if (!isMounted.current) return;
                             const newTarget = findPathForTarget(nextBoard, config.mode);
                             dispatch({ type: 'FINISH_TURN', payload: { newTarget } });
                        }, DROP_ANIMATION_DURATION);
                    }, FALL_OFF_ANIMATION_DURATION);

                } else {
                    // 3b. No time bonus, just generate new target and finish turn
                    const newTarget = findPathForTarget(state.board, config.mode);
                    dispatch({ type: 'FINISH_TURN', payload: { newTarget } });
                }
            }, DROP_ANIMATION_DURATION);
        }
    }, [status, state.board, config, dispatch, isMounted, playSound]);

    
    // --- Animation Cleanup Effect ---
    useEffect(() => {
        if (state.scoreJustUpdated || state.isTargetMatched || state.incorrectSelection || state.droppingTileIds.size > 0) {
            const timer = setTimeout(() => {
                if (isMounted.current) {
                    dispatch({ type: 'RESET_ANIMATIONS' });
                }
            }, 800); // A generous duration to cover longest animation
            return () => clearTimeout(timer);
        }
    }, [state.scoreJustUpdated, state.isTargetMatched, state.incorrectSelection, state.droppingTileIds, dispatch, isMounted]);

    // --- Combo Timer Effect ---
    useEffect(() => {
        if (comboTimerRef.current) {
            clearTimeout(comboTimerRef.current);
        }
        if (comboCount > 0) {
            comboTimerRef.current = setTimeout(() => {
                //dispatch({ type: 'RESET_COMBO' });
            }, COMBO_DURATION_MS);
        }
        return () => {
            if (comboTimerRef.current) {
                clearTimeout(comboTimerRef.current);
            }
        };
    }, [comboCount, dispatch]);

    // --- Announcement Cleanup Effect ---
    useEffect(() => {
        if (state.announcements.length > 0) {
            const latestAnnouncement = state.announcements[state.announcements.length - 1];
            const timer = setTimeout(() => {
                dispatch({ type: 'REMOVE_ANNOUNCEMENT', payload: latestAnnouncement.id });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [state.announcements, dispatch]);
};