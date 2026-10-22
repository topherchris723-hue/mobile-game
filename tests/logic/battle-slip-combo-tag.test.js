// Battle engine: GDD §5.6 Slip/Riposte, §5.7 combos, §5.8 Tag and KO.
import { describe, it, expect } from 'vitest';
import { hitDamage } from '../../src/logic/formulas.js';
import {
  scriptedBattle, giveCard, setVigor, vigor, setClose, step, stepUntil, stepTicks, ofType, TEST_FIST_ID,
} from '../helpers/battle-helpers.js';

const JAB = 'card_tavi_spark_jab';
const ENEMY_JAB = 'card_rook_one_two_count';
const FURNACE = 'card_tavi_furnace_rush';

const ENEMY_TAP_TICK = 40;

/** Close range; the enemy taps `cardId` on tick ENEMY_TAP_TICK (so a slip can start before the tap). */
function enemyAttack(cardId) {
  const b = scriptedBattle();
  setClose(b);
  giveCard(b, 'enemy', 0, cardId || ENEMY_JAB);
  while (b.tick < ENEMY_TAP_TICK) step(b);
  step(b, [], [{ type: 'card', slot: 0 }]);
  return b;
}

/** Tick of the enemy's first hit, plus player Vigor right after it, with no slip. */
function baseline(cardId) {
  const b = enemyAttack(cardId);
  const r = stepUntil(b, (e) => ofType(e, 'hit', 'enemy').length > 0);
  return { th: ofType(r.events, 'hit', 'enemy')[0].tick, vigorAfter: b.teams.player.vigor };
}

/** Run the enemy attack with the player slipping `ticksBefore` ticks before the hit tick. */
function slipBefore(ticksBefore, cardId) {
  const base = baseline(cardId);
  const b = scriptedBattle();
  setClose(b);
  giveCard(b, 'enemy', 0, cardId || ENEMY_JAB);
  const hp = b.activeFighter('player').hp;
  const all = [];
  const slipAt = base.th - ticksBefore;
  while (b.tick <= base.th) {
    const pIn = b.tick === slipAt ? [{ type: 'slip' }] : [];
    const eIn = b.tick === ENEMY_TAP_TICK ? [{ type: 'card', slot: 0 }] : [];
    const t = b.tick;
    for (const e of step(b, pIn, eIn)) all.push(e);
    if (b.tick === t) throw new Error('unexpected freeze before the hit');
  }
  return { b: b, all: all, hp: hp, base: base };
}

