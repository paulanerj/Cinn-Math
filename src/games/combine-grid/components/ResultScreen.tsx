import React from 'react';
import { ROUNDS_PER_SESSION } from '../constants';

interface ResultScreenProps {
  totalScore: number;
  roundScores: number[];
  mode: 'sum' | 'multiply';
  onPlayAgain: () => void;
  onBack: () => void;
}

export default function ResultScreen({
  totalScore,
  roundScores,
  mode,
  onPlayAgain,
  onBack,
}: ResultScreenProps) {
  const bestRound = Math.max(...roundScores, 0);
  const bestRoundIdx = roundScores.indexOf(bestRound);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#141416',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        fontFamily: 'Nunito, sans-serif',
        padding: '0 20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Title */}
      <div
        style={{
          color: '#e67e22',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        CombineGrid
      </div>

      {/* Total score */}
      <div
        style={{
          color: '#fff',
          fontSize: 64,
          fontWeight: 900,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {totalScore}
      </div>
      <div
        style={{
          color: '#888',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 24,
        }}
      >
        TOTAL SCORE • {mode.toUpperCase()} MODE
      </div>

      {/* Round breakdown */}
      <div
        style={{
          width: '100%',
          maxWidth: 300,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 28,
        }}
      >
        {roundScores.map((s, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background:
                i === bestRoundIdx ? 'rgba(230,126,34,0.12)' : 'rgba(255,255,255,0.04)',
              borderRadius: 10,
              padding: '8px 14px',
              border:
                i === bestRoundIdx
                  ? '1.5px solid rgba(230,126,34,0.35)'
                  : '1.5px solid transparent',
            }}
          >
            <span style={{ color: '#aaa', fontSize: 13, fontWeight: 700 }}>
              Round {i + 1}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i === bestRoundIdx && (
                <span style={{ fontSize: 11, color: '#e67e22', fontWeight: 800 }}>
                  BEST
                </span>
              )}
              <span
                style={{
                  color: i === bestRoundIdx ? '#e67e22' : '#fff',
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                {s}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <button
        onClick={onPlayAgain}
        style={{
          width: 240,
          padding: '16px 0',
          borderRadius: 16,
          border: 'none',
          background: '#e67e22',
          color: '#fff',
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          letterSpacing: 1,
          boxShadow: '0 5px 0 rgba(154,52,18,1)',
          marginBottom: 12,
        }}
      >
        Play Again
      </button>
      <button
        onClick={onBack}
        style={{
          width: 240,
          padding: '14px 0',
          borderRadius: 16,
          border: 'none',
          background: 'rgba(255,255,255,0.06)',
          color: '#bbb',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ← Back to Menu
      </button>
    </div>
  );
}
