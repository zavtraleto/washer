/**
 * Game configuration constants
 */
export const GAME_CONFIG = {
  WIDTH: 1920,
  HEIGHT: 1080,
} as const;

/**
 * Scene keys for type-safe scene management
 */
export const SCENE_KEYS = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  GAME: 'Game',
  UI: 'UI',
  DEVTOOLS: 'Devtools',
} as const;
