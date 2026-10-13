import { describe, expect, it } from 'vitest';
import {
  BATTLE_RULES,
  COMBO,
  CROSSOVER,
  CROSSOVER_PARTNER_EFFECT,
  DRAIN,
  TECHNIQUE_TUNING,
} from '../../src/config/battle';
import { ENEMY_TEAM, type CardSpec, type FighterSpec } from '../../src/config/fighters';
import { DEFAULT_TEAM, getSovereign } from '../../src/config/sovereigns';
import { chooseAction } from '../../src/game/duel/ai';
import { computeDamage, typeEffectiveness } from '../../src/game/duel/damage';
import {
  activeFighter,
  applyAction,
  cardContinuesCombo,
  createDuel,
  crossoverBlockedReason,
  crossoverPartners,
  playBlockedReason,
  previewCrossover,
  signatureThreat,
  switchBlockedReason,
} from '../../src/game/duel/rules';
import type { DuelState, Side } from '../../src/game/duel/types';

/** The default starting team (Kaien, Maris, Torvan), without Leader Skills, for rule tests. */
const PLAYER_TEAM: readonly FighterSpec[] = DEFAULT_TEAM.map(getSovereign);

const duel = (seed = 1) => createDuel({ player: PLAYER_TEAM, enemy: ENEMY_TEAM, seed });

/** Plays the cheapest card or charges, so tests can advance turns predictably. */
function passTurn(state: DuelState, side: Side): void {
  const result = applyAction(state, side, { kind: 'charge' });
  if (!result.ok) throw new Error(result.reason);
}

/** Puts a specific card in the active fighter's hand slot 0 and enough energy to play it. */
function forceCard(state: DuelState, side: Side, spec: CardSpec, energy = 10): void {
  const fighter = activeFighter(state.teams[side]);
  fighter.hand[0] = { uid: 9999, spec };
  state.teams[side].energy = energy;
}

describe('type wheel', () => {
  it('follows the triangle and the Radiant/Void pair', () => {
    expect(typeEffectiveness('fury', 'swift')).toBe('advantage');
    expect(typeEffectiveness('swift', 'guile')).toBe('advantage');
    expect(typeEffectiveness('guile', 'fury')).toBe('advantage');
    expect(typeEffectiveness('swift', 'fury')).toBe('disadvantage');
    expect(typeEffectiveness('radiant', 'void')).toBe('advantage');
    expect(typeEffectiveness('void', 'radiant')).toBe('advantage');
    expect(typeEffectiveness('fury', 'void')).toBe('neutral');
    expect(typeEffectiveness('fury', 'fury')).toBe('neutral');
  });
});

describe('roster data', () => {
  it('gives every fighter the 6-card deck shape from the design', () => {
    for (const fighter of [...PLAYER_TEAM, ...ENEMY_TEAM] as FighterSpec[]) {
      const kinds = fighter.deck.map((card) => card.kind).sort();
      expect(kinds).toEqual(['blast', 'blast', 'signature', 'strike', 'strike', 'technique']);
      expect(fighter.deck.find((c) => c.kind === 'technique')?.effect).toBeDefined();
    }
  });

  it('makes bigger cards more efficient per energy', () => {
    const deck = PLAYER_TEAM[0]?.deck ?? [];
    const efficiency = (kind: string) => {
      const card = deck.find((c) => c.kind === kind);
      if (!card) throw new Error(kind);
      return card.power / card.cost;
    };
    expect(efficiency('blast')).toBeGreaterThan(efficiency('strike'));
    expect(efficiency('signature')).toBeGreaterThan(efficiency('blast'));
  });
});

