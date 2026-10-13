import { TYPE_COLOR } from './palette';

/**
 * PLACEHOLDER character looks, drawn in code until real sprite art exists (docs/assets.md).
 * They follow docs/design/art-style.md: world dominant colour, type-colour accent, and one
 * distinctive silhouette feature each.
 */
export interface FighterLook {
  readonly id: string;
  readonly outfit: number;
  readonly legs: number;
  readonly accent: number;
  readonly hair: number;
  readonly skin: number;
  readonly eye: number;
  readonly feature: 'cape' | 'coatTails';
  readonly hairStyle: 'spikes' | 'ponytail';
}

const RIFT_ENEMY_BASE = {
  outfit: 0x4a3566,
  legs: 0x241a33,
  hair: 0x16101f,
  skin: 0x8f7fa8,
  eye: TYPE_COLOR.void,
} as const;

/** Rift-corrupted enemies: deep violet with glowing Void eyes; the accent shows each one's type. */
export const ENEMY_LOOKS: readonly FighterLook[] = [
  {
    ...RIFT_ENEMY_BASE,
    id: 'placeholder-rift-stalker', // Swift
    accent: TYPE_COLOR.swift,
    feature: 'coatTails',
    hairStyle: 'ponytail',
  },
  {
    ...RIFT_ENEMY_BASE,
    id: 'placeholder-rift-shade', // Void
    accent: TYPE_COLOR.void,
    feature: 'cape',
    hairStyle: 'spikes',
  },
  {
    ...RIFT_ENEMY_BASE,
    id: 'placeholder-rift-brute', // Fury
    accent: TYPE_COLOR.fury,
    outfit: 0x5a3050,
    feature: 'cape',
    hairStyle: 'spikes',
  },
];
