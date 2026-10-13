import { AI_PROFILES, BATTLE_RULES } from '../../config/battle';

const SIGNATURE_RANGE = 5;
import { typeEffectiveness } from './damage';
import {
  activeFighter,
  crossoverBlockedReason,
  crossoverPartners,
  otherSide,
  playBlockedReason,
  previewCardDamage,
  previewCrossover,
  switchBlockedReason,
} from './rules';
import type { DuelAction, DuelState, Side } from './types';

/**
 * Enemy decision for one action (game-design.md §4.8). Called repeatedly during the AI's turn:
 * a switch keeps the turn going, so the next call picks a card for the new fighter.
 * Same rules and information as the player: it sees its own hand and the public board.
 * Priorities are shaped by the active fighter's behaviour profile (config/battle.ts AI_PROFILES).
 */
export function chooseAction(state: DuelState, side: Side): DuelAction {
  const team = state.teams[side];
  const foeTeam = state.teams[otherSide(side)];
  const me = activeFighter(team);
  const foe = activeFighter(foeTeam);
  const profile = AI_PROFILES[me.spec.ai];

  const playable = me.hand
    .map((card, handIndex) => ({ card, handIndex }))
    .filter(({ handIndex }) => playBlockedReason(state, side, handIndex) === null);
  const attacks = playable
    .filter(({ card }) => card.spec.power > 0)
    .map((entry) => ({
      ...entry,
      damage: previewCardDamage(state, side, entry.handIndex).amount,
    }))
    .sort((a, b) => b.damage - a.damage);
  const technique = (effect: string) => playable.find(({ card }) => card.spec.effect === effect);

  // 1. Take a knockout when one is available (a Crossover counts).
  const crossovers = crossoverPartners(state, side)
    .filter((partnerIndex) => crossoverBlockedReason(state, side, partnerIndex) === null)
    .map((partnerIndex) => ({ partnerIndex, damage: previewCrossover(state, side, partnerIndex) }))
    .sort((a, b) => b.damage - a.damage);
  const finisher = attacks.find((attack) => attack.damage >= foe.hp);
  if (finisher) return { kind: 'play', handIndex: finisher.handIndex };
  const bestCrossover = crossovers[0];
  if (bestCrossover && bestCrossover.damage >= foe.hp) {
    return { kind: 'crossover', partnerIndex: bestCrossover.partnerIndex };
  }

  // 2. Protect a badly hurt fighter.
  if (me.hp / me.spec.hp < profile.lowHpFraction) {
    const heal = technique('heal');
    const guard = me.guard ? undefined : technique('guard');
    const protect = heal ?? guard;
    if (protect) return { kind: 'play', handIndex: protect.handIndex };
  }

  // 3. Switch toward type advantage, or away from a type disadvantage.
  if (
    profile.switchForAdvantage &&
    typeEffectiveness(me.spec.type, foe.spec.type) !== 'advantage'
  ) {
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

  // 4. Crossover whenever it is ready, then Signature whenever affordable.
  if (bestCrossover) return { kind: 'crossover', partnerIndex: bestCrossover.partnerIndex };
  const signature = attacks.find(({ card }) => card.spec.kind === 'signature');
  if (signature) return { kind: 'play', handIndex: signature.handIndex };

  // 5. Drain an opponent who is close to a Crossover or about to afford a big move.
  const drain = technique('drain');
  // Drain when the opponent will reach Signature range (cost 5) next turn; that also covers a
  // Crossover building up, which needs even more.
  if (drain && foeTeam.energy + BATTLE_RULES.energyPerTurn >= SIGNATURE_RANGE) {
    return { kind: 'play', handIndex: drain.handIndex };
  }

  // 6. Save up when that unlocks this fighter's Signature next turn.
  const heldSignature = me.hand.find(({ spec }) => spec.kind === 'signature');
  if (
    profile.savesForSignature &&
    heldSignature &&
    team.energy < heldSignature.spec.cost &&
    team.energy + BATTLE_RULES.chargeEnergy + BATTLE_RULES.energyPerTurn >=
      heldSignature.spec.cost &&
    team.energy + BATTLE_RULES.energyPerTurn < heldSignature.spec.cost
  ) {
    return { kind: 'charge' };
  }

  // 7. Focus or Sap before a big hit when there is energy to spare.
  const focus = technique('focus');
  if (focus && !me.focus && team.energy >= focus.card.spec.cost + profile.techniqueEnergyMargin) {
    return { kind: 'play', handIndex: focus.handIndex };
  }
  const sap = technique('sap');
  if (
    sap &&
    foe.sapTurns === 0 &&
    team.energy >= sap.card.spec.cost + profile.techniqueEnergyMargin
  ) {
    return { kind: 'play', handIndex: sap.handIndex };
  }

  // 8. Strongest affordable attack (combo bonus included), otherwise build energy.
  const best = attacks[0];
  if (best) return { kind: 'play', handIndex: best.handIndex };
  return { kind: 'charge' };
}
