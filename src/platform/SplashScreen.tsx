

import React from "react";
import type { GameId } from "./PlatformShell";

interface Props {
  onSelectGame: (game: GameId) => void;
}

export default function SplashScreen({ onSelectGame }: Props) {

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-900 text-white">

      <div className="text-center space-y-8">

        <h1 className="text-5xl font-black tracking-tight">
          GridMath Platform
        </h1>

        <p className="text-slate-400">
          Select Game
        </p>

        <div className="flex flex-col gap-4 w-64 mx-auto">

          <button
            onClick={() => onSelectGame("combine-grid")}
            className="px-8 py-4 rounded-xl bg-green-600 hover:bg-green-500 font-bold text-lg shadow-lg transition-all active:scale-95"
          >
            CombineGrid
          </button>

          <button
            onClick={() => onSelectGame("speed-grid")}
            className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-lg shadow-lg transition-all active:scale-95"
          >
            SpeedGrid
          </button>

        </div>

      </div>

    </div>
  );
}
