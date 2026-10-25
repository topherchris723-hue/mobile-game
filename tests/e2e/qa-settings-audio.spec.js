// QA round 4: Settings (§19 AC-19.1–19.6) and audio gates (§18 AC-18.2, AC-18.7) in the browser, with abuse cases
// (double taps on every settings control, reload persistence). Negative proofs via QA_BREAK (see each test).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { boot, waitScene, tap, target, targets, shot, freshSave, clearedSave, watchErrors, scanTexts, layoutProblems } from './qa-helpers.js';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'runs once (360×640)');
});

const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('game_save')));
const ss = (page) => page.evaluate(() => window.__TEST__.settingsScreen());
const audio = (page) => page.evaluate(() => window.__TEST__.audioDebug());
const BRK = process.env.QA_BREAK || '';

/** Settings target ids derived from source: literal button ids in SettingsScene.js, 3 per VOLUME_KEYS entry
 *  (− / slider / +), one per toggleRow('<key>') call. QA_BREAK=count drops one to prove the check can fail. */
function expectedSettingsTargets() {
  const src = fs.readFileSync('src/scenes/SettingsScene.js', 'utf8');
  const view = fs.readFileSync('src/ui/settings-view.js', 'utf8');
  const literal = [...src.matchAll(/this\.button\(\{\s*id:\s*'([a-z_]+)',/g)].map((m) => m[1]); // literal ids only, not 'settings_' + key
  const vol = JSON.parse(view.match(/export const VOLUME_KEYS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const toggles = [...src.matchAll(/this\.toggleRow\('([a-z_]+)'/g)].map((m) => 'settings_' + m[1]);
  const ids = [...literal, ...vol.flatMap((k) => ['settings_' + k + '_minus', 'settings_' + k + '_slider', 'settings_' + k + '_plus']), ...toggles];
  return BRK === 'count' ? ids.slice(1) : ids;
}

async function dbl(page, id, gap = 60) {
  const tg = await target(page, id);
  await page.touchscreen.tap(tg.x + tg.w / 2, tg.y + tg.h / 2);
  await page.waitForTimeout(gap);
  await page.touchscreen.tap(tg.x + tg.w / 2, tg.y + tg.h / 2);
}

async function openSettingsFromHome(page) {
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_settings');
  await waitScene(page, 'Settings');
  await page.waitForTimeout(300); // past the 250 ms arm
}

test('AC-18.2 no audio before the first gesture; one tap → context running + menu track', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1&renderer=canvas');
  await page.waitForFunction(() => window.__TEST__ && window.__TEST__.sceneKey === 'Title', null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  // QA_BREAK=gesture: a real tap happens before the "before" check, so it must FAIL.
  if (BRK === 'gesture') await page.touchscreen.tap(180, 200);
  await page.waitForTimeout(200);
  const before = await audio(page);
  console.log('before gesture:', JSON.stringify(before));
  expect(before.contextState === 'running', 'no running AudioContext before a gesture').toBe(false);
  expect(before.soundsStarted || 0, '0 sounds before a gesture').toBe(0);
  expect(before.track, 'no music before a gesture').toBeFalsy();
  await page.touchscreen.tap(180, 200); // an empty spot on the Title screen
  await page.waitForFunction(() => window.__TEST__.audioDebug().contextState === 'running', null, { timeout: 5000 });
  await page.waitForTimeout(700);
  const after = await audio(page);
  console.log('after one tap:', JSON.stringify(after));
  expect(after.contextState).toBe('running');
  expect(after.track).toBe('bgm_menu_01');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-18.7 background during battle suspends audio and pauses; visible again resumes audio, battle stays paused', async ({ page }) => {
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
  const a0 = await audio(page);
  expect(a0.contextState, 'precondition: audio running in battle').toBe('running');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(600);
  const a1 = await audio(page);
  const b1 = await page.evaluate(() => window.__TEST__.battleState());
  await page.waitForTimeout(500);
  const b1b = await page.evaluate(() => window.__TEST__.battleState());
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(600);
  const a2 = await audio(page);
  const b2 = await page.evaluate(() => window.__TEST__.battleState());
  console.log(`background: ctx ${a0.contextState} → ${a1.contextState} → ${a2.contextState}; paused ${b1.paused} → ${b2.paused}; timer ${b1.timer.ticksLeft} → ${b1b.timer.ticksLeft} → ${b2.timer.ticksLeft}`);
  expect(a1.contextState).toBe('suspended');
  expect(b1.paused).toBe(true);
  expect(b1b.timer.ticksLeft).toBe(b1.timer.ticksLeft);
  expect(a2.contextState).toBe('running');
  expect(b2.paused, 'battle stays paused after returning').toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-19.1 entry points + AC-19.2 layout (and double taps on gear / Back)', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(1));
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await dbl(page, 'home_settings');
  await waitScene(page, 'Settings');
  await page.waitForTimeout(300);
  expect((await ss(page)).from).toBe('Home');
  const tgs = await targets(page);
  const scan = await scanTexts(page);
  // QA_BREAK=small: pretend the Music − button is 40 px wide → AC-19.2 check must FAIL.
  const tg2 = BRK === 'small' ? tgs.map((t) => (t.id === 'settings_bgm_volume_minus' ? { ...t, logical: { ...t.logical, w: 40 } } : t)) : tgs;
  const probs = layoutProblems(scan, tg2);
  await shot(page, 'r4-settings-360');
  console.log('settings targets:', tgs.map((t) => `${t.id} ${t.logical.w}x${t.logical.h}`).join(', '), '| problems:', JSON.stringify(probs));
  // R-5 / L-qa-007: expected targets come from the source, never a literal count.
  const exp = expectedSettingsTargets();
  console.log('expected from source:', exp.join(','));
  expect(tgs.map((t) => t.id).sort(), 'Settings targets = ids derived from SettingsScene.js + VOLUME_KEYS').toEqual(exp.slice().sort());
  expect(probs).toEqual([]);
  await dbl(page, 'back');
  await waitScene(page, 'Home');
  const scenes = await page.evaluate(() => window.__TEST__.game.scene.getScenes(true).map((s) => s.scene.key));
  expect(scenes).toEqual(['Home']);
  // Pause → Settings → Back
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await tap(page, 'stage_stage_002');
  await waitScene(page, 'Dialogue');
  await tap(page, 'dialogue_skip');
  await waitScene(page, 'Team');
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  await tap(page, 'battle_pause');
  await page.waitForTimeout(350);
  const t0 = (await page.evaluate(() => window.__TEST__.battleState())).timer.ticksLeft;
  await shot(page, 'r4-pause-menu');
  await tap(page, 'menu_settings');
  await waitScene(page, 'Settings');
  await page.waitForTimeout(1200);
  expect((await ss(page)).from).toBe('Battle');
  const mid = await page.evaluate(() => window.__TEST__.battleState());
  await shot(page, 'r4-settings-from-battle');
  await dbl(page, 'back');
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ st: window.__TEST__.battleState(), tg: window.__TEST__.targets().map((t) => t.id), active: window.__TEST__.game.scene.getScenes(true).map((s) => s.scene.key) }));
  console.log(`pause→settings→back: timer ${t0} → ${mid.timer.ticksLeft} → ${after.st.timer.ticksLeft}; paused ${mid.paused}/${after.st.paused}; active ${after.active}; menu targets ${after.tg.filter((x) => x.startsWith('menu_'))}`);
  expect(mid.paused).toBe(true);
  expect(mid.timer.ticksLeft).toBe(t0);
  expect(after.st.timer.ticksLeft).toBe(t0);
  expect(after.st.paused).toBe(true);
  expect(after.active).toEqual(['Battle']);
  expect(after.tg).toContain('menu_resume');
  // pause-menu order (R4-4): Resume, Settings, Retreat top→bottom; none covers the Pause button
  const ids = ['menu_resume', 'menu_settings', 'menu_retreat'];
  const ys = [];
  for (const id of ids) ys.push((await target(page, id)).y);
  expect(ys[0] < ys[1] && ys[1] < ys[2]).toBe(true);
  const p = await target(page, 'battle_pause');
  for (const id of ids) { const m = await target(page, id); expect(m.y + m.h <= p.y || m.y >= p.y + p.h || m.x + m.w <= p.x || m.x >= p.x + p.w, id + ' must not cover Pause').toBe(true); }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-19.3 Music − ×3 → 70% with 3 writes, reload keeps 70%; drag 70% → 20% writes once', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, freshSave());
  await openSettingsFromHome(page);
  for (let i = 1; i <= 3; i++) {
    await tap(page, 'settings_bgm_volume_minus');
    await page.waitForTimeout(150);
    const s = await save(page);
    expect(s.settings.bgm_volume, 'saved after tap ' + i).toBeCloseTo(1 - 0.1 * i, 5);
  }
  let v = await ss(page);
  expect(v.values.bgm_volume).toBe(70);
  expect(v.writes).toBe(3);
  await page.reload();
  await page.waitForFunction(() => window.__TEST__ && window.__TEST__.sceneKey === 'Title', null, { timeout: 15000 });
  await openSettingsFromHome(page);
  v = await ss(page);
  expect(v.values.bgm_volume, 'reload keeps 70%').toBe(70);
  // drag the Music slider from its thumb (70%) to 20% with real touch events and several moves
  const tr = await target(page, 'settings_bgm_volume_slider');
  const y = tr.y + tr.h / 2;
  const x0 = tr.x + tr.w * 0.7;
  const x1 = tr.x + tr.w * 0.2;
  await page.evaluate(async ({ x0, x1, y }) => {
    const c = window.__TEST__.game.canvas;
    const mk = (x) => new Touch({ identifier: 11, target: c, clientX: x, clientY: y, pageX: x, pageY: y });
    const f = (type, t, l) => c.dispatchEvent(new TouchEvent(type, { touches: l, targetTouches: l, changedTouches: [t], bubbles: true, cancelable: true }));
    const a = mk(x0); f('touchstart', a, [a]);
    for (let i = 1; i <= 10; i++) { await new Promise((r) => setTimeout(r, 40)); const m = mk(x0 + ((x1 - x0) * i) / 10); f('touchmove', m, [m]); }
    const e = mk(x1); f('touchend', e, []);
  }, { x0, x1, y });
  await page.waitForTimeout(300);
  v = await ss(page);
  const s = await save(page);
  console.log(`drag 70→20: shown ${v.values.bgm_volume}%, writes this screen ${v.writes}, saved ${s.settings.bgm_volume}`);
  expect(v.values.bgm_volume).toBe(20);
  expect(s.settings.bgm_volume).toBeCloseTo(0.2, 5);
  expect(v.writes, 'one write for the whole drag').toBe(1);
  // double tap on − = 2 steps, 2 writes, shown = saved
  await dbl(page, 'settings_bgm_volume_minus', 80);
  await page.waitForTimeout(200);
  v = await ss(page);
  const s2 = await save(page);
  console.log(`double tap −: shown ${v.values.bgm_volume}%, saved ${s2.settings.bgm_volume}, writes ${v.writes}`);
  expect(Math.round(s2.settings.bgm_volume * 100)).toBe(v.values.bgm_volume);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-19.4 Mute all: gains 0 with sliders unchanged; un-mute restores; double tap on the toggle stays consistent', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, freshSave());
  await openSettingsFromHome(page);
  await tap(page, 'settings_master_volume_minus'); // master 0.9 → gains not trivially 1
  await page.waitForTimeout(150);
  const g0 = await audio(page);
  const v0 = await ss(page);
  await tap(page, 'settings_muted');
  await page.waitForTimeout(150);
  const g1 = await audio(page);
  const v1 = await ss(page);
  await shot(page, 'r4-settings-muted');
  await tap(page, 'settings_muted');
  await page.waitForTimeout(150);
  const g2 = await audio(page);
  console.log(`mute: sfx ${g0.sfxBusGain} → ${g1.sfxBusGain} → ${g2.sfxBusGain}; bgm ${g0.bgmBusGain} → ${g1.bgmBusGain} → ${g2.bgmBusGain}; sliders ${JSON.stringify(v0.values)} / ${JSON.stringify(v1.values)}`);
  expect(g0.sfxBusGain).toBeGreaterThan(0);
  expect(g1.sfxBusGain).toBe(0);
  expect(g1.bgmBusGain).toBe(0);
  expect(v1.values).toEqual(v0.values);
  expect(g2.sfxBusGain).toBeCloseTo(g0.sfxBusGain, 9);
  expect(g2.bgmBusGain).toBeCloseTo(g0.bgmBusGain, 9);
  expect(g0.sfxBusGain, 'AC-18.3 math: master 0.9² × sfx 1² = 0.81').toBeCloseTo(0.81, 6);
  // double tap the toggle: shown state == saved state, two writes
  const w = (await ss(page)).writes;
  await dbl(page, 'settings_muted', 80);
  await page.waitForTimeout(200);
  const v3 = await ss(page);
  const s3 = await save(page);
  expect(v3.toggles.muted).toBe(s3.settings.muted);
  expect(v3.writes - w).toBe(2);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-19.5 Reduce motion toggled in Settings survives reload and gives 0 shakes / 0 flashes in the next battle', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(4));
  await openSettingsFromHome(page);
  await tap(page, 'settings_reduce_motion');
  await page.waitForTimeout(200);
  expect((await save(page)).settings.reduce_motion).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.__TEST__ && window.__TEST__.sceneKey === 'Title', null, { timeout: 15000 });
  expect((await save(page)).settings.reduce_motion, 'survives reload').toBe(true);
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
  await page.evaluate(() => {
    const T = window.__TEST__; const sc = T.game.scene.getScene('Battle');
    T.qa = { flashes: 0, shakes: 0 };
    const proto = Object.getPrototypeOf(sc.cameras.main);
    if (!proto.__qa2) { const f = proto.flash; const s = proto.shake; proto.flash = function (...a) { T.qa.flashes++; return f.apply(this, a); }; proto.shake = function (...a) { T.qa.shakes++; return s.apply(this, a); }; proto.__qa2 = true; }
    sc.battle.controllers.enemy = null;
  });
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  // QA_BREAK=motion: switch reduce motion off in the live VFX layer → shakes/flashes appear → must FAIL.
  if (BRK === 'motion') await page.evaluate(() => window.__TEST__.game.scene.getScene('Battle').vfx.setReduceMotion(false));
  await page.evaluate(() => { window.__TEST__.game.scene.getScene('Battle').battle.activeFighter('player').ign.available = true; });
  await page.waitForFunction(() => window.__TEST__.battleState().teams.player.igniteReady, null, { timeout: 10000 });
  await tap(page, 'ignite');
  await page.waitForFunction(() => window.__TEST__.battleState().teams.player.fighters.some((f) => f.ignition.active), null, { timeout: 10000 });
  await page.waitForTimeout(2500);
  const q = await page.evaluate(() => window.__TEST__.qa);
  console.log('reduce motion via Settings: camera flashes', q.flashes, 'shakes', q.shakes);
  expect(q.flashes).toBe(0);
  expect(q.shakes).toBe(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-19.6 Vibration off → navigator.vibrate never called in battle; on → preview 20 and battle calls (20 hit, 80 Ignition)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => { window.__vib = []; const spy = (ms) => { window.__vib.push(ms); return true; }; Object.defineProperty(navigator, 'vibrate', { configurable: true, get: () => spy, set: () => {} }); /* Phaser assigns navigator.vibrate at boot: keep the spy */ });
  const s = clearedSave(1);
  s.settings.haptics = false;
  await boot(page, s);
  async function battleRun() {
    await tap(page, 'home_story');
    await waitScene(page, 'Story');
    await tap(page, 'stage_stage_002');
    await waitScene(page, 'Dialogue');
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
    await tap(page, 'team_fight');
    await waitScene(page, 'Battle');
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    await page.evaluate(() => { window.__vib = []; window.__TEST__.eventLog = []; }); // eventLog survives across battles
    // wait until the player is hit at least once (enemy AI on), then force an Ignition
    await page.waitForFunction(() => (window.__TEST__.eventLog || []).some((e) => e.type === 'hit' && e.side === 'enemy'), null, { timeout: 30000 });
    await page.evaluate(() => { window.__TEST__.game.scene.getScene('Battle').battle.activeFighter('player').ign.available = true; });
    await page.waitForFunction(() => window.__TEST__.battleState().teams.player.igniteReady, null, { timeout: 15000 });
    await tap(page, 'ignite');
    await page.waitForFunction(() => window.__TEST__.battleState().teams.player.fighters.some((f) => f.ignition.active), null, { timeout: 10000 });
    await page.waitForTimeout(500);
    const calls = await page.evaluate(() => window.__vib.slice());
    await tap(page, 'battle_pause');
    await page.waitForTimeout(350);
    await tap(page, 'menu_retreat');
    await page.waitForTimeout(350);
    await tap(page, 'menu_retreat_yes');
    await waitScene(page, 'Result');
    await tap(page, 'result_to_story');
    await waitScene(page, 'Story');
    await tap(page, 'back');
    await waitScene(page, 'Home');
    return calls;
  }
  await tap(page, 'start');
  await waitScene(page, 'Home');
  const off = await battleRun();
  await tap(page, 'home_settings');
  await waitScene(page, 'Settings');
  await page.waitForTimeout(300);
  await page.evaluate(() => (window.__vib = []));
  await tap(page, 'settings_haptics');
  await page.waitForTimeout(150);
  const preview = await page.evaluate(() => window.__vib.slice());
  await tap(page, 'back');
  await waitScene(page, 'Home');
  const on = await battleRun();
  console.log(`vibrate calls: off=${JSON.stringify(off)} preview=${JSON.stringify(preview)} on=${JSON.stringify(on)}`);
  expect(off, 'Vibration off → never called').toEqual([]);
  expect(preview).toEqual([20]);
  expect(on).toContain(20);
  expect(on).toContain(80);
  expect(on.every((ms) => [20, 40, 80].includes(ms))).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});
