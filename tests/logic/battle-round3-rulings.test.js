// GDD round 3 rulings: AC-5.6.1 / AC-5.6.2 corrected numbers (§5.0 counting convention) and AC-5.8.5 (a)/(b)
// (§5.7 chain_index ruling: the chain belongs to the team, a Tag Strike continues it, the attacker's own Ignition resets it).
import { describe, it, expect } from 'vitest';
import { formulas } from '../../src/logic/index.js';
import { scriptedBattle, giveCard, setVigor, vigor, setClose, step, stepUntil, ofType } from '../helpers/battle-helpers.js';

const C1 = 'card_tavi_spark_jab'; // Tavi's default Fist (melee)
const ENEMY_JAB = 'card_rook_one_two_count';
const LARK_FIST = 'card_lark_tailwind_kick'; // default Fist of the incoming fighter

function untilUnfrozen(b) {
  let guard = 0;
  while (b.freezes.length > 0) {
    step(b);
    if (++guard > 1000) throw new Error('freeze never ended');
  }
}

/** Tick of the enemy jab's first hit when nobody slips (found by a dry run), and the tap tick. */
function enemyHitTick() {
  const b = scriptedBattle();
  setClose(b);
  giveCard(b, 'enemy', 0, ENEMY_JAB);
  const tap = b.tick + 30; // late enough that t0 = th − 15 is a real tick of this battle
  while (b.tick < tap) step(b);
  step(b, [], [{ type: 'card', slot: 0 }]);
  const r = stepUntil(b, (e) => ofType(e, 'hit', 'enemy').length > 0, 200);
  return { tap: tap, th: ofType(r.events, 'hit', 'enemy')[0].tick };
}

/** Slip applied on t0 = th − d with Vigor 5.0 at the end of t0 − 1; returns the battle at the end of th. */
function slipScenario(d) {
  const ref = enemyHitTick();
  const b = scriptedBattle();
  setClose(b);
  giveCard(b, 'enemy', 0, ENEMY_JAB);
  const t0 = ref.th - d;
  expect(t0).toBeGreaterThan(b.tick);
  const all = [];
  let hp = 0;
  while (b.tick <= ref.th) {
    if (b.tick === t0) {
      setVigor(b, 'player', 5.0); // value before = end of tick t0 − 1
      hp = b.activeFighter('player').hp;
    }
    const pIn = b.tick === t0 ? [{ type: 'slip' }] : [];
    const eIn = b.tick === ref.tap ? [{ type: 'card', slot: 0 }] : [];
    const t = b.tick;
    for (const e of step(b, pIn, eIn)) all.push(e);
    if (b.tick === t) throw new Error('unexpected freeze before the hit');
  }
  return { b: b, all: all, hp: hp, th: ref.th, t0: t0 };
}

describe('§5.6 round 3 corrected examples', () => {
  it('AC-5.6.1: Slip on t0, hit on t0 + 6 → no damage, Riposte window opens on th, Vigor after = 5 + 7/60 = 5.11666…', () => {
    const r = slipScenario(6);
    expect(r.b.activeFighter('player').hp).toBe(r.hp);
    const ps = ofType(r.all, 'perfect_slip', 'player');
    expect(ps).toHaveLength(1);
    expect(ps[0].tick).toBe(r.th);
    expect(r.b.teams.player.riposteTicks).toBeGreaterThan(0);
    expect(Math.abs(vigor(r.b, 'player') - (5 + 7 / 60))).toBeLessThan(1e-6);
    expect(Math.abs(vigor(r.b, 'player') - 5.1167)).toBeLessThan(1e-4);
  });

  it('AC-5.6.2: Slip on t0, hit on t0 + 15 → no damage, no Riposte window, Vigor after = 3 + 16/60 = 3.26666…', () => {
    const r = slipScenario(15);
    expect(r.b.activeFighter('player').hp).toBe(r.hp);
    expect(ofType(r.all, 'perfect_slip')).toHaveLength(0);
    expect(r.b.teams.player.riposteTicks).toBe(0);
    expect(Math.abs(vigor(r.b, 'player') - (3 + 16 / 60))).toBeLessThan(1e-6);
    expect(Math.abs(vigor(r.b, 'player') - 3.2667)).toBeLessThan(1e-4);
  });
});

/**
 * C1 (Tavi's Fist) lands at melee range; returns the battle on the first tick after C1's last hit, with the
 * enemy in Hitstun, plus the C1 hit events.
 */
function landC1() {
  const b = scriptedBattle();
  setClose(b);
  b.teams.player.tagReadyAt = 0;
  setVigor(b, 'player', 10);
  giveCard(b, 'player', 0, C1);
  step(b, [{ type: 'card', slot: 0 }]);
  const hits = [];
  const n = b.content.cards[C1].hits;
  stepUntil(b, (e) => {
    for (const h of ofType(e, 'hit', 'player')) hits.push(h);
    return hits.length >= n;
  }, 200);
  untilUnfrozen(b);
  return { b: b, hits: hits };
}

