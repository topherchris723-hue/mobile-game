import { COMBO, TECHNIQUE_TUNING, TYPE_MULTIPLIER } from '../../config/battle';
import { PASSIVE_TUNING } from '../../config/passives';
import type { CardKind, CardSpec, TypeId } from '../../config/fighters';
import type { Effectiveness, FighterState } from './types';

const STRONG_AGAINST: Readonly<Record<TypeId, TypeId>> = {
  fury: 'swift',
  swift: 'guile',
  guile: 'fury',
  radiant: 'void',
  void: 'radiant',
};

/** Type wheel from game-design.md §4.5. Radiant and Void are each strong against the other. */
export function typeEffectiveness(attacker: TypeId, defender: TypeId): Effectiveness {
  if (STRONG_AGAINST[attacker] === defender) return 'advantage';
  if (STRONG_AGAINST[defender] === attacker) return 'disadvantage';
  return 'neutral';
}

export interface DamagePreview {
  readonly amount: number;
  readonly effectiveness: Effectiveness;
}

/** Extra conditions on top of the fighters' own state. */
export interface DamageModifiers {
  /** The attack continues a combo chain (COMBO.bonus). */
  readonly combo?: boolean;
  /** Extra damage fraction, e.g. a Fury partner's Crossover bonus. */
  readonly bonus?: number;
  /** Crossover: the partner's ATK is added to the attacker's. */
  readonly partnerAtk?: number;
  /** Damage reduction from the defender's bench (Beacon), as a fraction. */
  readonly benchReduction?: number;
}

/** What hit: a card (by kind) or a Crossover, which has no card kind. */
export type DamageSource = Pick<CardSpec, 'power'> & { readonly kind?: CardKind };

/** Rising Ember's ATK bonus for a fighter right now. */
export function risingEmberBonus(fighter: FighterState): number {
  if (fighter.spec.passive !== 'risingEmber') return 0;
  const { perTurn, max } = PASSIVE_TUNING.risingEmber;
  return Math.min(max, perTurn * fighter.fieldTurns);
}

/** Which Passives would change this hit (for events and previews); pure, mutates nothing. */
export function hitPassives(
  attacker: FighterState,
  defender: FighterState,
  source: DamageSource,
): {
  readonly pierce: boolean;
  readonly veil: boolean;
  readonly basalt: boolean;
  readonly current: boolean;
  readonly pride: boolean;
  readonly gale: boolean;
} {
  const gale = attacker.spec.passive === 'galeStep' && attacker.galeReady;
  return {
    gale,
    pierce: gale && defender.guard,
    veil: defender.spec.passive === 'inkVeil' && defender.veilReady,
    basalt: defender.spec.passive === 'basaltSkin' && source.kind === 'blast',
    current: defender.spec.passive === 'readTheCurrent' && source.kind === 'signature',
    pride: attacker.spec.passive === 'ashenPride' && defender.sapTurns > 0,
  };
}

/**
 * Exact damage a card would deal right now (game-design.md §4.7). There is no random variance,
 * so the number shown on a card is the number dealt.
 */
export function computeDamage(
  attacker: FighterState,
  defender: FighterState,
  card: DamageSource,
  modifiers: DamageModifiers = {},
): DamagePreview {
  const effectiveness = typeEffectiveness(attacker.spec.type, defender.spec.type);
  if (card.power <= 0) return { amount: 0, effectiveness };
  const passives = hitPassives(attacker, defender, card);
  const typeMultiplier = TYPE_MULTIPLIER[effectiveness];
  const focus = attacker.focus ? TECHNIQUE_TUNING.focusMultiplier : 1;
  const guard = defender.guard && !passives.pierce ? TECHNIQUE_TUNING.guardMultiplier : 1;
  const combo = modifiers.combo ? 1 + COMBO.bonus : 1;
  const bonus = 1 + (modifiers.bonus ?? 0);
  const atk = (attacker.spec.atk + (modifiers.partnerAtk ?? 0)) * (1 + risingEmberBonus(attacker));
  const defence =
    defender.spec.def * (defender.sapTurns > 0 ? TECHNIQUE_TUNING.sapDefenceMultiplier : 1);
  // Passive multipliers (config/passives.ts).
  const passive =
    (passives.pride ? 1 + PASSIVE_TUNING.ashenPride.bonus : 1) *
    (passives.gale ? 1 + PASSIVE_TUNING.galeStep.bonus : 1) *
    (passives.veil ? 1 - PASSIVE_TUNING.inkVeil.reduction : 1) *
    (passives.basalt ? 1 - PASSIVE_TUNING.basaltSkin.reduction : 1) *
    (passives.current ? 1 - PASSIVE_TUNING.readTheCurrent.reduction : 1) *
    (1 - (modifiers.benchReduction ?? 0));
  const raw =
    atk *
    card.power *
    typeMultiplier *
    focus *
    guard *
    combo *
    bonus *
    passive *
    (100 / (100 + defence));
  return { amount: Math.max(1, Math.round(raw)), effectiveness };
}

/** Combo tier of a card kind (0 for cards outside the chain). */
export function comboTierOf(kind: CardKind): number {
  return kind === 'technique' ? 0 : COMBO.tier[kind];
}

/** Whether playing this card now would continue the team's combo chain. */
export function continuesCombo(previousTier: number, kind: CardKind): boolean {
  const tier = comboTierOf(kind);
  return previousTier > 0 && tier > previousTier;
}
