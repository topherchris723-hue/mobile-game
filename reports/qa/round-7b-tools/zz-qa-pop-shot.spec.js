// QA 7c tool: freeze the first two natural combo pops at their peak (tween t=0 of 160 ms) in the QA scenario; screenshot.
import { test } from '@playwright/test';
import { SIZES, boot, newPhone, waitScene, tap, clearedSave } from './qa-helpers.js';
const OUT = process.env.QA7C_OUT || 'qa7c-out';
test('QA 7c pop peak shots', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'own contexts');
  test.setTimeout(300000);
  for (const size of [SIZES[0], SIZES[2]]) {
    const { ctx, page } = await newPhone(browser, size);
    const sv = clearedSave(4);
    for (const id of ['char_solenne_001', 'char_corvane_001']) sv.roster.push({ character_id: id, resonance: 0, obtained_at: sv.created_at });
    sv.team = ['char_solenne_001', 'char_corvane_001', 'char_dunmore_001'];
    await boot(page, sv, '&renderer=canvas&seed=777');
    await tap(page, 'start'); await waitScene(page, 'Home'); await tap(page, 'home_story'); await waitScene(page, 'Story');
    await tap(page, 'stage_stage_005'); await waitScene(page, 'Dialogue'); await tap(page, 'dialogue_skip'); await waitScene(page, 'Team');
    await tap(page, 'team_fight'); await waitScene(page, 'Battle');
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    for (let k = 1; k <= 2; k++) {
      await page.evaluate(() => {
        const T = window.__TEST__; const sc = T.activeScene(); T.qaFrozen = null;
        if (!sc.qaOrig) sc.qaOrig = sc.popCombo.bind(sc);
        sc.popCombo = (tx, max) => { sc.qaOrig(tx, max); if (!T.qaFrozen) { T.qaFrozen = { text: tx.text, peak: tx.popPeak, scale: tx.scaleX }; sc.tweens.pauseAll(); sc.battle.qaHold = true; T.game.loop.sleep(); } };
        // drive: play cards fast
        const b = sc.battle; b.teams.player.vigor = 6000 * 8;
        const st = b.getState(); const f = st.teams.player.fighters[st.teams.player.activeSlot];
        T.qaTap = setInterval(() => { if (T.qaFrozen) return clearInterval(T.qaTap); b.teams.player.vigor = 6000 * 8; for (const fi of b.teams.player.fighters) if (!fi.ko) fi.hp = fi.def.maxHp; const s2 = b.getState(); const f2 = s2.teams.player.fighters[s2.teams.player.activeSlot]; const i = f2.hand.findIndex((c) => c && c.playable); if (i >= 0) sc.battle.applyInput && sc.battle.applyInput('player', { type: 'card', slot: i }); }, 90);
      });
      await page.waitForFunction(() => !!window.__TEST__.qaFrozen, null, { timeout: 30000 }).catch(() => {});
      const fr = await page.evaluate(() => window.__TEST__.qaFrozen);
      console.log(`${size.name} pop ${k}: ${JSON.stringify(fr)}`);
      if (fr) await page.screenshot({ path: `${OUT}/${size.name}-pop-peak-${k}.png` });
      await page.evaluate(() => { const T = window.__TEST__; const sc = T.activeScene(); T.game.loop.wake(); sc.tweens.resumeAll(); });
      await page.waitForTimeout(1500);
    }
    await ctx.close();
  }
});
