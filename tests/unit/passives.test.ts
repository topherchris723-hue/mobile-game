import { describe, expect, it } from 'vitest';
import { TECHNIQUE_TUNING } from '../../src/config/battle';
import {
  blast,
  ENEMY_TEAM,
  signature,
  strike,
  technique,
  type CardSpec,
  type FighterSpec,
} from '../../src/config/fighters';
import { PASSIVE_TUNING, PASSIVES } from '../../src/config/passives';
import { getSovereign, ROSTER } from '../../src/config/sovereigns';
import { computeDamage } from '../../src/game/duel/damage';
import { activeFighter, applyAction, createDuel, damageAgainst } from '../../src/game/duel/rules';
import type { DuelAction, DuelEvent, DuelState, Side } from '../../src/game/duel/types';

/*
 * One test per Passive (docs/design/characters.md). Duels are set up directly and cards are forced
 * into hand, so each test exercises exactly one rule.
 */

const team = (...ids: string[]): FighterSpec[] => ids.map(getSovereign);
/** The same Sovereign with its Passive removed, to measure what the Passive changes. */
const without = ({ id, name, type, world, hp, atk, def, spd, deck, look, ai }: FighterSpec) => ({
  id,
  name,
  type,
  world,
  hp,
  atk,
  def,
  spd,
  deck,
  look,
  ai,
});

/** A team member by index, failing loudly if it doesn't exist. */
function member(state: DuelState, side: Side, index: number) {
  const fighter = state.teams[side].fighters[index];
  if (!fighter) throw new Error(`No ${side} fighter ${index}`);
  return fighter;
}

function duel(player: readonly FighterSpec[], enemy: readonly FighterSpec[] = ENEMY_TEAM) {
  return createDuel({ player, enemy, seed: 11 }).state;
}

/** Plays `card` from hand slot 0 as `side`, whoever's turn it nominally was. */
function play(state: DuelState, side: Side, card: CardSpec): DuelEvent[] {
  state.turnSide = side;
  state.teams[side].energy = 10;
  activeFighter(state.teams[side]).hand[0] = { uid: 9000 + state.turnNumber, spec: card };
  return act(state, side, { kind: 'play', handIndex: 0 });
}

function act(state: DuelState, side: Side, action: DuelAction): DuelEvent[] {
  state.turnSide = side;
  const result = applyAction(state, side, action);
  if (!result.ok) throw new Error(result.reason);
  return [...result.events];
}

const passiveEvents = (events: readonly DuelEvent[]) =>
  events.flatMap((e) => (e.kind === 'passive' ? [e.passive] : []));
const damageTo = (events: readonly DuelEvent[], side: Side) =>
  events.find((e) => e.kind === 'damage' && e.side === side);

describe('Passive data', () => {
  it('gives every Sovereign a distinct Passive with a name and description', () => {
    const ids = ROSTER.map((s) => s.passive);
    expect(new Set(ids).size).toBe(ROSTER.length);
    for (const id of ids) {
      expect(PASSIVES[id].name.length).toBeGreaterThan(0);
      expect(PASSIVES[id].text.length).toBeGreaterThan(10);
    }
  });

  it('gives each Riftborn an echoed Passive', () => {
    for (const enemy of ENEMY_TEAM) expect(enemy.passive).toBeDefined();
  });
});

describe('Rising Ember (Kaien)', () => {
  it('builds ATK each turn he starts on the field, capped, and resets when he leaves', () => {
    const state = duel(team('kaien', 'maris', 'torvan'));
    const kaien = activeFighter(state.teams.player);
    const jab = strike('Jab');
    kaien.fieldTurns = 0;
    const base = damageAgainst(state, 'player', jab).amount;
    kaien.fieldTurns = 2;
    expect(damageAgainst(state, 'player', jab).amount).toBeGreaterThan(base);
    kaien.fieldTurns = 99;
    const capped = damageAgainst(state, 'player', jab).amount;
    kaien.fieldTurns = PASSIVE_TUNING.risingEmber.max / PASSIVE_TUNING.risingEmber.perTurn;
    expect(damageAgainst(state, 'player', jab).amount).toBe(capped);

    const before = kaien.fieldTurns;
    play(state, 'player', jab); // ends the turn; the enemy's turn start doesn't count for Kaien
    expect(kaien.fieldTurns).toBe(before);
    play(state, 'enemy', strike('Hit')); // back to the player: +1
    expect(kaien.fieldTurns).toBe(before + 1);
    act(state, 'player', { kind: 'switch', fighterIndex: 1 });
    member(state, 'player', 1).switchCooldown = 0;
    expect(kaien.fieldTurns).toBeGreaterThan(0);
    // Back in later: starts again from zero.
    state.teams.player.switchedThisTurn = false;
    kaien.switchCooldown = 0;
    act(state, 'player', { kind: 'switch', fighterIndex: 0 });
    expect(kaien.fieldTurns).toBe(0);
  });
});

