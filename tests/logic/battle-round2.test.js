// Round 2 rules (GDD changes tagged "round 2"): Tri-Burst lock (BUG-2-08), landed Tri-Burst knockdown,
// rush safety net, and the new/rewritten acceptance criteria of §5.0, §5.1, §5.5, §5.6, §5.8, §5.9, §5.10, §5.15.
import { describe, it, expect } from 'vitest';
import { createBattle, createContent } from '../../src/logic/index.js';
import { expandDeck } from '../../src/logic/deck.js';
import {
  scriptedBattle, testBundle, giveCard, setVigor, vigor, setClose, step, stepUntil, stepTicks, ofType, TEST_FIST_ID,
} from '../helpers/battle-helpers.js';

const JAB = 'card_tavi_spark_jab';            // fist, melee, 2 hits, windup 7 ticks, interval 6 ticks
const FLARE = 'card_tavi_flare_toss';         // bolt, projectile, 3 hits, windup 15 ticks, speed 160
const WILDFIRE = 'card_tavi_wildfire_crash';  // climax, melee, 6 hits, armor, hitstun 1.0 s
const ENDGAME = 'card_rook_endgame_storm';    // enemy climax, melee, armor, windup 0.65 s (39 ticks)
const ENEMY_JAB = 'card_rook_one_two_count';
const RAZOR = 'card_rook_razor_draft';        // enemy bolt, projectile, 1 hit, windup 12 ticks, speed 200
const NIGHT_THREAD = 'card_thessa_night_thread'; // enemy bolt, beam, 1 hit, windup 24 ticks
const OBSIDIAN = 'card_corvane_obsidian_rain'; // enemy bolt, projectile, 5 hits, windup 18 ticks, speed 140
const TAILWIND = 'card_lark_tailwind_kick';   // fist, melee, 1 hit, windup 6 ticks
const CORVANE_TEAM = ['enemy_corvane_001', 'enemy_solenne_001', 'enemy_thessa_002'];

/** Make the GDD §5.10 example team (strong enough that a Tri-Burst never KOs a 20,000 HP target). */
function exampleTeam(b) {
  const fs = b.teams.player.fighters;
  fs[0].def.atk = 1000; fs[0].def.aura = 'blaze';
  fs[1].def.atk = 1100; fs[1].def.aura = 'stone';
  fs[2].def.atk = 900; fs[2].def.aura = 'void';
  const e = b.activeFighter('enemy');
  e.def.aura = 'gale'; e.def.def = 500; e.def.maxHp = 20000; e.hp = 20000;
}

/** Step through frozen ticks until the next unfrozen tick is about to run. */
function untilUnfrozen(b) {
  let guard = 0;
  while (b.freezes.length > 0) {
    step(b);
    if (++guard > 1000) throw new Error('freeze never ended');
  }
}

