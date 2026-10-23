// Tap/battle feedback hooks. sfx(name) is the single sound entry point for every scene; it forwards to the audio
// layer (src/audio, GDD §18), which maps each hook to a sound in data/audio.json.
import { data } from './game-data.js';
import { TEST_HOOKS, testHooks } from './test-hooks.js';
import { sfx as audioSfx } from '../audio/index.js';

/**
 * Every hook the UI emits (GDD §18.2; AC-18.1 checks each has a key in audio.json → hooks). A literal list on
 * purpose: tests/ui/sfx-hooks.test.js also scans src/ for sfx('…') calls and fails on any hook not listed here.
 */
export const SFX_HOOKS = [
  'ui_press', 'ui_open', 'ui_denied', 'ui_advance', 'ui_transition', 'denied',
  'swipe_up', 'swipe_down', 'swipe_left', 'swipe_right',
  'fight', 'card_fist', 'card_bolt', 'card_signature', 'card_climax',
  'hit_fist', 'hit_bolt', 'hit_signature', 'hit_climax', 'hit_immune',
  'slip', 'perfect_slip', 'tag', 'ko', 'ignition', 'tri_burst_start', 'climax', 'tutorial_prompt',
  'summon_confirm', 'summon_orb_3', 'summon_orb_4', 'summon_orb_5',
  'summon_reveal_3', 'summon_reveal_4', 'summon_reveal_5', 'summon_results',
  'result_win', 'result_lose', 'result_draw',
  // round 4
  'riposte', 'tag_strike', 'knockdown', 'combo_up', 'tri_burst_impact', 'ui_toggle', 'ui_slider',
];

const listeners = [];

/** Sound hook. opts: { soundKey } = a card's `sfx` override for hit_<type> (GDD §18.2). */
export function sfx(name, opts) {
  const entry = { name: name, t: performance.now() };
  listeners.forEach((fn) => fn(entry));
  const T = TEST_HOOKS ? testHooks() : null;
  if (T) T.sfxLog.push(opts && opts.soundKey ? Object.assign(entry, { soundKey: opts.soundKey }) : entry);
  audioSfx(name, opts);
}

export function onSfx(fn) {
  listeners.push(fn);
}

/** Haptics (GDD §14): 20 ms hit taken, 40 ms Perfect Slip, 80 ms Ignition / Tri-Burst. Off when Vibration is off. */
export function haptic(ms) {
  if (!data.hapticsOn()) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) {
    /* not supported */
  }
}
