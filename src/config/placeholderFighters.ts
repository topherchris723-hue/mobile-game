import { CHARACTER, TYPE_COLOR, WORLD } from './palette';

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

/** Your team, one per slot in ALLY_SLOTS order. */
export const ALLY_LOOKS: readonly FighterLook[] = [
  {
    id: 'placeholder-ember', // Energy realm · Fury
    outfit: WORLD.energy.dominant,
    legs: WORLD.energy.secondary,
    accent: TYPE_COLOR.fury,
    hair: 0x2a1d2e,
    skin: CHARACTER.skin,
    eye: CHARACTER.outline,
    feature: 'cape',
    hairStyle: 'spikes',
  },
  {
    id: 'placeholder-tide', // Ocean crews · Swift
    outfit: WORLD.ocean.dominant,
    legs: WORLD.ocean.secondary,
    accent: TYPE_COLOR.swift,
    hair: WORLD.ocean.accent,
    skin: 0xe8b48e,
    eye: CHARACTER.outline,
    feature: 'coatTails',
    hairStyle: 'ponytail',
  },
  {
    id: 'placeholder-grove', // Warrior clans · Guile
    outfit: WORLD.clans.dominant,
    legs: WORLD.clans.secondary,
    accent: TYPE_COLOR.guile,
    hair: 0x1f3a2a,
    skin: 0xd9a07c,
    eye: CHARACTER.outline,
    feature: 'coatTails',
    hairStyle: 'spikes',
  },
  {
    id: 'placeholder-dawn', // Ocean crews · Radiant
    outfit: 0xf1e6d2, // warm cloth white: cloud light pulled toward sandstone
    legs: WORLD.ocean.accent,
    accent: TYPE_COLOR.radiant,
    hair: 0xf5d79a,
    skin: CHARACTER.skin,
    eye: CHARACTER.outline,
    feature: 'cape',
    hairStyle: 'ponytail',
  },
];

/** Rift-corrupted enemy: deep violet, glowing Void eyes. */
export const ENEMY_LOOK: FighterLook = {
  id: 'placeholder-rift-shade', // The Rift · Void
  outfit: 0x4a3566,
  legs: 0x241a33,
  accent: TYPE_COLOR.void,
  hair: 0x16101f,
  skin: 0x8f7fa8,
  eye: TYPE_COLOR.void,
  feature: 'cape',
  hairStyle: 'spikes',
};
