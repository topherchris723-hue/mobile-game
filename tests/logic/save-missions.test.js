// GDD §9.3 missions, §12 starting save, §13 save data.
import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { missionsMet } from '../../src/logic/missions.js';
import {
  SAVE_KEY, createFreshSave, loadSave, migrateSave, writeSave, applyBattleResult, grantCharacter, addCurrency,
} from '../../src/state/save.js';
import { readJson } from '../helpers/load-data.js';

const economy = readJson('data/economy.json');
const stages = readJson('data/stages.json').stages;
const characters = {};
for (const c of readJson('data/characters.json').characters) characters[c.id] = c;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(readJson('data/schemas/save.schema.json'));
const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);
const NOW_ISO = new Date(NOW).toISOString();

function memoryStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, keys: () => Object.keys(m), raw: m };
}
function winResult(stats, timeS) {
  return { outcome: 'win', reason: 'ko', timeElapsedS: timeS || 60, stats: { playerKos: 0, perfectSlips: 0, maxChain: 1, usedTriBurst: false, usedIgnition: false, cardsPlayed: 5, ...stats } };
}

describe('§9.3 missions', () => {
  it('AC-9.3.1: winning stage_001 with 0 KOs and 2 Perfect Slips completes no_ko and perfect_slips_at_least: 2 together', () => {
    const s1 = stages.find((s) => s.id === 'stage_001');
    const met = missionsMet(s1, winResult({ playerKos: 0, perfectSlips: 2 }));
    expect(met).toContain('mission_001_b');
    expect(met).toContain('mission_001_c');
  });
  it('only a Win meets missions', () => {
    const s1 = stages.find((s) => s.id === 'stage_001');
    expect(missionsMet(s1, { ...winResult({ perfectSlips: 5 }), outcome: 'draw' })).toEqual([]);
    expect(missionsMet(s1, { ...winResult({ perfectSlips: 5 }), outcome: 'lose' })).toEqual([]);
  });
});

