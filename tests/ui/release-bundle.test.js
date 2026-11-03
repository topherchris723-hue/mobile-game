// ui-developer (round 3, security): a normal `npm run build` bundle must not contain the Playwright hooks
// (window.__TEST__, the fixed ?seed / ?summonSeed params). The same scan on a VITE_TEST_HOOKS=1 build must
// find them — that is the negative run proving the scan can fail (L-shared-006).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../helpers/load-data.js';

function buildTo(dir, testHooks) {
  // A clean environment like a CI release build (Vitest's own NODE_ENV / VITEST_* variables would leak in).
  const env = { PATH: process.env.PATH, HOME: process.env.HOME || os.tmpdir() };
  if (testHooks) env.VITE_TEST_HOOKS = '1';
  const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dir, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('vite build failed: ' + r.stderr);
  let js = '';
  for (const f of fs.readdirSync(path.join(dir, 'assets'))) if (f.endsWith('.js')) js += fs.readFileSync(path.join(dir, 'assets', f), 'utf8');
  return js;
}

/** Hook markers that must never ship. */
export function hookMarkers(js) {
  return ['__TEST__', 'summonSeed', 'summonLog', 'tutorialStep', 'audioDebug', 'vfxQuality', 'settingsScreen', 'particlesNow', 'silhouetteSheet', 'licensesScreen'].filter((m) => js.includes(m));
}

function walk(dir, ext) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

/**
 * BUG-7c-02: test-only switches on scene objects. Derived from source on every run (no hand-written list): every
 * property a spec under tests/e2e sets on a scene handle (`sc.<name> = …`) that src/ itself never writes and does
 * not define as a method. Such a property only exists to change behaviour in tests (negative proofs, short fades).
 */
export function sceneSwitches(specTexts, srcTexts) {
  const set = new Set();
  for (const t of specTexts) for (const m of t.matchAll(/\bsc\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) set.add(m[1]);
  const src = srcTexts.join('\n');
  return [...set].filter((n) => !new RegExp(`\\.${n}\\s*(=(?!=)|\\+\\+|--|[-+*/|&]=)`).test(src) && !new RegExp(`^\\s+(async\\s+)?${n}\\s*\\(`, 'm').test(src)).sort();
}

/** Every read of a switch in src/ must be `TEST_HOOKS && this.<name>` (so the minifier drops it). Returns bad uses. */
export function ungatedSwitchUses(names, files) {
  const bad = [];
  for (const { file, text } of files) {
    for (const n of names) {
      for (const m of text.matchAll(new RegExp(`(.{0,20})\\b(this|sc|scene)\\.${n}\\b`, 'g'))) {
        if (!/TEST_HOOKS\s*&&\s*$/.test(m[1])) bad.push(`${file}: ${m[0].trim()}`);
      }
    }
  }
  return bad;
}

const readAll = (files) => files.map((f) => ({ file: path.relative(ROOT, f), text: fs.readFileSync(f, 'utf8') }));
const SPECS = readAll(walk(path.join(ROOT, 'tests/e2e'), ['.js']));
const SRC = readAll(walk(path.join(ROOT, 'src'), ['.js']));

describe('test-only scene switches are gated by TEST_HOOKS (BUG-7c-02)', () => {
  it('the hook gate is exactly VITE_TEST_HOOKS === \'1\' (never DEV, MODE or a URL parameter)', () => {
    const th = fs.readFileSync(path.join(ROOT, 'src/ui/test-hooks.js'), 'utf8');
    expect(th).toContain("export const TEST_HOOKS = import.meta.env.VITE_TEST_HOOKS === '1';");
    for (const { file, text } of SRC) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const envUses = [...code.matchAll(/import\.meta\.env\.[A-Z_]+/g)].map((m) => m[0]);
      if (file !== path.join('src', 'ui', 'test-hooks.js')) expect(envUses, file).toEqual([]);
      else expect(envUses).toEqual(['import.meta.env.VITE_TEST_HOOKS']);
    }
  });
  it('switch list is derived from the specs and is not empty', () => {
    const names = sceneSwitches(SPECS.map((f) => f.text), SRC.map((f) => f.text));
    for (const n of ['disableComboZones', 'disablePopClamp', 'disableShoutFit', 'cinFadeMs']) expect(names).toContain(n);
    for (const n of ['leaving', 'processing', 'modal', 'popCombo', 'shout']) expect(names).not.toContain(n); // real state / methods
  });
  it('every read of a switch in src/ is gated: TEST_HOOKS && this.<switch>', () => {
    const names = sceneSwitches(SPECS.map((f) => f.text), SRC.map((f) => f.text));
    expect(ungatedSwitchUses(names, SRC)).toEqual([]);
  });
  it('must-FAIL: a planted ungated switch is found (by the derivation and by the gate check)', () => {
    const planted = [{ file: 'planted.js', text: 'floatAvoid() {\n    if (!this.disableFooZones) out.push(z);\n    const p = TEST_HOOKS && this.disableBar ? 1 : 2;\n  }' }];
    const names = sceneSwitches(['sc.disableFooZones = true;', 'sc.disableBar = true;'], planted.map((f) => f.text));
    expect(names).toEqual(['disableBar', 'disableFooZones']);
    expect(ungatedSwitchUses(names, planted)).toEqual(['planted.js: if (!this.disableFooZones']);
  });
});

