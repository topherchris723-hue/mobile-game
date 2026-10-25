// GDD §5.10 round 3 ruling: rush invulnerability is absolute. From step 1 of tick T through step 5 of T + 18 no hit
// of any source affects the rushing fighter (in-flight projectiles, later hits of a card whose first hit landed
// before T). Such a hit is logged `hit_discarded` (reason `rush_invulnerable`): 0 damage, no hitstun, no knockback,
// no Burst gain, no on-hit effects, no hitstop, not a dodge. Plus the event table: target KO'd during the rush →
// whiff on T + 18 (`invulnerable`, 50% refund); battle over during the rush → the rush is dropped with no event.
import { describe, it, expect } from 'vitest';
import {
  createBattle, createContent, BATTLE_EVENT_TYPES, HIT_DISCARD_REASONS, TRI_BURST_WHIFF_REASONS, WHIFF_REASONS,
} from '../../src/logic/index.js';
import { loadBundle } from '../helpers/load-data.js';
import {
  scriptedBattle, giveCard, setVigor, step, stepUntil, ofType,
} from '../helpers/battle-helpers.js';

const FX_BOLT = 'card_common_fxbolt';         // FX-GDD: bolt, projectile, 2 hits, interval 0.1 s (6 ticks), speed 160
const WILDFIRE = 'card_tavi_wildfire_crash';  // climax, armor, windup 0.7 s (42 ticks)
const FLARE = 'card_tavi_flare_toss';         // bolt, projectile, 3 hits, interval 6 ticks

/** Step until b.tick === t (the next step() runs tick t). */
function stepTo(b, t, all) {
  let guard = 0;
  while (b.tick < t) {
    for (const e of step(b)) if (all) all.push(e);
    if (++guard > 5000) throw new Error('stepTo guard');
  }
}

/**
 * AC-5.10.8 scenario (W, FX-GDD): the enemy 2-hit projectile Bolt's first hit lands on the armored player on T − 2
 * (no hitstun) and its second hit is due on T + 4; the player, at 1 HP, starts a Tri-Burst on T.
 */
function ac5108() {
  const b = scriptedBattle();
  b.teams.player.x = 30; b.teams.enemy.x = 70; // distance 40 → 15 ticks of flight
  giveCard(b, 'enemy', 0, FX_BOLT);
  giveCard(b, 'player', 0, WILDFIRE);
  setVigor(b, 'player', 10);
  setVigor(b, 'enemy', 10);
  const all = [];
  for (const e of step(b, [{ type: 'card', slot: 0 }], [{ type: 'card', slot: 0 }])) all.push(e);
  const r = stepUntil(b, (evs) => ofType(evs, 'hit', 'enemy').length > 0, 200);
  for (const e of r.all) all.push(e);
  const h1 = ofType(r.events, 'hit', 'enemy')[0];
  const p = b.activeFighter('player');
  const bolt = b.activeFighter('enemy').action;
  const T = h1.tick + 2;
  return { b, all, h1, p, bolt, T };
}

