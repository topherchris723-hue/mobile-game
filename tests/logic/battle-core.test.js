// Battle engine: GDD §5.0–§5.5 acceptance criteria.
import { describe, it, expect } from 'vitest';
import { Deck, expandDeck } from '../../src/logic/deck.js';
import { SeededRng } from '../../src/logic/rng.js';
import { readJson } from '../helpers/load-data.js';
import {
  scriptedBattle, giveCard, setVigor, vigor, setClose, step, stepUntil, stepTicks, ofType,
} from '../helpers/battle-helpers.js';

const JAB = 'card_tavi_spark_jab';             // fist, melee, windup 0.12 (7 ticks), 2 hits
const FLARE = 'card_tavi_flare_toss';          // bolt, projectile, 3 hits
const FURNACE = 'card_tavi_furnace_rush';      // signature, no armor, windup 0.30 (18 ticks)
const CLIMAX = 'card_tavi_wildfire_crash';     // climax, armor, cinematic 2.5 s

describe('§5.1 arena and distance', () => {
  it('AC-5.1.1: from distance 40 one forward dash leaves 20; two dashes leave 8 (clamped), not 0', () => {
    const b = scriptedBattle();
    expect(b.distance()).toBe(40);
    step(b, [{ type: 'dash', dir: 'forward' }]);
    stepUntil(b, () => b.activeFighter('player').state === 'Idle');
    expect(b.distance()).toBe(20);
    step(b, [{ type: 'dash', dir: 'forward' }]);
    stepUntil(b, () => b.activeFighter('player').state === 'Idle');
    expect(b.distance()).toBe(8);
  });
  it('a dash takes dash_time_s = 12 ticks and a back dash is clamped by the wall', () => {
    const b = scriptedBattle();
    b.teams.player.x = 5;
    const t0 = b.tick;
    step(b, [{ type: 'dash', dir: 'back' }]);
    stepUntil(b, () => b.activeFighter('player').state === 'Idle');
    expect(b.tick - t0).toBe(13); // tap tick + 12 movement ticks
    expect(b.teams.player.x).toBe(0);
  });
  it('AC-5.1.2: a Fist played at distance 40 lands its first hit 11 + windup ticks after the tap', () => {
    const b = scriptedBattle();
    giveCard(b, 'player', 0, JAB);
    const windupTicks = Math.round(0.12 * 60);
    const tap = b.tick;
    step(b, [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (evs) => ofType(evs, 'hit', 'player').length > 0);
    const hit = ofType(r.events, 'hit', 'player')[0];
    expect(hit.tick - tap).toBe(11 + windupTicks);
    expect(b.distance()).toBeGreaterThanOrEqual(12); // arrived at melee range, then knockback
  });
  it('an approach that does not reach melee range before approach_timeout_s whiffs into Recovery', () => {
    // With default data an approach always arrives in time (max 88 units / 2.5 per tick = 36 ticks),
    // so this uses a shorter timeout (0.1 s = 6 ticks) to prove the timeout path.
    const b = scriptedBattle({ mutateBattle: (bj) => { bj.arena.approach_timeout_s = 0.1; } });
    giveCard(b, 'player', 0, JAB);
    const tap = b.tick;
    step(b, [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (evs) => ofType(evs, 'whiff', 'player').length > 0, 30);
    const whiff = ofType(r.events, 'whiff', 'player')[0];
    expect(whiff.reason).toBe('approach_timeout');
    expect(whiff.tick - tap).toBe(6);
    expect(ofType(r.all, 'hit')).toHaveLength(0);
    expect(b.activeFighter('player').state).toBe('Recovery');
    expect(b.activeFighter('player').linkWindow).toBe(false);
  });
});

describe('§5.3 Vigor', () => {
  it('AC-5.3.1: with no actions and no freezes, Vigor goes 5.0 → 10.0 in exactly 300 ticks and stays at 10.0', () => {
    const b = scriptedBattle();
    expect(vigor(b, 'player')).toBe(5);
    stepTicks(b, 299);
    expect(vigor(b, 'player')).toBeLessThan(10);
    stepTicks(b, 1);
    expect(vigor(b, 'player')).toBe(10);
    stepTicks(b, 200);
    expect(vigor(b, 'player')).toBe(10);
  });
  it('AC-5.3.2: a card or Slip costing more than current Vigor does nothing and spends nothing', () => {
    const b = scriptedBattle({ live: true });
    giveCard(b, 'player', 0, JAB);
    setVigor(b, 'player', 1.98);
    const evs = step(b, [{ type: 'card', slot: 0 }]);
    expect(ofType(evs, 'card_played')).toHaveLength(0);
    expect(ofType(evs, 'input_rejected', 'player')[0].reason).toBe('vigor');
    expect(b.activeFighter('player').deck.hand[0]).toBe(JAB);
    expect(vigor(b, 'player')).toBeCloseTo(1.98 + 1 / 60, 9);
    setVigor(b, 'player', 1.5);
    const evs2 = step(b, [{ type: 'slip' }]);
    expect(ofType(evs2, 'slip')).toHaveLength(0);
    expect(b.activeFighter('player').state).toBe('Idle');
  });
  it('§5.3 edge: a cost-2 card lights up on the tick Vigor reaches 2.0', () => {
    const b = scriptedBattle();
    giveCard(b, 'player', 0, JAB);
    setVigor(b, 'player', 1.98);
    step(b);
    expect(b.getState().teams.player.fighters[0].hand[0].affordable).toBe(false);
    step(b); // 1.98 + 2/60 ≥ 2.0
    expect(b.getState().teams.player.fighters[0].hand[0].affordable).toBe(true);
  });
  it('§5.3 example: Fist at t=0 → 3.0; at t=2.0 s Vigor is 5.0; Signature (cost 5) → 0.0', () => {
    const b = scriptedBattle();
    giveCard(b, 'player', 0, JAB);
    b.teams.enemy.x = 100; b.teams.player.x = 0; // keep the fist busy approaching; nothing hits
    b.step({ player: [{ type: 'card', slot: 0 }] });
    // after the tap tick: 5 − 2 + 1/60
    expect(vigor(b, 'player')).toBeCloseTo(3 + 1 / 60, 9);
    stepTicks(b, 119);
    expect(vigor(b, 'player')).toBeCloseTo(5, 9);
  });
  it('AC-5.3.3: Vigor does not change during a Climax cinematic', () => {
    const b = scriptedBattle({ live: true });
    setClose(b);
    giveCard(b, 'player', 0, CLIMAX);
    setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 0 }]);
    stepUntil(b, (evs) => ofType(evs, 'climax_cinematic').length > 0);
    expect(b.getState().freeze.kind).toBe('climax');
    const vp = b.teams.player.vigor;
    const ve = b.teams.enemy.vigor;
    const tick = b.tick;
    const timer = b.getState().timer.ticksLeft;
    for (let i = 0; i < 100; i++) step(b);
    expect(b.teams.player.vigor).toBe(vp);
    expect(b.teams.enemy.vigor).toBe(ve);
    expect(b.tick).toBe(tick);
    expect(b.getState().timer.ticksLeft).toBe(timer);
  });
});

