// Third-party licence notices for the shipped bundle (compliance round 6, FAIL 2).
// Built from the bundler's ACTUAL module list (never a hand list): every module id under node_modules/ maps to its
// package; each package contributes name, version, licence and the full LICENSE text found in its folder.
// Used by vite.config.js (writes dist/THIRD_PARTY_LICENSES.txt) and by tests/ui/release-bundle.test.js.
// Round 7: the native Android dependencies shipped in the APK/AAB (Capacitor android runtime, AndroidX, Cordova) are
// appended from the reviewed list android/third-party/native-deps.json (checked against Gradle's runtime classpath in
// CI by scripts/check-native-licenses.mjs, and against the Gradle files by tests/data/third-party-native.test.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const LICENSE_FILE = 'THIRD_PARTY_LICENSES.txt';
const LICENSE_NAMES = /^(licen[cs]e|copying|notice)(\..*)?$/i;

/** Package root dir for a module id inside node_modules (handles scoped and nested packages), or null. */
export function packageDirOf(id) {
  const clean = id.replace(/^\0/, '').split('?')[0].replace(/\\/g, '/');
  const i = clean.lastIndexOf('/node_modules/');
  if (i < 0) return null;
  const rest = clean.slice(i + '/node_modules/'.length).split('/');
  const n = rest[0].startsWith('@') ? 2 : 1;
  return clean.slice(0, i + '/node_modules/'.length) + rest.slice(0, n).join('/');
}

