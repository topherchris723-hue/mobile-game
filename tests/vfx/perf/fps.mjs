// Playwright FPS run for the VFX harness: node tests/vfx/perf/fps.mjs [seconds]
// Starts `vite` on port 5199, opens the harness at 360×640, runs unthrottled and with 4× CPU throttling.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const secs = Number(process.argv[2] || 30);
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', '5199', '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'pipe' });
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('5199')) res(); }));
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const runs = [
  ['unthrottled', '', 1], ['cpu4x', '', 4], ['cpu4x reduce-motion', '&rm=1', 4], ['cpu4x quality=low', '&q=low', 4],
  ['cpu4x STRESS must-FAIL (5,000 budget)', '&stress=1', 4],
];
for (const [name, q, rate] of runs) {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto('http://127.0.0.1:5199/tests/vfx/perf/harness.html?speed=3' + q);
  await page.waitForFunction(() => window.__perf && window.__perf.frames.length > 30, null, { timeout: 60000 });
  await page.waitForTimeout(secs * 1000);
  const p = await page.evaluate(() => window.__perf);
  const fr = p.frames.slice(30);
  const fps = fr.map((f) => 1000 / f);
  console.log(`${name.padEnd(38)} frames ${String(fr.length).padStart(5)}  median ${pct(fr, 0.5).toFixed(1)} ms  p95 ${pct(fr, 0.95).toFixed(1)} ms  ` +
    `fps min ${Math.min(...fps).toFixed(0)} / avg ${(1000 / (fr.reduce((s, x) => s + x, 0) / fr.length)).toFixed(1)}  particlesMax ${p.particlesMax} (cap ${p.cap}, ${p.quality})  ` +
    `flashes ${p.flashes} shakes ${p.shakes}  ign ${p.events.ignition || 0} tri ${p.events.tri_burst || 0} climax ${p.events.climax_cinematic || 0} hits ${p.events.hit || 0}`);
  await page.close();
}
await browser.close();
server.kill();
