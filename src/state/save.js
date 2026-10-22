// Player save data (GDD §13). Stored as JSON under local storage key `game_save`.
// Pure functions: storage, clock and the schema validator are passed in, so this runs in Node tests
// and in the browser alike.

import { missionsMet } from '../logic/missions.js';

export const SAVE_KEY = 'game_save';
export const SAVE_VERSION = 1;

// Defaults for settings (GDD §14: haptics on by default). Volumes are not specified in the GDD.
const DEFAULT_SETTINGS = { bgm_volume: 1, sfx_volume: 1, haptics: true };

/**
 * Migrations: MIGRATIONS[n] turns a version-n save into a version-(n+1) save.
 * There is only v1 so far; add `MIGRATIONS[1] = (s) => {...; s.version = 2; return s; }` when v2 exists.
 */
export const MIGRATIONS = {};

/** A fresh save from economy.json `starting` (GDD §12, AC-12.1). nowIso = ISO date-time string. */
export function createFreshSave(economy, nowIso) {
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
    settings: { bgm_volume: DEFAULT_SETTINGS.bgm_volume, sfx_volume: DEFAULT_SETTINGS.sfx_volume, haptics: DEFAULT_SETTINGS.haptics },
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
    const ch = characters[id];
    if (!ch) continue; // unknown ids are ignored, not deleted (GDD §13)
    if (seen.indexOf(ch.family) >= 0) return false;
    seen.push(ch.family);
  }
  return true;
}

/**
 * Load the save from storage ({ getItem, setItem }). GDD §13 / AC-13.2:
 * missing → fresh; unparsable, schema-invalid or unknown version → backup raw text to
 * `game_save_corrupt_<unix_ms>`, start fresh and report `damaged: true` so Home can show the notice.
 * opts = { validate(save) → bool, economy, characters?, nowMs }
 */
export function loadSave(storage, opts) {
  const nowIso = new Date(opts.nowMs).toISOString();
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null || raw === undefined) {
    const fresh = createFreshSave(opts.economy, nowIso);
    storage.setItem(SAVE_KEY, JSON.stringify(fresh));
    return { save: fresh, damaged: false, backupKey: null };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = null;
  }
  let save = parsed ? migrateSave(parsed) : null;
  if (save && !opts.validate(save)) save = null;
  if (save && opts.characters && !checkTeamFamilies(save, opts.characters)) save = null;
  if (!save) {
    const backupKey = SAVE_KEY + '_corrupt_' + opts.nowMs;
    storage.setItem(backupKey, raw);
    const fresh = createFreshSave(opts.economy, nowIso);
    storage.setItem(SAVE_KEY, JSON.stringify(fresh));
    return { save: fresh, damaged: true, backupKey: backupKey };
  }
  return { save: save, damaged: false, backupKey: null };
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
 * beyond max → overflow currency by rarity. Returns { kind: 'new'|'resonance'|'currency', amount? }.
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
      addCurrency(save, economy, d.overflow_currency_id, amount);
      return { kind: 'currency', amount: amount };
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