describe('duel setup', () => {
  it('fields the first fighter of each team with a full hand and starts the faster side', () => {
    const { state, events } = duel();
    expect(state.teams.player.activeIndex).toBe(0);
    expect(state.teams.enemy.activeIndex).toBe(0);
    expect(activeFighter(state.teams.player).hand).toHaveLength(BATTLE_RULES.handSize);
    expect(activeFighter(state.teams.enemy).hand).toHaveLength(BATTLE_RULES.handSize);
    const playerSpd = PLAYER_TEAM[0]?.spd ?? 0;
    const enemySpd = ENEMY_TEAM[0]?.spd ?? 0;
    expect(state.turnSide).toBe(playerSpd >= enemySpd ? 'player' : 'enemy');
    expect(events[0]).toMatchObject({ kind: 'turnStart', side: state.turnSide });
    expect(state.teams[state.turnSide].energy).toBe(
      BATTLE_RULES.startingEnergy + BATTLE_RULES.energyPerTurn,
    );
  });

  it('is deterministic for a seed', () => {
    const a = duel(42).state;
    const b = duel(42).state;
    const hand = (s: DuelState) => activeFighter(s.teams.player).hand.map((c) => c.spec.name);
    expect(hand(a)).toEqual(hand(b));
  });

  it('rejects teams that are not exactly three', () => {
    expect(() =>
      createDuel({ player: PLAYER_TEAM.slice(0, 2), enemy: ENEMY_TEAM, seed: 1 }),
    ).toThrow();
  });
});

describe('turns', () => {
  it('alternates sides and refills energy at each turn start', () => {
    const { state } = duel();
    const first = state.turnSide;
    const second = first === 'player' ? 'enemy' : 'player';
    passTurn(state, first);
    expect(state.turnSide).toBe(second);
    expect(state.teams[second].energy).toBe(
      BATTLE_RULES.startingEnergy + BATTLE_RULES.energyPerTurn,
    );
  });

  it('rejects actions out of turn', () => {
    const { state } = duel();
    const waiting = state.turnSide === 'player' ? 'enemy' : 'player';
    const result = applyAction(state, waiting, { kind: 'charge' });
    expect(result).toEqual({ ok: false, reason: 'Not your turn' });
  });

  it('charging adds energy, capped at the maximum', () => {
    const { state } = duel();
    const side = state.turnSide;
    state.teams[side].energy = BATTLE_RULES.maxEnergy - 1;
    passTurn(state, side);
    expect(state.teams[side].energy).toBe(BATTLE_RULES.maxEnergy);
  });

  it('refuses cards that cost more than the team has', () => {
    const { state } = duel();
    const side = state.turnSide;
    forceCard(state, side, { kind: 'signature', name: 'Big', cost: 5, power: 6 }, 4);
    expect(playBlockedReason(state, side, 0)).toBe('Not enough Rift Energy');
    expect(applyAction(state, side, { kind: 'play', handIndex: 0 }).ok).toBe(false);
  });
});

