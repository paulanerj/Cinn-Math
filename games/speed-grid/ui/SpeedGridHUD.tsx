import React from 'react';

interface Props {
  target: number;
  time: number;
  score: number;
}

/**
 * SpeedGrid-specific HUD: three equal columns — TARGET | TIME | SCORE.
 * Intentionally separate from the shared GameHUD so CombineGrid is unaffected.
 */
export default function SpeedGridHUD({ target, time, score }: Props) {
  const urgent = time < 10;

  return (
    <div className="w-full grid grid-cols-3 items-center px-2 h-[60px] bg-[#1a1a1c] border-b border-white/5 shrink-0 select-none">

      {/* TARGET */}
      <div className="flex flex-col items-center justify-center">
        <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest">
          TARGET
        </span>
        <span className="text-white text-xl font-black leading-tight">
          {target}
        </span>
      </div>

      {/* TIME */}
      <div className="flex flex-col items-center justify-center">
        <span className={`text-[9px] font-bold uppercase tracking-widest ${urgent ? 'text-red-400' : 'text-white/40'}`}>
          TIME
        </span>
        <span className={`text-xl font-black font-mono leading-tight ${urgent ? 'text-red-400' : 'text-white'}`}>
          {time}s
        </span>
      </div>

      {/* SCORE */}
      <div className="flex flex-col items-center justify-center">
        <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest">
          SCORE
        </span>
        <span className="text-white text-xl font-black leading-tight">
          {score}
        </span>
      </div>

    </div>
  );
}
