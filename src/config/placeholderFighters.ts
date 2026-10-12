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
  readonly feature: 'cape' | 'coatTails';
  readonly hairStyle: 'spikes' | 'ponytail';
}

export const PLACEHOLDER_LOOKS: readonly [FighterLook, FighterLook] = [
  {
    id: 'placeholder-ember', // Energy realm · Fury
    outfit: WORLD.energy.dominant,
    legs: WORLD.energy.secondary,
    accent: TYPE_COLOR.fury,
    hair: 0x2a1d2e,
    skin: CHARACTER.skin,
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
    feature: 'coatTails',
    hairStyle: 'ponytail',
  },
];
