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

/** GDD §15.4 FX-GDD: the frozen data copy that W-class (worked example) tests run on. Never `data/`. */
export const FX_GDD_DIR = 'tests/fixtures/gdd';

/**
 * All data files keyed by file name, e.g. { 'cards.json': {...} }. Fresh copy every call.
 * dir: repo-relative data directory, default the live `data` (P-class tests); pass FX_GDD_DIR for W-class.
 */
export function loadAllData(dir) {
  const base = dir || 'data';
  const out = {};
  for (const d of DATA_FILES) {
    // Round-4 optional files (vfx.json, audio.json) are skipped while they do not exist (FX-GDD never has them).
    if (d.optional && !fs.existsSync(path.join(ROOT, base, d.file))) continue;
    out[d.file] = readJson(base + '/' + d.file);
  }
  return out;
}

/** Read one FX-GDD fixture file, e.g. readGddJson('economy.json'). */
export function readGddJson(file) {
  return readJson(FX_GDD_DIR + '/' + file);
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

/** The content bundle the battle engine expects (see src/logic/README.md). dir as in loadAllData. */
export function loadBundle(dir) {
  const d = loadAllData(dir);
  return {
    battle: d['battle.json'],
    characters: d['characters.json'],
    cards: d['cards.json'],
    enemies: d['enemies.json'],
    stages: d['stages.json'],
    banners: d['banners.json'],
  };
}

/** The FX-GDD content bundle (GDD §15.4), economy included. For W-class tests only. */
export function loadGddBundle() {
  const b = loadBundle(FX_GDD_DIR);
  b.economy = readGddJson('economy.json');
  return b;
}

/**
 * The §15.3 rule 13–15 inputs for the live repo (what `npm run validate-data` passes): assets/CREDITS.md text, files on
 * disk (repo-relative), the assets/vfx/ listing. sfxHooks / vfxEventKeys are left null (the CLI reads them from src/ui).
 */
export function liveMediaOptions() {
  const credits = path.join(ROOT, 'assets', 'CREDITS.md');
  const vfxDir = path.join(ROOT, 'assets', 'vfx');
  return {
    credits: fs.existsSync(credits) ? fs.readFileSync(credits, 'utf8') : '',
    fileExists: (p) => fs.existsSync(path.join(ROOT, p)),
    listVfxFiles: () => (fs.existsSync(vfxDir) ? fs.readdirSync(vfxDir).map((f) => 'assets/vfx/' + f) : []),
    sfxHooks: null,
    vfxEventKeys: null,
  };
}
