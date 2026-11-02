// Reviewer perf probe on the release build: frame deltas during stage 1 battle with card spam.
import { chromium } from '@playwright/test';
const res = [];
const browser = await chromium.launch();
for (const [renderer, throttle] of [['canvas', 1], ['canvas', 4], ['default', 1]]) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4301/' + (renderer === 'canvas' ? '?renderer=canvas' : ''));
  await page.waitForTimeout(1200);
  const measure = (ms) => page.evaluate((ms) => new Promise((r) => { const d = []; let last = performance.now(); const t0 = last;
    function f(t) { d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, median: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: +d[d.length - 1].toFixed(1) }); } }
    requestAnimationFrame(f); }), ms);
  const title = await measure(2000);
  await page.touchscreen.tap(180, 548); await page.waitForTimeout(900);
  await page.touchscreen.tap(180, 436); await page.waitForTimeout(900);
  await page.touchscreen.tap(180, 190); await page.waitForTimeout(1000);
  await page.touchscreen.tap(90, 596); await page.waitForTimeout(1000);
  await page.touchscreen.tap(180, 596); await page.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  let stop = false;
  const spam = (async () => { let i = 0; while (!stop) { await page.touchscreen.tap([48, 136, 224, 312][i++ % 4], 472).catch(() => {}); await page.waitForTimeout(120); } })();
  const battle = await measure(12000);
  stop = true; await spam;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  res.push({ renderer, throttle, title, battle });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(res, null, 1));