describe('First Light (Solenne)', () => {
  it('heals an ally who switches in while she is on the bench', () => {
    const state = duel(team('kaien', 'solenne', 'maris'));
    const maris = member(state, 'player', 2);
    maris.hp = 500;
    const events = act(state, 'player', { kind: 'switch', fighterIndex: 2 });
    expect(passiveEvents(events)).toContain('firstLight');
    expect(maris.hp).toBe(500 + Math.round(maris.spec.hp * PASSIVE_TUNING.firstLight.heal));
  });

  it('does nothing when the incoming ally is at full HP', () => {
    const state = duel(team('kaien', 'solenne', 'maris'));
    const events = act(state, 'player', { kind: 'switch', fighterIndex: 2 });
    expect(passiveEvents(events)).not.toContain('firstLight');
  });
});

describe('damage-reducing Passives', () => {
  const compare = (defenderId: string, card: CardSpec) => {
    const withIt = duel(ENEMY_TEAM, team(defenderId, 'kaien', 'maris'));
    const withoutIt = duel(ENEMY_TEAM, [
      without(getSovereign(defenderId)),
      ...team('kaien', 'maris'),
    ]);
    return {
      reduced: damageAgainst(withIt, 'player', card).amount,
      normal: damageAgainst(withoutIt, 'player', card).amount,
    };
  };

  it('Basalt Skin (Brakka) reduces Blasts only', () => {
    const b = compare('brakka', blast('Shot'));
    expect(b.reduced).toBeCloseTo(b.normal * (1 - PASSIVE_TUNING.basaltSkin.reduction), -1);
    const s = compare('brakka', strike('Jab'));
    expect(s.reduced).toBe(s.normal);
  });

  it('Read the Current (Maris) reduces Signatures only', () => {
    const sig = compare('maris', signature('Finisher'));
    expect(sig.reduced).toBeCloseTo(sig.normal * (1 - PASSIVE_TUNING.readTheCurrent.reduction), -1);
    const b = compare('maris', blast('Shot'));
    expect(b.reduced).toBe(b.normal);
  });

  it('Ink Veil (Shiro) reduces only the first hit after entering', () => {
    const state = duel(ENEMY_TEAM, team('shiro', 'kaien', 'maris'));
    const shiro = activeFighter(state.teams.enemy);
    const first = play(state, 'player', strike('Jab'));
    expect(passiveEvents(first)).toContain('inkVeil');
    const firstHit = damageTo(first, 'enemy');
    const second = play(state, 'player', strike('Jab'));
    const secondHit = damageTo(second, 'enemy');
    expect(passiveEvents(second)).not.toContain('inkVeil');
    if (firstHit?.kind !== 'damage' || secondHit?.kind !== 'damage') throw new Error('no hits');
    expect(firstHit.amount).toBeLessThan(secondHit.amount);
    expect(shiro.veilReady).toBe(false);
  });

  it('Beacon (Corrin) shields the active ally while he is alive on the bench', () => {
    const state = duel(ENEMY_TEAM, team('kaien', 'corrin', 'maris'));
    const shielded = damageAgainst(state, 'player', strike('Jab')).amount;
    member(state, 'enemy', 1).hp = 0;
    const unshielded = damageAgainst(state, 'player', strike('Jab')).amount;
    expect(shielded).toBeLessThan(unshielded);
    expect(shielded).toBeCloseTo(unshielded * (1 - PASSIVE_TUNING.beacon.reduction), -1);
  });
});

describe("Captain's Will (Dravo)", () => {
  it('survives the first knockout blow with 1 HP, but not the second', () => {
    const state = duel(ENEMY_TEAM, team('dravo', 'kaien', 'maris'));
    const dravo = activeFighter(state.teams.enemy);
    dravo.hp = 5;
    const first = play(state, 'player', blast('Shot'));
    expect(dravo.hp).toBe(1);
    expect(passiveEvents(first)).toContain('captainsWill');
    expect(first.some((e) => e.kind === 'ko')).toBe(false);
    const second = play(state, 'player', blast('Shot'));
    expect(dravo.hp).toBe(0);
    expect(second.some((e) => e.kind === 'ko')).toBe(true);
  });
});

describe('Ashen Pride (Vey)', () => {
  it('hits harder against Sapped enemies', () => {
    const state = duel(team('vey', 'kaien', 'maris'));
    const foe = activeFighter(state.teams.enemy);
    foe.sapTurns = 2;
    const proud = damageAgainst(state, 'player', strike('Jab')).amount;
    const plain = computeDamage(
      { ...activeFighter(state.teams.player), spec: without(getSovereign('vey')) },
      foe,
      strike('Jab'),
    ).amount;
    expect(proud).toBeCloseTo(plain * (1 + PASSIVE_TUNING.ashenPride.bonus), -1);
  });
});

