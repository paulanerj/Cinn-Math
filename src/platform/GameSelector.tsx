
import React, { useState } from "react";

import CombineGridGame from "../../games/combine-grid-vnext/combinegrid-v9/App";
import SpeedGridGame from "../../games/speed-grid/ui/SpeedGridGame";

type GameType = "splash" | "combine-grid" | "speed-grid";

export default function GameSelector() {

  const [game, setGame] = useState<GameType>("splash");

  if (game === "splash") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#141416",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: 4,
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          Cinn Math
        </div>

        <button
          onClick={() => setGame("combine-grid")}
          style={{
            width: 240,
            padding: "20px 0",
            borderRadius: 20,
            border: "none",
            background: "#e67e22",
            color: "#fff",
            fontSize: 17,
            fontWeight: 800,
            cursor: "pointer",
            letterSpacing: 1,
            boxShadow: "0 6px 0 rgba(154,52,18,1)",
          }}
        >
          CombineGrid
        </button>

        <button
          onClick={() => setGame("speed-grid")}
          style={{
            width: 240,
            padding: "20px 0",
            borderRadius: 20,
            border: "none",
            background: "#3b82f6",
            color: "#fff",
            fontSize: 17,
            fontWeight: 800,
            cursor: "pointer",
            letterSpacing: 1,
            boxShadow: "0 6px 0 rgba(29,78,216,1)",
          }}
        >
          SpeedGrid
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {game === "combine-grid" && (
        <CombineGridGame onBack={() => setGame("splash")} />
      )}
      {game === "speed-grid" && (
        <SpeedGridGame onBack={() => setGame("splash")} />
      )}
    </div>
  );
}
