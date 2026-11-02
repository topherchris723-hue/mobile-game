// GDD §13 ruling R4-1 / AC-13.4 (P, live code): settings fields, fresh-save defaults and repair-before-validation.
// A save is never "damaged" because of `settings`: each bad field is replaced by its default, unknown keys are removed,
// the repaired save is written back, and the load returns warning code `settings_repaired` (L-gp-001: every case loads,
// then builds the Home team and starts a battle from the result).
import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  SAVE_KEY, createFreshSave, loadSave, repairSettings, DEFAULT_SETTINGS, SETTINGS_FIELDS, SAVE_REPAIR_WARNING_CODES,
} from '../../src/state/save.js';
import { createBattle, createContent } from '../../src/logic/index.js';
import { readJson, loadBundle } from '../helpers/load-data.js';

const economy = readJson('data/economy.json');
const characters = {};
for (const c of readJson('data/characters.json').characters) characters[c.id] = c;
const bundle = loadBundle();
bundle.economy = economy;
const content = createContent(bundle);
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(readJson('data/schemas/save.schema.json'));
const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const NOW_ISO = new Date(NOW).toISOString();

function memoryStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, keys: () => Object.keys(m) };
}

/** A valid round-3 style save with given settings (or settings removed when `settings` is undefined). */
function saveWith(settings) {
  const s = createFreshSave(economy, NOW_ISO);
  s.currencies.cur_jade = 4321;
  if (settings === undefined) delete s.settings;
  else s.settings = settings;
  return s;
}

/** Load a stored save, then build the Home team and run a few battle ticks from it (L-gp-001). */
function loadAndPlay(stored, reduceMotion) {
  const st = memoryStorage();
  st.setItem(SAVE_KEY, JSON.stringify(stored));
  const r = loadSave(st, { validate, economy, characters, nowMs: NOW, reduceMotion: reduceMotion });
  const team = r.save.team.map((id) => {
    const e = r.save.roster.find((x) => x.character_id === id);
    return { characterId: id, resonance: e ? e.resonance : 0 };
  });
  const b = createBattle({ content, stageId: 'stage_001', playerTeam: team, skipIntro: true }, 1);
  for (let i = 0; i < 30; i++) b.step();
  return { r, st, b };
}

describe('AC-13.4 (a) fresh-save settings', () => {
  it('without a reduced-motion preference: exactly { master 1.0, bgm 1.0, sfx 1.0, muted false, haptics true, reduce_motion false }', () => {
    const s = createFreshSave(economy, NOW_ISO);
    expect(s.settings).toStrictEqual({ master_volume: 1.0, bgm_volume: 1.0, sfx_volume: 1.0, muted: false, haptics: true, reduce_motion: false });
    expect(createFreshSave(economy, NOW_ISO, { reduceMotion: false }).settings.reduce_motion).toBe(false);
    expect(validate(s)).toBe(true);
  });
  it('with the media query stubbed to match (caller passes reduceMotion: true): reduce_motion true', () => {
    expect(createFreshSave(economy, NOW_ISO, { reduceMotion: true }).settings.reduce_motion).toBe(true);
    const st = memoryStorage();
    const r = loadSave(st, { validate, economy, characters, nowMs: NOW, reduceMotion: true });
    expect(r.save.settings.reduce_motion).toBe(true);
    expect(JSON.parse(st.getItem(SAVE_KEY)).settings.reduce_motion).toBe(true);
  });
  it('DEFAULT_SETTINGS / SETTINGS_FIELDS list the six R4-1 fields; settings_repaired is in SAVE_REPAIR_WARNING_CODES', () => {
    expect(SETTINGS_FIELDS.slice().sort()).toEqual(['bgm_volume', 'haptics', 'master_volume', 'muted', 'reduce_motion', 'sfx_volume']);
    expect(DEFAULT_SETTINGS).toStrictEqual({ master_volume: 1, bgm_volume: 1, sfx_volume: 1, muted: false, haptics: true, reduce_motion: false });
    expect(SAVE_REPAIR_WARNING_CODES).toContain('settings_repaired');
  });
});

