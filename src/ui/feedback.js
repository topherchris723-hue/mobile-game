// Tap feedback hooks. Audio is a later round (audio-designer): sfx() is the hook it will fill.
import { data } from './game-data.js';

const listeners = [];

/** Sound hook. Records the last calls so tests can see that feedback fired. */
export function sfx(name) {
  const entry = { name: name, t: performance.now() };
  listeners.forEach((fn) => fn(entry));
  if (typeof window !== 'undefined' && window.__TEST__) window.__TEST__.sfxLog.push(entry);
}

export function onSfx(fn) {
  listeners.push(fn);
}

/** Haptics (GDD §14): 20 ms hit taken, 40 ms Perfect Slip, 80 ms Ignition / Tri-Burst. */
export function haptic(ms) {
  if (!data.hapticsOn()) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (e) {
    /* not supported */
  }
}