describe('§5.0 / §5.9 / §5.10 Tri-Burst lock (BUG-2-08)', () => {
  it('AC-5.9.7: an enemy tapping IGNITE on every tick of the player rush (T..T+18) is rejected not_now; the rush resolves on T+18; the enemy Ignition stays unused and usable later', () => {
    const b = scriptedBattle({ enemyTeam: CORVANE_TEAM });
    exampleTeam(b);
    setClose(b);
    const e = b.activeFighter('enemy');
    e.ign.available = true;
    e.ign.availableAt = 0;
    expect(b.igniteMode('enemy').ok).toBe(true);
    b.teams.player.burst = 100;
    const T = b.tick;
    const all = [];
    let rejected = 0;
    while (b.tick <= T + 18) {
      const t = b.tick;
      const evs = step(b, t === T ? [{ type: 'tri_burst' }] : [], [{ type: 'ignite' }]);
      for (const ev of evs) all.push(ev);
      const rej = ofType(evs, 'input_rejected', 'enemy').filter((r) => r.input.type === 'ignite');
      expect(rej).toHaveLength(1);
      expect(rej[0].reason).toBe('not_now');
      rejected++;
    }
    expect(rejected).toBe(19);
    expect(ofType(all, 'tri_burst_start', 'player')[0].tick).toBe(T);
    expect(ofType(all, 'tri_burst', 'player')[0].tick).toBe(T + 18);
    expect(ofType(all, 'ignition', 'enemy')).toHaveLength(0);
    expect(ofType(all, 'card_cancelled').filter((c) => c.reason === 'ignition')).toHaveLength(0);
    expect(e.ign.used).toBe(false);
    expect(e.ign.available).toBe(true);
    expect(b.teams.player.burstUsed).toBe(true);
    // Usable again once its state allows (after the cinematic and the knockdown getup).
    stepUntil(b, (evs) => ofType(evs, 'getup', 'enemy').length > 0, 600);
    untilUnfrozen(b);
    const evs = step(b, [], [{ type: 'ignite' }]);
    expect(ofType(evs, 'ignition', 'enemy')).toHaveLength(1);
  });
  it('the rushing side itself cannot Ignite during its rush (not_now); Slip and Tag stay allowed for the target', () => {
    const b = scriptedBattle({ enemyTeam: CORVANE_TEAM });
    exampleTeam(b);
    const p = b.activeFighter('player');
    p.ign.available = true;
    b.teams.player.burst = 100;
    b.teams.enemy.tagReadyAt = 0;
    step(b, [{ type: 'tri_burst' }]);
    let evs = step(b, [{ type: 'ignite' }]);
    expect(ofType(evs, 'input_rejected', 'player')[0].reason).toBe('not_now');
    expect(b.getState().teams.player.igniteReady).toBe(false);
    expect(b.getState().triBurstLock).toBe(true);
    evs = step(b, [], [{ type: 'tag', slot: 1 }]);
    expect(ofType(evs, 'tag', 'enemy')).toHaveLength(1);
    evs = step(b, [], [{ type: 'slip' }]);
    expect(ofType(evs, 'slip', 'enemy')).toHaveLength(1);
  });
  it('AC-5.10.6: both teams at 100 tap TRI-BURST on the same tick → only the player rush starts; the enemy input is rejected not_now and its gauge stays 100', () => {
    const b = scriptedBattle();
    exampleTeam(b);
    b.teams.player.burst = 100;
    b.teams.enemy.burst = 100;
    const evs = step(b, [{ type: 'tri_burst' }], [{ type: 'tri_burst' }]);
    expect(ofType(evs, 'tri_burst_start', 'player')).toHaveLength(1);
    expect(ofType(evs, 'tri_burst_start', 'enemy')).toHaveLength(0);
    const rej = ofType(evs, 'input_rejected', 'enemy');
    expect(rej).toHaveLength(1);
    expect(rej[0].reason).toBe('not_now');
    expect(b.teams.enemy.burst).toBe(100);
    expect(b.getState().teams.enemy.burstReady).toBe(false); // greyed during the rush
    // During the rest of the rush the enemy still cannot start its own.
    const later = step(b, [], [{ type: 'tri_burst' }]);
    expect(ofType(later, 'input_rejected', 'enemy')[0].reason).toBe('not_now');
    expect(b.teams.enemy.burst).toBe(100);
  });
  it('safety net: a rush that ends without landing or whiffing counts as a whiff (50% refund, not used) and releases the lock', () => {
    const b = scriptedBattle({ enemyTeam: CORVANE_TEAM });
    exampleTeam(b);
    b.teams.player.burst = 100;
    step(b, [{ type: 'tri_burst' }]);
    stepTicks(b, 5);
    // Simulate a future rule that clears the rush (nothing in today's rules can).
    const p = b.activeFighter('player');
    p.action = null;
    p.state = 'Idle';
    const evs = step(b);
    const w = ofType(evs, 'tri_burst_whiff', 'player');
    expect(w).toHaveLength(1);
    expect(w[0].reason).toBe('safety_net');
    expect(b.teams.player.burst).toBe(50);
    expect(b.teams.player.burstUsed).toBe(false);
    expect(b.getState().triBurstLock).toBe(false);
    const e = b.activeFighter('enemy');
    e.ign.available = true;
    expect(b.igniteMode('enemy').ok).toBe(true);
  });
});

