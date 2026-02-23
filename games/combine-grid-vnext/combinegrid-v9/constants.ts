
export const GRID_CONFIG = {
  DEFAULT_ROWS: 7,
  DEFAULT_COLS: 5,

  TARGET_VALUE: 12,

  BOMB_RADIUS: 1,
  // Deprecated: Milestone-based bombs used instead
  BOMB_THRESHOLD: 999, 
  BOMB_CHANCE: 0, 
};

/**
 * Timing tuned to match Golden Batch specifications
 */
export const TIMING = {
  REFILL_DELAY_MS: 150,     // fast refills
  ZAP_DELAY_MS: 1500,       // zap reroll time
  POPUP_FADEIN_MS: 180,
  POPUP_HOLD_MS: 1000,
  POPUP_FADEOUT_MS: 300,
};

export const GOLDEN = {
  SHAKE_MS: 300,
  TILE_SCALE_MS: 100,
  FORMATION_FLASH_MS: 80,

  FLY_IN_MS: 500,
  PEAK_HOLD_MS: 1500,
  FLY_OUT_MS: 500,
  HUD_FLASH_MS: 350,

  DRY_DELAY_MS: 1200,
  COUNT_STEP_MS: 400,
  
  BOMB_IGNITE_MS: 1500,
};

export const EXPLOSION_CONFIG = {
  PARTICLE_DECAY: 0.03,
};

export const COLORS = {
  bg: '#1a1a1c',
  panel: '#18181b',
  border: '#27272a',
  accent: '#f97316', // Orange-600 focus
  text: '#f4f4f5',
  kinds: {
    number: '#3f3f46',
    bomb: '#ef4444',
    trophy: '#ffffff',
    op: '#a855f7',
    blank: 'transparent',
    stone: '#27272a',
  },
  values: [
    '#f87171', // 1
    '#60a5fa', // 2
    '#4ade80', // 3
    '#fbbf24', // 4
    '#f472b6', // 5
    '#818cf8', // 6
    '#34d399', // 7
    '#fb923c', // 8
    '#2dd4bf', // 9
    '#a78bfa', // 10
    '#e879f9', // 11
    '#facc15', // 12
  ],
};
