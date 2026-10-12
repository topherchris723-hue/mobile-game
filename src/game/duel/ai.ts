import { computeDamage, typeEffectiveness } from './damage';
import { activeFighter, otherSide, playBlockedReason, switchBlockedReason } from './rules';
import type { DuelAction, DuelState, Side } from './types';

const LOW_HP_FRACTION = 0.35;

/**
 * Enemy decision for one action (game-design.md §4.8). Called repeatedly during the AI's turn:
 * a switch keeps the turn going, so the next call picks a card for the new fighter.
 * Same rules and information as the player: it only sees its own hand.
 */
export function chooseAction(state: DuelState, side: Side): DuelAction {
  const team = state.teams[side];
  const foeTeam = state.teams[otherSide(side)];
  const me = activeFighter(team);
  const foe = activeFighter(foeTeam);

  const playable = me.hand
    .map((card, handIndex) => ({ card, handIndex }))
    .filter(({ handIndex }) => playBlockedReason(state, side, handIndex) === null);
  const attacks = playable
    .filter(({ card }) => card.spec.power > 0)
    .map((entry) => ({ ...entry, damage: computeDamage(me, foe, entry.card.spec).amount }))
    .sort((a, b) => b.damage - a.damage);

  // 1. Take a knockout when one is available.
  const finisher = attacks.find((attack) => attack.damage >= foe.hp);
  if (finisher) return { kind: 'play', handIndex: finisher.handIndex };

  // 2. Protect a badly hurt fighter.
  if (me.hp / me.spec.hp < LOW_HP_FRACTION) {
    const protect = playable.find(
      ({ card }) => card.spec.effect === 'heal' || (card.spec.effect === 'guard' && !me.guard),
    );
    if (protect) return { kind: 'play', handIndex: protect.handIndex };
  }

  // 3. Switch toward type advantage, or away from a type disadvantage.
  const myEdge = typeEffectiveness(me.spec.type, foe.spec.type);
  if (myEdge !== 'advantage') {
    const candidates = team.fighters
      .map((fighter, fighterIndex) => ({ fighter, fighterIndex }))
      .filter(({ fighterIndex }) => switchBlockedReason(state, side, fighterIndex) === null);
    const better =
      candidates.find(
        ({ fighter }) => typeEffectiveness(fighter.spec.type, foe.spec.type) === 'advantage',
      ) ??
      (typeEffectiveness(foe.spec.type, me.spec.type) === 'advantage'
        ? candidates.find(
            ({ fighter }) => typeEffectiveness(foe.spec.type, fighter.spec.type) !== 'advantage',
          )
        : undefined);
    if (better) return { kind: 'switch', fighterIndex: better.fighterIndex };
  }

  // 4. Signature whenever affordable.
  const signature = attacks.find(({ card }) => card.spec.kind === 'signature');
  if (signature) return { kind: 'play', handIndex: signature.handIndex };

  // 5. Focus before a big hit when there is energy to spare.
  const focus = playable.find(({ card }) => card.spec.effect === 'focus');
  if (focus && !me.focus && team.energy >= focus.card.spec.cost + 2) {
    return { kind: 'play', handIndex: focus.handIndex };
  }
  const sap = playable.find(({ card }) => card.spec.effect === 'sap');
  if (sap && foe.sapTurns === 0 && team.energy >= sap.card.spec.cost + 2) {
    return { kind: 'play', handIndex: sap.handIndex };
  }

  // 6. Strongest affordable attack, otherwise build energy.
  const best = attacks[0];
  if (best) return { kind: 'play', handIndex: best.handIndex };
  return { kind: 'charge' };
}
