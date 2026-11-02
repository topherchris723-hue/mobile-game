import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
await p.goto('http://127.0.0.1:4302/?test&renderer=canvas'); await p.waitForTimeout(1500);
const T = () => p.evaluate(() => window.__TEST__.targets().map((t) => t.logical && { id: t.id, ...t.logical }));
const tap = async (id) => { const ts = await p.evaluate(() => window.__TEST__.targets()); const t = ts.find((x) => x.id === id); await p.touchscreen.tap(t.x + t.w / 2, t.y + t.h / 2); await p.waitForTimeout(900); };
const out = [];
async function gaps(label) { const ts = await T(); let min = 1e9, pair = null;
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { const a = ts[i], c = ts[j];
    const gx = Math.max(a.x - (c.x + c.w), c.x - (a.x + a.w)); const gy = Math.max(a.y - (c.y + c.h), c.y - (a.y + a.h));
    const g = Math.max(gx, gy); if (g < min) { min = g; pair = [a.id, c.id]; } }
  out.push({ label, minGap: +min.toFixed(1), pair }); }
await gaps('title'); await tap('start'); await gaps('home'); await tap('home_story'); await gaps('story');
await tap('back'); await tap('home_team'); await gaps('team'); await tap('back'); await tap('home_summon'); await gaps('summon');
await tap('back'); await tap('home_settings'); await gaps('settings'); await tap('back');
await tap('home_story'); await tap('stage_stage_001'); await gaps('dialogue'); await tap('dialogue_skip'); await gaps('team-select'); await tap('team_fight'); await p.waitForTimeout(2500); await gaps('battle');
console.log(JSON.stringify(out)); await b.close();
