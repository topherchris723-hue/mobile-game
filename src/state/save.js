// Player save data (GDD §13). Stored as JSON under local storage key `game_save`.
// Pure functions: storage, clock and the schema validator are passed in, so this runs in Node tests
// and in the browser alike.

import { missionsMet } from '../logic/missions.js';

export const SAVE_KEY = 'game_save';
export const SAVE_VERSION = 1;

// Fresh-save settings defaults (GDD §13 ruling R4-1, AC-13.4). `reduce_motion` here is the fallback when the caller
// does not pass the device's prefers-reduced-motion value (logic stays DOM-free: the caller reads the media query).
export const DEFAULT_SETTINGS = { master_volume: 1, bgm_volume: 1, sfx_volume: 1, muted: false, haptics: true, reduce_motion: false };
/** The settings fields (R4-1). Volumes are numbers 0.0–1.0 stored rounded to 1 decimal; the rest are booleans. */
export const SETTINGS_FIELDS = ['master_volume', 'bgm_volume', 'sfx_volume', 'muted', 'haptics', 'reduce_motion'];
const SETTINGS_VOLUMES = ['master_volume', 'bgm_volume', 'sfx_volume'];

/** Fresh settings; reduceMotion = the prefers-reduced-motion query result now (false if unknown/unsupported). */
export function freshSettings(reduceMotion) {
  return {
    master_volume: DEFAULT_SETTINGS.master_volume,
    bgm_volume: DEFAULT_SETTINGS.bgm_volume,
    sfx_volume: DEFAULT_SETTINGS.sfx_volume,
    muted: DEFAULT_SETTINGS.muted,
    haptics: DEFAULT_SETTINGS.haptics,
    reduce_motion: reduceMotion === true,
  };
}

/**
 * Migrations: MIGRATIONS[n] turns a version-n save into a version-(n+1) save.
 * There is only v1 so far; add `MIGRATIONS[1] = (s) => {...; s.version = 2; return s; }` when v2 exists.
 */
export const MIGRATIONS = {};

/**
 * A fresh save from economy.json `starting` (GDD §12, AC-12.1). nowIso = ISO date-time string.
 * env (optional) = { reduceMotion: bool } — the device's prefers-reduced-motion query at creation (GDD §13 R4-1).
 */
export function createFreshSave(economy, nowIso, env) {
  const currencies = {};
  for (const id of Object.keys(economy.starting.currencies)) currencies[id] = economy.starting.currencies[id];
  return {
    version: SAVE_VERSION,
    created_at: nowIso,
    updated_at: nowIso,
    currencies: currencies,
    roster: economy.starting.characters.map((id) => ({ character_id: id, resonance: 0, obtained_at: nowIso })),
    team: economy.starting.team.slice(),
    stages: {},
    summon: { pity: {}, first_multi_done: {}, total_pulls: 0 },
    settings: freshSettings(!!(env && env.reduceMotion === true)),
    tutorial: { completed: false },
  };
}

/** Run migrations in order. Returns the migrated save, or null for an unknown (future/invalid) version. */
export function migrateSave(save) {
  if (!save || typeof save.version !== 'number' || save.version < 1) return null;
  if (save.version > SAVE_VERSION) return null; // unknown future version = corrupt (GDD §13)
  let s = save;
  while (s.version < SAVE_VERSION) {
    const fn = MIGRATIONS[s.version];
    if (!fn) return null;
    s = fn(s);
  }
  return s;
}

/** Extra rules the schema cannot express: team families distinct (characters = characters.json map). */
export function checkTeamFamilies(save, characters) {
  const seen = [];
  for (const id of save.team) {
    const ch = lookup(characters, id);
    if (!ch) continue; // unknown ids are ignored, not deleted (GDD §13)
    if (seen.indexOf(ch.family) >= 0) return false;
    seen.push(ch.family);
  }
  return true;
}

