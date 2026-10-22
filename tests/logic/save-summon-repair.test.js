// Hard rule L-gp-001: every GDD §13 / save.schema.json constraint on the `summon` section has a
// load-time repair-or-reset check. Each test loads a save that breaks ONLY that constraint, then builds
// the Home team, starts a battle and performs a summon from the result.
import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SAVE_KEY, createFreshSave, loadSave, repairSummon } from '../../src/state/save.js';
import { createBattle, createContent, summon, SAVE_REPAIR_WARNING_CODES } from '../../src/logic/index.js';
import { readJson, loadBundle } from '../helpers/load-data.js';

const economy = readJson('data/economy.json');
const bannersData = readJson('data/banners.json');
const content = createContent({ ...loadBundle(), economy, banners: bannersData });
const characters = content.characters;
const BANNER = bannersData.banners[0];
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(readJson('data/schemas/save.schema.json'));
const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);
const NOW_ISO = new Date(NOW).toISOString();

function memoryStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
}

/** A progressed save with summon history and enough Jade for a ×10. */
function progressed() {
  const s = createFreshSave(economy, NOW_ISO);
  s.currencies.cur_jade = 5000;
  s.stages.stage_001 = { cleared: true, clears: 1, best_time_s: 50, missions_completed: [] };
  s.summon = { pity: { [BANNER.pity.group]: 7 }, first_multi_done: { [BANNER.id]: true }, total_pulls: 17 };
  return s;
}