/** Unique bundled packages: [{ name, version, license, dir, licenseText }] sorted by name. */
export function collectPackages(moduleIds) {
  const dirs = new Set();
  for (const id of moduleIds) {
    const d = packageDirOf(id);
    if (d) dirs.add(d);
  }
  const out = new Map();
  for (const dir of dirs) {
    const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const key = pj.name + '@' + pj.version;
    if (out.has(key)) continue;
    const files = fs.readdirSync(dir).filter((f) => LICENSE_NAMES.test(f)).sort();
    const licenseText = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim()).join('\n\n');
    const license = typeof pj.license === 'string' ? pj.license : pj.license && pj.license.type ? pj.license.type : 'UNKNOWN';
    out.set(key, { name: pj.name, version: pj.version, license, dir, licenseText });
  }
  return [...out.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** The notice file text (web packages, then native entries if given). Throws if any licence text is missing. */
export function renderNotices(pkgs, appName, native) {
  const missing = pkgs.filter((p) => !p.licenseText);
  if (missing.length) throw new Error('No licence text found for: ' + missing.map((p) => p.name + '@' + p.version).join(', '));
  const head = [
    `${appName || 'This app'} includes the following third-party software.`,
    'Each package is listed with its version and licence, followed by its full copyright notice and licence text.',
    '',
  ];
  const body = pkgs.map((p) => [`==== ${p.name} ${p.version} (${p.license}) ====`, '', p.licenseText, ''].join('\n'));
  const nativeText = native ? '\n' + renderNativeNotices(native) : '';
  return head.join('\n') + '\n' + body.join('\n') + nativeText;
}

// ---------------------------------------------------------------- native (Android) dependencies, round 7

export const NATIVE_DEPS_FILE = 'android/third-party/native-deps.json';

/**
 * Load the reviewed native list and attach licence texts: { projects[], modules[], groupRules[], texts{licence → text} }.
 * Throws if a licence file is missing or empty (the build must not ship without it).
 */
export function loadNativeDeps(root) {
  const list = JSON.parse(fs.readFileSync(path.join(root, NATIVE_DEPS_FILE), 'utf8'));
  const texts = {};
  const read = (e) => {
    const t = fs.readFileSync(path.join(root, e.licenseFile), 'utf8').trim();
    if (!t) throw new Error('Empty licence file ' + e.licenseFile + ' for ' + (e.name || e.id));
    return t;
  };
  for (const p of list.projects) {
    p.licenseText = read(p);
    if (p.versionFrom) p.version = JSON.parse(fs.readFileSync(path.join(root, p.versionFrom), 'utf8')).version;
  }
  for (const e of list.modules.concat(list.groupRules)) {
    if (e.license === 'MIT') e.licenseText = read(e);
    else if (!texts[e.license]) texts[e.license] = read(e);
  }
  return { projects: list.projects, modules: list.modules, groupRules: list.groupRules, texts: texts };
}

/** Header line of one native entry (also used to detect a missing entry). */
function nativeHeader(e) {
  if (e.project) return `==== ${e.name} ${e.version} (${e.license}) ====`;
  if (e.match) return `==== ${e.match} — ${e.name} (${e.license}) ====`;
  return `==== ${e.id} ${e.version} — ${e.name} (${e.license}) ====`;
}

/**
 * The native section: each Capacitor project with its full MIT text, each module / group rule with its copyright
 * line and NOTICE text, then the full text of every other licence used (Apache-2.0) once.
 */
export function renderNativeNotices(native) {
  const out = ['Native Android components (included in the Android app):', ''];
  const block = (e) => {
    const lines = [nativeHeader(e), '', e.copyright];
    if (e.notice) lines.push('', 'NOTICE:', e.notice);
    if (e.licenseText) lines.push('', e.licenseText);
    else lines.push('', `Licensed under the ${e.license} licence; the full text is under "==== ${e.license} licence text ====" below.`);
    lines.push('');
    return lines.join('\n');
  };
  for (const p of native.projects) out.push(block(p));
  for (const m of native.modules) out.push(block(m));
  for (const g of native.groupRules) out.push(block(g));
  for (const lic of Object.keys(native.texts).sort()) out.push(`==== ${lic} licence text ====`, '', native.texts[lic], '');
  return out.join('\n');
}

/** Names of native entries (or 'Apache-2.0 licence text') whose notice is missing from a text (test helper). */
export function missingNativeNotices(native, text) {
  const miss = [];
  for (const p of native.projects) if (!text.includes(nativeHeader(p)) || !text.includes(p.licenseText)) miss.push(p.name);
  for (const m of native.modules) if (!text.includes(nativeHeader(m)) || !text.includes(m.copyright)) miss.push(m.id);
  for (const g of native.groupRules) if (!text.includes(nativeHeader(g)) || !text.includes(g.copyright)) miss.push(g.match);
  for (const lic of Object.keys(native.texts)) {
    if (!text.includes(`==== ${lic} licence text ====`) || !text.includes(native.texts[lic])) miss.push(lic + ' licence text');
  }
  return miss;
}

/**
 * Static parse of the runtime `implementation` lines in the Gradle files that build the app (test cross-check; CI
 * checks the real resolved classpath). Returns { modules: [{ id, version, file }], projects: [':x'], jars: [paths] }.
 */
export function declaredGradleDeps(root) {
  const vars = {};
  const varText = fs.readFileSync(path.join(root, 'android', 'variables.gradle'), 'utf8');
  for (const m of varText.matchAll(/(\w+)\s*=\s*'([^']+)'/g)) vars[m[1]] = m[2];
  const files = [
    'android/app/build.gradle',
    'android/capacitor-cordova-android-plugins/build.gradle',
    'node_modules/@capacitor/android/capacitor/build.gradle',
  ];
  const modules = [];
  const projects = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of text.matchAll(/^\s*(?:implementation|api|runtimeOnly)\s+"([^":]+):([^":]+):([^"]+)"/gm)) {
      const v = m[3].replace(/^\$\{?(\w+)\}?$/, (_, k) => vars[k] || m[3]);
      const id = m[1] + ':' + m[2];
      if (!modules.some((x) => x.id === id && x.version === v)) modules.push({ id: id, version: v, file: f });
    }
    for (const m of text.matchAll(/^\s*(?:implementation|api|runtimeOnly)\s+project\('([^']+)'\)/gm)) {
      if (projects.indexOf(m[1]) < 0) projects.push(m[1]);
    }
  }
  const jars = [];
  for (const d of ['android/app/libs', 'android/capacitor-cordova-android-plugins/src/main/libs', 'node_modules/@capacitor/android/capacitor/libs']) {
    const dir = path.join(root, d);
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.jar') || f.endsWith('.aar')) jars.push(d + '/' + f);
  }
  return { modules: modules, projects: projects, jars: jars };
}

/** Packages whose notice block is missing from a notice text (test helper). */
export function missingNotices(pkgs, text) {
  return pkgs.filter((p) => !text.includes(`==== ${p.name} ${p.version} (${p.license}) ====`) || !text.includes(p.licenseText)).map((p) => p.name);
}

/** Vite / Rollup plugin: emit THIRD_PARTY_LICENSES.txt next to the bundle. */
export function thirdPartyLicenses(appName) {
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle(_, bundle) {
      const ids = [];
      for (const f of Object.values(bundle)) if (f.type === 'chunk') ids.push(...Object.keys(f.modules || {}), ...(f.moduleIds || []));
      const pkgs = collectPackages(ids);
      const native = loadNativeDeps(REPO_ROOT);
      this.emitFile({ type: 'asset', fileName: LICENSE_FILE, source: renderNotices(pkgs, appName, native) });
      const list = pkgs.map((p) => ({ name: p.name, version: p.version, license: p.license }))
        .concat(native.projects.map((p) => ({ name: p.name, version: p.version, license: p.license, native: true })))
        .concat(native.modules.map((m) => ({ name: m.id, version: m.version, license: m.license, native: true })))
        .concat(native.groupRules.map((g) => ({ name: g.match, version: '(as resolved)', license: g.license, native: true })));
      this.emitFile({ type: 'asset', fileName: 'third-party-packages.json', source: JSON.stringify(list, null, 2) });
    },
  };
}
