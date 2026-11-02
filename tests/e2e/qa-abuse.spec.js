// QA round 2: save persistence (AC-12.1, AC-13.1, AC-13.2, GDD §13), abuse cases (double taps, taps during
// intro/cinematics, backgrounding, rotate/resize, reload mid-flow), AC-5.2.3, AC-4.1, zero console errors.
// Runs in the 360×640 project only (layout at other sizes is covered by qa-screens.spec.js).
import { test, expect } from '@playwright/test';
import { boot, waitScene, tap, target, shot, battle, freshSave, clearedSave, watchErrors, DATA } from './qa-helpers.js';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'abuse cases run once');
});

const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('game_save')));

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
}

async function swipeAt(page, x, y, dx, dy) {
  await page.evaluate(async ({ x, y, dx, dy }) => {
    const canvas = window.__TEST__.game.canvas;
    const mk = (cx, cy) => new Touch({ identifier: 3, target: canvas, clientX: cx, clientY: cy, pageX: cx, pageY: cy });
    const fire = (type, t, list) => canvas.dispatchEvent(new TouchEvent(type, { touches: list, targetTouches: list, changedTouches: [t], bubbles: true, cancelable: true }));
    const a = mk(x, y);
    fire('touchstart', a, [a]);
    await new Promise((r) => setTimeout(r, 30));
    const b = mk(x + dx / 2, y + dy / 2);
    fire('touchmove', b, [b]);
    await new Promise((r) => setTimeout(r, 30));
    const c = mk(x + dx, y + dy);
    fire('touchmove', c, [c]);
    fire('touchend', c, []);
  }, { x, y, dx, dy });
}

test('AC-12.1 fresh save; AC-13.1 win stage_001 → reload → cleared + Jade; reload during Result delay', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, null);
  const s0 = await save(page);
  expect(s0.currencies.cur_jade).toBe(1000);
  expect(s0.roster.map((r) => r.character_id).sort()).toEqual(DATA.economy.starting.characters.slice().sort());
  await toBattle(page, 'stage_001');
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  // QA shortcut: the single enemy is set to 1 HP, then the player taps cards until it falls.
  await page.evaluate(() => (window.__TEST__.game.scene.getScene('Battle').battle.teams.enemy.fighters[0].hp = 1));
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const st = await battle(page);
    if (!st || st.result) break;
    const f = st.teams.player.fighters[st.teams.player.activeSlot];
    const i = f.hand.findIndex((c) => c && c.playable);
    if (i >= 0) await tap(page, 'card_' + i);
    await page.waitForTimeout(150);
  }
  // Reload inside the 1.4 s result delay: the result must already be saved.
  await page.waitForFunction(() => window.__TEST__.battleState().result, null, { timeout: 5000 });
  await page.reload();
  await waitScene(page, 'Title');
  const s1 = await save(page);
  expect(s1.stages.stage_001.cleared).toBe(true);
  expect(s1.stages.stage_001.clears).toBe(1);
  expect(s1.tutorial.completed).toBe(true);
  const missionJade = s1.stages.stage_001.missions_completed.length * 50;
  expect(s1.currencies.cur_jade).toBe(1000 + 300 + missionJade);
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  expect((await target(page, 'stage_stage_002')).enabled).toBe(true);
  await shot(page, 'abuse-ac13.1-story-after-reload');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-13.2 corrupt / future-version save → fresh save + backup key + notice, no crash', async ({ page }) => {
  const errors = watchErrors(page);
  for (const bad of ['{garbage', JSON.stringify({ ...freshSave(), version: 99 }), JSON.stringify({ ...freshSave(), currencies: { cur_jade: 'lots' } })]) {
    await boot(page, bad);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.some((k) => k.startsWith('game_save_corrupt_')), 'backup key for ' + bad.slice(0, 30)).toBe(true);
    const s = await save(page);
    expect(s.currencies.cur_jade).toBe(1000);
    await tap(page, 'start');
    await waitScene(page, 'Home');
    const toast = await page.evaluate(() => window.__TEST__.activeScene().children.list.some((o) => o.list && o.list.some((c) => c.type === 'Text' && /damaged/.test(c.text))));
    expect(toast, 'damaged-save notice on Home').toBe(true);
  }
  await shot(page, 'abuse-ac13.2-home-damaged-notice');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('GDD §13: save with a team id that no longer exists in the data is ignored, not a crash', async ({ page }) => {
  const errors = watchErrors(page);
  const s = freshSave();
  s.team = ['char_tavi_001', 'char_lark_001', 'char_removed_099'];
  s.roster.push({ character_id: 'char_removed_099', resonance: 0, obtained_at: s.created_at });
  await boot(page, s);
  await tap(page, 'start');
  await page.waitForTimeout(1500);
  const scene = await page.evaluate(() => window.__TEST__.sceneKey);
  await shot(page, 'abuse-save-unknown-team-id');
  console.log('scene after start with unknown team id:', scene, 'errors:', errors.join(' | '));
  expect(errors, errors.join('\n')).toEqual([]);
  expect(scene).toBe('Home');
});

