// Third-party licence notices for the shipped bundle (compliance round 6, FAIL 2).
// Built from the bundler's ACTUAL module list (never a hand list): every module id under node_modules/ maps to its
// package; each package contributes name, version, licence and the full LICENSE text found in its folder.
// Used by vite.config.js (writes dist/THIRD_PARTY_LICENSES.txt) and by tests/ui/release-bundle.test.js.
import fs from 'node:fs';
import path from 'node:path';

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

/** The notice file text. Throws if a bundled package has no licence text (the build must not ship without it). */
export function renderNotices(pkgs, appName) {
  const missing = pkgs.filter((p) => !p.licenseText);
  if (missing.length) throw new Error('No licence text found for: ' + missing.map((p) => p.name + '@' + p.version).join(', '));
  const head = [
    `${appName || 'This app'} includes the following third-party software.`,
    'Each package is listed with its version and licence, followed by its full copyright notice and licence text.',
    '',
  ];
  const body = pkgs.map((p) => [`==== ${p.name} ${p.version} (${p.license}) ====`, '', p.licenseText, ''].join('\n'));
  return head.join('\n') + '\n' + body.join('\n');
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
      this.emitFile({ type: 'asset', fileName: LICENSE_FILE, source: renderNotices(pkgs, appName) });
      this.emitFile({ type: 'asset', fileName: 'third-party-packages.json', source: JSON.stringify(pkgs.map((p) => ({ name: p.name, version: p.version, license: p.license })), null, 2) });
    },
  };
}
