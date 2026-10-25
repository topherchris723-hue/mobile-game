// Round 7: the APK ships native Android code (Capacitor android runtime, MIT; AndroidX and Cordova, Apache-2.0). Their
// notices must be in the shipped THIRD_PARTY_LICENSES.txt (Settings → Licenses) next to the web packages.
// Source of truth: the reviewed list android/third-party/native-deps.json (Gradle cannot resolve in the sandbox).
// Checks here: (1) the list matches every runtime `implementation` declared in the Gradle files (static parse) and the
// installed @capacitor/android version; (2) the notice text renders every native entry with its copyright and full
// licence text, and a missing one FAILS; (3) the CI checker (scripts/check-native-licenses.mjs, run on Gradle's
// releaseRuntimeClasspath in .github/workflows/build-android.yml) passes a covered classpath and FAILS on an unlisted
// module, a version mismatch, an unlisted project, or a stale exact entry.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  loadNativeDeps, renderNativeNotices, missingNativeNotices, declaredGradleDeps, renderNotices,
} from '../../scripts/third-party-licenses.mjs';
import { parseRuntimeClasspath, checkClasspath } from '../../scripts/check-native-licenses.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const FIX = path.join(ROOT, 'tests', 'fixtures', 'native');
const okTree = fs.readFileSync(path.join(FIX, 'runtime-classpath-ok.txt'), 'utf8');

describe('native (Android) third-party notices', () => {
  const native = loadNativeDeps(ROOT);

  it('the reviewed list covers every runtime dependency declared in the Gradle files, at the declared version', () => {
    const declared = declaredGradleDeps(ROOT);
    expect(declared.modules.length).toBeGreaterThanOrEqual(8); // not blind
    expect(declared.projects.sort()).toEqual([':capacitor-android', ':capacitor-cordova-android-plugins']);
    const exact = {};
    for (const m of native.modules) exact[m.id] = m.version;
    for (const d of declared.modules) expect(exact[d.id], d.id + ' (' + d.file + ')').toBe(d.version);
    for (const p of declared.projects) expect(native.projects.map((x) => x.project)).toContain(p);
    expect(declared.jars, 'no local jars in libs/ (they would need their own entries)').toEqual([]);
  });

  it('the Capacitor entries carry the installed @capacitor/android version and its own LICENSE text', () => {
    const pj = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', '@capacitor', 'android', 'package.json'), 'utf8'));
    const cap = native.projects.find((p) => p.project === ':capacitor-android');
    expect(cap.version).toBe(pj.version);
    expect(cap.licenseText).toContain('Copyright (c) 2017-present Drifty Co.');
    expect(cap.licenseText).toContain('MIT License');
  });

  it('every native entry is rendered with its name, version, licence, copyright and full licence text', () => {
    const text = renderNativeNotices(native);
    expect(missingNativeNotices(native, text)).toEqual([]);
    expect(text).toContain('Copyright (c) 2017-present Drifty Co.');
    expect(text).toContain('Copyright (C) The Android Open Source Project');
    expect(text).toContain('TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION'); // full Apache-2.0 text
    expect(text).toContain('Apache Cordova');
  });

  it('must-FAIL: a notice text without the Capacitor runtime, or without an AndroidX entry, is caught', () => {
    const noCap = { ...native, projects: native.projects.filter((p) => p.project !== ':capacitor-android') };
    expect(missingNativeNotices(native, renderNativeNotices(noCap))).toContain('@capacitor/android (Capacitor Android runtime)');
    const noWebkit = { ...native, modules: native.modules.filter((m) => m.id !== 'androidx.webkit:webkit') };
    expect(missingNativeNotices(native, renderNativeNotices(noWebkit))).toContain('androidx.webkit:webkit');
    const noApache = renderNativeNotices(native).replace(/TERMS AND CONDITIONS FOR USE/g, 'x');
    expect(missingNativeNotices(native, noApache)).toContain('Apache-2.0 licence text');
  });

  it('the full notice (web + native) is what the build emits: renderNotices(pkgs, app, native) includes both', () => {
    const web = [{ name: 'phaser', version: '3.90.0', license: 'MIT', licenseText: 'The MIT License (MIT)\n\nCopyright (c) 2020 Richard Davey' }];
    const all = renderNotices(web, 'Jade Tempest', native);
    expect(all).toContain('==== phaser 3.90.0 (MIT) ====');
    expect(missingNativeNotices(native, all)).toEqual([]);
  });

  it('the built dist/THIRD_PARTY_LICENSES.txt contains every native notice (vite build, write: false)', async () => {
    const { build } = await import('vite');
    const out = await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), logLevel: 'error', build: { write: false } });
    const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
    const notice = outputs.find((f) => f.type === 'asset' && f.fileName === 'THIRD_PARTY_LICENSES.txt');
    expect(notice).toBeTruthy();
    expect(missingNativeNotices(native, String(notice.source))).toEqual([]);
    const pk = outputs.find((f) => f.type === 'asset' && f.fileName === 'third-party-packages.json');
    const names = JSON.parse(String(pk.source)).map((p) => p.name);
    expect(names).toContain('@capacitor/android (Capacitor Android runtime)');
    expect(names).toContain('androidx.appcompat:appcompat');
  }, 180000);
});