describe('§12 / §13 save data', () => {
  it('AC-12.1: a fresh save has exactly 1,000 Jade and the 3 starters, and passes save.schema.json', () => {
    const s = createFreshSave(economy, NOW_ISO);
    expect(s.currencies.cur_jade).toBe(1000);
    expect(s.roster.map((r) => r.character_id)).toEqual(economy.starting.characters);
    expect(s.team).toEqual(economy.starting.team);
    expect(s.version).toBe(1);
    expect(validate(s)).toBe(true);
  });
  it('AC-13.3: a fresh save has settings exactly { bgm 1.0, sfx 1.0, haptics true }, tutorial not completed, empty summon/stages', () => {
    const s = createFreshSave(economy, NOW_ISO);
    expect(s.settings).toStrictEqual({ bgm_volume: 1.0, sfx_volume: 1.0, haptics: true });
    expect(s.tutorial).toStrictEqual({ completed: false });
    expect(s.summon).toStrictEqual({ pity: {}, first_multi_done: {}, total_pulls: 0 });
    expect(s.stages).toStrictEqual({});
    // a missing save also starts with these defaults
    const r = loadSave(memoryStorage(), { validate, economy, characters, nowMs: NOW });
    expect(r.save.settings).toStrictEqual({ bgm_volume: 1.0, sfx_volume: 1.0, haptics: true });
    expect(r.save.tutorial.completed).toBe(false);
  });
  it('AC-13.2: garbage in game_save → fresh save plus a backup key, no crash', () => {
    for (const garbage of ['{not json', '[]', '{"version": 99}', JSON.stringify({ version: 1, hello: 1 })]) {
      const st = memoryStorage();
      st.setItem(SAVE_KEY, garbage);
      const r = loadSave(st, { validate, economy, characters, nowMs: NOW });
      expect(r.damaged).toBe(true);
      expect(r.backupKey).toBe('game_save_corrupt_' + NOW);
      expect(st.getItem(r.backupKey)).toBe(garbage);
      expect(JSON.parse(st.getItem(SAVE_KEY)).currencies.cur_jade).toBe(1000);
    }
  });
  it('a team with two fighters of one family is treated as damaged', () => {
    const st = memoryStorage();
    const s = createFreshSave(economy, NOW_ISO);
    s.roster.push({ character_id: 'char_tavi_002', resonance: 0, obtained_at: NOW_ISO });
    const chars = { ...characters, char_tavi_002: { id: 'char_tavi_002', family: 'tavi' } };
    s.team = ['char_tavi_001', 'char_tavi_002', 'char_lark_001'];
    st.setItem(SAVE_KEY, JSON.stringify(s));
    expect(loadSave(st, { validate, economy, characters: chars, nowMs: NOW }).damaged).toBe(true);
  });
  it('a missing save starts fresh without a damaged notice; a valid save round-trips', () => {
    const st = memoryStorage();
    const r = loadSave(st, { validate, economy, characters, nowMs: NOW });
    expect(r.damaged).toBe(false);
    r.save.currencies.cur_jade = 1234;
    writeSave(st, r.save, NOW + 1000);
    const r2 = loadSave(st, { validate, economy, characters, nowMs: NOW + 2000 });
    expect(r2.damaged).toBe(false);
    expect(r2.save.currencies.cur_jade).toBe(1234);
  });
  it('migrateSave: current version passes through; future or missing versions are rejected', () => {
    const s = createFreshSave(economy, NOW_ISO);
    expect(migrateSave(s)).toBe(s);
    expect(migrateSave({ ...s, version: 2 })).toBeNull();
    expect(migrateSave({ ...s, version: undefined })).toBeNull();
  });
  it('AC-13.1 (logic part): winning stage_001 marks it cleared and adds the reward to Jade', () => {
    const st = memoryStorage();
    const { save } = loadSave(st, { validate, economy, characters, nowMs: NOW });
    const s1 = stages.find((s) => s.id === 'stage_001');
    const out = applyBattleResult(save, s1, winResult({ perfectSlips: 2 }), economy, characters, NOW_ISO);
    writeSave(st, save, NOW);
    const reopened = loadSave(st, { validate, economy, characters, nowMs: NOW + 5000 }).save;
    expect(reopened.stages.stage_001.cleared).toBe(true);
    expect(reopened.currencies.cur_jade).toBe(1000 + 300 + 3 * 50);
    expect(out.missions.sort()).toEqual(['mission_001_a', 'mission_001_b', 'mission_001_c']);
    expect(reopened.tutorial.completed).toBe(true);
    // repeat clear: 30 Jade, missions not paid twice
    applyBattleResult(reopened, s1, winResult({ perfectSlips: 2 }), economy, characters, NOW_ISO);
    expect(reopened.currencies.cur_jade).toBe(1000 + 450 + 30);
    expect(reopened.stages.stage_001.clears).toBe(2);
    expect(validate(reopened)).toBe(true);
  });
  it('Lose/Draw give nothing and cost nothing', () => {
    const save = createFreshSave(economy, NOW_ISO);
    const s1 = stages.find((s) => s.id === 'stage_001');
    applyBattleResult(save, s1, { ...winResult({}), outcome: 'draw' }, economy, characters, NOW_ISO);
    expect(save.currencies.cur_jade).toBe(1000);
    expect(save.stages.stage_001).toBeUndefined();
  });
  it('§11.4 duplicates: Resonance +1 up to 4, then ★-based Jade; Jade capped at 999,999', () => {
    const save = createFreshSave(economy, NOW_ISO);
    const tavi = characters.char_tavi_001;
    for (let i = 1; i <= 4; i++) expect(grantCharacter(save, economy, tavi, NOW_ISO)).toEqual({ kind: 'resonance', resonance: i });
    expect(grantCharacter(save, economy, tavi, NOW_ISO)).toEqual({ kind: 'currency', amount: 10 });
    expect(grantCharacter(save, economy, characters.char_solenne_001, NOW_ISO)).toEqual({ kind: 'new' });
    expect(addCurrency(save, economy, 'cur_jade', 5000000)).toBe(999999 - 1010);
    expect(save.currencies.cur_jade).toBe(999999);
  });
});
