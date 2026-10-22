// Test helper: loads the real data files, schemas and GDD from disk (Node only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FILES } from '../../scripts/lib/data-validator.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Read and parse a JSON file relative to the repo root. */
export function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

/** All data files keyed by file name, e.g. { 'cards.json': {...} }. Fresh copy every call. */
export function loadAllData() {
  const out = {};
  for (const d of DATA_FILES) out[d.file] = readJson('data/' + d.file);
  return out;
}

/** All schemas keyed by schema file name. */
export function loadAllSchemas() {
  const out = {};
  for (const d of DATA_FILES) out[d.schema] = readJson('data/schemas/' + d.schema);
  return out;
}

/** The GDD markdown text. */
export function loadGdd() {
  return fs.readFileSync(path.join(ROOT, 'docs', 'GDD.md'), 'utf8');
}

/** The content bundle the battle engine expects (see src/logic/README.md). */
export function loadBundle() {
  const d = loadAllData();
  return {
    battle: d['battle.json'],
    characters: d['characters.json'],
    cards: d['cards.json'],
    enemies: d['enemies.json'],
    stages: d['stages.json'],
    banners: d['banners.json'],
  };
}