describe('cards', () => {
  it('deals exactly the previewed damage and spends energy', () => {
    const { state } = duel();
    const side = state.turnSide;
    const foeSide = side === 'player' ? 'enemy' : 'player';
    const card: CardSpec = { kind: 'blast', name: 'Test Blast', cost: 2, power: 2.2 };
    forceCard(state, side, card, 6);
    const attacker = activeFighter(state.teams[side]);
    const defender = activeFighter(state.teams[foeSide]);
    const preview = computeDamage(attacker, defender, card);
    const hpBefore = defender.hp;
    const result = applyAction(state, side, { kind: 'play', handIndex: 0 });
    expect(result.ok).toBe(true);
    expect(defender.hp).toBe(hpBefore - preview.amount);
    expect(state.teams[side].energy).toBe(4);
  });

  it('applies type advantage to damage', () => {
    const { state } = duel();
    const attacker = activeFighter(state.teams.player);
    const defender = activeFighter(state.teams.enemy);
    const card: CardSpec = { kind: 'strike', name: 'S', cost: 1, power: 1 };
    // Kaien (Fury) vs Rift Stalker (Swift) is advantaged.
    expect(computeDamage(attacker, defender, card).effectiveness).toBe('advantage');
    const neutral = computeDamage(
      attacker,
      { ...defender, spec: { ...defender.spec, type: 'void' } },
      card,
    );
    expect(computeDamage(attacker, defender, card).amount).toBeGreaterThan(neutral.amount);
  });

  it('Focus boosts the next attack once; Guard halves the next hit once', () => {
    const { state } = duel();
    const attacker = activeFighter(state.teams.player);
    const defender = activeFighter(state.teams.enemy);
    const card: CardSpec = { kind: 'strike', name: 'S', cost: 1, power: 1 };
    const base = computeDamage(attacker, defender, card).amount;
    attacker.focus = true;
    expect(computeDamage(attacker, defender, card).amount).toBeCloseTo(
      base * TECHNIQUE_TUNING.focusMultiplier,
      -1,
    );
    attacker.focus = false;
    defender.guard = true;
    expect(computeDamage(attacker, defender, card).amount).toBeCloseTo(
      base * TECHNIQUE_TUNING.guardMultiplier,
      -1,
    );
  });

  it('consumes Focus and Guard when an attack lands', () => {
    const { state } = duel();
    const side = state.turnSide;
    const foeSide = side === 'player' ? 'enemy' : 'player';
    activeFighter(state.teams[side]).focus = true;
    activeFighter(state.teams[foeSide]).guard = true;
    forceCard(state, side, { kind: 'strike', name: 'S', cost: 1, power: 1 });
    applyAction(state, side, { kind: 'play', handIndex: 0 });
    expect(activeFighter(state.teams[side]).focus).toBe(false);
    expect(activeFighter(state.teams[foeSide]).guard).toBe(false);
  });

  it('heals 25% of max HP without overhealing', () => {
    const { state } = duel();
    const side = state.turnSide;
    const fighter = activeFighter(state.teams[side]);
    fighter.hp = fighter.spec.hp - 50;
    forceCard(state, side, { kind: 'technique', name: 'H', cost: 3, power: 0, effect: 'heal' });
    const result = applyAction(state, side, { kind: 'play', handIndex: 0 });
    expect(fighter.hp).toBe(fighter.spec.hp);
    expect(result.ok && result.events.find((e) => e.kind === 'heal')).toMatchObject({ amount: 50 });
  });

  it('Sap lowers enemy Defence for two of their turns', () => {
    const { state } = duel();
    const side = state.turnSide;
    const foeSide = side === 'player' ? 'enemy' : 'player';
    forceCard(state, side, { kind: 'technique', name: 'Sap', cost: 2, power: 0, effect: 'sap' });
    applyAction(state, side, { kind: 'play', handIndex: 0 });
    const target = activeFighter(state.teams[foeSide]);
    expect(target.sapTurns).toBe(TECHNIQUE_TUNING.sapTurns);
    passTurn(state, foeSide);
    passTurn(state, side);
    expect(target.sapTurns).toBe(TECHNIQUE_TUNING.sapTurns - 1);
    passTurn(state, foeSide);
    passTurn(state, side);
    expect(target.sapTurns).toBe(0);
  });

  it('refills the hand to 3 at the start of each of your turns', () => {
    const { state } = duel();
    const side = state.turnSide;
    const foeSide = side === 'player' ? 'enemy' : 'player';
    forceCard(state, side, { kind: 'strike', name: 'S', cost: 1, power: 1 });
    applyAction(state, side, { kind: 'play', handIndex: 0 });
    expect(activeFighter(state.teams[side]).hand).toHaveLength(2);
    passTurn(state, foeSide);
    expect(activeFighter(state.teams[side]).hand).toHaveLength(3);
  });

  it('reshuffles the discard pile when the deck runs out', () => {
    const { state } = duel();
    const side = state.turnSide;
    const foeSide = side === 'player' ? 'enemy' : 'player';
    const fighter = activeFighter(state.teams[side]);
    for (let i = 0; i < 12; i++) {
      state.teams[side].energy = 10;
      const cheapest = fighter.hand.findIndex((c) => c.spec.power === 0 || c.spec.cost <= 10);
      applyAction(state, side, { kind: 'play', handIndex: Math.max(0, cheapest) });
      if (state.winner) break;
      activeFighter(state.teams[foeSide]).hp = 99999;
      passTurn(state, foeSide);
      expect(fighter.hand.length + fighter.drawPile.length + fighter.discard.length).toBe(6);
    }
  });
});

