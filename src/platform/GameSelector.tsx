
import React, { useState } from "react";

import CombineGridGame from "../../games/combine-grid-vnext/combinegrid-v9/App";
import SpeedGridGame from "../../games/speed-grid/ui/SpeedGridGame";

type GameType =
  | "combine-grid"
  | "speed-grid";

export default function GameSelector() {

  // CombineGrid is default
  const [game, setGame] = useState<GameType>("combine-grid");

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>

      {/* Debug selector panel */}
      <div style={{
        position: "absolute",
        top: game === "speed-grid" ? 68 : 10,
        left: 10,
        zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        padding: 10,
        borderRadius: 10,
        display: "flex",
        gap: 8
      }}>

        <button
          onClick={() => setGame("combine-grid")}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: game === "combine-grid" ? "#22c55e" : "#333",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          CombineGrid
        </button>

        <button
          onClick={() => setGame("speed-grid")}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: game === "speed-grid" ? "#3b82f6" : "#333",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          SpeedGrid
        </button>

      </div>

      {/* Game mount */}
      {game === "combine-grid" && <CombineGridGame />}

      {game === "speed-grid" && <SpeedGridGame />}

    </div>
  );
}
