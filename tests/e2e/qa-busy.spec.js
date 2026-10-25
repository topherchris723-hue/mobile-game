// QA round 2 loop 2: floating battle texts during BUSY frames (BUG-2-10 class). Loop 1 only scanned
// screens at rest, so transient texts (damage numbers, WEAK!/RESIST/CRIT, shouts, DODGE/TAG) were never
// on screen when the scan ran. This spec plays a real battle with an in-page bot that taps cards and
// swipes constantly, and scans the real rendered Text bounds every ~120 ms for ~25 s per size.
// Any text/text overlap in the arena (excluding cinematic frames, whose banner covers the arena on purpose)
// is recorded and screenshotted.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { SIZES, QA_SHOTS, boot, newPhone, waitScene, tap, clearedSave, watchErrors, rawShot } from './qa-helpers.js';

async function scanArena(page) {
  return page.evaluate(() => {
    const T = window.__TEST__;
    const s = T.activeScene();
    if (!s || s.scene.key !== 'Battle') return null;
    const st = s.battle.getState();
    const cine = s.cinematic && s.cinematic.visible && s.cinematic.alpha > 0.05;
    const texts = [];
    const walk = (list, alpha, vis) => {
      for (const o of list) {
        const a = alpha * (o.alpha === undefined ? 1 : o.alpha);
        const v = vis && o.visible !== false;
        if (!v || a < 0.35) continue;
        if (o.type === 'Text' && o.text && o.text.trim()) {
          const b = o.getBounds();
          // arena only (top bar and HUD are static and covered by qa-screens)
          if (b.y + b.height > s.L.arena.top && b.y < s.L.arena.bottom - 46 + 8) texts.push({ t: o.text.replace(/\n/g, ' ').slice(0, 40), x: b.x, y: b.y, w: b.width, h: b.height, a: +a.toFixed(2), d: (o.parentContainer ? o.parentContainer.depth : 0) + o.depth });
        }
        if (o.list) walk(o.list, a, v);
      }
    };
    walk(s.children.list, 1, true);
    const overlaps = [];
    const pad = 2;
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const A = texts[i];
      const B = texts[j];
      if (A.d >= 70 || B.d >= 70) continue; // tutorial prompt / cinematic / menus are deliberate overlays
      if (/^COMBO x/.test(A.t + B.t) && / HITS/.test(A.t + B.t) && /^COMBO x/.test(A.t) !== /^COMBO x/.test(B.t)) continue; // 160 ms pop-scale only; at rest they are clear
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) - pad * 2;
      const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) - pad * 2;
      if (ox > 0 && oy > 0) overlaps.push(`"${A.t}"(a${A.a}) × "${B.t}"(a${B.a}) ${ox.toFixed(0)}x${oy.toFixed(0)}`);
    }
    for (const A of texts) if (A.d < 70 && (A.x < -3 || A.x + A.w > s.W + 3)) overlaps.push(`text off-screen: "${A.t}" x ${A.x.toFixed(0)}..${(A.x + A.w).toFixed(0)} of ${s.W}`);
    if (s.lastArena) for (const side of ['player', 'enemy']) {
      const f = s.lastArena[side];
      if (f.x - f.ext.left < -1 || f.x + f.ext.right > s.W + 1) overlaps.push(`${side} fighter off-screen: ${(f.x - f.ext.left).toFixed(0)}..${(f.x + f.ext.right).toFixed(0)} of ${s.W}`);
    }
    return { tick: st.tick, phase: st.phase, freeze: st.freeze && st.freeze.kind, cine: !!cine, result: !!st.result, n: texts.length, overlaps };
  });
}

test('QA busy battle frames: floating texts never overlap (BUG-2-10) at 3 sizes', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'opens its own contexts for every size');
  test.setTimeout(600000);
  const report = [];
  const allErrors = [];
  for (const size of SIZES) {
    const { ctx, page } = await newPhone(browser, size);
    const errors = watchErrors(page);
    // L-qa-002: longest names in data — player Solenne/Corvane/Dunmore (7 chars) vs stage_005's "Umbral Solenne" (14).
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
    // QA: keep both sides alive and busy for the whole sample (HP topped up), so texts keep spawning.
    await page.evaluate((breakPlacer) => {
      const T = window.__TEST__;
      const sc = T.activeScene();
      // L-shared-006 negative proof: QA_BREAK_PLACER=1 makes the placer return the wanted spot unchecked.
      if (breakPlacer === 'placer' || breakPlacer === 'all') sc.floats.place = (o) => ({ x: o.x, y: o.y });
      // QA_BREAK_PLACER=labels: after each render, put the enemy label on the player's and push the enemy off-screen.
      if (breakPlacer === 'labels' || breakPlacer === 'all') sc.events.on('postupdate', () => {
        sc.fighters.enemy.nameTag.setX(sc.fighters.player.nameTag.x + 10);
        if (sc.lastArena) sc.lastArena.enemy.x = sc.W + 5;
      });
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
        if (b.teams.player.vigor < 6000 * 4) b.teams.player.vigor = 6000 * 8; // QA: always afford cards
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
    }, process.env.QA_BREAK_PLACER === '1' ? 'placer' : (process.env.QA_BREAK_PLACER || ''));
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    // KO enemy 1 so the longest enemy name ("Umbral Solenne", slot 2) is on screen for the whole sample
    await page.evaluate(() => { window.__TEST__.game.scene.getScene('Battle').battle.teams.enemy.fighters[0].hp = 0; });
    await page.waitForFunction(() => { const s = window.__TEST__.battleState(); return s.teams.enemy.activeSlot === 1 && !s.freeze; }, null, { timeout: 10000 });
    let frames = 0;
    let busiest = 0;
    let shots = 0;
    const seen = new Set();
    const end = Date.now() + 25000;
    while (Date.now() < end) {
      const r = await scanArena(page);
      if (!r || r.result) break;
      if (r.cine) { await page.waitForTimeout(120); continue; }
      frames++;
      busiest = Math.max(busiest, r.n);
      if (r.n >= 5 && shots < 2 && r.overlaps.length === 0) { shots++; await rawShot(page, `${size.name}-busy-frame-clean-${shots}.png`); }
      for (const o of r.overlaps) {
        if (!seen.has(o)) {
          seen.add(o);
          const p = seen.size <= 4 ? await rawShot(page, `${size.name}-busy-overlap-${seen.size}.png`) : null;
          report.push(`${size.name} tick ${r.tick}: ${o}` + (p ? ` [${p}]` : ''));
        }
      }
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => (window.__TEST__.stopBusy = true));
    await rawShot(page, `${size.name}-busy-end.png`);
    console.log(`[${size.name}] busy frames scanned=${frames}, max arena texts in one frame=${busiest}, overlaps=${seen.size}`);
    report.unshift(`${size.name}: frames=${frames} maxTexts=${busiest} overlaps=${seen.size}`);
    allErrors.push(...errors.map((e) => size.name + ' ' + e));
    await ctx.close();
  }
  fs.mkdirSync(QA_SHOTS, { recursive: true });
  fs.writeFileSync(`${QA_SHOTS}/busy-findings.txt`, report.join('\n') + '\n');
  console.log(report.join('\n'));
  expect.soft(allErrors).toEqual([]);
  expect(report.filter((l) => / tick /.test(l)), 'floating-text overlaps in busy frames').toEqual([]);
});
