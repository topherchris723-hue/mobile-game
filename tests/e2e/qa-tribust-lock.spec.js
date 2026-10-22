// QA round 2 loop 2: Tri-Burst lock (GDD §5.0, §5.9 AC-5.9.7, §5.10 AC-5.10.4/5/6) from the PLAYER's side, in the
// browser with real taps. The logic is slowed to 5% via the scene's speed hook (QA test shim in place of the
// tutorial controller) so the 18-tick rush lasts ~6 s of real time and real taps can land inside it.
import { test, expect } from '@playwright/test';
import { boot, waitScene, tap, target, shot, battle, clearedSave, watchErrors } from './qa-helpers.js';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'runs once');
});

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
}

const slow = (page, speed) => page.evaluate((sp) => {
  const sc = window.__TEST__.game.scene.getScene('Battle');
  sc.tutorial = sp === 1 ? null : { speed: () => sp, handleEvents() {}, handleState() {}, active: null };
}, speed);

const rejects = (page, type) => page.evaluate((ty) => window.__TEST__.eventLog.filter((e) => e.type === 'input_rejected' && e.side === 'player' && e.input.type === ty).map((e) => e.reason), type);

test('player: IGNITE during own Tri-Burst rush is rejected (not_now) and greyed; rush resolves on T+18 and knocks down', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(2));
  await toBattle(page, 'stage_003');
  await page.evaluate(() => {
    const b = window.__TEST__.game.scene.getScene('Battle').battle;
    b.teams.player.burst = 100;
    b.activeFighter('player').ign.available = true; // Tavi: Ignition ready (QA shortcut)
    b.teams.player.x = 44; b.teams.enemy.x = 56;
    window.__TEST__.eventLog = [];
  });
  await page.waitForTimeout(300);
  expect((await battle(page)).teams.player.igniteReady, 'IGNITE available before the rush').toBe(true);
  await page.waitForFunction(() => { const s = window.__TEST__.battleState(); return s.teams.player.burstReady && s.teams.player.igniteReady && !s.freeze; }, null, { timeout: 15000 });
  await slow(page, 0.05);
  await tap(page, 'tri_burst');
  await page.waitForTimeout(400);
  const dbg = await page.evaluate(() => ({ log: window.__TEST__.eventLog.filter((e) => e.side === 'player' || e.type.startsWith('tri')).map((e) => e.type + '/' + (e.reason || '') + '/' + JSON.stringify(e.input || '')), st: (() => { const s = window.__TEST__.battleState(); const f = s.teams.player.fighters[s.teams.player.activeSlot]; return { state: f.state, burst: s.teams.player.burst, burstReady: s.teams.player.burstReady, freeze: s.freeze, inputs: window.__TEST__.inputLog }; })() }));
  console.log('DEBUG after TRI-BURST tap:', JSON.stringify(dbg));
  await page.waitForFunction(() => window.__TEST__.eventLog.some((e) => e.type === 'tri_burst_start' && e.side === 'player'), null, { timeout: 5000 });
  const st = await battle(page);
  expect(st.teams.player.igniteReady, 'igniteReady false during the rush').toBe(false);
  const ign = await target(page, 'ignite');
  console.log('IGNITE target during rush:', JSON.stringify(ign));
  await shot(page, 'tblock-player-rush-ignite-greyed');
  await tap(page, 'ignite');
  await page.waitForTimeout(150);
  await tap(page, 'ignite');
  await page.waitForFunction(() => window.__TEST__.eventLog.some((e) => (e.type === 'tri_burst' || e.type === 'tri_burst_whiff') && e.side === 'player'), null, { timeout: 15000 });
  const r = await rejects(page, 'ignite');
  const log = await page.evaluate(() => window.__TEST__.eventLog.map((e) => ({ type: e.type, side: e.side, tick: e.tick, reason: e.reason })));
  const start = log.find((e) => e.type === 'tri_burst_start');
  const res = log.find((e) => e.type === 'tri_burst' || e.type === 'tri_burst_whiff');
  console.log('player ignite rejects during own rush:', JSON.stringify(r), 'resolve', res.type, '@T+' + (res.tick - start.tick));
  expect(r.length, 'IGNITE taps reached the logic and were rejected').toBeGreaterThan(0);
  expect(r.every((x) => x === 'not_now')).toBe(true);
  expect(log.some((e) => e.type === 'ignition' && e.side === 'player'), 'no Ignition during the rush').toBe(false);
  expect(res.tick - start.tick).toBe(18);
  await slow(page, 1);
  // after the cinematic: target knocked down, gauge USED, IGNITE available again
  await page.waitForFunction(() => !window.__TEST__.battleState().freeze, null, { timeout: 10000 });
  const after = await battle(page);
  const e = after.teams.enemy.fighters[after.teams.enemy.activeSlot];
  console.log('after landed rush: enemy state', e.state, 'burstUsed', after.teams.player.burstUsed, 'igniteReady', after.teams.player.igniteReady);
  if (res.type === 'tri_burst' && !e.ko) expect(['Knockdown', 'Idle']).toContain(e.state);
  expect(after.teams.player.burstUsed).toBe(res.type === 'tri_burst');
  expect(after.teams.player.fighters[after.teams.player.activeSlot].ignition.used, 'Ignition not consumed by the rejected taps').toBe(false);
  await shot(page, 'tblock-player-after-rush');
  expect(errors, errors.join('\n')).toEqual([]);
});

