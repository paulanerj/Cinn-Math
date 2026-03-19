import React from 'react';
import { useGameLogic } from '../hooks/useGameLogic.js';
import { GameUI } from './GameUI.jsx';

// ============================================================
// MODULE: GameContainer
// PURPOSE: Root logic node. Calls useGameLogic(), resolves the
//   theme class, then passes everything to the pure GameUI.
// ============================================================
export const GameContainer = () => {
  const logic = useGameLogic();

  let themeClass = 'sa-theme-light';
  if (logic.state.currentMode === 'dark') themeClass = 'sa-theme-dark';
  if (logic.state.currentMode === 'qmm')  themeClass = 'sa-theme-qmm';

  return <GameUI {...logic} themeClass={themeClass} />;
};
