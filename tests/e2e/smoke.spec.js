// UI smoke test: full flow at 360×640 and 430×932, gestures, pause/background, tutorial, summon (round 3),
// touch-target sizes (GDD §14, AC-14.1), no console errors. Screenshots (UI_SHOTS=1 only) → reports/screenshots/round-3/.
import { test, expect } from '@playwright/test';
import { watchErrors, shot, rawShot, waitScene, target, tap, swipe, touchHold, padCenter, checkTargets, battleState, goToBattle } from './helpers.js';

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
  // software WebGL at dpr 3 runs at a few fps in headless Chromium: allow 30 s for the 2 s intro
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 30000 });
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

// ------------------------------------------------------------------ round 2, QA fix loop 1

const SAVE_NOW = '2026-10-22T00:00:00.000Z';
/** A valid save with stages 1..upTo cleared (tutorial done), built from the shipped economy data. */
async function bootWithSave(page, upTo, mutate) {
  await page.goto('/?test=1&seed=777&renderer=canvas');
  await waitScene(page, 'Title');
  await page.evaluate(({ upTo, now, mutate }) => {
    const d = window.__TEST__.data;
    const e = d.raw.economy;
    const s = {
      version: 1, created_at: now, updated_at: now,
      currencies: { ...e.starting.currencies },
      roster: e.starting.characters.map((id) => ({ character_id: id, resonance: 0, obtained_at: now })),
      team: e.starting.team.slice(), stages: {},
      summon: { pity: {}, first_multi_done: {}, total_pulls: 0 },
      settings: { bgm_volume: 1, sfx_volume: 1, haptics: true }, tutorial: { completed: upTo >= 1 },
    };
    for (const st of d.raw.stages.stages) {
      if (st.order <= upTo) s.stages[st.id] = { cleared: true, clears: 1, best_time_s: 42.5, missions_completed: (st.missions || []).map((m) => m.id) };
    }
    if (mutate) new Function('s', mutate)(s);
    localStorage.setItem('game_save', JSON.stringify(s));
  }, { upTo, now: SAVE_NOW, mutate: mutate || null });
  await page.reload();
  await waitScene(page, 'Title');
}

async function dbl(page, id) {
  const tg = await target(page, id);
  const x = tg.x + tg.w / 2;
  const y = tg.y + tg.h / 2;
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);
}

const hasTarget = (page, id) => page.evaluate((i) => window.__TEST__.targets().some((t) => t.id === i), id);

async function startStage(page, stageId) {
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await tap(page, 'stage_' + stageId);
  await page.waitForFunction(() => ['Dialogue', 'Team'].includes(window.__TEST__.sceneKey), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__TEST__.sceneKey)) === 'Dialogue') {
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
  }
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
}

test('BUG-2-03: double tap on every pause/confirm/result button does one thing only', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 1);
  await startStage(page, 'stage_001');
  await page.evaluate(() => {
    window.__starts = [];
    for (const sc of window.__TEST__.game.scene.scenes) sc.events.on('create', () => window.__starts.push(sc.scene.key));
  });

  // battle_pause ×2 → paused, one menu
  await dbl(page, 'battle_pause');
  await page.waitForTimeout(350);
  expect((await battleState(page)).paused).toBe(true);
  // menu_resume ×2 → resumed, and the 2nd tap (over the hand) plays no card
  await page.evaluate(() => (window.__TEST__.inputLog = []));
  await dbl(page, 'menu_resume');
  await page.waitForTimeout(350);
  expect((await battleState(page)).paused).toBe(false);
  expect(await page.evaluate(() => window.__TEST__.inputLog.length), 'no battle input from the 2nd tap on Resume').toBe(0);
  // menu_retreat ×2 → confirm shown, battle not ended
  await tap(page, 'battle_pause');
  await page.waitForTimeout(350);
  await dbl(page, 'menu_retreat');
  await page.waitForTimeout(350);
  expect((await battleState(page)).result).toBeNull();
  expect(await hasTarget(page, 'menu_retreat_yes')).toBe(true);
  // the destructive button is not where "Retreat" was
  const yes = await target(page, 'menu_retreat_yes');
  const cancel = await target(page, 'menu_cancel');
  expect(yes.y + yes.h).toBeLessThanOrEqual(cancel.y);
  await shot(page, testInfo, '21-battle-retreat-confirm-swapped');
  // menu_cancel ×2 → back to the pause menu, still not retreated
  await dbl(page, 'menu_cancel');
  await page.waitForTimeout(350);
  expect(await hasTarget(page, 'menu_resume')).toBe(true);
  expect(await hasTarget(page, 'menu_retreat_yes')).toBe(false);
  expect((await battleState(page)).result).toBeNull();
  // retreat → yes ×2 → exactly one Result
  await tap(page, 'menu_retreat');
  await page.waitForTimeout(350);
  await dbl(page, 'menu_retreat_yes');
  await waitScene(page, 'Result');
  await page.waitForTimeout(400);
  // result_retry ×2 → one Battle
  await dbl(page, 'result_retry');
  await waitScene(page, 'Battle');
  await page.waitForTimeout(500);
  let starts = await page.evaluate(() => window.__starts);
  expect(starts).toEqual(['Result', 'Battle']);
  // lose again, result_to_story ×2 → one Story
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  await tap(page, 'battle_pause');
  await page.waitForTimeout(350);
  await tap(page, 'menu_retreat');
  await page.waitForTimeout(350);
  await tap(page, 'menu_retreat_yes');
  await waitScene(page, 'Result');
  await dbl(page, 'result_to_story');
  await waitScene(page, 'Story');
  await page.waitForTimeout(400);
  starts = await page.evaluate(() => window.__starts);
  expect(starts).toEqual(['Result', 'Battle', 'Result', 'Story']);
  // win → result_continue ×2 → one post-story Dialogue (or Story)
  await tap(page, 'stage_stage_001');
  await page.waitForFunction(() => ['Dialogue', 'Team'].includes(window.__TEST__.sceneKey), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__TEST__.sceneKey)) === 'Dialogue') {
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
  }
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  await page.evaluate(() => { for (const f of window.__TEST__.game.scene.getScene('Battle').battle.teams.enemy.fighters) f.hp = 1; });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const st = await battleState(page);
    if (!st || st.result || (await page.evaluate(() => window.__TEST__.sceneKey)) !== 'Battle') break;
    const f = st.teams.player.fighters[st.teams.player.activeSlot];
    const i = f.hand.findIndex((c) => c && c.playable);
    if (i >= 0) await tap(page, 'card_' + i);
    await page.waitForTimeout(150);
  }
  await waitScene(page, 'Result');
  await page.evaluate(() => (window.__starts = []));
  await dbl(page, 'result_continue');
  await page.waitForFunction(() => ['Dialogue', 'Story'].includes(window.__TEST__.sceneKey), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  starts = await page.evaluate(() => window.__starts);
  expect(starts.length, starts.join(' > ')).toBe(1);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('BUG-2-04 UI guard: an unknown character id in the in-memory team never crashes Home/Team/Story/Battle', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const warnings = [];
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
  await bootWithSave(page, 1);
  // Bypass the (already repairing) loader: corrupt the live save as a later data change could.
  await page.evaluate(() => (window.__TEST__.data.save.team = ['char_tavi_001', 'char_lark_001', 'char_removed_099']));
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await shot(page, testInfo, '22-home-unknown-team-id');
  await tap(page, 'home_team');
  await waitScene(page, 'Team');
  await tap(page, 'back');
  await waitScene(page, 'Home');
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await tap(page, 'stage_stage_002');
  await page.waitForFunction(() => ['Dialogue', 'Team'].includes(window.__TEST__.sceneKey), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__TEST__.sceneKey)) === 'Dialogue') {
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
  }
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
  const st = await battleState(page);
  const ids = st.teams.player.fighters.map((f) => f.characterId);
  const starters = await page.evaluate(() => window.__TEST__.data.raw.economy.starting.team);
  expect(ids).toEqual(starters);
  expect(warnings.some((w) => /unknown character ids/.test(w))).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

