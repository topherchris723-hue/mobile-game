import type { AiProfileId } from './battle';
import {
  blast,
  signature,
  strike,
  technique,
  type CardSpec,
  type FighterSpec,
  type TypeId,
  type WorldId,
} from './fighters';
import { CHARACTER, TYPE_COLOR, WORLD } from './palette';
import type { FighterLook } from './placeholderFighters';

/*
 * The 15 launch Sovereigns (game-design.md §5): 5 per world, all five types represented,
 * 3★ / 4★ / 5★ rarities. Stats and names are first-pass tuning. Looks are PLACEHOLDERS
 * (code-drawn, docs/assets.md) until each Sovereign gets a battle illustration.
 */

export type Rarity = 3 | 4 | 5;
export type Role = 'striker' | 'breaker' | 'guardian' | 'support';
export type StatId = 'hp' | 'atk' | 'def';

/** Applies when the Sovereign leads the team (slot 1). */
export type LeaderSkill =
  | {
      readonly kind: 'stat';
      readonly stat: StatId;
      readonly amount: number;
      /** Who benefits: everyone, or allies of one world or type. */
      readonly filter:
        | { readonly kind: 'all' }
        | { readonly kind: 'world'; readonly world: WorldId }
        | { readonly kind: 'type'; readonly type: TypeId };
    }
  | { readonly kind: 'startingEnergy'; readonly amount: number };

export interface SovereignSpec extends FighterSpec {
  readonly title: string;
  readonly rarity: Rarity;
  readonly role: Role;
  readonly leaderSkill: LeaderSkill;
}

interface LookParts {
  readonly outfit: number;
  readonly legs: number;
  readonly hair: number;
  readonly hairStyle: FighterLook['hairStyle'];
  readonly feature: FighterLook['feature'];
  readonly skin?: number;
}

/** PLACEHOLDER look: world palette for clothes, type colour for the accent (art-style.md §5). */
function look(id: string, type: TypeId, parts: LookParts): FighterLook {
  return {
    id: `placeholder-${id}`,
    outfit: parts.outfit,
    legs: parts.legs,
    hair: parts.hair,
    skin: parts.skin ?? CHARACTER.skin,
    accent: TYPE_COLOR[type],
    eye: CHARACTER.outline,
    hairStyle: parts.hairStyle,
    feature: parts.feature,
  };
}

interface SovereignInput {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly type: TypeId;
  readonly world: Exclude<WorldId, 'rift'>;
  readonly rarity: Rarity;
  readonly role: Role;
  readonly stats: {
    readonly hp: number;
    readonly atk: number;
    readonly def: number;
    readonly spd: number;
  };
  readonly cards: readonly [strike: string, blast: string, technique: CardSpec, signature: string];
  readonly leaderSkill: LeaderSkill;
  readonly look: LookParts;
  readonly ai?: AiProfileId;
}

function sovereign(input: SovereignInput): SovereignSpec {
  const [strikeName, blastName, techniqueCard, signatureName] = input.cards;
  return {
    id: input.id,
    name: input.name,
    title: input.title,
    type: input.type,
    world: input.world,
    rarity: input.rarity,
    role: input.role,
    ...input.stats,
    deck: [
      strike(strikeName),
      strike(strikeName),
      blast(blastName),
      blast(blastName),
      techniqueCard,
      signature(signatureName),
    ],
    leaderSkill: input.leaderSkill,
    look: look(input.id, input.type, input.look),
    ai: input.ai ?? 'balanced',
  };
}

const worldBoost = (stat: StatId, amount: number, world: WorldId): LeaderSkill => ({
  kind: 'stat',
  stat,
  amount,
  filter: { kind: 'world', world },
});
const typeBoost = (stat: StatId, amount: number, type: TypeId): LeaderSkill => ({
  kind: 'stat',
  stat,
  amount,
  filter: { kind: 'type', type },
});
const allBoost = (stat: StatId, amount: number): LeaderSkill => ({
  kind: 'stat',
  stat,
  amount,
  filter: { kind: 'all' },
});

