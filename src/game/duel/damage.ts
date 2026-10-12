import { COMBO, TECHNIQUE_TUNING, TYPE_MULTIPLIER } from '../../config/battle';
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
}

/**
 * Exact damage a card would deal right now (game-design.md §4.7). There is no random variance,
 * so the number shown on a card is the number dealt.
 */
export function computeDamage(
  attacker: FighterState,
  defender: FighterState,
  card: Pick<CardSpec, 'power'>,
  modifiers: DamageModifiers = {},
): DamagePreview {
  const effectiveness = typeEffectiveness(attacker.spec.type, defender.spec.type);
  if (card.power <= 0) return { amount: 0, effectiveness };
  const typeMultiplier = TYPE_MULTIPLIER[effectiveness];
  const focus = attacker.focus ? TECHNIQUE_TUNING.focusMultiplier : 1;
  const guard = defender.guard ? TECHNIQUE_TUNING.guardMultiplier : 1;
  const combo = modifiers.combo ? 1 + COMBO.bonus : 1;
  const bonus = 1 + (modifiers.bonus ?? 0);
  const atk = attacker.spec.atk + (modifiers.partnerAtk ?? 0);
  const defence =
    defender.spec.def * (defender.sapTurns > 0 ? TECHNIQUE_TUNING.sapDefenceMultiplier : 1);
  const raw =
    atk * card.power * typeMultiplier * focus * guard * combo * bonus * (100 / (100 + defence));
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