/** Visible texts with bounds (logical px), excluding ones under a modal or fully faded. */
async function battleTexts(page) {
  return page.evaluate(() => {
    const s = window.__TEST__.activeScene();
    const out = [];
    const names = new Set([s.fighters.player.nameTag, s.fighters.enemy.nameTag]);
    const floats = [];
    const walk = (list, alpha, depth) => {
      for (const o of list) {
        const a = alpha * (o.alpha === undefined ? 1 : o.alpha);
        if (o.visible === false || a < 0.05) continue;
        const d = depth + (o.depth || 0);
        if (o.type === 'Text' && o.text && o.text.trim()) {
          const b = o.getBounds();
          const r = { text: o.text.replace(/\n/g, ' ').slice(0, 40), x: b.x, y: b.y, w: b.width, h: b.height, depth: d, name: names.has(o) };
          if (r.name || (d >= 55 && d <= 75)) floats.push(r);
        }
        if (o.list) walk(o.list, a, d);
      }
    };
    walk(s.children.list, 1, 0);
    return floats;
  });
}

function overlaps(texts) {
  const out = [];
  const shrink = 2;
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) - shrink * 2;
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) - shrink * 2;
      if (ox > 0 && oy > 0) out.push(`"${a.text}" × "${b.text}" (${ox.toFixed(0)}x${oy.toFixed(0)})`);
    }
  }
  return out;
}

