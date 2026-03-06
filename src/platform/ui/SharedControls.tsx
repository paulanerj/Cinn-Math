

import React from "react";

interface Props {

  onNext?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;

}

export default function SharedControls({
  onNext,
  onUndo,
  onRedo
}: Props) {

  const hasControls = onNext || onUndo || onRedo;

  if (!hasControls) return null;

  return (

    <div className="w-full h-[72px] flex items-center justify-center gap-6 bg-black/40 border-t border-white/10">

      {onUndo && (
        <button
          onClick={onUndo}
          className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
        >
          Undo
        </button>
      )}

      {onRedo && (
        <button
          onClick={onRedo}
          className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
        >
          Redo
        </button>
      )}

      {onNext && (
        <button
          onClick={onNext}
          className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 transition font-bold"
        >
          Next
        </button>
      )}

    </div>

  );

}