describe('AC-13.4 (b) bad settings are repaired, never reset (must-FAIL: a loader that resets the save)', () => {
  const cases = [
    {
      name: 'round-3 save with only { bgm 0.4, sfx 0.7, haptics false } → kept, master 1.0, muted false, reduce_motion per query',
      settings: { bgm_volume: 0.4, sfx_volume: 0.7, haptics: false }, rm: true,
      want: { master_volume: 1, bgm_volume: 0.4, sfx_volume: 0.7, muted: false, haptics: false, reduce_motion: true },
    },
    { name: 'master_volume 2 → 1.0', settings: { ...DEFAULTS(), master_volume: 2 }, want: { ...DEFAULTS(), master_volume: 1 } },
    { name: 'muted "yes" → false', settings: { ...DEFAULTS(), muted: 'yes' }, want: { ...DEFAULTS(), muted: false } },
    { name: 'sfx_volume 0.45 → 0.5 (rounded to 1 decimal)', settings: { ...DEFAULTS(), sfx_volume: 0.45 }, want: { ...DEFAULTS(), sfx_volume: 0.5 } },
    { name: 'settings missing entirely → all defaults', settings: undefined, want: DEFAULTS() },
    { name: 'settings not an object (array) → all defaults', settings: [1, 2], want: DEFAULTS() },
    { name: 'bgm_volume −0.2 → 1.0', settings: { ...DEFAULTS(), bgm_volume: -0.2 }, want: DEFAULTS() },
    { name: 'sfx_volume NaN-ish string "0.5" → 1.0', settings: { ...DEFAULTS(), sfx_volume: '0.5' }, want: DEFAULTS() },
    { name: 'haptics 1 → true', settings: { ...DEFAULTS(), haptics: 1 }, want: DEFAULTS() },
    { name: 'reduce_motion null → the media query now (true)', settings: { ...DEFAULTS(), reduce_motion: null }, rm: true, want: { ...DEFAULTS(), reduce_motion: true } },
    { name: 'unknown extra key "volume_x" → removed', settings: { ...DEFAULTS(), volume_x: 3 }, want: DEFAULTS() },
  ];
  function DEFAULTS() {
    return { master_volume: 1, bgm_volume: 1, sfx_volume: 1, muted: false, haptics: true, reduce_motion: false };
  }
  for (const c of cases) {
    it(c.name, () => {
      const { r, st, b } = loadAndPlay(saveWith(c.settings), !!c.rm);
      expect(r.damaged).toBe(false);
      expect(r.repaired).toBe(true);
      expect(r.save.settings).toStrictEqual(c.want);
      expect(r.warnings.map((w) => w.code)).toContain('settings_repaired');
      expect(r.save.currencies.cur_jade).toBe(4321);
      expect(r.save.roster.map((e) => e.character_id)).toEqual(economy.starting.characters);
      expect(st.keys().filter((k) => k.indexOf('game_save_corrupt_') === 0)).toEqual([]);
      expect(JSON.parse(st.getItem(SAVE_KEY)).settings).toStrictEqual(c.want); // written back
      expect(validate(r.save)).toBe(true);
      expect(b.getResult()).toBeNull();
      expect(b.tick).toBeGreaterThan(0);
    });
  }
  it('a valid full settings object is not repaired and not rewritten', () => {
    const good = { master_volume: 0.3, bgm_volume: 0, sfx_volume: 1, muted: true, haptics: false, reduce_motion: true };
    const st = memoryStorage();
    const raw = JSON.stringify(saveWith(good));
    st.setItem(SAVE_KEY, raw);
    const r = loadSave(st, { validate, economy, characters, nowMs: NOW, reduceMotion: false });
    expect(r.repaired).toBe(false);
    expect(r.warnings).toEqual([]);
    expect(r.save.settings).toStrictEqual(good);
    expect(st.getItem(SAVE_KEY)).toBe(raw);
  });
  it('repairSettings is pure and reports one settings_repaired warning per changed field (key = field)', () => {
    const src = { bgm_volume: 0.4, sfx_volume: 0.7, haptics: false };
    const copy = JSON.parse(JSON.stringify(src));
    const out = repairSettings({ settings: src }, false);
    expect(src).toStrictEqual(copy);
    expect(out.warnings.map((w) => [w.code, w.key]).sort()).toEqual([
      ['settings_repaired', 'master_volume'], ['settings_repaired', 'muted'], ['settings_repaired', 'reduce_motion'],
    ]);
  });
});
