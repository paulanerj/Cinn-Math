import React from 'react';

export const NightScene = ({ isActive }) => (
  <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}>
    <div className="absolute inset-0 bg-gradient-to-b from-[var(--sa-scene-night-top)] to-[var(--sa-scene-night-bot)]"></div>
    <div className="absolute top-[15%] left-[20%] w-1 h-1 bg-[var(--sa-scene-night-star1)] rounded-full opacity-60"></div>
    <div className="absolute top-[35%] left-[70%] w-2 h-2 bg-[var(--sa-scene-night-star1)] rounded-full opacity-40 blur-[1px]"></div>
    <div className="absolute top-[65%] left-[10%] w-1.5 h-1.5 bg-[var(--sa-scene-night-star2)] rounded-full opacity-80"></div>
    <div className="absolute top-[80%] left-[80%] w-1 h-1 bg-[var(--sa-scene-night-star1)] rounded-full opacity-50"></div>
  </div>
);
