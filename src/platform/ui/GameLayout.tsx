

import React from "react";
import SharedHUD from "./SharedHUD";
import SharedControls from "./SharedControls";

interface Props {

  children?: React.ReactNode;

  // HUD props
  title?: string;
  target?: number;
  score?: number;

  // Controls
  onNext?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;

}

export default function GameLayout({
  children,
  title,
  target,
  score,
  onNext,
  onUndo,
  onRedo
}: Props) {

  return (

    <div className="w-screen h-screen flex flex-col bg-[#1a1a1c] text-white">

      {/* HUD */}
      <SharedHUD
        title={title}
        target={target}
        score={score}
      />

      {/* Game Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">

        {children}

      </div>

      {/* Controls */}
      <SharedControls
        onNext={onNext}
        onUndo={onUndo}
        onRedo={onRedo}
      />

    </div>

  );

}
