import React, { useMemo } from 'react';

export const DifficultyVisualizer = ({ curriculum }) => {
  const dataPoints = useMemo(() => {
    const points = [];
    curriculum.forEach(b => {
      const score = Math.min(1,
        (Math.min(1, b.rangeMax / 50) * 0.25) +
        ((b.modifiers / 3) * 0.25) +
        ((b.operations.length / 4) * 0.15) +
        ((b.distractors / 3) * 0.10) +
        (Math.max(0, (15 - b.timer) / 12) * 0.15) +
        (b.variables ? 0.10 : 0)
      );
      for (let i = b.start; i <= b.end; i++) points.push({ step: i, score });
    });
    return points;
  }, [curriculum]);

  if (dataPoints.length === 0) return null;
  const maxSteps = dataPoints[dataPoints.length - 1].step;

  return (
    <div className="w-full mt-4">
      <h3 className="text-xs font-bold text-[var(--sa-ui-text-muted)] uppercase mb-2">Difficulty Ramp</h3>
      <div className="w-full h-32 bg-[var(--sa-card)] rounded-xl border border-[var(--sa-ui-border)] relative overflow-hidden flex items-end">
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${maxSteps} 100`} preserveAspectRatio="none">
          <polygon
            fill="rgba(56, 189, 248, 0.2)"
            points={`0,100 ${dataPoints.map(dp => `${dp.step},${100 - (dp.score * 100)}`).join(' ')} ${maxSteps},100`}
          />
          <polyline
            fill="none" stroke="var(--sa-primary)" strokeWidth="3" strokeLinejoin="round"
            points={dataPoints.map(dp => `${dp.step},${100 - (dp.score * 100)}`).join(' ')}
          />
        </svg>
      </div>
    </div>
  );
};
