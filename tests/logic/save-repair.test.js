// GDD §13 save repair (BUG-2-04, BUG-2-05) and GDD §9.1 stage unlock (isStageUnlocked).
// "IDs in the save that no longer exist in the data are ignored on load"; team = "3 character ids,
// distinct families, all owned". The loader must always hand the UI a team it can field.
import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SAVE_KEY, createFreshSave, loadSave, repairTeam, isStageUnlocked } from '../../src/state/save.js';
import { createBattle, createContent } from '../../src/logic/index.js';
import { readJson, loadBundle } from '../helpers/load-data.js';

const economy = readJson('data/economy.json');
const content = createContent({ ...loadBundle(), economy });
const characters = content.characters;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(readJson('data/schemas/save.schema.json'));
const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);
const NOW_ISO = new Date(NOW).toISOString();
const STARTERS = economy.starting.team;

function memoryStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, keys: () => Object.keys(m) };
}

/** A progressed save (cleared stage_001, 4321 Jade) with the given team and extra roster ids. */
function progressedSave(team, extraRoster) {
  const s = createFreshSave(economy, NOW_ISO);
  s.currencies.cur_jade = 4321;
  s.stages.stage_001 = { cleared: true, clears: 2, best_time_s: 40, missions_completed: ['mission_001_a'] };
  for (const id of extraRoster || []) s.roster.push({ character_id: id, resonance: 1, obtained_at: NOW_ISO });
  s.team = team;
  return s;
}

function load(saveObj) {
  const st = memoryStorage();
  st.setItem(SAVE_KEY, JSON.stringify(saveObj));
  const r = loadSave(st, { validate, economy, characters, nowMs: NOW });
  return { r, st };
}

/** The repaired team must be fieldable: valid by schema + rules, and createBattle accepts it. */
function expectUsableTeam(r) {
  const save = r.save;
  expect(save.team.length).toBe(3);
  const fams = save.team.map((id) => characters[id].family);
  expect(new Set(fams).size).toBe(3);
  for (const id of save.team) {
    expect(characters[id]).toBeDefined();
    expect(save.roster.some((x) => x.character_id === id)).toBe(true);
  }
  expect(validate(save)).toBe(true);
  const b = createBattle({ content, stageId: 'stage_001', playerTeam: save.team.slice(), skipIntro: true }, 1);
  expect(b.getState().teams.player.fighters.length).toBe(3);
}

function codes(r) {
  return r.warnings.map((w) => w.code + ':' + w.characterId);
}

