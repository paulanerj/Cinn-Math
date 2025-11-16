/**
 * @file App.tsx
 * @description The root component of the application.
 * @purpose This component orchestrates the entire application. It initializes the game state using the `useReducer` pattern and manages the main application flow, switching between different screens (Start, Game, Themes). It connects the state, game logic (controller), and UI components.
 * @ai-note This is the central hub. The core architectural pattern is `useReducer` for state and `useGameController` for logic/side-effects. To understand the game flow, trace the actions dispatched from `useGameController` to the `gameReducer` in `state/gameState.ts`.
 */
import React, { useState, useEffect, useReducer } from 'react';
import { GameScreen, Theme, ThemeAssets, Coords, StartGameConfig } from './types';
import { THEMES } from './themes';
import { gameReducer, initialState } from './state/gameState';
import { useGameController } from './hooks/useGameController';

// Component Imports
import { StartScreen } from './components/StartScreen';
import { GameHeader } from './components/GameHeader';
import { Tile } from './components/Tile';
import { GameOverModal } from './components/GameOverModal';
import { MenuModal } from './components/MenuModal';
import { Effects } from './components/Effects';
import { ComboMeter } from './components/ComboMeter';
import { ValueIndicator } from './components/ValueIndicator';
import { ThemeScreen } from './components/ThemeScreen';

/**
 * @function getCoordsFromEvent
 * @description A utility to extract tile coordinates from a pointer event.
 * @ai-note This function is crucial for interactivity. It uses `document.elementFromPoint` for `pointermove` because the event's direct `target` can be unreliable during a drag gesture. This ensures accuracy.
 * @param {React.PointerEvent} e The pointer event.
 * @returns {Coords | null} The row/col coordinates of the tile under the cursor, or null.
 */
const getCoordsFromEvent = (e: React.PointerEvent): Coords | null => {
    const targetEl = e.type === 'pointermove' 
        ? document.elementFromPoint(e.clientX, e.clientY) 
        : e.target;

    const el = targetEl as HTMLElement;
    const tileEl = el?.closest('.tile') as HTMLElement | null;
    if (tileEl?.dataset.row && tileEl?.dataset.col) {
        return { row: parseInt(tileEl.dataset.row), col: parseInt(tileEl.dataset.col) };
    }
    return null;
};

