import React from 'react';

interface ResultScreenProps {
  totalScore: number;
  onBack: () => void;
}

export default function ResultScreen({ totalScore, onBack }: ResultScreenProps) {
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
        gap: 12,
        fontFamily: 'Nunito, sans-serif',
      }}
    >
      <div
        style={{
          color: '#e67e22',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        CombineGrid
      </div>

      <div style={{ color: '#fff', fontSize: 64, fontWeight: 900, lineHeight: 1 }}>
        {totalScore}
      </div>
      <div style={{ color: '#888', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
        FINAL SCORE
      </div>

      <button
        onClick={onBack}
        style={{
          marginTop: 16,
          width: 240,
          padding: '16px 0',
          borderRadius: 16,
          border: 'none',
          background: '#e67e22',
          color: '#ffffff',
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