test('BUG-2-09/2-10: intro and floating battle texts never overlap each other or the name labels', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 1);
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await tap(page, 'stage_stage_002');
  await page.waitForFunction(() => ['Dialogue', 'Team'].includes(window.__TEST__.sceneKey), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__TEST__.sceneKey)) === 'Dialogue') {
    await tap(page, 'dialogue_skip');
    await waitScene(page, 'Team');
  }
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
  // intro (BUG-2-09)
  await page.waitForTimeout(300);
  const intro = await battleTexts(page);
  expect(overlaps(intro), 'intro overlaps').toEqual([]);
  await shot(page, testInfo, '23-battle-intro-no-overlap');
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
  // Heavy play: tap every playable card for 12 s and sample the texts every ~60 ms (BUG-2-10).
  // Both sides get lots of HP so the fight keeps going.
  await page.evaluate(() => {
    const b = window.__TEST__.game.scene.getScene('Battle').battle;
    for (const side of ['player', 'enemy']) for (const f of b.teams[side].fighters) f.hp = f.def.maxHp = 10 ** 7;
  });
  const probs = new Set();
  let samples = 0;
  let maxFloats = 0;
  let shotTaken = false;
  const end = Date.now() + 12000;
  while (Date.now() < end) {
    const st = await battleState(page);
    if (!st || st.result) break;
    const f = st.teams.player.fighters[st.teams.player.activeSlot];
    const i = f.hand.findIndex((c) => c && c.playable);
    if (i >= 0 && !st.paused) await tap(page, 'card_' + i);
    for (let k = 0; k < 3; k++) {
      const tx = await battleTexts(page);
      samples++;
      const nonName = tx.filter((x) => !x.name).length;
      maxFloats = Math.max(maxFloats, nonName);
      for (const p of overlaps(tx)) probs.add(p);
      if (!shotTaken && nonName >= 3) {
        shotTaken = true;
        await rawShot(page, testInfo, '24-battle-floats-busy');
      }
      await page.waitForTimeout(40);
    }
  }
  console.log(`[${testInfo.project.name}] float samples: ${samples}, max floating texts at once: ${maxFloats}, overlaps: ${probs.size}`);
  expect(samples).toBeGreaterThan(50);
  expect(maxFloats, 'the check saw floating texts').toBeGreaterThanOrEqual(2);
  expect([...probs]).toEqual([]);
  await shot(page, testInfo, '25-battle-floats');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('BUG-2-06: stage list rows never overlap (all stages cleared)', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 5, "s.stages.stage_005.missions_completed = s.stages.stage_005.missions_completed.slice(0, 1);");
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await page.waitForTimeout(300);
  const texts = await page.evaluate(() => {
    const s = window.__TEST__.activeScene();
    const out = [];
    const walk = (list) => {
      for (const o of list) {
        if (o.type === 'Text' && o.text && o.text.trim()) {
          const b = o.getBounds();
          out.push({ text: o.text.replace(/\n/g, ' ').slice(0, 40), x: b.x, y: b.y, w: b.width, h: b.height });
        }
        if (o.list) walk(o.list);
      }
    };
    walk(s.children.list);
    return { texts: out, W: s.W };
  });
  expect(texts.texts.filter((x) => /Missions|\d\/\d/.test(x.text)).length).toBe(5);
  expect(overlaps(texts.texts)).toEqual([]);
  for (const x of texts.texts) expect(x.x + x.w, x.text).toBeLessThanOrEqual(texts.W + 3);
  await shot(page, testInfo, '26-story-all-cleared');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Tri-Burst lock (GDD §5.0): IGNITE is greyed while a rush runs', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 1);
  await startStage(page, 'stage_002');
  await page.evaluate(() => {
    const b = window.__TEST__.game.scene.getScene('Battle').battle;
    const t = b.teams.player;
    t.burst = 100;
    t.fighters[t.active].ign.available = true;
  });
  await page.waitForFunction(() => window.__TEST__.battleState().teams.player.burstReady, null, { timeout: 10000 });
  await page.evaluate(() => {
    const T = window.__TEST__;
    T.lockSeen = null;
    const sc = T.game.scene.getScene('Battle');
    const loop = () => {
      const st = T.battleState();
      if (st && st.triBurstLock && !T.lockSeen) T.lockSeen = { igniteAlpha: sc.hud.igniteText.alpha, igniteVisible: sc.hud.igniteVisible };
      if (!T.lockSeen && T.sceneKey === 'Battle') requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await tap(page, 'tri_burst');
  await page.waitForFunction(() => !!window.__TEST__.lockSeen, null, { timeout: 5000 });
  const seen = await page.evaluate(() => window.__TEST__.lockSeen);
  console.log('lock seen:', JSON.stringify(seen));
  expect(seen.igniteVisible).toBe(true);
  expect(seen.igniteAlpha).toBeLessThan(1);
  expect(errors, errors.join('\n')).toEqual([]);
});

// ------------------------------------------------------------------ round 3: Summon (GDD §11.1)
import fs from 'node:fs';
const BANNERS = JSON.parse(fs.readFileSync('data/banners.json', 'utf8'));
const BANNER = BANNERS.banners[0]; // numbers from data: the balance-analyst may change them

async function toSummon(page) {
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_summon');
  await waitScene(page, 'Summon');
  await page.waitForTimeout(200);
}
const summonSnap = (page) => page.evaluate(() => window.__TEST__.summonScreen());

/** All visible texts of the active scene with bounds (logical px) for overlap / edge checks. */
async function sceneTexts(page) {
  return page.evaluate(() => {
    const s = window.__TEST__.activeScene();
    const out = [];
    const walk = (list, alpha, depth) => {
      for (const o of list) {
        const a = alpha * (o.alpha === undefined ? 1 : o.alpha);
        if (o.visible === false || a < 0.05) continue;
        const d = Math.max(depth, o.depth || 0);
        if (o.type === 'Text' && o.text && o.text.trim()) {
          const b = o.getBounds();
          out.push({ text: o.text.replace(/\n/g, ' ').slice(0, 50), x: b.x, y: b.y, w: b.width, h: b.height, depth: d, size: parseFloat(o.style.fontSize) });
        }
        if (o.list) walk(o.list, a, d);
      }
    };
    walk(s.children.list, 1, 0);
    return { texts: out, W: s.W, H: s.H };
  });
}
function layoutProblems(t, minDepth) {
  const list = t.texts.filter((x) => x.depth >= (minDepth || 0));
  const out = overlaps(list);
  for (const x of list) {
    if (x.x < -1 || x.x + x.w > t.W + 1 || x.y < -1 || x.y + x.h > t.H + 1) out.push(`"${x.text}" off screen`);
    if (x.size < 12) out.push(`"${x.text}" ${x.size}px < 12px`);
  }
  return out;
}

test('Summon: fresh save — pity + first-×10 lines, rates, confirm (armed, one summon), save before reveal, results, Home/Team updated', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1&renderer=canvas&summonSeed=4242');
  await waitScene(page, 'Title');
  await toSummon(page);
  await checkTargets(page, 'Summon');
  let s = await summonSnap(page);
  expect(s.pity).toBe(`★5 guaranteed within ${BANNER.pity.hard_pity} summons.`); // AC-11.11
  expect(s.firstMulti).toBe(`First ×${BANNER.multi_count}: at least one ★${BANNER.first_multi_min_rarity} guaranteed!`);
  expect(s.buttons.map((b) => b.ok)).toEqual([true, true]); // fresh save Jade ≥ cost_multi (economy)
  expect(layoutProblems(await sceneTexts(page))).toEqual([]);
  await shot(page, testInfo, '30-summon-fresh');

  // Rates (AC-11.4): every rarity and fighter row with its percent from the logic, and the rounding note
  await tap(page, 'summon_rates');
  await page.waitForTimeout(300);
  s = await summonSnap(page);
  const rates = await page.evaluate(() => window.__TEST__.activeScene().model.rates);
  expect(s.rates.filter((r) => r.kind === 'rarity').map((r) => r.percent)).toEqual(rates.rarities.map((r) => r.percentText + '%'));
  expect(s.rates.filter((r) => r.kind === 'fighter').map((r) => r.percent)).toEqual(rates.fighters.map((f) => f.percentText + '%'));
  expect(s.rules[0]).toBe('Fighter rates are rounded to 2 decimals.');
  const rt = await sceneTexts(page);
  expect(layoutProblems(rt, 200), 'rates panel layout').toEqual([]);
  const maxScroll = await page.evaluate(() => window.__TEST__.activeScene().modal.maxScroll);
  console.log(`[${testInfo.project.name}] rates panel maxScroll=${maxScroll}`);
  await shot(page, testInfo, '31-summon-rates');
  await checkTargets(page, 'Summon');
  await tap(page, 'summon_rates_close');
  await page.waitForTimeout(200);

  // Confirm dialog: Confirm does not cover the ×10 button; double tap 100 ms apart = at most one summon (AC-11.12)
  const before = await page.evaluate(() => window.__TEST__.save());
  const x10 = await target(page, 'summon_x' + BANNER.multi_count);
  await page.evaluate(() => {
    const T = window.__TEST__;
    T.storageLog = [];
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'game_save') T.storageLog.push({ t: performance.now(), log: (T.summonLog || []).length });
      return orig.call(this, k, v);
    };
  });
  await page.touchscreen.tap(x10.x + x10.w / 2, x10.y + x10.h / 2);
  await page.waitForTimeout(100);
  await page.touchscreen.tap(x10.x + x10.w / 2, x10.y + x10.h / 2); // 2nd tap of a double tap: must do nothing
  await page.waitForTimeout(150);
  const conf = await target(page, 'summon_confirm');
  const overlapX10 = !(conf.y + conf.h <= x10.y || conf.y >= x10.y + x10.h);
  expect(overlapX10, 'Confirm covers the Summon button').toBe(false);
  expect((await summonSnap(page)).modal).toBe('confirm');
  await shot(page, testInfo, '32-summon-confirm');
  await checkTargets(page, 'Summon');
  await page.waitForTimeout(300); // armed after 250 ms
  await page.touchscreen.tap(conf.x + conf.w / 2, conf.y + conf.h / 2);
  await page.waitForTimeout(100);
  await page.touchscreen.tap(conf.x + conf.w / 2, conf.y + conf.h / 2);
  await waitScene(page, 'SummonReveal');
  const after = await page.evaluate(() => window.__TEST__.save());
  expect(after.summon.total_pulls).toBe(before.summon.total_pulls + BANNER.multi_count);
  const log = await page.evaluate(() => ({ storage: window.__TEST__.storageLog, summon: window.__TEST__.summonLog }));
  // AC-11.10: exactly one save write, before the reveal started
  expect(log.storage.length).toBe(1);
  const revealAt = log.summon.find((e) => e.type === 'reveal_start').t;
  expect(log.storage[0].t).toBeLessThan(revealAt);
  expect(log.summon.filter((e) => e.type === 'summon_returned').length).toBe(1);
  // the stored save is the new one (anti-reroll: quitting now keeps the fighters)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('game_save')));
  expect(stored.summon.total_pulls).toBe(after.summon.total_pulls);
  expect(stored.summon.first_multi_done[BANNER.id]).toBe(true);
  await page.waitForTimeout(250);
  await rawShot(page, testInfo, '33-summon-reveal');
  await page.waitForTimeout(600);
  await rawShot(page, testInfo, '34-summon-reveal-card');
  // one tap skips to the results
  await tap(page, 'summon_skip');
  await page.waitForFunction(() => window.__TEST__.summonReveal().phase === 'results', null, { timeout: 3000 });
  const rv = await page.evaluate(() => window.__TEST__.summonReveal());
  expect(rv.rows.length).toBe(BANNER.multi_count);
  expect(rv.rows.map((r) => r.pull)).toEqual([...Array(BANNER.multi_count).keys()].map((i) => i + 1));
  for (const r of rv.rows) expect(r.tag, JSON.stringify(r)).toMatch(/^(NEW|Resonance \+1 \(R\d\)|\+[\d,]+ Jade)$/);
  for (const r of rv.rows) expect(r.nameRight, 'name vs tag').toBeLessThan(r.pillLeft - 4);
  expect(rv.rows.some((r) => r.rarity >= BANNER.first_multi_min_rarity), 'first ×10 guarantee').toBe(true);
  const credited = rv.rows.reduce((n, r) => n + (/^\+([\d,]+) Jade$/.test(r.tag) ? Number(r.tag.slice(1).split(' ')[0].replace(/,/g, '')) : 0), 0);
  expect(after.currencies.cur_jade, 'Jade deducted once').toBe(before.currencies.cur_jade - BANNER.cost_multi + credited);
  await page.waitForTimeout(400);
  expect(layoutProblems(await sceneTexts(page))).toEqual([]);
  await shot(page, testInfo, '35-summon-results');
  await checkTargets(page, 'SummonReveal');
  await tap(page, 'summon_ok');
  await waitScene(page, 'Summon');
  s = await summonSnap(page);
  expect(s.firstMulti).toBeNull(); // AC-11.11: gone after the first ×10
  const pityNow = after.summon.pity[BANNER.pity.group] || 0;
  expect(s.pity).toBe(`★5 guaranteed within ${Math.max(1, BANNER.pity.hard_pity - pityNow)} summons.`);
  await shot(page, testInfo, '36-summon-after');
  // Jade on Home and Summon = the saved balance; the new fighters are in Team select
  const jadeShown = async () => page.evaluate(() => window.__TEST__.activeScene().children.list.filter((o) => o.type === 'Text').map((o) => o.text));
  expect(await jadeShown()).toContain(String(after.currencies.cur_jade));
  await tap(page, 'back');
  await waitScene(page, 'Home');
  expect(await jadeShown()).toContain(String(after.currencies.cur_jade));
  await tap(page, 'home_team');
  await waitScene(page, 'Team');
  const ids = (await page.evaluate(() => window.__TEST__.targets())).map((x) => x.id);
  for (const r of after.roster) expect(ids, r.character_id).toContain('roster_' + r.character_id);
  expect(after.roster.length).toBeGreaterThan(before.roster.length);
  await shot(page, testInfo, '37-team-after-summon');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Summon: affordability (AC-11.6) and save failure (AC-11.10)', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  const cases = [
    [BANNER.cost_multi - 1, [true, false]],
    [BANNER.cost_multi, [true, true]],
    [BANNER.cost_single - 1, [false, false]],
    [BANNER.cost_single, [true, false]],
  ];
  for (const [jade, want] of cases) {
    await bootWithSave(page, 1, `s.currencies.cur_jade = ${jade};`);
    await toSummon(page);
    const s = await summonSnap(page);
    expect(s.buttons.map((b) => b.ok), 'Jade ' + jade).toEqual(want);
    for (const b of s.buttons) if (!b.ok) expect(b.sublabel).toBe('Not enough Jade — clear stages to earn more.');
    const tg = await target(page, s.buttons[1].id);
    expect(tg.enabled).toBe(want[1]);
    if (jade === BANNER.cost_single - 1) {
      expect(layoutProblems(await sceneTexts(page))).toEqual([]);
      await shot(page, testInfo, '38-summon-not-enough');
      // a tap on a disabled button opens nothing
      await tap(page, s.buttons[0].id);
      await page.waitForTimeout(300);
      expect((await summonSnap(page)).modal).toBeNull();
    }
  }
  // AC-11.10: setItem throws → nothing changes, the failure text shows, no reveal
  await bootWithSave(page, 1, `s.currencies.cur_jade = ${BANNER.cost_single};`);
  await toSummon(page);
  const before = await page.evaluate(() => window.__TEST__.save());
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new Error('QuotaExceededError (test)');
    };
  });
  await tap(page, 'summon_x1');
  await page.waitForTimeout(400);
  await tap(page, 'summon_confirm');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__TEST__.sceneKey)).toBe('Summon');
  const s = await summonSnap(page);
  expect(s.error).toBe('Summon failed — no Jade was spent.');
  const after = await page.evaluate(() => window.__TEST__.save());
  expect(after.currencies).toEqual(before.currencies);
  expect(after.roster).toEqual(before.roster);
  expect(after.summon).toEqual(before.summon);
  expect(s.buttons[0].ok).toBe(true);
  await shot(page, testInfo, '39-summon-save-failed');
  expect(errors, errors.join('\n')).toEqual([]);
});

