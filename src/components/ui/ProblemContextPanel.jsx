import React from 'react';

// PURPOSE: Renders metadata arrays/equations above the active circle.
// CONTRACT:
//   - INPUTS: string context / string title.
//   - SIDE EFFECTS: None. Pure rendering.
//   - INVARIANTS: Must size strictly to content. Cannot drive gameplay logic.

export const ProblemContextPanel = ({ context }) => {
  if (!context) return null;
  return (
    <div className="inline-block px-4 py-2 bg-[var(--sa-card)] border-[3px] border-[var(--sa-border)] shadow-sm rounded-2xl text-xl md:text-2xl font-black text-center text-[var(--sa-text)] tracking-widest max-w-[90%] mx-auto z-30 pointer-events-none mb-4">
      {context}
    </div>
  );
};

export const PromptTitle = ({ title }) => {
  if (!title) return null;
  return (
    <div className="text-[10px] md:text-xs font-black text-[var(--sa-text-muted)] tracking-widest uppercase mb-1 text-center drop-shadow-sm z-30">
      {title}
    </div>
  );
};
