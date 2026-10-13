import { describe, expect, it } from 'vitest';
import { BASE_LEVEL_CAP, LIMIT_BREAK, STAT_GROWTH_PER_LEVEL } from '../../src/config/progression';
import { getSovereign, ROSTER } from '../../src/config/sovereigns';
import { DUPLICATE_SHARDS } from '../../src/config/summons';
import {
  affordableLevel,
  costToReach,
  levelCap,
  levelledSovereign,
  levelUp,
  levelUpCost,
  limitBreakBlockedReason,
  NEW_PROGRESS,
  statAtLevel,
} from '../../src/game/progression';

describe('level caps and costs', () => {
  it('raises the cap by one step per Limit Break', () => {
    expect(levelCap(3, 0)).toBe(BASE_LEVEL_CAP[3]);
    expect(levelCap(3, 2)).toBe(BASE_LEVEL_CAP[3] + 2 * LIMIT_BREAK.levelsPerBreak);
  });

  it('keeps higher rarities ahead at full Limit Break', () => {
    expect(levelCap(5, LIMIT_BREAK.max)).toBeGreaterThan(levelCap(4, LIMIT_BREAK.max));
    expect(levelCap(4, LIMIT_BREAK.max)).toBeGreaterThan(levelCap(3, LIMIT_BREAK.max));
  });

  it('costs more per level as levels rise, and sums correctly', () => {
    expect(levelUpCost(2)).toBeGreaterThan(levelUpCost(1));
    expect(costToReach(1, 4)).toBe(levelUpCost(1) + levelUpCost(2) + levelUpCost(3));
    expect(costToReach(10, 10)).toBe(0);
  });

  it('makes a Limit Break cost about two duplicates of that rarity', () => {
    for (const rarity of [3, 4, 5] as const) {
      expect(LIMIT_BREAK.shardCost[rarity] / DUPLICATE_SHARDS[rarity]).toBe(2);
    }
  });
});

describe('levelUp', () => {
  it('spends Coins and raises the level', () => {
    const outcome = levelUp(NEW_PROGRESS, 4, 10_000, 1);
    expect(outcome).toEqual({
      ok: true,
      progress: { level: 2, limitBreaks: 0 },
      cost: levelUpCost(1),
    });
  });

  it('stops multi-level purchases at the cap and charges only for levels gained', () => {
    const near = { level: BASE_LEVEL_CAP[3] - 3, limitBreaks: 0 };
    const outcome = levelUp(near, 3, 1_000_000, 10);
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.progress.level).toBe(BASE_LEVEL_CAP[3]);
    expect(outcome.cost).toBe(costToReach(near.level, BASE_LEVEL_CAP[3]));
  });

  it('refuses when Coins are short, without partial purchases', () => {
    const outcome = levelUp(NEW_PROGRESS, 4, levelUpCost(1) - 1, 1);
    expect(outcome.ok).toBe(false);
    const ten = levelUp(NEW_PROGRESS, 4, costToReach(1, 11) - 1, 10);
    expect(ten.ok).toBe(false);
  });

  it('points to Limit Break at the cap, and says max at the final cap', () => {
    const capped = levelUp({ level: BASE_LEVEL_CAP[4], limitBreaks: 0 }, 4, 1e9, 1);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.reason).toContain('Limit Break');
    const maxed = levelUp({ level: levelCap(4, LIMIT_BREAK.max), limitBreaks: 4 }, 4, 1e9, 1);
    expect(maxed).toEqual({ ok: false, reason: 'Max level reached' });
  });

  it('finds the highest affordable level', () => {
    expect(affordableLevel(NEW_PROGRESS, 3, costToReach(1, 7))).toBe(7);
    expect(affordableLevel(NEW_PROGRESS, 3, costToReach(1, 7) - 1)).toBe(6);
    expect(affordableLevel(NEW_PROGRESS, 3, 1e12)).toBe(BASE_LEVEL_CAP[3]);
  });
});

describe('limit breaks', () => {
  const capped = { level: BASE_LEVEL_CAP[5], limitBreaks: 0 };

  it('needs the level cap and enough shards', () => {
    expect(limitBreakBlockedReason({ level: 5, limitBreaks: 0 }, 5, 999)).toBe(
      'Reach the level cap first',
    );
    expect(limitBreakBlockedReason(capped, 5, LIMIT_BREAK.shardCost[5] - 1)).toContain('shards');
    expect(limitBreakBlockedReason(capped, 5, LIMIT_BREAK.shardCost[5])).toBeNull();
  });

  it('stops after the last Limit Break', () => {
    const full = { level: levelCap(5, LIMIT_BREAK.max), limitBreaks: LIMIT_BREAK.max };
    expect(limitBreakBlockedReason(full, 5, 999)).toBe('Fully Limit Broken');
  });
});

describe('stats', () => {
  it('leaves level 1 untouched and grows HP/ATK/DEF but never SPD', () => {
    const kaien = getSovereign('kaien');
    expect(levelledSovereign(kaien, NEW_PROGRESS)).toBe(kaien);
    const at30 = levelledSovereign(kaien, { level: 30, limitBreaks: 0 });
    expect(at30.hp).toBe(Math.round(kaien.hp * (1 + STAT_GROWTH_PER_LEVEL * 29)));
    expect(at30.atk).toBeGreaterThan(kaien.atk);
    expect(at30.def).toBeGreaterThan(kaien.def);
    expect(at30.spd).toBe(kaien.spd);
    // The roster data itself is never mutated.
    expect(getSovereign('kaien').hp).toBe(kaien.hp);
  });

  it('lets a 5★ stay ahead of a 3★ when both are maxed', () => {
    const best3 = Math.max(...ROSTER.filter((s) => s.rarity === 3).map((s) => s.atk));
    const worst5 = Math.min(...ROSTER.filter((s) => s.rarity === 5).map((s) => s.atk));
    expect(statAtLevel(worst5, levelCap(5, LIMIT_BREAK.max))).toBeGreaterThan(
      statAtLevel(best3, levelCap(3, LIMIT_BREAK.max)),
    );
  });
});
