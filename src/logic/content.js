// Indexes the parsed data files by id and builds fighter definitions for a battle.
// Input is the plain parsed JSON; nothing is read from disk here (the caller loads the files).

import { buildRules } from './rules.js';
import { expandDeck } from './deck.js';
import { playerStat, enemyStat } from './formulas.js';

/** Map a list of {id,...} records to an object keyed by id. */
function byId(list) {
  const map = {};
  for (const item of list) map[item.id] = item;
  return map;
}

/**
 * Build the content index from a data bundle:
 * { battle, characters, cards, enemies, stages, economy?, banners? } — the parsed data/*.json objects.
 * `banners` (data/banners.json) is needed only for the summon logic (src/logic/summon.js).
 */
export function createContent(bundle) {
  return {
    rules: buildRules(bundle.battle),
    characters: byId(bundle.characters.characters),
    cards: byId(bundle.cards.cards),
    enemies: byId(bundle.enemies ? bundle.enemies.enemies : []),
    stages: byId(bundle.stages ? bundle.stages.stages : []),
    economy: bundle.economy || null,
    banners: byId(bundle.banners ? bundle.banners.banners : []),
  };
}

/** Look up a record or throw a clear error (bad config is a programming error, not a game state). */
function need(map, id, what) {
  const v = map[id];
  if (!v) throw new Error('Unknown ' + what + ' id: ' + id);
  return v;
}

/**
 * Fighter definition for a player team member.
 * entry = 'char_id' or { characterId, resonance }.
 */
export function playerFighterDef(content, entry) {
  const characterId = typeof entry === 'string' ? entry : entry.characterId;
  const resonance = typeof entry === 'string' ? 0 : entry.resonance || 0;
  const ch = need(content.characters, characterId, 'character');
  let bonus = 0;
  if (resonance > 0) {
    if (!content.economy) throw new Error('economy data is required for resonance > 0');
    bonus = content.economy.duplicates.stat_bonus_per_rank;
  }
  return {
    characterId: ch.id,
    enemyId: null,
    name: ch.name,
    family: ch.family,
    aura: ch.aura,
    maxHp: playerStat(ch.base_stats.hp, resonance, bonus),
    atk: playerStat(ch.base_stats.atk, resonance, bonus),
    def: playerStat(ch.base_stats.def, resonance, bonus),
    critRate: typeof ch.base_stats.crit_rate === 'number' ? ch.base_stats.crit_rate : 0.05,
    deck: expandDeck(ch.deck),
    ignition: ch.ignition || null,
    ignitionDeck: ch.ignition ? expandDeck(ch.ignition.deck) : null,
    aiTier: null,
    boss: false,
  };
}

/** Fighter definition for an enemy record (GDD §8). */
export function enemyFighterDef(content, enemyId) {
  const en = need(content.enemies, enemyId, 'enemy');
  const ch = need(content.characters, en.character_id, 'character');
  const ignition = en.ignition_enabled ? ch.ignition || null : null;
  return {
    characterId: ch.id,
    enemyId: en.id,
    name: en.name_override || ch.name,
    family: ch.family,
    aura: ch.aura,
    maxHp: enemyStat(ch.base_stats.hp, en.stat_mult.hp),
    atk: enemyStat(ch.base_stats.atk, en.stat_mult.atk),
    def: enemyStat(ch.base_stats.def, en.stat_mult.def),
    critRate: typeof ch.base_stats.crit_rate === 'number' ? ch.base_stats.crit_rate : 0.05,
    deck: expandDeck(ch.deck),
    ignition: ignition,
    ignitionDeck: ignition ? expandDeck(ignition.deck) : null,
    aiTier: en.ai_tier,
    boss: !!en.boss,
  };
}

/** Get a stage record. */
export function getStage(content, stageId) {
  return need(content.stages, stageId, 'stage');
}
