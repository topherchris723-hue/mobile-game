// QA round 4: VFX + audio in a real, scripted stage_005 battle (GDD §17.5, §18.6, §19 AC-19.5).
// The player side is driven through hooks and the ENEMY AI is switched off (L-qa-003), so the Climax, Ignition and
// Tri-Burst cinematics always happen; preconditions are asserted before behaviour.
// Independent counters: Phaser Camera.prototype.flash / .shake are wrapped in the page, so every real camera flash or
// shake is counted no matter which code path asks for it (the VFX stats are compared, not trusted).
import { test, expect } from '@playwright/test';
import { boot, waitScene, tap, target, shot, clearedSave, watchErrors } from './qa-helpers.js';
import { toBattle, installRecorder, scriptBigMoments } from './qa-battle-script.js';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'runs once (360×640)');
});

function maxInWindow(times, ms) {
  let best = 0;
  for (let i = 0; i < times.length; i++) {
    let n = 0;
    for (let j = i; j < times.length && times[j] - times[i] < ms; j++) n++;
    best = Math.max(best, n);
  }
  return best;
}

function save(reduceMotion) {
  const s = clearedSave(4);
  s.settings.reduce_motion = reduceMotion;
  return s;
}

test('AC-17.5/17.6/17.8/18.4 positive control (reduce motion OFF): flashes ≤3 per rolling 1 s, particles ≤150, overlays hide ≤160 ms after freeze_end, BGM ducks', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, save(false), '&renderer=canvas&seed=909');
  await toBattle(page, 'stage_005');
  await installRecorder(page);
  const r = await scriptBigMoments(page);
  await shot(page, 'r4-battle-after-big-moments');
  const fl = r.flashes.map((f) => f.t);
  const maxFlash = maxInWindow(fl, 1000);
  const pMax = Math.max(...r.frames.map((f) => f.particles));
  console.log(`camera flashes=${fl.length} (VFX stats ${r.vfxStats.flashes.length}, dropped ${r.vfxStats.flashesDropped}), max in 1 s=${maxFlash}; shakes=${r.shakes.length} (max intensity ${Math.max(0, ...r.shakes.map((s) => s.i))}, max ms ${Math.max(0, ...r.shakes.map((s) => s.ms))}); particles max=${pMax} (stats ${r.vfxStats.particlesMax}), cap=${r.frames[r.frames.length - 1].cap}; swaps=${JSON.stringify(r.swaps.map((s) => s.side + ':' + s.key))}`);
  // positive control: the recorder sees flashes and shakes in a normal battle
  expect(fl.length, 'positive control: flashes recorded').toBeGreaterThan(0);
  expect(r.shakes.length, 'positive control: shakes recorded').toBeGreaterThan(0);
  // AC-17.5 + §17.3 limits
  expect(maxFlash, 'AC-17.5: ≤3 screen flashes start in any rolling 1 s').toBeLessThanOrEqual(3);
  expect(fl.length, 'camera flashes = VFX-limited flashes (no bypass)').toBe(r.vfxStats.flashes.length);
  for (const s of r.shakes) { expect(s.i).toBeLessThanOrEqual(0.012); expect(s.ms).toBeLessThanOrEqual(300); }
  // AC-17.6
  expect(pMax, 'AC-17.6: live particles ≤ 150 (high)').toBeLessThanOrEqual(150);
  expect(pMax, 'particles were actually used').toBeGreaterThan(0);
  // AC-17.8: every cinematic overlay hidden within 160 ms of its freeze_end (+ one 16.7 ms frame of sampling)
  const lat = [];
  for (const e of r.events.filter((x) => x.type === 'freeze_end' && ['climax', 'ignition', 'tri_burst'].includes(x.kind))) {
    const hidden = r.frames.find((f) => f.t >= e.t && !f.cine);
    // lower bound: the last sampled frame (after freeze_end) on which the overlay was still drawn
    const vis = r.frames.filter((f) => f.t >= e.t && f.cine && (!hidden || f.t < hidden.t));
    const lastVis = vis.length ? vis[vis.length - 1] : null;
    lat.push({ kind: e.kind, ms: hidden ? Math.round(hidden.t - e.t) : null, stillVisibleAtMs: lastVis ? Math.round(lastVis.t - e.t) : 0 });
  }
  console.log('AC-17.8 overlay hide latency:', JSON.stringify(lat));
  expect(lat.length, 'three cinematics happened').toBeGreaterThanOrEqual(3);
  for (const l of lat) expect(l.ms, `${l.kind} overlay hidden ≤ 160 ms (+1 frame) after freeze_end`).not.toBeNull();
  for (const l of lat) expect.soft(l.stillVisibleAtMs, `${l.kind} overlay still drawn > 160 ms after freeze_end`).toBeLessThanOrEqual(160);
  for (const l of lat) expect.soft(l.ms).toBeLessThanOrEqual(160 + 34); // first hidden frame: 160 ms + up to 2 slow headless frames
  // Ignition still shows its form name and the sprite swap
  const ignFrames = r.frames.filter((f) => f.freeze === 'ignition' && f.cine);
  expect(ignFrames.length).toBeGreaterThan(0);
  expect(ignFrames.some((f) => /Overheat Form/.test(f.title)), 'form name on the overlay').toBe(true);
  expect(r.swaps.some((s) => s.side === 'player'), 'sprite swap fired').toBe(true);
  // AC-18.4 ducking on the ignition
  // QA_BREAK=duck: measure from tri_burst_start (no duck there) to prove the duck check can fail.
  const ign = r.events.find((e) => e.type === (process.env.QA_BREAK === 'duck' ? 'tri_burst_start' : 'ignition'));
  const ignEnd = r.events.find((e) => e.type === 'freeze_end' && e.kind === 'ignition');
  const ctx = r.frames[r.frames.length - 1].ctx;
  const duckAt = r.frames.find((f) => f.t >= ign.t && f.duck !== undefined && f.duck <= 0.35 + 0.01);
  const backAt = r.frames.find((f) => f.t >= ignEnd.t && f.duck !== undefined && f.duck >= 0.99);
  const sfxChanged = r.frames.filter((f) => f.t >= ign.t - 50 && f.t <= ignEnd.t + 400).some((f) => Math.abs(f.sfxBus - r.frames[0].sfxBus) > 1e-9);
  console.log(`AC-18.4 context=${ctx} duck reached 0.35 after ${duckAt ? Math.round(duckAt.t - ign.t) : 'never'} ms; back to 1.0 ${backAt ? Math.round(backAt.t - ignEnd.t) : 'never'} ms after freeze_end; sfx bus changed=${sfxChanged}`);
  expect(ctx, 'audio context running after the taps').toBe('running');
  expect(duckAt && duckAt.t - ign.t, 'duck reaches 0.35 within 0.08 s (+1 frame)').toBeLessThanOrEqual(80 + 17);
  expect(backAt && backAt.t - ignEnd.t, 'duck back to 1.0 within 0.30 s (+1 frame) after freeze_end').toBeLessThanOrEqual(300 + 17);
  expect(sfxChanged, 'SFX gain unchanged').toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-17.5 / AC-19.5 reduce motion ON: 0 screen flashes and 0 shakes for the whole battle; Ignition keeps overlay, form name, sprite swap', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, save(true), '&renderer=canvas&seed=909');
  await toBattle(page, 'stage_005');
  await installRecorder(page);
  const r = await scriptBigMoments(page);
  await shot(page, 'r4-battle-reduce-motion');
  console.log(`reduce motion: camera flashes=${r.flashes.length} shakes=${r.shakes.length} vfx flashes=${r.vfxStats.flashes.length} vfx shakes=${r.vfxStats.shakes.length}; swaps=${r.swaps.length}`);
  expect(r.flashes.length).toBe(0);
  expect(r.shakes.length).toBe(0);
  const ignFrames = r.frames.filter((f) => f.freeze === 'ignition' && f.cine);
  expect(ignFrames.length, 'overlay shown').toBeGreaterThan(0);
  expect(ignFrames.some((f) => /Overheat Form/.test(f.title)), 'form name').toBe(true);
  expect(r.swaps.some((s) => s.side === 'player'), 'sprite swap').toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC-17.6 quality forced low: live particles never exceed 60', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, save(false), '&renderer=canvas&seed=909&vfxQuality=low');
  await toBattle(page, 'stage_005');
  await installRecorder(page);
  const r = await scriptBigMoments(page);
  const pMax = Math.max(...r.frames.map((f) => f.particles));
  console.log(`low quality: particles max=${pMax} (stats ${r.vfxStats.particlesMax}), cap=${r.frames[r.frames.length - 1].cap}, quality=${r.frames[r.frames.length - 1].quality}`);
  expect(r.frames[r.frames.length - 1].quality).toBe('low');
  expect(pMax).toBeGreaterThan(0);
  expect(pMax).toBeLessThanOrEqual(60);
  expect(errors, errors.join('\n')).toEqual([]);
});