/** Own-property lookup in an id map (so ids like "constructor" never hit Object.prototype). */
function lookup(map, id) {
  if (!map || typeof id !== 'string') return undefined;
  return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : undefined;
}

/**
 * Repair the team so it can always be fielded (GDD §13 team rule: 3 ids, distinct families, all owned;
 * "IDs in the save that no longer exist in the data are ignored on load").
 * Pure: does not change `save`. Returns { team, warnings, ok }.
 *  - Keeps team members in their slot order if they exist in `characters`, are playable, are owned (in
 *    the roster) and are not a repeat of an earlier slot. Anything else is dropped with a warning.
 *  - Two different kept fighters of the same family is NOT repaired: ok = false (treated as damaged,
 *    same as before this repair existed).
 *  - Refills empty slots from economy.starting.team, then from the roster in roster order, using only
 *    owned, playable, known fighters of a family not yet in the team.
 *  - ok = false if 3 fighters cannot be found (the caller treats the save as damaged).
 * Roster entries are never touched, so a later data fix restores an unknown fighter to the roster.
 * Warning = { code, characterId }; codes: team_not_array, team_unknown_id, team_not_playable,
 * team_unowned, team_duplicate, team_extra, team_refilled.
 */
export function repairTeam(save, characters, economy) {
  const warnings = [];
  const owned = {};
  if (Array.isArray(save.roster)) {
    for (const r of save.roster) {
      if (r && typeof r.character_id === 'string') owned[r.character_id] = true;
    }
  }
  const team = [];
  const families = [];
  if (!Array.isArray(save.team)) {
    warnings.push({ code: 'team_not_array', characterId: null });
    return { team: team, warnings: warnings, ok: false };
  }
  for (const id of save.team) {
    const ch = lookup(characters, id);
    if (!ch) {
      warnings.push({ code: 'team_unknown_id', characterId: id });
      continue;
    }
    if (ch.playable === false) {
      warnings.push({ code: 'team_not_playable', characterId: id });
      continue;
    }
    if (!lookup(owned, id)) {
      warnings.push({ code: 'team_unowned', characterId: id });
      continue;
    }
    if (team.indexOf(id) >= 0) {
      warnings.push({ code: 'team_duplicate', characterId: id });
      continue;
    }
    if (team.length >= 3) {
      warnings.push({ code: 'team_extra', characterId: id }); // schema allows exactly 3 slots
      continue;
    }
    if (families.indexOf(ch.family) >= 0) return { team: team, warnings: warnings, ok: false };
    team.push(id);
    families.push(ch.family);
  }
  const candidates = [];
  const starters = economy && economy.starting && Array.isArray(economy.starting.team) ? economy.starting.team : [];
  for (const id of starters) candidates.push(id);
  if (Array.isArray(save.roster)) {
    for (const r of save.roster) if (r && typeof r.character_id === 'string') candidates.push(r.character_id);
  }
  for (const id of candidates) {
    if (team.length >= 3) break;
    const ch = lookup(characters, id);
    if (!ch || ch.playable === false || !lookup(owned, id)) continue;
    if (team.indexOf(id) >= 0 || families.indexOf(ch.family) >= 0) continue;
    team.push(id);
    families.push(ch.family);
    warnings.push({ code: 'team_refilled', characterId: id });
  }
  return { team: team, warnings: warnings, ok: team.length === 3 };
}

/**
 * Every warning code loadSave can return (team repair, then summon repair). Re-exported from src/logic.
 */
export const SAVE_REPAIR_WARNING_CODES = [
  'team_not_array', 'team_unknown_id', 'team_not_playable', 'team_unowned', 'team_duplicate', 'team_extra', 'team_refilled',
  'summon_reset', 'summon_pity_reset', 'summon_pity_entry_dropped', 'summon_first_multi_reset',
  'summon_first_multi_entry_dropped', 'summon_total_pulls_reset', 'summon_extra_field',
  'settings_repaired',
];

