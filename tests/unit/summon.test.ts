import { describe, expect, it } from 'vitest';
import { getSovereign, ROSTER, STARTER_IDS } from '../../src/config/sovereigns';
import {
  DUPLICATE_SHARDS,
  MULTI_GUARANTEE_RARITY,
  PITY_LIMIT,
  RARITY_RATES,
  STANDARD_BANNER,
  SUMMON_COST,
  SUMMON_COUNT,
} from '../../src/config/summons';
import {
  bannerRates,
  performSummon,
  pullsUntilPity,
  type SummonPull,
  type SummonState,
} from '../../src/game/economy/summon';

const fresh = (overrides: Partial<SummonState> = {}): SummonState => ({
  gems: 10_000_000,
  seed: 12345,
  pulls: 0,
  pity: 0,
  owned: [...STARTER_IDS],
  shards: {},
  ...overrides,
});

/** Summons repeatedly, feeding each result's state into the next, like a real player. */
function run(times: number, kind: 'single' | 'multi', start = fresh()) {
  let state = start;
  const all: SummonPull[] = [];
  const batches: SummonPull[][] = [];
  for (let i = 0; i < times; i++) {
    const outcome = performSummon(state, STANDARD_BANNER, kind);
    if (!outcome.ok) throw new Error(outcome.reason);
    all.push(...outcome.pulls);
    batches.push([...outcome.pulls]);
    state = outcome.state;
  }
  return { state, all, batches };
}

describe('summon configuration', () => {
  it('has rates that add up to 100%', () => {
    const total = RARITY_RATES[3] + RARITY_RATES[4] + RARITY_RATES[5];
    expect(total).toBeCloseTo(1, 10);
  });

  it('puts every rarity on the Standard banner, and every Sovereign once', () => {
    const groups = bannerRates(STANDARD_BANNER);
    for (const group of groups) expect(group.ids.length).toBeGreaterThan(0);
    expect(new Set(STANDARD_BANNER.pool).size).toBe(ROSTER.length);
    const perSovereign = groups.reduce((sum, g) => sum + g.perSovereign * g.ids.length, 0);
    expect(perSovereign).toBeCloseTo(1, 10);
  });

  it('prices a multi as 10 singles and gives one bonus', () => {
    expect(SUMMON_COST.multi).toBe(SUMMON_COST.single * 10);
    expect(SUMMON_COUNT.multi).toBe(11);
  });
});

describe('performSummon', () => {
  it('refuses without enough Gems and changes nothing', () => {
    const outcome = performSummon(fresh({ gems: 49 }), STANDARD_BANNER, 'single');
    expect(outcome.ok).toBe(false);
  });

  it('spends Gems, advances the pull count, and returns the right number of Sovereigns', () => {
    const outcome = performSummon(fresh({ gems: 600 }), STANDARD_BANNER, 'multi');
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.pulls).toHaveLength(11);
    expect(outcome.state.gems).toBe(100);
    expect(outcome.state.pulls).toBe(11);
  });

  it('is deterministic: the same state always gives the same result', () => {
    const a = performSummon(fresh(), STANDARD_BANNER, 'multi');
    const b = performSummon(fresh(), STANDARD_BANNER, 'multi');
    expect(a).toEqual(b);
  });

  it('matches the published rates over many summons', () => {
    const { all } = run(20_000, 'single');
    const share = (rarity: number) => all.filter((p) => p.rarity === rarity).length / all.length;
    // 5★ runs a little above 4% because pity adds some; 4★/3★ within sampling noise.
    expect(share(5)).toBeGreaterThan(0.038);
    expect(share(5)).toBeLessThan(0.05);
    expect(share(4)).toBeGreaterThan(0.195);
    expect(share(4)).toBeLessThan(0.225);
    expect(share(3)).toBeGreaterThan(0.72);
    expect(share(3)).toBeLessThan(0.77);
  });

  it('never lets a player go PITY_LIMIT summons without a 5★', () => {
    const { all } = run(5_000, 'single', fresh({ seed: 777 }));
    let streak = 0;
    for (const pull of all) {
      streak = pull.rarity === 5 ? 0 : streak + 1;
      expect(streak).toBeLessThan(PITY_LIMIT);
    }
  });

  it('forces a 5★ on the pity summon and resets the counter', () => {
    const outcome = performSummon(fresh({ pity: PITY_LIMIT - 1 }), STANDARD_BANNER, 'single');
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.pulls[0]?.rarity).toBe(5);
    expect(outcome.state.pity).toBe(0);
    expect(pullsUntilPity(PITY_LIMIT - 1)).toBe(1);
  });

  it('guarantees a 4★ or higher in every multi', () => {
    const { batches } = run(2_000, 'multi', fresh({ seed: 99 }));
    for (const batch of batches) {
      expect(batch.some((p) => p.rarity >= MULTI_GUARANTEE_RARITY)).toBe(true);
    }
    // And the guarantee actually had to step in sometimes (all-3★ rolls happen ~4% of multis).
    expect(batches.some((batch) => batch.some((p) => p.guarantee === 'multi'))).toBe(true);
  });

  it('recruits new Sovereigns once and turns duplicates into shards', () => {
    const { state, all } = run(40, 'multi');
    const seen = new Set<string>(STARTER_IDS);
    const shardTotals: Record<string, number> = {};
    for (const pull of all) {
      expect(pull.isNew).toBe(!seen.has(pull.id));
      if (pull.isNew) {
        expect(pull.shards).toBe(0);
        seen.add(pull.id);
      } else {
        expect(pull.shards).toBe(DUPLICATE_SHARDS[getSovereign(pull.id).rarity]);
        shardTotals[pull.id] = (shardTotals[pull.id] ?? 0) + pull.shards;
      }
    }
    expect(new Set(state.owned)).toEqual(seen);
    expect(state.shards).toEqual(shardTotals);
  });

  it('gives a different result after the pull count moves on', () => {
    const first = performSummon(fresh(), STANDARD_BANNER, 'multi');
    const later = performSummon(fresh({ pulls: 11 }), STANDARD_BANNER, 'multi');
    if (!first.ok || !later.ok) throw new Error('summon failed');
    expect(later.pulls.map((p) => p.id)).not.toEqual(first.pulls.map((p) => p.id));
  });
});
