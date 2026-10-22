// Shared Playwright helpers for the UI specs (touch, swipes, targets, scene waits, screenshots).
import { expect } from '@playwright/test';
import fs from 'node:fs';

export const SHOTS = 'reports/screenshots/round-2';
fs.mkdirSync(SHOTS, { recursive: true });

export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}

export async function shot(page, testInfo, name) {
  const size = testInfo.project.name.replace('phone-', '');
  await page.waitForTimeout(350); // let fades/tweens settle
  await page.screenshot({ path: `${SHOTS}/${size}-${name}.png` });
}

export async function waitScene(page, key) {
  await page.waitForFunction((k) => window.__TEST__ && window.__TEST__.sceneKey === k, key, { timeout: 15000 });
  await page.waitForTimeout(250);
}

export async function targets(page) {
  return page.evaluate(() => window.__TEST__.targets());
}

export async function target(page, id) {
  const all = await targets(page);
  const tg = all.find((x) => x.id === id);
  if (!tg) throw new Error('No target ' + id + ' in ' + all.map((x) => x.id).join(','));
  return tg;
}

export async function tap(page, id) {
  const tg = await target(page, id);
  await page.touchscreen.tap(tg.x + tg.w / 2, tg.y + tg.h / 2);
}

/** Real touch events through CDP (Playwright's touchscreen API only has tap). */
export async function touch(page) {
  if (!page.__cdp) page.__cdp = await page.context().newCDPSession(page);
  return page.__cdp;
}

/**
 * Swipe with real TouchEvents dispatched on the canvas inside the page (same Phaser touch path as a finger).
 * CDP touchMove calls are throttled to the frame rate of headless software-GL Chromium (~450 ms apart here),
 * which is longer than the 300 ms swipe window, so they cannot express a real swipe.
 */
export async function swipe(page, x, y, dx, dy, durMs = 90) {
  await page.evaluate(
    async ({ x, y, dx, dy, durMs }) => {
      const canvas = window.__TEST__.game.canvas;
      const mk = (cx, cy) => new Touch({ identifier: 7, target: canvas, clientX: cx, clientY: cy, pageX: cx, pageY: cy, screenX: cx, screenY: cy });
      const fire = (type, t, list) =>
        canvas.dispatchEvent(new TouchEvent(type, { touches: list, targetTouches: list, changedTouches: [t], bubbles: true, cancelable: true }));
      const t0 = mk(x, y);
      fire('touchstart', t0, [t0]);
      const steps = 3;
      for (let i = 1; i <= steps; i++) {
        await new Promise((r) => setTimeout(r, durMs / steps));
        const ti = mk(x + (dx * i) / steps, y + (dy * i) / steps);
        fire('touchmove', ti, [ti]);
      }
      const te = mk(x + dx, y + dy);
      fire('touchend', te, []);
    },
    { x, y, dx, dy, durMs }
  );
}

export async function touchHold(page, x, y, ms) {
  const c = await touch(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(ms);
  return async () => c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function padCenter(page) {
  return page.evaluate(() => {
    const s = window.__TEST__.activeScene();
    const c = window.__TEST__.game.canvas.getBoundingClientRect();
    const k = c.width / s.W;
    const p = s.L.swipePad;
    return { x: c.left + (s.W / 2) * k, y: c.top + ((p.top + p.bottom) / 2) * k, k };
  });
}

/** AC-14.1: every interactive element ≥44×44 CSS px; battle: everything but Pause in the lower 60%. */
export async function checkTargets(page, sceneKey) {
  const vp = page.viewportSize();
  const all = await targets(page);
  expect(all.length, 'targets registered on ' + sceneKey).toBeGreaterThan(0);
  for (const tg of all) {
    expect.soft(tg.w, `${sceneKey}/${tg.id} width`).toBeGreaterThanOrEqual(44);
    expect.soft(tg.h, `${sceneKey}/${tg.id} height`).toBeGreaterThanOrEqual(44);
    expect.soft(tg.x, `${sceneKey}/${tg.id} inside screen (x)`).toBeGreaterThanOrEqual(0);
    expect.soft(tg.y + tg.h, `${sceneKey}/${tg.id} inside screen (y)`).toBeLessThanOrEqual(vp.height + 0.5);
    if (sceneKey === 'Battle' && tg.id !== 'battle_pause' && !tg.id.startsWith('menu_')) {
      expect.soft(tg.y, `${sceneKey}/${tg.id} in lower 60%`).toBeGreaterThanOrEqual(vp.height * 0.4);
    }
  }
  return all;
}

export async function battleState(page) {
  return page.evaluate(() => window.__TEST__.battleState());
}

// Interaction tests use the Canvas renderer: headless Chromium has no GPU, and software WebGL blocks the
// main thread for ~150–300 ms per frame, which breaks 300 ms gesture timing. WebGL is covered by its own test.
export async function goToBattle(page, testInfo, withShots, query = '&renderer=canvas') {
  await page.goto('/?test=1&seed=12345' + query);
  await waitScene(page, 'Title');
  if (withShots) await shot(page, testInfo, '01-title');
  await checkTargets(page, 'Title');
  await tap(page, 'start');
  await waitScene(page, 'Home');
  if (withShots) await shot(page, testInfo, '02-home');
  await checkTargets(page, 'Home');
  // Summon is disabled this round
  expect((await target(page, 'home_summon')).enabled).toBe(false);
  await tap(page, 'home_story');
  await waitScene(page, 'Story');
  if (withShots) await shot(page, testInfo, '03-stage-select');
  await checkTargets(page, 'Story');
  expect((await target(page, 'stage_stage_001')).enabled).toBe(true);
  expect((await target(page, 'stage_stage_002')).enabled).toBe(false);
  await tap(page, 'stage_stage_001');
  await waitScene(page, 'Dialogue');
  if (withShots) await shot(page, testInfo, '04-pre-story');
  await checkTargets(page, 'Dialogue');
  await tap(page, 'dialogue_skip');
  await waitScene(page, 'Team');
  if (withShots) await shot(page, testInfo, '05-team-select');
  await checkTargets(page, 'Team');
  await tap(page, 'team_fight');
  await waitScene(page, 'Battle');
}

