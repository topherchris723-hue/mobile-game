#!/usr/bin/env node
// Android app-identity + permission check (release-engineer, round 7; reviewer R-3, compliance item 6).
//
//   node android/tools/check-identity.mjs [--root <repo dir>] [--apk <path to built .apk>]
//
// Source checks (always): capacitor.config.json appId/appName/webDir, applicationId == appId,
// versionName == package.json version and MAJOR.MINOR.PATCH, versionCode is a positive integer and is the
// one recorded in docs/RELEASE.md, target/compile SDK >= MIN_TARGET_SDK, portrait lock on the launcher
// activity, VIBRATE declared, INTERNET removed, adaptive icon has foreground/background/monochrome PNGs
// at every density, no Capacitor default art left.
// APK checks (with --apk, needs aapt from the Android SDK build-tools; set AAPT=<path> if not on PATH): the MERGED manifest's permissions
// are exactly the allowed list, and the badging shows the expected package, version and target SDK.
// Exit code 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Google Play: since 2026-08-31 new apps and updates must target API 36 (Android 16).
// Verified on developer.android.com/google/play/requirements/target-sdk on 2026-10-24.
export const MIN_TARGET_SDK = 36;
const EXPECTED_APP_NAME = 'Jade Tempest';
const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const ICON_FILES = ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground', 'ic_launcher_background', 'ic_launcher_monochrome'];

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const root = path.resolve(opt('--root') ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const apk = opt('--apk');

const fails = [];
const ok = [];
const check = (cond, msg) => (cond ? ok : fails).push(msg);
const read = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { fails.push(`missing file ${rel}`); return ''; } };

const cap = (() => { try { return JSON.parse(read('capacitor.config.json')); } catch { fails.push('capacitor.config.json is not valid JSON'); return {}; } })();
const pkg = JSON.parse(read('package.json') || '{}');
const gradle = read('android/app/build.gradle');
const vars = read('android/variables.gradle');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const release = read('docs/RELEASE.md');
const strings = read('android/app/src/main/res/values/strings.xml');

const appId = cap.appId ?? '';
check(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(appId), `appId "${appId}" is a lower-case reverse-domain id with >= 3 parts`);
check(!/^com\.(getcapacitor|example)\b/.test(appId), `appId "${appId}" is not a template id`);
check(cap.appName === EXPECTED_APP_NAME, `appName is "${EXPECTED_APP_NAME}" (got "${cap.appName}")`);
check(cap.webDir === 'dist', `webDir is "dist" (got "${cap.webDir}")`);
check(strings.includes(`<string name="app_name">${EXPECTED_APP_NAME}</string>`), 'res/values/strings.xml app_name matches appName');

const appIdGradle = (gradle.match(/applicationId\s+"([^"]+)"/) || [])[1];
check(appIdGradle === appId, `applicationId (${appIdGradle}) == capacitor appId (${appId})`);
const versionName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];
const versionCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
check(/^\d+\.\d+\.\d+$/.test(versionName ?? ''), `versionName "${versionName}" is MAJOR.MINOR.PATCH`);
check(versionName === pkg.version, `versionName (${versionName}) == package.json version (${pkg.version})`);
check(Number.isInteger(versionCode) && versionCode >= 1, `versionCode ${versionCode} is a positive integer`);
const recorded = release.match(/^\|\s*(\d+\.\d+\.\d+)\s*\|\s*(\d+)\s*\|/m);
check(recorded && recorded[1] === versionName && Number(recorded[2]) === versionCode,
  `docs/RELEASE.md version table's newest row (${recorded ? `${recorded[1]} / ${recorded[2]}` : 'none'}) == build.gradle (${versionName} / ${versionCode})`);

const sdk = (k) => Number((vars.match(new RegExp(`${k}\\s*=\\s*(\\d+)`)) || [])[1]);
check(sdk('targetSdkVersion') >= MIN_TARGET_SDK, `targetSdkVersion ${sdk('targetSdkVersion')} >= ${MIN_TARGET_SDK}`);
check(sdk('compileSdkVersion') >= sdk('targetSdkVersion'), `compileSdkVersion ${sdk('compileSdkVersion')} >= targetSdkVersion`);

