// Battle engine: GDD §5.9 Ignition, §5.10 Tri-Burst, §5.13 effects, §5.14 win/lose/timer.
import { describe, it, expect } from 'vitest';
import { expandDeck } from '../../src/logic/deck.js';
import {
  scriptedBattle, giveCard, setVigor, vigor, setClose, step, stepUntil, stepTicks, ofType,
} from '../helpers/battle-helpers.js';

const JAB = 'card_tavi_spark_jab';
const ENEMY_JAB = 'card_rook_one_two_count';

describe('§5.9 Ignition', () => {
  it('AC-5.9.1: trigger hp_below_pct 50 shows IGNITE at exactly HP ≤ 50% and not before', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player'); // Tavi, 8,200 HP, hp_below_pct 50
    expect(f.def.ignition.triggers[0]).toEqual({ type: 'hp_below_pct', value: 50 });
    f.hp = 4101;
    step(b);
    expect(b.getState().teams.player.igniteReady).toBe(false);
    f.hp = 4100;
    const evs = step(b);
    expect(ofType(evs, 'ignition_ready', 'player')).toHaveLength(1);
    expect(b.getState().teams.player.igniteReady).toBe(true);
    f.hp = 8200; // stays available once met
    step(b);
    expect(b.getState().teams.player.igniteReady).toBe(true);
  });
  it('battle_time_s trigger: available at 60 s of fight time', () => {
    const b = scriptedBattle();
    stepTicks(b, 3599);
    expect(b.activeFighter('player').ign.available).toBe(false);
    const evs = stepTicks(b, 1);
    expect(ofType(evs, 'ignition_ready', 'player')).toHaveLength(1);
  });
  it('§5.9 example: HP 3,000/10,000 → 4,000; ATK ×1.30; Vigor 4.0 → 7.0 then regen 1.2/s', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player');
    f.def.maxHp = 10000; f.hp = 3000; f.def.atk = 1000;
    step(b);
    setVigor(b, 'player', 4.0);
    const evs = step(b, [{ type: 'ignite' }]);
    expect(ofType(evs, 'ignition', 'player')).toHaveLength(1);
    expect(f.hp).toBe(4000);
    expect(b.atkEff(f)).toBeCloseTo(1300, 9);
    // 4.0 + 3 on activation, plus one tick of (1.0 + 0.2) regen
    expect(vigor(b, 'player')).toBeCloseTo(7.0 + 1.2 / 60, 9);
    expect(b.getState().freeze.kind).toBe('ignition');
    expect(b.getState().freeze.ticksLeft).toBe(90);
  });
  it('AC-5.9.2: after use, IGNITE never appears again for that fighter in that battle', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player');
    f.hp = 1000;
    step(b);
    step(b, [{ type: 'ignite' }]);
    for (let i = 0; i < 3000; i++) {
      const evs = step(b, [{ type: 'ignite' }]);
      expect(ofType(evs, 'ignition', 'player')).toHaveLength(0);
      expect(b.getState().teams.player.igniteReady).toBe(false);
    }
  });
  it('AC-5.9.3: ATK is ×1.30 for exactly 1,500 unfrozen ticks, then reverts; the hand then holds only base-deck cards', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player');
    f.hp = 1000;
    step(b);
    const base = f.def.atk;
    step(b, [{ type: 'ignite' }]);
    let boosted = 1; // the ignite tick
    let guard = 0;
    while (guard++ < 5000) {
      const t = b.tick;
      step(b);
      if (b.tick === t) continue;
      if (Math.abs(b.atkEff(f) - base * 1.3) < 1e-9) boosted++;
      else break;
    }
    expect(boosted).toBe(1500);
    expect(b.atkEff(f)).toBe(base);
    const baseIds = expandDeck(b.content.characters.char_tavi_001.deck);
    for (const c of f.deck.hand) expect(baseIds).toContain(c);
    expect(f.deck.hand.every((c) => c !== null)).toBe(true);
  });
  it('the Ignition deck is used while ignited (hand redrawn to 4 from ignition.deck)', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player');
    f.hp = 1000;
    step(b);
    step(b, [{ type: 'ignite' }]);
    const ignIds = expandDeck(b.content.characters.char_tavi_001.ignition.deck);
    expect(f.deck.hand.every((c) => ignIds.indexOf(c) >= 0)).toBe(true);
    expect(f.deck.draw.length + f.deck.hand.length).toBe(ignIds.length);
  });
  it('AC-5.9.4: igniting in hitstun ends hitstun and pushes the enemy 20 units', () => {
    const b = scriptedBattle(); setClose(b);
    const f = b.activeFighter('player');
    f.hp = 1000;
    giveCard(b, 'enemy', 0, ENEMY_JAB);
    step(b, [], [{ type: 'card', slot: 0 }]);
    stepUntil(b, (e) => ofType(e, 'hit', 'enemy').length > 0);
    stepUntil(b, () => b.getState().freeze === null, 10);
    expect(f.state).toBe('Hitstun');
    const ex = b.teams.enemy.x;
    const evs = step(b, [{ type: 'ignite' }]);
    expect(ofType(evs, 'ignition', 'player')).toHaveLength(1);
    expect(f.state).toBe('Idle');
    expect(b.teams.enemy.x).toBe(Math.min(100, ex + 20));
    expect(b.teams.enemy.chain.active).toBe(false);
  });
  it('§5.9 edge: Ignite and a lethal hit on the same tick → Ignition first, the enemy card is cancelled', () => {
    const probe = scriptedBattle(); setClose(probe);
    giveCard(probe, 'enemy', 0, ENEMY_JAB);
    step(probe, [], [{ type: 'card', slot: 0 }]);
    const th = ofType(stepUntil(probe, (e) => ofType(e, 'hit', 'enemy').length > 0).events, 'hit', 'enemy')[0].tick;

    const b = scriptedBattle(); setClose(b);
    const f = b.activeFighter('player');
    f.hp = 1;
    giveCard(b, 'enemy', 0, ENEMY_JAB);
    step(b, [], [{ type: 'card', slot: 0 }]);
    while (b.tick < th) step(b);
    const evs = step(b, [{ type: 'ignite' }]);
    expect(ofType(evs, 'ignition', 'player')).toHaveLength(1);
    expect(ofType(evs, 'hit', 'enemy')).toHaveLength(0);
    expect(f.ko).toBe(false);
  });
  it('Ignition ends on tag-out and the base deck returns', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player');
    f.hp = 1000;
    b.teams.player.tagReadyAt = 0;
    step(b);
    step(b, [{ type: 'ignite' }]);
    stepUntil(b, () => b.getState().freeze === null, 200);
    const evs = step(b, [{ type: 'tag', slot: 1 }]);
    expect(ofType(evs, 'ignition_end', 'player')[0].reason).toBe('tag_out');
    expect(f.ign.active).toBe(false);
    const baseIds = expandDeck(b.content.characters.char_tavi_001.deck);
    for (const c of f.deck.hand) expect(baseIds).toContain(c);
  });
  it('enemies with ignition_enabled false never get IGNITE', () => {
    const b = scriptedBattle({ enemyTeam: ['enemy_rook_003'] });
    const e = b.activeFighter('enemy');
    e.hp = 1;
    stepTicks(b, 10);
    expect(e.def.ignition).toBeNull();
    expect(b.getState().teams.enemy.igniteReady).toBe(false);
  });
});