describe('§5.6 Slip, Perfect Slip and Riposte', () => {
  it('AC-5.6.1: a Slip started 6 ticks before a hit: no damage, Vigor net 0, a Riposte window opens', () => {
    const r = slipBefore(6);
    expect(r.b.activeFighter('player').hp).toBe(r.hp);
    expect(ofType(r.all, 'perfect_slip', 'player')).toHaveLength(1);
    expect(r.b.teams.player.vigor).toBe(r.base.vigorAfter); // same Vigor as not slipping at all
    expect(r.b.teams.player.riposteTicks).toBeGreaterThan(0);
    expect(r.b.teams.player.burst).toBeGreaterThanOrEqual(5);
  });
  it('AC-5.6.2: a Slip started 15 ticks before a hit: no damage, Vigor −2, no Riposte window', () => {
    const r = slipBefore(15);
    expect(r.b.activeFighter('player').hp).toBe(r.hp);
    expect(ofType(r.all, 'perfect_slip')).toHaveLength(0);
    expect(ofType(r.all, 'dodge', 'player')).toHaveLength(1);
    expect(r.b.teams.player.vigor).toBe(r.base.vigorAfter - 2 * 6000);
    expect(r.b.teams.player.riposteTicks).toBe(0);
  });
  it('perfect window boundary: 9 ticks before is Perfect, 10 is a normal dodge, 21 still dodges', () => {
    expect(ofType(slipBefore(9).all, 'perfect_slip')).toHaveLength(1);
    expect(ofType(slipBefore(10).all, 'perfect_slip')).toHaveLength(0);
    const r21 = slipBefore(21);
    expect(r21.b.activeFighter('player').hp).toBe(r21.hp);
  });
  it('AC-5.6.3: a Slip started 25 ticks before a hit: the hit lands (outside the 21-tick i-frames)', () => {
    const r = slipBefore(25);
    expect(ofType(r.all, 'slip', 'player')).toHaveLength(1);
    expect(r.b.activeFighter('player').hp).toBeLessThan(r.hp);
    const r22 = slipBefore(22);
    expect(r22.b.activeFighter('player').hp).toBeLessThan(r22.hp);
  });
  it('AC-5.6.4: a Riposte Fist (power 1.2) deals exactly 1.25× the same Fist without Riposte, and costs 0', () => {
    // normal: same target state (enemy in Recovery after its whiffed card is not required for the formula)
    const n = scriptedBattle(); setClose(n); giveCard(n, 'player', 1, TEST_FIST_ID);
    step(n, [{ type: 'card', slot: 1 }]);
    const normal = ofType(stepUntil(n, (e) => ofType(e, 'hit', 'player').length > 0).events, 'hit', 'player')[0];
    expect(normal.riposte).toBe(false);

    const r = slipBefore(6);
    const b = r.b;
    giveCard(b, 'player', 1, TEST_FIST_ID);
    const v0 = b.teams.player.vigor;
    const evs = step(b, [{ type: 'card', slot: 1 }]);
    expect(ofType(evs, 'riposte', 'player')).toHaveLength(1);
    expect(b.teams.player.vigor).toBe(v0 + b.rules.vigor.regenPerTick); // cost 0
    const tap = b.tick - 1;
    const hit = ofType(stepUntil(b, (e) => ofType(e, 'hit', 'player').length > 0).events, 'hit', 'player')[0];
    expect(hit.riposte).toBe(true);
    expect(hit.tick - tap).toBe(6); // first hit after 0.1 s, no approach or windup
    const pf = b.activeFighter('player');
    const ef = b.activeFighter('enemy');
    const p = { atk: pf.def.atk, power: 1.2, hits: 1, typeMult: hit.typeMult, critMult: 1, comboMult: 1, def: ef.def.def };
    expect(normal.damage).toBe(hitDamage({ ...p, riposteMult: 1 }, b.rules.damage));
    expect(hit.damage).toBe(hitDamage({ ...p, riposteMult: 1.25 }, b.rules.damage));
    expect(Math.abs(hit.damage - 1.25 * normal.damage)).toBeLessThanOrEqual(1.25);
  });
  it('Climax cards cannot be Riposte cards, and only one Riposte per window', () => {
    const r = slipBefore(6);
    const b = r.b;
    giveCard(b, 'player', 0, 'card_tavi_wildfire_crash');
    giveCard(b, 'player', 1, JAB);
    giveCard(b, 'player', 2, JAB);
    const evs = step(b, [{ type: 'card', slot: 0 }]);
    expect(ofType(evs, 'card_played')).toHaveLength(0);
    step(b, [{ type: 'card', slot: 1 }]);
    expect(b.teams.player.riposteTicks).toBe(0);
  });
  it('the Riposte window closes after 0.8 s (48 ticks)', () => {
    const r = slipBefore(6);
    const b = r.b;
    const left = b.teams.player.riposteTicks;
    expect(left).toBeLessThanOrEqual(48);
    stepTicks(b, left);
    expect(b.teams.player.riposteTicks).toBe(0);
  });
  it('holdRiposteWindow keeps the window open (tutorial §9.4)', () => {
    const r = slipBefore(6);
    const b = r.b;
    b.holdRiposteWindow('player', true);
    const left = b.teams.player.riposteTicks;
    stepTicks(b, 120);
    expect(b.teams.player.riposteTicks).toBe(left);
    b.holdRiposteWindow('player', false);
  });
  it('AC-5.6.5: a Break Slip in hitstun with Vigor 3.9 fails; with 4.0 it succeeds and leaves 0.0', () => {
    const b = enemyAttack();
    stepUntil(b, (e) => ofType(e, 'hit', 'enemy').length > 0);
    stepUntil(b, () => b.tick > 0 && b.getState().freeze === null);
    expect(b.activeFighter('player').state).toBe('Hitstun');
    setVigor(b, 'player', 3.9);
    let evs = step(b, [{ type: 'slip' }]);
    expect(ofType(evs, 'slip')).toHaveLength(0);
    expect(b.activeFighter('player').state).toBe('Hitstun');
    stepUntil(b, () => b.getState().freeze === null && b.activeFighter('player').state === 'Hitstun', 10);
    setVigor(b, 'player', 4.0);
    evs = step(b, [{ type: 'slip' }]);
    const slip = ofType(evs, 'slip', 'player')[0];
    expect(slip.isBreak).toBe(true);
    expect(slip.cost).toBe(4);
    expect(b.teams.player.vigor).toBe(b.rules.vigor.regenPerTick); // 0.0, plus this tick's regen
    expect(b.activeFighter('player').state).toBe('Slipping');
    expect(b.teams.enemy.chain.active).toBe(false);
  });
});