const activity = (manifest.match(/<activity[\s\S]*?<\/activity>/) || [''])[0];
check(/android:screenOrientation="portrait"/.test(activity), 'launcher activity is locked to portrait');
const perms = [...manifest.matchAll(/<uses-permission\b[^>]*>/g)].map((m) => m[0]);
const declared = perms.filter((p) => !/tools:node="remove"/.test(p)).map((p) => (p.match(/android:name="([^"]+)"/) || [])[1]);
check(declared.length === 1 && declared[0] === 'android.permission.VIBRATE', `source manifest declares only VIBRATE (got ${JSON.stringify(declared)})`);
check(perms.some((p) => /android\.permission\.INTERNET/.test(p) && /tools:node="remove"/.test(p)), 'INTERNET is removed with tools:node="remove"');

const resDir = 'android/app/src/main/res';
for (const d of DENSITIES) for (const f of ICON_FILES) {
  check(fs.existsSync(path.join(root, resDir, `mipmap-${d}`, `${f}.png`)), `${resDir}/mipmap-${d}/${f}.png exists`);
}
for (const f of ['ic_launcher', 'ic_launcher_round']) {
  const x = read(`${resDir}/mipmap-anydpi-v26/${f}.xml`);
  check(/<background android:drawable="@mipmap\/ic_launcher_background"/.test(x) && /<foreground android:drawable="@mipmap\/ic_launcher_foreground"/.test(x)
    && /<monochrome android:drawable="@mipmap\/ic_launcher_monochrome"/.test(x), `${f}.xml adaptive icon has background, foreground and monochrome`);
}
check(!fs.existsSync(path.join(root, resDir, 'drawable-v24', 'ic_launcher_foreground.xml')), 'template vector launcher foreground removed');
check(fs.readdirSync(path.join(root, resDir)).every((d) => !d.startsWith('drawable-land')), 'no landscape splash (template art) left');

if (apk) {
  // Allowed in the merged manifest: VIBRATE, plus androidx.core's app-private signature permission.
  const allowed = new Set(['android.permission.VIBRATE', `${appId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`]);
  const r = spawnSync(process.env.AAPT ?? 'aapt', ['dump', 'badging', apk], { encoding: 'utf8' });
  if (r.status !== 0) {
    fails.push(`aapt dump badging failed on ${apk}: ${r.error?.message ?? r.stderr}`);
  } else {
    const out = r.stdout;
    const merged = [...out.matchAll(/^uses-permission: name='([^']+)'/gm)].map((m) => m[1]);
    const extra = merged.filter((p) => !allowed.has(p));
    check(extra.length === 0, `merged manifest permissions ⊆ allowed (got ${JSON.stringify(merged)})`);
    check(merged.includes('android.permission.VIBRATE'), 'merged manifest has VIBRATE');
    check(out.includes(`package: name='${appId}' versionCode='${versionCode}' versionName='${versionName}'`), 'APK package/version match');
    const t = Number((out.match(/^targetSdkVersion:'(\d+)'/m) || [])[1]);
    check(t >= MIN_TARGET_SDK, `APK targetSdkVersion ${t} >= ${MIN_TARGET_SDK}`);
    check(out.includes(`application-label:'${EXPECTED_APP_NAME}'`), 'APK label is the app name');
    check(/^launchable-activity: name='[^']+'/m.test(out), 'APK has a launchable activity');
  }
}

for (const m of ok) console.log(`  ok   ${m}`);
for (const m of fails) console.log(`  FAIL ${m}`);
console.log(fails.length ? `check-identity: FAIL (${fails.length} problem(s))` : `check-identity: PASS (${ok.length} checks${apk ? ', incl. APK' : ', source only'})`);
process.exit(fails.length ? 1 : 0);