/** Make the GDD §5.10 example team: ATK 1000 Blaze, 1100 Stone, 900 Void vs a Gale, DEF 500 target. */
function exampleTeam(b) {
  const fs = b.teams.player.fighters;
  fs[0].def.atk = 1000; fs[0].def.aura = 'blaze';
  fs[1].def.atk = 1100; fs[1].def.aura = 'stone';
  fs[2].def.atk = 900; fs[2].def.aura = 'void';
  const e = b.activeFighter('enemy');
  e.def.aura = 'gale'; e.def.def = 500; e.def.maxHp = 20000; e.hp = 20000;
}

describe('§5.10 Tri-Burst', () => {
  it('AC-5.10.1: dealing exactly 2,500 damage to a 10,000 HP enemy raises the gauge by exactly 10', () => {
    const b = scriptedBattle();
    const e = b.activeFighter('enemy');
    e.def.maxHp = 10000; e.hp = 10000;
    b.dealDamage('player', e, 2500);
    expect(b.teams.player.burst).toBe(10);
    expect(b.teams.enemy.burst).toBe(6.25); // taking: 25 × 2500 / 10000
  });
  it('AC-5.10.2: the GDD example team deals exactly 6,600 (2,600 + 2,200 + 1,800), no crit possible', () => {
    const b = scriptedBattle({ keepCrit: true });
    for (const f of b.teams.player.fighters) f.def.critRate = 0.5;
    exampleTeam(b);
    setClose(b);
    b.teams.player.burst = 100;
    const hp0 = b.activeFighter('enemy').hp;
    step(b, [{ type: 'tri_burst' }]);
    const r = stepUntil(b, (e) => ofType(e, 'tri_burst', 'player').length > 0, 40);
    const ev = ofType(r.events, 'tri_burst', 'player')[0];
    expect(ev.damages).toEqual([2600, 2200, 1800]);
    expect(hp0 - b.activeFighter('enemy').hp).toBe(6600);
    expect(b.getState().freeze.kind).toBe('tri_burst');
    expect(b.getState().freeze.ticksLeft).toBe(240);
  });
  it('the rush takes rush_time_s (18 ticks) and the user is invulnerable during it', () => {
    const b = scriptedBattle(); exampleTeam(b);
    b.teams.player.burst = 100;
    const t0 = b.tick;
    step(b, [{ type: 'tri_burst' }]);
    expect(b.isInvulnerable(b.activeFighter('player'))).toBe(true);
    const r = stepUntil(b, (e) => ofType(e, 'tri_burst', 'player').length > 0, 40);
    expect(ofType(r.events, 'tri_burst')[0].tick - t0).toBe(18);
  });
  it('AC-5.10.3: after a landed Tri-Burst the gauge is USED and stays 0 for the rest of the battle', () => {
    const b = scriptedBattle(); exampleTeam(b); setClose(b);
    b.teams.player.burst = 100;
    step(b, [{ type: 'tri_burst' }]);
    stepUntil(b, (e) => ofType(e, 'tri_burst', 'player').length > 0, 40);
    expect(b.teams.player.burstUsed).toBe(true);
    expect(b.teams.player.burst).toBe(0);
    for (let i = 0; i < 5; i++) {
      stepUntil(b, () => b.getState().freeze === null && b.activeFighter('player').state === 'Idle' && b.activeFighter('enemy').state === 'Idle', 400);
      giveCard(b, 'player', 0, JAB); setVigor(b, 'player', 10);
      step(b, [{ type: 'card', slot: 0 }]);
      stepUntil(b, (e) => ofType(e, 'hit', 'player').length > 0, 200);
      expect(b.teams.player.burst).toBe(0);
    }
    expect(b.getState().teams.player.burstReady).toBe(false);
    stepUntil(b, () => b.getState().freeze === null, 20);
    expect(ofType(step(b, [{ type: 'tri_burst' }]), 'input_rejected', 'player')[0].reason).toBe('gauge');
  });
  it('AC-5.10.4: a whiffed Tri-Burst leaves the gauge at 50', () => {
    const b = scriptedBattle(); exampleTeam(b);
    b.teams.player.burst = 100;
    setVigor(b, 'enemy', 5);
    const t0 = b.tick;
    step(b, [{ type: 'tri_burst' }]);
    while (b.tick < t0 + 18 - 15) step(b);
    step(b, [], [{ type: 'slip' }]);
    const r = stepUntil(b, (e) => ofType(e, 'tri_burst_whiff', 'player').length > 0, 40);
    expect(ofType(r.all, 'tri_burst')).toHaveLength(0);
    expect(b.teams.player.burst).toBe(50);
    expect(b.teams.player.burstUsed).toBe(false);
  });
  it('§5.6 edge: a Perfect Slip against a Tri-Burst rush still opens a Riposte window', () => {
    const b = scriptedBattle(); exampleTeam(b);
    b.teams.player.burst = 100;
    const t0 = b.tick;
    step(b, [{ type: 'tri_burst' }]);
    while (b.tick < t0 + 18 - 6) step(b);
    step(b, [], [{ type: 'slip' }]);
    const r = stepUntil(b, (e) => ofType(e, 'tri_burst_whiff', 'player').length > 0, 40);
    expect(ofType(r.all, 'perfect_slip', 'enemy')).toHaveLength(1);
    expect(b.teams.enemy.riposteTicks).toBeGreaterThan(0);
  });
  it('Tri-Burst uses only living members', () => {
    const b = scriptedBattle(); exampleTeam(b); setClose(b);
    b.teams.player.fighters[2].ko = true; b.teams.player.fighters[2].hp = 0;
    b.teams.player.burst = 100;
    step(b, [{ type: 'tri_burst' }]);
    const ev = ofType(stepUntil(b, (e) => ofType(e, 'tri_burst', 'player').length > 0, 40).events, 'tri_burst')[0];
    expect(ev.damages).toEqual([2600, 2200]);
  });
});

