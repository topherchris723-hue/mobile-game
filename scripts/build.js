#!/usr/bin/env node
// `npm run build`: production build with Vite into dist/.
// Until the ui-developer adds index.html there is nothing to bundle, so this prints a notice and
// exits 0 instead of failing. As soon as index.html exists it runs a normal `vite build`
// (and any Vite error fails the build).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.log('build: index.html not found (added by ui-developer) — skipping vite build. Nothing to bundle yet.');
  process.exit(0);
}
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const r = spawnSync(process.execPath, [viteBin, 'build'], { cwd: root, stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
