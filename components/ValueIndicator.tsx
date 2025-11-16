import React from 'react';

type ValueIndicatorProps = {
    visible: boolean;
    value: number;
    x: number;
    y: number;
};

export const ValueIndicator = ({ visible, value, x, y }: ValueIndicatorProps) => {
    if (!visible || value === 0) return null;

    return (
        <div 
            className="value-indicator"
            style={{ 
                left: `${x}px`, 
                top: `${y}px`,
                animationName: visible ? 'value-pop-in' : 'none'
            }}
        >
            {value}
        </div>
    );
};
