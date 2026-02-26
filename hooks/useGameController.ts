/**
 * @file hooks/useGameController.ts
 * @description A custom hook that contains the game's logic and side effects.
 * @purpose This hook acts as the "controller" in a Model-View-Controller sense. It observes the game state and dispatches actions to the reducer to drive the game forward. It's responsible for all timers, animation sequencing, and game rule enforcement.
 * @ai-note This is the "brain" of the application's interactivity. All side effects (setTimeout, setInterval) are managed here. When a request involves changing the *flow* of the game (e.g., "add a 1-second delay after a match"), this is the file to modify. It uses the `state` to know what to do and the `dispatch` function to trigger the next state change.
 */
// FIX: Import React to provide namespace for React.Dispatch
import React, { useEffect, useCallback, useRef, useState } from 'react';
// FIX: GameState and GameAction are exported from gameState.ts, not types.ts
import { GameState, GameAction } from '../state/gameState';
import { TileType, SoundHook, Coords, GameMode } from '../types';
import { useGameSounds } from './useGameSounds';
import { useIsMounted } from './useIsMounted';
import { DROP_ANIMATION_DURATION, CLEAR_ANIMATION_DURATION, FALL_OFF_ANIMATION_DURATION, COMBO_DURATION_MS, TIME_BONUS, GRID_SIZE, DEBUG_END } from '../constants';
import { findPathForTarget, applyGravity } from '../gameLogic/boardUtils';
import { calculateSelectionValue, scanForMoves } from '../gameLogic/matchLogic';

// ─── Debug overlay shape ──────────────────────────────────────────────────────

