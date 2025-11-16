/**
 * @file types.ts
 * @description Central type definitions for the entire application.
 * @ai-note This file is the single source of truth for data structures. Understanding these types is crucial for any modifications.
 */

export type GameMode = 'sum' | 'multiply';
export type Difficulty = 'banana' | 'apple' | 'coconut';
export type Theme = 'classic' | 'sakura' | 'ocean' | 'kuromi' | 'helloKitty';
export type SelectionMode = 'drag' | 'tap';

/**
 * @type GameStatus
 * @description Represents the specific operational status of the game logic. It's more granular than GameScreen.
 * @ai-note This is the core state machine enum. Changes here must be reflected in the gameReducer.
 */
export type GameStatus = 
  | 'ready'       // The game is ready to start from the main menu.
  | 'playing'     // The game is active, timer is running.
  | 'paused'      // The game is paused by the user.
  | 'clearing'    // A match has been made, and tiles are being cleared.
  | 'falling'     // Gravity is being applied, and new tiles are falling into place.
  | 'gameOver';   // The game has ended.

/**
 * @type GameScreen
 * @description Represents the current top-level screen being displayed to the user.
 * @ai-note This controls the primary UI view. It's separate from GameStatus, which controls the internal logic loop.
 */
export type GameScreen = 'start' | 'game' | 'themes';

export type TileType = {
    id: string;
    value: number | 'CINNAMOROLL';
    type: 'number' | 'time';
};

export type ParticleType = { 
    id: string; 
    x: number; 
    y: number; 
    size: number; 
    dx: number; 
    dy: number; 
    endScale: number; 
};

export type NumberParticleType = { 
    id: string; 
    number: number; 
    startX: number; 
    startY: number; 
    endX: number; 
    endY: number; 
    delay: number; 
};

export type SoundHook = 
    | 'select' 
    | 'match_L1' 
    | 'match_L2' 
    | 'match_L3' 
    | 'match_L4' 
    | 'combo' 
    | 'bonus' 
    | 'gameover' 
    | 'error';

export type ThemeAssets = {
    displayName: string;
    icon: string;
    iconColor: string;
    colors: Record<string, string>;
    sounds: Partial<Record<SoundHook, string>>;
    textures: Record<string, string>;
    images: Record<string, string>;
    ui: {
        button: string;
        modalContent: string;
    };
};

export type Coords = {
    row: number;
    col: number;
};

export type StartGameConfig = {
    mode: GameMode;
    difficulty: Difficulty;
    selectionMode: SelectionMode;
};
