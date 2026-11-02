// QA round 5: per-fighter silhouettes, Umbral look from enemies.json `variant` (AC-8.2 c), summon rarity frames/orbs.
// Screenshots (QA_SHOTS=1) go to the current round's qa folder for the by-eye review.
import { test, expect } from '@playwright/test';
import { boot, waitScene, tap, shot, clearedSave, freshSave, watchErrors, QA_SHOTS } from './qa-helpers.js';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'runs once (360×640)');
});
const BRK = process.env.QA_BREAK || '';

async function toBattle(page, stageId) {
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await tap(page, 'stage_' + stageId);
  await waitScene(page, 'Dialogue');
  await tap(page, 'dialogue_skip');
  await waitScene(page, 'Team');
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  await page.evaluate(() => { window.__TEST__.game.scene.getScene('Battle').battle.controllers.enemy = null; });
}

/** Look at every enemy of the stage in turn (KO the previous one); returns [{ enemyId, umbral, textureKey }]. */
async function lookAtEnemies(page, tag) {
  const out = [];
  const n = await page.evaluate(() => window.__TEST__.battleState().teams.enemy.fighters.length);
  for (let i = 0; i < n; i++) {
    await page.waitForFunction((k) => { const s = window.__TEST__.battleState(); return s.teams.enemy.activeSlot === k && !s.freeze; }, i, { timeout: 15000 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const sc = window.__TEST__.game.scene.getScene('Battle');
      const st = sc.battle.getState();
      const f = st.teams.enemy.fighters[st.teams.enemy.activeSlot];
      const v = sc.fighters.enemy;
      // QA_BREAK=id (negative proof): a renderer that decides Umbral from the id
      if (window.__qaBreakId) v.variantOf = (x) => (/^enemy_umbral_/.test(x.enemyId) ? 'umbral' : null);
      if (window.__qaBreakId) { v.key = null; v.setFighter(f); }
      return { enemyId: f.enemyId, umbral: !!v.umbral, key: v.key };
    });
    await shot(page, `r5-${tag}-enemy-${i + 1}-${r.enemyId}`);
    out.push(r);
    if (i < n - 1) await page.evaluate((k) => { window.__TEST__.game.scene.getScene('Battle').battle.teams.enemy.fighters[k].hp = 0; }, i);
  }
  return out;
}

test('AC-8.2(c) Umbral look comes from enemies.json `variant` only', async ({ page }) => {
  const errors = watchErrors(page);
  const want = { enemy_umbral_rook_001: true, enemy_umbral_pell_001: true, enemy_umbral_solenne_001: true };
  // with data as shipped
  const seen = [];
  for (const st of ['stage_003', 'stage_005']) {
    await boot(page, clearedSave(4));
    await toBattle(page, st);
    seen.push(...(await lookAtEnemies(page, st)));
  }
  console.log('shipped data:', JSON.stringify(seen));
  for (const r of seen) expect(r.umbral, r.enemyId).toBe(!!want[r.enemyId]);
  expect(seen.filter((r) => r.umbral).length).toBe(3);
  // with every `variant` removed (same ids): all render normally
  await boot(page, clearedSave(4));
  await page.evaluate((brk) => { for (const e of window.__TEST__.data.raw.enemies.enemies) delete e.variant; if (brk === 'id') window.__qaBreakId = true; }, BRK);
  await toBattle(page, 'stage_003');
  const nov = await lookAtEnemies(page, 'novariant');
  console.log('variant removed:', JSON.stringify(nov));
  for (const r of nov) expect(r.umbral, r.enemyId + ' without variant renders normally').toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('silhouette sheets (colour / black / Umbral) and mirror-match rims for the by-eye review', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, freshSave());
  await tap(page, 'start');
  await waitScene(page, 'Home');
  for (const mode of ['color', 'black', 'umbral']) {
    const ids = await page.evaluate((m) => window.__TEST__.silhouetteSheet(m), mode);
    await shot(page, 'r5-silhouettes-' + mode);
    expect(ids.length).toBe(8);
    await page.evaluate(() => { const sc = window.__TEST__.activeScene(); sc.children.list.filter((o) => o.depth === 5000).forEach((o) => o.destroy()); });
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

for (const [rarity, seed] of [[3, 1], [4, 8], [5, 7]]) {
  test(`summon ★${rarity} orb, reveal frame and results frame (seed ${seed})`, async ({ page }) => {
    const errors = watchErrors(page);
    const s = freshSave();
    s.currencies.cur_jade = 100;
    await boot(page, s, `&renderer=canvas&summonSeed=${seed}`);
    await tap(page, 'start');
    await waitScene(page, 'Home');
    await tap(page, 'home_summon');
    await waitScene(page, 'Summon');
    await tap(page, 'summon_x1');
    await page.waitForTimeout(350);
    await tap(page, 'summon_confirm');
    // no settle delay here: the orb charge is only 260 / 420 / 700 ms
    await page.waitForFunction(() => window.__TEST__.sceneKey === 'SummonReveal', null, { timeout: 10000 });
    const chargeMs = rarity === 5 ? 700 : rarity === 4 ? 420 : 260;
    await page.waitForTimeout(Math.round(chargeMs * 0.45));
    // shot() itself waits 400 ms, so take the orb frame directly
    if (process.env.QA_SHOTS === '1' || process.env.UI_SHOTS === '1') await page.screenshot({ path: `${QA_SHOTS}/r5-summon-orb-${rarity}star.png` });
    await page.waitForTimeout(chargeMs + 300);
    await shot(page, `r5-summon-reveal-${rarity}star`);
    const res = await page.evaluate(() => JSON.parse(localStorage.getItem('game_save')).summon.total_pulls);
    expect(res).toBe(1);
    // a ×1 reveal may already have ended (results shown) — skip only if the Skip button is still there
    if ((await page.evaluate(() => window.__TEST__.targets().map((t) => t.id))).includes('summon_skip')) await tap(page, 'summon_skip');
    await page.waitForTimeout(800);
    await shot(page, `r5-summon-results-${rarity}star`);
    const rows = await page.evaluate(() => window.__TEST__.summonReveal().rows);
    console.log(`★${rarity} seed ${seed}: rows ${JSON.stringify(rows)}`);
    expect(JSON.stringify(rows)).toContain(`"rarity":${rarity}`);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