const PITY_GROUP_PATTERN = /^[a-z][a-z0-9_]*$/; // save.schema.json summon.pity propertyNames
const BANNER_KEY_PATTERN = /^banner_[a-z0-9_]+$/; // save.schema.json summon.first_multi_done propertyNames
const SUMMON_FIELDS = ['pity', 'first_multi_done', 'total_pulls'];

/** A plain JSON object (not null, not an array). */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Non-negative whole number. */
function isCount(v) {
  return typeof v === 'number' && Math.floor(v) === v && v >= 0;
}

/**
 * Repair the `summon` section (GDD §13, save.schema.json `summon`; hard rule L-gp-001) so a damaged or old
 * section never resets the whole save. Pure: does not change `save`. Returns { summon, warnings }.
 * Warning = { code, characterId: null, key }:
 *  - summon_reset (key 'summon'): missing or not an object → { pity: {}, first_multi_done: {}, total_pulls: 0 }
 *  - summon_extra_field (key = field): a field the schema does not allow is dropped
 *  - summon_pity_reset (key 'pity'): pity missing / not an object → {}
 *  - summon_pity_entry_dropped (key = group): bad group name or counter not a whole number ≥ 0 → dropped (= 0)
 *  - summon_first_multi_reset (key 'first_multi_done'): missing / not an object → {}
 *  - summon_first_multi_entry_dropped (key = banner): bad banner key or value not boolean → dropped (= not done)
 *  - summon_total_pulls_reset (key 'total_pulls'): not a whole number ≥ 0 → 0
 * Well-formed entries for unknown groups/banners are kept (GDD §13: ignored, not deleted). A counter above
 * the banner's hard_pity is not changed here; the summon logic treats it as "pity reached".
 */
export function repairSummon(save) {
  const warnings = [];
  const warn = (code, key) => warnings.push({ code: code, characterId: null, key: key });
  const src = save ? save.summon : undefined;
  if (!isPlainObject(src)) {
    warn('summon_reset', 'summon');
    return { summon: { pity: {}, first_multi_done: {}, total_pulls: 0 }, warnings: warnings };
  }
  for (const k of Object.keys(src)) if (SUMMON_FIELDS.indexOf(k) < 0) warn('summon_extra_field', k);
  const pity = {};
  if (!isPlainObject(src.pity)) {
    warn('summon_pity_reset', 'pity');
  } else {
    for (const k of Object.keys(src.pity)) {
      const v = src.pity[k];
      if (PITY_GROUP_PATTERN.test(k) && isCount(v)) pity[k] = v;
      else warn('summon_pity_entry_dropped', k);
    }
  }
  const done = {};
  if (!isPlainObject(src.first_multi_done)) {
    warn('summon_first_multi_reset', 'first_multi_done');
  } else {
    for (const k of Object.keys(src.first_multi_done)) {
      const v = src.first_multi_done[k];
      if (BANNER_KEY_PATTERN.test(k) && typeof v === 'boolean') done[k] = v;
      else warn('summon_first_multi_entry_dropped', k);
    }
  }
  let total = src.total_pulls;
  if (!isCount(total)) {
    warn('summon_total_pulls_reset', 'total_pulls');
    total = 0;
  }
  return { summon: { pity: pity, first_multi_done: done, total_pulls: total }, warnings: warnings };
}

/**
 * Repair the `settings` section (GDD §13 ruling R4-1, AC-13.4) before schema validation. Pure: does not change `save`.
 * Each field that is missing, of the wrong type or out of range gets its fresh default (`reduce_motion`: reduceMotionNow,
 * the media query now); volumes are rounded to 1 decimal; unknown keys are removed. Returns { settings, warnings },
 * one warning { code: 'settings_repaired', characterId: null, key: field } per changed or removed field.
 */