describe('§5.10 landed Tri-Burst (round 2)', () => {
  it('AC-5.10.5: a Tri-Burst landing on an armored Climax windup cancels it (no refund, no hit ever), then Knockdown 25 units away and no hit for 36 unfrozen ticks', () => {
    const b = scriptedBattle();
    exampleTeam(b);
    setClose(b);
    giveCard(b, 'enemy', 0, ENDGAME);
    setVigor(b, 'enemy', 10);
    b.teams.player.burst = 100;
    const c = b.tick;
    step(b, [], [{ type: 'card', slot: 0 }]);
    expect(b.activeFighter('enemy').action.armor).toBe(true);
    const T = b.tick;
    step(b, [{ type: 'tri_burst' }]);
    const all = [];
    while (b.tick <= T + 18) for (const ev of step(b)) all.push(ev);
    const enemy = b.activeFighter('enemy');
    const tb = ofType(all, 'tri_burst', 'player');
    expect(tb).toHaveLength(1);
    const resolve = tb[0].tick;
    expect(resolve).toBe(T + 18);
    expect(resolve).toBeLessThan(c + 39); // still in the Climax windup
    const cancel = ofType(all, 'card_cancelled', 'enemy');
    expect(cancel).toHaveLength(1);
    expect(cancel[0].reason).toBe('tri_burst');
    expect(cancel[0].cardId).toBe(ENDGAME);
    // Vigor: 10 − 7 + regen; never refunded.
    expect(vigor(b, 'enemy')).toBeCloseTo(3 + (resolve - c + 1) / 60, 9);
    expect(enemy.state).toBe('Knockdown');
    expect(b.teams.enemy.x).toBe(Math.min(100, 56 + 25));
    expect(b.distance()).toBe(12 + 25);
    // The cinematic runs, then the target is in Knockdown (invulnerable) on ticks resolve..resolve+35.
    expect(b.getState().freeze.kind).toBe('tri_burst');
    untilUnfrozen(b);
    expect(enemy.state).toBe('Knockdown');
    let lastInvuln = -1;
    const later = [];
    while (b.tick <= resolve + 40) {
      const t = b.tick;
      for (const ev of step(b)) later.push(ev);
      if (b.tick === t) continue;
      if (enemy.state === 'Knockdown') lastInvuln = t;
    }
    expect(lastInvuln).toBe(resolve + 35);
    expect(ofType(later, 'getup', 'enemy')[0].tick).toBe(resolve + 36);
    expect(ofType(all.concat(later), 'hit', 'enemy')).toHaveLength(0);
    expect(ofType(all.concat(later), 'climax_cinematic')).toHaveLength(0);
  });
  it('a landed Tri-Burst cancels the target\'s projectiles in flight and ends both chains', () => {
    const b = scriptedBattle({ enemyTeam: CORVANE_TEAM });
    exampleTeam(b);
    b.teams.player.x = 0; b.teams.enemy.x = 100; // long flight: 100 units at 140/s = 43 ticks
    giveCard(b, 'enemy', 0, OBSIDIAN);
    b.teams.player.burst = 100;
    step(b, [], [{ type: 'card', slot: 0 }]);
    // Wait until the volley is thrown (windup over), then detach it as if the thrower had been hit (GDD §5.5).
    stepUntil(b, () => b.activeFighter('enemy').action && b.activeFighter('enemy').action.phase === 'active', 40);
    const e = b.activeFighter('enemy');
    const a = e.action;
    expect(a.hitTicks[0]).toBeGreaterThan(b.tick + 18);
    a.detached = true;
    b.teams.enemy.inFlight.push(a);
    e.action = null;
    e.state = 'Idle';
    b.teams.enemy.chain.active = true; // an enemy chain that must end too
    b.teams.enemy.chain.cards = 1;
    step(b, [{ type: 'tri_burst' }]);
    const r = stepUntil(b, (evs) => ofType(evs, 'tri_burst', 'player').length > 0, 30);
    expect(b.teams.enemy.inFlight).toHaveLength(0);
    expect(b.teams.enemy.chain.active).toBe(false);
    expect(b.teams.player.chain.active).toBe(false);
    expect(ofType(r.events, 'knockdown', 'enemy')).toHaveLength(1);
    const later = stepTicks(b, 60);
    expect(ofType(r.all.concat(later), 'hit', 'enemy')).toHaveLength(0);
  });
  it('no Knockdown when the Tri-Burst KOs the target', () => {
    const b = scriptedBattle();
    exampleTeam(b);
    setClose(b);
    b.activeFighter('enemy').hp = 100;
    b.teams.player.burst = 100;
    step(b, [{ type: 'tri_burst' }]);
    const r = stepUntil(b, (evs) => ofType(evs, 'tri_burst', 'player').length > 0, 30);
    expect(ofType(r.events, 'knockdown')).toHaveLength(0);
    expect(ofType(r.events, 'ko', 'enemy')).toHaveLength(1);
  });
  it('AC-5.10.4 (rewritten): a whiffed Tri-Burst leaves the gauge at 50 and the attacker Idle on the resolve tick at its rush-start x', () => {
    const b = scriptedBattle(); exampleTeam(b);
    b.teams.player.burst = 100;
    setVigor(b, 'enemy', 5);
    const x0 = b.teams.player.x;
    const T = b.tick;
    step(b, [{ type: 'tri_burst' }]);
    while (b.tick < T + 18 - 15) step(b);
    step(b, [], [{ type: 'slip' }]);
    while (b.tick < T + 18) step(b);
    const evs = step(b);
    const w = ofType(evs, 'tri_burst_whiff', 'player');
    expect(w).toHaveLength(1);
    expect(w[0].tick).toBe(T + 18);
    expect(b.teams.player.burst).toBe(50);
    expect(b.teams.player.burstUsed).toBe(false);
    expect(b.activeFighter('player').state).toBe('Idle');
    expect(b.teams.player.x).toBe(x0);
  });
});

