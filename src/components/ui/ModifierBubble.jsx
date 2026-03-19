import React from 'react';

// PURPOSE: Floating operation bubbles positioned around the central circle.
// Positions: 'left', 'right', 'bottom'
export const ModifierBubble = ({ op, val, text, pos, isDark }) => {
  const anchors = {
    left:   'top-1/2 -translate-y-1/2 left-[5%] md:left-[10%]',
    right:  'top-1/2 -translate-y-1/2 right-[5%] md:right-[10%]',
    bottom: 'bottom-[8%] left-1/2 -translate-x-1/2'
  };
  return (
    <div className={`absolute ${anchors[pos]} z-30 flex items-center justify-center pointer-events-none`}>
      <div className={`min-w-[85px] px-5 py-3 bg-[var(--sa-card)] border-[3px] border-[var(--sa-primary)] shadow-lg rounded-[2rem] text-3xl font-black text-center ${isDark ? '!bg-slate-700 !border-slate-500 !text-white' : 'text-[var(--sa-text)]'}`}>
        {op} {text ? <span className="font-serif italic">{text}</span> : val}
      </div>
    </div>
  );
};