export function repairSettings(save, reduceMotionNow) {
  const warnings = [];
  const warn = (key) => warnings.push({ code: 'settings_repaired', characterId: null, key: key });
  const fresh = freshSettings(reduceMotionNow === true);
  const src = save ? save.settings : undefined;
  if (!isPlainObject(src)) {
    warn('settings');
    return { settings: fresh, warnings: warnings };
  }
  const out = {};
  for (const k of SETTINGS_FIELDS) {
    const has = Object.prototype.hasOwnProperty.call(src, k);
    const v = has ? src[k] : undefined;
    if (SETTINGS_VOLUMES.indexOf(k) >= 0) {
      if (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1) {
        const r = Math.round(v * 10) / 10;
        out[k] = r;
        if (r !== v) warn(k);
      } else {
        out[k] = fresh[k];
        warn(k);
      }
    } else if (typeof v === 'boolean') {
      out[k] = v;
    } else {
      out[k] = fresh[k];
      warn(k);
    }
  }
  for (const k of Object.keys(src)) if (SETTINGS_FIELDS.indexOf(k) < 0) warn(k);
  return { settings: out, warnings: warnings };
}

/**
 * Load the save from storage ({ getItem, setItem }). GDD §13 / AC-13.2:
 * missing → fresh; unparsable, schema-invalid or unknown version → backup raw text to
 * `game_save_corrupt_<unix_ms>`, start fresh and report `damaged: true` so Home can show the notice.
 * The `summon` section is always repaired (see repairSummon). If `characters` is given, the team is repaired first (see repairTeam): unknown, unowned or duplicate
 * team ids are dropped and the team is refilled; the repaired save is written back and returned with
 * `repaired: true` and the `warnings` list. A team that cannot be repaired counts as damaged.
 * The `settings` section is always repaired (see repairSettings; warning `settings_repaired`, never damaged).
 * opts = { validate(save) → bool, economy, characters?, nowMs, reduceMotion? (prefers-reduced-motion now, bool) }
 * Returns { save, damaged, backupKey, repaired, warnings }.
 */
export function loadSave(storage, opts) {
  const nowIso = new Date(opts.nowMs).toISOString();
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null || raw === undefined) {
    const fresh = createFreshSave(opts.economy, nowIso, { reduceMotion: opts.reduceMotion === true });
    storage.setItem(SAVE_KEY, JSON.stringify(fresh));
    return { save: fresh, damaged: false, backupKey: null, repaired: false, warnings: [] };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = null;
  }
  let save = parsed ? migrateSave(parsed) : null;
  let warnings = [];
  let repaired = false;
  if (save && opts.characters && isPlainObject(save)) {
    const fix = repairTeam(save, opts.characters, opts.economy);
    if (!fix.ok) {
      save = null;
    } else if (fix.warnings.length > 0) {
      save.team = fix.team;
      warnings = fix.warnings;
      repaired = true;
    }
  }
  if (save && isPlainObject(save)) {
    const sfix = repairSummon(save);
    if (sfix.warnings.length > 0) {
      save.summon = sfix.summon;
      warnings = warnings.concat(sfix.warnings);
      repaired = true;
    }
  }
  if (save && isPlainObject(save)) {
    const setfix = repairSettings(save, opts.reduceMotion === true);
    if (setfix.warnings.length > 0) {
      save.settings = setfix.settings;
      warnings = warnings.concat(setfix.warnings);
      repaired = true;
    }
  }
  if (save && !opts.validate(save)) save = null;
  if (save && opts.characters && !checkTeamFamilies(save, opts.characters)) save = null;
  if (!save) {
    const backupKey = SAVE_KEY + '_corrupt_' + opts.nowMs;
    storage.setItem(backupKey, raw);
    const fresh = createFreshSave(opts.economy, nowIso, { reduceMotion: opts.reduceMotion === true });
    storage.setItem(SAVE_KEY, JSON.stringify(fresh));
    return { save: fresh, damaged: true, backupKey: backupKey, repaired: false, warnings: [] };
  }
  if (repaired) storage.setItem(SAVE_KEY, JSON.stringify(save));
  return { save: save, damaged: false, backupKey: null, repaired: repaired, warnings: warnings };
}

