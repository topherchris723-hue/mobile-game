import { BATTLE_RULES, TECHNIQUE_TUNING } from '../../config/battle';
import type { FighterSpec } from '../../config/fighters';
import { createRng, type Rng } from '../../core/rng';
import { computeDamage } from './damage';
import type {
  ActionResult,
  CardInstance,
  DuelAction,
  DuelEvent,
  DuelState,
  FighterState,
  Side,
  TeamState,
} from './types';

/*
 * Rift Duel rules (game-design.md §4). Pure and deterministic: given the same seed and actions,
 * a duel always plays out identically. Every mutation is reported as a DuelEvent.
 */

export function isBattleOver(state: DuelState): boolean {
  return state.winner !== null;
}

export function otherSide(side: Side): Side {
  return side === 'player' ? 'enemy' : 'player';
}

export function activeFighter(team: TeamState): FighterState {
  const fighter = team.fighters[team.activeIndex];
  if (!fighter) throw new Error(`Team ${team.side} has no fighter at ${team.activeIndex}`);
  return fighter;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const a = items[i];
    const b = items[j];
    if (a === undefined || b === undefined) continue;
    items[i] = b;
    items[j] = a;
  }
  return items;
}

function createFighter(
  spec: FighterSpec,
  state: Pick<DuelState, 'rng' | 'nextCardUid'>,
): FighterState {
  const cards: CardInstance[] = spec.deck.map((card) => ({ uid: state.nextCardUid++, spec: card }));
  return {
    spec,
    hp: spec.hp,
    hand: [],
    drawPile: shuffle(cards, state.rng),
    discard: [],
    focus: false,
    guard: false,
    sapTurns: 0,
    switchCooldown: 0,
  };
}

function fillHand(fighter: FighterState, rng: Rng): void {
  while (fighter.hand.length < BATTLE_RULES.handSize) {
    if (fighter.drawPile.length === 0) {
      if (fighter.discard.length === 0) return;
      fighter.drawPile = shuffle(fighter.discard, rng);
      fighter.discard = [];
    }
    const card = fighter.drawPile.pop();
    if (!card) return;
    fighter.hand.push(card);
  }
}

function gainEnergy(team: TeamState, amount: number): void {
  team.energy = Math.min(BATTLE_RULES.maxEnergy, team.energy + amount);
}

function startTurn(state: DuelState, side: Side, events: DuelEvent[]): void {
  const team = state.teams[side];
  state.turnSide = side;
  team.switchedThisTurn = false;
  for (const fighter of team.fighters) {
    if (fighter.switchCooldown > 0) fighter.switchCooldown--;
    if (fighter.sapTurns > 0) fighter.sapTurns--;
  }
  gainEnergy(team, BATTLE_RULES.energyPerTurn);
  fillHand(activeFighter(team), state.rng);
  events.push({ kind: 'turnStart', side, turnNumber: state.turnNumber, energy: team.energy });
}

export interface DuelSetup {
  readonly player: readonly FighterSpec[];
  readonly enemy: readonly FighterSpec[];
  readonly seed: number;
}

/** Creates a duel and starts the first turn. The faster active fighter goes first; ties go to the player. */
export function createDuel(setup: DuelSetup): { state: DuelState; events: DuelEvent[] } {
  if (
    setup.player.length !== BATTLE_RULES.teamSize ||
    setup.enemy.length !== BATTLE_RULES.teamSize
  ) {
    throw new Error(`Both teams need exactly ${BATTLE_RULES.teamSize} fighters`);
  }
  const seedState = { rng: createRng(setup.seed), nextCardUid: 1 };
  const makeTeam = (side: Side, specs: readonly FighterSpec[]): TeamState => ({
    side,
    fighters: specs.map((spec) => createFighter(spec, seedState)),
    activeIndex: 0,
    energy: BATTLE_RULES.startingEnergy,
    switchedThisTurn: false,
  });
  const teams = { player: makeTeam('player', setup.player), enemy: makeTeam('enemy', setup.enemy) };
  const playerSpeed = activeFighter(teams.player).spec.spd;
  const enemySpeed = activeFighter(teams.enemy).spec.spd;
  const first: Side = playerSpeed >= enemySpeed ? 'player' : 'enemy';

  const state: DuelState = {
    teams,
    turnSide: first,
    turnNumber: 1,
    winner: null,
    rng: seedState.rng,
    nextCardUid: seedState.nextCardUid,
  };
  fillHand(activeFighter(teams.player), state.rng);
  fillHand(activeFighter(teams.enemy), state.rng);
  const events: DuelEvent[] = [];
  startTurn(state, first, events);
  return { state, events };
}

/** Why the side can't tag in this fighter right now, or null if it can. */
export function switchBlockedReason(
  state: DuelState,
  side: Side,
  fighterIndex: number,
): string | null {
  const team = state.teams[side];
  const target = team.fighters[fighterIndex];
  if (state.winner) return 'The battle is over';
  if (state.turnSide !== side) return 'Not your turn';
  if (!target) return 'No such fighter';
  if (fighterIndex === team.activeIndex) return 'Already on the field';
  if (target.hp <= 0) return 'Knocked out';
  if (team.switchedThisTurn) return 'Already switched this turn';
  if (target.switchCooldown > 0) return 'Just swapped out';
  return null;
}

