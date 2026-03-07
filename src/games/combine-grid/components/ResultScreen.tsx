import React from 'react';
import { GamePhase } from '../types';
import { ROUNDS_PER_SESSION } from '../constants';

interface ResultScreenProps {
  phase: GamePhase;
  trophies: number;
  score: number;
  round: number;
  target: number;
  onNext: () => void;
  onRestart: () => void;
}

export default function ResultScreen({ phase, trophies, score, round, target, onNext, onRestart }: ResultScreenProps) {
  if (phase === 'FINAL') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/95 z-50 gap-5 p-6">
        <span className="text-6xl">🏆</span>
        <h2 className="text-3xl font-extrabold text-indigo-700">Final Trophies</h2>
        <p className="text-5xl font-black text-yellow-500">{trophies}</p>
        <p className="text-gray-600 text-lg">Score: <strong>{score}</strong></p>
        <button
          onClick={onRestart}
          className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-lg font-bold shadow-lg active:scale-95"
        >
          Play Again
        </button>
      </div>
    );
  }

  if (phase === 'ROUND_OVER' || phase === 'STALEMATE') {
    const isFinalRound = round >= ROUNDS_PER_SESSION;
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/95 z-50 gap-4 p-6">
        <span className="text-5xl">{phase === 'STALEMATE' ? '😅' : '✅'}</span>
        <h2 className="text-2xl font-bold text-gray-800">
          {phase === 'STALEMATE' ? 'No More Moves!' : 'Round Over!'}
        </h2>
        <p className="text-gray-500">Target was <strong className="text-indigo-600">{target}</strong></p>
        <p className="text-gray-700">Trophies: <strong className="text-yellow-500">{trophies} 🏆</strong></p>
        <p className="text-gray-600">Score: <strong>{score}</strong></p>
        <button
          onClick={isFinalRound ? onRestart : onNext}
          className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-lg font-bold shadow-lg active:scale-95"
        >
          {isFinalRound ? 'See Final Trophies' : 'Next Problem'}
        </button>
      </div>
    );
  }

  return null;
}