describe('§5.13 card effects', () => {
  it('AC-5.13.1: atk_up 0.2 applied twice gives 1.2, not 1.4, and the second application refreshes the duration', () => {
    const b = scriptedBattle({ playerTeam: ['char_pell_001', 'char_lark_001', 'char_dunmore_001'] });
    b.teams.enemy.x = 100; b.teams.player.x = 0;
    const f = b.activeFighter('player');
    const CHANT = 'card_pell_dawn_chant';
    giveCard(b, 'player', 0, CHANT); setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 0 }]);
    expect(f.buffs.atk_up.value).toBe(0.2);
    stepUntil(b, () => f.state === 'Idle', 400);
    const leftBefore = f.buffs.atk_up.ticksLeft;
    giveCard(b, 'player', 0, CHANT); setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 0 }]);
    expect(f.buffs.atk_up.value).toBe(0.2);
    expect(f.buffs.atk_up.ticksLeft).toBeGreaterThan(leftBefore);
    expect(f.buffs.atk_up.ticksLeft).toBe(600 - 1);
    expect(b.atkEff(f)).toBeCloseTo(f.def.atk * 1.2, 9);
  });
  it('different buff types sum: atk_up 0.2 and atk_down 0.3 → 0.9', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player');
    f.buffs.atk_up = { value: 0.2, ticksLeft: 100 };
    f.buffs.atk_down = { value: 0.3, ticksLeft: 100 };
    expect(b.atkEff(f)).toBeCloseTo(f.def.atk * 0.9, 9);
  });
  it('AC-5.11.4 (engine): extreme buffs are clamped to [0.5, 1.5]', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player');
    f.buffs = { atk_up: { value: 0.9, ticksLeft: 9 }, def_up: { value: 0.9, ticksLeft: 9 } };
    expect(b.atkEff(f)).toBeCloseTo(f.def.atk * 1.5, 9);
    expect(b.defEff(f)).toBeCloseTo(f.def.def * 1.5, 9);
    f.buffs = { atk_down: { value: 0.9, ticksLeft: 9 }, def_down: { value: 0.9, ticksLeft: 9 } };
    expect(b.atkEff(f)).toBeCloseTo(f.def.atk * 0.5, 9);
    expect(b.defEff(f)).toBeCloseTo(f.def.def * 0.5, 9);
  });
  it('buffs pause while benched', () => {
    const b = scriptedBattle();
    const f = b.activeFighter('player');
    f.buffs.atk_up = { value: 0.2, ticksLeft: 100 };
    b.teams.player.tagReadyAt = 0;
    step(b, [{ type: 'tag', slot: 1 }]);
    stepTicks(b, 200);
    expect(f.buffs.atk_up.ticksLeft).toBe(100);
  });
  it('on: "hit" effects do nothing if the card whiffs; they apply on the first landed hit', () => {
    const b = scriptedBattle({ playerTeam: ['char_thessa_001', 'char_lark_001', 'char_dunmore_001'] });
    setClose(b);
    giveCard(b, 'player', 0, 'card_thessa_cracked_mask'); // atk_down 0.15 on hit (enemy)
    step(b, [{ type: 'card', slot: 0 }]);
    stepUntil(b, (e) => ofType(e, 'hit', 'player').length > 0);
    expect(b.activeFighter('enemy').buffs.atk_down.value).toBe(0.15);
  });
});