describe('§13 save repair on load', () => {
  it('BUG-2-04: a team id missing from the data is dropped, the team is refilled, progress is kept, roster entry is not deleted', () => {
    const { r, st } = load(progressedSave(['char_tavi_001', 'char_lark_001', 'char_removed_099'], ['char_removed_099']));
    expect(r.damaged).toBe(false);
    expect(r.backupKey).toBeNull();
    expect(r.repaired).toBe(true);
    expect(r.save.team).toEqual(['char_tavi_001', 'char_lark_001', 'char_dunmore_001']);
    expect(codes(r)).toEqual(['team_unknown_id:char_removed_099', 'team_refilled:char_dunmore_001']);
    expect(r.save.currencies.cur_jade).toBe(4321);
    expect(r.save.stages.stage_001.cleared).toBe(true);
    // GDD §13: ignored, not deleted, so a later data fix restores the fighter to the roster
    expect(r.save.roster.some((x) => x.character_id === 'char_removed_099')).toBe(true);
    expectUsableTeam(r);
    // the repair is written back, and a second load is clean
    expect(JSON.parse(st.getItem(SAVE_KEY)).team).toEqual(r.save.team);
    const again = loadSave(st, { validate, economy, characters, nowMs: NOW + 1000 });
    expect(again.repaired).toBe(false);
    expect(again.warnings).toEqual([]);
    expect(again.save.team).toEqual(r.save.team);
  });

  it('BUG-2-05: a fighter the player does not own is removed from the team and the team is refilled', () => {
    const s = progressedSave(['char_corvane_001', 'char_lark_001', 'char_dunmore_001']);
    expect(s.roster.some((x) => x.character_id === 'char_corvane_001')).toBe(false);
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(r.repaired).toBe(true);
    expect(r.save.team).not.toContain('char_corvane_001');
    expect(r.save.team).toEqual(['char_lark_001', 'char_dunmore_001', 'char_tavi_001']);
    expect(codes(r)).toEqual(['team_unowned:char_corvane_001', 'team_refilled:char_tavi_001']);
    expect(r.save.currencies.cur_jade).toBe(4321);
    expectUsableTeam(r);
  });

  it('an empty team is refilled from the starters (not reset, progress kept)', () => {
    const { r } = load(progressedSave([]));
    expect(r.damaged).toBe(false);
    expect(r.repaired).toBe(true);
    expect(r.save.team).toEqual(STARTERS);
    expect(r.save.stages.stage_001.cleared).toBe(true);
    expectUsableTeam(r);
  });

  it('a duplicate team entry is dropped and the slot refilled', () => {
    const { r } = load(progressedSave(['char_tavi_001', 'char_tavi_001', 'char_lark_001']));
    expect(r.damaged).toBe(false);
    expect(r.repaired).toBe(true);
    expect(r.save.team).toEqual(['char_tavi_001', 'char_lark_001', 'char_dunmore_001']);
    expect(codes(r)).toEqual(['team_duplicate:char_tavi_001', 'team_refilled:char_dunmore_001']);
    expectUsableTeam(r);
  });

  it('refill falls back to other owned fighters when a starter is not usable', () => {
    // roster: tavi, lark, dunmore + pell; team names an unknown id and a starter family is taken
    const s = progressedSave(['char_removed_099', 'char_pell_001', 'char_xx_998'], ['char_pell_001']);
    s.roster = s.roster.filter((x) => x.character_id !== 'char_tavi_001'); // tavi not owned any more
    const { r } = load(s);
    expect(r.damaged).toBe(false);
    expect(r.save.team).toEqual(['char_pell_001', 'char_lark_001', 'char_dunmore_001']);
    expectUsableTeam(r);
  });

  it('an over-long team keeps its first 3 valid slots', () => {
    const { r } = load(progressedSave(['char_tavi_001', 'char_lark_001', 'char_dunmore_001', 'char_pell_001'], ['char_pell_001']));
    expect(r.damaged).toBe(false);
    expect(r.save.team).toEqual(['char_tavi_001', 'char_lark_001', 'char_dunmore_001']);
    expect(codes(r)).toEqual(['team_extra:char_pell_001']);
  });

  it('ids that collide with Object.prototype names are unknown, not crashes', () => {
    const { r } = load(progressedSave(['constructor', '__proto__', 'char_tavi_001']));
    expect(r.damaged).toBe(false);
    expect(r.save.team).toEqual(['char_tavi_001', 'char_lark_001', 'char_dunmore_001']);
    expectUsableTeam(r);
  });

  it('a team that cannot be filled to 3 owned fighters of distinct families is damaged (fresh save + backup)', () => {
    const s = progressedSave(['char_tavi_001', 'char_lark_001', 'char_removed_099']);
    s.roster = s.roster.filter((x) => x.character_id !== 'char_dunmore_001');
    const { r, st } = load(s);
    expect(r.damaged).toBe(true);
    expect(st.getItem(r.backupKey)).toBe(JSON.stringify(s));
    expect(r.save.team).toEqual(STARTERS);
  });

  it('a valid save is not repaired and not rewritten', () => {
    const s = progressedSave(['char_lark_001', 'char_tavi_001', 'char_dunmore_001']);
    const { r, st } = load(s);
    expect(r.repaired).toBe(false);
    expect(r.warnings).toEqual([]);
    expect(r.save.team).toEqual(['char_lark_001', 'char_tavi_001', 'char_dunmore_001']);
    expect(st.getItem(SAVE_KEY)).toBe(JSON.stringify(s));
  });

  it('repairTeam does not change the save it is given', () => {
    const s = progressedSave(['char_tavi_001', 'char_removed_099', 'char_tavi_001']);
    const before = JSON.stringify(s);
    const fix = repairTeam(s, characters, economy);
    expect(fix.ok).toBe(true);
    expect(fix.team).toEqual(['char_tavi_001', 'char_lark_001', 'char_dunmore_001']);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('§9.1 isStageUnlocked', () => {
  const stageList = readJson('data/stages.json').stages;

  it('stage 1 is always unlocked; the others unlock when unlock_requires is cleared', () => {
    const save = createFreshSave(economy, NOW_ISO);
    expect(isStageUnlocked(save, 'stage_001', content.stages)).toBe(true);
    expect(isStageUnlocked(save, 'stage_002', content.stages)).toBe(false);
    save.stages.stage_001 = { cleared: false, clears: 0, best_time_s: null, missions_completed: [] };
    expect(isStageUnlocked(save, 'stage_002', content.stages)).toBe(false);
    save.stages.stage_001.cleared = true;
    expect(isStageUnlocked(save, 'stage_002', content.stages)).toBe(true);
    expect(isStageUnlocked(save, 'stage_003', content.stages)).toBe(false);
  });

  it('every shipped stage follows its unlock_requires chain', () => {
    const save = createFreshSave(economy, NOW_ISO);
    for (const st of stageList) {
      const expected = st.unlock_requires === null;
      expect(isStageUnlocked(save, st.id, content.stages)).toBe(expected);
    }
    for (const st of stageList) save.stages[st.id] = { cleared: true, clears: 1, best_time_s: 10, missions_completed: [] };
    for (const st of stageList) expect(isStageUnlocked(save, st.id, content.stages)).toBe(true);
  });

  it('an unknown stage id is locked', () => {
    const save = createFreshSave(economy, NOW_ISO);
    expect(isStageUnlocked(save, 'stage_999', content.stages)).toBe(false);
    expect(isStageUnlocked(save, 'constructor', content.stages)).toBe(false);
  });
});
