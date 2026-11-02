// QA round 4: shared scripted-battle helpers (recorder + Climax → Ignition → Tri-Burst), used by qa-vfx-audio and qa-perf.
import { waitScene, tap } from './qa-helpers.js';

export async function toBattle(page, stageId) {
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

/** Install the in-page recorder: camera flash/shake wraps, per-frame samples, sprite swaps. */
export async function installRecorder(page) {
  await page.evaluate((brk) => {
    const T = window.__TEST__;
    const sc = T.game.scene.getScene('Battle');
    const R = (T.qa = { flashes: [], shakes: [], frames: [], swaps: [], events: [] });
    const proto = Object.getPrototypeOf(sc.cameras.main);
    if (!proto.__qaWrapped) {
      const f = proto.flash;
      const s = proto.shake;
      proto.flash = function (...a) { if (window.__TEST__.qa) window.__TEST__.qa.flashes.push({ t: performance.now(), ms: a[0] }); return f.apply(this, a); };
      proto.shake = function (...a) { if (window.__TEST__.qa) window.__TEST__.qa.shakes.push({ t: performance.now(), ms: a[0], i: a[1] }); return s.apply(this, a); };
      proto.__qaWrapped = true;
    }
    const hooks = sc.vfx && sc.vfx.core && sc.vfx.core.renderer && sc.vfx.core.renderer.hooks;
    if (hooks && hooks.onSpriteSwap) {
      const o = hooks.onSpriteSwap;
      hooks.onSpriteSwap = (...a) => { R.swaps.push({ t: performance.now(), side: a[0], key: a[1] }); return o(...a); };
    }
    // freeze_end / cinematic starts with real timestamps
    const he = sc.handleEvents.bind(sc);
    sc.handleEvents = (events, now) => { for (const e of events) if (['freeze_end', 'ignition', 'tri_burst', 'climax_cinematic', 'tri_burst_start'].includes(e.type)) R.events.push({ t: performance.now(), type: e.type, kind: e.kind, side: e.side }); return he(events, now); };
    const loop = () => {
      if (T.qaStop) return;
      const st = sc.battle ? sc.battle.getState() : null;
      const a = T.audioDebug ? T.audioDebug() : {};
      R.frames.push({
        t: performance.now(), freeze: st && st.freeze ? st.freeze.kind : null,
        cine: !!(sc.cinematic && sc.cinematic.visible && sc.cinematic.alpha > 0.02), title: sc.cinTitle ? sc.cinTitle.text : '',
        particles: T.vfx ? T.vfx.particlesNow : -1, cap: T.vfx ? T.vfx.particleCap : -1, quality: T.vfx ? T.vfx.quality : null,
        duck: a.duck, bgm: a.bgmGain, sfxBus: a.sfxBusGain, ctx: a.contextState,
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // L-shared-006 negative proofs (QA_BREAK): 'flash' fires 4 camera flashes in 300 ms outside the limiter;
    // 'particles' raises the particle store cap to 1,000.
    if (brk === 'flash') setTimeout(() => { for (let i = 0; i < 4; i++) setTimeout(() => sc.cameras.main.flash(80, 255, 255, 255, true), i * 100); }, 500);
    if (brk === 'particles' && sc.vfx && sc.vfx.core) { const st = sc.vfx.core.store; st.cap = 1000; if (st.capacity < 1000 && st.grow) st.grow(1000); sc.vfx.core.particleCap = () => 1000; }
  }, process.env.QA_BREAK || '');
}

/** Scripted big moments: Climax → Ignition → Tri-Burst, each with an asserted precondition. Enemy AI off. */
export async function scriptBigMoments(page) {
  await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.controllers.enemy = null; });
  const B = (fn, arg) => page.evaluate(fn, arg);
  const waitEvent = (type) => page.waitForFunction((ty) => window.__TEST__.qa.events.some((e) => e.type === ty && e.side === 'player'), type, { timeout: 20000 });
  const waitFreezeEnd = (kind) => page.waitForFunction((k) => window.__TEST__.qa.events.some((e) => e.type === 'freeze_end' && e.kind === k), kind, { timeout: 20000 });
  // 1. Climax
  await page.waitForFunction(() => { const s = window.__TEST__.battleState(); const f = s.teams.player.fighters[s.teams.player.activeSlot]; return s.phase === 'fight' && !s.freeze && (f.state === 'Idle'); }, null, { timeout: 15000 });
  await B(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; const f = b.activeFighter('player'); f.deck.hand[0] = 'card_tavi_wildfire_crash'; f.deck.refillAt[0] = -1; b.teams.player.vigor = 6000 * 10; b.teams.player.x = 44; b.teams.enemy.x = 56; });
  await page.waitForTimeout(100);
  await tap(page, 'card_0');
  await waitEvent('climax_cinematic');
  await waitFreezeEnd('climax');
  // 2. Ignition
  await page.waitForFunction(() => { const s = window.__TEST__.battleState(); return !s.freeze && ['Idle', 'Recovery', 'Hitstun'].includes(s.teams.player.fighters[s.teams.player.activeSlot].state); }, null, { timeout: 15000 });
  await B(() => { window.__TEST__.game.scene.getScene('Battle').battle.activeFighter('player').ign.available = true; });
  await page.waitForFunction(() => window.__TEST__.battleState().teams.player.igniteReady, null, { timeout: 10000 });
  await tap(page, 'ignite');
  await waitEvent('ignition');
  await waitFreezeEnd('ignition');
  // 3. Tri-Burst
  await B(() => { window.__TEST__.game.scene.getScene('Battle').battle.teams.player.burst = 100; });
  await page.waitForFunction(() => window.__TEST__.battleState().teams.player.burstReady, null, { timeout: 15000 });
  await tap(page, 'tri_burst');
  await waitEvent('tri_burst_start');
  await waitEvent('tri_burst'); // landed (enemy AI off: no Slip)
  await waitFreezeEnd('tri_burst');
  await page.waitForTimeout(800);
  // 4. a few seconds of normal hits
  for (let i = 0; i < 25; i++) {
    const st = await page.evaluate(() => window.__TEST__.battleState());
    if (st.result) break;
    const f = st.teams.player.fighters[st.teams.player.activeSlot];
    const k = f.hand.findIndex((c) => c && c.playable);
    if (k >= 0) await tap(page, 'card_' + k);
    await page.evaluate(() => { const b = window.__TEST__.game.scene.getScene('Battle').battle; b.teams.player.vigor = 6000 * 10; });
    await page.waitForTimeout(150);
  }
  return page.evaluate(() => { window.__TEST__.qaStop = true; const q = window.__TEST__.qa; return { ...q, vfxStats: JSON.parse(JSON.stringify(window.__TEST__.vfx.stats)), audio: window.__TEST__.audioDebug() }; });
}

