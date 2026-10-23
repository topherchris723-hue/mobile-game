// Public audio API for the UI (GDD §18, §19). The ui-developer wires these calls; nothing else imports engine.js.
// Owner: audio-designer.
//
//   initAudio(audioData, settings, opts)  once at boot (before any scene); installs gesture + visibility listeners
//   sfx(hook, { soundKey })              every feedback.js sfx(); soundKey = card.sfx for hit_<type> hooks
//   setMusicContext(ctx, bgmKey)         on every scene start: 'menu' | 'summon' | 'battle' (stage.bgm) | 'story' (scene.bgm)
//   endBattleMusic()                     when a battle ends (before the Result screen plays result_<outcome>)
//   onBattleEvent(e)                     every logic event in BattleScene (ducks on ignition/climax_cinematic/tri_burst)
//   setPaused(on)                        Pause menu open / closed
//   resetDuck()                          leaving the battle scene
//   duck(on, kind)                       manual duck pair (optional, e.g. summon ★5 reveal)
//   setVolumes(settings)                 after every settings change (same object as save.settings)
//   onGesture()                          called by the installed listeners; exported for tests
//   audioDebug()                         effective gains + counters for Playwright test hooks
import { AudioEngine } from './engine.js';

export { AudioEngine } from './engine.js';
export {
  MIX_DEFAULTS, MUSIC_CONTEXTS, DUCK_START_EVENTS, DUCK_FREEZE_KINDS, sfxGain, bgmGain, sfxBusGain, bgmBusGain,
  normalizeSettings, VoiceLimiter, DuckState, resolveTrack,
} from './mix.js';
export { checkAudioData } from './validate.js';

const GESTURE_EVENTS = ['pointerup', 'touchend', 'keydown'];

let engine = null;
let unlisten = [];

/**
 * Create the engine. opts: { target (default window), doc (default document), listen (default true),
 * createContext, setInterval, clearInterval, warn }.
 */
export function initAudio(audioData, settings, opts) {
  const o = opts || {};
  disposeAudio();
  engine = new AudioEngine(audioData, settings, o);
  if (o.listen === false) return engine;
  const target = o.target || (typeof window !== 'undefined' ? window : null);
  const doc = o.doc || (typeof document !== 'undefined' ? document : null);
  if (target && target.addEventListener) {
    const onG = () => onGesture();
    for (const ev of GESTURE_EVENTS) {
      target.addEventListener(ev, onG, true);
      unlisten.push(() => target.removeEventListener(ev, onG, true));
    }
  }
  if (doc && doc.addEventListener) {
    const onV = () => engine && engine.setHidden(!!doc.hidden);
    doc.addEventListener('visibilitychange', onV);
    unlisten.push(() => doc.removeEventListener('visibilitychange', onV));
    if (doc.hidden) engine.setHidden(true);
  }
  return engine;
}

export function disposeAudio() {
  for (const f of unlisten) f();
  unlisten = [];
  if (engine) engine.dispose();
  engine = null;
}

export function getAudioEngine() {
  return engine;
}

export function onGesture() {
  if (engine) engine.onGesture();
}

export function sfx(hook, opts) {
  return engine ? engine.sfx(hook, opts) : { played: false, key: null, reason: 'no_engine' };
}

export function setMusicContext(context, bgmKey) {
  return engine ? engine.setMusicContext(context, bgmKey) : null;
}

export function endBattleMusic() {
  if (engine) engine.endBattleMusic();
}

export function onBattleEvent(e) {
  if (engine) engine.onBattleEvent(e);
}

export function setPaused(on) {
  if (engine) engine.setPaused(on);
}

export function resetDuck() {
  if (engine) engine.resetDuck();
}

export function duck(on, kind) {
  if (engine) engine.setDuck(on, kind);
}

export function setVolumes(settings) {
  if (engine) engine.setVolumes(settings);
}

export function audioDebug() {
  return engine ? engine.debug() : { contextCreated: false, contextState: 'none', unlocked: false, soundsStarted: 0 };
}
