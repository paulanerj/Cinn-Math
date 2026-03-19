import React, { useRef, useEffect, useState } from 'react';

// PURPOSE: Animated stopwatch used exclusively during Dark Mode steps.
// Displays a sweeping hand + countdown number overlay.
export const StopwatchSVG = ({ duration = 5, isRunning = false }) => {
  const ringRef = useRef(null);
  const handRef = useRef(null);
  const progressRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const CIRCUMFERENCE = 339.292;

  useEffect(() => {
    setTimeLeft(duration);
    progressRef.current = 0;
    if (ringRef.current) ringRef.current.style.strokeDashoffset = '0';
    if (handRef.current) { handRef.current.setAttribute('x2', 60); handRef.current.setAttribute('y2', 15); }
  }, [duration]);

  useEffect(() => {
    if (!isRunning || duration <= 0) return;
    let start = null; let reqId;
    const animate = (timestamp) => {
      if (!start) start = timestamp - (progressRef.current * duration * 1000);
      const elapsed = timestamp - start;
      const p = Math.min(elapsed / (duration * 1000), 1);
      progressRef.current = p;
      setTimeLeft(Math.ceil(duration - (duration * p)));
      if (ringRef.current) ringRef.current.style.strokeDashoffset = p * CIRCUMFERENCE;
      if (handRef.current) {
        const angle = p * Math.PI * 2;
        handRef.current.setAttribute('x2', 60 + Math.sin(angle) * 45);
        handRef.current.setAttribute('y2', 60 - Math.cos(angle) * 45);
      }
      if (p < 1) reqId = requestAnimationFrame(animate);
    };
    reqId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqId);
  }, [isRunning, duration]);

  return (
    <div className="absolute inset-0 w-full h-full drop-shadow-xl pointer-events-none flex items-center justify-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full">
        <circle cx="60" cy="60" r="54" fill="var(--sa-overlay)" stroke="var(--sa-border)" strokeWidth="6" />
        <circle ref={ringRef} cx="60" cy="60" r="54" fill="none" stroke="var(--sa-primary)" strokeWidth="6" strokeDasharray={CIRCUMFERENCE} strokeDashoffset="0" transform="rotate(-90 60 60)" strokeLinecap="round" />
        {[...Array(12)].map((_, i) => (
          <line key={i}
            x1={60 + Math.sin(i * Math.PI / 6) * 44} y1={60 - Math.cos(i * Math.PI / 6) * 44}
            x2={60 + Math.sin(i * Math.PI / 6) * 50} y2={60 - Math.cos(i * Math.PI / 6) * 50}
            stroke="var(--sa-border)" strokeWidth={i % 3 === 0 ? 3 : 1}
          />
        ))}
        <line ref={handRef} x1="60" y1="60" x2="60" y2="15" stroke="var(--sa-focus)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="60" cy="60" r="4" fill="var(--sa-focus)" />
      </svg>
      <div className="relative z-10 text-3xl font-black text-[var(--sa-text)] mt-12 drop-shadow-sm">{timeLeft}</div>
    </div>
  );
};