describe('§5.10 round 3: rush invulnerability is absolute', () => {
  it('the scenario is as the AC states: first hit on the armored player on T − 2 without hitstun, second hit due on T + 4', () => {
    const { p, bolt, T, h1 } = ac5108();
    expect(p.state).toBe('Windup'); // armored Climax windup, no hitstun
    expect(bolt.hitTicks).toEqual([h1.tick, h1.tick + 6]);
    expect(bolt.hitTicks[1]).toBe(T + 4);
  });

  it('AC-5.10.8: the second hit on T + 4 is hit_discarded (rush_invulnerable), HP stays 1, Burst unchanged by it, the rush resolves on T + 18', () => {
    const { b, all, p, T } = ac5108();
    stepTo(b, T, all);
    b.setIdle(p);          // test state: the armored windup is over and the player is Idle on T
    p.hp = 1;
    b.teams.player.burst = 100;
    for (const e of step(b, [{ type: 'tri_burst' }])) all.push(e);
    expect(ofType(all, 'tri_burst_start', 'player').map((e) => e.tick)).toEqual([T]);
    stepTo(b, T + 4, all);
    const enemyBurstBefore = b.teams.enemy.burst;
    const playerBurstBefore = b.teams.player.burst;
    const atT4 = step(b);
    for (const e of atT4) all.push(e);
    const disc = ofType(atT4, 'hit_discarded', 'enemy');
    expect(disc).toHaveLength(1);
    expect(disc[0]).toMatchObject({ tick: T + 4, cardId: FX_BOLT, reason: 'rush_invulnerable', hitIndex: 1, targetSlot: p.slot });
    expect(ofType(atT4, 'hit')).toHaveLength(0);
    expect(p.hp).toBe(1);
    expect(b.teams.enemy.burst).toBe(enemyBurstBefore);
    expect(b.teams.player.burst).toBe(playerBurstBefore);
    expect(b.freezes).toHaveLength(0); // no hitstop
    expect(p.action && p.action.kind).toBe('tri_burst');
    let guard = 0;
    while (!ofType(all, 'tri_burst').length && !ofType(all, 'tri_burst_whiff').length && guard++ < 100) for (const e of step(b)) all.push(e);
    const resolved = ofType(all, 'tri_burst', 'player').concat(ofType(all, 'tri_burst_whiff', 'player'));
    expect(resolved).toHaveLength(1);
    expect(resolved[0].tick).toBe(T + 18);
    expect(resolved[0].reason).not.toBe('safety_net');
    expect(ofType(all, 'ko', 'player')).toHaveLength(0);
  });

  it('a projectile in flight whose FIRST hit arrives during the rush is discarded and the card whiffs (rush_invulnerable; GDD round-3 ruling) — no dodge, no Perfect Slip, no Riposte window, its 2nd hit silent', () => {
    const b = scriptedBattle();
    b.teams.player.x = 0; b.teams.enemy.x = 100; // 100 units at 160/s → 38 ticks of flight
    giveCard(b, 'enemy', 0, FX_BOLT);
    setVigor(b, 'enemy', 10);
    step(b, [], [{ type: 'card', slot: 0 }]);
    stepUntil(b, () => b.activeFighter('enemy').action.phase === 'active', 40);
    const bolt = b.activeFighter('enemy').action;
    const first = bolt.hitTicks[0];
    stepTo(b, first - 10);
    b.teams.player.burst = 100;
    const all = [];
    for (const e of step(b, [{ type: 'tri_burst' }])) all.push(e);
    stepTo(b, first + 7, all);
    const disc = ofType(all, 'hit_discarded', 'enemy');
    expect(disc.map((e) => [e.tick, e.hitIndex, e.reason])).toEqual([[first, 0, 'rush_invulnerable']]);
    expect(ofType(all, 'whiff', 'enemy').map((e) => [e.tick, e.reason])).toEqual([[first, 'rush_invulnerable']]);
    expect(ofType(all, 'hit', 'enemy')).toHaveLength(0);
    expect(ofType(all, 'dodge')).toHaveLength(0);
    expect(ofType(all, 'perfect_slip')).toHaveLength(0);
    expect(b.teams.player.riposteTicks).toBe(0);
  });

  it('no on-hit effects and no Burst for either side from a discarded hit', () => {
    const { b, all, p, T } = ac5108();
    // Give the bolt an on-hit effect for this test copy only.
    const bolt = b.activeFighter('enemy').action;
    bolt.card = { ...bolt.card, effects: [{ type: 'atk_down', target: 'enemy', value: 0.2, on: 'hit', duration_s: 5 }, { type: 'burst_gain', target: 'self', value: 10, on: 'hit' }] };
    stepTo(b, T, all);
    b.setIdle(p);
    p.hp = 1;
    b.teams.player.burst = 100;
    step(b, [{ type: 'tri_burst' }]);
    stepTo(b, T + 4);
    const eb = b.teams.enemy.burst;
    const evs = step(b);
    expect(ofType(evs, 'hit_discarded')).toHaveLength(1);
    expect(ofType(evs, 'effect')).toHaveLength(0);
    expect(p.buffs.atk_down).toBeUndefined();
    expect(b.teams.enemy.burst).toBe(eb);
  });

  it('table: the target KO\'d before T + 18 (by the rusher\'s own projectile in flight) → the next enemy enters invulnerable and the rush whiffs on T + 18 (invulnerable, gauge 50, not used)', () => {
    const b = scriptedBattle();
    b.teams.player.x = 30; b.teams.enemy.x = 70;
    giveCard(b, 'player', 0, FLARE);
    setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 0 }]);
    stepUntil(b, (evs) => ofType(evs, 'hit', 'player').length > 0, 200);
    stepTo(b, b.tick + 1);
    // Test state: detach the volley as if the thrower had been hit (GDD §5.5), and make the player Idle.
    const p = b.activeFighter('player');
    const a = p.action;
    expect(a.nextHit).toBeLessThan(a.hitTicks.length);
    a.detached = true;
    b.teams.player.inFlight.push(a);
    b.setIdle(p);
    const target = b.activeFighter('enemy');
    target.hp = 1;
    b.teams.player.burst = 100;
    const T = b.tick;
    const all = [];
    for (const e of step(b, [{ type: 'tri_burst' }])) all.push(e);
    let guard = 0;
    while (!ofType(all, 'tri_burst_whiff').length && !ofType(all, 'tri_burst').length && guard++ < 400) for (const e of step(b)) all.push(e);
    expect(ofType(all, 'ko', 'enemy')).toHaveLength(1);
    expect(ofType(all, 'ko', 'enemy')[0].tick).toBeLessThan(T + 18);
    const w = ofType(all, 'tri_burst_whiff', 'player');
    expect(w.map((e) => [e.tick, e.reason])).toEqual([[T + 18, 'invulnerable']]);
    expect(b.teams.player.burst).toBe(50);
    expect(b.teams.player.burstUsed).toBe(false);
  });

  it('table: the battle ends before T + 18 (last enemy KO\'d) → the rush is dropped with no tri_burst / tri_burst_whiff event', () => {
    const b = scriptedBattle({ enemyTeam: ['enemy_rook_003'] });
    b.teams.player.x = 30; b.teams.enemy.x = 70;
    giveCard(b, 'player', 0, FLARE);
    setVigor(b, 'player', 10);
    step(b, [{ type: 'card', slot: 0 }]);
    stepUntil(b, (evs) => ofType(evs, 'hit', 'player').length > 0, 200);
    stepTo(b, b.tick + 1);
    const p = b.activeFighter('player');
    const a = p.action;
    a.detached = true;
    b.teams.player.inFlight.push(a);
    b.setIdle(p);
    b.activeFighter('enemy').hp = 1;
    b.teams.player.burst = 100;
    const all = [];
    for (const e of step(b, [{ type: 'tri_burst' }])) all.push(e);
    let guard = 0;
    while (!b.getResult() && guard++ < 400) for (const e of step(b)) all.push(e);
    expect(b.getResult().outcome).toBe('win');
    expect(ofType(all, 'tri_burst')).toHaveLength(0);
    expect(ofType(all, 'tri_burst_whiff')).toHaveLength(0);
    for (let i = 0; i < 30; i++) expect(step(b)).toEqual([]);
  });

  it('AC-5.10.9 (W): a 3-hit projectile Bolt whose FIRST hit falls on T + 10 of the rush whiffs as a whole: hit_discarded + whiff (rush_invulnerable) on T + 10, nothing on T + 16 / T + 22, no damage T … T + 22, no link window', () => {
    const b = scriptedBattle();
    b.teams.player.x = 30; b.teams.enemy.x = 70; // distance 40 → 15 ticks of flight at 160/s
    const card = b.card(FLARE);
    expect([card.hits, card.delivery, card.projectile_speed, Math.round(card.hit_interval_s * 60)]).toEqual([3, 'projectile', 160, 6]);
    const windupTicks = Math.round(card.windup_s * 60);
    const T = b.tick + windupTicks + 5 + 1; // the enemy taps on T − 5 − windup, so its windup ends on T − 5
    stepTo(b, T - 5 - windupTicks);
    giveCard(b, 'enemy', 0, FLARE);
    setVigor(b, 'enemy', 10);
    step(b, [], [{ type: 'card', slot: 0 }]);
    stepTo(b, T);
    const bolt = b.activeFighter('enemy').action;
    expect(bolt.hitTicks).toEqual([T + 10, T + 16, T + 22]);
    const p = b.activeFighter('player');
    const hp = p.hp;
    b.teams.player.burst = 100;
    const all = [];
    for (const e of step(b, [{ type: 'tri_burst' }])) all.push(e);
    expect(ofType(all, 'tri_burst_start', 'player')).toHaveLength(1);
    const byTick = {};
    while (b.tick <= T + 22) {
      if (b.tick === T + 17) b.activeFighter('enemy').invulnUntil = T + 19; // test state: the rush whiffs on T + 18
      const t = b.tick;
      const evs = step(b);
      for (const e of evs) all.push(e);
      if (b.tick > t) byTick[t] = evs;
      expect(p.hp).toBe(hp);
    }
    expect(ofType(byTick[T + 10], 'hit_discarded', 'enemy').map((e) => [e.hitIndex, e.reason])).toEqual([[0, 'rush_invulnerable']]);
    expect(ofType(byTick[T + 10], 'whiff', 'enemy').map((e) => [e.cardId, e.reason])).toEqual([[FLARE, 'rush_invulnerable']]);
    for (const t of [T + 16, T + 22]) {
      expect(byTick[t].filter((e) => e.side === 'enemy' && ['hit', 'hit_discarded', 'whiff'].indexOf(e.type) >= 0)).toEqual([]);
    }
    expect(ofType(all, 'tri_burst_whiff', 'player').map((e) => e.tick)).toEqual([T + 18]);
    expect(ofType(all, 'hit', 'enemy')).toHaveLength(0);
    expect(ofType(all, 'link_open', 'enemy')).toHaveLength(0);
    expect(b.activeFighter('enemy').linkWindow).toBe(false);
  });

  it('the new event and its reasons are in the exported enum lists (L-shared-009)', () => {
    expect(BATTLE_EVENT_TYPES).toContain('hit_discarded');
    expect(HIT_DISCARD_REASONS).toEqual(['rush_invulnerable']);
    expect(TRI_BURST_WHIFF_REASONS).toEqual(['invulnerable', 'safety_net']);
    expect(WHIFF_REASONS).toEqual(['approach_timeout', 'invulnerable', 'rush_invulnerable']);
  });
});