let relJs = '';
let hookJs = '';
describe('release bundle has no test hooks', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-bundle-'));
  it('npm run build (no VITE_TEST_HOOKS) contains no test-hook names (__TEST__, summonSeed, summonLog, tutorialStep, audioDebug, vfxQuality, settingsScreen, particlesNow)', () => {
    const js = buildTo(path.join(tmp, 'rel'), false);
    relJs = js;
    expect(js.length).toBeGreaterThan(100000);
    expect(hookMarkers(js)).toEqual([]);
  }, 180000);
  it('negative run: a VITE_TEST_HOOKS=1 build does contain them (the scan can fail)', () => {
    const js = buildTo(path.join(tmp, 'test'), true);
    hookJs = js;
    expect(hookMarkers(js)).toEqual(['__TEST__', 'summonSeed', 'summonLog', 'tutorialStep', 'audioDebug', 'vfxQuality', 'settingsScreen', 'particlesNow', 'silhouetteSheet', 'licensesScreen']);
  }, 180000);
  it('BUG-7c-02: no test-only scene switch (derived from the specs) is in the release bundle; each is in the hook build', () => {
    const names = sceneSwitches(SPECS.map((f) => f.text), SRC.map((f) => f.text));
    expect(relJs.length).toBeGreaterThan(100000);
    expect(names.filter((n) => relJs.includes(n))).toEqual([]);
    expect(names.filter((n) => !hookJs.includes(n))).toEqual([]);
  });
});

// Compliance round 6 (FAIL 2): every package the bundler actually put into the release bundle has its full notice
// (name, version, licence, copyright + licence text from node_modules) in dist/THIRD_PARTY_LICENSES.txt.
// The module list comes from an independent in-process build (write: false), not from the plugin's own output.
import { collectPackages, missingNotices, renderNotices, LICENSE_FILE } from '../../scripts/third-party-licenses.mjs';

async function bundledModuleIds() {
  const { build } = await import('vite');
  const out = await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), logLevel: 'error', build: { write: false } });
  const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
  const ids = [];
  for (const f of outputs) if (f.type === 'chunk') ids.push(...Object.keys(f.modules || {}), ...(f.moduleIds || []));
  const notice = outputs.find((f) => f.type === 'asset' && f.fileName === LICENSE_FILE);
  return { ids, notice: notice ? String(notice.source) : null };
}

describe('third-party licence notices ship with the bundle', () => {
  let r;
  it('the bundle module list finds the runtime packages (not blind)', async () => {
    r = await bundledModuleIds();
    const names = collectPackages(r.ids).map((p) => p.name);
    for (const n of ['phaser', 'ajv', 'ajv-formats']) expect(names).toContain(n);
  }, 180000);
  it('every bundled package has its full notice in THIRD_PARTY_LICENSES.txt', () => {
    expect(r.notice, LICENSE_FILE + ' emitted').toBeTruthy();
    const pkgs = collectPackages(r.ids);
    expect(pkgs.every((p) => p.licenseText.length > 200), 'licence texts found').toBe(true);
    expect(missingNotices(pkgs, r.notice)).toEqual([]);
    for (const p of pkgs) expect(r.notice).toMatch(/Copyright|copyright/);
  });
  it('must-FAIL: a notice with one package removed is caught', () => {
    const pkgs = collectPackages(r.ids);
    const victim = pkgs.find((p) => p.name === 'fast-uri') || pkgs[0];
    const broken = renderNotices(pkgs.filter((p) => p !== victim), 'x');
    expect(missingNotices(pkgs, broken)).toEqual([victim.name]);
  });
  it('must-FAIL: a bundled package without licence text stops the build', () => {
    expect(() => renderNotices([{ name: 'nolicense', version: '1.0.0', license: 'MIT', licenseText: '' }], 'x')).toThrow(/nolicense@1.0.0/);
  });
  it('ajv and ajv-formats (runtime imports) are dependencies, not devDependencies', () => {
    const pj = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    for (const n of ['ajv', 'ajv-formats', 'phaser']) {
      expect(pj.dependencies[n], n).toBeTruthy();
      expect((pj.devDependencies || {})[n], n).toBeUndefined();
    }
  });
});