// ------------------------------------------------------------------ round 3: BUG-2-11 live frames
test('BUG-2-11: longest names at melee range and both walls — labels apart, nothing off screen (live frames)', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  // Longest player name in front, stage_005 (has "Umbral Solenne", the longest enemy name in data).
  const chars = JSON.parse(fs.readFileSync('data/characters.json', 'utf8')).characters;
  const enemies = JSON.parse(fs.readFileSync('data/enemies.json', 'utf8')).enemies;
  const ename = (e) => e.name_override || chars.find((c) => c.id === e.character_id).name;
  const longestEnemy = enemies.slice().sort((a, b) => ename(b).length - ename(a).length)[0];
  const stage = JSON.parse(fs.readFileSync('data/stages.json', 'utf8')).stages.find((st) => (st.enemy_team || []).includes(longestEnemy.id));
  const starters = JSON.parse(fs.readFileSync('data/economy.json', 'utf8')).starting.team;
  const lead = starters.slice().sort((a, b) => chars.find((c) => c.id === b).name.length - chars.find((c) => c.id === a).name.length)[0];
  const team = [lead, ...starters.filter((x) => x !== lead)];
  await bootWithSave(page, stage.order - 1, `s.team = ${JSON.stringify(team)};`);
  await startStage(page, stage.id);
  const slot = stage.enemy_team.indexOf(longestEnemy.id);
  await page.evaluate((slot) => {
    const b = window.__TEST__.game.scene.getScene('Battle').battle;
    for (const side of ['player', 'enemy']) for (const f of b.teams[side].fighters) f.hp = f.def.maxHp = 10 ** 7;
    for (let i = 0; i < slot; i++) b.teams.enemy.fighters[i].hp = 0; // the longest-named enemy comes in
  }, slot);
  await page.waitForFunction((slot) => { const s = window.__TEST__.battleState(); return s.teams.enemy.activeSlot === slot && !s.freeze; }, slot, { timeout: 15000 });
  const W0 = await page.evaluate(() => window.__TEST__.battleState().arenaWidth);
  const melee = 12;
  const spots = { 'melee-centre': [W0 / 2 - melee / 2, W0 / 2 + melee / 2], 'right-wall': [W0 - melee, W0], 'left-wall': [0, melee], stacked: [W0, W0] };
  const problems = [];
  let frames = 0;
  for (const [name, [px, ex]] of Object.entries(spots)) {
    await page.evaluate(({ px, ex }) => {
      const T = window.__TEST__;
      T.pin = { px, ex };
      const b = T.game.scene.getScene('Battle').battle;
      if (!T.pinLoop) {
        T.pinLoop = true;
        const loop = () => {
          if (T.sceneKey !== 'Battle') return;
          b.teams.player.x = T.pin.px;
          b.teams.enemy.x = T.pin.ex;
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }
    }, { px, ex });
    await page.waitForTimeout(500);
    for (let k = 0; k < 15; k++) {
      const r = await page.evaluate(() => {
        const s = window.__TEST__.activeScene();
        const n = [s.fighters.player.nameTag, s.fighters.enemy.nameTag].map((o) => { const b = o.getBounds(); return { text: o.text, x: b.x, w: b.width }; });
        const a = s.lastArena;
        const st = s.battle.getState();
        return { n, a, W: s.W, states: [st.teams.player, st.teams.enemy].map((t) => t.fighters[t.activeSlot].state) };
      });
      frames++;
      const [p, e] = r.n;
      if (e.text !== ename(longestEnemy)) problems.push(`${name}: enemy label is "${e.text}"`);
      if (p.x + p.w > e.x - 2) problems.push(`${name}: "${p.text}" × "${e.text}" overlap ${(p.x + p.w - e.x).toFixed(1)} px (${r.states})`);
      for (const l of r.n) if (l.x < 0 || l.x + l.w > r.W) problems.push(`${name}: label "${l.text}" off screen ${l.x.toFixed(1)}..${(l.x + l.w).toFixed(1)}`);
      for (const side of ['player', 'enemy']) {
        const f = r.a[side];
        if (f.x - f.ext.left < 0 || f.x + f.ext.right > r.W) problems.push(`${name}: ${side} body off screen ${(f.x - f.ext.left).toFixed(1)}..${(f.x + f.ext.right).toFixed(1)} (${r.states})`);
      }
      await page.waitForTimeout(60);
    }
    await rawShot(page, testInfo, `40-battle-names-${name}`);
  }
  console.log(`[${testInfo.project.name}] BUG-2-11 frames=${frames} problems=${problems.length}`);
  expect(frames).toBeGreaterThanOrEqual(60);
  expect([...new Set(problems)].slice(0, 12)).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});

