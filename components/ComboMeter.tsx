import React from 'react';
import { COMBO_DURATION_MS } from '../constants';

type ComboMeterProps = {
    count: number;
    timerKey: string; // Used to reset the animation
};

export const ComboMeter = ({ count, timerKey }: ComboMeterProps) => {
    const isVisible = count > 1;

    // The animation is handled purely in CSS, we just need to reset it
    const animationStyle = {
        animationName: 'combo-timer-drain',
        animationDuration: `${COMBO_DURATION_MS}ms`,
        animationTimingFunction: 'linear',
        animationFillMode: 'forwards',
    } as React.CSSProperties;

    return (
        <div className={`combo-meter ${isVisible ? 'visible' : ''}`}>
            <div className="text-2xl font-display text-white mb-1" style={{ textShadow: '2px 2px 0 var(--combo-bar)' }}>
                {count}x COMBO!
            </div>
            <div className="combo-bar-bg">
                <div 
                    key={timerKey}
                    className="combo-bar-fg" 
                    style={isVisible ? animationStyle : { width: '100%' }}
                ></div>
            </div>
        </div>
    );
};
