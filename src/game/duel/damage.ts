import { TECHNIQUE_TUNING, TYPE_MULTIPLIER } from '../../config/battle';
import type { CardSpec, TypeId } from '../../config/fighters';
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

/**
 * Exact damage a card would deal right now (game-design.md §4.7). There is no random variance,
 * so the number shown on a card is the number dealt.
 */
export function computeDamage(
  attacker: FighterState,
  defender: FighterState,
  card: CardSpec,
): DamagePreview {
  const effectiveness = typeEffectiveness(attacker.spec.type, defender.spec.type);
  if (card.power <= 0) return { amount: 0, effectiveness };
  const typeMultiplier = TYPE_MULTIPLIER[effectiveness];
  const focus = attacker.focus ? TECHNIQUE_TUNING.focusMultiplier : 1;
  const guard = defender.guard ? TECHNIQUE_TUNING.guardMultiplier : 1;
  const defence =
    defender.spec.def * (defender.sapTurns > 0 ? TECHNIQUE_TUNING.sapDefenceMultiplier : 1);
  const raw =
    attacker.spec.atk * card.power * typeMultiplier * focus * guard * (100 / (100 + defence));
  return { amount: Math.max(1, Math.round(raw)), effectiveness };
}