// ------------------------------------------------------------------ round 3: TRI-BURST looks
test('TRI-BURST: charging, ready and locked look different (label + shape), locked during the enemy rush', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 1);
  await startStage(page, 'stage_002');
  const look = () => page.evaluate(() => { const h = window.__TEST__.activeScene().hud; return { vis: h.burstVisual, label: h.burstText.text, alpha: h.burstText.alpha }; });
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.teams.player.burst = 40; });
  await page.waitForTimeout(200);
  const charging = await look();
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.teams.player.burst = 100; });
  await page.waitForFunction(() => window.__TEST__.battleState().teams.player.burstReady, null, { timeout: 10000 });
  await page.waitForTimeout(100);
  const ready = await look();
  await rawShot(page, testInfo, '41-burst-ready');
  // the enemy's rush locks the player's TRI-BURST (GDD §5.0)
  await page.evaluate(() => {
    const T = window.__TEST__;
    const sc = T.game.scene.getScene('Battle');
    const b = sc.battle;
    b.teams.enemy.burst = 100;
    b.teams.player.x = 44; b.teams.enemy.x = 56;
    T.lockLook = null;
    const loop = () => {
      const st = T.battleState();
      if (st && st.triBurstLock && st.teams.player.burst >= 100 && !T.lockLook && sc.hud.burstVisual === 'locked') T.lockLook = { vis: sc.hud.burstVisual, label: sc.hud.burstText.text };
      if (!T.lockLook && T.sceneKey === 'Battle') requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    b.applyInput('enemy', { type: 'tri_burst' });
  });
  await page.waitForFunction(() => !!window.__TEST__.lockLook, null, { timeout: 5000 });
  await rawShot(page, testInfo, '42-burst-locked');
  const locked = await page.evaluate(() => window.__TEST__.lockLook);
  console.log('burst looks:', JSON.stringify({ charging, ready, locked }));
  expect(charging.vis).toBe('charging');
  expect(ready.vis).toBe('ready');
  expect(locked.vis).toBe('locked');
  expect(locked.label).not.toBe(ready.label);
  expect(locked.label).toBe('WAIT');
  expect(errors, errors.join('\n')).toEqual([]);
});

// ------------------------------------------------------------------ round 4: Settings (GDD §19), audio + VFX wiring
const settingsSnap = (page) => page.evaluate(() => window.__TEST__.settingsScreen());
async function countSaveWrites(page) {
  await page.evaluate(() => {
    const T = window.__TEST__;
    T.saveWrites = 0;
    if (T.writeSpy) return;
    T.writeSpy = true;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'game_save') T.saveWrites += 1;
      return orig.call(this, k, v);
    };
  });
}
const saveWrites = (page) => page.evaluate(() => window.__TEST__.saveWrites);