describe('§5.0 inputs during freezes', () => {
  it('AC-5.0.1: a Slip made during a hitstop is applied on the first unfrozen tick after it', () => {
    const b = scriptedBattle({ live: true });
    setClose(b);
    giveCard(b, 'player', 0, TEST_FIST_ID); // 1 hit, so the player is in its link window right after
    step(b, [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (evs) => ofType(evs, 'hit', 'player').length > 0, 30);
    const hitTick = ofType(r.events, 'hit', 'player')[0].tick;
    expect(b.getState().freeze.kind).toBe('hitstop');
    const during = step(b, [{ type: 'slip' }]);
    expect(ofType(during, 'slip')).toHaveLength(0);
    expect(b.getState().freeze).not.toBeNull(); // still frozen (hitstop 2 ticks)
    expect(ofType(step(b), 'slip')).toHaveLength(0); // last frozen tick
    const evs = step(b);
    const slip = ofType(evs, 'slip', 'player');
    expect(slip).toHaveLength(1);
    expect(slip[0].tick).toBe(hitTick + 1);
  });
  it('AC-5.0.1: a card tap made during an Ignition cinematic plays no card, before or after it', () => {
    const b = scriptedBattle({ live: true });
    const f = b.activeFighter('player');
    f.hp = 1000;
    step(b);
    step(b, [{ type: 'ignite' }]);
    setVigor(b, 'player', 10);
    const all = [];
    let frozen = 0;
    while (b.freezes.length > 0) {
      for (const ev of step(b, [{ type: 'card', slot: 0 }, { type: 'card', slot: 1 }])) all.push(ev);
      frozen++;
    }
    expect(frozen).toBe(90);
    for (const ev of stepTicks(b, 30)) all.push(ev);
    expect(ofType(all, 'card_played')).toHaveLength(0);
    expect(ofType(all, 'input_rejected')).toHaveLength(0);
  });
});

describe('§5.1 approach (round 2)', () => {
  it('AC-5.1.4: a Fist tapped at distance 40 starts its windup on tap + 11 at distance exactly 12; at distance 13 on tap + 1', () => {
    for (const [d, n] of [[40, 11], [13, 1]]) {
      const b = scriptedBattle();
      b.teams.enemy.x = b.teams.player.x + d;
      giveCard(b, 'player', 0, JAB);
      const tap = b.tick;
      step(b, [{ type: 'card', slot: 0 }]);
      const r = stepUntil(b, (evs) => ofType(evs, 'windup_start', 'player').length > 0, 40);
      expect(ofType(r.events, 'windup_start', 'player')[0].tick - tap).toBe(n);
      expect(b.distance()).toBe(12);
    }
  });
  it('AC-5.1.5: with approach_timeout_s 0.1 a Fist tapped at distance 40 whiffs on tap + 6 at distance 25 (reason approach_timeout), enters Recovery, no refund', () => {
    const b = scriptedBattle({ mutateBattle: (bj) => { bj.arena.approach_timeout_s = 0.1; } });
    giveCard(b, 'player', 0, JAB);
    setVigor(b, 'player', 5);
    const tap = b.tick;
    step(b, [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (evs) => ofType(evs, 'whiff', 'player').length > 0, 30);
    const w = ofType(r.events, 'whiff', 'player')[0];
    expect(w.reason).toBe('approach_timeout');
    expect(w.tick - tap).toBe(6);
    expect(b.distance()).toBe(25);
    expect(b.activeFighter('player').state).toBe('Recovery');
    expect(vigor(b, 'player')).toBeCloseTo(3 + 7 / 60, 9); // 5 − 2 + 7 ticks of regen, never +2 back
  });
});

describe('§5.5 hits (round 2)', () => {
  it('AC-5.5.3 (rewritten): a Climax hit during its windup stays in Windup, its x does not move, and its first hit lands on the originally scheduled tick', () => {
    const run = (playerHits) => {
      const b = scriptedBattle({ live: true });
      setClose(b);
      giveCard(b, 'enemy', 0, ENDGAME);
      giveCard(b, 'player', 0, JAB);
      setVigor(b, 'enemy', 10);
      step(b, playerHits ? [{ type: 'card', slot: 0 }] : [], [{ type: 'card', slot: 0 }]);
      return b;
    };
    const probe = run(false);
    const th = ofType(stepUntil(probe, (e) => ofType(e, 'hit', 'enemy').length > 0).events, 'hit', 'enemy')[0].tick;

    const b = run(true);
    const enemy = b.activeFighter('enemy');
    const hp0 = enemy.hp;
    const x0 = b.teams.enemy.x;
    const r = stepUntil(b, (e) => ofType(e, 'hit', 'player').length > 0);
    const hit = ofType(r.events, 'hit', 'player')[0];
    expect(enemy.hp).toBeLessThan(hp0);
    expect(enemy.state).toBe('Windup');
    expect(b.teams.enemy.x).toBe(x0);
    expect(ofType(r.all, 'interrupt')).toHaveLength(0);
    // A hit on an armored fighter does not start or extend a chain.
    expect(hit.chainIndex).toBe(1);
    expect(b.teams.player.chain.active).toBe(false);
    const r2 = stepUntil(b, (e) => ofType(e, 'hit', 'enemy').length > 0);
    expect(ofType(r2.events, 'hit', 'enemy')[0].tick).toBe(th);
    expect(b.teams.enemy.x).toBe(x0);
  });
  it('AC-5.5.5: a projectile Bolt whose thrower is hit after the windup ends but before the first hit lands: every hit resolves on its scheduled tick', () => {
    const run = (enemyAttacks) => {
      const b = scriptedBattle({ live: true, enemyTeam: ['enemy_thessa_001'] });
      giveCard(b, 'player', 0, FLARE);
      giveCard(b, 'enemy', 0, NIGHT_THREAD);
      const all = [];
      const tap = 10;
      while (b.tick < tap + 60) {
        const t = b.tick;
        const eIn = enemyAttacks && t === tap - 5 ? [{ type: 'card', slot: 0 }] : [];
        const pIn = t === tap ? [{ type: 'card', slot: 0 }] : [];
        for (const ev of step(b, pIn, eIn)) all.push(ev);
      }
      return all;
    };
    const base = ofType(run(false), 'hit', 'player').map((h) => h.tick);
    expect(base).toHaveLength(3);
    const all = run(true);
    const enemyHit = ofType(all, 'hit', 'enemy');
    expect(enemyHit).toHaveLength(1);
    expect(enemyHit[0].tick).toBeGreaterThan(10 + 15); // after the Bolt's windup ended
    expect(enemyHit[0].tick).toBeLessThan(base[0]);     // before its first hit
    expect(ofType(all, 'hit', 'player').map((h) => h.tick)).toEqual(base);
  });
  it('AC-5.5.5: a 2-hit melee Fist whose attacker is hit by a projectile in flight between its hits deals only the first hit', () => {
    const b = scriptedBattle({ live: true });
    setClose(b);
    giveCard(b, 'player', 0, JAB);
    giveCard(b, 'enemy', 0, RAZOR);
    const e0 = b.activeFighter('enemy').hp;
    const all = [];
    const p = 20;
    while (b.tick < p + 40) {
      const t = b.tick;
      const eIn = t === p - 6 ? [{ type: 'card', slot: 0 }] : [];
      const pIn = t === p ? [{ type: 'card', slot: 0 }] : [];
      for (const ev of step(b, pIn, eIn)) all.push(ev);
    }
    const ph = ofType(all, 'hit', 'player');
    const eh = ofType(all, 'hit', 'enemy');
    expect(ph).toHaveLength(1);
    expect(ph[0].hitIndex).toBe(0);
    expect(eh).toHaveLength(1);
    expect(eh[0].tick).toBeGreaterThan(ph[0].tick);
    expect(eh[0].tick).toBeLessThan(ph[0].tick + 6); // before the Fist's 2nd hit was due
    expect(e0 - b.activeFighter('enemy').hp).toBe(ph[0].damage);
  });
  it('AC-5.5.6: a Climax first hit applies the sum of all its hits on that tick, HP does not change during the cinematic, Hitstun lasts 60 unfrozen ticks', () => {
    const b = scriptedBattle({ live: true });
    setClose(b);
    giveCard(b, 'player', 0, WILDFIRE);
    setVigor(b, 'player', 10);
    const enemy = b.activeFighter('enemy');
    const hp0 = enemy.hp;
    const x0 = b.teams.enemy.x;
    step(b, [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (e) => ofType(e, 'hit', 'player').length > 0, 80);
    const hits = ofType(r.events, 'hit', 'player');
    expect(hits).toHaveLength(6);
    const T = hits[0].tick;
    for (const h of hits) expect(h.tick).toBe(T);
    let sum = 0;
    for (const h of hits) sum += h.damage;
    expect(hp0 - enemy.hp).toBe(sum);
    expect(b.teams.enemy.x).toBe(Math.min(100, x0 + 25)); // full knockback
    const hpAtHit = enemy.hp;
    let frozen = 0;
    while (b.freezes.length > 0) {
      step(b);
      frozen++;
      expect(enemy.hp).toBe(hpAtHit);
    }
    expect(frozen).toBe(Math.round(2.5 * 60) + 0); // climax cinematic (hitstop climax = 0)
    let last = T;
    while (b.tick <= T + 70) {
      const t = b.tick;
      step(b);
      if (b.tick !== t && enemy.state === 'Hitstun') last = t;
    }
    expect(last).toBe(T + 59); // Hitstun on ticks T..T+59 = 60 unfrozen ticks
  });
});

describe('§5.6 Slip windows and Riposte placement (round 2)', () => {
  const TAP = 40;
  /** Enemy taps One-Two Count on TAP at close range; the player slips `before` ticks before its first hit. */
  function slipBefore(before) {
    const probe = scriptedBattle(); setClose(probe);
    giveCard(probe, 'enemy', 0, ENEMY_JAB);
    while (probe.tick < TAP) step(probe);
    step(probe, [], [{ type: 'card', slot: 0 }]);
    const th = ofType(stepUntil(probe, (e) => ofType(e, 'hit', 'enemy').length > 0).events, 'hit', 'enemy')[0].tick;
    const b = scriptedBattle(); setClose(b);
    giveCard(b, 'enemy', 0, ENEMY_JAB);
    const hp = b.activeFighter('player').hp;
    const all = [];
    while (b.tick <= th) {
      const t = b.tick;
      for (const ev of step(b, t === th - before ? [{ type: 'slip' }] : [], t === TAP ? [{ type: 'card', slot: 0 }] : [])) all.push(ev);
    }
    return { b: b, all: all, hp: hp, th: th };
  }
  it('AC-5.6.6: th − t0 = 0 → Perfect; 9 → Perfect; 10 → normal; 21 → normal; 22 → the hit lands', () => {
    for (const d of [0, 9]) {
      const r = slipBefore(d);
      expect(ofType(r.all, 'perfect_slip', 'player')).toHaveLength(1);
      expect(r.b.activeFighter('player').hp).toBe(r.hp);
    }
    for (const d of [10, 21]) {
      const r = slipBefore(d);
      expect(ofType(r.all, 'perfect_slip')).toHaveLength(0);
      expect(ofType(r.all, 'dodge', 'player')).toHaveLength(1);
      expect(r.b.activeFighter('player').hp).toBe(r.hp);
    }
    const r22 = slipBefore(22);
    expect(r22.b.activeFighter('player').hp).toBeLessThan(r22.hp);
  });
  it('§5.6 exact windows: Slipping for th − t0 0..21, SlipRecovery 22..30, Idle from 31', () => {
    const b = scriptedBattle();
    const t0 = b.tick;
    const f = b.activeFighter('player');
    const states = {};
    step(b, [{ type: 'slip' }]);
    states[0] = f.state;
    while (b.tick <= t0 + 32) { const t = b.tick; step(b); states[t - t0] = f.state; }
    expect(states[0]).toBe('Slipping');
    expect(states[21]).toBe('Slipping');
    expect(states[22]).toBe('SlipRecovery');
    expect(states[30]).toBe('SlipRecovery');
    expect(states[31]).toBe('Idle');
  });
  it('AC-5.6.1 / AC-5.6.2 (rewritten): Vigor after = Vigor before + regen (Perfect, net 0) or − 2 + regen (normal)', () => {
    // Before = Vigor at the start of the slip tick t0; after = at the end of the hit tick th.
    // Regen runs on every tick t0..th (th − t0 + 1 ticks) because step 3 follows the input step (GDD §5.0).
    for (const [d, net] of [[6, 0], [15, -2]]) {
      const r = slipBefore(d);
      const b2 = scriptedBattle(); setClose(b2);
      giveCard(b2, 'enemy', 0, ENEMY_JAB);
      while (b2.tick < r.th - d) step(b2, [], b2.tick === TAP ? [{ type: 'card', slot: 0 }] : []);
      setVigor(b2, 'player', 5.0);
      while (b2.tick <= r.th) step(b2, b2.tick === r.th - d ? [{ type: 'slip' }] : [], b2.tick === TAP ? [{ type: 'card', slot: 0 }] : []);
      expect(vigor(b2, 'player')).toBeCloseTo(5.0 + net + (d + 1) / 60, 9);
    }
  });
  it('AC-5.6.7: a melee Riposte at distance 30 snaps to 12 on the tap tick and hits on tap + 6; a projectile Bolt Riposte stays at 30 and also hits on tap + 6', () => {
    for (const [cardId, dist] of [[JAB, 12], [FLARE, 30]]) {
      const r = slipBefore(6);
      const b = r.b;
      expect(b.teams.player.riposteTicks).toBeGreaterThan(0);
      untilUnfrozen(b);
      b.teams.enemy.x = Math.min(100, b.teams.player.x + 30);
      b.teams.player.x = b.teams.enemy.x - 30;
      giveCard(b, 'player', 0, cardId);
      const tap = b.tick;
      const evs = step(b, [{ type: 'card', slot: 0 }]);
      expect(ofType(evs, 'riposte', 'player')).toHaveLength(1);
      expect(b.distance()).toBe(dist);
      const h = stepUntil(b, (e) => ofType(e, 'hit', 'player').length > 0, 20);
      expect(ofType(h.events, 'hit', 'player')[0].tick).toBe(tap + 6);
    }
  });
});

describe('§5.8 Tag Strike (round 2)', () => {
  it('AC-5.8.5: a tag-in at distance 30 during enemy hitstun snaps to 12, the Tag Strike lands on tag + 6, and a Fist tapped next is accepted with chain_index 2', () => {
    const b = scriptedBattle();
    b.teams.player.tagReadyAt = 0;
    b.teams.player.x = 30; b.teams.enemy.x = 60;
    // The enemy is in Hitstun with no player chain open (the Tag Strike is chain card 1).
    const e = b.activeFighter('enemy');
    e.state = 'Hitstun';
    e.stateUntil = b.tick + 30;
    const tag = b.tick;
    const evs = step(b, [{ type: 'tag', slot: 1 }]);
    expect(ofType(evs, 'tag_strike', 'player')).toHaveLength(1);
    expect(b.distance()).toBe(12);
    giveCard(b, 'player', 0, TAILWIND);
    const r = stepUntil(b, (x) => ofType(x, 'hit', 'player').length > 0, 20);
    const strike = ofType(r.events, 'hit', 'player')[0];
    expect(strike.cardId).toBe('tag_strike');
    expect(strike.tick).toBe(tag + 6);
    expect(strike.chainIndex).toBe(1);
    // A Fist on the next tick (the tap made during the hitstop is applied on it).
    const next = step(b, [{ type: 'card', slot: 0 }]);
    expect(ofType(next, 'input_rejected', 'player')).toHaveLength(0);
    untilUnfrozen(b);
    const played = ofType(step(b), 'card_played', 'player');
    expect(played).toHaveLength(1);
    expect(played[0].tick).toBe(tag + 7);
    const r2 = stepUntil(b, (x) => ofType(x, 'hit', 'player').length > 0, 40);
    const fist = ofType(r2.events, 'hit', 'player')[0];
    expect(fist.tick - strike.tick).toBeLessThan(36);
    expect(fist.chainIndex).toBe(2);
  });
});

describe('§5.9 Ignition (round 2)', () => {
  it('AC-5.9.5: when Tavi\'s Ignition ends by duration, the hand holds 4 base cards, discard is empty and draw holds 4', () => {
    const b = scriptedBattle();
    setClose(b);
    const f = b.activeFighter('player');
    // Disturb the base piles before Ignition.
    setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 0 }]);
    stepTicks(b, 120);
    f.hp = 1000;
    step(b);
    step(b, [{ type: 'ignite' }]);
    untilUnfrozen(b);
    setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 1 }]); // disturb the Ignition piles too
    const r = stepUntil(b, (evs) => ofType(evs, 'ignition_end', 'player').length > 0, 3000);
    expect(ofType(r.events, 'ignition_end', 'player')[0].reason).toBe('duration');
    const baseIds = expandDeck(b.content.characters.char_tavi_001.deck);
    expect(f.deck.hand.filter((c) => c !== null)).toHaveLength(4);
    for (const c of f.deck.hand) expect(baseIds).toContain(c);
    expect(f.deck.discard).toHaveLength(0);
    expect(f.deck.draw).toHaveLength(baseIds.length - 4);
    expect(f.deck.refillAt.every((x) => x === -1)).toBe(true);
  });
  it('AC-5.9.6: Tavi (battle_time_s 60) gets ignition_ready on fight tick 3,599 and not earlier; IGNITE on f = 3,600 is accepted', () => {
    const b = scriptedBattle();
    let readyAt = -1;
    let rejectedAt3599 = null;
    while (b.tick < 3600) {
      const t = b.tick;
      const evs = step(b, t === 3599 ? [{ type: 'ignite' }] : []);
      if (t === 3599) rejectedAt3599 = ofType(evs, 'input_rejected', 'player')[0];
      if (ofType(evs, 'ignition_ready', 'player').length > 0 && readyAt < 0) readyAt = t;
    }
    expect(readyAt).toBe(3599);
    expect(rejectedAt3599.reason).toBe('unavailable'); // inputs (step 1) come before the trigger check (step 3)
    const evs = step(b, [{ type: 'ignite' }]);
    expect(ofType(evs, 'ignition', 'player')[0].tick).toBe(3600);
  });
});

