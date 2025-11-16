import React from 'react';

type CinnamorollArtProps = {
    className?: string;
}

export const CinnamorollArt = ({ className }: CinnamorollArtProps) => (
    <div className={`${className} flex items-center justify-center bg-white/50 rounded-full border-4 border-white`}>
        <span className="text-sm text-[var(--text-dark)] opacity-50 font-display">Cinnamoroll</span>
    </div>
);
