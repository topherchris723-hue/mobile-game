// GDD §15.3 ruling R4-6 — rules 13 (audio/VFX licensing, pattern lengths, music/hook keys), 14 (flash safety, shake,
// flashes per second, cinematic fit) and 15 (key coverage warnings). L-shared-006: every rule has must-FAIL and
// must-PASS fixtures in tests/fixtures/validator-r4/ (ops applied to a minimal valid audio.json / vfx.json /
// CREDITS.md base, on top of the live data files). Also: vfx.json / audio.json are optional until they exist.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseBannedTerms, validateDataset, parseCreditsRows, parseExportedStringList } from '../../scripts/lib/data-validator.js';
import { ROOT, loadAllData, loadAllSchemas, loadGdd } from '../helpers/load-data.js';

const DIR = path.join(ROOT, 'tests', 'fixtures', 'validator-r4');
const banned = parseBannedTerms(loadGdd());
const schemas = loadAllSchemas();
const readFx = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const BASE_CREDITS = fs.readFileSync(path.join(DIR, 'base-credits.md'), 'utf8');
// The test stand-ins for the UI's exported lists (the real ones are read from src/ui by the CLI).
const SFX_HOOKS = ['hit_fist', 'ko', 'ui_press'];
const VFX_EVENT_KEYS = ['ignition', 'hit.fist', 'ko', 'hit_discarded'];

function applyOps(data, ops) {
  for (const op of ops) {
    let target = data[op.file];
    for (let i = 0; i < op.path.length - 1; i++) target = target[op.path[i]];
    const last = op.path[op.path.length - 1];
    if (op.op === 'set') target[last] = op.value;
    else if (op.op === 'delete') {
      if (Array.isArray(target)) target.splice(last, 1);
      else delete target[last];
    } else throw new Error('unknown op ' + op.op);
  }
}

/** Live data + the base audio/vfx, the fixture's ops, CREDITS text and existing files → validateDataset result. */
function run(fx) {
  const data = loadAllData();
  data['audio.json'] = readFx('base-audio.json');
  data['vfx.json'] = readFx('base-vfx.json');
  applyOps(data, (fx && fx.ops) || []);
  let credits = fx && typeof fx.credits === 'string' ? fx.credits : BASE_CREDITS;
  if (fx && fx.creditsAppend) credits = credits.trimEnd().split('\n').concat(fx.creditsAppend).join('\n') + '\n';
  const files = (fx && fx.files) || [];
  return validateDataset(data, schemas, banned, [], {
    credits: credits,
    fileExists: (p) => files.indexOf(p) >= 0,
    listVfxFiles: () => files.filter((p) => p.indexOf('assets/vfx/') === 0),
    sfxHooks: SFX_HOOKS,
    vfxEventKeys: VFX_EVENT_KEYS,
  });
}

const key = (e) => e.rule + '|' + e.file + '|' + e.path + '|' + e.message;
const R4 = ['13-licensing', '14-flash-safety', '15-key-coverage'];

describe('validate-data rules 13–15: base fixtures pass', () => {
  it('the base all-procedural audio.json + one data/audio.json CREDITS row + base vfx.json have 0 rule 13/14 errors and 0 schema errors', () => {
    const r = run(null);
    expect(r.errors.filter((e) => R4.indexOf(e.rule) >= 0 || e.file === 'audio.json' || e.file === 'vfx.json')).toEqual([]);
  });
});

