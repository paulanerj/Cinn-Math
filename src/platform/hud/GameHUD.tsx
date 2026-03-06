

import React from "react";

interface Props {

  target?: number;

  score?: number;

  time?: number;

  mode?: string;

  rightSlot?: React.ReactNode;

}

export default function GameHUD({

  target,
  score,
  time,
  mode,
  rightSlot

}: Props) {

  return (

    <div className="w-full flex items-center justify-between px-4 py-2 select-none h-[60px] bg-[#1a1a1c] border-b border-white/5 shrink-0 relative z-50">

      {/* Left Section */}
      <div className="flex gap-4 text-sm font-bold text-white/80 items-center">

        {mode && (
          <div className="opacity-70 tracking-wider text-xs uppercase hidden sm:block">
            {mode}
          </div>
        )}

        {target !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-white/60 text-xs uppercase">Target</span>
            <span className="text-white text-lg font-black">{target}</span>
          </div>
        )}

        {score !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-white/60 text-xs uppercase">Score</span>
            <span className="text-white text-lg font-black">{score}</span>
          </div>
        )}

      </div>

      {/* Center Section */}
      {time !== undefined && (

        <div className={`absolute left-1/2 -translate-x-1/2 text-2xl font-black font-mono tracking-wide ${time < 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>

          {time}s

        </div>

      )}

      {/* Right Section */}
      <div>

        {rightSlot}

      </div>

    </div>

  );

}
