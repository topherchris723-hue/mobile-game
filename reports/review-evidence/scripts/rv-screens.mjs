// Reviewer: visit every screen at several sizes on the test-hook build; screenshot; check targets; log console errors.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const OUT = process.argv[2];
const BASE = process.argv[3] || 'http://127.0.0.1:4302/?test&renderer=canvas';
fs.mkdirSync(OUT, { recursive: true });
const sizes = [
  { name: '360x640', w: 360, h: 640, dpr: 2 },
  { name: '390x844', w: 390, h: 844, dpr: 3 },
  { name: '430x932', w: 430, h: 932, dpr: 3 },
  { name: 'tablet-768x1024', w: 768, h: 1024, dpr: 2 },
];
const report = { errors: [], targetIssues: [], scenes: {} };
const browser = await chromium.launch();

async function scene(page) { return page.evaluate(() => { const s = window.__TEST__.activeScene(); return s ? s.scene.key : null; }); }
async function targets(page) { return page.evaluate(() => window.__TEST__.targets()); }
async function waitScene(page, key, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await scene(page)) === key) { await page.waitForTimeout(500); return true; } await page.waitForTimeout(100); }
  throw new Error('scene ' + key + ' not reached; at ' + (await scene(page)));
}
async function tap(page, id, wait = 350) {
  const ts = await targets(page);
  const tg = ts.find((x) => x.id === id);
  if (!tg) throw new Error('no target ' + id + ' in ' + (await scene(page)) + ': ' + ts.map((x) => x.id).join(','));
  await page.touchscreen.tap(tg.x + tg.w / 2, tg.y + tg.h / 2);
  await page.waitForTimeout(wait);
}
async function shot(page, sz, label) {
  const key = await scene(page);
  await page.screenshot({ path: `${OUT}/${sz.name}-${label}.png` });
  const ts = await targets(page);
  const vw = sz.w, vh = sz.h;
  for (const t of ts) {
    if (t.w < 43.5 || t.h < 43.5) report.targetIssues.push({ size: sz.name, label, id: t.id, w: +t.w.toFixed(1), h: +t.h.toFixed(1), problem: 'small' });
    if (t.x < -0.5 || t.y < -0.5 || t.x + t.w > vw + 0.5 || t.y + t.h > vh + 0.5) report.targetIssues.push({ size: sz.name, label, id: t.id, rect: [t.x, t.y, t.w, t.h].map((v) => +v.toFixed(0)), problem: 'offscreen' });
  }
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const a = ts[i], b = ts[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 1 && oy > 1) report.targetIssues.push({ size: sz.name, label, ids: [a.id, b.id], problem: 'overlap', ox: +ox.toFixed(0), oy: +oy.toFixed(0) });
  }
  (report.scenes[sz.name] = report.scenes[sz.name] || []).push({ label, key, ids: ts.map((t) => t.id + (t.enabled ? '' : '(off)')) });
}

for (const sz of sizes) {
  const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: sz.dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') report.errors.push({ size: sz.name, type: m.type(), text: m.text() }); });
  page.on('pageerror', (e) => report.errors.push({ size: sz.name, type: 'pageerror', text: String(e) }));
  try {
    await page.goto(BASE);
    await waitScene(page, 'Title');
    await shot(page, sz, '01-title');
    await tap(page, 'start'); await waitScene(page, 'Home'); await shot(page, sz, '02-home');
    await tap(page, 'home_story'); await waitScene(page, 'Story'); await shot(page, sz, '03-story');
    await tap(page, 'stage_stage_001'); await page.waitForTimeout(800);
    const k = await scene(page);
    await shot(page, sz, '04-after-stage-tap-' + k);
    if (k === 'Dialogue') { await tap(page, 'dialogue_next', 600); await shot(page, sz, '04b-dialogue-next'); await tap(page, 'dialogue_skip'); await page.waitForTimeout(800); }
    await waitScene(page, 'Team'); await shot(page, sz, '05-team-select');
    await tap(page, 'team_fight'); await waitScene(page, 'Battle'); await page.waitForTimeout(2500); await shot(page, sz, '06-battle');
    // play a little: tap cards
    for (let i = 0; i < 8; i++) { const ts = await targets(page); const c = ts.find((x) => x.id.startsWith('card') || x.id.startsWith('hand')); if (c) await page.touchscreen.tap(c.x + c.w / 2, c.y + c.h / 2); await page.waitForTimeout(700); }
    await shot(page, sz, '07-battle-play');
    await tap(page, 'battle_pause', 600); await shot(page, sz, '08-pause');
    await tap(page, 'menu_settings', 800); await shot(page, sz, '09-battle-settings-' + (await scene(page)));
    await tap(page, 'back', 800); await shot(page, sz, '10-back-to-pause-' + (await scene(page)));
    await tap(page, 'menu_retreat', 700); await shot(page, sz, '11-retreat-confirm');
    await tap(page, 'menu_retreat_yes', 1200); await waitScene(page, 'Result'); await shot(page, sz, '12-result');
    await tap(page, 'result_to_story'); await waitScene(page, 'Story');
    await tap(page, 'back'); await waitScene(page, 'Home');
    await tap(page, 'home_summon'); await waitScene(page, 'Summon'); await shot(page, sz, '13-summon');
    await tap(page, 'summon_rates', 800); await shot(page, sz, '14-summon-rates');
    await tap(page, 'summon_rates_close', 600);
    const sts = await targets(page);
    report.scenes[sz.name].push({ summonIds: sts.map((t) => t.id) });
    const multi = sts.filter((t) => t.id !== 'back' && t.id !== 'summon_rates' && t.id !== 'home_settings' && t.enabled);
    if (multi.length) {
      const b = multi[multi.length - 1];
      await page.touchscreen.tap(b.x + b.w / 2, b.y + b.h / 2); await page.waitForTimeout(900); await shot(page, sz, '15-summon-confirm');
      await tap(page, 'summon_confirm', 1500); await shot(page, sz, '16-summon-reveal');
      try { await tap(page, 'summon_skip', 1500); } catch (e) { /* maybe absent */ }
      await page.waitForTimeout(1500); await shot(page, sz, '17-summon-results');
      await tap(page, 'summon_ok', 1000); await waitScene(page, 'Summon');
    }
    await tap(page, 'back'); await waitScene(page, 'Home');
    await tap(page, 'home_team'); await waitScene(page, 'Team'); await shot(page, sz, '18-team');
    await tap(page, 'back'); await waitScene(page, 'Home');
    await tap(page, 'home_settings'); await waitScene(page, 'Settings'); await shot(page, sz, '19-settings');
    await tap(page, 'settings_licenses'); await waitScene(page, 'Licenses'); await shot(page, sz, '20-licenses');
    await tap(page, 'back'); await waitScene(page, 'Settings'); await tap(page, 'back'); await waitScene(page, 'Home');
    report.scenes[sz.name].push({ done: true });
  } catch (e) {
    report.errors.push({ size: sz.name, type: 'script', text: String(e && e.message) });
    await page.screenshot({ path: `${OUT}/${sz.name}-ZZ-failure.png` });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors, targetIssues: report.targetIssues.length }, null, 1));
