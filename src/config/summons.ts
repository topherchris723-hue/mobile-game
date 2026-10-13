import { ROSTER, type Rarity } from './sovereigns';

/*
 * Summon economy (game-design.md §6). All Gems are earned in-game for now; when real money arrives
 * these rules move to the server unchanged (the roll logic in game/economy is pure).
 */

export type SummonKind = 'single' | 'multi';

export const SUMMON_COST: Readonly<Record<SummonKind, number>> = { single: 50, multi: 500 };
/** A multi summon is 10 + 1 bonus. */
export const SUMMON_COUNT: Readonly<Record<SummonKind, number>> = { single: 1, multi: 11 };

/** Base rarity rates; they must add up to 1 (unit-tested). Shown in-game on every banner. */
export const RARITY_RATES: Readonly<Record<Rarity, number>> = { 5: 0.04, 4: 0.21, 3: 0.75 };

/** The Nth summon without a 5★ is a guaranteed 5★ (counter shown on the banner). */
export const PITY_LIMIT = 80;
/** Every multi summon contains at least one Sovereign of this rarity or higher. */
export const MULTI_GUARANTEE_RARITY: Rarity = 4;

/** Shards granted for a duplicate, by rarity; spent on Limit Breaks. */
export const DUPLICATE_SHARDS: Readonly<Record<Rarity, number>> = { 3: 5, 4: 10, 5: 20 };

export interface BannerSpec {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Sovereign ids that can be summoned; each rarity's rate is split evenly within it. */
  readonly pool: readonly string[];
}

export const STANDARD_BANNER: BannerSpec = {
  id: 'standard',
  name: 'Standard Summon',
  description: 'Every launch Sovereign, always available.',
  pool: ROSTER.map((spec) => spec.id),
};

export const BANNERS: readonly BannerSpec[] = [STANDARD_BANNER];

/** Welcome gift for a new save: enough for the first multi summon. */
export const STARTING_GEMS = 500;
/** Upper bound accepted when loading a save (anything above is treated as corrupted). */
export const MAX_GEMS = 9_999_999;

/** `?debug=1` only: a button on the Summon screen grants this many Gems for on-device testing. */
export const DEBUG_GEM_GRANT = 1000;

/** Summon reveal timing (ms). Reduce motion removes the stagger and the crack animation. */
export const REVEAL_TIMING = {
  /** Crystal shatter before results appear. */
  crackMs: 320,
  /** Delay between result cards appearing. */
  staggerMs: 70,
} as const;