test('Settings from Home (AC-19.1–19.4): gear double tap, layout, − ×3 = 3 writes, drag = 1 write, mute gains, reload', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1&renderer=canvas');
  await waitScene(page, 'Title');
  await tap(page, 'start'); // first gesture: audio unlocks (GDD §18.1)
  await waitScene(page, 'Home');
  await checkTargets(page, 'Home');
  await shot(page, testInfo, '50-home-gear');
  await countSaveWrites(page);
  const before = await page.evaluate(() => window.__TEST__.save().settings);
  // double tap on the gear: the 2nd tap must not change any setting (armed 250 ms)
  const gear = await target(page, 'home_settings');
  await page.touchscreen.tap(gear.x + gear.w / 2, gear.y + gear.h / 2);
  await page.waitForTimeout(100);
  await page.touchscreen.tap(gear.x + gear.w / 2, gear.y + gear.h / 2);
  await waitScene(page, 'Settings');
  expect(await page.evaluate(() => window.__TEST__.save().settings)).toEqual(before);
  // AC-19.2: every control ≥ 44×44, none overlapping or closer than 8 px
  const all = await checkTargets(page, 'Settings');
  const close = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i].logical;
    const b = all[j].logical;
    const gx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
    const gy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
    if (Math.max(gx, gy) < 8) close.push(`${all[i].id}~${all[j].id} gap ${Math.max(gx, gy).toFixed(1)}`);
  }
  expect(close).toEqual([]);
  for (const tg of all) { expect(tg.logical.w, tg.id).toBeGreaterThanOrEqual(44); expect(tg.logical.h, tg.id).toBeGreaterThanOrEqual(44); }
  expect(layoutProblems(await sceneTexts(page))).toEqual([]);
  await shot(page, testInfo, '51-settings');
  // AC-19.3: Music − three times from 100% → 70%, 3 writes
  await page.evaluate(() => (window.__TEST__.saveWrites = 0));
  const start = (await settingsSnap(page)).values.bgm_volume;
  for (let i = 0; i < 3; i++) {
    await tap(page, 'settings_bgm_volume_minus');
    await page.waitForTimeout(120);
  }
  expect((await settingsSnap(page)).values.bgm_volume).toBe(start - 30);
  expect(await saveWrites(page)).toBe(3);
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('game_save')).settings.bgm_volume))).toBeCloseTo((start - 30) / 100, 5);
  // drag the Music slider to 20% → one write, on release
  await page.evaluate(() => (window.__TEST__.saveWrites = 0));
  const sl = await target(page, 'settings_bgm_volume_slider');
  const y = sl.y + sl.h / 2;
  const x70 = sl.x + sl.w * 0.7;
  const x20 = sl.x + sl.w * 0.2;
  await page.evaluate(async ({ x0, x1, y }) => {
    const c = window.__TEST__.game.canvas;
    const mk = (x) => new Touch({ identifier: 3, target: c, clientX: x, clientY: y, pageX: x, pageY: y });
    const fire = (type, tt, list) => c.dispatchEvent(new TouchEvent(type, { touches: list, targetTouches: list, changedTouches: [tt], bubbles: true, cancelable: true }));
    const a = mk(x0);
    fire('touchstart', a, [a]);
    for (let i = 1; i <= 6; i++) {
      await new Promise((r) => setTimeout(r, 40));
      const m = mk(x0 + ((x1 - x0) * i) / 6);
      fire('touchmove', m, [m]);
    }
    const e = mk(x1);
    fire('touchend', e, []);
  }, { x0: x70, x1: x20, y });
  await page.waitForTimeout(200);
  expect((await settingsSnap(page)).values.bgm_volume).toBe(20);
  expect(await saveWrites(page)).toBe(1);
  // AC-19.4: Mute all → gains 0 with sliders unchanged; off → back
  const g0 = await page.evaluate(() => window.__TEST__.audioDebug());
  expect(g0.sfxBusGain).toBeGreaterThan(0);
  await tap(page, 'settings_muted');
  await page.waitForTimeout(150);
  const g1 = await page.evaluate(() => window.__TEST__.audioDebug());
  expect([g1.sfxBusGain, g1.bgmBusGain]).toEqual([0, 0]);
  expect((await settingsSnap(page)).values.bgm_volume).toBe(20);
  expect((await settingsSnap(page)).toggles.muted).toBe(true);
  await shot(page, testInfo, '52-settings-muted');
  await tap(page, 'settings_muted');
  await page.waitForTimeout(150);
  const g2 = await page.evaluate(() => window.__TEST__.audioDebug());
  expect(g2.sfxBusGain).toBeCloseTo(g0.sfxBusGain, 6);
  expect(g2.bgmBusGain).toBeCloseTo(g0.bgmBusGain, 6);
  // Reduce motion + Vibration survive a reload
  await tap(page, 'settings_reduce_motion');
  await page.waitForTimeout(150);
  await tap(page, 'settings_haptics');
  await page.waitForTimeout(150);
  const want = await page.evaluate(() => window.__TEST__.save().settings);
  await page.reload();
  await waitScene(page, 'Title');
  const got = await page.evaluate(() => window.__TEST__.save().settings);
  expect(got).toEqual(want);
  expect(got.bgm_volume).toBeCloseTo(0.2, 5);
  await tap(page, 'start');
  await waitScene(page, 'Home');
  await tap(page, 'home_settings');
  await waitScene(page, 'Settings');
  expect((await settingsSnap(page)).values.bgm_volume).toBe(20);
  await tap(page, 'back');
  await waitScene(page, 'Home');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Pause → Settings → Back (AC-19.1, R4-4): double tap safe, battle paused throughout, timer unchanged', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 1);
  await startStage(page, 'stage_002');
  await tap(page, 'battle_pause');
  await page.waitForTimeout(350);
  await checkTargets(page, 'Battle');
  const ids = (await page.evaluate(() => window.__TEST__.targets())).filter((x) => x.id.startsWith('menu_'));
  expect(ids.map((x) => x.id)).toEqual(['menu_resume', 'menu_settings', 'menu_retreat']);
  const pause = await target(page, 'battle_pause');
  for (const b of ids) expect(b.y > pause.y + pause.h || b.x + b.w < pause.x, b.id + ' covers Pause').toBe(true);
  await shot(page, testInfo, '53-pause-menu');
  const t0 = await battleState(page);
  const before = await page.evaluate(() => window.__TEST__.save().settings);
  const st = await target(page, 'menu_settings');
  await page.touchscreen.tap(st.x + st.w / 2, st.y + st.h / 2);
  await page.waitForTimeout(100);
  await page.touchscreen.tap(st.x + st.w / 2, st.y + st.h / 2); // lands on Settings: armed, nothing changes
  await waitScene(page, 'Settings');
  expect(await page.evaluate(() => window.__TEST__.save().settings)).toEqual(before);
  expect((await settingsSnap(page)).from).toBe('Battle');
  await page.waitForTimeout(700);
  await shot(page, testInfo, '54-settings-from-battle');
  const t1 = await battleState(page);
  expect(t1.paused).toBe(true);
  expect(t1.tick).toBe(t0.tick);
  await tap(page, 'back');
  await waitScene(page, 'Battle');
  await page.waitForTimeout(350);
  const after = (await page.evaluate(() => window.__TEST__.targets())).map((x) => x.id);
  expect(after).toContain('menu_resume');
  const t2 = await battleState(page);
  expect(t2.paused).toBe(true);
  expect(t2.timer.ticksLeft).toBe(t0.timer.ticksLeft);
  await tap(page, 'menu_resume');
  await page.waitForTimeout(400);
  expect((await battleState(page)).paused).toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Audio + VFX wiring: music per scene, hit/riposte hooks, battle ducks, VFX stats; reduce motion → 0 shakes/flashes (AC-19.5)', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 1, 's.settings.reduce_motion = false;');
  await tap(page, 'start');
  await waitScene(page, 'Home');
  const home = await page.evaluate(() => window.__TEST__.audioDebug());
  expect(home.unlocked).toBe(true);
  expect(home.desiredTrack).toBeTruthy();
  await tap(page, 'home_summon');
  await waitScene(page, 'Summon');
  const sum = await page.evaluate(() => window.__TEST__.audioDebug());
  expect(sum.desiredTrack).not.toBe(home.desiredTrack);
  await tap(page, 'back');
  await waitScene(page, 'Home');
  // a battle with lots of hits; HP topped up; a KO at the end for the shake
  await page.evaluate(() => (window.__TEST__.sfxLog.length = 0));
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  await tap(page, 'stage_stage_002');
  await page.waitForFunction(() => ['Dialogue', 'Team'].includes(window.__TEST__.sceneKey), null, { timeout: 10000 });
  await page.waitForTimeout(300);
  if ((await page.evaluate(() => window.__TEST__.sceneKey)) === 'Dialogue') { await tap(page, 'dialogue_skip'); await waitScene(page, 'Team'); }
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
  const bat = await page.evaluate(() => window.__TEST__.audioDebug());
  expect(bat.desiredTrack).not.toBe(home.desiredTrack);
  await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 15000 });
  const play = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const s = await battleState(page);
      if (!s || s.result) break;
      const f = s.teams.player.fighters[s.teams.player.activeSlot];
      const i = f.hand.findIndex((c) => c && c.playable);
      if (i >= 0) await tap(page, 'card_' + i);
      await page.waitForTimeout(120);
    }
  };
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; for (const s of ['player', 'enemy']) for (const f of b.teams[s].fighters) f.hp = f.def.maxHp = 10 ** 7; b.teams.player.vigor = 6000 * 10; });
  await play(6000);
  const v1 = await page.evaluate(() => ({ stats: { played: window.__TEST__.vfx.stats.played, shakes: window.__TEST__.vfx.stats.shakes.length, flashes: window.__TEST__.vfx.stats.flashes.length }, particlesMax: window.__TEST__.vfx.stats.particlesMax, cap: window.__TEST__.vfx.particleCap }));
  const hooks = await page.evaluate(() => window.__TEST__.sfxLog.map((e) => e.name));
  console.log(`[${testInfo.project.name}] vfx`, JSON.stringify(v1), 'hooks', [...new Set(hooks)].join(','));
  expect(v1.stats.played).toBeGreaterThan(0);
  expect(v1.particlesMax).toBeLessThanOrEqual(v1.cap);
  expect(hooks.some((h) => h.startsWith('hit_'))).toBe(true);
  // a KO before reduce motion: the counter must see its shake (proves the 0-shake check below can fail)
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.teams.enemy.fighters[b.teams.enemy.active].hp = 0; });
  await page.waitForFunction(() => window.__TEST__.vfx.stats.shakes.length > 0, null, { timeout: 8000 });
  await page.waitForFunction(() => !window.__TEST__.battleState().freeze, null, { timeout: 10000 });
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; for (const f of b.teams.enemy.fighters) if (!f.ko) f.hp = f.def.maxHp = 10 ** 7; });
  // pause ducks the music (GDD §18.4), resume restores
  await tap(page, 'battle_pause');
  await page.waitForTimeout(500);
  const dk = await page.evaluate(() => window.__TEST__.audioDebug().duck);
  expect(dk).toBeLessThan(1);
  await tap(page, 'menu_settings');
  await waitScene(page, 'Settings');
  await page.waitForTimeout(300);
  await tap(page, 'settings_reduce_motion'); // AC-19.5: applies to this battle at once
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__TEST__.vfx.reduceMotion)).toBe(true);
  await tap(page, 'back');
  await waitScene(page, 'Battle');
  await page.waitForTimeout(350);
  await tap(page, 'menu_resume');
  await page.waitForTimeout(400);
  const s0 = await page.evaluate(() => ({ shakes: window.__TEST__.vfx.stats.shakes.length, flashes: window.__TEST__.vfx.stats.flashes.length }));
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.teams.player.burst = 100; });
  await page.waitForFunction(() => window.__TEST__.battleState().teams.player.burstReady, null, { timeout: 10000 }).catch(() => {});
  if ((await battleState(page)).teams.player.burstReady) await tap(page, 'tri_burst');
  await play(6000);
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; for (const f of b.teams.enemy.fighters) f.hp = 0; });
  await waitScene(page, 'Result');
  const s1 = await page.evaluate(() => ({ shakes: window.__TEST__.vfx.stats.shakes.length, flashes: window.__TEST__.vfx.stats.flashes.length }));
  expect(s1).toEqual(s0); // reduce motion: no new shake or screen flash, incl. Tri-Burst and KO
  const res = await page.evaluate(() => window.__TEST__.audioDebug());
  expect(res.duck).toBeCloseTo(1, 2); // resetDuck on leaving the battle
  expect(errors, errors.join('\n')).toEqual([]);
});