describe('switching', () => {
  it('is free: you can switch and still play a card the same turn', () => {
    const { state } = duel();
    const side = state.turnSide;
    const result = applyAction(state, side, { kind: 'switch', fighterIndex: 1 });
    expect(result.ok).toBe(true);
    expect(state.turnSide).toBe(side);
    expect(state.teams[side].activeIndex).toBe(1);
    expect(activeFighter(state.teams[side]).hand).toHaveLength(BATTLE_RULES.handSize);
  });

  it('allows only one switch per turn', () => {
    const { state } = duel();
    const side = state.turnSide;
    applyAction(state, side, { kind: 'switch', fighterIndex: 1 });
    expect(switchBlockedReason(state, side, 2)).toBe('Already switched this turn');
  });

  it('grants Tag Link energy when switching between different worlds', () => {
    const { state } = duel();
    state.turnSide = 'player';
    const before = state.teams.player.energy;
    const result = applyAction(state, 'player', { kind: 'switch', fighterIndex: 1 });
    expect(result.ok && result.events[0]).toMatchObject({ kind: 'switch', tagLink: true });
    expect(state.teams.player.energy).toBe(before + BATTLE_RULES.tagLinkEnergy);
  });

  it('keeps a swapped-out fighter out until after your next turn', () => {
    const { state } = duel();
    state.turnSide = 'player';
    applyAction(state, 'player', { kind: 'switch', fighterIndex: 1 });
    passTurn(state, 'player');
    passTurn(state, 'enemy');
    expect(switchBlockedReason(state, 'player', 0)).toBe('Just swapped out');
    passTurn(state, 'player');
    passTurn(state, 'enemy');
    expect(switchBlockedReason(state, 'player', 0)).toBeNull();
  });

  it('cannot switch to a knocked-out fighter or the active one', () => {
    const { state } = duel();
    state.turnSide = 'player';
    const fighter = state.teams.player.fighters[2];
    if (!fighter) throw new Error('missing');
    fighter.hp = 0;
    expect(switchBlockedReason(state, 'player', 2)).toBe('Knocked out');
    expect(switchBlockedReason(state, 'player', 0)).toBe('Already on the field');
  });
});

describe('knockouts', () => {
  it('auto-switches to the next living fighter, without Tag Link energy', () => {
    const { state } = duel();
    state.turnSide = 'player';
    activeFighter(state.teams.enemy).hp = 1;
    const energyBefore = state.teams.enemy.energy;
    forceCard(state, 'player', { kind: 'strike', name: 'S', cost: 1, power: 1 });
    const result = applyAction(state, 'player', { kind: 'play', handIndex: 0 });
    if (!result.ok) throw new Error(result.reason);
    const kinds = result.events.map((e) => e.kind);
    expect(kinds.slice(0, 4)).toEqual(['cardPlayed', 'damage', 'ko', 'switch']);
    expect(result.events[3]).toMatchObject({ auto: true, tagLink: false, to: 1 });
    expect(state.teams.enemy.activeIndex).toBe(1);
    expect(activeFighter(state.teams.enemy).hand).toHaveLength(BATTLE_RULES.handSize);
    // Enemy energy only changed by its own turn start.
    expect(state.teams.enemy.energy).toBe(Math.min(10, energyBefore + BATTLE_RULES.energyPerTurn));
  });

  it('skips fighters that are already knocked out', () => {
    const { state } = duel();
    state.turnSide = 'player';
    const second = state.teams.enemy.fighters[1];
    if (!second) throw new Error('missing');
    second.hp = 0;
    activeFighter(state.teams.enemy).hp = 1;
    forceCard(state, 'player', { kind: 'strike', name: 'S', cost: 1, power: 1 });
    applyAction(state, 'player', { kind: 'play', handIndex: 0 });
    expect(state.teams.enemy.activeIndex).toBe(2);
  });

  it('ends the battle when the last fighter falls, and stops accepting actions', () => {
    const { state } = duel();
    state.turnSide = 'player';
    state.teams.enemy.fighters.forEach((f, i) => (f.hp = i === 0 ? 1 : 0));
    forceCard(state, 'player', { kind: 'strike', name: 'S', cost: 1, power: 1 });
    const result = applyAction(state, 'player', { kind: 'play', handIndex: 0 });
    expect(result.ok && result.events.at(-1)).toEqual({ kind: 'battleEnd', winner: 'player' });
    expect(state.winner).toBe('player');
    expect(applyAction(state, 'enemy', { kind: 'charge' }).ok).toBe(false);
  });
});