test('GDD §13: save whose team holds a fighter that is not owned', async ({ page }) => {
  const errors = watchErrors(page);
  const s = freshSave();
  s.team = ['char_corvane_001', 'char_lark_001', 'char_dunmore_001']; // corvane not in roster
  await boot(page, s);
  const loaded = await save(page);
  const kept = loaded.team.includes('char_corvane_001');
  console.log('unowned team member kept after load:', kept, JSON.stringify(loaded.team));
  expect(errors).toEqual([]);
  expect(kept, 'team must only hold owned fighters (save.schema: "3 owned fighters ... checked in code")').toBe(false);
});

test('abuse: double taps on every navigation button land on one scene, no errors', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(1));
  const dbl = async (id) => {
    const tg = await target(page, id);
    const x = tg.x + tg.w / 2;
    const y = tg.y + tg.h / 2;
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
  };
  const starts = [];
  await page.evaluate(() => {
    window.__starts = [];
    const g = window.__TEST__.game;
    for (const sc of g.scene.scenes) sc.events.on('create', () => window.__starts.push(sc.scene.key));
  });
  await dbl('start');
  await waitScene(page, 'Home');
  await dbl('home_story');
  await waitScene(page, 'Story');
  await dbl('stage_stage_002');
  await waitScene(page, 'Dialogue');
  for (let i = 0; i < 25; i++) await page.touchscreen.tap(180, 200); // spam-advance the story
  await waitScene(page, 'Team');
  await dbl('team_fight');
  await waitScene(page, 'Battle');
  await page.waitForTimeout(800);
  const active = await page.evaluate(() => window.__TEST__.game.scene.getScenes(true).map((s) => s.scene.key));
  starts.push(...(await page.evaluate(() => window.__starts)));
  console.log('scene creates:', starts.join(' > '), 'active now:', active.join(','));
  expect(active).toEqual(['Battle']);
  expect(starts).toEqual(['Home', 'Story', 'Dialogue', 'Team', 'Battle']);
  // double tap a card: one card_played
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  await page.waitForFunction(() => { const s = window.__TEST__.battleState(); return s.teams.player.fighters[s.teams.player.activeSlot].hand.some((c) => c && c.playable && c.cost <= 2); }, null, { timeout: 15000 }).catch(() => {});
  const st = await battle(page);
  const f = st.teams.player.fighters[st.teams.player.activeSlot];
  const i = Math.max(0, f.hand.findIndex((c) => c && c.playable));
  await page.evaluate(() => (window.__TEST__.eventLog = []));
  await dbl('card_' + i);
  await page.waitForTimeout(400);
  const played = await page.evaluate(() => window.__TEST__.eventLog.filter((e) => e.type === 'card_played' && e.side === 'player').length);
  expect(played, 'one double tap = at most one card').toBeLessThanOrEqual(1);
  // double tap pause; double tap resume
  await dbl('battle_pause');
  await page.waitForTimeout(300);
  expect((await battle(page)).paused).toBe(true);
  await dbl('menu_resume');
  await page.waitForTimeout(300);
  expect((await battle(page)).paused).toBe(false);
  // retreat flow with double taps: exactly one Result
  await tap(page, 'battle_pause');
  await page.waitForTimeout(250);
  await dbl('menu_retreat');
  await page.waitForTimeout(400);
  // GDD §5.14: Retreat must be confirmed with a dialog. A double tap on "Retreat" must not also confirm it.
  const afterDbl = await battle(page);
  const confirmShown = await page.evaluate(() => window.__TEST__.targets().some((t) => t.id === 'menu_retreat_yes'));
  console.log('after double tap on Retreat: result=', JSON.stringify(afterDbl && afterDbl.result && afterDbl.result.reason), 'confirm shown=', confirmShown);
  expect.soft(afterDbl.result, 'double tap on Retreat skipped the confirm dialog').toBeNull();
  if (confirmShown) await tap(page, 'menu_retreat_yes');
  await waitScene(page, 'Result');
  await dbl('result_retry');
  await waitScene(page, 'Battle');
  const after = await page.evaluate(() => window.__starts);
  console.log('after retry:', after.join(' > '));
  expect(after.filter((k) => k === 'Result').length).toBe(1);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('abuse: taps during intro and Ignition cinematic do nothing; backgrounding during cinematic pauses', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(1));
  await toBattle(page, 'stage_002');
  // intro: tap all cards and swipe
  const st0 = await battle(page);
  expect(st0.phase).toBe('intro');
  await page.evaluate(() => (window.__TEST__.eventLog = []));
  for (let i = 0; i < 4; i++) await tap(page, 'card_' + i);
  const intro = await page.evaluate(() => window.__TEST__.eventLog.filter((e) => e.type === 'card_played').length);
  expect(intro, 'cards played during intro').toBe(0);
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  // force Ignition available for Tavi (QA shortcut) and use it
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.activeFighter('player').ign.available = true; });
  await page.waitForTimeout(200);
  await tap(page, 'ignite');
  await page.waitForFunction(() => { const s = window.__TEST__.battleState(); return s.freeze && s.freeze.kind === 'ignition'; }, null, { timeout: 3000 });
  await shot(page, 'abuse-ignition-cinematic');
  const v0 = (await battle(page)).teams.player.vigor;
  await page.evaluate(() => (window.__TEST__.eventLog = []));
  for (let i = 0; i < 4; i++) await tap(page, 'card_' + i);
  await tap(page, 'bench_0');
  await swipeAt(page, 180, 590, 0, -60);
  const during = await battle(page);
  // background mid-cinematic
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  const bg = await battle(page);
  expect(bg.paused, 'backgrounding during cinematic pauses').toBe(true);
  await page.waitForTimeout(800);
  expect((await battle(page)).freeze.ticksLeft).toBe(bg.freeze.ticksLeft);
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }));
  await tap(page, 'menu_resume');
  await page.waitForFunction(() => !window.__TEST__.battleState().freeze, null, { timeout: 5000 });
  await page.waitForTimeout(100);
  const evs = await page.evaluate(() => window.__TEST__.eventLog.map((e) => e.type + ':' + (e.side || '')));
  const playerActions = evs.filter((e) => /^(card_played|tag|slip):player/.test(e));
  console.log('player actions from taps during cinematic:', playerActions.join(','), 'vigor during', during.teams.player.vigor, 'before', v0);
  expect(playerActions, 'taps during the cinematic must not act later').toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('abuse: rotate to landscape and back mid-battle (pause menu open and closed), Dialogue keeps its line', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(1));
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await tap(page, 'stage_stage_002');
  await waitScene(page, 'Dialogue');
  await tap(page, 'dialogue_next');
  await tap(page, 'dialogue_next');
  await page.waitForTimeout(200);
  const line0 = await page.evaluate(() => window.__TEST__.activeScene().lineIndex);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(800);
  await shot(page, 'abuse-rotate-dialogue-landscape');
  await page.setViewportSize({ width: 360, height: 640 });
  await waitScene(page, 'Dialogue');
  const line1 = await page.evaluate(() => window.__TEST__.activeScene().lineIndex);
  expect(line1, 'dialogue line kept across rotation').toBe(line0);
  await tap(page, 'dialogue_skip');
  await waitScene(page, 'Team');
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const b0 = await battle(page);
  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(800);
  await waitScene(page, 'Battle');
  await shot(page, 'abuse-rotate-battle-landscape');
  const b1 = await battle(page);
  expect(b1.tick, 'battle continues (not restarted) after rotation').toBeGreaterThanOrEqual(b0.tick);
  // the GDD is portrait-only: in landscape the game must still fit inside the viewport
  const fit = await page.evaluate(() => { const r = window.__TEST__.game.canvas.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, left: r.left }; });
  expect(fit.h).toBeLessThanOrEqual(360.5);
  // pause, rotate back with the menu open
  await tap(page, 'battle_pause');
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(800);
  await waitScene(page, 'Battle');
  const b2 = await battle(page);
  expect(b2.paused, 'still paused after rotating with menu open').toBe(true);
  const menuShown = await page.evaluate(() => window.__TEST__.targets().some((t) => t.id === 'menu_resume'));
  expect(menuShown, 'pause menu visible after rotation').toBe(true);
  await shot(page, 'abuse-rotate-back-paused');
  await tap(page, 'menu_resume');
  await page.waitForTimeout(500);
  expect((await battle(page)).paused).toBe(false);
  // gestures still work after the restart
  await page.evaluate(() => (window.__TEST__.inputLog = []));
  await swipeAt(page, 140, 590, 80, 0);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__TEST__.inputLog)).toEqual([{ type: 'dash', dir: 'forward' }]);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('abuse: reload mid-battle keeps the save intact (no result, no Jade change); AC-5.2.3 diagonal swipe = Slip; swipe from Pause ignored', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(1));
  const before = await save(page);
  await toBattle(page, 'stage_002');
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  await page.evaluate(() => (window.__TEST__.inputLog = []));
  await swipeAt(page, 180, 590, 30, -30);
  await page.waitForTimeout(150);
  const pause = await target(page, 'battle_pause');
  await swipeAt(page, pause.x + 22, pause.y + 22, -60, 0);
  await page.waitForTimeout(150);
  const inputs = await page.evaluate(() => window.__TEST__.inputLog);
  expect(inputs, 'AC-5.2.3 diagonal = slip; swipe starting on Pause ignored').toEqual([{ type: 'slip' }]);
  await page.reload();
  await waitScene(page, 'Title');
  const after = await save(page);
  delete before.updated_at;
  delete after.updated_at;
  expect(after).toEqual(before);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-4.1 every screen reachable and back to Home without restart', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(1));
  await tap(page, 'start');
  await waitScene(page, 'Home');
  for (const [btn, scene] of [['home_story', 'Story'], ['home_team', 'Team']]) {
    await tap(page, btn);
    await waitScene(page, scene);
    await tap(page, 'back');
    await waitScene(page, 'Home');
  }
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await tap(page, 'stage_stage_001');
  await waitScene(page, 'Dialogue');
  await tap(page, 'back');
  await waitScene(page, 'Story');
  await tap(page, 'stage_stage_001');
  await waitScene(page, 'Dialogue');
  await tap(page, 'dialogue_skip');
  await waitScene(page, 'Team');
  await tap(page, 'back');
  await waitScene(page, 'Story');
  await tap(page, 'back');
  await waitScene(page, 'Home');
  expect(errors, errors.join('\n')).toEqual([]);
});
