import { getSovereign, type Rarity } from '../../config/sovereigns';
import {
  DUPLICATE_SHARDS,
  MULTI_GUARANTEE_RARITY,
  PITY_LIMIT,
  RARITY_RATES,
  SUMMON_COST,
  SUMMON_COUNT,
  type BannerSpec,
  type SummonKind,
} from '../../config/summons';
import { createRng } from '../../core/rng';

/*
 * Summon rules (game-design.md §6): pure and deterministic. Given the same state, banner, and
 * kind, the result is always the same, so a summon can be replayed from its seed, and the logic
 * can move to a server unchanged when real money arrives.
 */

/** Everything a summon reads and changes, sliced out of the save by the caller. */
export interface SummonState {
  readonly gems: number;
  /** Per-save random seed; together with `pulls` it fixes every future roll. */
  readonly seed: number;
  /** Total Sovereigns ever summoned (advances the RNG stream). */
  readonly pulls: number;
  /** Summons on this banner since the last 5★. */
  readonly pity: number;
  readonly owned: readonly string[];
  readonly shards: Readonly<Record<string, number>>;
}

export interface SummonPull {
  readonly id: string;
  readonly rarity: Rarity;
  /** First copy: recruited. Otherwise converted to shards. */
  readonly isNew: boolean;
  readonly shards: number;
  /** Why this rarity was forced, if it was. */
  readonly guarantee: 'pity' | 'multi' | null;
}

export type SummonOutcome =
  | { readonly ok: true; readonly pulls: readonly SummonPull[]; readonly state: SummonState }
  | { readonly ok: false; readonly reason: string };

const RARITIES_HIGH_FIRST: readonly Rarity[] = [5, 4, 3];

/** The banner's pool grouped by rarity. */
export function poolByRarity(banner: BannerSpec): Readonly<Record<Rarity, readonly string[]>> {
  const groups: Record<Rarity, string[]> = { 3: [], 4: [], 5: [] };
  for (const id of banner.pool) groups[getSovereign(id).rarity].push(id);
  return groups;
}

/** Published rates: each rarity's chance and the chance of each Sovereign within it. */
export function bannerRates(
  banner: BannerSpec,
): readonly { rarity: Rarity; rate: number; perSovereign: number; ids: readonly string[] }[] {
  const groups = poolByRarity(banner);
  return RARITIES_HIGH_FIRST.map((rarity) => {
    const ids = groups[rarity];
    const rate = RARITY_RATES[rarity];
    return { rarity, rate, perSovereign: ids.length > 0 ? rate / ids.length : 0, ids };
  });
}

/** Summons left until the guaranteed 5★ (1 = the next summon is guaranteed). */
export function pullsUntilPity(pity: number): number {
  return Math.max(1, PITY_LIMIT - pity);
}

export function summonBlockedReason(gems: number, kind: SummonKind): string | null {
  const cost = SUMMON_COST[kind];
  return gems >= cost
    ? null
    : `Not enough Gems: ${kind === 'multi' ? 'Multi' : 'Single'} costs ${cost}`;
}

/** Mixes the save seed with the pull index so each summon draws from its own stream. */
function streamSeed(seed: number, pulls: number): number {
  return (seed ^ Math.imul(pulls + 1, 0x9e3779b1)) >>> 0;
}

function rollRarity(roll: number): Rarity {
  let threshold = 0;
  for (const rarity of RARITIES_HIGH_FIRST) {
    threshold += RARITY_RATES[rarity];
    if (roll < threshold) return rarity;
  }
  return 3;
}

export function performSummon(
  state: SummonState,
  banner: BannerSpec,
  kind: SummonKind,
): SummonOutcome {
  const reason = summonBlockedReason(state.gems, kind);
  if (reason) return { ok: false, reason };

  const groups = poolByRarity(banner);
  const rng = createRng(streamSeed(state.seed, state.pulls));
  const count = SUMMON_COUNT[kind];
  const owned = new Set(state.owned);
  const shards: Record<string, number> = { ...state.shards };
  const pulls: SummonPull[] = [];
  let pity = state.pity;
  let hasGuaranteedTier = false;

  for (let i = 0; i < count; i++) {
    let rarity = rollRarity(rng.next());
    let guarantee: SummonPull['guarantee'] = null;
    if (pity + 1 >= PITY_LIMIT && rarity < 5) {
      rarity = 5;
      guarantee = 'pity';
    } else if (
      kind === 'multi' &&
      i === count - 1 &&
      !hasGuaranteedTier &&
      rarity < MULTI_GUARANTEE_RARITY
    ) {
      rarity = MULTI_GUARANTEE_RARITY;
      guarantee = 'multi';
    }
    const candidates = groups[rarity];
    const id = candidates[rng.int(0, candidates.length - 1)];
    if (id === undefined) throw new Error(`Banner "${banner.id}" has no ${rarity}★ Sovereigns`);

    if (rarity >= MULTI_GUARANTEE_RARITY) hasGuaranteedTier = true;
    pity = rarity === 5 ? 0 : pity + 1;
    const isNew = !owned.has(id);
    const gained = isNew ? 0 : DUPLICATE_SHARDS[rarity];
    if (isNew) owned.add(id);
    else shards[id] = (shards[id] ?? 0) + gained;
    pulls.push({ id, rarity, isNew, shards: gained, guarantee });
  }

  return {
    ok: true,
    pulls,
    state: {
      gems: state.gems - SUMMON_COST[kind],
      seed: state.seed,
      pulls: state.pulls + count,
      pity,
      owned: [...owned],
      shards,
    },
  };
}