describe('enemy AI', () => {
  /** Lets the AI play both sides until someone wins; returns the turn count. */
  function autoplay(seed: number): { winner: Side | null; turns: number } {
    const { state } = duel(seed);
    let actions = 0;
    while (!state.winner && actions < 400) {
      const side = state.turnSide;
      const result = applyAction(state, side, chooseAction(state, side));
      if (!result.ok) applyAction(state, side, { kind: 'charge' });
      actions++;
    }
    return { winner: state.winner, turns: state.turnNumber };
  }

  it('always produces a legal action, and battles always finish', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { state } = duel(seed);
      let actions = 0;
      while (!state.winner && actions < 400) {
        const side = state.turnSide;
        const result = applyAction(state, side, chooseAction(state, side));
        expect(result.ok).toBe(true);
        actions++;
      }
      expect(state.winner).not.toBeNull();
    }
  });

  it('keeps battles in the 2–4 minute range (about 15–45 turns)', () => {
    const turns = Array.from({ length: 40 }, (_, i) => autoplay(i + 1).turns);
    const average = turns.reduce((a, b) => a + b, 0) / turns.length;
    expect(average).toBeGreaterThan(15);
    expect(average).toBeLessThan(45);
  });

  it('takes a knockout when one is available', () => {
    const { state } = duel();
    state.turnSide = 'enemy';
    activeFighter(state.teams.player).hp = 1;
    state.teams.enemy.energy = 1;
    forceCard(state, 'enemy', { kind: 'strike', name: 'S', cost: 1, power: 1 }, 1);
    expect(chooseAction(state, 'enemy')).toEqual({ kind: 'play', handIndex: 0 });
  });

  it('charges when nothing is affordable', () => {
    const { state } = duel();
    state.turnSide = 'enemy';
    const me = activeFighter(state.teams.enemy);
    me.hand = me.hand.map((card) => ({ ...card, spec: { ...card.spec, cost: 9 } }));
    state.teams.enemy.energy = 0;
    // Make every switch unattractive so the charge path is reached.
    state.teams.enemy.switchedThisTurn = true;
    expect(chooseAction(state, 'enemy')).toEqual({ kind: 'charge' });
  });
});

describe('combos', () => {
  const strike: CardSpec = { kind: 'strike', name: 'S', cost: 1, power: 1 };
  const blast: CardSpec = { kind: 'blast', name: 'B', cost: 2, power: 2.2 };

  /** Plays a forced card for the player, then lets the enemy charge, returning the play events. */
  function playerPlays(state: DuelState, card: CardSpec) {
    state.turnSide = 'player';
    forceCard(state, 'player', card);
    activeFighter(state.teams.enemy).hp = 99999;
    const result = applyAction(state, 'player', { kind: 'play', handIndex: 0 });
    if (!result.ok) throw new Error(result.reason);
    // applyAction hands the turn to the enemy (TypeScript can't see that mutation).
    if ((state.turnSide as Side) === 'enemy') passTurn(state, 'enemy');
    return result.events;
  }

  it('gives a Blast after a Strike the combo bonus, and reports it', () => {
    const { state } = duel();
    playerPlays(state, strike);
    const events = playerPlays(state, blast);
    expect(events[0]).toMatchObject({ kind: 'cardPlayed', combo: true });
  });

  it('does not combo on the first attack or on a lower tier', () => {
    const { state } = duel();
    expect(playerPlays(state, blast)[0]).toMatchObject({ combo: false });
    expect(playerPlays(state, strike)[0]).toMatchObject({ combo: false });
  });

  it('adds exactly the combo bonus to damage', () => {
    const { state } = duel();
    const attacker = activeFighter(state.teams.player);
    const defender = activeFighter(state.teams.enemy);
    const plain = computeDamage(attacker, defender, blast).amount;
    const comboed = computeDamage(attacker, defender, blast, { combo: true }).amount;
    expect(comboed).toBeCloseTo(plain * (1 + COMBO.bonus), -1);
  });

  it('keeps the chain through a switch, and Charge breaks it', () => {
    const { state } = duel();
    playerPlays(state, strike);
    state.turnSide = 'player';
    applyAction(state, 'player', { kind: 'switch', fighterIndex: 1 });
    expect(cardContinuesComboFor(state, blast)).toBe(true);
    passTurn(state, 'player');
    passTurn(state, 'enemy');
    expect(cardContinuesComboFor(state, blast)).toBe(false);
  });

  function cardContinuesComboFor(state: DuelState, card: CardSpec): boolean {
    forceCard(state, 'player', card);
    return cardContinuesCombo(state, 'player', 0);
  }
});

