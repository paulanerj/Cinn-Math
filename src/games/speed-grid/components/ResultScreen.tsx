// ─────────────────────────────────────────────────────────────────────────────
// src/games/speed-grid/components/ResultScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
// [ROLE] Final score screen shown when the SpeedGrid countdown expires.
//        Displays session summary and offers Play Again / Back actions.
//
// [WHY STANDALONE] ResultScreen is not shared with CombineGrid — different
//        data (chains, bonuses, final score vs rounds) and different intent.
//        Do not import this from CombineGrid or extract a shared component.
//
// [INVARIANT] This component is purely presentational — no state, no timers,
//             no refs. All data arrives via props. Both action buttons call
//             their respective callbacks directly.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type { ScoreState } from '../../../systems/ScoreSystem';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ResultScreenProps {
  score: ScoreState;
  chainsCompleted: number;
  bonusesCollected: number;
  onPlayAgain: () => void;
  onBack: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResultScreen({
  score,
  chainsCompleted,
  bonusesCollected,
  onPlayAgain,
  onBack,
}: ResultScreenProps) {
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
        gap: 20,
        fontFamily: 'Nunito, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Title */}
      <div
        style={{
          color: '#fff',
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        Time&apos;s Up!
      </div>

      {/* Score card */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: 24,
          padding: '24px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          minWidth: 220,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}
      >
        {/* Final score (large) */}
        <div
          style={{ color: '#3b82f6', fontSize: 56, fontWeight: 900, lineHeight: 1 }}
        >
          {score.score}
        </div>
        <div style={{ color: '#64748b', fontSize: 13, letterSpacing: 1 }}>
          FINAL SCORE
        </div>

        {/* Divider */}
        <div
          style={{ width: '100%', height: 1, background: '#334155', margin: '4px 0' }}
        />

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 36 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>
              {chainsCompleted}
            </div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Chains</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fbbf24', fontSize: 22, fontWeight: 700 }}>
              {bonusesCollected}
            </div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Bonuses</div>
          </div>
        </div>
      </div>

      {/* Play Again */}
      <button
        onClick={onPlayAgain}
        style={{
          padding: '14px 40px',
          borderRadius: 18,
          border: 'none',
          background: '#3b82f6',
          color: '#fff',
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 5px 0 rgba(29,78,216,1)',
          letterSpacing: 0.5,
        }}
      >
        Play Again
      </button>

      {/* Back */}
      <button
        onClick={onBack}
        style={{
          padding: '12px 28px',
          borderRadius: 14,
          border: 'none',
          background: '#1e293b',
          color: '#94a3b8',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ← Back
      </button>
    </div>
  );
}