test('BUG-3-03: callouts never cover the combo / hit counter (reserved zones; busy live frames)', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 2);
  await startStage(page, 'stage_003');
  await page.evaluate((brk) => {
    const T = window.__TEST__;
    const sc = T.game.scene.getScene('Battle');
    if (brk) sc.disableComboZones = true; // negative proof: the R3 behaviour (avoid only while visible)
    const b = sc.battle;
    for (const s of ['player', 'enemy']) for (const f of b.teams[s].fighters) f.hp = f.def.maxHp = 10 ** 7;
    // force a long chain counter on screen and RIPOSTE!/PERFECT SLIP! callouts on the player side, over and over
    T.bug303 = setInterval(() => {
      if (T.sceneKey !== 'Battle') return;
      // the real BUG-3-03 order: the callout is placed while no chain shows, then the counter appears
      for (const o of [sc.comboText, sc.comboHits, sc.enemyCombo]) { sc.tweens.killTweensOf(o); o.setAlpha(0); }
      sc.callout('RIPOSTE!', '#ffffff', 30, 'player');
      sc.callout('PERFECT SLIP!', '#ffc23d', 30, 'enemy');
      sc.comboText.setText('COMBO x99').setAlpha(1);
      sc.comboHits.setText('999 HITS').setAlpha(1);
      sc.enemyCombo.setText('COMBO x99').setAlpha(1);
    }, 300);
  }, !!process.env.UI_BREAK_COMBO_ZONES);
  const probs = new Set();
  let frames = 0;
  const end = Date.now() + 6000;
  while (Date.now() < end) {
    const r = await page.evaluate(() => {
      const sc = window.__TEST__.activeScene();
      const box = (o) => { const b = o.getBounds(); return { t: o.text, x: b.x, y: b.y, w: b.width, h: b.height }; };
      const fixed = [sc.comboText, sc.comboHits, sc.enemyCombo].filter((o) => o.alpha > 0.05 && o.text).map(box);
      const floats = [];
      const walk = (list) => { for (const o of list) { if (o.type === 'Text' && o.depth >= 55 && o.depth <= 75 && o.alpha > 0.3 && o.visible && o.text) floats.push(box(o)); if (o.list) walk(o.list); } };
      walk(sc.children.list);
      const out = [];
      for (const a of fixed) for (const b of floats) {
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) - 2;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) - 2;
        if (ox > 0 && oy > 0) out.push(`"${a.t}" × "${b.t}"`);
      }
      return out;
    });
    frames++;
    for (const p of r) probs.add(p);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => clearInterval(window.__TEST__.bug303));
  await rawShot(page, testInfo, '55-battle-combo-zone');
  console.log(`[${testInfo.project.name}] BUG-3-03 frames=${frames} problems=${probs.size} ${[...probs].slice(0, 3).join('; ')}`);
  expect(frames).toBeGreaterThan(40);
  expect([...probs]).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Home save-repair notice: shown for a team repair, not for settings_repaired, never the damaged text', async ({ page }) => {
  const errors = watchErrors(page);
  const homeTexts = () => page.evaluate(() => window.__TEST__.activeScene().children.list.flatMap((o) => (o.list || [o])).filter((o) => o.type === 'Text').map((o) => o.text));
  const notice = 'Some save data was fixed on load. Your fighters and Jade are safe.';
  // settings only (an old save without the round-4 fields) → silent repair
  await bootWithSave(page, 1, 'delete s.settings.master_volume; delete s.settings.muted;');
  await tap(page, 'start');
  await waitScene(page, 'Home');
  expect(await page.evaluate(() => window.__TEST__.data.repairWarnings.map((w) => w.code))).toContain('settings_repaired');
  expect(await homeTexts()).not.toContain(notice);
  // a team id the data does not know → notice
  await bootWithSave(page, 1, "s.team = ['char_tavi_001', 'char_lark_001', 'char_removed_099'];");
  await tap(page, 'start');
  await waitScene(page, 'Home');
  const tx = await homeTexts();
  expect(tx).toContain(notice);
  expect(tx).not.toContain('Save data was damaged and has been reset.');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-19.6: Vibration off → navigator.vibrate never called in battle; on → called with §14 durations', async ({ page }) => {
  const errors = watchErrors(page);
  for (const haptics of [false, true]) {
    await bootWithSave(page, 1, `s.settings.haptics = ${haptics};`);
    await page.evaluate(() => { window.__vib = []; navigator.vibrate = (ms) => { window.__vib.push(ms); return true; }; });
    await startStage(page, 'stage_002');
    await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; for (const f of b.teams.player.fighters) f.hp = f.def.maxHp = 10 ** 7; });
    await page.waitForFunction(() => window.__TEST__.eventLog && window.__TEST__.eventLog.some((e) => e.type === 'hit' && e.side === 'enemy'), null, { timeout: 30000 });
    await page.waitForTimeout(200);
    const vib = await page.evaluate(() => window.__vib);
    if (haptics) expect(vib).toContain(20);
    else expect(vib).toEqual([]);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

