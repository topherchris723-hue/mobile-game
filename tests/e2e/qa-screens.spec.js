// QA round 2: every screen at 360×640, 390×844, 430×932 (+ 360×800 for AC-14.2). Screenshots go to
// reports/screenshots/round-2/qa/. Automated layout scan: text clipped off-screen, font < 12 px,
// text/text overlap, touch targets ≥ 44 and ≥ 8 px apart (GDD §14, AC-14.1), no shop/purchase UI (AC-4.2),
// zero console errors. Runs once (in the 360 project) and opens its own contexts per size.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { SIZES, QA_SHOTS, boot, newPhone, waitScene, tap, target, targets, shot, scanTexts, layoutProblems, battle, freshSave, clearedSave, watchErrors } from './qa-helpers.js';

const SHOP_RE = /\b(shop|store|buy|purchase|price|pay|payment|iap|premium|\$|€|£|usd)\b/i;

async function check(page, sizeName, screen, findings, opts = {}) {
  const p = await shot(page, `${sizeName}-${screen}`);
  const scan = await scanTexts(page);
  const tgs = await targets(page);
  const probs = layoutProblems(scan, tgs, opts);
  for (const t of scan.texts) if (SHOP_RE.test(t.text)) probs.push(`AC-4.2 shop/purchase text: "${t.text}"`);
  for (const t of scan.texts) if (/\[[a-z0-9_]+\]/.test(t.text)) probs.push(`missing UI string key shown: "${t.text}"`);
  findings.push({ size: sizeName, screen, shot: p, problems: probs, texts: scan.texts.map((t) => t.text) });
  return probs;
}

