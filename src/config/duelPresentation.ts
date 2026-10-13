/** Portrait duel layout and animation timing (game-design.md §4.9–4.10). */

/** Space reserved at the top for the enemy HUD, in logical units (720 wide). */
export const ENEMY_HUD_HEIGHT = 150;
/** Space reserved at the bottom for the player's panel (cards, energy, bench). */
export const PLAYER_PANEL_HEIGHT = 520;
/** The ground starts this far down the screen (fraction of total height). */
export const FLOOR_TOP_FRACTION = 0.3;

export const STATIONS = {
  player: { x: 0.3, scale: 0.74 },
  enemy: { x: 0.7, scale: 0.64 },
} as const;

/** How long each event holds the stage before the next one plays (ms at 1× speed). */
export const EVENT_DURATION_MS = {
  turnStart: 450,
  cardPlayed: 380,
  damage: 520,
  heal: 600,
  status: 520,
  charge: 450,
  switch: 560,
  ko: 800,
  battleEnd: 300,
  crossover: 1400,
  drain: 650,
  energy: 400,
  passive: 420,
} as const;

/** Pause before the enemy acts, so the player can read the board. */
export const ENEMY_THINK_MS = 650;

export const BATTLE_SEED = 0x5eed_2026;

/** Ambient Rift motes; benchmark mode raises this to stress the renderer. */
export const EMBER_COUNT = { normal: 90, benchmark: 600 } as const;
