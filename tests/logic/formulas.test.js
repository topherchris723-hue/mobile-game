// GDD formula tests with the GDD's own example numbers.
import { describe, it, expect } from 'vitest';
import * as F from '../../src/logic/formulas.js';
import { buildRules } from '../../src/logic/rules.js';
import { SeededRng } from '../../src/logic/rng.js';
import { readJson } from '../helpers/load-data.js';

const battleJson = readJson('data/battle.json');
const R = buildRules(battleJson);

describe('GDD §5.11 damage formula', () => {
  it('AC-5.11.1: ATK 1000, 2-hit Fist power 1.2, Blaze vs Gale, chain 2, no crit, DEF 500 → 546 per hit, 1,092 total', () => {
    const p = { atk: 1000, power: 1.2, hits: 2, typeMult: 1.3, critMult: 1, comboMult: 1.05, riposteMult: 1, def: 500 };
    const hit = F.hitDamage(p, R.damage);
    expect(hit).toBe(546);
    expect(hit * 2).toBe(1092);
  });
  it('AC-5.11.2 (rewritten): ATK 300, power 0.01, 1 hit, all mults 1.0, DEF 3,000 → raw 0.75 → floor 0 → clamped to 1, never 0', () => {
    const p = { atk: 300, power: 0.01, hits: 1, typeMult: 1.0, critMult: 1, comboMult: 1, riposteMult: 1, def: 3000 };
    expect(F.defFactor(3000, R.damage.defConstant)).toBe(0.25);
    expect(F.hitDamage(p, R.damage)).toBe(1);
    // At ATK 1,000 the same inputs give 2.5 → 2 (does not test the minimum).
    expect(F.hitDamage({ ...p, atk: 1000 }, R.damage)).toBe(2);
    // Even ATK 1 against DEF 3,000 never deals 0.
    expect(F.hitDamage({ atk: 1, power: 0.01, hits: 10, typeMult: 0.8, critMult: 1, comboMult: 1, riposteMult: 1, def: 3000 }, R.damage)).toBe(1);
  });
  it('caps a hit at max_hit 99,999', () => {
    const p = { atk: 1e9, power: 10, hits: 1, typeMult: 1.3, critMult: 1.5, comboMult: 1.2, riposteMult: 1.25, def: 0 };
    expect(F.hitDamage(p, R.damage)).toBe(99999);
  });
  it('AC-5.11.3: over 100,000 seeded card uses at crit_rate 0.05, crit frequency is 0.05 ± 0.003', () => {
    const rng = new SeededRng(12345);
    let crits = 0;
    const rate = Math.min(0.05, R.damage.critCap);
    for (let i = 0; i < 100000; i++) if (rng.next() < rate) crits++;
    expect(Math.abs(crits / 100000 - 0.05)).toBeLessThanOrEqual(0.003);
  });
  it('crit chance is capped at crit_cap 0.50', () => {
    expect(Math.min(0.9, R.damage.critCap)).toBe(0.5);
  });
  it('AC-5.11.4: buff factor stays inside [0.5, 1.5] for any stacked buffs', () => {
    expect(F.buffFactor(0.9, 0, R.damage.buffMin, R.damage.buffMax)).toBe(1.5);
    expect(F.buffFactor(0, 0.9, R.damage.buffMin, R.damage.buffMax)).toBe(0.5);
    expect(F.buffFactor(0.2, 0.3, R.damage.buffMin, R.damage.buffMax)).toBeCloseTo(0.9, 10); // §5.13 example
    for (let up = 0; up <= 2; up += 0.25) {
      for (let down = 0; down <= 2; down += 0.25) {
        const v = F.buffFactor(up, down, R.damage.buffMin, R.damage.buffMax);
        expect(v).toBeGreaterThanOrEqual(0.5);
        expect(v).toBeLessThanOrEqual(1.5);
      }
    }
  });
  it('player stat after Resonance: floor(base × (1 + 0.05 × R))', () => {
    expect(F.playerStat(1000, 0, 0.05)).toBe(1000);
    expect(F.playerStat(1050, 4, 0.05)).toBe(1260);
    expect(F.playerStat(8500, 1, 0.05)).toBe(8925);
  });
});

describe('GDD §5.7 combo multiplier', () => {
  it('1.00, 1.05, 1.10, 1.15, 1.20 and capped after', () => {
    const m = [1, 2, 3, 4, 5, 6, 9].map((c) => F.comboMult(c, R.combo.bonusPerCard, R.combo.bonusMaxSteps));
    const want = [1.0, 1.05, 1.1, 1.15, 1.2, 1.2, 1.2];
    m.forEach((v, i) => expect(v).toBeCloseTo(want[i], 10));
  });
});

