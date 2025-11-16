/**
 * @file useGameSounds.ts
 * @description A custom hook for managing all game audio playback.
 * @purpose This hook centralizes audio logic, using the Web Audio API for robust, reliable sound playback that respects browser security policies (autoplay restrictions).
 * @ai-note This implementation solves the common issue of browsers blocking audio that isn't initiated by a direct user gesture. It creates a single global `AudioContext` that is "unlocked" on the first user click/tap. All subsequent sounds are then channeled through this context, ensuring they play correctly. Do not replace this with simple `new Audio().play()` calls, as that will reintroduce the muted audio bug.
 */
import { useCallback, useEffect, useRef } from 'react';
import { SoundHook } from '../types';

// Cache for audio elements and their source nodes to prevent re-creating them.
const audioCache: Partial<Record<string, { element: HTMLAudioElement; source: MediaElementAudioSourceNode | null }>> = {};

// Singleton AudioContext for robust playback across browsers. It's created once and reused.
let audioContext: AudioContext | null = null;
let isAudioContextUnlocked = false;

/**
 * @function getAudioContext
 * @description Lazily initializes and returns the singleton AudioContext.
 * @returns {AudioContext | null} The shared AudioContext instance.
 */
const getAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioContext) {
        // `webkitAudioContext` is for Safari compatibility.
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
             audioContext = new Ctx();
        }
    }
    return audioContext;
};

/**
 * @function unlockAudioContext
 * @description Resumes the AudioContext if it's in a suspended state. This must be called by a user gesture.
 * @ai-note Browsers often initialize the AudioContext in a 'suspended' state. This function, attached to a global click/tap listener, "unlocks" it.
 */
const unlockAudioContext = () => {
    const context = getAudioContext();
    if (context && context.state === 'suspended') {
        context.resume().then(() => {
            isAudioContextUnlocked = true;
        }).catch(e => console.error('Failed to resume AudioContext:', e));
    } else if (context) {
        isAudioContextUnlocked = true; 
    }
};

// Attach listeners to unlock audio on the first user interaction.
if (typeof window !== 'undefined') {
    // These listeners are added once and will be automatically removed by the browser after they fire.
    window.addEventListener('click', unlockAudioContext, { once: true });
    window.addEventListener('touchend', unlockAudioContext, { once: true });
}


/**
 * @hook useGameSounds
 * @param soundMap A record mapping sound events (SoundHook) to their audio file paths.
 * @param volume The global volume level (0 to 1).
 * @returns A function to play a sound by its type (SoundHook).
 */
export const useGameSounds = (
    soundMap: Partial<Record<SoundHook, string>>, 
    volume: number
) => {
    const gainNodeRef = useRef<GainNode | null>(null);

    // Initialize AudioContext and GainNode (for volume control) once on mount.
    useEffect(() => {
        const context = getAudioContext();
        if (context && !gainNodeRef.current) {
            gainNodeRef.current = context.createGain();
            gainNodeRef.current.connect(context.destination);
        }
    }, []);

    // Update volume whenever the volume prop changes.
    useEffect(() => {
        if (gainNodeRef.current) {
            const context = getAudioContext();
            if (context) {
                // `setTargetAtTime` provides a smooth, ramped volume change instead of an abrupt one.
                gainNodeRef.current.gain.setTargetAtTime(volume, context.currentTime, 0.01);
            }
        }
    }, [volume]);
    
    // The returned function that components will call to play sounds.
    return useCallback((type: SoundHook) => {
        const path = soundMap[type];
        const context = getAudioContext();
        if (!path || volume === 0 || !context || !gainNodeRef.current) return;

        // The browser might suspend the context if the tab is inactive. Always attempt to resume it.
        if (context.state === 'suspended') {
             unlockAudioContext();
        }
        
        try {
            let audio = audioCache[path]?.element;
            
            if (!audio) {
                audio = new Audio(path);
                audioCache[path] = { element: audio, source: null };
            }
            
            // Connect the audio element to the Web Audio graph if it hasn't been already.
            // This is done only once per sound file to build the audio processing graph.
            if (audioCache[path]?.source === null) {
                const source = context.createMediaElementSource(audio);
                source.connect(gainNodeRef.current!);
                audioCache[path]!.source = source;
            }
            
            // If the same sound is triggered rapidly (e.g., selecting tiles quickly), restart it immediately.
            if (!audio.paused) {
                audio.currentTime = 0;
            }

            const playPromise = audio.play();

            if (playPromise !== undefined) {
                 playPromise.catch(e => console.error(`Sound play failed for ${path}:`, e));
            }

        } catch (e) {
            console.error(`Could not create or play sound: ${path}`, e);
        }
    }, [soundMap, volume]);
};