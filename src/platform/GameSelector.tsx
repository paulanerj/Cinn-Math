// [ARCHITECTURE] Platform entry router. Renders the splash screen and routes
// to the selected game. Games are mounted/unmounted on demand — only one is
// ever active at a time. Back buttons on each game return here.
//
// [PHASE 6] CombineGridGame import will be wired here during CombineGrid reconstruction.
// [PHASE 7] SpeedGridGame import will be wired here during SpeedGrid reconstruction.
//
// [INVARIANT] This component must never own game logic. It owns only the
// selection state and the conditional render. Games own their own full
// lifecycle from mount to unmount.
//
// [LLM NOTE] The "splash" state is the default. Both games receive an onBack
// prop that returns the user to "splash". Do not add intermediate screens
// or shared game state here.

import React, { useState } from "react";

// [PHASE 6] Uncomment when CombineGrid reconstruction is complete:
// import CombineGridGame from "../games/combine-grid/CombineGridGame";

// [PHASE 7] Uncomment when SpeedGrid reconstruction is complete:
// import SpeedGridGame from "../games/speed-grid/SpeedGridGame";

type GameType = "splash" | "combine-grid" | "speed-grid";

// [ROLE] Phase placeholder rendered when a game is selected but not yet
// reconstructed. Removed when real game components are wired in.
const PhasePlaceholder: React.FC<{ name: string; phase: string; onBack: () => void }> = ({ name, phase, onBack }) => (
  <div style={{
    width: "100%", height: "100%", background: "#141416",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 16, fontFamily: "sans-serif",
  }}>
    <div style={{ color: "#fff", fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>{name}</div>
    <div style={{ color: "#888", fontSize: 13 }}>{phase}</div>
    <button
      onClick={onBack}
      style={{
        marginTop: 12, padding: "12px 28px", borderRadius: 14, border: "none",
        background: "#333", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}
    >
      ← Back
    </button>
  </div>
);

export default function GameSelector() {
  // [STATE] Drives the top-level game selection. "splash" is the default and
  // the return state when any game's back button is pressed.
  const [game, setGame] = useState<GameType>("splash");

  // ── Splash screen ────────────────────────────────────────────────────────
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

        {/* [PHASE 6] Button launches CombineGrid */}
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

        {/* [PHASE 7] Button launches SpeedGrid */}
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

  // ── Game renders ─────────────────────────────────────────────────────────
  // [PHASE 6] Replace PhasePlaceholder with:
  //   {game === "combine-grid" && <CombineGridGame onBack={() => setGame("splash")} />}
  // [PHASE 7] Replace PhasePlaceholder with:
  //   {game === "speed-grid" && <SpeedGridGame onBack={() => setGame("splash")} />}
  return (
    <div style={{ width: "100%", height: "100%" }}>
      {game === "combine-grid" && (
        <PhasePlaceholder
          name="CombineGrid"
          phase="Phase 6 — reconstruction pending"
          onBack={() => setGame("splash")}
        />
      )}
      {game === "speed-grid" && (
        <PhasePlaceholder
          name="SpeedGrid"
          phase="Phase 7 — reconstruction pending"
          onBack={() => setGame("splash")}
        />
      )}
    </div>
  );
}
