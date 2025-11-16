

import React from 'react';
import { GameMode } from '../types';

const { memo } = React;

type GameHeaderProps = {
    gameMode: GameMode;
    targetNumber: number;
    timeLeft: number;
    score: number;
    scoreJustUpdated: boolean;
    isTargetMatched: boolean;
    onPause: () => void;
};

export const GameHeader = memo(({ gameMode, targetNumber, timeLeft, score, scoreJustUpdated, isTargetMatched, onPause }: GameHeaderProps) => {
    return (
        <div className="w-full max-w-md flex flex-col items-center relative gap-y-4 font-display">
             <button
                onClick={onPause}
                className="absolute -top-2 -right-2 h-14 w-14 bg-white/50 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-2xl text-[var(--text-dark)] transition-transform hover:scale-110 active:scale-95 z-20"
                aria-label="Pause game"
            >
                <i className="fas fa-bars"></i>
            </button>
            <div className={`flex items-center justify-between p-2 px-6 bg-white/50 rounded-2xl shadow-lg border-2 border-white w-full max-w-xs transition-transform duration-500 ${isTargetMatched ? 'target-matched-glow' : ''}`}>
                <div className="text-2xl text-[var(--text-dark)]">
                    {gameMode === 'sum' ? 'Target Sum:' : 'Target Product:'}
                </div>
                <div className="bg-white text-[var(--text-dark)] rounded-xl text-4xl font-bold px-5 py-1 shadow-inner">
                    {targetNumber}
                </div>
            </div>
            
            <div className="flex justify-between w-full max-w-sm">
                <div className="flex items-center justify-center space-x-3 bg-white/50 border-2 border-white rounded-full py-2 px-5 shadow-lg">
                    <i className="fas fa-clock text-2xl" style={{color: '#EAB308'}}></i> 
                    <span className="text-[var(--text-dark)] text-2xl">{timeLeft} sec</span>
                </div>
                <div className={`flex items-center justify-center bg-green-400 border-2 border-white rounded-full py-2 px-6 shadow-lg ${scoreJustUpdated ? 'score-flash' : ''}`}>
                     <span className="text-[var(--text-dark)] text-2xl">Score: {score}</span>
                </div>
            </div>
        </div>
    );
});