const E = WORLD.energy;
const O = WORLD.ocean;
const C = WORLD.clans;

export const ROSTER: readonly SovereignSpec[] = [
  // ── Energy realm ──────────────────────────────────────────────────────────
  sovereign({
    id: 'kaien',
    name: 'Kaien',
    title: 'Ember Fist',
    type: 'fury',
    world: 'energy',
    rarity: 4,
    role: 'striker',
    stats: { hp: 1100, atk: 215, def: 70, spd: 92 },
    cards: ['Ember Jab', 'Flare Shot', technique('Ember Focus', 'focus', 2), 'Sunbreak Fist'],
    leaderSkill: worldBoost('atk', 0.15, 'energy'),
    // Lava-red tunic, not orange: keeps him clear of a famous hero's look (characters.md).
    look: {
      outfit: E.accent,
      legs: E.secondary,
      hair: 0x2a1d2e,
      hairStyle: 'spikes',
      feature: 'cape',
    },
  }),
  sovereign({
    id: 'solenne',
    name: 'Solenne',
    title: 'Dawnbringer',
    type: 'radiant',
    world: 'energy',
    rarity: 5,
    role: 'support',
    stats: { hp: 1180, atk: 212, def: 78, spd: 104 },
    cards: ['Dawn Palm', 'Halo Burst', technique('Sunlit Grace', 'heal', 3), 'Zenith Nova'],
    leaderSkill: allBoost('hp', 0.15),
    look: {
      outfit: 0xf1e6d2,
      legs: E.dominant,
      hair: 0xf5d79a,
      hairStyle: 'ponytail',
      feature: 'cape',
    },
  }),
  sovereign({
    id: 'brakka',
    name: 'Brakka',
    title: 'Basalt Wall',
    type: 'fury',
    world: 'energy',
    rarity: 3,
    role: 'guardian',
    stats: { hp: 1170, atk: 172, def: 82, spd: 74 },
    cards: ['Magma Knuckle', 'Cinder Spray', technique('Basalt Wall', 'guard', 2), 'Caldera Crash'],
    leaderSkill: typeBoost('def', 0.2, 'fury'),
    // Ember-orange vest, basalt-grey Hearthborn skin.
    look: {
      outfit: E.dominant,
      legs: E.shadow,
      hair: 0x8a3b22,
      hairStyle: 'spikes',
      feature: 'coatTails',
      skin: 0x9a8f96,
    },
  }),
  sovereign({
    id: 'vey',
    name: 'Vey',
    title: 'Ashen Hex',
    type: 'void',
    world: 'energy',
    rarity: 4,
    role: 'breaker',
    stats: { hp: 1040, atk: 218, def: 64, spd: 96 },
    cards: ['Ash Talon', 'Ember Hex', technique('Smolder Curse', 'sap', 2), 'Black Sun'],
    leaderSkill: typeBoost('atk', 0.2, 'void'),
    look: {
      outfit: E.secondary,
      legs: E.shadow,
      hair: 0xd8d0e8,
      hairStyle: 'ponytail',
      feature: 'cape',
    },
  }),
  sovereign({
    id: 'rhen',
    name: 'Rhen',
    title: 'Arc Runner',
    type: 'swift',
    world: 'energy',
    rarity: 3,
    role: 'striker',
    stats: { hp: 920, atk: 190, def: 58, spd: 112 },
    cards: ['Spark Kick', 'Arc Bolt', technique('Overcharge', 'focus', 2), 'Thunderline'],
    leaderSkill: { kind: 'startingEnergy', amount: 1 },
    look: {
      outfit: 0xf0a040,
      legs: E.secondary,
      hair: 0x2b3a6b,
      hairStyle: 'spikes',
      feature: 'coatTails',
    },
  }),

  // ── Ocean crews ───────────────────────────────────────────────────────────
  sovereign({
    id: 'maris',
    name: 'Maris',
    title: 'Tidecaller',
    type: 'swift',
    world: 'ocean',
    rarity: 4,
    role: 'support',
    stats: { hp: 980, atk: 200, def: 65, spd: 110 },
    cards: ['Undertow Kick', 'Spray Lance', technique('Tidal Mend', 'heal', 3), 'Riptide Spiral'],
    leaderSkill: worldBoost('hp', 0.2, 'ocean'),
    look: {
      outfit: O.dominant,
      legs: O.secondary,
      hair: O.accent,
      hairStyle: 'ponytail',
      feature: 'coatTails',
      skin: 0xe8b48e,
    },
  }),
  sovereign({
    id: 'dravo',
    name: 'Dravo',
    title: 'Storm Captain',
    type: 'fury',
    world: 'ocean',
    rarity: 5,
    role: 'striker',
    stats: { hp: 1150, atk: 236, def: 72, spd: 98 },
    cards: [
      'Cutlass Rush',
      'Cannon Volley',
      technique('Rally Cry', 'focus', 2),
      'Broadside Tempest',
    ],
    leaderSkill: allBoost('atk', 0.12),
    look: {
      outfit: O.shadow,
      legs: 0x3a2a24,
      hair: 0x1f1a18,
      hairStyle: 'spikes',
      feature: 'cape',
      skin: 0xc98a64,
    },
  }),
  sovereign({
    id: 'nerys',
    name: 'Nerys',
    title: 'Net Weaver',
    type: 'guile',
    world: 'ocean',
    rarity: 3,
    role: 'breaker',
    stats: { hp: 950, atk: 186, def: 62, spd: 100 },
    cards: ['Hook Feint', 'Net Cast', technique('Riptide Snare', 'sap', 2), 'Maelstrom Trap'],
    leaderSkill: typeBoost('atk', 0.15, 'guile'),
    look: {
      outfit: O.accent,
      legs: O.shadow,
      hair: 0x8a3b2e,
      hairStyle: 'ponytail',
      feature: 'coatTails',
    },
  }),
  sovereign({
    id: 'corrin',
    name: 'Corrin',
    title: 'Lighthouse Keeper',
    type: 'radiant',
    world: 'ocean',
    rarity: 3,
    role: 'guardian',
    stats: { hp: 1190, atk: 170, def: 84, spd: 76 },
    cards: ['Anchor Bash', 'Lantern Flare', technique('Hull Brace', 'guard', 2), 'Lighthouse Beam'],
    leaderSkill: allBoost('def', 0.12),
    look: {
      outfit: O.secondary,
      legs: O.shadow,
      hair: 0x6b4a2e,
      hairStyle: 'spikes',
      feature: 'coatTails',
      skin: 0xd9a07c,
    },
  }),
  sovereign({
    id: 'isla',
    name: 'Isla',
    title: 'Abyss Singer',
    type: 'void',
    world: 'ocean',
    rarity: 4,
    role: 'support',
    stats: { hp: 1020, atk: 204, def: 68, spd: 106 },
    cards: ['Undertow Grasp', 'Abyss Shot', technique('Deep Siphon', 'drain', 2), 'Leviathan Call'],
    leaderSkill: { kind: 'startingEnergy', amount: 2 },
    look: {
      outfit: 0x15406e,
      legs: O.secondary,
      hair: 0x9fd8e8,
      hairStyle: 'ponytail',
      feature: 'cape',
    },
  }),

  // ── Warrior clans ─────────────────────────────────────────────────────────
  sovereign({
    id: 'torvan',
    name: 'Torvan',
    title: 'Rootwarden',
    type: 'guile',
    world: 'clans',
    rarity: 4,
    role: 'guardian',
    stats: { hp: 1250, atk: 185, def: 90, spd: 78 },
    cards: ['Thorn Palm', 'Leafstorm', technique('Root Guard', 'guard', 2), 'Thousand-Leaf Cut'],
    leaderSkill: worldBoost('def', 0.2, 'clans'),
    look: {
      outfit: C.dominant,
      legs: C.secondary,
      hair: 0x1f3a2a,
      hairStyle: 'spikes',
      feature: 'coatTails',
      skin: 0xd9a07c,
    },
  }),
  sovereign({
    id: 'akari',
    name: 'Akari',
    title: 'Gale Blade',
    type: 'swift',
    world: 'clans',
    rarity: 5,
    role: 'striker',
    stats: { hp: 1060, atk: 232, def: 68, spd: 118 },
    cards: [
      'Wind Step',
      'Gale Shuriken',
      technique('Still Mind', 'focus', 2),
      'Hundred Petal Storm',
    ],
    leaderSkill: typeBoost('atk', 0.25, 'swift'),
    look: {
      outfit: C.secondary,
      legs: 0x2a1d2e,
      hair: 0x2a1d2e,
      hairStyle: 'ponytail',
      feature: 'coatTails',
    },
  }),
  sovereign({
    id: 'goro',
    name: 'Goro',
    title: 'Iron Mountain',
    type: 'fury',
    world: 'clans',
    rarity: 3,
    role: 'guardian',
    stats: { hp: 1200, atk: 174, def: 80, spd: 72 },
    cards: [
      'Iron Palm',
      'Stone Fist Wave',
      technique('Mountain Stance', 'guard', 2),
      'Earthsplitter',
    ],
    leaderSkill: worldBoost('hp', 0.15, 'clans'),
    look: {
      outfit: 0x5a6b3a,
      legs: C.shadow,
      hair: 0x3a2a20,
      hairStyle: 'spikes',
      feature: 'cape',
      skin: 0xc98a64,
    },
  }),
  sovereign({
    id: 'mei',
    name: 'Mei',
    title: 'Lotus Sage',
    type: 'radiant',
    world: 'clans',
    rarity: 4,
    role: 'support',
    stats: { hp: 1040, atk: 198, def: 72, spd: 102 },
    cards: [
      'Lotus Strike',
      'Spirit Lantern',
      technique('Healing Incense', 'heal', 3),
      'Thousand Cranes',
    ],
    leaderSkill: typeBoost('hp', 0.25, 'radiant'),
    look: {
      outfit: 0xf2c4c8,
      legs: C.dominant,
      hair: 0x1f1a2e,
      hairStyle: 'ponytail',
      feature: 'cape',
    },
  }),
  sovereign({
    id: 'shiro',
    name: 'Shiro',
    title: 'Ink Shadow',
    type: 'void',
    world: 'clans',
    rarity: 3,
    role: 'breaker',
    stats: { hp: 940, atk: 192, def: 60, spd: 104 },
    cards: ['Shadow Cut', 'Ink Kunai', technique('Ink Seal', 'sap', 2), 'Moonless Night'],
    leaderSkill: worldBoost('atk', 0.1, 'clans'),
    look: {
      outfit: 0x2a2a38,
      legs: C.shadow,
      hair: 0xe8e4f0,
      hairStyle: 'spikes',
      feature: 'coatTails',
    },
  }),
];

/** Sovereigns every new player starts with (summons recruit the rest from M6). */
export const STARTER_IDS: readonly string[] = [
  'kaien',
  'maris',
  'torvan',
  'brakka',
  'corrin',
  'goro',
];

/** Starting team; slot 1 leads. */
export const DEFAULT_TEAM: readonly [string, string, string] = ['kaien', 'maris', 'torvan'];

const BY_ID = new Map(ROSTER.map((spec) => [spec.id, spec]));

export function findSovereign(id: string): SovereignSpec | undefined {
  return BY_ID.get(id);
}

export function getSovereign(id: string): SovereignSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`Unknown Sovereign "${id}"`);
  return spec;
}