describe('Drain', () => {
  it('steals enemy energy (never below zero) and gives some back', () => {
    const { state } = duel();
    state.turnSide = 'player';
    state.teams.enemy.energy = 1;
    forceCard(
      state,
      'player',
      { kind: 'technique', name: 'D', cost: 2, power: 0, effect: 'drain' },
      5,
    );
    const result = applyAction(state, 'player', { kind: 'play', handIndex: 0 });
    expect(result.ok && result.events.find((e) => e.kind === 'drain')).toMatchObject({
      side: 'enemy',
      amount: 1,
      energy: 0,
      gainerEnergy: 5 - 2 + DRAIN.gain,
    });
  });
});

describe('Crossover Burst', () => {
  it('lists bench partners from other worlds who are still standing', () => {
    const { state } = duel();
    expect(crossoverPartners(state, 'player')).toEqual([1, 2]);
    const torvan = state.teams.player.fighters[2];
    if (!torvan) throw new Error('missing');
    torvan.hp = 0;
    expect(crossoverPartners(state, 'player')).toEqual([1]);
  });

  it('is impossible for a team from a single world (the Rift enemies)', () => {
    const { state } = duel();
    expect(crossoverPartners(state, 'enemy')).toEqual([]);
  });

  it('needs full Rift Energy and costs all of it', () => {
    const { state } = duel();
    state.turnSide = 'player';
    state.teams.player.energy = CROSSOVER.cost - 1;
    expect(crossoverBlockedReason(state, 'player', 1)).toBe(`Needs ${CROSSOVER.cost} Rift Energy`);
    state.teams.player.energy = CROSSOVER.cost;
    activeFighter(state.teams.enemy).hp = 99999;
    const result = applyAction(state, 'player', { kind: 'crossover', partnerIndex: 1 });
    expect(result.ok).toBe(true);
    expect(result.ok && result.events[0]).toMatchObject({
      kind: 'crossover',
      name: 'Sunbreak Riptide',
      energy: 0,
    });
  });

  it('deals exactly the previewed damage, combining both fighters', () => {
    const { state } = duel();
    state.turnSide = 'player';
    state.teams.player.energy = CROSSOVER.cost;
    const enemy = activeFighter(state.teams.enemy);
    enemy.hp = 99999;
    const preview = previewCrossover(state, 'player', 2);
    const solo = computeDamage(activeFighter(state.teams.player), enemy, CROSSOVER).amount;
    expect(preview).toBeGreaterThan(solo);
    applyAction(state, 'player', { kind: 'crossover', partnerIndex: 2 });
    expect(enemy.hp).toBe(99999 - preview);
  });

  it("applies the partner's type effect: Swift refunds energy, Guile saps", () => {
    const swift = duel();
    swift.state.turnSide = 'player';
    swift.state.teams.player.energy = CROSSOVER.cost;
    activeFighter(swift.state.teams.enemy).hp = 99999;
    applyAction(swift.state, 'player', { kind: 'crossover', partnerIndex: 1 }); // Maris (Swift)
    // Refund lands before the enemy turn starts; the enemy then acts, so check the event stream.
    const guile = duel();
    guile.state.turnSide = 'player';
    guile.state.teams.player.energy = CROSSOVER.cost;
    const target = activeFighter(guile.state.teams.enemy);
    target.hp = 99999;
    const result = applyAction(guile.state, 'player', { kind: 'crossover', partnerIndex: 2 }); // Torvan (Guile)
    expect(result.ok && result.events.some((e) => e.kind === 'status' && e.status === 'sap')).toBe(
      true,
    );
    expect(target.sapTurns).toBeGreaterThan(0);
    expect(swift.state.teams.player.energy).toBe(CROSSOVER_PARTNER_EFFECT.swift.amount);
  });

  it('resets the combo chain', () => {
    const { state } = duel();
    state.turnSide = 'player';
    state.teams.player.comboTier = 2;
    state.teams.player.energy = CROSSOVER.cost;
    activeFighter(state.teams.enemy).hp = 99999;
    applyAction(state, 'player', { kind: 'crossover', partnerIndex: 1 });
    expect(state.teams.player.comboTier).toBe(0);
  });
});