/** Play cards in `slots` as a chain: each next one is tapped on the tick the link window opens. */
function playChain(b, slots, refill, allOut, stopAtKnockdown) {
  const hits = [];
  const all = allOut || [];
  for (const e of step(b, [{ type: 'card', slot: slots[0] }])) all.push(e);
  let i = 1;
  let guard = 0;
  while (guard++ < 3000) {
    const evs = step(b);
    for (const e of evs) all.push(e);
    for (const e of evs) if (e.type === 'hit' && e.side === 'player') hits.push(e);
    if (stopAtKnockdown && ofType(evs, 'knockdown').length > 0) return hits;
    if (ofType(evs, 'link_open', 'player').length > 0) {
      if (i >= slots.length) break;
      if (refill) refill(b);
      for (const e of stepUntil(b, () => b.getState().freeze === null, 20).all) all.push(e);
      for (const e of step(b, [{ type: 'card', slot: slots[i] }])) all.push(e);
      i++;
    }
  }
  // let the last hits finish
  for (const e of stepTicks(b, 2)) {
    all.push(e);
    if (e.type === 'hit' && e.side === 'player') hits.push(e);
  }
  return hits;
}

describe('§5.7 combos', () => {
  it('AC-5.7.1: a 3rd chained card deals exactly 1.10× its unchained damage (same seed, no crit)', () => {
    const solo = scriptedBattle(); setClose(solo); giveCard(solo, 'player', 2, TEST_FIST_ID);
    step(solo, [{ type: 'card', slot: 2 }]);
    const d1 = ofType(stepUntil(solo, (e) => ofType(e, 'hit', 'player').length > 0).events, 'hit', 'player')[0];

    const b = scriptedBattle(); setClose(b);
    giveCard(b, 'player', 0, JAB); giveCard(b, 'player', 1, JAB); giveCard(b, 'player', 2, TEST_FIST_ID);
    setVigor(b, 'player', 10);
    const hits = playChain(b, [0, 1, 2]);
    const third = hits.filter((h) => h.cardId === TEST_FIST_ID)[0];
    expect(third.chainIndex).toBe(3);
    const pf = b.activeFighter('player'); const ef = b.activeFighter('enemy');
    const p = { atk: pf.def.atk, power: 1.2, hits: 1, typeMult: third.typeMult, critMult: 1, riposteMult: 1, def: ef.def.def };
    expect(d1.damage).toBe(hitDamage({ ...p, comboMult: 1 }, b.rules.damage));
    expect(third.damage).toBe(hitDamage({ ...p, comboMult: 1.1 }, b.rules.damage));
    expect(Math.abs(third.damage - 1.1 * d1.damage)).toBeLessThanOrEqual(1.1);
  });
  it('§5.7 example: Fist → Fist → Bolt costs 7 Vigor and the Bolt has chain_index 3', () => {
    const b = scriptedBattle(); setClose(b);
    giveCard(b, 'player', 0, JAB); giveCard(b, 'player', 1, JAB); giveCard(b, 'player', 2, 'card_tavi_flare_toss');
    setVigor(b, 'player', 10);
    const hits = playChain(b, [0, 1, 2]);
    const bolt = hits.filter((h) => h.cardType === 'bolt');
    expect(bolt.length).toBeGreaterThan(0);
    expect(bolt[0].chainIndex).toBe(3);
    expect(b.card(JAB).cost * 2 + b.card('card_tavi_flare_toss').cost).toBe(7);
  });
  it('AC-5.7.2: after a 5th chained card the defender is in Knockdown and a 6th card cannot hit for 36 ticks', () => {
    const b = scriptedBattle(); setClose(b);
    const refill = (bb) => { for (let i = 0; i < 4; i++) giveCard(bb, 'player', i, JAB); setVigor(bb, 'player', 10); };
    refill(b);
    const all = [];
    const hits = playChain(b, [0, 1, 2, 3, 0], refill, all);
    expect(Math.max(...hits.map((h) => h.chainIndex))).toBe(5);
    const kd = ofType(all, 'knockdown', 'enemy')[0];
    expect(kd).toBeDefined();
    const enemy = b.activeFighter('enemy');
    expect(enemy.stateUntil - kd.tick).toBe(36);
    expect(ofType(all, 'chain_end', 'player')[0].reason).toBe('chain_cap');
    // Every unfrozen tick from the knockdown tick to +35 is invulnerable; tick +36 is not.
    const b2 = scriptedBattle(); setClose(b2); refill(b2);
    const all2 = [];
    playChain(b2, [0, 1, 2, 3, 0], refill, all2, true);
    const kd2 = ofType(all2, 'knockdown', 'enemy')[0];
    expect(b2.tick).toBe(kd2.tick + 1); // stopped right after the knockdown tick
    const e2 = b2.activeFighter('enemy');
    let invuln = 1; // the knockdown tick itself
    while (b2.tick < kd2.tick + 36) {
      const t = b2.tick;
      step(b2);
      if (b2.tick === t) continue; // freeze tick
      if (b2.tick - 1 < kd2.tick + 36 && e2.state === 'Knockdown') invuln++;
    }
    expect(invuln).toBe(36);
    expect(e2.state).toBe('Knockdown');
    stepUntil(b2, () => b2.tick === kd2.tick + 37, 20); // process tick K+36
    expect(e2.state).toBe('Idle');
    expect(b2.isInvulnerable(e2)).toBe(false);
    // a 6th card tapped right at knockdown whiffs if its first hit falls inside the getup
    const b3 = scriptedBattle(); setClose(b3); refill(b3);
    const all3 = [];
    playChain(b3, [0, 1, 2, 3, 0], refill, all3, true);
    refill(b3);
    stepUntil(b3, () => b3.getState().freeze === null, 20);
    step(b3, [{ type: 'card', slot: 0 }]);
    const after = stepTicks(b3, 40);
    expect(ofType(after, 'whiff', 'player')).toHaveLength(1);
    expect(ofType(after, 'hit', 'player')).toHaveLength(0);
  });
  it('AC-5.7.3: a card tapped 10 ticks before the link window opens starts on the tick it opens', () => {
    const probe = scriptedBattle(); setClose(probe); giveCard(probe, 'player', 0, FURNACE); setVigor(probe, 'player', 10);
    step(probe, [{ type: 'card', slot: 0 }]);
    const L = ofType(stepUntil(probe, (e) => ofType(e, 'link_open', 'player').length > 0).events, 'link_open')[0].tick;

    const b = scriptedBattle(); setClose(b); giveCard(b, 'player', 0, FURNACE); giveCard(b, 'player', 1, JAB); setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 0 }]);
    while (b.tick < L - 10) step(b);
    const evs = step(b, [{ type: 'card', slot: 1 }]);
    expect(ofType(evs, 'card_buffered', 'player')).toHaveLength(1);
    const r = stepUntil(b, (e) => ofType(e, 'card_played', 'player').length > 0);
    expect(ofType(r.events, 'card_played', 'player')[0].tick).toBe(L);
  });
  it('§5.7 buffer: a tap more than 0.25 s (15 ticks) before the link window is dropped', () => {
    const probe = scriptedBattle(); setClose(probe); giveCard(probe, 'player', 0, FURNACE); setVigor(probe, 'player', 10);
    step(probe, [{ type: 'card', slot: 0 }]);
    const L = ofType(stepUntil(probe, (e) => ofType(e, 'link_open', 'player').length > 0).events, 'link_open')[0].tick;
    const b = scriptedBattle(); setClose(b); giveCard(b, 'player', 0, FURNACE); giveCard(b, 'player', 1, JAB); setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 0 }]);
    while (b.tick < L - 16) step(b);
    step(b, [{ type: 'card', slot: 1 }]);
    const all = stepTicks(b, 30);
    expect(ofType(all, 'card_played', 'player')).toHaveLength(0);
  });
  it('a chain of 3+ cards gives +5 Burst when it ends', () => {
    const b = scriptedBattle(); setClose(b);
    giveCard(b, 'player', 0, JAB); giveCard(b, 'player', 1, JAB); giveCard(b, 'player', 2, JAB);
    setVigor(b, 'player', 10);
    playChain(b, [0, 1, 2]);
    const before = b.teams.player.burst;
    const r = stepUntil(b, (e) => ofType(e, 'chain_end', 'player').length > 0);
    expect(ofType(r.events, 'chain_end', 'player')[0].cards).toBe(3);
    expect(b.teams.player.burst).toBeCloseTo(before + 5, 6);
  });
});

