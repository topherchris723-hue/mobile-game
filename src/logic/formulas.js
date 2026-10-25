// Pure formulas from GDD §5.7, §5.10, §5.11, §5.12, §5.13, §8, §9.1. No state, no RNG.

// Floors use a tiny epsilon so exact GDD results (e.g. 546.0) are not lost to float error (545.9999…).
const FLOOR_EPS = 1e-7;

/** floor() that tolerates float error just below an integer. */
export function safeFloor(x) {
  return Math.floor(x + FLOOR_EPS);
}

/** Clamp x to [lo, hi]. */
export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Player fighter stat after Resonance: floor(base × (1 + bonus × resonance)). GDD §5.11. */
export function playerStat(base, resonance, bonusPerRank) {
  return safeFloor(base * (1 + bonusPerRank * resonance));
}

/** Enemy stat: floor(base × stat_mult). GDD §8 (AC-8.1). */
export function enemyStat(base, mult) {
  return safeFloor(base * mult);
}

/** Aura multiplier from the battle.json type chart. GDD §5.12. */
export function typeMult(typeChart, attackerAura, defenderAura) {
  return typeChart[attackerAura][defenderAura];
}

/** def_factor = K / (K + DEF). GDD §5.11. */
export function defFactor(def, defConstant) {
  return defConstant / (defConstant + def);
}

/** combo_mult = 1 + bonus × min(chain_index − 1, maxSteps). GDD §5.7. */
export function comboMult(chainIndex, bonusPerCard, maxSteps) {
  const steps = Math.min(Math.max(chainIndex - 1, 0), maxSteps);
  return 1 + bonusPerCard * steps;
}

/**
 * Buff factor for one stat: clamp(1 + Σup − Σdown, min, max). GDD §5.11/§5.13.
 * `up` and `down` are the (non-stacking) values for that stat.
 */
export function buffFactor(up, down, min, max) {
  return clamp(1 + up - down, min, max);
}

/**
 * Per-hit damage. GDD §5.11:
 * hit = clamp(floor(ATK × (power/hits) × type × crit × combo × riposte × def_factor), min, max)
 * p = { atk, power, hits, typeMult, critMult, comboMult, riposteMult, def }
 */
export function hitDamage(p, damageRules) {
  const df = defFactor(p.def, damageRules.defConstant);
  const raw = p.atk * (p.power / p.hits) * p.typeMult * p.critMult * p.comboMult * p.riposteMult * df;
  return clamp(safeFloor(raw), damageRules.minHit, damageRules.maxHit);
}

/** One Tri-Burst member hit. GDD §5.10: floor(ATK × perMember × max(1, type) × def_factor), capped. */
export function triBurstHit(atk, typeMultValue, def, powerPerMember, damageRules) {
  const raw = atk * powerPerMember * Math.max(1, typeMultValue) * defFactor(def, damageRules.defConstant);
  return clamp(safeFloor(raw), damageRules.minHit, damageRules.maxHit);
}

/** Burst gain for dealing damage: factor × damage / target max HP. GDD §5.10. */
export function burstGainDealt(damage, targetMaxHp, factor) {
  return (factor * damage) / targetMaxHp;
}

/** Burst gain for taking damage: factor × damage / own max HP. GDD §5.10. */
export function burstGainTaken(damage, ownMaxHp, factor) {
  return (factor * damage) / ownMaxHp;
}

/** Fighter power for team select. GDD §9.1: floor(HP×a + ATK×b + DEF×c). */
export function fighterPower(hp, atk, def, coeff) {
  return safeFloor(hp * coeff.hp + atk * coeff.atk + def * coeff.def);
}

/** Timeout result from team HP ratios. GDD §5.14. Returns 'win' | 'lose' | 'draw' for the player. */
export function timeoutResult(playerRatio, enemyRatio) {
  if (playerRatio > enemyRatio) return 'win';
  if (playerRatio < enemyRatio) return 'lose';
  return 'draw';
}

/** Same as timeoutResult but exact, using integer cross-multiplication of HP sums. */
export function timeoutResultExact(playerHp, playerMaxHp, enemyHp, enemyMaxHp) {
  const p = playerHp * enemyMaxHp;
  const e = enemyHp * playerMaxHp;
  if (p > e) return 'win';
  if (p < e) return 'lose';
  return 'draw';
}
