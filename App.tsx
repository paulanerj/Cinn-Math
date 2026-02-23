import React from "react";
import GameSelector from "./src/platform/GameSelector";

/**
 * Platform Root Entry
 *
 * GameSelector is the authoritative platform shell.
 * It controls which game loads and defaults to CombineGrid.
 */
const App: React.FC = () => {
  return <GameSelector />;
};

export default App;
