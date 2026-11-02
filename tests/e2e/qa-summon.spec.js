// QA round 3: Summon abuse and P-class ACs in the browser (GDD §11): affordability at Jade 0/99/100/999/1000
// (AC-11.6), double taps on Summon/Confirm/Skip (AC-11.12), reload mid-reveal and page kill right after Confirm
// (AC-11.5: kept, not re-rollable, Jade deducted once), setItem failure (AC-11.10), rate table (AC-11.4),
// pity / first-×10 lines (AC-11.11), rotate during the reveal, Jade 999,999 layout, zero console errors.
import { test, expect } from '@playwright/test';
import { boot, waitScene, tap, target, targets, shot, freshSave, watchErrors, scanTexts, layoutProblems } from './qa-helpers.js';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'summon abuse runs once');
});

const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('game_save')));
const screen = (page) => page.evaluate(() => window.__TEST__.summonScreen());
const withJade = (j) => { const s = freshSave(); s.currencies.cur_jade = j; return s; };

async function toSummon(page) {
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_summon');
  await waitScene(page, 'Summon');
}

async function dbl(page, id, gapMs = 60) {
  const tg = await target(page, id);
  const x = tg.x + tg.w / 2;
  const y = tg.y + tg.h / 2;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(gapMs);
  await page.touchscreen.tap(x, y);
}

