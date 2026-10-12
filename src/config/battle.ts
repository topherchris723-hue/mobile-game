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
