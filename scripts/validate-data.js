#!/usr/bin/env node
// `npm run validate-data` — validates data/*.json against data/schemas (Ajv, JSON Schema 2020-12),
// the GDD §15.3 cross-file rules 1–8 and the GDD §3 banned-term list (read from docs/GDD.md).
// Usage: node scripts/validate-data.js [--data-dir <dir>] [--gdd <path>]
// Exit code 0 = no errors (warnings allowed), 1 = errors found, 2 = could not run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FILES, parseBannedTerms, validateDataset } from './lib/data-validator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : fallback;
}

const dataDir = argValue('--data-dir', path.join(root, 'data'));
const schemaDir = argValue('--schema-dir', path.join(root, 'data', 'schemas'));
const gddPath = argValue('--gdd', path.join(root, 'docs', 'GDD.md'));

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

  const result = validateDataset(data, schemas, banned, extra);
  const errors = parseErrors.concat(result.errors);

  console.log('Banned terms from GDD §3: ' + banned.errorTerms.length + ' error terms, ' +
    banned.warningTerms.length + ' warning terms (' + banned.warningTerms.join(', ') + ')');
  for (const w of result.warnings) console.log('WARN  [' + w.rule + '] ' + w.file + ' ' + w.path + ': ' + w.message);
  for (const e of errors) console.log('ERROR [' + e.rule + '] ' + e.file + ' ' + e.path + ': ' + e.message);
  console.log('');
  if (errors.length > 0) {
    console.log('validate-data: FAIL — ' + errors.length + ' error(s), ' + result.warnings.length + ' warning(s)');
    return 1;
  }
  console.log('validate-data: PASS — ' + DATA_FILES.length + ' files, 0 errors, ' + result.warnings.length + ' warning(s)');
  return 0;
}

process.exitCode = main();
