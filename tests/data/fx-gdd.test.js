// GDD §15.4 FX-GDD: the frozen data copy in tests/fixtures/gdd that every W-class (worked example) test runs on.
// - Each file's SHA-256 is pinned here. Changing a fixture file needs a GDD change naming the AC it serves, and the
//   hash below updated in the same commit.
// - FX-GDD passes the schemas and §15.3 rules 1–9 (`npm run validate-data -- --dir tests/fixtures/gdd`);
//   rules 10–12 (balance limits) are not run on it.
// - Must-FAIL checks: a copy without char_fxbase_001 fails rule 2; one edited number fails the hash check.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DATA_FILES } from '../../scripts/lib/data-validator.js';
import { ROOT, FX_GDD_DIR, loadAllData } from '../helpers/load-data.js';

const DIR = path.join(ROOT, FX_GDD_DIR);

// Source: `git show 8ab0ca6:data/<file>` (round-2 close, the last commit before round 3), re-serialised with
// 2-space JSON, plus the §15.4 fixture records (char_fxbase_001, enemy_fxbase_001, card_common_fx*).
const FX_GDD_SHA256 = {
  'banners.json': 'bc847a833ecfce6dd6d88963adfdc9700b26082ded2603819eb1b2850843624d',
  'battle.json': 'a0375a05eefeb437d7e32f312d5e7ef4e7a14d38cf45d953a2d5326c35dd1459',
  'cards.json': '2347add748b2a7c9ca9ea3b673221a8c941282f640e2eb2b2b8277df746d5467',
  'characters.json': 'ae6a38b045394787b04abd46930a7a6fb13060ec5e12eccaa7660998fe0fcd93',
  'economy.json': '43a4af4a3e6757b6ee76eb4c368be8f2df121f6dabfd3d0c0376236ee643710d',
  'enemies.json': 'aafdf4204c733cf3979bb49ea16c8444e41c79abbedd31ee66bfc6d8304df977',
  'stages.json': '428ea9e9aa464db0ea8bb9be0c06292a80b20b0d2aafb00262651697f188e3c7',
  'story.json': 'e927ef1c4c297ca265bda3c8917e2053dd73bd9d3f8646e4ec1a51c79c67bd0e',
};

/** SHA-256 of a file's text with CRLF normalised to LF (so a Windows checkout gives the same hash). */
function fileHash(p) {
  const text = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Files in `dir` whose hash differs from FX_GDD_SHA256 (or that are missing / extra). */
function fixtureHashMismatches(dir) {
  const out = [];
  const present = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const f of Object.keys(FX_GDD_SHA256)) {
    if (present.indexOf(f) < 0) { out.push(f + ': missing'); continue; }
    const h = fileHash(path.join(dir, f));
    if (h !== FX_GDD_SHA256[f]) out.push(f + ': sha256 ' + h + ' != pinned ' + FX_GDD_SHA256[f]);
  }
  for (const f of present) if (!Object.prototype.hasOwnProperty.call(FX_GDD_SHA256, f)) out.push(f + ': not pinned');
  return out;
}

function runCli(args) {
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'validate-data.js')].concat(args), { encoding: 'utf8', cwd: ROOT });
}

function copyFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fxgdd-'));
  for (const f of fs.readdirSync(DIR)) fs.copyFileSync(path.join(DIR, f), path.join(tmp, f));
  return tmp;
}

describe('GDD §15.4 FX-GDD fixture', () => {
  it('pins every §15.1 data file and nothing else', () => {
    expect(Object.keys(FX_GDD_SHA256).sort()).toEqual(DATA_FILES.map((d) => d.file).sort());
  });
  it('every fixture file matches its pinned SHA-256', () => {
    expect(fixtureHashMismatches(DIR)).toEqual([]);
  });
  it('must-FAIL: editing one number in a fixture file without updating its hash fails the hash check', () => {
    const tmp = copyFixture();
    const p = path.join(tmp, 'characters.json');
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    doc.characters[0].base_stats.hp += 1;
    fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
    const bad = fixtureHashMismatches(tmp);
    fs.rmSync(tmp, { recursive: true, force: true });
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain('characters.json');
  });
  it('holds the GDD reference values (Tavi HP 8,200 and Ignition; fxbase records)', () => {
    const d = loadAllData(FX_GDD_DIR);
    const chars = {};
    for (const c of d['characters.json'].characters) chars[c.id] = c;
    const tavi = chars.char_tavi_001;
    expect(tavi.base_stats.hp).toBe(8200);
    expect(tavi.ignition.triggers).toEqual([{ type: 'hp_below_pct', value: 50 }, { type: 'battle_time_s', value: 60 }]);
    expect(tavi.ignition.stat_mult.atk).toBe(1.3);
    expect(tavi.ignition.duration_s).toBe(25);
    expect(tavi.ignition.heal_pct).toBe(0.1);
    expect(tavi.ignition.vigor_regen_bonus).toBe(0.2);
    const fx = chars.char_fxbase_001;
    expect(fx.rarity).toBe(4);
    expect(fx.aura).toBe('blaze');
    expect(fx.base_stats).toEqual({ hp: 10000, atk: 1000, def: 500, crit_rate: 0.05 });
    expect(fx.ignition).toBeUndefined();
    let n = 0;
    for (const e of fx.deck) n += e.count;
    expect(n).toBe(8);
    const en = d['enemies.json'].enemies.find((e) => e.id === 'enemy_fxbase_001');
    expect(en).toEqual({
      id: 'enemy_fxbase_001', character_id: 'char_fxbase_001', ai_tier: 'rookie',
      stat_mult: { hp: 1.2, atk: 1.0, def: 1.0 }, ignition_enabled: false, boss: false,
    });
  });
  it('passes the schemas and §15.3 rules 1–9 via `validate-data --dir tests/fixtures/gdd` (rules 10–12 not applied)', () => {
    const r = runCli(['--dir', FX_GDD_DIR]);
    expect(r.stdout).toContain('validate-data: PASS');
    expect(r.stdout).toContain('rules 10–12 skipped (FX-GDD');
    expect(r.status).toBe(0);
  });
  it('must-FAIL: the fixture validation on a copy with char_fxbase_001 removed fails rule 2 (enemy reference)', () => {
    const tmp = copyFixture();
    const p = path.join(tmp, 'characters.json');
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    doc.characters = doc.characters.filter((c) => c.id !== 'char_fxbase_001');
    fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
    const r = runCli(['--dir', tmp, '--skip-balance']);
    fs.rmSync(tmp, { recursive: true, force: true });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/ERROR \[2-references\] enemies\.json .*enemy_fxbase_001.*char_fxbase_001/);
  });
});
