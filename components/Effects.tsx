import React from 'react';
import { ParticleType, NumberParticleType } from '../types';

const { memo } = React;

const CinnamorollParticleIcon = () => <div className="w-full h-full bg-white/80 rounded-full flex items-center justify-center text-blue-300 text-lg">✨</div>;

const Particle = memo(({ particle, onCompleted }: { particle: ParticleType; onCompleted: (id: string) => void; }) => (
    <div 
        className="particle" 
        style={{ 
            left: `${particle.x}px`, 
            top: `${particle.y}px`, 
            width: `${particle.size}px`, 
            height: `${particle.size}px`, 
            '--translateX': `${particle.dx}px`, 
            '--translateY': `${particle.dy}px`, 
            '--particle-end-scale': particle.endScale, 
        } as React.CSSProperties} 
        onAnimationEnd={() => onCompleted(particle.id)}
    >
        <CinnamorollParticleIcon />
    </div>
));

const NumberParticle = memo(({ p, onCompleted }: { p: NumberParticleType, onCompleted: (id: string) => void; }) => {
    const style = {
        left: p.startX, 
        top: p.startY,
        '--end-x': `${p.endX - p.startX}px`, 
        '--end-y': `${p.endY - p.startY}px`,
        animationDelay: `${p.delay}s`,
    } as React.CSSProperties;
    return (
        <div className="number-particle" style={style} onAnimationEnd={() => onCompleted(p.id)}>
            +{p.number}
        </div>
    );
});

const CloudAnnouncement = memo(({ announcement }: { announcement: { text: string; style: string; id: string } }) => (
    <div key={announcement.id} className="cloud-announcement">
        <div className="absolute w-full h-full bg-white/70 rounded-[50px] border-4 border-[var(--text-dark)] opacity-90"></div>
        <span className={`cloud-announcement-text ${announcement.style}`}>{announcement.text}</span>
    </div>
));

type EffectsContainerProps = {
    particles: ParticleType[];
    numberParticles: NumberParticleType[];
    announcements: { text: string; style: string; id: string }[];
    onParticleCompleted: (id: string) => void;
    onNumberParticleCompleted: (id: string) => void;
};

export const Effects = memo(({ particles, numberParticles, announcements, onParticleCompleted, onNumberParticleCompleted }: EffectsContainerProps) => {
    return (
        <>
            <div className="particle-container">
                {particles.map(p => <Particle key={p.id} particle={p} onCompleted={onParticleCompleted} />)}
            </div>
            <div className="number-particle-container">
                {numberParticles.map(p => <NumberParticle key={p.id} p={p} onCompleted={onNumberParticleCompleted} />)}
            </div>
            {announcements.map(a => <CloudAnnouncement key={a.id} announcement={a} />)}
        </>
    );
});
