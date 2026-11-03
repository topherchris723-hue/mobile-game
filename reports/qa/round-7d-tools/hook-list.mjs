// QA 7d: independent release-bundle hook list, derived from source on every run (not the ui-dev sceneSwitches()).
// 1) every key written on the hook object: `T.<key> =` / `T.<key>.push` / `T.<key>(` in src/, plus keys set in installTestHooks;
// 2) every property ANY spec/helper under tests/e2e assigns on ANY object (`<x>.<prop> = …`), that src/ never assigns and
//    never defines as a method/field (so it only exists for tests);
// 3) every property src/ reads only behind `TEST_HOOKS &&` (gated switches), as a cross-check.
// Usage: node hook-list.mjs <root> [distDir]   -> prints the list, and with distDir a per-name word count in dist/assets/*.js
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const dist = process.argv[3] ? path.resolve(process.argv[3]) : null;
const walk = (d, ext) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p, ext) : ext.some((x) => e.name.endsWith(x)) ? [p] : [];
});
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const src = walk(path.join(root, 'src'), ['.js']).map((f) => strip(fs.readFileSync(f, 'utf8'))).join('\n');
const specs = walk(path.join(root, 'tests/e2e'), ['.js']).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const hook = new Set();
for (const m of src.matchAll(/\bT\.([A-Za-z_$][\w$]*)/g)) hook.add(m[1]);
for (const m of src.matchAll(/__TEST__\s*=\s*\{([^}]*)\}/g)) for (const k of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) hook.add(k[1]);
hook.add('__TEST__');
for (const m of src.matchAll(/testSeedParam\('([A-Za-z_$][\w$]*)'\)/g)) hook.add(m[1]);
for (const m of src.matchAll(/\bT\.[A-Za-z_$][\w$]*\s*=\s*\{([^{}]*)\}/g)) for (const k of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) hook.add(k[1]);
const written = (n) => new RegExp(`\\.${n}\\s*(=(?!=)|\\+\\+|--|[-+*/|&]=)|\\b${n}\\s*:|^\\s+(async\\s+)?(get |set )?${n}\\s*\\(|^\\s+${n}\\s*=`, 'm').test(src);
const specSet = new Set();
for (const m of specs.matchAll(/\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) specSet.add(m[1]);
const switches = [...specSet].filter((n) => !written(n) && new RegExp(`\\b${n}\\b`).test(src));
const gated = new Set();
for (const m of src.matchAll(/TEST_HOOKS\s*&&\s*!?\(?\s*this\.([A-Za-z_$][\w$]*)/g)) gated.add(m[1]);
const names = [...new Set([...hook, ...switches, ...gated])].sort();
const out = { hookKeys: [...hook].sort(), specSwitches: switches.sort(), gatedReads: [...gated].sort() };
if (dist) {
  const js = fs.readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8')).join('\n');
  out.counts = Object.fromEntries(names.map((n) => [n, (js.match(new RegExp(`(?<![\\w$])${n.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')) || []).length]));
  out.nonzero = names.filter((n) => out.counts[n] > 0);
}
console.log(JSON.stringify(out, null, 1));