describe('Arc Core (Rhen)', () => {
  it('gives energy the first time he switches in, once per battle', () => {
    const state = duel(team('kaien', 'rhen', 'maris'));
    const player = state.teams.player;
    player.energy = 3;
    const events = act(state, 'player', { kind: 'switch', fighterIndex: 1 });
    expect(passiveEvents(events)).toContain('arcCore');
    // Same world as Kaien, so no Tag Link: the +1 is all Arc Core.
    expect(player.energy).toBe(3 + PASSIVE_TUNING.arcCore.energy);
    player.switchedThisTurn = false;
    member(state, 'player', 0).switchCooldown = 0;
    act(state, 'player', { kind: 'switch', fighterIndex: 0 });
    player.switchedThisTurn = false;
    member(state, 'player', 1).switchCooldown = 0;
    const again = act(state, 'player', { kind: 'switch', fighterIndex: 1 });
    expect(passiveEvents(again)).not.toContain('arcCore');
  });
});

describe('Sticky Fingers (Nerys)', () => {
  it('steals energy on every second Strike', () => {
    const state = duel(team('nerys', 'kaien', 'torvan'));
    const first = play(state, 'player', strike('Hook'));
    expect(passiveEvents(first)).not.toContain('stickyFingers');
    state.teams.enemy.energy = 4;
    const second = play(state, 'player', strike('Hook'));
    expect(passiveEvents(second)).toContain('stickyFingers');
    const drain = second.find((e) => e.kind === 'drain');
    expect(drain?.kind === 'drain' && drain.amount).toBe(PASSIVE_TUNING.stickyFingers.steal);
  });
});

describe("Siren's Hold (Isla)", () => {
  it('heals when she Drains', () => {
    const state = duel(team('isla', 'kaien', 'torvan'));
    const isla = activeFighter(state.teams.player);
    isla.hp = 400;
    const events = play(state, 'player', technique('Siphon', 'drain', 2));
    expect(passiveEvents(events)).toContain('sirensHold');
    expect(isla.hp).toBe(400 + Math.round(isla.spec.hp * PASSIVE_TUNING.sirensHold.heal));
  });
});

describe('Deep Roots (Torvan)', () => {
  it('heals at the start of each of his turns on the field', () => {
    const state = duel(team('torvan', 'kaien', 'maris'));
    const torvan = activeFighter(state.teams.player);
    torvan.hp = 600;
    const events = play(state, 'enemy', technique('Wait', 'focus', 1));
    expect(passiveEvents(events)).toContain('deepRoots');
    expect(torvan.hp).toBe(600 + Math.round(torvan.spec.hp * PASSIVE_TUNING.deepRoots.heal));
  });
});

describe('Gale Step (Akari)', () => {
  it('pierces Guard with her first attack after entering only', () => {
    const state = duel(team('akari', 'kaien', 'maris'));
    const foe = activeFighter(state.teams.enemy);
    foe.guard = true;
    const first = play(state, 'player', strike('Cut'));
    expect(passiveEvents(first)).toContain('galeStep');
    const hit = damageTo(first, 'enemy');
    expect(hit?.kind === 'damage' && hit.guarded).toBe(false);
    foe.guard = true;
    const second = play(state, 'player', strike('Cut'));
    const guardedHit = damageTo(second, 'enemy');
    expect(guardedHit?.kind === 'damage' && guardedHit.guarded).toBe(true);
  });
});

describe('Unbroken Body (Goro)', () => {
  it("can't have his Defence lowered", () => {
    const state = duel(ENEMY_TEAM, team('goro', 'kaien', 'maris'));
    const events = play(state, 'player', technique('Curse', 'sap', 2));
    expect(activeFighter(state.teams.enemy).sapTurns).toBe(0);
    expect(passiveEvents(events)).toContain('unbrokenBody');
    expect(events.some((e) => e.kind === 'status' && e.status === 'sap')).toBe(false);
  });
});

describe('Field Medic (Mei)', () => {
  it('makes her heals restore more', () => {
    const state = duel(team('mei', 'kaien', 'maris'));
    const mei = activeFighter(state.teams.player);
    mei.hp = 100;
    play(state, 'player', technique('Incense', 'heal', 3));
    const expected = Math.round(
      mei.spec.hp * TECHNIQUE_TUNING.healFraction * (1 + PASSIVE_TUNING.fieldMedic.healBonus),
    );
    expect(mei.hp).toBe(100 + expected);
  });
});
