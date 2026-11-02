// GDD §5.15 round 3 ruling "Detached projectiles": the reactive-dodge decision belongs to the card. If the thrower is
// hit after its projectile card's windup ended, the AI still decides once on tick D, using the projectiles' first
// scheduled hit. If the thrower is hit during the windup, the card is cancelled and there is nothing to decide.
// W-class (FX-GDD battle.json) with a test-copy card.
import { describe, it, expect } from 'vitest';
import { createBattle, createContent } from '../../src/logic/index.js';
import { loadGddBundle } from '../helpers/load-data.js';
import { giveCard, setVigor, step, ofType } from '../helpers/battle-helpers.js';

const BOLT_ID = 'card_common_fxtestshot'; // test copy: 1-hit projectile Bolt, windup 12 ticks, speed 160
const ENEMY_BOLT = 'card_rook_razor_draft';

function bundle() {
  const b = loadGddBundle();
  b.cards.cards.push({
    id: BOLT_ID, name: 'Test Shot', type: 'bolt', owner: 'common', cost: 3, power: 1.5, hits: 1, delivery: 'projectile',
    windup_s: 0.2, hit_interval_s: 0.1, recovery_s: 0.35, hitstun_s: 0.6, knockback: 8, projectile_speed: 160,
    armor: false, effects: [], description: 'test', shout: '', art: { icon: 'ico_test' }, sfx: 'sfx_test',
  });
  return b;
}
const content = createContent(bundle());

function stubRng(fn) {
  const r = { calls: 0, ticks: [] };
  r.next = () => { r.calls += 1; return fn(r.calls); };
  r.nextInt = (n) => Math.floor(r.next() * n);
  return r;
}

/** A fake enemy projectile already in flight that hits the player's active fighter on tick `at`. */
function enemyShotAt(b, at) {
  const owner = b.activeFighter('enemy');
  const card = b.card(ENEMY_BOLT);
  b.actionSeq += 1;
  b.teams.enemy.inFlight.push({
    id: b.actionSeq, kind: 'card', owner: owner, cardId: ENEMY_BOLT, card: card, isRiposte: false, phase: 'active',
    startTick: at - 30, windupStart: at - 30, windupEnd: at - 20, hitTicks: [at], nextHit: 0, landed: null, targetSlot: -1,
    chainIndex: 1, critMult: 1, comboMult: 1, recoveryEnd: 0, armor: false, detached: true,
  });
}

/** Player throws BOLT_ID on tick W at distance 40 against a veteran AI; returns { b, ai, W }. */
function setup(hitAt) {
  const b = createBattle({
    content, enemyTeam: ['enemy_rook_003'], playerTeam: ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'],
    playerController: 'human', enemyController: { aiTier: 'veteran' }, skipIntro: true,
  }, 1);
  for (const side of ['player', 'enemy']) for (const f of b.teams[side].fighters) f.def.critRate = 0;
  b.teams.player.x = 30; b.teams.enemy.x = 70;
  const ai = b.controllers.enemy;
  ai.nextThink = 1e9;
  const rng = stubRng(() => { rng.ticks.push(b.tick); return 0.0; });
  ai.rng = rng;
  setVigor(b, 'enemy', 10);
  setVigor(b, 'player', 10);
  giveCard(b, 'player', 0, BOLT_ID);
  const W = b.tick;
  enemyShotAt(b, W + hitAt);
  return { b, ai, rng, W };
}

describe('§5.15 detached projectiles keep their one AI decision', () => {
  it('AC-5.15.8 (W): thrower hit on W + 13 after its windup → the veteran AI rolls twice on D = W + 16, Slips on W + 21, the Bolt whiffs with perfect_slip', () => {
    const { b, ai, rng, W } = setup(13);
    expect(b.rules.aiTiers.veteran.reactionTicks).toBe(16);
    const all = [];
    for (const e of step(b, [{ type: 'card', slot: 0 }])) all.push(e);
    const bolt = b.activeFighter('player').action;
    expect(ofType(all, 'windup_start', 'player')[0].windupEnd).toBe(W + 12);
    let guard = 0;
    while (b.tick <= W + 28 && guard++ < 500) for (const e of step(b)) all.push(e);
    expect(bolt.hitTicks).toEqual([W + 27]);
    expect(bolt.detached).toBe(true); // the thrower was hit on W + 13 and the Bolt flew on
    expect(ofType(all, 'hit', 'enemy').map((e) => e.tick)).toEqual([W + 13]);
    expect(rng.ticks.slice(0, 2)).toEqual([W + 16, W + 16]);
    expect(ofType(all, 'slip', 'enemy').map((e) => e.tick)).toEqual([W + 21]);
    expect(ofType(all, 'whiff', 'player').map((e) => [e.tick, e.cardId, e.reason])).toEqual([[W + 27, BOLT_ID, 'invulnerable']]);
    expect(ofType(all, 'perfect_slip', 'enemy').map((e) => e.tick)).toEqual([W + 27]);
    expect(ofType(all, 'hit', 'player')).toHaveLength(0);
    expect(ai.dodgeLog.filter((r) => r.cardId === BOLT_ID).map((r) => [r.tick, r.outcome])).toEqual([[W + 16, 'planned']]);
  });

  it('thrower hit DURING its windup (W + 5) → the card is cancelled, nothing to decide, no roll', () => {
    const { b, ai, rng, W } = setup(5);
    const all = [];
    for (const e of step(b, [{ type: 'card', slot: 0 }])) all.push(e);
    let guard = 0;
    while (b.tick <= W + 30 && guard++ < 500) for (const e of step(b)) all.push(e);
    expect(ofType(all, 'interrupt', 'player')).toHaveLength(1);
    expect(rng.calls).toBe(0);
    expect(ai.dodgeLog.filter((r) => r.cardId === BOLT_ID)).toEqual([]);
    expect(ofType(all, 'slip', 'enemy')).toHaveLength(0);
  });
});