/** Returned by useGameController when DEBUG_END=true; null when DEBUG_END=false. */
export type DebugEndInfo = {
    endCheckRuns: number;
    totalNonNullTiles: number;
    validPlayableCount: number;
    bombCount: number;
    deadCount: number;
    remainingKinds: string;
    /** Result of the last scanForMoves call */
    hasMove: boolean;
    moveReasons: { combine: boolean; bomb: boolean };
    /** Example path if hasMove is true, for display in the overlay */
    exampleMove: Coords[] | null;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

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

    // ── End-condition bookkeeping ─────────────────────────────────────────────
    // How many times the resolve pipeline ran this session.
    const endCheckRunsRef = useRef(0);
    // One-shot guard: prevents GAME_OVER from being dispatched more than once per game.
    const endTriggeredRef = useRef(false);
    // Latest snapshot for the debug overlay (populated every turn when DEBUG_END=true).
    const [debugEndInfo, setDebugEndInfo] = useState<DebugEndInfo>({
        endCheckRuns: 0,
        totalNonNullTiles: 0,
        validPlayableCount: 0,
        bombCount: 0,
        deadCount: 0,
        remainingKinds: 'NUMBER:0 TIME:0',
        hasMove: true,          // default true; overlay shows real value after first scan
        moveReasons: { combine: false, bomb: false },
        exampleMove: null,
    });

    /**
     * evaluateEndCondition
     *
     * Called once after every board-resolve pipeline completes (after gravity
     * and all bonus effects settle), passing the NEXT turn's target so that
     * scanForMoves tests whether the player can actually achieve it.
     *
     * END RULE: scanForMoves returns hasMove === false
     *   • Checks all paths of 1–3 adjacent tiles (8-neighbour) that contain
     *     at least one 'number' tile and whose calculateSelectionValue equals
     *     nextTarget.  This reuses the same validation the player's own
     *     selection goes through.
     *   • bomb / dead tile actions are not present in this build, so
     *     reasons.bomb is always false.
     *
     * When the condition fires, dispatches GAME_OVER and sets endTriggeredRef
     * so the calling code skips the FINISH_TURN dispatch.
     *
     * @param grid       The settled board after gravity / bonus removal.
     * @param nextTarget The target that findPathForTarget just generated for the
     *                   next turn (passed in so we test the real upcoming target).
     * @param gameMode   'sum' | 'multiply'.
     */
    const evaluateEndCondition = useCallback((
        grid: (TileType | null)[][],
        nextTarget: number,
        gameMode: GameMode,
    ) => {
        endCheckRunsRef.current += 1;

        const allTiles = grid.flat();
        const numberTiles = allTiles.filter(t => t?.type === 'number');
        const timeTiles   = allTiles.filter(t => t?.type === 'time');

        const scan = scanForMoves(grid, nextTarget, gameMode, GRID_SIZE);

        const info: DebugEndInfo = {
            endCheckRuns:      endCheckRunsRef.current,
            totalNonNullTiles: allTiles.filter(t => t !== null).length,
            validPlayableCount: numberTiles.length,
            bombCount:  0, // no bomb tile type in this build
            deadCount:  0, // no dead/stone tile type in this build
            remainingKinds: `NUMBER:${numberTiles.length} TIME:${timeTiles.length}`,
            hasMove:     scan.hasMove,
            moveReasons: scan.reasons,
            exampleMove: scan.exampleMove,
        };
        if (DEBUG_END) setDebugEndInfo(info);

        // ── No-moves end rule ─────────────────────────────────────────────────
        if (!scan.hasMove && !endTriggeredRef.current) {
            endTriggeredRef.current = true;
            dispatch({ type: 'GAME_OVER' });
            if (DEBUG_END) console.log('[CG no-moves end rule fired]', info);
        }

        return info;
    }, [dispatch]); // dispatch is stable (useReducer guarantee)

    // --- Game Timer ---
    useEffect(() => {
        if (status !== 'playing') return;
        const interval = setInterval(() => {
            dispatch({ type: 'TICK' });
        }, 1000);
        return () => clearInterval(interval);
    }, [status, dispatch]);

    // --- Check for Game Over (time-based) ---
    useEffect(() => {
        if (status === 'playing' && state.timeLeft <= 0) {
            dispatch({ type: 'GAME_OVER' });
        }
    }, [state.timeLeft, status, dispatch]);

    // --- DEBUG: log end stats once when game-over fires (DEBUG_END only) ---
    useEffect(() => {
        if (!DEBUG_END || status !== 'gameOver') return;
        // debugEndInfo holds the last snapshot from evaluateEndCondition; log it.
        console.log('[CG END triggered]', debugEndInfo);
    }, [status, debugEndInfo]);

    // --- Initial Board Setup & Target Generation ---
    useEffect(() => {
        if (status === 'playing' && targetNumber === 0) {
            // New game: reset the one-shot guard so this game can end correctly.
            endTriggeredRef.current = false;
            // After the initial drop animation, generate the first target then validate.
            setTimeout(() => {
                if (!isMounted.current) return;
                const newTarget = findPathForTarget(board, config.mode);
                evaluateEndCondition(board, newTarget, config.mode);
                if (!endTriggeredRef.current) {
                    dispatch({ type: 'FINISH_TURN', payload: { newTarget } });
                    dispatch({ type: 'RESET_ANIMATIONS' }); // Clear dropping state
                }
            }, DROP_ANIMATION_DURATION);
        }
    }, [status, targetNumber, board, config.mode, dispatch, isMounted, evaluateEndCondition]);

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

                        // 5a. After final gravity: generate next target, scan for moves, finish turn.
                        setTimeout(() => {
                             if (!isMounted.current) return;
                             const newTarget = findPathForTarget(nextBoard, config.mode);
                             evaluateEndCondition(nextBoard, newTarget, config.mode); // ← scan: bonus path
                             if (!endTriggeredRef.current) {
                                 dispatch({ type: 'FINISH_TURN', payload: { newTarget } });
                             }
                        }, DROP_ANIMATION_DURATION);
                    }, FALL_OFF_ANIMATION_DURATION);

                } else {
                    // 3b. No time bonus: generate next target, scan for moves, finish turn.
                    const newTarget = findPathForTarget(state.board, config.mode);
                    evaluateEndCondition(state.board, newTarget, config.mode); // ← scan: no-bonus path
                    if (!endTriggeredRef.current) {
                        dispatch({ type: 'FINISH_TURN', payload: { newTarget } });
                    }
                }
            }, DROP_ANIMATION_DURATION);
        }
    }, [status, state.board, config, dispatch, isMounted, playSound, evaluateEndCondition]);


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

    // Return debug info so App.tsx can render the overlay.
    // When DEBUG_END=false this returns null and the overlay is never rendered.
    return DEBUG_END ? debugEndInfo : null;
};