/**
 * GDD §9.1: is the stage unlocked for this save? Stage 1 (no `unlock_requires`) is always unlocked;
 * any other stage unlocks when its `unlock_requires` stage is cleared. `data` = map stageId → stage
 * (createContent(...).stages). Unknown stage id → false.
 */
export function isStageUnlocked(save, stageId, data) {
  const stage = lookup(data, stageId);
  if (!stage) return false;
  if (!stage.unlock_requires) return true;
  const rec = lookup(save.stages, stage.unlock_requires);
  return !!(rec && rec.cleared === true);
}

/** Write the save (sets updated_at). */
export function writeSave(storage, save, nowMs) {
  save.updated_at = new Date(nowMs).toISOString();
  storage.setItem(SAVE_KEY, JSON.stringify(save));
}

/** Add currency, capped at the currency's max (economy.json). Returns the amount actually added. */
export function addCurrency(save, economy, currencyId, amount) {
  let max = Infinity;
  for (const c of economy.currencies) if (c.id === currencyId) max = c.max;
  const before = save.currencies[currencyId] || 0;
  const after = Math.min(max, before + amount);
  save.currencies[currencyId] = after;
  return after - before;
}

/**
 * Give one copy of a character (GDD §11.4): new → roster at R0; duplicate → Resonance +1 up to max;
 * beyond max → overflow currency by rarity, capped at the currency max (GDD §11.4).
 * Returns { kind: 'new'|'resonance'|'currency', resonance?, amount? (data amount), credited? (actually added) }.
 */
export function grantCharacter(save, economy, character, nowIso) {
  const d = economy.duplicates;
  for (const r of save.roster) {
    if (r.character_id === character.id) {
      if (r.resonance < d.max_resonance) {
        r.resonance += 1;
        return { kind: 'resonance', resonance: r.resonance };
      }
      const amount = d.overflow_amount_by_rarity[String(character.rarity)];
      const credited = addCurrency(save, economy, d.overflow_currency_id, amount);
      return { kind: 'currency', amount: amount, credited: credited }; // credited < amount at the currency cap
    }
  }
  save.roster.push({ character_id: character.id, resonance: 0, obtained_at: nowIso });
  return { kind: 'new' };
}

/**
 * Apply a finished battle to the save (GDD §9.1–9.3): only a Win gives rewards and missions.
 * First-clear rewards once ever, repeat rewards after; each mission reward once.
 * Returns { rewards: [...], missions: [ids newly completed] }.
 */
export function applyBattleResult(save, stage, result, economy, characters, nowIso) {
  const out = { rewards: [], missions: [] };
  if (!result || result.outcome !== 'win') return out;
  let rec = save.stages[stage.id];
  if (!rec) {
    rec = { cleared: false, clears: 0, best_time_s: null, missions_completed: [] };
    save.stages[stage.id] = rec;
  }
  const list = rec.cleared ? stage.rewards.repeat_clear : stage.rewards.first_clear;
  const give = (r) => {
    if (r.type === 'currency') addCurrency(save, economy, r.currency_id, r.amount);
    else if (r.type === 'character') grantCharacter(save, economy, characters[r.character_id], nowIso);
    out.rewards.push(r);
  };
  for (const r of list) give(r);
  rec.cleared = true;
  rec.clears += 1;
  if (rec.best_time_s === null || result.timeElapsedS < rec.best_time_s) rec.best_time_s = result.timeElapsedS;
  const met = missionsMet(stage, result);
  for (const m of stage.missions || []) {
    if (met.indexOf(m.id) >= 0 && rec.missions_completed.indexOf(m.id) < 0) {
      rec.missions_completed.push(m.id);
      out.missions.push(m.id);
      give(m.reward);
    }
  }
  if (stage.order === 1) save.tutorial.completed = true; // GDD §9.4: set on the first win of stage_001
  return out;
}