export const App = () => {
    // --- STATE MANAGEMENT ---
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const {
        gameScreen, status, config, board, targetNumber, selectedCoords, timeLeft,
        score, bestScore, clearingCoords, droppingTileIds, fallingOffTimeTileIds,
        incorrectSelection, scoreJustUpdated, isTargetMatched, particles, numberParticles,
        announcements, comboCount, comboTimerKey, valueIndicator, showValueIndicator,
    } = state;

    // --- LOCAL UI STATE & PERSISTENCE ---
    const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('volume') || '0.5'));
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'classic');
    const [returnToScreen, setReturnToScreen] = useState<GameScreen>('start');
    const themeAssets = THEMES[theme];

    // --- GAME LOGIC / SIDE EFFECTS CONTROLLER ---
    // The controller hook manages all timers, animations, and game logic flows.
    useGameController(state, dispatch, themeAssets.sounds, volume);

    // --- PERSISTENCE EFFECTS ---
    useEffect(() => { localStorage.setItem('volume', String(volume)); }, [volume]);
    useEffect(() => { localStorage.setItem('theme', theme); }, [theme]);
    useEffect(() => { localStorage.setItem('showValueIndicator', String(showValueIndicator)); }, [showValueIndicator]);

    // --- THEME APPLICATION EFFECT ---
    useEffect(() => {
        const root = document.documentElement;
        Object.keys(THEMES).forEach(themeName => root.classList.remove(`theme-${themeName}`));
        root.classList.add(`theme-${theme}`);
        Object.entries(themeAssets.colors).forEach(([key, value]) => root.style.setProperty(key, value as string));
        Object.entries(themeAssets.textures).forEach(([key, value]) => root.style.setProperty(key, value as string));
    }, [theme, themeAssets]);

    // --- EVENT HANDLERS ---
    const handleStartGame = (gameConfig: StartGameConfig) => dispatch({ type: 'START_GAME', payload: gameConfig });
    const handlePause = () => dispatch({ type: 'PAUSE_GAME' });
    const handleResume = () => dispatch({ type: 'RESUME_GAME' });
    const handleRestart = () => dispatch({ type: 'RESTART_GAME' });
    const handleReturnToMenu = () => dispatch({ type: 'RETURN_TO_MENU' });
    const handlePointerDown = (e: React.PointerEvent) => dispatch({ type: 'POINTER_DOWN', payload: getCoordsFromEvent(e) });
    const handlePointerMove = (e: React.PointerEvent) => {
        if (state.isSelecting) { // Optimization: only dispatch if a selection is active
            dispatch({ type: 'POINTER_MOVE', payload: { coords: getCoordsFromEvent(e), clientX: e.clientX, clientY: e.clientY } });
        }
    };
    const handlePointerUp = () => dispatch({ type: 'POINTER_UP' });
    const handleToggleValueIndicator = () => dispatch({ type: 'TOGGLE_VALUE_INDICATOR' });
    
    const goToThemeScreen = (returnScreen: GameScreen) => {
        setReturnToScreen(returnScreen);
        dispatch({ type: 'NAVIGATE_THEMES' });
    };
    const handleBackFromThemes = () => dispatch({ type: 'NAVIGATE_BACK', payload: returnToScreen });

    // --- RENDER LOGIC ---

    if (gameScreen === 'start') {
        return <StartScreen themeAssets={themeAssets} onStartGame={handleStartGame} onGoToThemes={() => goToThemeScreen('start')} />;
    }
    
    if (gameScreen === 'themes') {
        return <ThemeScreen currentTheme={theme} onSelectTheme={setTheme} onBack={handleBackFromThemes} />;
    }

    // Main Game Screen
    const gridEventHandlers = config.selectionMode === 'drag' 
        ? { onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onPointerLeave: handlePointerUp }
        : { onPointerDown: handlePointerDown }; // Tap mode just uses pointer down

    return (
        <div className={`flex flex-col items-center h-full max-h-[100vh] w-full pt-4 theme-${theme}`}>
            <Effects 
                particles={particles} numberParticles={numberParticles} announcements={announcements}
                onParticleCompleted={(id) => dispatch({ type: 'REMOVE_PARTICLE', payload: id })}
                onNumberParticleCompleted={(id) => dispatch({ type: 'REMOVE_NUMBER_PARTICLE', payload: id })}
            />
            {config.selectionMode === 'drag' && <ValueIndicator {...valueIndicator} visible={valueIndicator.visible && showValueIndicator}/>}
            
            <GameOverModal show={status === 'gameOver'} score={score} bestScore={bestScore} onRestart={handleRestart} themeAssets={themeAssets} volume={volume} />
            
            <MenuModal 
                show={status === 'paused'} themeAssets={themeAssets}
                onResume={handleResume} 
                onRestart={handleRestart} 
                onReturnToMenu={handleReturnToMenu} 
                volume={volume} onVolumeChange={setVolume} 
                onGoToThemes={() => goToThemeScreen('game')}
                selectionMode={config.selectionMode}
                showValueIndicator={showValueIndicator}
                onShowValueIndicatorChange={handleToggleValueIndicator}
            />

            <GameHeader gameMode={config.mode} targetNumber={targetNumber} timeLeft={timeLeft} score={score} scoreJustUpdated={scoreJustUpdated} isTargetMatched={isTargetMatched} onPause={handlePause} />
            <ComboMeter count={comboCount} timerKey={comboTimerKey} />
            
            <div className="relative mt-4">
                <div 
                    className={`game-grid transition-transform duration-300 ${status === 'clearing' ? 'board-shake' : ''}`}
                    {...gridEventHandlers}
                >
                    {board.map((row, r) => 
                        row.map((tile, c) => {
                            const isSelected = selectedCoords.some(coord => coord.row === r && coord.col === c);
                            const isClearing = clearingCoords.some(coord => coord.row === r && coord.col === c);
                            return (
                                <Tile 
                                    key={`${r}-${c}-${tile?.id || 'empty'}`} 
                                    tileData={tile} row={r} col={c} isSelected={isSelected} isClearing={isClearing} 
                                    isDropping={droppingTileIds.has(tile?.id || '')} 
                                    isFallingOff={fallingOffTimeTileIds.has(tile?.id || '')} 
                                    isIncorrect={isSelected && incorrectSelection !== null} 
                                    animationDelay={`${(r * 0.05 + c * 0.02)}s`}
                                    timeIconUrl={themeAssets.images['time-tile-icon']}
                                />
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};