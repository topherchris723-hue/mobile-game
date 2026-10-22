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
        await page.screenshot({ path: `reports/screenshots/round-2/${testInfo.project.name.replace('phone-', '')}-24-battle-floats-busy.png` });
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