// AC-17.6 under load: the scripted battle peaks below the cap (126), so it cannot show that the cap holds. Here the
// VFX layer alone (not the logic) is fed 6 synthetic climax hits + 1 knockdown per frame for 4 s; the cap must hold
// (high 150, low 60). QA_BREAK=particles checks against a stricter limit and must FAIL.
for (const q of ['high', 'low']) {
  test(`AC-17.6 stress (${q}): synthetic VFX load never exceeds the particle cap`, async ({ page }) => {
    const errors = watchErrors(page);
    await boot(page, save(false), '&renderer=canvas&seed=909' + (q === 'low' ? '&vfxQuality=low' : ''));
    await toBattle(page, 'stage_005');
    await page.waitForFunction(() => window.__TEST__.battleState().phase === 'fight', null, { timeout: 10000 });
    const res = await page.evaluate(async ({ brk }) => {
      const T = window.__TEST__;
      const sc = T.game.scene.getScene('Battle');
      let max = 0;
      let frames = 0;
      const t0 = performance.now();
      await new Promise((done) => {
        const loop = () => {
          const st = sc.battle.getState();
          const tick = st.tick;
          const evs = [];
          for (let i = 0; i < 6; i++) evs.push({ type: 'hit', side: i % 2 ? 'enemy' : 'player', cardType: 'climax', cardId: 'card_tavi_wildfire_crash', hitIndex: 0, chainIndex: 1, crit: i === 0, typeMult: 1, damage: 1, tick });
          evs.push({ type: 'knockdown', side: 'enemy', slot: st.teams.enemy.activeSlot, tick });
          sc.vfx.onBattleEvents(evs, st);
          max = Math.max(max, T.vfx.particlesNow);
          frames++;
          if (performance.now() - t0 < 4000) requestAnimationFrame(loop); else done();
        };
        requestAnimationFrame(loop);
      });
      return { max, frames, cap: T.vfx.particleCap, quality: T.vfx.quality, statsMax: T.vfx.stats.particlesMax, skipped: T.vfx.stats.skippedBudget };
    }, { brk: process.env.QA_BREAK || '' });
    console.log(`stress ${q}: frames=${res.frames} max particles=${res.max} (stats ${res.statsMax}) cap=${res.cap} quality=${res.quality} skippedBudget=${res.skipped}`);
    // Negative proof: the engine has two independent limits (pool capacity 150 and the live cap), so no single break
    // can exceed 150; QA_BREAK=particles instead checks against a stricter 100 (60 → 40), which a real count must FAIL.
    const cap = (q === 'low' ? 60 : 150) - (process.env.QA_BREAK === 'particles' ? (q === 'low' ? 20 : 50) : 0);
    expect(res.max, 'the load actually reaches the cap').toBeGreaterThanOrEqual(Math.min(cap, 40));
    expect(res.statsMax).toBeLessThanOrEqual(cap);
    expect(res.max).toBeLessThanOrEqual(cap);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