describe('§5.8 team, Tag and KO', () => {
  it('AC-5.8.0: Tag is impossible for exactly the first 300 unfrozen ticks after FIGHT! and possible on tick 300', () => {
    for (const removeField of [false, true]) {
      const b = scriptedBattle({ mutateBattle: removeField ? (bj) => { delete bj.tag.initial_cooldown_s; } : null });
      let firstOk = -1;
      while (firstOk < 0 && b.tick < 400) {
        const t = b.tick;
        const evs = step(b, [{ type: 'tag', slot: 1 }]);
        if (ofType(evs, 'tag', 'player').length > 0) firstOk = t;
        else expect(ofType(evs, 'input_rejected', 'player')[0].reason).toBe('cooldown');
      }
      expect(firstOk).toBe(300);
    }
  });
  it('AC-5.8.1: after a Tag, a second Tag is impossible for exactly 480 ticks', () => {
    const b = scriptedBattle();
    b.teams.player.tagReadyAt = 0;
    const t0 = b.tick;
    step(b, [{ type: 'tag', slot: 1 }]);
    let next = -1;
    while (next < 0 && b.tick < t0 + 600) {
      const t = b.tick;
      if (ofType(step(b, [{ type: 'tag', slot: 2 }]), 'tag', 'player').length > 0) next = t;
    }
    expect(next - t0).toBe(480);
  });
  it('AC-5.8.2: a Tag Escape with Vigor 2.5 fails; with 3.0 it succeeds and the enemy chain counter resets', () => {
    const b = enemyAttack();
    b.teams.player.tagReadyAt = 0;
    stepUntil(b, (e) => ofType(e, 'hit', 'enemy').length > 0);
    stepUntil(b, () => b.getState().freeze === null, 10);
    expect(b.activeFighter('player').state).toBe('Hitstun');
    expect(b.teams.enemy.chain.active).toBe(true);
    setVigor(b, 'player', 2.5);
    let evs = step(b, [{ type: 'tag', slot: 1 }]);
    expect(ofType(evs, 'tag')).toHaveLength(0);
    expect(ofType(evs, 'input_rejected', 'player')[0].reason).toBe('vigor');
    stepUntil(b, () => b.getState().freeze === null && b.activeFighter('player').state === 'Hitstun', 10);
    setVigor(b, 'player', 3.0);
    evs = step(b, [{ type: 'tag', slot: 1 }]);
    const tag = ofType(evs, 'tag', 'player')[0];
    expect(tag.escape).toBe(true);
    expect(tag.cost).toBe(3);
    expect(b.teams.enemy.chain.active).toBe(false);
    expect(b.teams.enemy.chain.cards).toBe(0);
    expect(ofType(evs, 'chain_end', 'enemy')[0].reason).toBe('tag_escape');
  });
  it('a Tag during the active fighter\'s Windup is ignored', () => {
    const b = scriptedBattle();
    b.teams.player.tagReadyAt = 0;
    giveCard(b, 'player', 0, FURNACE);
    setClose(b);
    step(b, [{ type: 'card', slot: 0 }]);
    const evs = step(b, [{ type: 'tag', slot: 1 }]);
    expect(ofType(evs, 'input_rejected', 'player')[0].reason).toBe('state');
  });
  it('AC-5.8.3: when slot 1 is KO\'d while slot 2 is alive, slot 2 comes in automatically and Tag is immediately available', () => {
    const b = enemyAttack();
    b.activeFighter('player').hp = 1;
    const r = stepUntil(b, (e) => ofType(e, 'ko', 'player').length > 0);
    expect(ofType(r.events, 'fighter_enter', 'player')[0].slot).toBe(1);
    expect(b.freezes.map((f) => f.kind)).toContain('ko');
    expect(b.teams.player.burst).toBeGreaterThanOrEqual(15);
    stepUntil(b, () => b.getState().freeze === null, 200);
    const s = b.getState();
    expect(s.teams.player.activeSlot).toBe(1);
    expect(s.teams.player.tagCooldownTicks).toBe(0);
    expect(s.teams.player.tagReady).toBe(true);
    expect(s.teams.player.fighters[1].invulnerable).toBe(true);
    // KO'd fighters cannot be tagged in
    const evs = step(b, [{ type: 'tag', slot: 0 }]);
    expect(ofType(evs, 'input_rejected', 'player')[0].reason).toBe('target');
  });
  it('AC-5.8.4: a tag-in during the enemy\'s hitstun produces one Tag Strike hit', () => {
    const b = scriptedBattle(); setClose(b);
    b.teams.player.tagReadyAt = 0;
    giveCard(b, 'player', 0, JAB);
    step(b, [{ type: 'card', slot: 0 }]);
    stepUntil(b, (e) => ofType(e, 'link_open', 'player').length > 0);
    stepUntil(b, () => b.getState().freeze === null, 10);
    expect(b.activeFighter('enemy').state).toBe('Hitstun');
    const evs = step(b, [{ type: 'tag', slot: 1 }]);
    expect(ofType(evs, 'tag_strike', 'player')).toHaveLength(1);
    const all = stepTicks(b, 30);
    const strikes = ofType(all, 'hit', 'player').filter((h) => h.cardId === 'tag_strike');
    expect(strikes).toHaveLength(1);
    expect(strikes[0].chainIndex).toBe(2); // counts as a card in the chain
  });
  it('the incoming fighter is invulnerable for invuln_s (30 ticks) after a Tag', () => {
    const b = scriptedBattle();
    b.teams.player.tagReadyAt = 0;
    step(b, [{ type: 'tag', slot: 1 }]);
    const f = b.activeFighter('player');
    expect(f.invulnUntil - (b.tick - 1)).toBe(30);
  });
});