function load(obj) {
  const st = memoryStorage();
  st.setItem(SAVE_KEY, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return { r: loadSave(st, { validate, economy, characters, nowMs: NOW }), st };
}

/** Home team fieldable, a battle starts, and a summon works on the loaded save. */
function expectPlayable(r) {
  expect(validate(r.save)).toBe(true);
  const b = createBattle({ content, stageId: 'stage_001', playerTeam: r.save.team.slice(), skipIntro: true }, 1);
  expect(b.getState().teams.player.fighters.length).toBe(3);
  const sm = summon(r.save, BANNER.id, BANNER.multi_count, content, { nowIso: NOW_ISO, seed: 7 });
  expect(sm.ok).toBe(true);
  expect(validate(sm.saveAfter)).toBe(true);
}

function codes(r) {
  return r.warnings.map((w) => w.code + ':' + w.key);
}

describe('L-gp-001: summon section repair on load (progress kept, not reset)', () => {
  it('missing `summon` → defaults', () => {
    const s = progressed();
    delete s.summon;
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(r.repaired).toBe(true);
    expect(r.save.summon).toEqual({ pity: {}, first_multi_done: {}, total_pulls: 0 });
    expect(codes(r)).toEqual(['summon_reset:summon']);
    expect(r.save.stages.stage_001.cleared).toBe(true);
    expect(r.save.currencies.cur_jade).toBe(5000);
    expectPlayable(r);
  });

  it('`summon` not an object → defaults', () => {
    const s = progressed();
    s.summon = [1, 2];
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(r.save.summon).toEqual({ pity: {}, first_multi_done: {}, total_pulls: 0 });
    expectPlayable(r);
  });

  it('missing `summon.pity` → {} (other summon fields kept)', () => {
    const s = progressed();
    delete s.summon.pity;
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(r.save.summon).toEqual({ pity: {}, first_multi_done: { [BANNER.id]: true }, total_pulls: 17 });
    expect(codes(r)).toEqual(['summon_pity_reset:pity']);
    expectPlayable(r);
  });

  it('a pity counter that is negative, fractional or not a number is dropped (counter 0); good ones kept', () => {
    for (const bad of [-1, 2.5, '3', null, true]) {
      const s = progressed();
      s.summon.pity.other_group = 4;
      s.summon.pity[BANNER.pity.group] = bad;
      const { r } = load(s);
      expect(r.damaged).toBe(false);
      expect(r.save.summon.pity).toEqual({ other_group: 4 });
      expect(codes(r)).toEqual(['summon_pity_entry_dropped:' + BANNER.pity.group]);
      expectPlayable(r);
    }
  });

  it('a pity group key breaking the name pattern is dropped', () => {
    const s = progressed();
    s.summon.pity['Bad-Group'] = 3;
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(Object.keys(r.save.summon.pity)).toEqual([BANNER.pity.group]);
    expect(codes(r)).toEqual(['summon_pity_entry_dropped:Bad-Group']);
    expectPlayable(r);
  });

  it('an unknown (but well-formed) pity group or banner id is kept, not deleted (GDD §13 ignore-not-delete)', () => {
    const s = progressed();
    s.summon.pity.retired_group = 12;
    s.summon.first_multi_done.banner_retired_001 = true;
    const { r } = load(s);
    expect(r.repaired).toBe(false);
    expect(r.save.summon.pity.retired_group).toBe(12);
    expect(r.save.summon.first_multi_done.banner_retired_001).toBe(true);
    expectPlayable(r);
  });

  it('a pity counter at or above hard_pity (data lowered it) loads unchanged and the next pull is ★5', () => {
    const s = progressed();
    s.summon.pity[BANNER.pity.group] = BANNER.pity.hard_pity + 100;
    const { r } = load(s);
    expect(r.repaired).toBe(false);
    const sm = summon(r.save, BANNER.id, 1, content, { nowIso: NOW_ISO, seed: 7 });
    expect(sm.results[0].rarity).toBe(5);
    expectPlayable(r);
  });

  it('missing `first_multi_done` → {}', () => {
    const s = progressed();
    delete s.summon.first_multi_done;
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(r.save.summon.first_multi_done).toEqual({});
    expect(codes(r)).toEqual(['summon_first_multi_reset:first_multi_done']);
    expectPlayable(r);
  });

  it('a non-boolean first_multi_done entry or a bad banner key is dropped', () => {
    const s = progressed();
    s.summon.first_multi_done[BANNER.id] = 'yes';
    s.summon.first_multi_done.NotABanner = true;
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(r.save.summon.first_multi_done).toEqual({});
    expect(codes(r).sort()).toEqual(['summon_first_multi_entry_dropped:' + BANNER.id, 'summon_first_multi_entry_dropped:NotABanner'].sort());
    expectPlayable(r);
  });

  it('missing / negative / fractional / non-number total_pulls → 0', () => {
    for (const bad of [undefined, -3, 1.5, '17', null]) {
      const s = progressed();
      if (bad === undefined) delete s.summon.total_pulls;
      else s.summon.total_pulls = bad;
      const { r } = load(s);
      expect(r.damaged).toBe(false);
      expect(r.save.summon.total_pulls).toBe(0);
      expect(codes(r)).toEqual(['summon_total_pulls_reset:total_pulls']);
      expectPlayable(r);
    }
  });

  it('an extra field in `summon` (schema additionalProperties: false) is dropped', () => {
    const s = progressed();
    s.summon.seed = 1234;
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(r.save.summon).toEqual(progressed().summon);
    expect(codes(r)).toEqual(['summon_extra_field:seed']);
    expectPlayable(r);
  });

  it('prototype-named keys are treated as data, never as Object.prototype', () => {
    const raw = JSON.stringify(progressed()).replace('"pity":{', '"pity":{"__proto__":5,"constructor":2,');
    const { r } = load(raw);
    expect(r.damaged).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(r.save.summon.pity, '__proto__')).toBe(false);
    expect(r.save.summon.pity.constructor).toBe(2);
    expectPlayable(r);
  });

  it('the repair is written back and the next load is clean', () => {
    const s = progressed();
    delete s.summon.first_multi_done;
    const { r, st } = load(s);
    expect(JSON.parse(st.getItem(SAVE_KEY)).summon.first_multi_done).toEqual({});
    const again = loadSave(st, { validate, economy, characters, nowMs: NOW + 1 });
    expect(again.repaired).toBe(false);
    expect(again.warnings).toEqual([]);
    expect(r.save.summon).toEqual(again.save.summon);
  });

  it('a valid save is not repaired; repairSummon does not mutate its input', () => {
    const s = progressed();
    const { r } = load(s);
    expect(r.repaired).toBe(false);
    const bad = progressed();
    bad.summon.total_pulls = -1;
    const before = JSON.stringify(bad);
    const fix = repairSummon(bad);
    expect(fix.summon.total_pulls).toBe(0);
    expect(JSON.stringify(bad)).toBe(before);
  });

  it('every warning code the loader can emit is in the exported SAVE_REPAIR_WARNING_CODES list', () => {
    expect(SAVE_REPAIR_WARNING_CODES).toEqual([
      'team_not_array', 'team_unknown_id', 'team_not_playable', 'team_unowned', 'team_duplicate', 'team_extra', 'team_refilled',
      'summon_reset', 'summon_pity_reset', 'summon_pity_entry_dropped', 'summon_first_multi_reset',
      'summon_first_multi_entry_dropped', 'summon_total_pulls_reset', 'summon_extra_field',
    ]);
  });

  it('a roster entry above max_resonance (data lowered it) loads and a duplicate converts to Jade', () => {
    const s = progressed();
    s.roster[0].resonance = economy.duplicates.max_resonance + 2;
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expectPlayable(r);
  });
});