test('AC-11.6 affordability at Jade 0 / 99 / 100 / 999 / 1000; disabled taps open nothing', async ({ page }) => {
  const errors = watchErrors(page);
  const want = { 0: [false, false], 99: [false, false], 100: [true, false], 999: [true, false], 1000: [true, true] };
  for (const j of Object.keys(want)) {
    await boot(page, withJade(Number(j)));
    await toSummon(page);
    const sc = await screen(page);
    const ok = sc.buttons.map((b) => b.ok);
    const en = [(await target(page, 'summon_x1')).enabled, (await target(page, 'summon_x10')).enabled];
    console.log(`Jade ${j}: buttons ok=${JSON.stringify(ok)} enabled=${JSON.stringify(en)} sublabels=${JSON.stringify(sc.buttons.map((b) => b.sublabel))}`);
    expect(ok, 'Jade ' + j).toEqual(want[j]);
    expect(en, 'Jade ' + j).toEqual(want[j]);
    for (const [i, id] of ['summon_x1', 'summon_x10'].entries()) {
      if (!want[j][i]) {
        await dbl(page, id);
        await page.waitForTimeout(350);
        expect((await screen(page)).modal, `disabled ${id} at Jade ${j} opens no dialog`).toBeNull();
        expect(sc.buttons[i].sublabel).toBe('Not enough Jade — clear stages to earn more.');
      }
    }
    if (j === '99') await shot(page, 'summon-jade-99');
    expect((await save(page)).currencies.cur_jade).toBe(Number(j));
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-11.12 double tap on ×10, then double tap on Confirm (100 ms), then taps during the reveal: one summon only', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, withJade(2000), '&renderer=canvas&summonSeed=11');
  await toSummon(page);
  const x10 = await target(page, 'summon_x10');
  await dbl(page, 'summon_x10');
  await page.waitForTimeout(150);
  // the 2nd tap of the ×10 double tap must not have confirmed: no summon yet
  expect((await save(page)).summon.total_pulls).toBe(0);
  expect((await screen(page)).modal).toBe('confirm');
  const conf = await target(page, 'summon_confirm');
  const overlap = !(conf.x + conf.w <= x10.x || x10.x + x10.w <= conf.x || conf.y + conf.h <= x10.y || x10.y + x10.h <= conf.y);
  expect(overlap, 'Confirm must not cover the ×10 button').toBe(false);
  await page.waitForTimeout(300); // past the 250 ms arm
  // L-shared-006 negative proof: QA_BREAK=double removes the one-summon guard and fires a 2nd summon.
  if (process.env.QA_BREAK === 'double') await page.evaluate(() => { const sc = window.__TEST__.activeScene(); const b = sc.model.buttons[1]; const d = sc.doSummon.bind(sc); sc.doSummon = (x) => { d(x); sc.processing = false; sc.leaving = false; sc.modal = { confirmBtn: { setEnabled() {} }, objs: [], targetStart: sc.targets.length }; d(b); }; });
  await dbl(page, 'summon_confirm', 100);
  await waitScene(page, 'SummonReveal');
  // hammer the screen (incl. where the Summon buttons were) during the reveal
  for (let i = 0; i < 6; i++) { await page.touchscreen.tap(x10.x + x10.w / 2, x10.y + x10.h / 2); await page.waitForTimeout(80); }
  await page.waitForTimeout(600);
  const s = await save(page);
  const log = await page.evaluate(() => window.__TEST__.summonLog.map((e) => e.type));
  console.log('after double confirm: jade', s.currencies.cur_jade, 'total_pulls', s.summon.total_pulls, 'log', log.join(','));
  expect(s.summon.total_pulls).toBe(10);
  expect(log.filter((t) => t === 'summon_returned').length).toBe(1);
  expect(s.currencies.cur_jade).toBeLessThanOrEqual(1000 + 10 * 200);
  expect(s.currencies.cur_jade).toBeGreaterThanOrEqual(1000);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-11.5 reload mid-reveal and page kill right after Confirm: results kept, Jade once, no replay, not re-rollable', async ({ page, context }) => {
  const errors = watchErrors(page);
  // (a) reload during the reveal
  await boot(page, withJade(1000), '&renderer=canvas&summonSeed=7');
  await toSummon(page);
  await tap(page, 'summon_x10');
  await page.waitForTimeout(350);
  await tap(page, 'summon_confirm');
  await waitScene(page, 'SummonReveal');
  const during = await save(page);
  await shot(page, 'summon-reveal-mid');
  await page.reload();
  await waitScene(page, 'Title');
  const after = await save(page);
  delete during.updated_at; delete after.updated_at;
  expect(after, 'save after reload = save written before the reveal').toEqual(during);
  expect(after.summon.total_pulls).toBe(10);
  expect(after.summon.first_multi_done.banner_starter_001).toBe(true);
  expect(after.roster.length).toBeGreaterThan(3);
  await toSummon(page);
  const sc = await screen(page);
  expect(sc.firstMulti, 'first ×10 line gone after the ×10').toBeNull();
  expect(sc.buttons[1].ok, '×10 not affordable again (no refund)').toBe(after.currencies.cur_jade >= 1000);
  // (b) kill the page at several delays after Confirm: either nothing happened or everything did, never half
  const outcomes = [];
  for (const delay of [0, 15, 40, 80, 150, 400]) {
    const p = await context.newPage();
    await p.goto('/?test=1&renderer=canvas&seed=1');
    await waitScene(p, 'Title');
    await p.evaluate((s) => localStorage.setItem('game_save', JSON.stringify(s)), withJade(1000));
    await p.reload();
    await waitScene(p, 'Title');
    // L-shared-006 negative proof: QA_BREAK=half writes only the Jade deduction (a non-atomic save).
    if (process.env.QA_BREAK === 'half') await p.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'game_save') { const j = JSON.parse(v); if (j.summon.total_pulls > 0) { const prev = JSON.parse(localStorage.getItem('game_save')); prev.currencies = j.currencies; v = JSON.stringify(prev); } } return o.call(this, k, v); }; });
    await toSummon(p);
    await tap(p, 'summon_x10');
    await p.waitForTimeout(350);
    const c = await target(p, 'summon_confirm');
    await p.touchscreen.tap(c.x + c.w / 2, c.y + c.h / 2);
    if (delay) await p.waitForTimeout(delay);
    await p.close({ runBeforeUnload: false });
    const q = await context.newPage();
    await q.goto('/?test=1&renderer=canvas');
    await waitScene(q, 'Title');
    const s = await q.evaluate(() => JSON.parse(localStorage.getItem('game_save')));
    const owned = s.roster.length;
    const state = s.summon.total_pulls === 0 && s.currencies.cur_jade === 1000 ? 'none' : s.summon.total_pulls === 10 && s.summon.first_multi_done.banner_starter_001 === true ? 'all' : 'HALF';
    outcomes.push(`${delay}ms:${state}(jade ${s.currencies.cur_jade}, pulls ${s.summon.total_pulls}, roster ${owned})`);
    await q.close();
  }
  console.log('kill after Confirm:', outcomes.join(' | '));
  expect(outcomes.filter((o) => o.includes('HALF'))).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-11.10 setItem throws → "Summon failed — no Jade was spent.", nothing changed', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, withJade(1000));
  await toSummon(page);
  const before = await save(page);
  await page.evaluate(() => { const orig = Storage.prototype.setItem; window.__origSet = orig; Storage.prototype.setItem = function () { throw new Error('QuotaExceededError (QA)'); }; });
  await tap(page, 'summon_x1');
  await page.waitForTimeout(350);
  await tap(page, 'summon_confirm');
  await page.waitForTimeout(500);
  const sc = await screen(page);
  await shot(page, 'summon-save-failed');
  await page.evaluate(() => { Storage.prototype.setItem = window.__origSet; });
  const mem = await page.evaluate(() => window.__TEST__.save());
  console.log('save failed: error text', JSON.stringify(sc.error), 'scene', await page.evaluate(() => window.__TEST__.sceneKey));
  expect(sc.error).toBe('Summon failed — no Jade was spent.');
  expect(await page.evaluate(() => window.__TEST__.sceneKey)).toBe('Summon');
  delete before.updated_at; delete mem.updated_at;
  expect(mem, 'in-memory save unchanged').toEqual(before);
  // the button still works afterwards
  expect((await screen(page)).buttons[0].ok).toBe(true);
  // the toast must not be logged as a console error that hides other problems; a thrown setItem is expected here
  expect(errors.filter((e) => !/QuotaExceededError \(QA\)/.test(e)), errors.join('\n')).toEqual([]);
});