describe('§5.15 AI (round 2)', () => {
  it('AC-5.15.6: the AI\'s first think is on fight tick 0 (aggression 1.0, reserve 0, Vigor 5, a cost-2 Fist → card_played on f = 0)', () => {
    const bundle = testBundle((bj) => { bj.ai_tiers.fighter.aggression = 1.0; bj.ai_tiers.fighter.vigor_reserve = 0; });
    const b = createBattle({
      content: createContent(bundle), enemyTeam: ['enemy_rook_003'],
      playerTeam: ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'],
      playerController: 'human', enemyController: { aiTier: 'fighter' }, skipIntro: true,
    }, 3);
    for (let i = 0; i < 4; i++) giveCard(b, 'enemy', i, ENEMY_JAB);
    expect(b.tick).toBe(0);
    expect(vigor(b, 'enemy')).toBe(5);
    const evs = step(b);
    const played = ofType(evs, 'card_played', 'enemy');
    expect(played).toHaveLength(1);
    expect(played[0].tick).toBe(0);
  });
});

// AC-5.10.7 was rewritten in round 3 (live stage_004 + stage_005, extra seeds, 0 safety-net whiffs, 0 KOs during a
// rush): see tests/logic/battle-rush-invuln.test.js. This loop keeps the round-2 AC-5.15.2 lock check (P, live data).
describe('§5.15 headless runs (1,000 seeded master-vs-master battles, live stage_005)', () => {
  const content = createContent(testBundle(undefined, 'live'));
  const N = 1000;
  let starts = 0;
  let rejected = 0;
  for (let seed = 1; seed <= N; seed++) {
    const b = createBattle({
      content, stageId: 'stage_005', playerTeam: ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'],
      playerController: { aiTier: 'master' }, enemyController: { aiTier: 'master' }, skipIntro: true,
    }, seed);
    while (!b.getResult()) {
      for (const e of b.step()) {
        if (e.type === 'tri_burst_start') starts++;
        if (e.type === 'input_rejected') rejected++;
      }
    }
  }
  it('AC-5.15.2 (round 2): the AI never tries an Ignite or Tri-Burst during the lock (0 rejected AI inputs)', () => {
    expect(starts).toBeGreaterThan(100);
    expect(rejected).toBe(0);
  });
});
