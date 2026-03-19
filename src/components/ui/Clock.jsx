import React, { useRef, useEffect } from 'react';

// PURPOSE: SVG ring countdown timer rendered inside the central circle.
// INVARIANT: Driven purely by props — no internal timer logic.
export const Clock = ({ duration, mode, isPaused }) => {
  const circleRef = useRef(null);
  const progressRef = useRef(0);

  useEffect(() => {
    if (duration <= 0 || isPaused) return;
    let start = null, reqId;
    const animate = (timestamp) => {
      if (!start) start = timestamp - (progressRef.current * duration * 1000);
      const p = Math.min((timestamp - start) / (duration * 1000), 1);
      progressRef.current = p;
      if (circleRef.current) circleRef.current.style.strokeDashoffset = 282.743 - (p * 282.743);
      if (p < 1) reqId = requestAnimationFrame(animate);
    };
    reqId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqId);
  }, [duration, isPaused]);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none w-full h-full text-[var(--sa-primary)]">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 block">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="6" />
        <circle ref={circleRef} cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="282.743" strokeDashoffset="282.743" strokeLinecap="round" />
      </svg>
    </div>
  );
};
