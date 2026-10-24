// Reviewer: release build (no test hooks), 360x640. Logical units == CSS px at this size.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.argv[2];
const URL = 'http://127.0.0.1:4301/';
fs.mkdirSync(OUT, { recursive: true });
const log = { console: [], loads: [], fps: [], steps: [] };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => log.console.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => log.console.push({ type: 'pageerror', text: String(e) }));
const tap = async (x, y, w = 400) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(w); };
const shot = async (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('game_save') || 'null'));
async function swipe(x0, y0, x1, y1) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 4; i++) { await page.waitForTimeout(16); await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 4, y: y0 + (y1 - y0) * i / 4 }] }); }
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}
async function fps(ms) {
  return page.evaluate((ms) => new Promise((res) => { let n = 0, worst = 0, last = performance.now(); const t0 = last;
    function f(t) { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else res({ fps: +(n * 1000 / (t - t0)).toFixed(1), worstFrameMs: +worst.toFixed(1) }); }
    requestAnimationFrame(f); }), ms);
}

// first load timing (cold)
let t0 = Date.now();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('canvas') !== null);
await page.waitForTimeout(100);
log.loads.push({ kind: 'cold-load-to-canvas-ms', ms: Date.now() - t0 });
log.nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
log.hasTestHook = await page.evaluate(() => typeof window.__TEST__ !== 'undefined');
await page.waitForTimeout(800); await shot('r01-title');
log.saveAtTitle = await save();
await tap(180, 640 - 120 + 28, 900); // start
await shot('r02-home');
// Home buttons: y0 = 640-72*3-16 = 408 → Story center 436
await tap(180, 436, 900); await shot('r03-story');
// stage 1 card around y ~ 195 (from screenshot 1280px → 390/2)
await tap(180, 190, 1000); await shot('r04-dialogue');
await tap(90, 640 - 44, 1000); // Skip
await shot('r05-team');
await tap(180, 640 - 44, 2500); // FIGHT
await shot('r06-battle');
log.fps.push({ phase: 'battle-start', ...(await fps(3000)) });
// fight: tap cards (cards y=412+4..+112 → center 472; x centers 48,136,224,312), swipe up sometimes, tap IGNITE (252,362) and TRI-BURST (320,362)
const start = Date.now(); let i = 0; let shotsTaken = 0;
while (Date.now() - start < 240000) {
  i++;
  const xs = [48, 136, 224, 312];
  await page.touchscreen.tap(xs[i % 4], 472);
  await page.waitForTimeout(150);
  if (i % 7 === 0) await swipe(180, 600, 180, 540);
  if (i % 5 === 0) { await page.touchscreen.tap(252, 362); await page.touchscreen.tap(320, 362); }
  if (i % 60 === 0 && shotsTaken < 6) { await shot('r07-battle-' + (shotsTaken++)); log.fps.push({ phase: 'battle-mid-' + i, ...(await fps(1500)) }); }
  const s = await save();
  if (s && s.stages && s.stages.stage_001 && s.stages.stage_001.cleared) { log.steps.push('stage_001 cleared after ' + Math.round((Date.now() - start) / 1000) + 's real'); break; }
}
await page.waitForTimeout(2500); await shot('r08-result');
const afterWin = await save();
log.saveAfterWin = { jade: afterWin && afterWin.currencies, stages: afterWin && afterWin.stages, tutorial: afterWin && afterWin.tutorial };
// "quit" and reload
await page.close();
const page2 = await ctx.newPage();
page2.on('console', (m) => log.console.push({ type: m.type(), text: m.text(), page: 2 }));
page2.on('pageerror', (e) => log.console.push({ type: 'pageerror', text: String(e), page: 2 }));
t0 = Date.now();
await page2.goto(URL, { waitUntil: 'load' });
await page2.waitForFunction(() => document.querySelector('canvas') !== null);
log.loads.push({ kind: 'warm-reload-ms', ms: Date.now() - t0 });
await page2.waitForTimeout(1000);
const reloaded = await page2.evaluate(() => JSON.parse(localStorage.getItem('game_save') || 'null'));
log.saveAfterReload = { jade: reloaded && reloaded.currencies, stages: reloaded && reloaded.stages };
log.saveIntact = JSON.stringify(reloaded && reloaded.stages) === JSON.stringify(afterWin && afterWin.stages) && JSON.stringify(reloaded.currencies) === JSON.stringify(afterWin.currencies);
await page2.touchscreen.tap(180, 548); await page2.waitForTimeout(900);
await page2.touchscreen.tap(180, 436); await page2.waitForTimeout(900);
await page2.screenshot({ path: `${OUT}/r09-story-after-reload.png` });
await browser.close();
fs.writeFileSync(`${OUT}/release-run.json`, JSON.stringify(log, null, 1));
console.log(JSON.stringify(log, null, 1));
