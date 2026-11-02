// Node-only helper for `npm run validate-data` (GDD §15.3 rule 15): find a literal exported string list
// (`export const NAME = [...]`) in the JS sources under given directories, without importing them (no DOM/Phaser).
import fs from 'node:fs';
import path from 'node:path';
import { parseExportedStringList } from './data-validator.js';

/** Every *.js file under dir (recursive, sorted, node_modules skipped). Missing dir → []. */
export function jsFilesUnder(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      if (name === 'node_modules') continue;
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.js')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** The first literal `export const name = [...]` found in the *.js files under `dirs` (in order), or null. */
export function findExportedList(dirs, name) {
  for (const dir of dirs) {
    for (const f of jsFilesUnder(dir)) {
      const list = parseExportedStringList(fs.readFileSync(f, 'utf8'), name);
      if (list) return { list: list, file: f };
    }
  }
  return null;
}
