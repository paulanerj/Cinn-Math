

import React, { useEffect } from "react";
import type { GameId } from "./PlatformShell";

import CombineGridGame from "../../games/combine-grid-vnext/combinegrid-v9/App";
import SpeedGridGame from "../../games/speed-grid/ui/SpeedGridGame";
import { EngineSession } from "../../engine/public";
import { ErrorBoundary } from "./ui/ErrorBoundary";

interface Props {
  game: GameId;
  onReturnToMenu: () => void;
}

export default function GameHost({ game, onReturnToMenu }: Props) {

  // Lifecycle Authority: Clean up engine environment on mount/unmount/switch
  useEffect(() => {
    
    // Assertion: Multi-Game Isolation
    const session = EngineSession.getInstance();
    if (session.exists()) {
      console.warn("[GameHost] Engine session existed on mount. Cleaning up...", {
        seed: session.getSeed()
      });
      // Force cleanup to ensure clean slate
      session.destroy();
      session.getEventBus().clear();
    }

    return () => {
      // Cleanup on unmount (returning to splash or switching)
      console.log("[GameHost] Unmounting game. Destroying session.");
      const currentSession = EngineSession.getInstance();
      currentSession.destroy();
      currentSession.getEventBus().clear();
    };
  }, [game]);

  return (
    <div className="w-screen h-screen relative bg-[#1a1a1c]">

      {/* Platform Menu Button - Positioned safe from game UI */}
      <button
        onClick={onReturnToMenu}
        className="absolute top-3 right-3 z-[9999] bg-black/40 hover:bg-black/60 text-white/70 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/10 transition-all opacity-60 hover:opacity-100 scale-90 hover:scale-100"
      >
        Main Menu
      </button>

      {/* Active Game */}
      <div className="w-full h-full">
        <ErrorBoundary>
          {game === "combine-grid" && <CombineGridGame onBack={onReturnToMenu} />}
          {game === "speed-grid" && <SpeedGridGame />}
        </ErrorBoundary>
      </div>

    </div>
  );
}