describe('§5.4 cards and the hand', () => {
  it('AC-5.4.1: after a card is played its slot shows the next card exactly 90 ticks later', () => {
    const b = scriptedBattle();
    b.teams.enemy.x = 100; b.teams.player.x = 0;
    const tap = b.tick;
    step(b, [{ type: 'card', slot: 2 }]);
    expect(b.activeFighter('player').deck.hand[2]).toBeNull();
    const r = stepUntil(b, (evs) => ofType(evs, 'card_drawn', 'player').some((e) => e.slot === 0 && e.handSlot === 2));
    const drawn = ofType(r.events, 'card_drawn', 'player')[0];
    expect(drawn.tick - tap).toBe(90);
    expect(b.activeFighter('player').deck.hand[2]).not.toBeNull();
  });
  it('AC-5.4.2: over 1,000 seeded draws no card is in the hand more times than its copy count', () => {
    const chars = readJson('data/characters.json').characters;
    for (const ch of chars) {
      const copies = {};
      for (const e of ch.deck) copies[e.card_id] = e.count;
      const deck = new Deck(4);
      const rng = new SeededRng(99);
      deck.reset(expandDeck(ch.deck), rng);
      let now = 0;
      let draws = 0;
      while (draws < 1000) {
        const slot = rng.nextInt(4);
        if (deck.hand[slot] !== null) deck.play(slot, now, 3);
        now += 1;
        draws += deck.update(now, rng).length;
        for (const id of Object.keys(copies)) expect(deck.countInHand(id)).toBeLessThanOrEqual(copies[id]);
        // a card in the hand is never in the discard pile
        const total = deck.hand.filter((c) => c !== null).length + deck.draw.length + deck.discard.length;
        expect(total).toBe(expandDeck(ch.deck).length);
      }
    }
  });
  it('§5.4 edge: with draw and discard both empty, a slot waits and retries every tick', () => {
    const deck = new Deck(4);
    const rng = new SeededRng(1);
    deck.reset(['a', 'b', 'c', 'd'], rng);
    deck.play(0, 0, 1);
    deck.discard = []; // simulate nothing left anywhere
    expect(deck.update(5, rng)).toEqual([]);
    deck.discard.push('a');
    expect(deck.update(6, rng)).toEqual([0]);
  });
  it('AC-5.4.3: a benched fighter with 2 empty slots has a full hand when it tags in 1.5 s later', () => {
    const b = scriptedBattle();
    const benched = b.teams.player.fighters[1];
    benched.deck.play(0, b.tick, 90);
    benched.deck.play(1, b.tick, 90);
    stepTicks(b, 90);
    b.teams.player.tagReadyAt = 0;
    step(b, [{ type: 'tag', slot: 1 }]);
    expect(b.activeFighter('player')).toBe(benched);
    expect(benched.deck.hand.every((c) => c !== null)).toBe(true);
  });
  it('battle start: each fighter has drawn 4 cards from a seeded shuffle', () => {
    const b = scriptedBattle();
    for (const side of ['player', 'enemy']) for (const f of b.teams[side].fighters) expect(f.deck.hand.every((c) => c !== null)).toBe(true);
  });
});

