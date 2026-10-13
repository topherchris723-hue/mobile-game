import { describe, expect, it } from 'vitest';
import type { Sfx } from '../../src/audio/sfx';
import { AUDIO_MIX, CUES, HAPTICS, IMPACT, SOUNDS, type SoundId } from '../../src/config/feedback';
import { DEFAULT_SETTINGS, type Settings } from '../../src/save/saveData';
import { createFeedback } from '../../src/ui/feedback';

describe('sound recipes', () => {
  it('are playable: positive frequencies and durations, gains within 0–1', () => {
    for (const [id, layers] of Object.entries(SOUNDS)) {
      expect(layers.length, id).toBeGreaterThan(0);
      for (const layer of layers) {
        expect(layer.from, id).toBeGreaterThan(0);
        expect(layer.to, id).toBeGreaterThan(0);
        expect(layer.durationMs, id).toBeGreaterThan(0);
        expect(layer.gain, id).toBeGreaterThan(0);
        expect(layer.gain, id).toBeLessThanOrEqual(1);
        expect(layer.delayMs ?? 0, id).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never needs more voices than the mixer allows for a single sound', () => {
    for (const layers of Object.values(SOUNDS)) {
      expect(layers.length).toBeLessThanOrEqual(AUDIO_MIX.maxVoices);
    }
  });
});

describe('haptics and impact tuning', () => {
  it('keeps every vibration pattern short (CLAUDE.md §5)', () => {
    for (const [id, pattern] of Object.entries(HAPTICS)) {
      const total = pattern.reduce((sum, ms) => sum + ms, 0);
      expect(total, id).toBeLessThanOrEqual(300);
      expect(
        pattern.every((ms) => ms > 0),
        id,
      ).toBe(true);
    }
  });

  it('makes heavy hits land harder than normal ones', () => {
    expect(IMPACT.hitStopMs.heavy).toBeGreaterThan(IMPACT.hitStopMs.normal);
    expect(IMPACT.sparks.heavy).toBeGreaterThan(IMPACT.sparks.normal);
    expect(IMPACT.sparks.heavy).toBeLessThanOrEqual(IMPACT.sparks.poolSize);
  });
});

describe('feedback cues', () => {
  const setup = (settings: Partial<Settings>) => {
    const played: SoundId[] = [];
    const sfx: Sfx = {
      play: (id) => played.push(id),
      setSuspended: () => undefined,
      dispose: () => undefined,
    };
    const current: Settings = { ...DEFAULT_SETTINGS, ...settings };
    return { played, feedback: createFeedback(sfx, () => current), current };
  };

  it('plays the sound mapped to each cue', () => {
    const { played, feedback } = setup({});
    feedback.cue('hitHeavy');
    feedback.cue('deny');
    expect(played).toEqual([CUES.hitHeavy.sound, CUES.deny.sound]);
  });

  it('stays silent when sound is off, and reads the setting at the moment of the cue', () => {
    const { played, feedback, current } = setup({ sound: false });
    feedback.cue('strike');
    expect(played).toEqual([]);
    current.sound = true;
    feedback.cue('strike');
    expect(played).toEqual(['strike']);
  });
});
