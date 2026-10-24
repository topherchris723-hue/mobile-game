#!/usr/bin/env node
// CI check (round 7): every module and project on Gradle's release runtime classpath is covered by the reviewed list
// android/third-party/native-deps.json (exact entry with the same version, or a group rule), and every exact entry is
// actually resolved. Input: the text of `./gradlew :app:dependencies --configuration releaseRuntimeClasspath` on stdin
// (or a file path argument). Exit 0 = covered, 1 = not covered (prints each problem), 2 = could not run.
// Used by .github/workflows/build-android.yml; tests: tests/data/third-party-native.test.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNativeDeps } from './third-party-licenses.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Parse a Gradle dependency tree. Returns { modules: [{ group, artifact, version }], projects: [':x'] } (unique).
 * `a:b:1.0 -> 1.2` counts as 1.2; dependency constraints `(c)` and unresolved `(n)` lines are skipped.
 */
export function parseRuntimeClasspath(text) {
  const modules = [];
  const projects = [];
  const seen = {};
  for (const raw of String(text).split('\n')) {
    const m = raw.match(/^[|\s]*[+\\]--- (.+)$/);
    if (!m) continue;
    let item = m[1].trim();
    if (/\((c|n)\)$/.test(item)) continue;
    item = item.replace(/\s*\(\*\)$/, '').trim();
    const pr = item.match(/^project (:[\w:.-]+)/);
    if (pr) { if (projects.indexOf(pr[1]) < 0) projects.push(pr[1]); continue; }
    const parts = item.split(' -> ');
    const gav = parts[0].split(':');
    if (gav.length < 2) continue;
    let version = parts.length > 1 ? parts[1].trim() : (gav[2] || '');
    if (parts.length > 1 && parts[1].indexOf(':') >= 0) version = parts[1].split(':').pop();
    const key = gav[0] + ':' + gav[1] + ':' + version;
    if (seen[key]) continue;
    seen[key] = true;
    modules.push({ group: gav[0], artifact: gav[1], version: version });
  }
  return { modules: modules, projects: projects };
}

/** Does a group rule `match` cover group:artifact? ('androidx.*' = group androidx or androidx.x; 'g:a' = exact). */
function ruleCovers(match, group, artifact) {
  if (match.indexOf(':') >= 0) return match === group + ':' + artifact;
  if (match.endsWith('.*')) {
    const base = match.slice(0, -2);
    return group === base || group.indexOf(base + '.') === 0;
  }
  return group === match;
}

/** Problems (strings) of a parsed classpath against the native list; [] = covered. */
export function checkClasspath(parsed, native) {
  const errs = [];
  if (parsed.modules.length === 0 && parsed.projects.length === 0) {
    return ['no runtime dependencies found in the Gradle report (wrong configuration or task output?)'];
  }
  const exact = {};
  for (const m of native.modules) exact[m.id] = m;
  const resolved = {};
  for (const d of parsed.modules) {
    const id = d.group + ':' + d.artifact;
    resolved[id] = true;
    if (Object.prototype.hasOwnProperty.call(exact, id)) {
      if (exact[id].version !== d.version) errs.push(id + ' resolved ' + d.version + ', list says ' + exact[id].version + ' (update ' + 'android/third-party/native-deps.json)');
      continue;
    }
    if (!native.groupRules.some((g) => ruleCovers(g.match, d.group, d.artifact))) {
      errs.push(id + ':' + d.version + ' is not covered by android/third-party/native-deps.json (add an entry with its licence and copyright)');
    }
  }
  for (const p of parsed.projects) {
    if (!native.projects.some((x) => x.project === p)) errs.push('project ' + p + ' is not covered by android/third-party/native-deps.json');
  }
  for (const m of native.modules) {
    if (!resolved[m.id]) errs.push(m.id + ' ' + m.version + ' is listed but not on the runtime classpath (remove or fix the entry)');
  }
  for (const p of native.projects) {
    if (parsed.projects.indexOf(p.project) < 0) errs.push('project ' + p.project + ' is listed but not on the runtime classpath');
  }
  return errs;
}

function main() {
  let text;
  try {
    text = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8');
  } catch (e) {
    console.error('check-native-licenses: cannot read input: ' + e.message);
    return 2;
  }
  const native = loadNativeDeps(ROOT);
  const parsed = parseRuntimeClasspath(text);
  const errs = checkClasspath(parsed, native);
  console.log('Runtime classpath: ' + parsed.modules.length + ' modules, ' + parsed.projects.length + ' projects');
  for (const e of errs) console.log('ERROR ' + e);
  console.log(errs.length ? 'check-native-licenses: FAIL' : 'check-native-licenses: PASS');
  return errs.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
