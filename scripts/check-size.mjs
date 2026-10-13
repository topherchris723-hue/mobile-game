// Fails the build if the gzipped download exceeds the budget in CLAUDE.md §7.
// Source maps are excluded: browsers only fetch them when devtools are open.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET_BYTES = 5 * 1024 * 1024;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const files = [...walk(DIST)]
  .filter((path) => !path.endsWith('.map'))
  .map((path) => ({ path: relative(DIST, path), gzip: gzipSync(readFileSync(path)).length }))
  .sort((a, b) => b.gzip - a.gzip);

const total = files.reduce((sum, f) => sum + f.gzip, 0);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
for (const f of files.slice(0, 8)) console.log(`${kb(f.gzip).padStart(10)}  ${f.path}`);
console.log(`Total (gzipped, ${files.length} files): ${kb(total)} of ${kb(BUDGET_BYTES)} budget`);
if (total > BUDGET_BYTES) {
  console.error('Download size budget exceeded.');
  process.exit(1);
}