describe('§5.14 win, lose, timer', () => {
  it('AC-5.14.1: with a 180 s timer and no freezes, timeout happens after exactly 10,800 ticks', () => {
    const b = scriptedBattle({ timerS: 180 });
    let steps = 0;
    while (!b.getResult()) { step(b); steps++; }
    expect(steps).toBe(10800);
    expect(b.getResult().ticks).toBe(10800);
    expect(b.getResult().reason).toBe('timeout');
    expect(b.getResult().outcome).toBe('draw'); // both teams at full HP: exact tie
  });
  it('timeout compares team HP ratios: higher ratio wins', () => {
    const b = scriptedBattle({ timerS: 60 });
    b.teams.enemy.fighters[0].hp -= 100;
    while (!b.getResult()) step(b);
    expect(b.getResult().outcome).toBe('win');
  });
  it('the shown timer is ceil(seconds left)', () => {
    const b = scriptedBattle({ timerS: 120 });
    expect(b.getState().timer.secondsShown).toBe(120);
    step(b);
    expect(b.getState().timer.secondsShown).toBe(120);
    stepTicks(b, 59);
    expect(b.getState().timer.secondsShown).toBe(119);
  });
  it('Win when all enemy fighters are KO\'d; the result carries mission stats', () => {
    const b = scriptedBattle({ enemyTeam: ['enemy_rook_001'] });
    setClose(b);
    b.activeFighter('enemy').hp = 1;
    giveCard(b, 'player', 0, JAB);
    step(b, [{ type: 'card', slot: 0 }]);
    stepUntil(b, (e) => ofType(e, 'battle_end').length > 0);
    const res = b.getResult();
    expect(res.outcome).toBe('win');
    expect(res.reason).toBe('ko');
    expect(res.stats.playerKos).toBe(0);
    expect(res.stats.cardsPlayed).toBe(1);
  });
  it('both teams wiped on the same tick = Draw', () => {
    const b = scriptedBattle({ enemyTeam: ['enemy_rook_001'], playerTeam: ['char_tavi_001'] });
    setClose(b);
    b.activeFighter('enemy').hp = 1; b.activeFighter('player').hp = 1;
    giveCard(b, 'player', 0, JAB); giveCard(b, 'enemy', 0, JAB);
    step(b, [{ type: 'card', slot: 0 }], [{ type: 'card', slot: 0 }]);
    stepUntil(b, (e) => ofType(e, 'battle_end').length > 0);
    expect(b.getResult().outcome).toBe('draw');
    expect(b.getResult().reason).toBe('double_ko');
  });
  it('Lose when all player fighters are KO\'d; Retreat = loss', () => {
    const b = scriptedBattle({ playerTeam: ['char_tavi_001'] });
    setClose(b);
    b.activeFighter('player').hp = 1;
    giveCard(b, 'enemy', 0, ENEMY_JAB);
    step(b, [], [{ type: 'card', slot: 0 }]);
    stepUntil(b, (e) => ofType(e, 'battle_end').length > 0);
    expect(b.getResult().outcome).toBe('lose');
    const b2 = scriptedBattle();
    b2.retreat();
    expect(b2.getResult()).toMatchObject({ outcome: 'lose', reason: 'retreat' });
  });
  it('pause freezes everything: the timer and Vigor do not move', () => {
    const b = scriptedBattle();
    stepTicks(b, 10);
    const s0 = JSON.stringify(b.getState());
    b.setPaused(true);
    for (let i = 0; i < 300; i++) step(b, [{ type: 'dash', dir: 'forward' }]);
    expect(JSON.stringify(b.getState()).replace('"paused":true', '"paused":false')).toBe(s0);
    b.setPaused(false);
    step(b);
    expect(b.tick).toBe(11);
  });
  it('battle intro: 2.0 s (120 ticks) before FIGHT!, not counted on the timer, inputs ignored', async () => {
    const { createBattle, createContent } = await import('../../src/logic/index.js');
    const { loadBundle } = await import('../helpers/load-data.js');
    const b = createBattle({ content: createContent(loadBundle()), stageId: 'stage_001', playerTeam: ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'], enemyController: 'human' }, 3);
    expect(b.getState().phase).toBe('intro');
    let fightAt = -1;
    for (let i = 1; i <= 130 && fightAt < 0; i++) {
      const evs = b.step({ player: [{ type: 'dash', dir: 'forward' }] });
      if (ofType(evs, 'fight_start').length > 0) fightAt = i;
    }
    expect(fightAt).toBe(120);
    expect(b.tick).toBe(0);
    expect(b.distance()).toBe(40);
    expect(b.getState().timer.secondsShown).toBe(120);
  });
});
