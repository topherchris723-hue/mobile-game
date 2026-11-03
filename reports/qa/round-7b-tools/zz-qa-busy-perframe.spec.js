// QA round 7c (tool, kept in reports/qa/round-7b-tools/): BUG-7b-01 re-check. Same scenario as qa-busy.spec.js
// (stage_005, seed 777, Solenne/Corvane/Dunmore vs Umbral Solenne, in-page bot) but the arena text scan runs
// in-page on EVERY rendered frame (game 'postrender'), not every 120 ms. Also logs every combo pop's start scale
// (popPeak) so the approved 1.5x/1.4x feel can be judged.
// Negatives: QA_BREAK=clamp -> sc.disablePopClamp (round-7 pop), QA_BREAK=placer -> placer returns wanted spot.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { SIZES, boot, newPhone, waitScene, tap, clearedSave, watchErrors } from './qa-helpers.js';

const OUT = process.env.QA7C_OUT || 'qa7c-out';
const SECS = +(process.env.QA7C_SECS || 25);

test('QA 7c per-frame busy scan (BUG-7b-01)', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'opens its own contexts for every size');
  test.setTimeout(900000);
  const lines = [];
  let totalOverlaps = 0;
  let comboOverlaps = 0;
  const errs = [];
  for (const size of SIZES) {
    const { ctx, page } = await newPhone(browser, size);
    const errors = watchErrors(page);
    const sv = clearedSave(4);
    for (const id of ['char_solenne_001', 'char_corvane_001']) sv.roster.push({ character_id: id, resonance: 0, obtained_at: sv.created_at });
    sv.team = ['char_solenne_001', 'char_corvane_001', 'char_dunmore_001'];
    await boot(page, sv, '&renderer=canvas&seed=777');
    await tap(page, 'start');
    await waitScene(page, 'Home');
    await tap(page, 'home_story');
    await waitScene(page, 'Story');
    await tap(page, 'stage_stage_005');
    await waitScene(page, 'Dialogue');
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
    await tap(page, 'team_fight');
    await waitScene(page, 'Battle');
    await page.evaluate((brk) => {
      const T = window.__TEST__;
      const sc = T.activeScene();
      if (brk === 'placer') sc.floats.place = (o) => ({ x: o.x, y: o.y });
      if (brk === 'clamp') sc.disablePopClamp = true;
      // log every pop
      T.qaPops = [];
      const orig = sc.popCombo.bind(sc);
      sc.popCombo = (tx, max) => { orig(tx, max); T.qaPops.push({ who: tx === sc.enemyCombo ? 'enemy' : 'player', max, peak: +tx.popPeak.toFixed(3), tick: sc.battle.getState().tick }); };
      T.qaShouts = { asked: 0, shown: 0, dropped: {} };
      const origShout = sc.shout.bind(sc);
      sc.shout = (side, str) => { if (!str) return; origShout(side, str); T.qaShouts.asked++; if (sc.shoutTxt[side]) T.qaShouts.shown++; else T.qaShouts.dropped[str] = (T.qaShouts.dropped[str] || 0) + 1; };
      const canvas = T.game.canvas;
      const r = canvas.getBoundingClientRect();
      const k = r.width / sc.W;
      const touch = (x, y, dy) => {
        const mk = (cx, cy) => new Touch({ identifier: 5, target: canvas, clientX: cx, clientY: cy, pageX: cx, pageY: cy });
        const fire = (type, t, list) => canvas.dispatchEvent(new TouchEvent(type, { touches: list, targetTouches: list, changedTouches: [t], bubbles: true, cancelable: true }));
        const a = mk(x, y);
        fire('touchstart', a, [a]);
        const b = mk(x, y + dy);
        if (dy) fire('touchmove', b, [b]);
        fire('touchend', b, []);
      };
      let n = 0;
      const loop = () => {
        if (T.sceneKey !== 'Battle' || T.stopBusy) return;
        const b = sc.battle;
        for (const side of ['player', 'enemy']) for (const f of b.teams[side].fighters) if (!f.ko && f.hp < f.def.maxHp * 0.5) f.hp = f.def.maxHp;
        if (b.teams.player.vigor < 6000 * 4) b.teams.player.vigor = 6000 * 8;
        n++;
        if (n % 4 === 0) {
          const st = b.getState();
          const f = st.teams.player.fighters[st.teams.player.activeSlot];
          const i = f.hand.findIndex((c) => c && c.playable);
          if (i >= 0) { const cr = sc.L.cardRect(i); touch(r.left + (cr.x + cr.w / 2) * k, r.top + (cr.y + cr.h / 2) * k, 0); }
        }
        if (n % 45 === 0) { const p = sc.L.swipePad; touch(r.left + (sc.W / 2) * k, r.top + ((p.top + p.bottom) / 2) * k, -40 * k); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      // per-frame scanner (same rules as qa-busy.spec.js scanArena)
      T.qaScan = { on: false, frames: 0, cineFrames: 0, maxN: 0, overlaps: {}, comboHitsPop: 0, first: [] };
      T.game.events.on('postrender', () => {
        const Q = T.qaScan;
        if (!Q.on || T.sceneKey !== 'Battle') return;
        const s = sc;
        const st = s.battle.getState();
        if (st.result) return;
        if (s.cinematic && s.cinematic.visible && s.cinematic.alpha > 0.05) { Q.cineFrames++; return; }
        Q.frames++;
        const texts = [];
        const walk = (list, alpha, vis) => {
          for (const o of list) {
            const a = alpha * (o.alpha === undefined ? 1 : o.alpha);
            const v = vis && o.visible !== false;
            if (!v || a < 0.35) continue;
            if (o.type === 'Text' && o.text && o.text.trim()) {
              const b = o.getBounds();
              if (b.y + b.height > s.L.arena.top && b.y < s.L.arena.bottom - 46 + 8) texts.push({ t: o.text.replace(/\n/g, ' ').slice(0, 40), x: b.x, y: b.y, w: b.width, h: b.height, sc: o.scaleX, d: (o.parentContainer ? o.parentContainer.depth : 0) + o.depth });
            }
            if (o.list) walk(o.list, a, v);
          }
        };
        walk(s.children.list, 1, true);
        Q.maxN = Math.max(Q.maxN, texts.length);
        const pad = 2;
        for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
          const A = texts[i];
          const B = texts[j];
          if (A.d >= 70 || B.d >= 70) continue;
          const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) - pad * 2;
          const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) - pad * 2;
          if (!(ox > 0 && oy > 0)) continue;
          const isCH = /^COMBO x/.test(A.t + B.t) && / HITS/.test(A.t + B.t) && /^COMBO x/.test(A.t) !== /^COMBO x/.test(B.t);
          if (isCH) { Q.comboHitsPop++; continue; }
          const key = `"${A.t}"(s${A.sc.toFixed(2)}) x "${B.t}"(s${B.sc.toFixed(2)})`;
          Q.overlaps[key] = (Q.overlaps[key] || 0) + 1;
          if (Q.first.length < 12) Q.first.push(`frame ${Q.frames} tick ${st.tick}: ${key} ${ox.toFixed(1)}x${oy.toFixed(1)}`);
        }
        for (const A of texts) if (A.d < 70 && (A.x < -3 || A.x + A.w > s.W + 3)) { const key = `off-screen "${A.t}"`; Q.overlaps[key] = (Q.overlaps[key] || 0) + 1; }
      });
    }, process.env.QA_BREAK || '');
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    await page.evaluate(() => { window.__TEST__.game.scene.getScene('Battle').battle.teams.enemy.fighters[0].hp = 0; });
    await page.waitForFunction(() => { const s = window.__TEST__.battleState(); return s.teams.enemy.activeSlot === 1 && !s.freeze; }, null, { timeout: 10000 });
    await page.evaluate(() => { window.__TEST__.qaScan.on = true; window.__TEST__.qaPops.length = 0; });
    await page.waitForTimeout(SECS * 1000);
    const res = await page.evaluate(() => { const T = window.__TEST__; T.qaScan.on = false; T.stopBusy = true; return { Q: T.qaScan, pops: T.qaPops, sh: T.qaShouts }; });
    const Q = res.Q;
    const keys = Object.keys(Q.overlaps);
    const nOv = keys.reduce((m, k) => m + Q.overlaps[k], 0);
    const nCombo = keys.filter((k) => /COMBO x/.test(k)).reduce((m, k) => m + Q.overlaps[k], 0);
    totalOverlaps += nOv;
    comboOverlaps += nCombo;
    const pp = (who) => {
      const a = res.pops.filter((p) => p.who === who);
      const full = a.filter((p) => p.peak >= p.max - 1e-6).length;
      const peaks = a.map((p) => p.peak).sort((x, y) => x - y);
      const mean = peaks.length ? peaks.reduce((m, x) => m + x, 0) / peaks.length : 0;
      return `${who} pops=${a.length} full=${full} clamped=${a.length - full} min=${peaks[0] ?? '-'} median=${peaks[Math.floor(peaks.length / 2)] ?? '-'} mean=${mean.toFixed(3)}`;
    };
    lines.push(`${size.name}: frames=${Q.frames} (cine skipped ${Q.cineFrames}) maxTexts=${Q.maxN} overlapFrames=${nOv} comboOverlapFrames=${nCombo} distinct=${keys.length} comboVsHitsPopFrames=${Q.comboHitsPop}`);
    lines.push(`${size.name}: shouts asked=${res.sh.asked} shown=${res.sh.shown} dropped=${JSON.stringify(res.sh.dropped)}`);
    lines.push(`${size.name}: ${pp('player')} | ${pp('enemy')}`);
    for (const k of keys) lines.push(`${size.name}:   ${Q.overlaps[k]}x ${k}`);
    for (const f of Q.first) lines.push(`${size.name}:   first: ${f}`);
    lines.push(`${size.name}: pops ${JSON.stringify(res.pops.filter((p) => p.peak < p.max - 1e-6).slice(0, 8))}`);
    errs.push(...errors.map((e) => size.name + ' ' + e));
    await ctx.close();
  }
  lines.push(`TOTAL overlapFrames=${totalOverlaps} comboOverlapFrames=${comboOverlaps} consoleErrors=${errs.length} break=${process.env.QA_BREAK || 'none'}`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.appendFileSync(`${OUT}/perframe.txt`, lines.join('\n') + '\n---\n');
  console.log(lines.join('\n'));
  expect(errs).toEqual([]);
  expect(totalOverlaps, lines.join('\n')).toBe(0);
});