test("player: TRI-BURST and IGNITE during the ENEMY's rush are rejected (not_now), gauge stays 100; Slip still allowed", async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, clearedSave(2));
  await toBattle(page, 'stage_003');
  await page.evaluate(() => {
    const sc = window.__TEST__.game.scene.getScene('Battle');
    const b = sc.battle;
    b.teams.player.burst = 100;
    b.teams.player.vigor = 6000 * 10;
    b.activeFighter('player').ign.available = true;
    b.teams.enemy.burst = 100;
    b.teams.player.x = 44; b.teams.enemy.x = 56;
    window.__TEST__.eventLog = [];
  });
  await slow(page, 0.05);
  await page.waitForTimeout(200);
  // QA shim: start the enemy's rush through the same input path the AI uses.
  await page.evaluate(() => window.__TEST__.game.scene.getScene('Battle').battle.applyInput('enemy', { type: 'tri_burst' }));
  const st = await battle(page);
  expect(st.teams.player.burstReady, 'TRI-BURST not ready while the enemy rushes').toBe(false);
  expect(st.teams.player.igniteReady, 'IGNITE not ready while the enemy rushes').toBe(false);
  await shot(page, 'tblock-enemy-rush-player-buttons');
  await tap(page, 'tri_burst');
  await page.waitForTimeout(120);
  await tap(page, 'ignite');
  await page.waitForTimeout(120);
  // Slip stays allowed (the intended counter)
  const pad = await page.evaluate(() => { const s = window.__TEST__.activeScene(); const r = window.__TEST__.game.canvas.getBoundingClientRect(); const k = r.width / s.W; return { x: r.left + 180 * k, y: r.top + ((s.L.swipePad.top + s.L.swipePad.bottom) / 2) * k }; });
  await page.evaluate(async ({ x, y }) => {
    const c = window.__TEST__.game.canvas;
    const mk = (cy) => new Touch({ identifier: 8, target: c, clientX: x, clientY: cy, pageX: x, pageY: cy });
    const f = (t, a, l) => c.dispatchEvent(new TouchEvent(t, { touches: l, targetTouches: l, changedTouches: [a], bubbles: true, cancelable: true }));
    const a = mk(y); f('touchstart', a, [a]); await new Promise((r) => setTimeout(r, 30)); const b = mk(y - 50); f('touchmove', b, [b]); f('touchend', b, []);
  }, pad);
  await page.waitForFunction(() => window.__TEST__.eventLog.some((e) => (e.type === 'tri_burst' || e.type === 'tri_burst_whiff') && e.side === 'enemy'), null, { timeout: 15000 });
  const tb = await rejects(page, 'tri_burst');
  const ig = await rejects(page, 'ignite');
  const log = await page.evaluate(() => window.__TEST__.eventLog.map((e) => e.type + ':' + e.side));
  console.log('player rejects during enemy rush: tri_burst', JSON.stringify(tb), 'ignite', JSON.stringify(ig), 'slip?', log.includes('slip:player'), 'resolve', log.find((x) => /^tri_burst(_whiff)?:enemy$/.test(x)));
  expect(tb).toEqual(['not_now']);
  expect(ig).toEqual(['not_now']);
  expect(log.includes('tri_burst_start:player')).toBe(false);
  expect(log.includes('slip:player'), 'Slip allowed during the enemy rush').toBe(true);
  await slow(page, 1);
  await page.waitForFunction(() => !window.__TEST__.battleState().freeze, null, { timeout: 10000 });
  const after = await battle(page);
  expect(after.teams.player.burst, 'player gauge unchanged by the rejected tap').toBe(100);
  expect(after.teams.player.burstUsed).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});
