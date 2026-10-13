import type { AiProfileId } from './battle';
import type { FighterLook } from './placeholderFighters';
import { ENEMY_LOOKS } from './placeholderFighters';

export type TypeId = 'fury' | 'swift' | 'guile' | 'radiant' | 'void';
export type WorldId = 'energy' | 'ocean' | 'clans' | 'rift';
export type CardKind = 'strike' | 'blast' | 'technique' | 'signature';
export type TechniqueEffect = 'focus' | 'guard' | 'heal' | 'sap' | 'drain';

export interface CardSpec {
  readonly kind: CardKind;
  readonly name: string;
  readonly cost: number;
  /** Damage multiplier on ATK; 0 for non-damaging techniques. */
  readonly power: number;
  readonly effect?: TechniqueEffect;
}

export interface FighterSpec {
  readonly id: string;
  readonly name: string;
  readonly type: TypeId;
  readonly world: WorldId;
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly spd: number;
  /** Exactly 6 cards: Strike ×2, Blast ×2, Technique, Signature (game-design.md §4.3). */
  readonly deck: readonly CardSpec[];
  readonly look: FighterLook;
  /** How this fighter plays when the AI controls it. */
  readonly ai: AiProfileId;
}

export const strike = (name: string): CardSpec => ({ kind: 'strike', name, cost: 1, power: 1 });
export const blast = (name: string): CardSpec => ({ kind: 'blast', name, cost: 2, power: 2.2 });
export const signature = (name: string): CardSpec => ({
  kind: 'signature',
  name,
  cost: 5,
  power: 6,
});
export const technique = (name: string, effect: TechniqueEffect, cost: number): CardSpec => ({
  kind: 'technique',
  name,
  cost,
  power: 0,
  effect,
});

function look(list: readonly FighterLook[], index: number): FighterLook {
  const found = list[index];
  if (!found) throw new Error(`Missing placeholder look ${index}`);
  return found;
}

/**
 * The Rift enemies for the Prologue. Player-side Sovereigns live in config/sovereigns.ts.
 */
export const ENEMY_TEAM: readonly FighterSpec[] = [
  {
    id: 'rift-stalker',
    name: 'Rift Stalker',
    type: 'swift',
    world: 'rift',
    hp: 1020,
    atk: 200,
    def: 60,
    spd: 100,
    deck: [
      strike('Phase Claw'),
      strike('Phase Claw'),
      blast('Shard Volley'),
      blast('Shard Volley'),
      technique('Phase Siphon', 'drain', 2),
      signature('Phase Rend'),
    ],
    look: look(ENEMY_LOOKS, 0),
    ai: 'balanced',
  },
  {
    id: 'rift-shade',
    name: 'Rift Shade',
    type: 'void',
    world: 'rift',
    hp: 1080,
    atk: 208,
    def: 70,
    spd: 88,
    deck: [
      strike('Umbral Touch'),
      strike('Umbral Touch'),
      blast('Null Bolt'),
      blast('Null Bolt'),
      technique('Void Sap', 'sap', 2),
      signature('Umbral Collapse'),
    ],
    look: look(ENEMY_LOOKS, 1),
    ai: 'tactician',
  },
  {
    id: 'rift-brute',
    name: 'Rift Brute',
    type: 'fury',
    world: 'rift',
    hp: 1300,
    atk: 214,
    def: 85,
    spd: 70,
    deck: [
      strike('Crushing Blow'),
      strike('Crushing Blow'),
      blast('Rubble Throw'),
      blast('Rubble Throw'),
      technique('Rage', 'focus', 2),
      signature('Rift Hammer'),
    ],
    look: look(ENEMY_LOOKS, 2),
    ai: 'aggressor',
  },
];