describe('Signature telegraph', () => {
  it('warns when the active fighter holds a Signature it can afford next turn', () => {
    const { state } = duel();
    const enemy = activeFighter(state.teams.enemy);
    enemy.hand[0] = { uid: 777, spec: { kind: 'signature', name: 'Big', cost: 5, power: 6 } };
    state.teams.enemy.energy = 5 - BATTLE_RULES.energyPerTurn - 1;
    expect(signatureThreat(state, 'enemy')).toBeNull();
    state.teams.enemy.energy = 5 - BATTLE_RULES.energyPerTurn;
    const threat = signatureThreat(state, 'enemy');
    expect(threat?.card.name).toBe('Big');
    expect(threat?.damage).toBe(
      computeDamage(enemy, activeFighter(state.teams.player), threat?.card ?? enemy.hand[0].spec)
        .amount,
    );
  });

  it('does not warn without a Signature in hand', () => {
    const { state } = duel();
    const enemy = activeFighter(state.teams.enemy);
    enemy.hand = enemy.hand.filter((c) => c.spec.kind !== 'signature');
    state.teams.enemy.energy = 10;
    expect(signatureThreat(state, 'enemy')).toBeNull();
  });
});

describe('AI profiles', () => {
  it('a tactician drains a player who is about to afford big moves', () => {
    const { state } = duel();
    state.turnSide = 'enemy';
    const enemyTeam = state.teams.enemy;
    enemyTeam.activeIndex = 0; // Rift Stalker carries Phase Siphon (drain)
    const me = activeFighter(enemyTeam);
    me.hand = [
      { uid: 1, spec: { kind: 'technique', name: 'Drain', cost: 2, power: 0, effect: 'drain' } },
    ];
    enemyTeam.energy = 2;
    enemyTeam.switchedThisTurn = true;
    state.teams.player.energy = 6;
    expect(chooseAction(state, 'enemy')).toEqual({ kind: 'play', handIndex: 0 });
  });

  it('a tactician charges when that unlocks its Signature next turn', () => {
    const { state } = duel();
    state.turnSide = 'enemy';
    const enemyTeam = state.teams.enemy;
    enemyTeam.activeIndex = 1; // Rift Shade: tactician
    enemyTeam.switchedThisTurn = true;
    const me = activeFighter(enemyTeam);
    me.hand = [
      { uid: 1, spec: { kind: 'signature', name: 'Sig', cost: 5, power: 6 } },
      { uid: 2, spec: { kind: 'strike', name: 'S', cost: 1, power: 1 } },
    ];
    enemyTeam.energy = 1;
    activeFighter(state.teams.player).hp = 99999;
    expect(chooseAction(state, 'enemy')).toEqual({ kind: 'charge' });
  });

  it('an aggressor never switches for type advantage', () => {
    const { state } = duel();
    state.turnSide = 'enemy';
    state.teams.enemy.activeIndex = 2; // Rift Brute: aggressor
    activeFighter(state.teams.player).hp = 99999;
    for (let i = 0; i < 20; i++) {
      expect(chooseAction(state, 'enemy').kind).not.toBe('switch');
    }
  });

  it('uses a Crossover to finish when it can (mirror test with the player team)', () => {
    const { state } = duel();
    state.turnSide = 'player';
    state.teams.player.energy = CROSSOVER.cost;
    const me = activeFighter(state.teams.player);
    me.hand = [
      { uid: 1, spec: { kind: 'technique', name: 'F', cost: 2, power: 0, effect: 'focus' } },
    ];
    activeFighter(state.teams.enemy).hp = 300;
    expect(chooseAction(state, 'player').kind).toBe('crossover');
  });
});
