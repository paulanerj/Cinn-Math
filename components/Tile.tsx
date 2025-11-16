import React, { memo } from 'react';
import { TileType as TileDataType } from '../types';

type TileProps = {
    tileData: TileDataType | null;
    row: number;
    col: number;
    isSelected: boolean;
    isClearing: boolean;
    isDropping: boolean;
    isFallingOff: boolean;
    isIncorrect: boolean;
    animationDelay: string;
    timeIconUrl?: string;
};

const CinnamorollIcon = () => (
    <div className="w-full h-full flex items-center justify-center text-3xl text-pink-400">
        <i className="fas fa-star"></i>
    </div>
);

const TileComponent = ({ tileData, row, col, isSelected, isClearing, isDropping, isFallingOff, isIncorrect, animationDelay, timeIconUrl }: TileProps) => {
    // Combine base, state, and animation classes
    const classNames = [
        'tile', 'relative', 'flex', 'items-center', 'justify-center',
        'w-[var(--tile-size)]', 'h-[var(--tile-size)]',
        'bg-[var(--tile-main)]', 'text-[var(--text-dark)]',
        'rounded-2xl', 'shadow-md', 'cursor-pointer', 'select-none',
        'transition-transform', 'duration-100', 'ease-in-out',
        isSelected ? 'transform scale-110 z-10' : 'hover:transform hover:scale-105',
        isSelected && 'selected', // Keep for CSS selector
        tileData?.type === 'time' && 'bg-[var(--tile-time)]',
        isClearing && 'match-cleared',
        isDropping && 'dropping',
        isFallingOff && 'falling-off',
        isIncorrect && 'incorrect-selection-shake',
    ].filter(Boolean).join(' ');

    const textClass = 'text-4xl sm:text-5xl transition-transform duration-200';

    return (
        <div
            className={classNames}
            style={{ animationDelay }}
            data-row={row}
            data-col={col}
            data-type={tileData?.type}
        >
            {tileData && (
                <>
                    {tileData.type === 'time' ? (
                        timeIconUrl ? 
                        <img src={timeIconUrl} alt="Time Bonus" className="w-3/4 h-3/4 object-contain" /> :
                        <CinnamorollIcon />
                    ) : (
                        <span className={textClass}>{tileData.value}</span>
                    )}
                </>
            )}
            {/* The visual selection effect, controlled by `.tile.selected` and CSS in index.html */}
            <div className="selection-overlay"></div>
        </div>
    );
};

export const Tile = memo(TileComponent);
