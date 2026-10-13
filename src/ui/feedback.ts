import type { Sfx } from '../audio/sfx';
import { CUES, HAPTICS, type CueId } from '../config/feedback';
import type { Settings } from '../save/saveData';

/*
 * One call per game moment ("hitHeavy", "deny", …) that plays its sound and vibration, each
 * gated by the player's settings at the moment it fires, so toggles apply immediately.
 */

export interface Feedback {
  cue(id: CueId): void;
}

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function createFeedback(sfx: Sfx, settings: () => Readonly<Settings>): Feedback {
  return {
    cue(id) {
      const { sound, haptic } = CUES[id];
      const current = settings();
      if (current.sound) sfx.play(sound);
      if (haptic && current.haptics && canVibrate) {
        // Returns false (no throw) when the browser refuses, e.g. before any user gesture.
        navigator.vibrate([...HAPTICS[haptic]]);
      }
    },
  };
}
