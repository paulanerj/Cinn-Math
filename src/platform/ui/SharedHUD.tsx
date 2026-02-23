

import React from "react";

interface Props {

  title?: string;
  target?: number;
  score?: number;

}

export default function SharedHUD({
  title,
  target,
  score
}: Props) {

  return (

    <div className="w-full h-[64px] flex items-center justify-between px-6 bg-black/40 backdrop-blur-md border-b border-white/10">

      {/* Left: Title */}
      <div className="text-lg font-bold">

        {title ?? "GridMath"}

      </div>

      {/* Right: Info */}
      <div className="flex gap-6 text-sm font-semibold text-white/80">

        {target !== undefined && (
          <div>
            Target: <span className="text-white">{target}</span>
          </div>
        )}

        {score !== undefined && (
          <div>
            Score: <span className="text-white">{score}</span>
          </div>
        )}

      </div>

    </div>

  );

}
