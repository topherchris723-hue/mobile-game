import { describe, expect, it } from 'vitest';
import { DEFAULT_TEAM, getSovereign, ROSTER, STARTER_IDS } from '../../src/config/sovereigns';
import { createDuel } from '../../src/game/duel/rules';
import { ENEMY_TEAM } from '../../src/config/fighters';
import { BATTLE_RULES } from '../../src/config/battle';
import { applyLeaderSkill, describeLeaderSkill } from '../../src/game/leader';
import { NAMED_CROSSOVERS } from '../../src/config/crossovers';

describe('roster', () => {
  it('has 15 Sovereigns, 5 per world, every type represented, unique ids', () => {
    expect(ROSTER).toHaveLength(15);
    for (const world of ['energy', 'ocean', 'clans'] as const) {
      expect(ROSTER.filter((s) => s.world === world)).toHaveLength(5);
    }
    expect(new Set(ROSTER.map((s) => s.type))).toEqual(
      new Set(['fury', 'swift', 'guile', 'radiant', 'void']),
    );
    expect(new Set(ROSTER.map((s) => s.id)).size).toBe(15);
  });

  it('gives every Sovereign the 6-card deck shape and a leader skill', () => {
    for (const s of ROSTER) {
      expect(s.deck.map((c) => c.kind).sort()).toEqual([
        'blast',
        'blast',
        'signature',
        'strike',
        'strike',
        'technique',
      ]);
      expect(describeLeaderSkill(s.leaderSkill).length).toBeGreaterThan(5);
    }
  });

  it('scales stats with rarity on average', () => {
    const avg = (r: number) => {
      const group = ROSTER.filter((s) => s.rarity === r);
      return group.reduce((sum, s) => sum + s.hp + s.atk * 5 + s.def * 5, 0) / group.length;
    };
    expect(avg(4)).toBeGreaterThan(avg(3));
    expect(avg(5)).toBeGreaterThan(avg(4));
  });

  it('starts players with owned starters that include the default team', () => {
    for (const id of [...STARTER_IDS, ...DEFAULT_TEAM])
      expect(() => getSovereign(id)).not.toThrow();
    for (const id of DEFAULT_TEAM) expect(STARTER_IDS).toContain(id);
  });
});

describe('leader skills', () => {
  it('boosts only matching allies, from the leader in slot 1', () => {
    // Kaien: Energy realm allies +15% ATK.
    const team = [getSovereign('kaien'), getSovereign('rhen'), getSovereign('maris')];
    const { fighters, bonusEnergy } = applyLeaderSkill(team);
    expect(fighters[0]?.atk).toBe(Math.round(215 * 1.15));
    expect(fighters[1]?.atk).toBe(Math.round(getSovereign('rhen').atk * 1.15));
    expect(fighters[2]?.atk).toBe(getSovereign('maris').atk);
    expect(bonusEnergy).toBe(0);
    // Roster data is untouched.
    expect(getSovereign('kaien').atk).toBe(215);
  });

  it('can grant starting Rift Energy, which the duel applies', () => {
    const team = [getSovereign('isla'), getSovereign('kaien'), getSovereign('torvan')];
    const { fighters, bonusEnergy } = applyLeaderSkill(team);
    expect(bonusEnergy).toBe(2);
    const { state } = createDuel({
      player: fighters,
      enemy: ENEMY_TEAM,
      seed: 1,
      bonusEnergy: { player: bonusEnergy },
    });
    const expected =
      BATTLE_RULES.startingEnergy +
      bonusEnergy +
      (state.turnSide === 'player' ? BATTLE_RULES.energyPerTurn : 0);
    expect(state.teams.player.energy).toBe(expected);
  });

  it('describes skills in plain English', () => {
    expect(describeLeaderSkill(getSovereign('kaien').leaderSkill)).toBe(
      'Energy realm allies +15% ATK',
    );
    expect(describeLeaderSkill(getSovereign('rhen').leaderSkill)).toBe(
      'Start each battle with +1 Rift Energy',
    );
  });
});

describe('named Crossovers', () => {
  it('only name real cross-world pairs, keyed in alphabetical order', () => {
    for (const [key, name] of Object.entries(NAMED_CROSSOVERS)) {
      const ids = key.split('+');
      expect(ids, key).toHaveLength(2);
      expect([...ids].sort(), key).toEqual(ids);
      const [a, b] = ids.map((id) => getSovereign(id));
      expect(a?.world, key).not.toBe(b?.world);
      expect(name.length, key).toBeGreaterThan(0);
    }
  });

  it('gives every name to exactly one pair', () => {
    const names = Object.values(NAMED_CROSSOVERS);
    expect(new Set(names).size).toBe(names.length);
  });
});
