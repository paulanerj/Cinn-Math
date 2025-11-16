/**
 * @file StartScreen.tsx
 * @description The component for the main menu and game setup flow.
 * @purpose This component serves as the entry point for the user. It manages a multi-step process for the user to select game mode, difficulty, and selection style before starting the game.
 * @ai-note This is a self-contained state machine for game setup. The state `step` controls which view is shown. The final call to `onStartGame` passes all the selected configuration up to the main App component to initialize the game state.
 */
import React from 'react';
import { GameMode, Difficulty, SelectionMode, ThemeAssets, StartGameConfig } from '../types';
import { CinnamorollArt } from './CinnamorollArt';

const { useState } = React;

type StartScreenProps = {
    onStartGame: (config: StartGameConfig) => void;
    onGoToThemes: () => void;
    themeAssets: ThemeAssets;
};

export const StartScreen = ({ onStartGame, onGoToThemes, themeAssets }: StartScreenProps) => {
    // Internal state to manage the setup flow (mode -> difficulty -> selection).
    const [step, setStep] = useState<'mode' | 'difficulty' | 'selection'>('mode');
    const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
    const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);

    const handleModeSelect = (mode: GameMode) => {
        setSelectedMode(mode);
        setStep('difficulty');
    };

    const handleDifficultySelect = (difficulty: Difficulty) => {
        setSelectedDifficulty(difficulty);
        setStep('selection');
    };
    
    const handleSelectionModeSelect = (selectionMode: SelectionMode) => {
        if (selectedMode && selectedDifficulty) {
            // All options selected, now start the game.
            onStartGame({ mode: selectedMode, difficulty: selectedDifficulty, selectionMode });
        }
    };

    const buttonClasses = `theme-button py-6 px-12 text-2xl shadow-lg ${themeAssets.ui.button}`;

    // RENDER: Selection Style Step
    if (step === 'selection') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <h2 className="text-4xl sm:text-5xl font-display mb-6 text-[var(--text-dark)]">Selection Style</h2>
                <div className="flex flex-col space-y-4">
                    <button onClick={() => handleSelectionModeSelect('drag')} className={`${buttonClasses} bg-blue-400 hover:bg-blue-500 text-white`}>Classic Drag</button>
                    <button onClick={() => handleSelectionModeSelect('tap')} className={`${buttonClasses} bg-purple-400 hover:bg-purple-500 text-white`}>Free Tap</button>
                </div>
                 <button onClick={() => setStep('difficulty')} className="mt-8 text-gray-600 hover:text-gray-800 transition-colors">&larr; Back</button>
            </div>
        );
    }

    // RENDER: Difficulty Step
    if (step === 'difficulty') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <h2 className="text-4xl sm:text-5xl font-display mb-6 text-[var(--text-dark)]">Choose Difficulty</h2>
                <div className="flex flex-col space-y-4">
                    <button onClick={() => handleDifficultySelect('banana')} className={`${buttonClasses} bg-yellow-400 hover:bg-yellow-500 text-white`}>Banana</button>
                    <button onClick={() => handleDifficultySelect('apple')} className={`${buttonClasses} bg-green-500 hover:bg-green-600 text-white`}>Apple</button>
                    <button onClick={() => handleDifficultySelect('coconut')} className={`${buttonClasses} bg-red-500 hover:bg-red-600 text-white`}>Coconut</button>
                </div>
                <button onClick={() => setStep('mode')} className="mt-8 text-gray-600 hover:text-gray-800 transition-colors">&larr; Back</button>
            </div>
        );
    }

    // RENDER: Main Menu (Mode Selection) Step
    const mainButtonClasses = `theme-button py-4 px-10 text-2xl shadow-lg ${themeAssets.ui.button}`;

    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <CinnamorollArt className="w-48 h-48 mb-4" />
            <h1 className="text-5xl sm:text-6xl font-display mb-4 text-[var(--text-dark)]">Cinnamoroll's Sweet Sums</h1>
            <p className="text-lg sm:text-xl mb-8 max-w-md text-[var(--text-dark)]">Select tiles to match the target. Cinnamoroll tiles give extra time when they reach the bottom!</p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button onClick={() => handleModeSelect('sum')} className={`${mainButtonClasses} bg-pink-500 hover:bg-pink-600 text-white`}>Cinnamon Sums</button>
                <button onClick={() => handleModeSelect('multiply')} className={`${mainButtonClasses} bg-sky-500 hover:bg-sky-600 text-white`}>Cinnamon Products</button>
            </div>
            <button onClick={onGoToThemes} className={`theme-button mt-4 bg-white/50 hover:bg-white text-gray-700 py-3 px-8 text-xl shadow-md transition-colors ${themeAssets.ui.button}`}>THEMES</button>
        </div>
    );
};
