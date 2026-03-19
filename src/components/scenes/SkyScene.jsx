import React from 'react';

export const SkyScene = ({ isActive }) => (
  <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}>
    <div className="absolute inset-0 bg-gradient-to-b from-[var(--sa-scene-sky-top)] to-[var(--sa-scene-sky-bot)]"></div>
    <svg viewBox="0 0 24 24" fill="var(--sa-scene-sky-cloud1)" className="animate-float-cloud absolute top-[10%] left-0 w-64 h-64 blur-sm opacity-50">
      <path d="M18.5 12c.2 0 .5 0 .7.1 1.2.3 2.1 1.3 2.3 2.6.2 1.3-.5 2.6-1.6 3.3-.5.3-1.1.5-1.7.5H6.5c-1.9 0-3.5-1.6-3.5-3.5 0-1.7 1.2-3.1 2.9-3.4.1-.6.4-1.2.8-1.7 1.1-1.2 2.8-1.5 4.3-.8.6-1.8 2.3-3.1 4.3-3.1 2.1 0 3.9 1.4 4.5 3.3.6-.2 1.3-.3 1.9-.3 2.8 0 5 2.2 5 5 0 .3 0 .7-.1 1H18.5V12z" />
    </svg>
    <svg viewBox="0 0 24 24" fill="var(--sa-scene-sky-cloud2)" style={{ animationDuration: '35s', animationDelay: '5s' }} className="animate-float-cloud absolute top-[40%] left-0 w-48 h-48 drop-shadow-sm opacity-80">
      <path d="M6.05 13.5C6.05 11.01 8.06 9 10.55 9c.4 0 .78.06 1.14.16C12.35 7.36 14.04 6 16.05 6c2.76 0 5 2.24 5 5 0 .34-.04.67-.1.99C22.18 12.56 23 13.95 23 15.5c0 2.49-2.01 4.5-4.5 4.5h-12c-2.49 0-4.5-2.01-4.5-4.5 0-2.22 1.61-4.06 3.73-4.43-.12-.35-.18-.72-.18-1.07z" />
    </svg>
  </div>
);
