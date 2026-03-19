import React from 'react';

export const SpaceScene = ({ isActive }) => (
  <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}>
    <div className="absolute inset-0 bg-gradient-to-b from-[var(--sa-scene-space-top)] to-[var(--sa-scene-space-bot)]"></div>
    <div className="absolute top-[20%] left-[50%] w-96 h-96 bg-[var(--sa-scene-space-nebula)] rounded-full opacity-20 blur-[100px] -translate-x-1/2"></div>
    <div className="absolute top-[10%] left-[15%] w-1 h-1 bg-[var(--sa-scene-space-star1)] rounded-full opacity-90 shadow-[0_0_8px_2px_var(--sa-scene-space-star1)]"></div>
    <div className="absolute top-[40%] left-[85%] w-1 h-1 bg-[var(--sa-scene-space-star2)] rounded-full opacity-80 shadow-[0_0_6px_1px_var(--sa-scene-space-star2)]"></div>
    <div className="absolute top-[75%] left-[25%] w-2 h-2 bg-[var(--sa-scene-space-star3)] rounded-full opacity-60 blur-[1px]"></div>
    <div className="absolute top-[50%] left-[10%] w-1 h-1 bg-[var(--sa-scene-space-star1)] rounded-full opacity-40"></div>
    <div className="absolute top-[85%] left-[60%] w-1.5 h-1.5 bg-[var(--sa-scene-space-star1)] rounded-full opacity-70"></div>
  </div>
);
