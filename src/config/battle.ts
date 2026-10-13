/** Rift Duel rules (game-design.md §4). Every number here is a tuning knob. */
export const BATTLE_RULES = {
  teamSize: 3,
  handSize: 3,
  maxEnergy: 10,
  startingEnergy: 1,
  energyPerTurn: 2,
  chargeEnergy: 2,
  /** Switching between fighters of different worlds. */
  tagLinkEnergy: 1,
  /** Turns of yours a swapped-out fighter must sit out before tagging back in. */
  switchCooldownTurns: 1,
} as const;

export const TYPE_MULTIPLIER = { advantage: 1.5, disadvantage: 0.75, neutral: 1 } as const;

export const TECHNIQUE_TUNING = {
  focusMultiplier: 1.5,
  guardMultiplier: 0.5,
  healFraction: 0.25,
  sapDefenceMultiplier: 0.7,
  sapTurns: 2,
} as const;

/**
 * Combo (game-design.md §4.6): an attack of a higher tier than your team's previous attack gets a
 * bonus — Strike → Blast → Signature. Switching keeps the chain; Charging or a Crossover resets it.
 */
export const COMBO = {
  tier: { strike: 1, blast: 2, signature: 3 },
  bonus: 0.25,
} as const;

/** Crossover Burst (game-design.md §4.6). */
export const CROSSOVER = {
  cost: 10,
  /** Damage power on the combined ATK of both fighters. */
  power: 3.6,
} as const;

/**
 * Bonus effect of a Crossover, decided by the partner's type. `text` is the short label shown on
 * the Crossover button (full descriptions live in game-design.md §4.6).
 */
export const CROSSOVER_PARTNER_EFFECT = {
  fury: { kind: 'damageBonus', amount: 0.3, text: '+30% dmg' },
  swift: { kind: 'energyGain', amount: 3, text: '+3 energy' },
  guile: { kind: 'sap', amount: 0, text: 'DEF −30%' },
  radiant: { kind: 'heal', amount: 0.3, text: 'Heal 30%' },
  void: { kind: 'energyDrain', amount: 3, text: 'Drain 3' },
} as const;

export type CrossoverEffectKind =
  (typeof CROSSOVER_PARTNER_EFFECT)[keyof typeof CROSSOVER_PARTNER_EFFECT]['kind'];

/** Technique: Drain. */
export const DRAIN = { steal: 2, gain: 1 } as const;

/**
 * Enemy behaviour profiles (game-design.md §4.8). Same rules for everyone; only priorities differ.
 * - lowHpFraction: below this, protect with Heal/Guard if possible.
 * - switchForAdvantage: tag in a type-advantaged fighter when possible.
 * - savesForSignature: Charge instead of attacking when that unlocks the Signature next turn.
 * - techniqueEnergyMargin: spare energy required before spending on Focus/Sap.
 */
export const AI_PROFILES = {
  balanced: {
    lowHpFraction: 0.35,
    switchForAdvantage: true,
    savesForSignature: false,
    techniqueEnergyMargin: 2,
  },
  aggressor: {
    lowHpFraction: 0.15,
    switchForAdvantage: false,
    savesForSignature: false,
    techniqueEnergyMargin: 1,
  },
  tactician: {
    lowHpFraction: 0.45,
    switchForAdvantage: true,
    savesForSignature: true,
    techniqueEnergyMargin: 1,
  },
} as const;

export type AiProfileId = keyof typeof AI_PROFILES;