describe('validate-data rules 13–15: fixtures (each must FAIL / PASS / WARN as named)', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f.indexOf('base-') !== 0).sort();
  const baseline = {};
  for (const e of run(null).errors) baseline[key(e)] = true;
  it('has must-FAIL fixtures for rules 13 and 14, must-PASS fixtures, and rule-15 warning fixtures', () => {
    const names = files.join(' ');
    for (const tag of ['rule13-', 'rule14-', 'ok-rule13', 'ok-rule14', 'warning-rule15']) expect(names).toContain(tag);
  });
  for (const f of files) {
    const fx = readFx(f);
    it(fx.name, () => {
      const r = run(fx);
      const added = r.errors.filter((e) => !baseline[key(e)]);
      if (fx.expect.errorRule) {
        const msgs = added.filter((e) => e.rule === fx.expect.errorRule).map((e) => e.message);
        expect(msgs.length, JSON.stringify(added)).toBeGreaterThan(0);
        if (fx.expect.errorContains) expect(msgs.some((m) => m.indexOf(fx.expect.errorContains) >= 0), JSON.stringify(msgs)).toBe(true);
      } else {
        expect(added).toEqual([]);
      }
      if (fx.expect.warningRule) {
        const ws = r.warnings.filter((w) => w.rule === fx.expect.warningRule).map((w) => w.message);
        expect(ws.some((m) => m.indexOf(fx.expect.warningContains) >= 0), JSON.stringify(ws)).toBe(true);
      }
    });
  }
});

describe('validate-data rules 13–15: helpers and optional files', () => {
  it('parseCreditsRows reads File and License cells (backticks stripped), ignoring header and separator rows', () => {
    const rows = parseCreditsRows(BASE_CREDITS + '| assets/audio/a.ogg | sound | X | CC0 | yes | 4 |\n');
    expect(rows).toEqual([{ file: 'data/audio.json', license: 'self-made' }, { file: 'assets/audio/a.ogg', license: 'CC0' }]);
    expect(parseCreditsRows('')).toEqual([]);
  });
  it('parseExportedStringList finds `export const NAME = [ ... ]` string literals, or null', () => {
    const src = "export const SFX_HOOKS = [\n  'ui_press', \"ko\", // c\n  'hit_fist',\n];\nexport const X = 1;";
    expect(parseExportedStringList(src, 'SFX_HOOKS')).toEqual(['ui_press', 'ko', 'hit_fist']);
    expect(parseExportedStringList(src, 'NOPE')).toBeNull();
  });
  it('without vfx.json / audio.json the data set validates with a notice per missing optional file, not an error', () => {
    const data = loadAllData();
    delete data['vfx.json'];
    delete data['audio.json'];
    const r = validateDataset(data, schemas, banned, [], {});
    expect(r.errors.filter((e) => e.file === 'vfx.json' || e.file === 'audio.json')).toEqual([]);
    expect(r.notices.join(' ')).toContain('vfx.json');
    expect(r.notices.join(' ')).toContain('audio.json');
  });
  it('rule 15 is a warning only (exit code 0) and rules 13/14 are errors (exit code 1) in the CLI', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd4-'));
    const data = loadAllData();
    data['audio.json'] = readFx('base-audio.json');
    data['vfx.json'] = readFx('base-vfx.json');
    for (const k of Object.keys(data)) fs.writeFileSync(path.join(dir, k), JSON.stringify(data[k]));
    const credits = path.join(dir, 'CREDITS.md');
    fs.writeFileSync(credits, BASE_CREDITS);
    const cli = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'validate-data.js'), '--dir', dir, '--credits', credits], { encoding: 'utf8' });
    const ok = cli();
    expect(ok.stdout).toContain('WARN  [15-key-coverage]');
    expect(ok.stdout).toContain('validate-data: PASS');
    expect(ok.status).toBe(0);
    data['vfx.json'].effects.ignition_default.layers[0].color = '#ff2020';
    fs.writeFileSync(path.join(dir, 'vfx.json'), JSON.stringify(data['vfx.json']));
    const bad = cli();
    expect(bad.stdout).toContain('ERROR [14-flash-safety]');
    expect(bad.status).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('must PASS: the default data/vfx.json and data/audio.json with assets/CREDITS.md (when they exist) have 0 rule 13/14 errors', () => {
    const present = ['vfx.json', 'audio.json'].filter((f) => fs.existsSync(path.join(ROOT, 'data', f)));
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'validate-data.js')], { encoding: 'utf8' });
    for (const f of ['vfx.json', 'audio.json']) {
      if (present.indexOf(f) < 0) expect(r.stdout).toContain('NOTICE ' + f + ' not present');
    }
    expect(r.stdout).not.toContain('[13-licensing]');
    expect(r.stdout).not.toContain('[14-flash-safety]');
  });
});
