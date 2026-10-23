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
  return ['__TEST__', 'summonSeed', 'summonLog', 'tutorialStep', 'audioDebug', 'vfxQuality', 'settingsScreen', 'particlesNow'].filter((m) => js.includes(m));
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
    expect(hookMarkers(js)).toEqual(['__TEST__', 'summonSeed', 'summonLog', 'tutorialStep', 'audioDebug', 'vfxQuality', 'settingsScreen', 'particlesNow']);
  }, 180000);
});