/** Why the side can't play this hand card right now, or null if it can. */
export function playBlockedReason(state: DuelState, side: Side, handIndex: number): string | null {
  const team = state.teams[side];
  const card = activeFighter(team).hand[handIndex];
  if (state.winner) return 'The battle is over';
  if (state.turnSide !== side) return 'Not your turn';
  if (!card) return 'No such card';
  if (card.spec.cost > team.energy) return 'Not enough Rift Energy';
  return null;
}

function bringIn(
  state: DuelState,
  team: TeamState,
  toIndex: number,
  auto: boolean,
  events: DuelEvent[],
): void {
  const from = team.activeIndex;
  const outgoing = activeFighter(team);
  const incoming = team.fighters[toIndex];
  if (!incoming) throw new Error(`No fighter ${toIndex}`);
  const tagLink = !auto && outgoing.spec.world !== incoming.spec.world;
  if (!auto) {
    outgoing.switchCooldown = BATTLE_RULES.switchCooldownTurns + 1;
    team.switchedThisTurn = true;
    if (tagLink) gainEnergy(team, BATTLE_RULES.tagLinkEnergy);
  }
  team.activeIndex = toIndex;
  fillHand(incoming, state.rng);
  events.push({
    kind: 'switch',
    side: team.side,
    from,
    to: toIndex,
    auto,
    tagLink,
    energy: team.energy,
  });
}

function handleKnockout(state: DuelState, side: Side, events: DuelEvent[]): void {
  const team = state.teams[side];
  events.push({ kind: 'ko', side, fighterIndex: team.activeIndex });
  const next = team.fighters.findIndex((fighter) => fighter.hp > 0);
  if (next === -1) {
    state.winner = otherSide(side);
    events.push({ kind: 'battleEnd', winner: state.winner });
    return;
  }
  bringIn(state, team, next, true, events);
}

function playCard(state: DuelState, side: Side, handIndex: number, events: DuelEvent[]): void {
  const team = state.teams[side];
  const foeTeam = state.teams[otherSide(side)];
  const attacker = activeFighter(team);
  const [card] = attacker.hand.splice(handIndex, 1);
  if (!card) throw new Error('Card vanished from hand');
  team.energy -= card.spec.cost;
  attacker.discard.push(card);
  events.push({
    kind: 'cardPlayed',
    side,
    fighterIndex: team.activeIndex,
    card: card.spec,
    energy: team.energy,
  });

  const spec = card.spec;
  if (spec.power > 0) {
    const defender = activeFighter(foeTeam);
    const { amount, effectiveness } = computeDamage(attacker, defender, spec);
    const guarded = defender.guard;
    attacker.focus = false;
    defender.guard = false;
    defender.hp = Math.max(0, defender.hp - amount);
    events.push({
      kind: 'damage',
      side: foeTeam.side,
      fighterIndex: foeTeam.activeIndex,
      amount,
      hp: defender.hp,
      effectiveness,
      guarded,
    });
    if (defender.hp === 0) handleKnockout(state, foeTeam.side, events);
    return;
  }

  switch (spec.effect) {
    case 'focus':
      attacker.focus = true;
      events.push({ kind: 'status', side, fighterIndex: team.activeIndex, status: 'focus' });
      break;
    case 'guard':
      attacker.guard = true;
      events.push({ kind: 'status', side, fighterIndex: team.activeIndex, status: 'guard' });
      break;
    case 'heal': {
      const amount = Math.min(
        attacker.spec.hp - attacker.hp,
        Math.round(attacker.spec.hp * TECHNIQUE_TUNING.healFraction),
      );
      attacker.hp += amount;
      events.push({ kind: 'heal', side, fighterIndex: team.activeIndex, amount, hp: attacker.hp });
      break;
    }
    case 'sap': {
      const target = activeFighter(foeTeam);
      // +1 because the sapped team's next turn start ticks it down immediately.
      target.sapTurns = TECHNIQUE_TUNING.sapTurns + 1;
      events.push({
        kind: 'status',
        side: foeTeam.side,
        fighterIndex: foeTeam.activeIndex,
        status: 'sap',
      });
      break;
    }
    case undefined:
      throw new Error(`Technique ${spec.name} has no effect`);
  }
}

/**
 * Applies one action for `side`. Switching keeps the turn going; playing a card or charging ends it
 * and starts the other side's turn (unless the battle is over).
 */
export function applyAction(state: DuelState, side: Side, action: DuelAction): ActionResult {
  const events: DuelEvent[] = [];
  const team = state.teams[side];

  if (action.kind === 'switch') {
    const reason = switchBlockedReason(state, side, action.fighterIndex);
    if (reason) return { ok: false, reason };
    bringIn(state, team, action.fighterIndex, false, events);
    return { ok: true, events };
  }

  if (state.winner) return { ok: false, reason: 'The battle is over' };
  if (state.turnSide !== side) return { ok: false, reason: 'Not your turn' };

  if (action.kind === 'play') {
    const reason = playBlockedReason(state, side, action.handIndex);
    if (reason) return { ok: false, reason };
    playCard(state, side, action.handIndex, events);
  } else {
    gainEnergy(team, BATTLE_RULES.chargeEnergy);
    events.push({ kind: 'charge', side, energy: team.energy });
  }

  // Playing a card may have ended the battle (checked via a call: TypeScript can't see that
  // playCard mutates state.winner).
  if (!isBattleOver(state)) {
    state.turnNumber++;
    startTurn(state, otherSide(side), events);
  }
  return { ok: true, events };
}