describe('AC-5.10.7 (P, round 3 rewrite): live stage_004 and stage_005, master vs master, seeds 1–1,000 plus 90, 3,345, 3,483 on stage_005', () => {
  const content = createContent(loadBundle());
  const runs = [];
  for (const stageId of ['stage_004', 'stage_005']) for (let seed = 1; seed <= 1000; seed++) runs.push([stageId, seed]);
  for (const seed of [90, 3345, 3483]) runs.push(['stage_005', seed]);
  let starts = 0;
  let resolvedOk = 0;
  let dropped = 0;
  const bad = [];
  let safetyNet = 0;
  let koDuringRush = 0;
  let igniteCancels = 0;
  let discarded = 0;
  const seenTypes = {};
  for (const [stageId, seed] of runs) {
    const b = createBattle({
      content, stageId, playerTeam: ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'],
      playerController: { aiTier: 'master' }, enemyController: { aiTier: 'master' }, skipIntro: true,
    }, seed);
    const open = { player: -1, enemy: -1 };
    let lastTick = 0;
    while (!b.getResult()) {
      for (const e of b.step()) {
        seenTypes[e.type] = true;
        lastTick = e.tick;
        if (e.type === 'tri_burst_start') { starts++; if (open[e.side] >= 0) bad.push([stageId, seed, 'double start']); open[e.side] = e.tick; }
        if (e.type === 'tri_burst' || e.type === 'tri_burst_whiff') {
          if (open[e.side] >= 0 && e.tick - open[e.side] === 18) resolvedOk++;
          else bad.push([stageId, seed, e.type + ' on ' + e.tick + ' for start ' + open[e.side]]);
          open[e.side] = -1;
        }
        if (e.type === 'tri_burst_whiff' && e.reason === 'safety_net') safetyNet++;
        if (e.type === 'ko' && open[e.side] >= 0) koDuringRush++;
        if (e.type === 'card_cancelled' && e.reason === 'ignition' && e.cardId === 'tri_burst') igniteCancels++;
        if (e.type === 'hit_discarded') discarded++;
      }
    }
    for (const side of ['player', 'enemy']) {
      if (open[side] < 0) continue;
      // Allowed only if the battle ended on a tick in T … T + 17.
      if (b.getResult() && lastTick - open[side] <= 17) dropped++;
      else bad.push([stageId, seed, side + ' rush still open at the end']);
    }
  }
  it('every tri_burst_start on T has exactly one tri_burst / tri_burst_whiff on T + 18, unless the battle ended in T … T + 17', () => {
    console.log('[AC-5.10.7] runs', runs.length, 'starts', starts, 'resolved', resolvedOk, 'dropped (battle over)', dropped, 'hit_discarded', discarded);
    expect(starts).toBeGreaterThan(100);
    expect(bad).toEqual([]);
    expect(resolvedOk + dropped).toBe(starts);
  });
  it('0 safety_net whiffs, 0 KOs of a team with a rush in progress, 0 Ignition cancels of a rush', () => {
    expect(safetyNet).toBe(0);
    expect(koDuringRush).toBe(0);
    expect(igniteCancels).toBe(0);
  });
  it('every event type the engine emitted is in BATTLE_EVENT_TYPES', () => {
    for (const t of Object.keys(seenTypes)) expect(BATTLE_EVENT_TYPES).toContain(t);
  });
});