describe('§5.5 attacks, hits and hitstun', () => {
  /** Run a fresh scenario and return the tick of the player's first Flare Toss hit (live data: AC-5.5.1 is P-class). */
  function flareFirstHitTick() {
    const b = scriptedBattle({ live: true });
    giveCard(b, 'player', 0, FLARE);
    step(b, [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (evs) => ofType(evs, 'hit', 'player').length > 0);
    return ofType(r.events, 'hit', 'player')[0].tick;
  }
  it('projectile travel: distance 40, speed 160 → first hit 15 ticks after the windup ends', () => {
    const b = scriptedBattle();
    giveCard(b, 'player', 0, FLARE);
    const tap = b.tick;
    step(b, [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (evs) => ofType(evs, 'hit', 'player').length > 0);
    expect(ofType(r.events, 'hit', 'player')[0].tick - tap).toBe(Math.round(0.25 * 60) + 15);
  });
  it('AC-5.5.1: a 3-hit card whose first hit is dodged deals 0 damage on all 3 hits (even hits after the i-frames)', () => {
    const th = flareFirstHitTick();
    const b = scriptedBattle({ live: true });
    giveCard(b, 'player', 0, FLARE);
    const hp = b.activeFighter('enemy').hp;
    step(b, [{ type: 'card', slot: 0 }]);
    const all = [];
    // slip 15 ticks before the first hit: i-frames cover th, but not th+12 (the 3rd hit)
    while (b.tick < th - 15) for (const e of step(b)) all.push(e);
    for (const e of step(b, [], [{ type: 'slip' }])) all.push(e);
    for (const e of stepTicks(b, 40)) all.push(e);
    expect(ofType(all, 'hit', 'player')).toHaveLength(0);
    expect(ofType(all, 'whiff', 'player')).toHaveLength(1);
    expect(b.activeFighter('enemy').hp).toBe(hp);
  });
  it('AC-5.5.2: a non-armor Signature hit during its windup is cancelled and its Vigor is not refunded', () => {
    const b = scriptedBattle({ live: true });
    setClose(b);
    giveCard(b, 'enemy', 0, FURNACE);
    giveCard(b, 'player', 0, JAB);
    setVigor(b, 'enemy', 6);
    const evs = step(b, [{ type: 'card', slot: 0 }], [{ type: 'card', slot: 0 }]);
    expect(ofType(evs, 'card_played')).toHaveLength(2);
    const r = stepUntil(b, (e) => ofType(e, 'interrupt', 'enemy').length > 0);
    const enemy = b.activeFighter('enemy');
    expect(enemy.action).toBeNull();
    expect(enemy.state).toBe('Hitstun');
    // 6 − 4 + regen only; never +4 back
    expect(vigor(b, 'enemy')).toBeCloseTo(2 + (b.tick) / 60, 9);
    const later = stepTicks(b, 60).concat(r.all);
    expect(ofType(later, 'hit', 'enemy')).toHaveLength(0);
  });
  it('AC-5.5.3: a Climax hit during its windup is not cancelled (it takes the damage and keeps going)', () => {
    const b = scriptedBattle({ live: true });
    setClose(b);
    giveCard(b, 'enemy', 0, 'card_rook_endgame_storm');
    giveCard(b, 'player', 0, JAB);
    setVigor(b, 'enemy', 10);
    const hp0 = b.activeFighter('enemy').hp;
    step(b, [{ type: 'card', slot: 0 }], [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (e) => ofType(e, 'hit', 'player').length > 0);
    const enemy = b.activeFighter('enemy');
    expect(enemy.hp).toBeLessThan(hp0);
    expect(ofType(r.all, 'interrupt')).toHaveLength(0);
    expect(enemy.action).not.toBeNull();
    expect(enemy.state).toBe('Windup');
    const r2 = stepUntil(b, (e) => ofType(e, 'hit', 'enemy').length > 0);
    expect(ofType(r2.events, 'hit', 'enemy').length).toBe(b.card('card_rook_endgame_storm').hits);
  });
  it('AC-5.5.4: two attacks landing on the same tick both deal damage and both fighters enter hitstun', () => {
    const b = scriptedBattle({ live: true });
    setClose(b);
    giveCard(b, 'player', 0, JAB);
    giveCard(b, 'enemy', 0, 'card_rook_one_two_count');
    const p0 = b.activeFighter('player').hp;
    const e0 = b.activeFighter('enemy').hp;
    expect(b.card('card_rook_one_two_count').windup_s).toBeCloseTo(b.card(JAB).windup_s, 1);
    // make the windups identical so both first hits land on the same tick
    const r0 = b.card('card_rook_one_two_count');
    const saved = r0.windup_s;
    r0.windup_s = b.card(JAB).windup_s;
    step(b, [{ type: 'card', slot: 0 }], [{ type: 'card', slot: 0 }]);
    const r = stepUntil(b, (e) => ofType(e, 'hit').length > 0);
    r0.windup_s = saved;
    expect(ofType(r.events, 'hit', 'player')).toHaveLength(1);
    expect(ofType(r.events, 'hit', 'enemy')).toHaveLength(1);
    expect(b.activeFighter('player').hp).toBeLessThan(p0);
    expect(b.activeFighter('enemy').hp).toBeLessThan(e0);
    expect(b.activeFighter('player').state).toBe('Hitstun');
    expect(b.activeFighter('enemy').state).toBe('Hitstun');
  });
  it('§5.5 hitstop: a landed Fist hit freezes the battle for hitstop_s.fist and the tick does not advance', () => {
    const b = scriptedBattle();
    setClose(b);
    giveCard(b, 'player', 0, JAB);
    step(b, [{ type: 'card', slot: 0 }]);
    stepUntil(b, (e) => ofType(e, 'hit', 'player').length > 0);
    const s = b.getState();
    expect(s.freeze.kind).toBe('hitstop');
    expect(s.freeze.ticksLeft).toBe(Math.round(0.04 * 60));
    const t = b.tick;
    step(b); step(b);
    expect(b.tick).toBe(t);
    step(b);
    expect(b.tick).toBe(t + 1);
  });
  it('AC-5.1.3: during AI battles no fighter x ever leaves [0, 100]', async () => {
    const { createBattle, createContent } = await import('../../src/logic/index.js');
    const { loadBundle } = await import('../helpers/load-data.js');
    const content = createContent(loadBundle());
    for (let seed = 1; seed <= 20; seed++) {
      const b = createBattle({ content, stageId: 'stage_004', playerTeam: ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'], playerController: { aiTier: 'master' }, skipIntro: true }, seed);
      while (!b.getResult()) {
        b.step();
        expect(b.teams.player.x).toBeGreaterThanOrEqual(0);
        expect(b.teams.enemy.x).toBeLessThanOrEqual(100);
        expect(b.teams.player.x).toBeLessThanOrEqual(b.teams.enemy.x);
      }
    }
  });
});
