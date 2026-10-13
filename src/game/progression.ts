import {
  BASE_LEVEL_CAP,
  LEVEL_UP_COINS,
  LIMIT_BREAK,
  STAT_GROWTH_PER_LEVEL,
} from '../config/progression';
import type { Rarity, SovereignSpec } from '../config/sovereigns';

/*
 * Levelling and Limit Breaks (game-design.md §5). Pure functions over plain numbers, so they are
 * unit-tested and can move to a server unchanged.
 */

export interface SovereignProgress {
  readonly level: number;
  readonly limitBreaks: number;
}

export const NEW_PROGRESS: SovereignProgress = { level: 1, limitBreaks: 0 };

export function levelCap(rarity: Rarity, limitBreaks: number): number {
  return BASE_LEVEL_CAP[rarity] + limitBreaks * LIMIT_BREAK.levelsPerBreak;
}

/** Coins to go from `level` to `level + 1`. */
export function levelUpCost(level: number): number {
  return LEVEL_UP_COINS.base + LEVEL_UP_COINS.perLevel * (level - 1);
}

/** Coins to go from `from` up to `to` (0 if `to` ≤ `from`). */
export function costToReach(from: number, to: number): number {
  let total = 0;
  for (let level = from; level < to; level++) total += levelUpCost(level);
  return total;
}

/** Highest level reachable from here with these Coins, within the cap. */
export function affordableLevel(
  progress: SovereignProgress,
  rarity: Rarity,
  coins: number,
): number {
  const cap = levelCap(rarity, progress.limitBreaks);
  let level = progress.level;
  let left = coins;
  while (level < cap && left >= levelUpCost(level)) {
    left -= levelUpCost(level);
    level++;
  }
  return level;
}

export type LevelUpOutcome =
  | { readonly ok: true; readonly progress: SovereignProgress; readonly cost: number }
  | { readonly ok: false; readonly reason: string };

/** Raises the level by up to `levels`, stopping at the cap. Refuses if even one level is unaffordable. */
export function levelUp(
  progress: SovereignProgress,
  rarity: Rarity,
  coins: number,
  levels: number,
): LevelUpOutcome {
  const cap = levelCap(rarity, progress.limitBreaks);
  if (progress.level >= cap) {
    return {
      ok: false,
      reason:
        progress.limitBreaks < LIMIT_BREAK.max
          ? 'Level cap reached: Limit Break to go higher'
          : 'Max level reached',
    };
  }
  const target = Math.min(cap, progress.level + Math.max(1, levels));
  const cost = costToReach(progress.level, target);
  if (cost > coins) {
    return { ok: false, reason: `Not enough Coins: ${cost.toLocaleString('en-US')} needed` };
  }
  return { ok: true, progress: { ...progress, level: target }, cost };
}

export function limitBreakBlockedReason(
  progress: SovereignProgress,
  rarity: Rarity,
  shards: number,
): string | null {
  if (progress.limitBreaks >= LIMIT_BREAK.max) return 'Fully Limit Broken';
  if (progress.level < levelCap(rarity, progress.limitBreaks)) {
    return 'Reach the level cap first';
  }
  const cost = LIMIT_BREAK.shardCost[rarity];
  if (shards < cost) return `Not enough shards: ${cost} needed`;
  return null;
}

/** Stat value at a level (HP/ATK/DEF). */
export function statAtLevel(base: number, level: number): number {
  return Math.round(base * (1 + STAT_GROWTH_PER_LEVEL * (level - 1)));
}

/** A battle-ready copy of a Sovereign at its current level (the roster data is never mutated). */
export function levelledSovereign(spec: SovereignSpec, progress: SovereignProgress): SovereignSpec {
  if (progress.level <= 1) return spec;
  return {
    ...spec,
    hp: statAtLevel(spec.hp, progress.level),
    atk: statAtLevel(spec.atk, progress.level),
    def: statAtLevel(spec.def, progress.level),
  };
}