describe('GDD §5.12 aura types', () => {
  it('AC-5.12.1: all 25 attacker/defender pairs match the GDD table', () => {
    const adv = { blaze: 'gale', gale: 'stone', stone: 'blaze' };
    const auras = ['blaze', 'gale', 'stone', 'radiant', 'void'];
    let n = 0;
    for (const a of auras) {
      for (const d of auras) {
        let want = 1.0;
        if (adv[a] === d) want = 1.3;
        else if (adv[d] === a) want = 0.8;
        else if ((a === 'radiant' && d === 'void') || (a === 'void' && d === 'radiant')) want = 1.3;
        expect(F.typeMult(R.typeChart, a, d), a + '→' + d).toBe(want);
        n++;
      }
    }
    expect(n).toBe(25);
  });
});

describe('GDD §5.10 Burst and Tri-Burst formulas', () => {
  it('AC-5.10.1: 2,500 damage to a 10,000 HP enemy → +10 gauge', () => {
    expect(F.burstGainDealt(2500, 10000, R.burst.gainDealtFactor)).toBe(10);
  });
  it('GDD examples: 1,000 dealt → +4, 1,000 taken on 10,000 HP → +2.5', () => {
    expect(F.burstGainDealt(1000, 10000, R.burst.gainDealtFactor)).toBe(4);
    expect(F.burstGainTaken(1000, 10000, R.burst.gainTakenFactor)).toBe(2.5);
  });
  it('AC-5.10.2: ATK 1000 Blaze / 1100 Stone / 900 Void vs Gale DEF 500 → 2,600 + 2,200 + 1,800 = 6,600', () => {
    const tm = (a) => F.typeMult(R.typeChart, a, 'gale');
    const hits = [
      F.triBurstHit(1000, tm('blaze'), 500, R.burst.powerPerMember, R.damage),
      F.triBurstHit(1100, tm('stone'), 500, R.burst.powerPerMember, R.damage),
      F.triBurstHit(900, tm('void'), 500, R.burst.powerPerMember, R.damage),
    ];
    expect(hits).toEqual([2600, 2200, 1800]);
    expect(hits[0] + hits[1] + hits[2]).toBe(6600);
  });
  it('Tri-Burst never uses a type disadvantage (max(1, type))', () => {
    expect(F.triBurstHit(1000, 0.8, 0, 3, R.damage)).toBe(3000);
  });
});

describe('GDD §8 / §9.1 / §5.14', () => {
  it('AC-8.1: enemy stat_mult.hp 1.2 on a 10,000 HP character → exactly 12,000 HP', () => {
    expect(F.enemyStat(10000, 1.2)).toBe(12000);
  });
  it('§9.1 fighter power example: HP 8,500, ATK 900, DEF 440 → 1,970', () => {
    expect(F.fighterPower(8500, 900, 440, readJson('data/economy.json').power_formula)).toBe(1970);
  });
  it('AC-5.14.2: timeout 0.40 vs 0.35 → Win; 0.35 vs 0.35 → Draw', () => {
    expect(F.timeoutResult(0.4, 0.35)).toBe('win');
    expect(F.timeoutResult(0.35, 0.35)).toBe('draw');
    expect(F.timeoutResult(0.3, 0.35)).toBe('lose');
    expect(F.timeoutResultExact(4000, 10000, 3500, 10000)).toBe('win');
    expect(F.timeoutResultExact(7000, 20000, 3500, 10000)).toBe('draw');
  });
});

describe('GDD §5.0 tick conversion', () => {
  it('converts seconds with round(s × 60) and reads every number from battle.json', () => {
    expect(R.slip.iframeTicks).toBe(21);
    expect(R.slip.perfectTicks).toBe(9);
    expect(R.hand.refillTicks).toBe(90);
    expect(R.tag.cooldownTicks).toBe(480);
    expect(R.tag.initialCooldownTicks).toBe(300);
    expect(R.riposte.windowTicks).toBe(48);
    expect(R.combo.getupTicks).toBe(36);
  });
  it('initial_cooldown_s defaults to 5 when absent', () => {
    const copy = JSON.parse(JSON.stringify(battleJson));
    delete copy.tag.initial_cooldown_s;
    expect(buildRules(copy).tag.initialCooldownTicks).toBe(300);
  });
});
