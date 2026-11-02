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

describe('release bundle has no test hooks', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-bundle-'));
  it('npm run build (no VITE_TEST_HOOKS) contains no test-hook names (__TEST__, summonSeed, summonLog, tutorialStep, audioDebug, vfxQuality, settingsScreen, particlesNow)', () => {
    const js = buildTo(path.join(tmp, 'rel'), false);
    expect(js.length).toBeGreaterThan(100000);
    expect(hookMarkers(js)).toEqual([]);
  }, 180000);
  it('negative run: a VITE_TEST_HOOKS=1 build does contain them (the scan can fail)', () => {
    const js = buildTo(path.join(tmp, 'test'), true);
    expect(hookMarkers(js)).toEqual(['__TEST__', 'summonSeed', 'summonLog', 'tutorialStep', 'audioDebug', 'vfxQuality', 'settingsScreen', 'particlesNow', 'silhouetteSheet', 'licensesScreen']);
  }, 180000);
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
