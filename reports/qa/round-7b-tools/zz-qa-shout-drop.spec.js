// QA round 7c (tool): which shouts in data can be shown at all? Quiet arena (no floats, counters hidden),
// every card shout + every character shout, both sides, at 3 sizes. Records lines and whether the placer drops it.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { SIZES, boot, newPhone, waitScene, tap, clearedSave } from './qa-helpers.js';

const OUT = process.env.QA7C_OUT || 'qa7c-out';

test('QA 7c shout drop probe', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'own contexts');
  test.setTimeout(300000);
  const lines = [];
  for (const size of SIZES) {
    const { ctx, page } = await newPhone(browser, size);
    const sv = clearedSave(4);
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
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    const r = await page.evaluate(() => {
      const T = window.__TEST__;
      const sc = T.activeScene();
      sc.battle.paused = true;
      const raw = T.data.raw;
      const all = [...new Set([...raw.cards.cards.map((c) => c.shout), ...raw.characters.characters.flatMap((c) => Object.values(c.shouts || {}))].filter(Boolean))];
      const probe = sc.text(0, 0, 'x', 13, '#ffffff', { fontStyle: 'italic', strokeThickness: 3, wordWrap: { width: 150 } });
      const one = probe.height;
      const res = { total: all.length, twoLine: 0, dropped: [], droppedOneLine: 0, droppedTwoLine: 0, band: sc.floatBands().upper, zones: sc.comboZones };
      for (const s of all) {
        const two = probe.setText(s).height > one * 1.5;
        if (two) res.twoLine++;
        for (const side of ['player', 'enemy']) {
          for (const it of sc.floats.items.slice()) if (it.onEvict) it.onEvict();
          sc.floats.clear();
          for (const o of [sc.comboText, sc.comboHits, sc.enemyCombo]) o.setAlpha(0);
          sc.shoutTxt[side] = null;
          sc.shout(side, s);
          if (!sc.shoutTxt[side]) { res.dropped.push(`${side}:${two ? '2L' : '1L'}:${s}`); if (two) res.droppedTwoLine++; else res.droppedOneLine++; }
        }
      }
      probe.destroy();
      return res;
    });
    lines.push(`${size.name}: shouts=${r.total} twoLine=${r.twoLine} dropped(side-attempts)=${r.dropped.length} [1L ${r.droppedOneLine}, 2L ${r.droppedTwoLine}] upperBand=${JSON.stringify(r.band)}`);
    for (const d of r.dropped) lines.push(`${size.name}:   ${d}`);
    await ctx.close();
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/shout-drop.txt`, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  expect(true).toBe(true);
});
