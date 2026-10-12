import type { AiProfileId } from './battle';
import type { FighterLook } from './placeholderFighters';
import { ALLY_LOOKS, ENEMY_LOOKS } from './placeholderFighters';

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

const strike = (name: string): CardSpec => ({ kind: 'strike', name, cost: 1, power: 1 });
const blast = (name: string): CardSpec => ({ kind: 'blast', name, cost: 2, power: 2.2 });
const signature = (name: string): CardSpec => ({ kind: 'signature', name, cost: 5, power: 6 });
const technique = (name: string, effect: TechniqueEffect, cost: number): CardSpec => ({
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
 * PLACEHOLDER roster for M2: names, stats, and decks are first-pass tuning, to be replaced by the
 * real 15-Sovereign data set in M5.
 */
export const PLAYER_TEAM: readonly FighterSpec[] = [
  {
    id: 'kaien',
    name: 'Kaien',
    type: 'fury',
    world: 'energy',
    hp: 1100,
    atk: 215,
    def: 70,
    spd: 92,
    deck: [
      strike('Ember Jab'),
      strike('Ember Jab'),
      blast('Flare Shot'),
      blast('Flare Shot'),
      technique('Ember Focus', 'focus', 2),
      signature('Sunbreak Fist'),
    ],
    look: look(ALLY_LOOKS, 0),
    ai: 'balanced',
  },
  {
    id: 'maris',
    name: 'Maris',
    type: 'swift',
    world: 'ocean',
    hp: 980,
    atk: 200,
    def: 65,
    spd: 110,
    deck: [
      strike('Undertow Kick'),
      strike('Undertow Kick'),
      blast('Spray Lance'),
      blast('Spray Lance'),
      technique('Tidal Mend', 'heal', 3),
      signature('Riptide Spiral'),
    ],
    look: look(ALLY_LOOKS, 1),
    ai: 'balanced',
  },
  {
    id: 'torvan',
    name: 'Torvan',
    type: 'guile',
    world: 'clans',
    hp: 1250,
    atk: 185,
    def: 90,
    spd: 78,
    deck: [
      strike('Thorn Palm'),
      strike('Thorn Palm'),
      blast('Leafstorm'),
      blast('Leafstorm'),
      technique('Root Guard', 'guard', 2),
      signature('Thousand-Leaf Cut'),
    ],
    look: look(ALLY_LOOKS, 2),
    ai: 'balanced',
  },
];

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
