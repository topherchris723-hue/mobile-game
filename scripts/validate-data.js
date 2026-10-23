#!/usr/bin/env node
// `npm run validate-data` — validates data/*.json against data/schemas (Ajv, JSON Schema 2020-12),
// the GDD §15.3 cross-file rules 1–9, the §15.3 balance limits 10–12 and the GDD §3 banned-term lists
// (read from docs/GDD.md).
// Usage: node scripts/validate-data.js [--dir <dir> | --data-dir <dir>] [--schema-dir <dir>] [--gdd <path>] [--skip-balance]
//   --dir tests/fixtures/gdd validates the FX-GDD fixture (GDD §15.4): rules 10–12 are skipped automatically for it.
//   --skip-balance skips rules 10–12 for any directory.
//   --credits <path> CREDITS.md for rule 13 (default assets/CREDITS.md). Asset paths in rule 13 are repo-relative.
//   Rule 15 reads SFX_HOOKS (src/ui/**, then src/audio/**) and VFX_EVENT_KEYS (src/vfx/**) as literal lists from
//   source text (`--src-root <dir>` overrides src/, for tests); not found → a NOTICE and those warnings are skipped.
// Exit code 0 = no errors (warnings allowed), 1 = errors found, 2 = could not run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FILES, parseBannedTerms, validateDataset } from './lib/data-validator.js';
import { findExportedList } from './lib/source-lists.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : fallback;
}

const dataDir = argValue('--dir', argValue('--data-dir', path.join(root, 'data')));
const FX_GDD_DIR = path.join(root, 'tests', 'fixtures', 'gdd');
const isFxGdd = path.resolve(dataDir) === FX_GDD_DIR;
const skipBalance = process.argv.indexOf('--skip-balance') >= 0 || isFxGdd;
const schemaDir = argValue('--schema-dir', path.join(root, 'data', 'schemas'));
const gddPath = argValue('--gdd', path.join(root, 'docs', 'GDD.md'));
const creditsPath = argValue('--credits', path.join(root, 'assets', 'CREDITS.md'));

const srcRoot = argValue('--src-root', path.join(root, 'src'));

/** Inputs for §15.3 rules 13–15 (CREDITS.md, files on disk, the UI's exported key lists). */
function mediaOptions() {
  const vfxDir = path.join(root, 'assets', 'vfx');
  // Producer decision (round 4): VFX code lives in src/vfx/, audio in src/audio/; SFX_HOOKS is exported by src/ui/.
  const hooks = findExportedList([path.join(srcRoot, 'ui'), path.join(srcRoot, 'audio')], 'SFX_HOOKS');
  const events = findExportedList([path.join(srcRoot, 'vfx')], 'VFX_EVENT_KEYS');
  return {
    credits: fs.existsSync(creditsPath) ? fs.readFileSync(creditsPath, 'utf8') : '',
    fileExists: (p) => fs.existsSync(path.join(root, p)),
    listVfxFiles: () => (fs.existsSync(vfxDir) ? fs.readdirSync(vfxDir).map((f) => 'assets/vfx/' + f) : []),
    sfxHooks: hooks ? hooks.list : null,
    vfxEventKeys: events ? events.list : null,
  };
}

function main() {
  const data = {};
  const schemas = {};
  const parseErrors = [];
  const known = DATA_FILES.map((d) => d.file);
  const present = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
  const extra = present.filter((f) => known.indexOf(f) < 0);

  for (const entry of DATA_FILES) {
    for (const [dir, name, target] of [[dataDir, entry.file, data], [schemaDir, entry.schema, schemas]]) {
      const p = path.join(dir, name);
      if (!fs.existsSync(p)) continue; // reported as missing by validateDataset
      try {
        target[name] = JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (e) {
        parseErrors.push({ rule: 'json', file: name, path: '', message: 'invalid JSON: ' + e.message });
      }
    }
  }

  let banned;
  try {
    banned = parseBannedTerms(fs.readFileSync(gddPath, 'utf8'));
  } catch (e) {
    console.error('ERROR could not read banned terms from ' + gddPath + ': ' + e.message);
    return 2;
  }

  const opts = mediaOptions();
  opts.balance = !skipBalance;
  const result = validateDataset(data, schemas, banned, extra, opts);
  const errors = parseErrors.concat(result.errors);

  console.log('Banned terms from GDD §3: ' + banned.errorTerms.length + ' error terms, ' +
    banned.warningTerms.length + ' warning terms (' + banned.warningTerms.join(', ') + '), name-only terms (' +
    banned.nameOnlyTerms.join(', ') + ')');
  console.log('Data directory: ' + dataDir);
  if (skipBalance) console.log('§15.3 rules 10–12 skipped (' + (isFxGdd ? 'FX-GDD, GDD §15.4' : '--skip-balance') + ')');
  for (const n of result.notices) console.log('NOTICE ' + n);
  for (const w of result.warnings) console.log('WARN  [' + w.rule + '] ' + w.file + ' ' + w.path + ': ' + w.message);
  for (const e of errors) console.log('ERROR [' + e.rule + '] ' + e.file + ' ' + e.path + ': ' + e.message);
  console.log('');
  if (errors.length > 0) {
    console.log('validate-data: FAIL — ' + errors.length + ' error(s), ' + result.warnings.length + ' warning(s)');
    return 1;
  }
  const checked = DATA_FILES.filter((d) => data[d.file] !== undefined).length;
  console.log('validate-data: PASS — ' + checked + ' files, 0 errors, ' + result.warnings.length + ' warning(s)');
  return 0;
}

process.exitCode = main();