/** From tag tick T: Tag Strike hit, then a Fist tapped on T + 7. Returns the events of interest. */
function tagThenFist(b) {
  // distance 30 at the tag tap, enemy not near a wall
  b.teams.player.x = b.teams.enemy.x - 30;
  const T = b.tick;
  const evs = step(b, [{ type: 'tag', slot: 1 }]);
  expect(ofType(evs, 'tag_strike', 'player')).toHaveLength(1);
  expect(b.distance()).toBe(12);
  giveCard(b, 'player', 0, LARK_FIST);
  setVigor(b, 'player', 10);
  const r = stepUntil(b, (x) => ofType(x, 'hit', 'player').length > 0, 20);
  const strike = ofType(r.events, 'hit', 'player')[0];
  const distAfterStrike = b.distance();
  untilUnfrozen(b);
  while (b.tick < T + 7) step(b);
  const enemy = b.activeFighter('enemy');
  const tapEvs = step(b, [{ type: 'card', slot: 0 }]);
  const r2 = stepUntil(b, (x) => ofType(x, 'hit', 'player').length > 0, 60);
  const fist = ofType(r2.events, 'hit', 'player')[0];
  return { T: T, strike: strike, distAfterStrike: distAfterStrike, tapEvs: tapEvs, fist: fist, enemy: enemy, all: r2.all };
}

describe('§5.7 / §5.8 AC-5.8.5 (round 3 rewrite)', () => {
  it('(a) Tag Strike continues the chain: strike chain_index 2 on T + 6, distance 16; Fist tapped on T + 7 lands T+15..T+21 with chain_index 3', () => {
    const { b, hits } = landC1();
    expect(hits[0].chainIndex).toBe(1);
    // wait until the player can tag (Idle) while the enemy still has ≥ 7 hitstun ticks
    let guard = 0;
    while (b.activeFighter('player').state !== 'Idle') {
      step(b);
      if (++guard > 100) throw new Error('player never Idle');
    }
    const e = b.activeFighter('enemy');
    expect(e.state).toBe('Hitstun');
    expect(e.stateUntil - b.tick).toBeGreaterThanOrEqual(7);
    expect(b.teams.player.chain.active).toBe(true);
    expect(b.teams.player.chain.cards).toBe(1);
    const r = tagThenFist(b);
    expect(r.strike.cardId).toBe('tag_strike');
    expect(r.strike.tick).toBe(r.T + 6);
    expect(r.strike.chainIndex).toBe(2);
    expect(r.distAfterStrike).toBe(16);
    expect(ofType(r.tapEvs, 'input_rejected', 'player')).toHaveLength(0);
    expect(r.fist.cardId).toBe(LARK_FIST);
    expect(r.fist.tick).toBeGreaterThanOrEqual(r.T + 15);
    expect(r.fist.tick).toBeLessThanOrEqual(r.T + 21);
    expect(r.fist.chainIndex).toBe(3);
    const R = b.rules;
    expect(formulas.comboMult(2, R.combo.bonusPerCard, R.combo.bonusMaxSteps)).toBeCloseTo(1.05, 9);
    expect(formulas.comboMult(3, R.combo.bonusPerCard, R.combo.bonusMaxSteps)).toBeCloseTo(1.10, 9);
  });

  it('(b) Tag Strike opens the chain after the attacker\'s own Ignition: strike chain_index 1, Fist chain_index 2', () => {
    const { b } = landC1();
    // Ignition available for Tavi (fight tick 3,599 in normal play): make it available now for the test
    const f = b.activeFighter('player');
    f.ign.available = true;
    f.ign.used = false;
    const I = b.tick;
    const ig = step(b, [{ type: 'ignite' }]);
    expect(ofType(ig, 'ignition', 'player')).toHaveLength(1);
    expect(b.teams.player.chain.cards).toBe(0);
    expect(b.teams.player.chain.active).toBe(false);
    untilUnfrozen(b);
    expect(b.tick).toBe(I + 1);
    const e = b.activeFighter('enemy');
    expect(e.state).toBe('Hitstun');
    const r = tagThenFist(b);
    expect(r.T).toBe(I + 1);
    expect(r.strike.tick).toBe(r.T + 6);
    expect(r.strike.chainIndex).toBe(1);
    expect(r.fist.tick).toBeGreaterThanOrEqual(r.T + 15);
    expect(r.fist.tick).toBeLessThanOrEqual(r.T + 21);
    expect(r.fist.chainIndex).toBe(2);
  });
});
