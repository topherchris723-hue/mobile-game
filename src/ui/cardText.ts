import { DRAIN, TECHNIQUE_TUNING } from '../config/battle';
import type { CardKind, CardSpec } from '../config/fighters';

export const KIND_LABEL: Readonly<Record<CardKind, string>> = {
  strike: 'Strike',
  blast: 'Blast',
  technique: 'Technique',
  signature: 'Signature',
};

/** Small, solid glyphs (style guide §9: one consistent icon set). */
export const KIND_ICON: Readonly<Record<CardKind, string>> = {
  strike: 'M3 17 15 5l2 2L5 19zM9 19 19 9l2 2-8 8z',
  blast: 'M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  technique: 'M12 2 21 12 12 22 3 12z',
  signature: 'M12 1 15 9 23 12 15 15 12 23 9 15 1 12 9 9z',
};

export function kindIcon(kind: CardKind): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${KIND_ICON[kind]}"/></svg>`;
}

/** What a Technique does, in a few words (shared by battle cards and the Sovereign detail). */
export function techniqueText(card: CardSpec): string {
  switch (card.effect) {
    case 'focus':
      return `Next attack ×${TECHNIQUE_TUNING.focusMultiplier}`;
    case 'guard':
      return 'Halve the next hit';
    case 'heal':
      return `Heal ${Math.round(TECHNIQUE_TUNING.healFraction * 100)}% HP`;
    case 'sap':
      return `Enemy DEF −${Math.round((1 - TECHNIQUE_TUNING.sapDefenceMultiplier) * 100)}%`;
    case 'drain':
      return `Steal ${DRAIN.steal} enemy energy`;
    default:
      return '';
  }
}