describe('CI check: Gradle releaseRuntimeClasspath vs the reviewed list', () => {
  const native = loadNativeDeps(ROOT);
  it('parses modules (with -> overrides), projects, and skips constraints (c)', () => {
    const p = parseRuntimeClasspath(okTree);
    expect(p.projects.sort()).toEqual([':capacitor-android', ':capacitor-cordova-android-plugins']);
    expect(p.modules).toContainEqual({ group: 'androidx.activity', artifact: 'activity', version: '1.11.0' });
    expect(p.modules.find((m) => m.artifact === 'kotlinx-coroutines-android')).toBeUndefined();
  });
  it('a fully covered classpath passes', () => {
    expect(checkClasspath(parseRuntimeClasspath(okTree), native)).toEqual([]);
  });
  it('must-FAIL: an unlisted runtime module (new group) fails', () => {
    const tree = okTree.replace('+--- androidx.core:core-splashscreen:1.2.0', '+--- androidx.core:core-splashscreen:1.2.0\n+--- com.squareup.okhttp3:okhttp:4.12.0');
    expect(checkClasspath(parseRuntimeClasspath(tree), native).join('\n')).toContain('com.squareup.okhttp3:okhttp:4.12.0 is not covered');
  });
  it('must-FAIL: a listed module resolved at another version fails', () => {
    const tree = okTree.replace('androidx.webkit:webkit:1.14.0', 'androidx.webkit:webkit:1.13.0 -> 1.15.0');
    expect(checkClasspath(parseRuntimeClasspath(tree), native).join('\n')).toContain('androidx.webkit:webkit resolved 1.15.0, list says 1.14.0');
  });
  it('must-FAIL: an unlisted project and a stale exact entry fail', () => {
    const tree = okTree.replace('\\--- project :capacitor-cordova-android-plugins', '+--- project :capacitor-camera\n\\--- project :capacitor-cordova-android-plugins')
      .replace('+--- androidx.core:core-splashscreen:1.2.0\n', '');
    const errs = checkClasspath(parseRuntimeClasspath(tree), native).join('\n');
    expect(errs).toContain('project :capacitor-camera is not covered');
    expect(errs).toContain('androidx.core:core-splashscreen 1.2.0 is listed but not on the runtime classpath');
  });
  it('must-FAIL: an empty / unparsable dependency report fails (never a blind PASS)', () => {
    expect(checkClasspath(parseRuntimeClasspath('BUILD SUCCESSFUL'), native).join('\n')).toContain('no runtime dependencies found');
  });
  it('the CLI exits 0 on the covered report and 1 on a broken one', () => {
    const cli = (input) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-native-licenses.mjs')], { input, encoding: 'utf8', cwd: ROOT });
    expect(cli(okTree).status).toBe(0);
    const bad = cli(okTree.replace('androidx.webkit:webkit:1.14.0', 'com.example:evil:1.0'));
    expect(bad.status).toBe(1);
    expect(bad.stdout + bad.stderr).toContain('com.example:evil:1.0 is not covered');
  });
});
