

import React, { useState, useEffect } from "react";
import SplashScreen from "./SplashScreen";
import GameHost from "./GameHost";
import { installInteractionLock } from "./interaction/InteractionLock";

export type GameId = "combine-grid" | "speed-grid";

export default function PlatformShell() {

  // null = splash screen visible
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  useEffect(() => {
    installInteractionLock(document.body);
  }, []);

  function handleSelectGame(game: GameId) {
    setActiveGame(game);
  }

  function handleReturnToMenu() {
    setActiveGame(null);
  }

  if (!activeGame) {
    return (
      <SplashScreen
        onSelectGame={handleSelectGame}
      />
    );
  }

  return (
    <GameHost
      game={activeGame}
      onReturnToMenu={handleReturnToMenu}
    />
  );
}