test('AC-11.4 rate table and AC-11.11 pity / first-×10 lines track the save', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, withJade(1000), '&renderer=canvas&summonSeed=5');
  await toSummon(page);
  let sc = await screen(page);
  expect(sc.pity).toBe('★5 guaranteed within 40 summons.');
  expect(sc.firstMulti).toBe('First ×10: at least one ★5 guaranteed!');
  await tap(page, 'summon_rates');
  await page.waitForTimeout(400);
  sc = await screen(page);
  const rates = Object.fromEntries(sc.rates.map((r) => [r.label.replace(/\s*\(featured\)/, ''), r.percent]));
  console.log('rates:', JSON.stringify(rates));
  expect(rates).toMatchObject({ R5: '3.00%', R4: '17.00%', R3: '80.00%', Solenne: '1.50%', Corvane: '1.50%', Pell: '5.67%', Thessa: '5.67%', Rook: '5.67%', Tavi: '26.67%', Lark: '26.67%', Dunmore: '26.67%' });
  expect(sc.rules.join(' ')).toContain('Fighter rates are rounded to 2 decimals.');
  await shot(page, 'summon-rates');
  await page.waitForTimeout(300);
  await tap(page, 'summon_rates_close');
  await page.waitForTimeout(300);
  // 3 ×1 pulls: the pity line must equal 40 − counter after each
  for (let i = 0; i < 3; i++) {
    await tap(page, 'summon_x1');
    await page.waitForTimeout(350);
    await tap(page, 'summon_confirm');
    await waitScene(page, 'SummonReveal');
    await page.waitForTimeout(350);
    await tap(page, 'summon_skip');
    await page.waitForTimeout(700);
    await shot(page, 'summon-results-x1-' + (i + 1));
    await page.waitForTimeout(300);
    await tap(page, 'summon_ok');
    await waitScene(page, 'Summon');
    const s = await save(page);
    sc = await screen(page);
    const n = Math.max(1, 40 - (s.summon.pity.standard || 0));
    expect(sc.pity, 'pity line after ×1 #' + (i + 1)).toBe(`★5 guaranteed within ${n} summons.`);
    expect(sc.firstMulti, 'three ×1 are not a ×10').toBe('First ×10: at least one ★5 guaranteed!');
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('abuse: rotate during the reveal goes to results without a re-summon; Jade 999,999 fits the top bar', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, withJade(999999), '&renderer=canvas&summonSeed=3');
  await toSummon(page);
  const scan0 = await scanTexts(page);
  const probs = layoutProblems(scan0, await targets(page));
  await shot(page, 'summon-jade-999999');
  console.log('Summon at 999,999 problems:', JSON.stringify(probs));
  expect(probs).toEqual([]);
  await tap(page, 'summon_x10');
  await page.waitForTimeout(350);
  await tap(page, 'summon_confirm');
  await waitScene(page, 'SummonReveal');
  const s1 = await save(page);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(900);
  await page.setViewportSize({ width: 360, height: 640 });
  await waitScene(page, 'SummonReveal');
  await page.waitForTimeout(600);
  const rv = await page.evaluate(() => window.__TEST__.summonReveal());
  const s2 = await save(page);
  console.log('after rotate during reveal: phase', rv.phase, 'pulls', s1.summon.total_pulls, '->', s2.summon.total_pulls, 'jade', s2.currencies.cur_jade);
  expect(rv.phase).toBe('results');
  expect(s2.summon.total_pulls).toBe(s1.summon.total_pulls);
  expect(s2.currencies.cur_jade).toBeLessThanOrEqual(999999);
  const scan = await scanTexts(page);
  const p2 = layoutProblems(scan, (await targets(page)).filter((t) => t.id === 'summon_ok'));
  await shot(page, 'summon-results-after-rotate');
  console.log('results grid problems:', JSON.stringify(p2));
  expect(p2).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('R-6 reveal shows Jade per pull (no spoiler of the final balance)', async ({ page }) => {
  const errors = watchErrors(page);
  const s = freshSave();
  s.currencies.cur_jade = 1000;
  s.summon.first_multi_done = { banner_starter_001: true };
  s.roster = ['char_tavi_001', 'char_lark_001', 'char_dunmore_001', 'char_pell_001', 'char_thessa_001', 'char_rook_001', 'char_solenne_001', 'char_corvane_001'].map((id) => ({ character_id: id, resonance: 4, obtained_at: s.created_at }));
  await boot(page, s, '&renderer=canvas&summonSeed=21');
  await toSummon(page);
  await tap(page, 'summon_x10');
  await page.waitForTimeout(350);
  await tap(page, 'summon_confirm');
  await page.waitForFunction(() => window.__TEST__.sceneKey === 'SummonReveal', null, { timeout: 10000 });
  if (process.env.QA_BREAK === 'spoil') await page.evaluate(() => { const sc = window.__TEST__.activeScene(); const f = sc.jadeAt.bind(sc); sc.jadeAt = () => f(1e9); });
  const samples = await page.evaluate(async () => {
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 25000) {
      const r = window.__TEST__.summonReveal && window.__TEST__.summonReveal();
      if (r) { const last = out[out.length - 1]; if (!last || last.index !== r.index || last.jade !== r.jadeShown) out.push({ index: r.index, jade: r.jadeShown, phase: r.phase }); if (r.phase === 'results') break; }
      await new Promise((res) => setTimeout(res, 40));
    }
    return out;
  });
  const final = (await save(page)).currencies.cur_jade;
  const vals = samples.filter((x) => typeof x.jade === 'number').map((x) => x.jade);
  console.log(`R-6 jade shown per pull: ${JSON.stringify(samples.map((x) => x.index + ':' + x.jade))} final saved ${final}`);
  expect(new Set(vals).size, 'the balance steps up pull by pull (> 3 distinct values)').toBeGreaterThan(3);
  const firstFinal = samples.find((x) => x.jade === final);
  expect(firstFinal && firstFinal.index, 'the final balance appears only once the last pull (index 9) is revealed').toBeGreaterThanOrEqual(9);
  for (let i = 1; i < vals.length; i++) expect(vals[i], 'non-decreasing').toBeGreaterThanOrEqual(vals[i - 1]);
  expect(vals[vals.length - 1]).toBe(final);
  expect(errors, errors.join('\n')).toEqual([]);
});
