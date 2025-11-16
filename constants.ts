import { Difficulty, GameMode } from './types';

export const GRID_SIZE = 5;
export const TIME_BONUS = 10;
export const COMBO_DURATION_MS = 3000;
export const DROP_ANIMATION_DURATION = 600;
export const CLEAR_ANIMATION_DURATION = 400;
export const FALL_OFF_ANIMATION_DURATION = 500;

export const DIFFICULTY_SETTINGS: Record<Difficulty, { initialTime: number; tileRange: { min: number; max: number }; timeTileProbability: Record<GameMode, number>; targetRange: Record<GameMode, { min: number; max: number }>}> = {
  banana: { initialTime: 75, tileRange: { min: 1, max: 5 }, timeTileProbability: { sum: 0.30, multiply: 0.40 }, targetRange: { sum: { min: 4, max: 15 }, multiply: { min: 4, max: 25 }}},
  apple: { initialTime: 60, tileRange: { min: 1, max: 9 }, timeTileProbability: { sum: 0.25, multiply: 0.35 }, targetRange: { sum: { min: 5, max: 25 }, multiply: { min: 4, max: 81 }}},
  coconut: { initialTime: 45, tileRange: { min: 2, max: 12 }, timeTileProbability: { sum: 0.15, multiply: 0.25 }, targetRange: { sum: { min: 10, max: 40 }, multiply: { min: 20, max: 150 }}},
};

// This makes the zzfx function available globally in the TypeScript environment.
// Note: zzfx is no longer used for game sounds but we'll keep the declaration
// in case it's used for UI feedback or other non-themed sounds in the future.
declare global {
    const zzfx: (...params: any[]) => void;
}
