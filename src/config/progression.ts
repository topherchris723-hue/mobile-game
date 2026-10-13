import type { Rarity } from './sovereigns';

/*
 * Sovereign progression (game-design.md §5): levels bought with Coins, level caps raised by Limit
 * Breaks paid with shards from duplicate summons. Every number here is a balance knob.
 */

/** Level cap before any Limit Break. */
export const BASE_LEVEL_CAP: Readonly<Record<Rarity, number>> = { 3: 30, 4: 40, 5: 50 };

export const LIMIT_BREAK = {
  max: 4,
  /** Each Limit Break raises the cap by this many levels. */
  levelsPerBreak: 10,
  /** Shards per Limit Break (about two duplicates of that rarity, see DUPLICATE_SHARDS). */
  shardCost: { 3: 10, 4: 20, 5: 40 } as Readonly<Record<Rarity, number>>,
} as const;

/**
 * HP/ATK/DEF grow by this fraction of the level-1 value per level (level 30 ≈ ×1.29, level 90
 * ≈ ×1.89). SPD never grows: it decides turn order, which levels shouldn't take over.
 */
export const STAT_GROWTH_PER_LEVEL = 0.01;

/** Coins to go from `level` to `level + 1`: base + perLevel × (level − 1). */
export const LEVEL_UP_COINS = { base: 20, perLevel: 10 } as const;

/** Welcome Coins for a new save (and for existing saves through the v3 → v4 migration). */
export const STARTING_COINS = 2000;
/** Coins for every victory (replays included); Coins are the plentiful currency. */
export const COINS_PER_WIN = 500;
export const MAX_COINS = 99_999_999;

/** `?debug=1` only: Coins granted by the debug button on the Sovereigns screen. */
export const DEBUG_COIN_GRANT = 10_000;
