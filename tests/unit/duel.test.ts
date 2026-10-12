import { describe, expect, it } from 'vitest';
import { BATTLE_RULES, TECHNIQUE_TUNING } from '../../src/config/battle';
import {
  ENEMY_TEAM,
  PLAYER_TEAM,
  type CardSpec,
  type FighterSpec,
} from '../../src/config/fighters';
import { chooseAction } from '../../src/game/duel/ai';
import { computeDamage, typeEffectiveness } from '../../src/game/duel/damage';
import {
  activeFighter,
  applyAction,
  createDuel,
  playBlockedReason,
  switchBlockedReason,
} from '../../src/game/duel/rules';
import type { DuelState, Side } from '../../src/game/duel/types';

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
