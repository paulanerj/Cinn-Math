
import React, { useEffect, useRef, forwardRef } from 'react';

interface EquationVaultProps {
  equation: string;
  isFlashing?: boolean;
}

/**
 * ============================================================================
 * 📟 EquationVault — LOCKED UI CONTRACT (REV 3.2)
 *
 * PURPOSE
 * - Display the exact player-performed equation
 * - Preserve full lineage (no reduction)
 * - Guarantee result visibility
 *
 * UI INVARIANTS
 * - Left-anchored content
 * - Result never clipped (auto-scrolls to end)
 * - Lineage dimmed, result emphasized
 * - Horizontal overflow hinted via left-fade
 * ============================================================================
 */

const EquationVault = forwardRef<HTMLDivElement, EquationVaultProps>(({
  equation,
  isFlashing = false
}, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Split only for presentation — logic remains untouched
  const parts = equation.split('=');
  const lhs = parts[0]?.trim() ?? '';
  const rhs = parts[1]?.trim() ?? '';

  // 🔒 RESULT VISIBILITY INVARIANT: Auto-scroll to end on update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [equation]);

  return (
    <div
      ref={ref}
      className={`
        relative
        flex items-center
        rounded-3xl
        bg-black/85
        border border-white/10
        shadow-xl
        transition-all duration-300
        ${isFlashing ? 'animate-pulse bg-white/20' : ''}
      `}
      style={{
        padding: '5px 14px',
        minWidth: 160,
        width: '100%',
        justifyContent: 'flex-start',
      }}
      data-ui="equation-vault"
    >
      {/* LEFT FADE — scroll affordance hinting overflow */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-full w-8 rounded-l-full z-10"
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,0.95), rgba(0,0,0,0))',
        }}
      />

      {/* SCROLL CONTAINER */}
      <div
        ref={scrollRef}
        className="flex items-center font-mono tracking-tight overflow-x-auto overflow-y-hidden no-scrollbar"
        style={{
          whiteSpace: 'nowrap',
          textAlign: 'left',
          width: '100%',
        }}
      >
        {/* Lineage (dimmed instructional context) — Phase 3B: 16px → 28px (1.75×) */}
        {lhs && (
          <span className="text-white/65 text-[28px]">
            {lhs}
          </span>
        )}

        {/* Equals sign — Phase 3B: 16px → 28px (1.75×) */}
        {rhs && (
          <span className="text-white/80 text-[28px] mx-[6px]">
            =
          </span>
        )}

        {/* Result (high priority) — Phase 3B: 19px → 33px (1.74×) */}
        {rhs && (
          <span className="text-amber-400 font-extrabold text-[33px]">
            {rhs}
          </span>
        )}
      </div>
    </div>
  );
});

export default EquationVault;
