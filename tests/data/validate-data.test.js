// GDD §15.3 validator tests. L-shared-006: every rule is proven to FAIL on broken data.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseBannedTerms, validateDataset } from '../../scripts/lib/data-validator.js';
import { ROOT, loadAllData, loadAllSchemas, loadGdd } from '../helpers/load-data.js';

const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'validator');
const banned = parseBannedTerms(loadGdd());
const schemas = loadAllSchemas();

/** Apply a fixture's mutation ops to a data set. */
function applyOps(doc, ops) {
  for (const op of ops) {
    let target = doc;
    for (let i = 0; i < op.path.length - 1; i++) target = target[op.path[i]];
    const last = op.path[op.path.length - 1];
    if (op.op === 'set') target[last] = op.value;
    else if (op.op === 'delete') {
      if (Array.isArray(target)) target.splice(last, 1);
      else delete target[last];
    } else throw new Error('unknown op ' + op.op);
  }
}

describe('validate-data: banned terms come from GDD §3', () => {
  it('parses the full list, with Stand/Hollow as warnings only', () => {
    expect(banned.errorTerms).toContain('kamehameha');
    expect(banned.errorTerms).toContain('dragon balls');
    expect(banned.errorTerms).toContain('awakening');
    expect(banned.errorTerms).toContain('rasengan');
    expect(banned.errorTerms).not.toContain('stand');
    expect(banned.warningTerms.sort()).toEqual(['hollow', 'stand']);
    expect(banned.errorTerms.length).toBeGreaterThanOrEqual(38);
    // round 2 additions to §3
    expect(banned.errorTerms).toContain('legends limited');
    expect(banned.errorTerms).toContain('legendary finish');
    expect(banned.errorTerms).toContain('sparking');
  });
  it('parses the §3 name-only list (rule 9): spark and sparks, not in the everywhere list', () => {
    expect(banned.nameOnlyTerms.sort()).toEqual(['spark', 'sparks']);
    expect(banned.errorTerms).not.toContain('spark');
    expect(banned.errorTerms).not.toContain('sparks');
  });
  it('fails closed when the name-only paragraph is missing', () => {
    const gdd = loadGdd().replace('**Name-only banned terms', '**Other terms');
    expect(() => parseBannedTerms(gdd)).toThrow();
  });
  it('rule 9 checks name_override (enemies) at any depth', () => {
    const data = loadAllData();
    data['enemies.json'].enemies[0].name_override = 'Sparks';
    const r = validateDataset(data, schemas, banned, []);
    expect(r.errors.filter((e) => e.rule === '9-name-only-terms').map((e) => e.path)).toEqual(['.enemies[0].name_override']);
  });
  it('throws (fails closed) when the GDD paragraph is missing', () => {
    expect(() => parseBannedTerms('# no list here')).toThrow();
  });
});

describe('validate-data: current data passes', () => {
  it('has 0 errors', () => {
    const r = validateDataset(loadAllData(), schemas, banned, []);
    expect(r.errors).toEqual([]);
  });
});

describe('validate-data: negative fixtures (each must FAIL its rule)', () => {
  const files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).sort();
  it('has at least one fixture per rule 1–9 plus schema', () => {
    const all = files.map((f) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8')).name).join(' ');
    for (const tag of ['schema', 'rule1', 'rule2', 'rule3', 'rule4', 'rule5', 'rule6', 'rule7', 'rule8', 'rule9']) {
      expect(all).toContain(tag);
    }
  });
  for (const f of files) {
    const fx = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8'));
    it(fx.name, () => {
      const data = loadAllData();
      applyOps(data[fx.file], fx.ops);
      const r = validateDataset(data, schemas, banned, []);
      if (fx.expect.errorRule) {
        expect(r.errors.map((e) => e.rule)).toContain(fx.expect.errorRule);
      } else {
        expect(r.errors).toEqual([]);
      }
      if (fx.expect.warningRule) expect(r.warnings.map((w) => w.rule)).toContain(fx.expect.warningRule);
      if (fx.expect.warningRule === null) expect(r.warnings).toEqual([]);
    });
  }
  it('reports a data file that GDD §15.1 does not list', () => {
    const r = validateDataset(loadAllData(), schemas, banned, ['skills.json']);
    expect(r.errors.map((e) => e.rule)).toContain('files');
  });
  it('reports a missing data file instead of crashing', () => {
    const data = loadAllData();
    delete data['enemies.json'];
    const r = validateDataset(data, schemas, banned, []);
    expect(r.errors.some((e) => e.file === 'enemies.json')).toBe(true);
  });
});

describe('validate-data CLI exit codes', () => {
  function runCli(dataDir) {
    return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'validate-data.js'), '--data-dir', dataDir,
      '--schema-dir', path.join(ROOT, 'data', 'schemas')], { encoding: 'utf8' });
  }
  it('exits 0 on the real data', () => {
    const r = runCli(path.join(ROOT, 'data'));
    expect(r.stdout).toContain('validate-data: PASS');
    expect(r.status).toBe(0);
  });
  it('exits 1 on broken data (banned term + bad reference)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-'));
    const data = loadAllData();
    data['cards.json'].cards[0].name = 'Spirit Bomb';
    data['enemies.json'].enemies[0].character_id = 'char_ghost_001';
    for (const k of Object.keys(data)) fs.writeFileSync(path.join(dir, k), JSON.stringify(data[k]));
    const r = runCli(dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('7-banned-terms');
    expect(r.stdout).toContain('2-references');
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('exits 1 on invalid JSON', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-'));
    const data = loadAllData();
    for (const k of Object.keys(data)) fs.writeFileSync(path.join(dir, k), JSON.stringify(data[k]));
    fs.writeFileSync(path.join(dir, 'cards.json'), '{ "version": 1, "cards": [');
    const r = runCli(dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('invalid JSON');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
