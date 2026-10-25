// Helpers for scripted battle tests. Both sides are 'human' (scripted) unless stated.
import { createBattle, createContent } from '../../src/logic/index.js';
import { vigorUnits } from '../../src/logic/rules.js';
import { loadBundle, loadGddBundle, readJson } from './load-data.js';

export const TEST_FIST_ID = 'card_tavi_test_fist';

/**
 * Data bundle plus a 1-hit test Fist with power 1.2 (GDD AC-5.6.4 / AC-5.7.1 numbers).
 * source: 'gdd' (default) = FX-GDD (GDD §15.4, W-class worked examples); 'live' = data/ (P-class ACs).
 */
export function testBundle(mutateBattle, source) {
  let bundle;
  if (source === 'live') {
    bundle = loadBundle();
    bundle.economy = readJson('data/economy.json');
  } else if (source === undefined || source === 'gdd') {
    bundle = loadGddBundle();
  } else {
    throw new Error('testBundle: unknown source ' + source);
  }
  bundle.cards.cards.push({
    id: TEST_FIST_ID, name: 'Test Fist', type: 'fist', owner: 'char_tavi_001', cost: 2, power: 1.2, hits: 1,
    delivery: 'melee', windup_s: 0.12, hit_interval_s: 0.1, recovery_s: 0.3, hitstun_s: 0.6, knockback: 0,
    armor: false, effects: [], description: 'test', shout: '', art: { icon: 'ico_test' }, sfx: 'sfx_test',
  });
  if (mutateBattle) mutateBattle(bundle.battle);
  return bundle;
}

/**
 * A scripted battle: starter team vs the given enemies, fight already started.
 * Runs on FX-GDD unless opts.live is true (P-class ACs) or opts.bundle is given.
 */
export function scriptedBattle(opts) {
  const o = opts || {};
  const bundle = o.bundle || testBundle(o.mutateBattle, o.live ? 'live' : 'gdd');
  const b = createBattle({
    content: createContent(bundle),
    enemyTeam: o.enemyTeam || ['enemy_rook_003', 'enemy_pell_002', 'enemy_thessa_001'],
    timerS: o.timerS,
    playerTeam: o.playerTeam || ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'],
    playerController: 'human',
    enemyController: 'human',
    skipIntro: true,
  }, o.seed === undefined ? 1 : o.seed);
  if (!o.keepCrit) {
    for (const side of ['player', 'enemy']) for (const f of b.teams[side].fighters) f.def.critRate = 0;
  }
  return b;
}

/** Put a card into a hand slot of the active fighter. */
export function giveCard(b, side, slot, cardId) {
  const f = b.activeFighter(side);
  f.deck.hand[slot] = cardId;
  f.deck.refillAt[slot] = -1;
}

/** Set a team's Vigor (float value). */
export function setVigor(b, side, v) {
  b.teams[side].vigor = vigorUnits(v);
}

export function vigor(b, side) {
  return b.teams[side].vigor / 6000;
}

/** Place both fighters at melee range (distance 12). */
export function setClose(b) {
  b.teams.player.x = 44;
  b.teams.enemy.x = 56;
}

/** Step with inputs; returns the events. */
export function step(b, player, enemy) {
  return b.step({ player: player || [], enemy: enemy || [] });
}

/**
 * Step until pred(events, b) is true (max steps). Returns { events, all } where `all` is every event seen.
 * Throws on timeout so a broken scenario fails loudly.
 */
export function stepUntil(b, pred, max) {
  const all = [];
  const limit = max || 5000;
  for (let i = 0; i < limit; i++) {
    const evs = b.step({ player: [], enemy: [] });
    for (const e of evs) all.push(e);
    if (pred(evs, b)) return { events: evs, all: all };
  }
  throw new Error('stepUntil: condition not met in ' + limit + ' steps');
}

/** Step exactly n unfrozen ticks (freeze ticks are stepped through and not counted). */
export function stepTicks(b, n) {
  const all = [];
  const target = b.tick + n;
  let guard = 0;
  while (b.tick < target && !b.getResult()) {
    for (const e of b.step({ player: [], enemy: [] })) all.push(e);
    if (++guard > 100000) throw new Error('stepTicks guard');
  }
  return all;
}

export function ofType(events, type, side) {
  return events.filter((e) => e.type === type && (side === undefined || e.side === side));
}
