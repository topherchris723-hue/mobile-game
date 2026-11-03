// QA round 7c (tool): BUG-7b-01 forced re-check at the QA scenario (stage_005, seed 777, longest names, in-page bot),
// scanned on EVERY rendered frame. The natural busy fight only reaches the bug in ~2/7 runs, so this spec forces the
// bug's order through the real code paths, repeatedly, during the live fight:
//   order A (the reported one): a shout-style float is placed legally right next to a 1x combo zone, then the counter
//            pops on the next frame (sc.popCombo, the real method);
//   order B (race): the counter pops first, then the shout is placed 1..3 frames into the pop.
// Phase 0 (natural, 10 s) logs which obstacle limits every clamped pop (to judge the feel at 360x640).
// Negative: QA_BREAK=clamp sets sc.disablePopClamp (round-7 pop) and must FAIL.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { SIZES, boot, newPhone, waitScene, tap, clearedSave, watchErrors } from './qa-helpers.js';

const OUT = process.env.QA7C_OUT || 'qa7c-out';

test('QA 7c forced combo pop per-frame (BUG-7b-01)', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'own contexts');
  test.setTimeout(600000);
  const lines = [];
  let total = 0;
  let injected = 0;
  let nearReach = 0;
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
      if (brk === 'clamp') sc.disablePopClamp = true;
      const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      const box = (o) => { const q = o.getBounds(); return { x: q.x, y: q.y, w: q.width, h: q.height }; };
      // limiter diagnostics for natural pops
      T.qaLim = [];
      const orig = sc.popCombo.bind(sc);
      sc.popCombo = (tx, max) => {
        orig(tx, max);
        if (tx.popPeak < max - 1e-6) {
          const s = tx.popPeak + 0.01;
          const r = { x: tx.x - tx.originX * tx.width * s - 2, y: tx.y - tx.originY * tx.height * s - 2, w: tx.width * s + 4, h: tx.height * s + 4 };
          const rest = { x: tx.x - tx.originX * tx.width - 2, y: tx.y - tx.originY * tx.height - 2, w: tx.width + 4, h: tx.height + 4 };
          const who = [];
          for (const it of sc.floats.items) if (hit(r, it.rect) && !hit(rest, it.rect)) who.push('float');
          for (const side of ['player', 'enemy']) { const n = sc.fighters[side].nameRect(); if (hit(r, n) && !hit(rest, n)) who.push(side + ' name "' + sc.fighters[side].nameTag.text + '"'); }
          for (const o of [sc.comboText, sc.comboHits, sc.enemyCombo]) if (o !== tx && o.alpha > 0.05 && o.text) { const b = box(o); if (hit(r, b) && !hit(rest, b)) who.push('counter "' + o.text + '"'); }
          for (const c of [sc.introC, sc.introFading]) if (c && c.list) for (const o of c.list) if (o.type === 'Text') { const b = box(o); if (hit(r, b) && !hit(rest, b)) who.push('intro "' + o.text + '"'); }
          if (sc.tutLayer && sc.tutLayer.visible && sc.tutRect && hit(r, sc.tutRect)) who.push('tutorial');
          T.qaLim.push({ peak: +tx.popPeak.toFixed(3), who: who.join('+') || '?' });
        }
      };
      // bot (as qa-busy)
      const canvas = T.game.canvas;
      const cr0 = canvas.getBoundingClientRect();
      const k = cr0.width / sc.W;
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
          if (i >= 0) { const cr = sc.L.cardRect(i); touch(cr0.left + (cr.x + cr.w / 2) * k, cr0.top + (cr.y + cr.h / 2) * k, 0); }
        }
        if (n % 45 === 0) { const p = sc.L.swipePad; touch(cr0.left + (sc.W / 2) * k, cr0.top + ((p.top + p.bottom) / 2) * k, -40 * k); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      // per-frame scanner: any COMBO counter vs any other arena text (COMBO-vs-HITS deliberate exception kept)
      T.qaF = { on: false, frames: 0, problems: {}, first: [] };
      T.game.events.on('postrender', () => {
        const Q = T.qaF;
        if (!Q.on || T.sceneKey !== 'Battle') return;
        if (sc.cinematic && sc.cinematic.visible && sc.cinematic.alpha > 0.05) return;
        Q.frames++;
        const texts = [];
        const walk = (list, alpha, vis) => {
          for (const o of list) {
            const a = alpha * (o.alpha === undefined ? 1 : o.alpha);
            const v = vis && o.visible !== false;
            if (!v || a < 0.35) continue;
            if (o.type === 'Text' && o.text && o.text.trim()) {
              const b = o.getBounds();
              if (b.y + b.height > sc.L.arena.top && b.y < sc.L.arena.bottom - 46 + 8) texts.push({ t: o.text.replace(/\n/g, ' ').slice(0, 30), x: b.x, y: b.y, w: b.width, h: b.height, s: o.scaleX, d: (o.parentContainer ? o.parentContainer.depth : 0) + o.depth });
            }
            if (o.list) walk(o.list, a, v);
          }
        };
        walk(sc.children.list, 1, true);
        for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
          const A = texts[i];
          const B = texts[j];
          if (A.d >= 70 || B.d >= 70) continue;
          const isCH = /^COMBO x/.test(A.t + B.t) && / HITS/.test(A.t + B.t) && /^COMBO x/.test(A.t) !== /^COMBO x/.test(B.t);
          if (isCH) continue;
          const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) - 4;
          const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) - 4;
          if (ox > 0 && oy > 0) {
            const key = `"${A.t}" x "${B.t}"`;
            Q.problems[key] = (Q.problems[key] || 0) + 1;
            if (Q.first.length < 6) Q.first.push(`frame ${Q.frames}: "${A.t}"(s${A.s.toFixed(2)}) x "${B.t}"(s${B.s.toFixed(2)}) ${ox.toFixed(1)}x${oy.toFixed(1)}`);
          }
        }
      });
      // forced injections
      T.qaInj = { n: 0, nearReach: 0, placedNone: 0, peaks: [] };
      const st13 = { fontStyle: 'italic', strokeThickness: 3, wordWrap: { width: 150 } };
      const put = (x, y) => sc.spawnFloat({ x, y, str: 'NOONDAY HALO!', size: 13, color: '#ffffff', style: st13, bands: ['upper'], priority: 1, pop: 1.1, hold: 900, fade: 300, depth: 58 });
      const reach = (tx, s) => ({ x: tx.x - tx.originX * tx.width * s, y: tx.y - tx.originY * tx.height * s, w: tx.width * s, h: tx.height * s });
      const raf = () => new Promise((res) => requestAnimationFrame(res));
      T.qaRunInject = async (ms) => {
        const t0 = performance.now();
        let c = 0;
        while (performance.now() - t0 < ms && T.sceneKey === 'Battle') {
          if (sc.cinematic && sc.cinematic.visible && sc.cinematic.alpha > 0.05) { await raf(); continue; }
          const z = sc.comboZones;
          const enemySide = c % 2 === 1;
          const zone = enemySide ? z[z.length - 1] : z[0];
          const tx = enemySide ? sc.enemyCombo : sc.comboText;
          const max = enemySide ? 1.4 : 1.5;
          const spots = [
            [zone.x + zone.w + 40, zone.y + zone.h / 2],
            [zone.x + zone.w / 2, zone.y + zone.h + 12],
            [zone.x + zone.w / 2, zone.y - 12],
            [zone.x - 40, zone.y + zone.h / 2],
          ];
          const [sx, sy] = spots[Math.floor(c / 2) % spots.length];
          const orderB = c % 4 >= 2;
          tx.setText('COMBO x' + (2 + (c % 7))).setAlpha(1);
          let f;
          if (!orderB) {
            f = put(sx, sy);
            await raf();
            sc.popCombo(tx, max);
          } else {
            sc.popCombo(tx, max);
            for (let w = 0; w < 1 + (c % 3); w++) await raf();
            f = put(sx, sy);
          }
          T.qaInj.n++;
          if (!f) T.qaInj.placedNone++;
          else if (hit(reach(tx, max), box(f))) T.qaInj.nearReach++;
          T.qaInj.peaks.push(+tx.popPeak.toFixed(3));
          for (let w = 0; w < 14; w++) await raf(); // let the 160 ms pop finish
          if (f && f.evict) f.evict();
          c++;
        }
      };
    }, process.env.QA_BREAK || '');
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    await page.evaluate(() => { window.__TEST__.game.scene.getScene('Battle').battle.teams.enemy.fighters[0].hp = 0; });
    await page.waitForFunction(() => { const s = window.__TEST__.battleState(); return s.teams.enemy.activeSlot === 1 && !s.freeze; }, null, { timeout: 10000 });
    // phase 0: natural, 10 s, limiter diagnostics
    await page.waitForTimeout(10000);
    const lim = await page.evaluate(() => window.__TEST__.qaLim.slice());
    // phase 1: forced injections, 20 s, per-frame scan
    await page.evaluate(() => { window.__TEST__.qaF.on = true; });
    await page.evaluate(() => window.__TEST__.qaRunInject(20000));
    const r = await page.evaluate(() => { const T = window.__TEST__; T.qaF.on = false; T.stopBusy = true; return { F: T.qaF, I: T.qaInj }; });
    const comboKeys = Object.keys(r.F.problems).filter((k) => /COMBO x/.test(k));
    const nCombo = comboKeys.reduce((m, k) => m + r.F.problems[k], 0);
    const nAll = Object.values(r.F.problems).reduce((m, x) => m + x, 0);
    total += nCombo;
    injected += r.I.n;
    nearReach += r.I.nearReach;
    const pk = r.I.peaks.slice().sort((a, b) => a - b);
    const limSummary = {};
    for (const l of lim) { const k2 = `${l.peak} by ${l.who}`; limSummary[k2] = (limSummary[k2] || 0) + 1; }
    lines.push(`${size.name}: natural clamped pops (10 s): ${JSON.stringify(limSummary)}`);
    lines.push(`${size.name}: injections=${r.I.n} insideUnclampedReach=${r.I.nearReach} notPlaced=${r.I.placedNone} peaks min=${pk[0]} median=${pk[Math.floor(pk.length / 2)]} max=${pk[pk.length - 1]} frames=${r.F.frames} comboOverlapFrames=${nCombo} allOverlapFrames=${nAll}`);
    for (const k2 of Object.keys(r.F.problems)) lines.push(`${size.name}:   ${r.F.problems[k2]}x ${k2}`);
    for (const f of r.F.first) lines.push(`${size.name}:   first: ${f}`);
    errs.push(...errors.map((e) => size.name + ' ' + e));
    await ctx.close();
  }
  lines.push(`TOTAL comboOverlapFrames=${total} injections=${injected} insideUnclampedReach=${nearReach} consoleErrors=${errs.length} break=${process.env.QA_BREAK || 'none'}`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.appendFileSync(`${OUT}/pop-forced.txt`, lines.join('\n') + '\n---\n');
  console.log(lines.join('\n'));
  expect(errs).toEqual([]);
  expect(nearReach, 'precondition: placed texts inside the unclamped pop reach').toBeGreaterThan(10);
  expect(total, lines.join('\n')).toBe(0);
});
