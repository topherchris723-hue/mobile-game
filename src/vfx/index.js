// Public VFX API (GDD §17). The scenes call these; nothing here touches the logic.
//
//   const vfx = createVfx(scene, null, data.save.settings, { mode: 'battle' });
//   vfx.onBattleEvents(events, state);   // after every battle.step() (reads only)
//   vfx.onSummon('orb' | 'reveal', rarity);
//   vfx.setReduceMotion(bool); vfx.destroy();
import defaultVfx from '../../data/vfx.json';
import characters from '../../data/characters.json';
import cards from '../../data/cards.json';
import { VfxCore } from './core.js';
import { PhaserVfxRenderer } from './phaser-renderer.js';
import { TEST_HOOKS, testHooks } from '../ui/test-hooks.js';

export { VFX_EVENT_KEYS, keysForEvent, SUMMON_STAGES } from './events.js';
export { GENERATED_TEXTURES } from './particles.js';
export { VfxCore } from './core.js';

const byId = (list) => {
  const m = {};
  for (const x of list) m[x.id] = x;
  return m;
};
const CHAR = byId(characters.characters);
const CARD = byId(cards.cards);
export const DEFAULT_LOOKUP = { character: (id) => CHAR[id] || null, card: (id) => CARD[id] || null };

function readReduceMotion(settings) {
  if (!settings) return false;
  if (typeof settings.reduce_motion === 'boolean') return settings.reduce_motion;
  return !!settings.reduceMotion;
}

/**
 * Create the VFX layer for one scene. vfxData null = the shipped data/vfx.json.
 * settings: the save settings ({ reduce_motion }). opts: see PhaserVfxRenderer (mode, fighters, arena, center,
 * flashDepth, hooks, depth…) plus { lookup, seed, quality: 'auto'|'high'|'low' }.
 */
export function createVfx(scene, vfxData, settings, opts) {
  const o = opts || {};
  const core = new VfxCore(vfxData || defaultVfx, {
    reduceMotion: readReduceMotion(settings), lookup: o.lookup || DEFAULT_LOOKUP, seed: o.seed, quality: o.quality,
  });
  const renderer = new PhaserVfxRenderer(scene, core, o);
  core.renderer = renderer;
  const T = TEST_HOOKS ? testHooks() : null;
  const hook = T ? (T.vfx = { stats: core.stats, particlesNow: 0, particleCap: core.particleCap(), quality: 'high', reduceMotion: core.reduceMotion, emittersNow: 0 }) : null;
  let last = 0;
  const onFrame = (time, delta) => {
    const now = performance.now();
    const dt = last ? now - last : delta || 16.7;
    last = now;
    core.update(now, dt);
    renderer.frame(now, dt);
    if (hook) {
      hook.particlesNow = core.store.liveCount;
      hook.particleCap = core.particleCap();
      hook.emittersNow = core.store.emitterCount;
      hook.quality = core.quality;
      hook.reduceMotion = core.reduceMotion;
    }
  };
  scene.events.on('postupdate', onFrame);
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    scene.events.off('postupdate', onFrame);
    core.destroy();
    renderer.destroy();
  };
  scene.events.once('shutdown', destroy);
  return {
    core,
    /** Container with the cinematic decor (radial lines, Tri-Burst stripes, portraits). Adopt it into the cinematic
     *  container at index 1 (above the band fill, below the title) so it fades with the overlay. */
    cinematicDecor: renderer.decor,
    onBattleEvents: (events, state, now) => core.onBattleEvents(events, state, now === undefined ? performance.now() : now),
    onSummon: (stage, rarity, now) => core.onSummon(stage, rarity, now === undefined ? performance.now() : now),
    setReduceMotion: (b) => {
      core.setReduceMotion(b);
      if (hook) hook.reduceMotion = core.reduceMotion;
    },
    setQuality: (q) => core.setQuality(q),
    /** Register a non-VFX screen flash (e.g. a UI overlay fade) in the 3-per-second window. Returns false when the
     *  window is full (the caller should then skip its flash). */
    requestScreenFlash: (now) => core.flash.request(now === undefined ? performance.now() : now),
    /** Tap-to-skip / leaving: stop every effect now ("no further effects"). */
    clear: (fadeMs) => core.clear(performance.now(), fadeMs || 0),
    spriteFlashLevel: (side) => core.spriteFlashLevel(side, performance.now()),
    stats: core.stats,
    destroy,
  };
}