// ------------------------------------------------------------------ round 5: BUG-4-01 (AC-17.8, L-ui-006)
test('BUG-4-01: Tri-Burst overlay hidden ≤ 160 ms after freeze_end (positive control: drawn before it)', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootWithSave(page, 1);
  await startStage(page, 'stage_002');
  await page.evaluate((brk) => {
    const T = window.__TEST__;
    const sc = T.game.scene.getScene('Battle');
    if (brk) sc.cinFadeMs = 160 + 40; // must-FAIL: a fade longer than the limit
    T.cine = { frames: [], ends: [] };
    const he = sc.handleEvents.bind(sc);
    sc.handleEvents = (events, now) => { for (const e of events) if (e.type === 'freeze_end' && e.kind === 'tri_burst') T.cine.ends.push(performance.now()); return he(events, now); };
    const loop = () => {
      if (T.sceneKey !== 'Battle') return;
      T.cine.frames.push({ t: performance.now(), on: !!(sc.cinematic.visible && sc.cinematic.alpha > 0.02) });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const b = sc.battle;
    for (const s of ['player', 'enemy']) for (const f of b.teams[s].fighters) f.hp = f.def.maxHp = 10 ** 7;
    b.teams.player.burst = 100;
  }, !!process.env.UI_BREAK_CINE);
  await page.waitForFunction(() => window.__TEST__.battleState().teams.player.burstReady, null, { timeout: 15000 });
  await tap(page, 'tri_burst');
  await page.waitForFunction(() => window.__TEST__.cine.ends.length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => window.__TEST__.cine);
  const end = r.ends[0];
  const before = r.frames.filter((f) => f.t < end && f.t > end - 300);
  const after = r.frames.filter((f) => f.t >= end);
  const lastOn = after.filter((f) => f.on).map((f) => f.t - end).pop() || 0;
  const firstOff = after.find((f) => !f.on);
  console.log(`[${testInfo.project.name}] BUG-4-01 drawn until ${lastOn.toFixed(0)} ms, hidden at ${firstOff ? (firstOff.t - end).toFixed(0) : 'never'} ms after freeze_end`);
  expect(before.some((f) => f.on), 'positive control: overlay drawn before freeze_end').toBe(true);
  expect(lastOn, 'overlay still drawn after the 160 ms limit').toBeLessThanOrEqual(160);
  expect(firstOff).toBeTruthy();
  expect(errors, errors.join('\n')).toEqual([]);
});
