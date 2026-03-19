import React from 'react';

export const SunsetScene = ({ isActive }) => (
  <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}>
    <div className="absolute inset-0 bg-gradient-to-b from-[var(--sa-scene-sunset-top)] to-[var(--sa-scene-sunset-bot)]"></div>
    <svg viewBox="0 0 24 24" fill="var(--sa-scene-sunset-cloud)" style={{ animationDuration: '45s', animationDelay: '2s' }} className="animate-float-cloud absolute top-[20%] left-0 w-56 h-56 blur-[2px] opacity-40">
      <path d="M18.5 12c.2 0 .5 0 .7.1 1.2.3 2.1 1.3 2.3 2.6.2 1.3-.5 2.6-1.6 3.3-.5.3-1.1.5-1.7.5H6.5c-1.9 0-3.5-1.6-3.5-3.5 0-1.7 1.2-3.1 2.9-3.4.1-.6.4-1.2.8-1.7 1.1-1.2 2.8-1.5 4.3-.8.6-1.8 2.3-3.1 4.3-3.1 2.1 0 3.9 1.4 4.5 3.3.6-.2 1.3-.3 1.9-.3 2.8 0 5 2.2 5 5 0 .3 0 .7-.1 1H18.5V12z" />
    </svg>
  </div>
);
