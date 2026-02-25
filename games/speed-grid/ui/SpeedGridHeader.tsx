import React, { useState, useRef, useEffect } from 'react';
import { Operator } from '../adapter/EngineAdapter';

interface Props {
  onBack?: () => void;
  operator: Operator;
  onOperatorChange: (op: Operator) => void;
}

const LABEL: Record<Operator, string> = {
  addition: 'Addition',
  multiplication: 'Multiply',
};

export default function SpeedGridHeader({ onBack, operator, onOperatorChange }: Props) {
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropOpen]);

  return (
    <div className="w-full flex items-center justify-between px-3 h-[48px] bg-[#1a1a1c] border-b border-white/5 shrink-0 relative z-[60]">

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm font-bold transition-colors active:scale-95 select-none"
      >
        ‹ Back
      </button>

      {/* Title */}
      <span className="text-white font-black text-xs tracking-[0.25em] uppercase select-none">
        SPEEDGRID
      </span>

      {/* Operator dropdown */}
      <div ref={dropRef} className="relative">
        <button
          onClick={() => setDropOpen(v => !v)}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-900/40 hover:bg-sky-800/50 border border-sky-700/30 text-sky-200 text-xs font-bold transition-colors active:scale-95 select-none"
        >
          {LABEL[operator]}
          <span className="opacity-50 text-[10px]">▾</span>
        </button>

        {dropOpen && (
          <div className="absolute right-0 top-[calc(100%+4px)] bg-[#1e2030] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[200] min-w-[110px]">
            {(['addition', 'multiplication'] as const).map(op => (
              <button
                key={op}
                onClick={() => { onOperatorChange(op); setDropOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors select-none ${
                  operator === op
                    ? 'bg-sky-700/40 text-sky-200'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {LABEL[op]}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