test('QA screens at 3 phone sizes: layout scan + screenshots', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'opens its own contexts for every size');
  test.setTimeout(600000);
  const findings = [];
  const allErrors = [];
  for (const size of SIZES) {
    const { ctx, page } = await newPhone(browser, size);
    const errors = watchErrors(page);
    const n = size.name;
    // --- fresh save path
    await boot(page, null);
    await check(page, n, '01-title', findings);
    await tap(page, 'start');
    await waitScene(page, 'Home');
    await check(page, n, '02-home', findings);
    await tap(page, 'home_summon'); // disabled: toast only
    await page.waitForTimeout(300);
    await check(page, n, '03-home-summon-toast', findings);
    await page.waitForTimeout(2000);
    await tap(page, 'home_story');
    await waitScene(page, 'Story');
    await check(page, n, '04-story-fresh', findings);
    await tap(page, 'stage_stage_001');
    await waitScene(page, 'Dialogue');
    await check(page, n, '05-dialogue-001-pre', findings);
    await tap(page, 'dialogue_next');
    await page.waitForTimeout(250);
    await check(page, n, '06-dialogue-001-pre-line2', findings);
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
    await check(page, n, '07-team-select', findings);
    await tap(page, 'team_fight');
    await waitScene(page, 'Battle');
    await check(page, n, '08-battle-intro-001', findings);
    await page.waitForFunction(() => !!window.__TEST__.tutorialStep(), null, { timeout: 15000 });
    await check(page, n, '09-battle-tutorial-prompt', findings, { ignore: (t) => t.text === 'FIGHT!' }); // 1 s callout
    // long-press tooltip
    const c0 = await target(page, 'card_0');
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c0.x + c0.w / 2, y: c0.y + c0.h / 2 }] });
    await page.waitForTimeout(600);
    await check(page, n, '10-battle-tooltip', findings, { overlayDepth: 90 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    await tap(page, 'battle_pause');
    await page.waitForTimeout(300);
    await check(page, n, '11-battle-pause', findings, { overlayDepth: 100, targetFilter: (t) => t.id.startsWith('menu_') });
    await tap(page, 'menu_retreat');
    await page.waitForTimeout(300);
    await check(page, n, '12-battle-retreat-confirm', findings, { overlayDepth: 100, targetFilter: (t) => t.id.startsWith('menu_') });
    await tap(page, 'menu_retreat_yes');
    await waitScene(page, 'Result');
    await page.waitForTimeout(1200);
    await check(page, n, '13-result-retreat', findings);
    await tap(page, 'back');
    await waitScene(page, 'Story');
    await tap(page, 'back');
    await waitScene(page, 'Home');
    await tap(page, 'home_team');
    await waitScene(page, 'Team');
    await check(page, n, '14-team-edit', findings);

    // --- progressed save: stages 1–4 cleared, roster with 4 fighters
    const s = clearedSave(4);
    s.roster.push({ character_id: 'char_solenne_001', resonance: 2, obtained_at: s.created_at });
    await boot(page, s);
    await tap(page, 'start');
    await waitScene(page, 'Home');
    await tap(page, 'home_story');
    await waitScene(page, 'Story');
    await check(page, n, '15-story-cleared-1-4', findings);
    await tap(page, 'back');
    await waitScene(page, 'Home');
    await tap(page, 'home_team');
    await waitScene(page, 'Team');
    await check(page, n, '16-team-edit-4-roster', findings);
    await tap(page, 'back');
    await waitScene(page, 'Home');
    await tap(page, 'home_story');
    await waitScene(page, 'Story');
    await tap(page, 'stage_stage_005');
    await waitScene(page, 'Dialogue');
    await check(page, n, '17-dialogue-005-pre', findings);
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
    await check(page, n, '18-team-select-005', findings);
    await tap(page, 'team_fight');
    await waitScene(page, 'Battle');
    await check(page, n, '19-battle-intro-005', findings);
    // advance to the long-named second enemy: KO the first one, then look at the HUD
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.teams.enemy.fighters[0].hp = 0; });
    await page.waitForFunction(() => window.__TEST__.battleState().teams.enemy.activeSlot === 1 && !window.__TEST__.battleState().freeze, null, { timeout: 10000 });
    await check(page, n, '20-battle-fight-umbral-solenne', findings);
    // win: drop remaining enemies to 0
    await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.teams.enemy.fighters.forEach((f) => (f.hp = 0)); });
    await page.waitForFunction(() => { const s = window.__TEST__.battleState(); return s.teams.enemy.activeSlot === 2 && !s.freeze; }, null, { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.teams.enemy.fighters.forEach((f) => (f.hp = 0)); });
    await waitScene(page, 'Result', 20000);
    await page.waitForTimeout(1500);
    await check(page, n, '21-result-win-005', findings);
    await tap(page, 'result_continue');
    await waitScene(page, 'Dialogue');
    await check(page, n, '22-dialogue-005-post', findings);
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Story');
    await check(page, n, '23-story-all-cleared', findings);

    // --- Result screen for a Draw by double KO (engine reason 'double_ko'); rendered directly via the scene manager
    await page.evaluate(() => {
      const g = window.__TEST__.game;
      g.scene.getScenes(true).forEach((sc) => g.scene.stop(sc.scene.key));
      g.scene.start('Result', { stageId: 'stage_003', result: { outcome: 'draw', reason: 'double_ko', ticks: 6000, timeElapsedS: 100, playerHpRatio: 0, enemyHpRatio: 0, stats: { playerKos: 3, perfectSlips: 1, maxChain: 3 } }, rewards: [], missions: [] });
    });
    await waitScene(page, 'Result');
    await page.waitForTimeout(1200);
    await check(page, n, '24-result-draw-double-ko', findings);
    await page.evaluate(() => {
      const g = window.__TEST__.game;
      g.scene.getScenes(true).forEach((sc) => g.scene.stop(sc.scene.key));
      g.scene.start('Result', { stageId: 'stage_002', result: { outcome: 'draw', reason: 'timeout', ticks: 9000, timeElapsedS: 150, playerHpRatio: 0.4, enemyHpRatio: 0.4, stats: {} }, rewards: [], missions: [] });
    });
    await waitScene(page, 'Result');
    await page.waitForTimeout(1200);
    await check(page, n, '25-result-draw-timeout', findings);

    allErrors.push(...errors.map((e) => n + ' ' + e));
    await ctx.close();
  }

  // AC-14.2: 360×800 — arena taller, no stretched canvas
  {
    const { ctx, page } = await newPhone(browser, { name: '360x800', w: 360, h: 800, dpr: 2 });
    const errors = watchErrors(page);
    await boot(page, clearedSave(1));
    await tap(page, 'start');
    await waitScene(page, 'Home');
    await tap(page, 'home_story');
    await waitScene(page, 'Story');
    await tap(page, 'stage_stage_002');
    await waitScene(page, 'Dialogue');
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
    await tap(page, 'team_fight');
    await waitScene(page, 'Battle');
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    await check(page, '360x800', '30-battle-fight', findings);
    const geo = await page.evaluate(() => {
      const c = window.__TEST__.game.canvas;
      const r = c.getBoundingClientRect();
      const s = window.__TEST__.activeScene();
      return { cssW: r.width, cssH: r.height, logicalW: s.W, logicalH: s.H, arenaBottom: s.L.arena.bottom, extra: s.L.extra };
    });
    findings.push({ size: '360x800', screen: 'AC-14.2 geometry', problems: [], geo });
    expect.soft(Math.abs(geo.cssW / geo.cssH - geo.logicalW / geo.logicalH), 'AC-14.2 no stretch').toBeLessThan(0.01);
    expect.soft(geo.logicalH, 'AC-14.2 logical height grows').toBe(800);
    expect.soft(geo.arenaBottom, 'AC-14.2 arena taller').toBe(330 + 160);
    allErrors.push(...errors.map((e) => '360x800 ' + e));
    await ctx.close();
  }

  fs.writeFileSync(`${QA_SHOTS}/layout-findings.json`, JSON.stringify(findings, null, 2));
  const problems = findings.flatMap((f) => f.problems.map((p) => `${f.size} ${f.screen}: ${p}`));
  console.log('LAYOUT PROBLEMS (' + problems.length + '):\n' + problems.join('\n'));
  console.log('CONSOLE ERRORS (' + allErrors.length + '):\n' + allErrors.join('\n'));
  expect.soft(allErrors, 'zero console errors').toEqual([]);
  expect(problems, 'layout problems').toEqual([]);
});
