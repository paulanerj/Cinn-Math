import React from 'react';
import { ModalWrapper } from './ModalWrapper';
import { ThemeAssets } from '../types';
import { useGameSounds } from '../hooks/useGameSounds';

const { useState, useEffect, useRef } = React;

type GameOverModalProps = {
    show: boolean;
    score: number;
    bestScore: number;
    onRestart: () => void;
    themeAssets: ThemeAssets;
    volume: number;
};

const SadCinnamoroll = () => (
    <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-2 flex items-center justify-center bg-white/50 rounded-full">
        <span className="text-4xl">😢</span>
    </div>
);


export const GameOverModal = ({ show, score, bestScore, onRestart, themeAssets, volume }: GameOverModalProps) => {
    const [displayScore, setDisplayScore] = useState(0);
    const scoreRef = useRef<HTMLParagraphElement>(null);
    const playSound = useGameSounds(themeAssets.sounds, volume);
    const soundPlayedRef = useRef(false);

    useEffect(() => {
        if (show && !soundPlayedRef.current) {
            playSound('gameover');
            soundPlayedRef.current = true;
        } else if (!show) {
            soundPlayedRef.current = false; // Reset for next time
        }
    }, [show, playSound]);

    useEffect(() => {
        if (show) {
            let startTimestamp: number | null = null;
            const duration = 1500; // Animation duration in ms
            const step = (timestamp: number) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const currentAnimatedScore = Math.floor(progress * score);
                setDisplayScore(currentAnimatedScore);
                
                if(scoreRef.current && currentAnimatedScore % 5 === 0 && progress < 1) {
                    scoreRef.current.classList.add('counting');
                    setTimeout(() => scoreRef.current?.classList.remove('counting'), 150);
                }

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    setDisplayScore(score); // Ensure final score is exact
                    if(scoreRef.current) {
                        scoreRef.current.classList.add('counting');
                        setTimeout(() => scoreRef.current?.classList.remove('counting'), 150);
                    }
                }
            };
            requestAnimationFrame(step);
        } else {
            // Reset score when hidden
            setDisplayScore(0);
        }
    }, [score, show]);
    
    return (
        <ModalWrapper show={show} className="game-over-modal" modalContentClass={themeAssets.ui.modalContent}>
            <SadCinnamoroll />
            <h2 className="text-5xl sm:text-6xl font-display mb-4 text-red-500" style={{ textShadow: '3px 3px 0px white' }}>GAME OVER</h2>
            <div className="final-score-container my-4 inline-block">
                <p className="text-lg text-white">Your Score</p>
                <p ref={scoreRef} className="score-display text-5xl text-white transition-colors duration-100" style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.2)' }}>{displayScore}</p>
            </div>
            { score > bestScore && score > 0 ? 
                <p className="text-xl text-yellow-500 font-bold my-2">NEW BEST!</p> 
                : <p className="text-lg text-gray-600 font-bold my-2">Best: {bestScore}</p> 
            }
            <button 
                onClick={onRestart} 
                className={`theme-button bg-blue-500 hover:bg-blue-600 text-white py-4 px-10 text-xl mt-6 ${themeAssets.ui.button}`}
            >
                PLAY AGAIN
            </button>
        </ModalWrapper>
    );
};