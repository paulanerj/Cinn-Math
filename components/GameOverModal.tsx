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

// Number of ticks used to count the score up.
// 20 ticks × 500 ms = 10 s maximum counting time regardless of score.
const COUNTING_STEPS = 20;

export const GameOverModal = ({ show, score, bestScore, onRestart, themeAssets, volume }: GameOverModalProps) => {
    const [displayScore, setDisplayScore] = useState(0);
    // Becomes true only after the counting sequence finishes; gates the button.
    const [countingDone, setCountingDone] = useState(false);
    const scoreRef = useRef<HTMLParagraphElement>(null);
    const playSound = useGameSounds(themeAssets.sounds, volume);
    const soundPlayedRef = useRef(false);

    // Play the game-over stinger once when the modal first appears.
    useEffect(() => {
        if (show && !soundPlayedRef.current) {
            playSound('gameover');
            soundPlayedRef.current = true;
        } else if (!show) {
            soundPlayedRef.current = false;
        }
    }, [show, playSound]);

    // Counting sequence: tick at 2 Hz, sound on each step, fanfare at end.
    useEffect(() => {
        if (!show) {
            setDisplayScore(0);
            setCountingDone(false);
            return;
        }

        // Edge case: score of 0 — skip counting, show button immediately.
        if (score === 0) {
            setCountingDone(true);
            return;
        }

        const increment = Math.ceil(score / COUNTING_STEPS);
        let step = 0;
        setDisplayScore(0);
        setCountingDone(false);

        const pulse = () => {
            if (scoreRef.current) {
                scoreRef.current.classList.add('counting');
                setTimeout(() => scoreRef.current?.classList.remove('counting'), 150);
            }
        };

        const interval = setInterval(() => {
            step += 1;
            const next = Math.min(step * increment, score);
            setDisplayScore(next);
            pulse();

            if (next >= score) {
                clearInterval(interval);
                setCountingDone(true);
                playSound('combo'); // fanfare when counting finishes
            } else {
                playSound('select'); // tick on each intermediate step
            }
        }, 500); // 2 ticks per second

        return () => clearInterval(interval);
    }, [show, score, playSound]);

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
            {/* Button appears only after the counting sequence completes. */}
            {countingDone && (
                <button
                    onClick={onRestart}
                    className={`theme-button bg-blue-500 hover:bg-blue-600 text-white py-4 px-10 text-xl mt-6 ${themeAssets.ui.button}`}
                >
                    PLAY AGAIN
                </button>
            )}
        </ModalWrapper>
    );
};
