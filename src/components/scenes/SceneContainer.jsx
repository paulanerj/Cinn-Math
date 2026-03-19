import React from 'react';
import { SkyScene } from './SkyScene.jsx';
import { SunsetScene } from './SunsetScene.jsx';
import { NightScene } from './NightScene.jsx';
import { SpaceScene } from './SpaceScene.jsx';

export const SceneContainer = ({ activeScene, themeClass, shake, children }) => (
  <div className={`sa-app ${themeClass} flex flex-col items-center relative ${shake ? 'animate-shake' : ''}`}>
    <div className="absolute inset-0 z-0 pointer-events-none">
      <SkyScene    isActive={activeScene === 'sky'} />
      <SunsetScene isActive={activeScene === 'sunset'} />
      <NightScene  isActive={activeScene === 'night'} />
      <SpaceScene  isActive={activeScene === 'space'} />
    </div>
    <div className="relative z-10 w-full h-full flex flex-col items-center">
      {children}
    </div>
  </div>
);
