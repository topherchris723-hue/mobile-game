// BUG-3-01 / GDD §5.15 Reactive dodge: the AI rolls `slip_chance` exactly once per opponent card windup
// (after `reaction_s`), and on success rolls `perfect_slip_chance` once. A failed roll must not be re-rolled
// on later ticks of the same windup.
//
// Black-box measurement (works on any version of ai.js): every rng.next() call made inside
// AiController.reactiveDodge() is recorded against the opponent action object being watched at that time.
// Inside reactiveDodge the only rng calls are the slip roll and, after a successful slip roll, the perfect roll.
import { describe, it, expect } from 'vitest';
import { createBattle, createContent } from '../../src/logic/index.js';
import { loadBundle, readJson } from '../helpers/load-data.js';

const content = createContent(loadBundle());
const TEAM = readJson('data/economy.json').starting.team;
const TIER_DATA = readJson('data/battle.json').ai_tiers;
const TIERS = ['rookie', 'fighter', 'veteran', 'master'];
const N = 1000;
const OPP = { player: 'enemy', enemy: 'player' };

/**
 * Wrap one AI controller so each reactiveDodge rng call is attributed to the opponent's current action.
 * Returns a Map(action -> { rolls: number of slip rolls, slips: successful slip rolls, perfects }).
 */
function instrument(b, side) {
  const ai = b.controllers[side];
  const perWindup = new Map();
  let inDodge = false;
  let callsThisDodge = 0;
  let key = null;
  const rng = ai.rng;
  const realNext = rng.next.bind(rng);
  const realDodge = ai.reactiveDodge.bind(ai);
  rng.next = function () {
    const v = realNext();
    if (inDodge) {
      let rec = perWindup.get(key);
      if (!rec) { rec = { rolls: 0, slips: 0, perfects: 0, pendingPerfect: false }; perWindup.set(key, rec); }
      const tier = ai.tier();
      if (callsThisDodge === 0) {
        rec.rolls++;
        if (v < tier.slipChance) rec.slips++;
      } else if (callsThisDodge === 1) {
        if (v < tier.perfectSlipChance) rec.perfects++;
      }
      callsThisDodge++;
    }
    return v;
  };
  ai.reactiveDodge = function (tier) {
    inDodge = true;
    callsThisDodge = 0;
    key = b.activeFighter(OPP[side]).action;
    try { return realDodge(tier); } finally { inDodge = false; }
  };
  return perWindup;
}

describe('BUG-3-01 §5.15 reactive dodge: one slip roll per windup (1,000 seeded battles per tier, stage_003)', () => {
  const stats = {};
  for (const tier of TIERS) {
    const s = { windups: 0, multiRoll: 0, maxRolls: 0, slips: 0, perfects: 0, playerWindups: 0, playerSlips: 0, playerPerfects: 0 };
    for (let seed = 1; seed <= N; seed++) {
      const b = createBattle({
        content, stageId: 'stage_003', playerTeam: TEAM,
        playerController: { aiTier: 'fighter' }, enemyController: { aiTier: tier }, skipIntro: true,
      }, seed);
      const enemyW = instrument(b, 'enemy');
      const playerW = instrument(b, 'player');
      while (!b.getResult()) b.step();
      for (const rec of enemyW.values()) {
        s.windups++;
        if (rec.rolls > 1) s.multiRoll++;
        if (rec.rolls > s.maxRolls) s.maxRolls = rec.rolls;
        if (rec.slips > 0) s.slips++;
        if (rec.perfects > 0) s.perfects++;
      }
      for (const rec of playerW.values()) {
        if (rec.rolls > 1) s.multiRoll++;
        if (rec.rolls > s.maxRolls) s.maxRolls = rec.rolls;
        s.playerWindups++;
        if (rec.slips > 0) s.playerSlips++;
        if (rec.perfects > 0) s.playerPerfects++;
      }
    }
    stats[tier] = s;
  }

  /** |observed − expected| within 4 standard errors (binomial) plus 0.01. */
  function expectRate(hits, n, p) {
    const se = Math.sqrt((p * (1 - p)) / n);
    expect(n).toBeGreaterThan(300);
    expect(Math.abs(hits / n - p)).toBeLessThanOrEqual(4 * se + 0.01);
  }

  it('every opponent windup gets at most one slip roll per AI (both sides, every tier)', () => {
    const out = {};
    for (const tier of TIERS) {
      const s = stats[tier];
      out[tier] = { windups: s.windups, slipShare: +(s.slips / s.windups).toFixed(3), perfectShare: +(s.perfects / Math.max(1, s.slips)).toFixed(3), multiRoll: s.multiRoll, maxRolls: s.maxRolls };
    }
    console.log('[BUG-3-01] enemy AI per-windup slip roll stats:', JSON.stringify(out));
    for (const tier of TIERS) {
      expect(stats[tier].windups).toBeGreaterThan(300);
      expect({ tier, multiRoll: stats[tier].multiRoll, maxRolls: stats[tier].maxRolls })
        .toEqual({ tier, multiRoll: 0, maxRolls: 1 });
    }
  });

  for (const tier of TIERS) {
    it(tier + ': share of rolled windups the AI decides to slip ≈ data slip_chance; perfect share of those ≈ perfect_slip_chance', () => {
      const s = stats[tier];
      const d = TIER_DATA[tier];
      expectRate(s.slips, s.windups, d.slip_chance);
      if (d.perfect_slip_chance === 0) expect(s.perfects).toBe(0);
      else expectRate(s.perfects, s.slips, d.perfect_slip_chance);
    });
  }

  it('scripted player (fighter tier) slip and perfect shares match data too (all tier runs pooled)', () => {
    let w = 0; let sl = 0; let pf = 0;
    for (const tier of TIERS) { w += stats[tier].playerWindups; sl += stats[tier].playerSlips; pf += stats[tier].playerPerfects; }
    expectRate(sl, w, TIER_DATA.fighter.slip_chance);
    expectRate(pf, sl, TIER_DATA.fighter.perfect_slip_chance);
  });

});
