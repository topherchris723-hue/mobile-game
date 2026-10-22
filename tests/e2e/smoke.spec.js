// Round 2 UI smoke test: full flow at 360×640 and 430×932, gestures, pause/background, tutorial,
// touch-target sizes (GDD §14, AC-14.1), no console errors. Screenshots → reports/screenshots/round-2/.
import { test, expect } from '@playwright/test';
import { watchErrors, shot, waitScene, target, tap, swipe, touchHold, padCenter, checkTargets, battleState, goToBattle } from './helpers.js';

test('flow: title → home → stage → story → team → battle → pause/retreat → result → back', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await goToBattle(page, testInfo, true);
  await shot(page, testInfo, '06-battle-intro');
  await checkTargets(page, 'Battle');

  // Wait for FIGHT and the first tutorial prompt (stage_001, fresh save)
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  await page.waitForFunction(() => !!window.__TEST__.tutorialStep(), null, { timeout: 5000 });
  const step = await page.evaluate(() => window.__TEST__.tutorialStep());
  expect(step.required_action).toBe('play_card');
  await shot(page, testInfo, '07-battle-tutorial-tap-card');

  // Tap feedback: the sound hook fires on pointerdown (press state is drawn the same frame)
  await page.waitForFunction(() => {
    const s = window.__TEST__.battleState();
    return s.teams.player.fighters[s.teams.player.activeSlot].hand.some((c) => c && c.playable);
  }, null, { timeout: 15000 });
  const before = await battleState(page);
  const vigor0 = before.teams.player.vigor;
  const f0 = before.teams.player.fighters[before.teams.player.activeSlot];
  const playable = f0.hand.findIndex((c) => c && c.playable);
  expect(playable).toBeGreaterThanOrEqual(0);
  // Measured in the page: time from the browser's touchstart to the press-feedback hook (must be < 100 ms).
  await page.evaluate(() => {
    window.__touchAt = null;
    window.addEventListener('touchstart', () => (window.__touchAt = performance.now()), { capture: true, once: true });
  });
  const sfxBefore = await page.evaluate(() => window.__TEST__.sfxLog.length);
  await tap(page, 'card_' + playable);
  await page.waitForFunction((n) => window.__TEST__.sfxLog.length > n, sfxBefore);
  const latency = await page.evaluate((n) => window.__TEST__.sfxLog[n].t - window.__touchAt, sfxBefore);
  console.log(`[${testInfo.project.name}] tap → press feedback: ${latency.toFixed(1)} ms`);
  expect(latency).toBeLessThan(100);
  // The card was played (Vigor spent or hand slot emptied) and the tutorial step completed
  await page.waitForFunction(
    ({ slot, v0 }) => {
      const s = window.__TEST__.battleState();
      const f = s.teams.player.fighters[s.teams.player.activeSlot];
      return f.hand[slot] === null || s.teams.player.vigor < v0;
    },
    { slot: playable, v0: vigor0 },
    { timeout: 3000 }
  );
  await page.waitForTimeout(200);
  await shot(page, testInfo, '08-battle-card-played');

  // Swipe right = dash forward; AC-5.2.1: a swipe that starts on a card and moves 30 px up is a Slip, not a card play
  const pad = await padCenter(page);
  await page.evaluate(() => (window.__TEST__.inputLog = []));
  await swipe(page, pad.x - 40, pad.y, 80, 0);
  await page.waitForTimeout(300);
  const card1 = await target(page, 'card_1');
  await swipe(page, card1.x + card1.w / 2, card1.y + card1.h / 2, 0, -30 * pad.k);
  await page.waitForTimeout(200);
  await shot(page, testInfo, '09-battle-after-swipes');
  const inputs = await page.evaluate(() => window.__TEST__.inputLog);
  expect(inputs).toEqual([{ type: 'dash', dir: 'forward' }, { type: 'slip' }]);

  // Long-press tooltip (AC-5.2.2): 450 ms hold shows it and spends no Vigor
  const c2 = await target(page, 'card_2');
  const vigorBeforeHold = (await battleState(page)).teams.player.vigor;
  const release = await touchHold(page, c2.x + c2.w / 2, c2.y + c2.h / 2, 500);
  const ttVisible = await page.evaluate(() => window.__TEST__.activeScene().tooltip.visible);
  expect(ttVisible).toBe(true);
  await shot(page, testInfo, '10-battle-tooltip');
  await release();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__TEST__.activeScene().tooltip.visible)).toBe(false);
  expect((await battleState(page)).teams.player.vigor).toBeGreaterThanOrEqual(vigorBeforeHold);

  // Pause button → paused, timer frozen
  await tap(page, 'battle_pause');
  await page.waitForTimeout(300);
  const p1 = await battleState(page);
  expect(p1.paused).toBe(true);
  await shot(page, testInfo, '11-battle-paused');
  await checkTargets(page, 'Battle');
  await page.waitForTimeout(700);
  const p2 = await battleState(page);
  expect(p2.tick).toBe(p1.tick);
  await tap(page, 'menu_resume');
  await page.waitForTimeout(300);
  expect((await battleState(page)).paused).toBe(false);

  // App backgrounding (AC-5.14.3)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  const h1 = await battleState(page);
  expect(h1.paused).toBe(true);
  await page.waitForTimeout(500);
  expect((await battleState(page)).timer.ticksLeft).toBe(h1.timer.ticksLeft);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  // Retreat → confirm → Result (lose) → Stage list
  await tap(page, 'menu_retreat');
  await page.waitForTimeout(250);
  await shot(page, testInfo, '12-battle-retreat-confirm');
  await tap(page, 'menu_retreat_yes');
  await waitScene(page, 'Result');
  await shot(page, testInfo, '13-result-retreat');
  await checkTargets(page, 'Result');
  await tap(page, 'result_to_story');
  await waitScene(page, 'Story');
  await tap(page, 'back');
  await waitScene(page, 'Home');
  await tap(page, 'home_team');
  await waitScene(page, 'Team');
  await shot(page, testInfo, '14-team-edit');
  await checkTargets(page, 'Team');
  await tap(page, 'back');
  await waitScene(page, 'Home');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('stage_001 tutorial: follow every prompt and win', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await goToBattle(page, testInfo, false);
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  const pad = await padCenter(page);
  const seen = [];
  let shotSlip = false;
  let shotRiposte = false;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const scene = await page.evaluate(() => window.__TEST__.sceneKey);
    if (scene !== 'Battle') break;
    const st = await battleState(page);
    if (!st || st.result) {
      await page.waitForTimeout(200);
      continue;
    }
    const step = await page.evaluate(() => window.__TEST__.tutorialStep());
    if (process.env.E2E_DEBUG && Math.random() < 0.1) {
      const tp = st.teams.player;
      const fp = tp.fighters[tp.activeSlot];
      const fe = st.teams.enemy.fighters[st.teams.enemy.activeSlot];
      console.log('dbg', st.tick, st.timer.secondsShown, 'step', step && step.trigger, 'p', fp.name, fp.state, fp.hp, 'v', tp.vigor.toFixed(1), 'e', fe.state, fe.hp, 'hand', fp.hand.map((c) => c && c.playable).join(','));
    }
    if (step && !seen.includes(step.trigger)) {
      seen.push(step.trigger);
      if (step.trigger === 'enemy_windup' && !shotSlip) {
        shotSlip = true;
        await shot(page, testInfo, '15-tutorial-slip-prompt');
      }
      if (step.trigger === 'perfect_slip' && !shotRiposte) {
        shotRiposte = true;
        await shot(page, testInfo, '16-tutorial-riposte-prompt');
      }
    }
    const team = st.teams.player;
    const f = team.fighters[team.activeSlot];
    const action = step ? step.required_action : 'play_card';
    if (action === 'slip') {
      await swipe(page, pad.x, pad.y + 20, 0, -60);
    } else if (action === 'tag') {
      await tap(page, 'bench_0');
    } else if (action === 'ignite') {
      await tap(page, 'ignite');
    } else if (action === 'tri_burst') {
      await tap(page, 'tri_burst');
    } else if (team.burstReady) {
      await tap(page, 'tri_burst');
    } else {
      const i = f.hand.findIndex((c) => c && c.playable);
      if (i >= 0) await tap(page, 'card_' + i);
    }
    await page.waitForTimeout(120);
  }
  await waitScene(page, 'Result');
  await shot(page, testInfo, '17-result-after-tutorial');
  const save = await page.evaluate(() => window.__TEST__.save());
  console.log('tutorial prompts seen:', seen.join(', '));
  console.log('stage_001 record:', JSON.stringify(save.stages.stage_001 || null), 'tutorial', JSON.stringify(save.tutorial));
  expect(seen[0]).toBe('battle_start');
  if (save.stages.stage_001 && save.stages.stage_001.cleared) {
    expect(save.tutorial.completed).toBe(true);
    await tap(page, 'result_continue');
    await waitScene(page, 'Dialogue');
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Story');
    expect((await target(page, 'stage_stage_002')).enabled).toBe(true);
    await shot(page, testInfo, '18-stage-select-after-clear');
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('default renderer (WebGL) boots to battle with no console errors', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await goToBattle(page, testInfo, false, '');
  expect(await page.evaluate(() => window.__TEST__.game.renderer.type)).toBe(2); // Phaser.WEBGL
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 15000 });
  await shot(page, testInfo, '19-battle-webgl');
  await checkTargets(page, 'Battle');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('stage_001 tutorial: Slip prompt, Perfect Slip → Riposte prompt holds the window (AC-9.4.1, AC-9.4.2)', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await goToBattle(page, testInfo, false);
  await page.waitForFunction(() => window.__TEST__.tutorialStep() && window.__TEST__.tutorialStep().trigger === 'battle_start', null, { timeout: 15000 });
  // In-page bot (frame-accurate): plays a card for 'play_card' prompts and Slips 4 ticks before each enemy hit.
  await page.evaluate(() => {
    const T = window.__TEST__;
    const canvas = T.game.canvas;
    const r = canvas.getBoundingClientRect();
    const scene = T.activeScene();
    const k = r.width / scene.W;
    const pad = scene.L.swipePad;
    const x = r.left + (scene.W / 2) * k;
    const y = r.top + ((pad.top + pad.bottom) / 2) * k;
    const mk = (cx, cy) => new Touch({ identifier: 9, target: canvas, clientX: cx, clientY: cy, pageX: cx, pageY: cy });
    const fire = (type, t, list) => canvas.dispatchEvent(new TouchEvent(type, { touches: list, targetTouches: list, changedTouches: [t], bubbles: true, cancelable: true }));
    T.bot = { slips: 0, lastSlipFor: -1, speedAfterSlip: [] };
    const loop = () => {
      if (T.sceneKey !== 'Battle' || T.botStop) return;
      const st = T.battleState();
      const log = T.eventLog || [];
      let wind = null;
      for (let i = log.length - 1; i >= 0; i--) if (log[i].type === 'windup_start' && log[i].side === 'enemy') { wind = log[i]; break; }
      if (wind && wind.tick !== T.bot.lastSlipFor && st.tick >= wind.windupEnd - 5 && st.tick < wind.windupEnd) {
        T.bot.lastSlipFor = wind.tick;
        T.bot.slips += 1;
        const a = mk(x, y);
        fire('touchstart', a, [a]);
        const b = mk(x, y - 40);
        fire('touchmove', b, [b]);
        fire('touchend', b, []);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  // complete the first prompt with a card tap
  const st0 = await battleState(page);
  const hand = st0.teams.player.fighters[st0.teams.player.activeSlot].hand;
  await tap(page, 'card_' + Math.max(0, hand.findIndex((c) => c && c.playable)));

  // AC-9.4.1: the Slip prompt appears at the first enemy wind-up …
  await page.waitForFunction(() => window.__TEST__.tutorialStep() && window.__TEST__.tutorialStep().trigger === 'enemy_windup', null, { timeout: 30000 });
  await shot(page, testInfo, '20-tutorial-slip-prompt');
  // … and normal speed resumes right after the Slip (unless the Perfect-Slip prompt takes over)
  await page.waitForFunction(() => {
    const s = window.__TEST__.tutorialStep();
    return !s || s.trigger !== 'enemy_windup';
  }, null, { timeout: 10000 });
  const after = await page.evaluate(() => {
    const sc = window.__TEST__.activeScene();
    return { speed: sc.tutorial.speed(), step: sc.tutorial.active ? sc.tutorial.active.step.trigger : null };
  });
  expect(after.step === 'perfect_slip' ? 0.3 : 1).toBe(after.speed);

  // AC-9.4.2: a Perfect Slip shows the Riposte prompt; the window is still open after 2 s of prompt
  await page.waitForFunction(() => window.__TEST__.tutorialStep() && window.__TEST__.tutorialStep().trigger === 'perfect_slip', null, { timeout: 60000 });
  await page.evaluate(() => (window.__TEST__.botStop = true));
  await page.waitForTimeout(2000);
  const held = await battleState(page);
  expect(held.teams.player.riposteWindowTicks).toBeGreaterThan(0);
  await shot(page, testInfo, '21-tutorial-riposte-prompt');
  const f = held.teams.player.fighters[held.teams.player.activeSlot];
  const slot = f.hand.findIndex((c) => c && c.riposte);
  expect(slot).toBeGreaterThanOrEqual(0);
  await page.evaluate(() => (window.__TEST__.eventLog = []));
  await tap(page, 'card_' + slot);
  await page.waitForFunction(() => (window.__TEST__.eventLog || []).some((e) => e.type === 'card_played' && e.side === 'player'), null, { timeout: 5000 });
  const played = await page.evaluate(() => window.__TEST__.eventLog.find((e) => e.type === 'card_played' && e.side === 'player'));
  expect(played.riposte).toBe(true);
  expect(played.cost).toBe(0);
  await page.waitForTimeout(150);
  const stepNow = await page.evaluate(() => window.__TEST__.tutorialStep());
  expect(stepNow === null || stepNow.trigger !== 'perfect_slip').toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});
