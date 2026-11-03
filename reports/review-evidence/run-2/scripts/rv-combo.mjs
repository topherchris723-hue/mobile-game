// Reviewer probe: is a combo counter drawn under the tutorial prompt box in the stage_001 tutorial battle?
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.argv[2];
const sizes = [[360, 640, 2], [390, 844, 3]];
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const res = [];
for (const [w, h, dpr] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:4302/?test&renderer=canvas');
  const key = () => p.evaluate(() => { const s = window.__TEST__.activeScene(); return s && s.scene.key; });
  const tap = async (id) => { for (let k = 0; k < 40; k++) { const ts = await p.evaluate(() => window.__TEST__.targets()); const t = ts.find((x) => x.id === id); if (t) { await p.touchscreen.tap(t.x + t.w / 2, t.y + t.h / 2); await p.waitForTimeout(500); return; } await p.waitForTimeout(150); } throw new Error('no ' + id + ' at ' + await key()); };
  await p.waitForTimeout(1500);
  await tap('start'); await tap('home_story'); await tap('stage_stage_001'); await tap('dialogue_skip'); await tap('team_fight');
  await p.waitForTimeout(2500);
  let samples = 0, overlapSamples = 0, shots = 0; const byName = {}; const steps = new Set(); const hits = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const r = await p.evaluate(() => {
      const s = window.__TEST__.game.scene.getScene('Battle');
      if (!s || !s.scene.isActive()) return { done: true };
      const step = window.__TEST__.tutorialStep();
      const inter = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
      const out = { step: step && step.id, cover: [] };
      const tl = s.tutLayer;
      if (tl && tl.visible && tl.alpha > 0.5 && s.tutRect) {
        for (const [name, tx] of [['player', s.comboText], ['hits', s.comboHits], ['enemy', s.enemyCombo]]) {
          if (tx.alpha > 0.3 && tx.text) { const bb = tx.getBounds(); const r = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
            if (inter(r, s.tutRect)) out.cover.push({ name, text: tx.text, alpha: +tx.alpha.toFixed(2), text_rect: [r.x, r.y, r.w, r.h].map(Math.round), box: [s.tutRect.x, s.tutRect.y, s.tutRect.w, s.tutRect.h].map(Math.round) }); }
        }
      }
      return out;
    });
    if (r.done) break;
    samples++; if (r.step) steps.add(r.step);
    for (const c of r.cover) { const k = c.name + ' ' + c.text.replace(/\d+/, 'N'); const ov = Math.max(0, Math.min(c.text_rect[1] + c.text_rect[3], c.box[1] + c.box[3]) - Math.max(c.text_rect[1], c.box[1])) / c.text_rect[3]; const e = (byName[k] ||= { n: 0, maxHiddenFrac: 0 }); e.n++; e.maxHiddenFrac = Math.max(e.maxHiddenFrac, +ov.toFixed(2)); if (c.name === 'player' && shots < 6) { await p.screenshot({ path: `${OUT}/${w}x${h}-player-${shots++}.png` }); } }
    if (r.cover.length) { overlapSamples++; if (hits.length < 6) hits.push({ step: r.step, ...r.cover[0] });  }
    // play: tap the first affordable card
    const ts = await p.evaluate(() => window.__TEST__.targets());
    const c = ts.filter((x) => x.id.startsWith('card_') && x.enabled);
    if (c.length && Math.random() < 0.6) { const t = c[Math.floor(Math.random() * c.length)]; await p.touchscreen.tap(t.x + t.w / 2, t.y + t.h / 2); }
    await p.waitForTimeout(80);
  }
  res.push({ size: `${w}x${h}`, samples, overlapSamples, byName, steps: [...steps], examples: hits });
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/combo-cover.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
