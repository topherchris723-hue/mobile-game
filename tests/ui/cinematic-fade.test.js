// ui-developer round 5, BUG-4-01 / L-ui-006: the cinematic overlay is hidden within 160 ms of freeze_end
// (AC-17.8), measured from the frame the event is handled, for any frame phase and frame times of 16.7 and 33 ms.
import { describe, it, expect } from 'vitest';
import { cinematicFadeAlpha, CINEMATIC_FADE_MS, CINEMATIC_HIDE_LIMIT_MS } from '../../src/ui/hud-state.js';

/** Frame-driven model of BattleScene: fade starts at the handling frame; returns { lastVisible, firstHidden } ms. */
function simulate(fadeMs, frameMs, startDelayFrames) {
  const start = startDelayFrames * frameMs; // 0 = same frame (fixed); 1 = next frame (R4 tween)
  let lastVisible = 0;
  for (let t = 0; t < 1000; t += frameMs) {
    if (t < start) { lastVisible = t; continue; }
    if (cinematicFadeAlpha(t, start, fadeMs) === null) return { lastVisible, firstHidden: t };
    lastVisible = t;
  }
  return { lastVisible, firstHidden: null };
}

describe('BUG-4-01: cinematic overlay fade (AC-17.8)', () => {
  it('positive control: right after freeze_end the overlay is still drawn, then it fades', () => {
    expect(cinematicFadeAlpha(0, 0, CINEMATIC_FADE_MS)).toBe(1);
    expect(cinematicFadeAlpha(CINEMATIC_FADE_MS / 2, 0, CINEMATIC_FADE_MS)).toBeCloseTo(0.5, 5);
    expect(cinematicFadeAlpha(CINEMATIC_FADE_MS, 0, CINEMATIC_FADE_MS)).toBeNull();
  });
  it('the fade is at least one frame (17 ms) shorter than the 160 ms limit', () => {
    expect(CINEMATIC_FADE_MS).toBeLessThanOrEqual(CINEMATIC_HIDE_LIMIT_MS - 17);
  });
  for (const frameMs of [1000 / 60, 1000 / 30]) {
    it(`frames of ${frameMs.toFixed(1)} ms: last drawn frame < 160 ms and first hidden frame ≤ 160 ms after the event`, () => {
      const r = simulate(CINEMATIC_FADE_MS, frameMs, 0);
      expect(r.lastVisible).toBeLessThan(CINEMATIC_HIDE_LIMIT_MS);
      expect(r.firstHidden).toBeLessThanOrEqual(CINEMATIC_HIDE_LIMIT_MS);
    });
  }
  it('must-FAIL: the round-4 timing (160 ms tween starting one frame late) breaks the limit', () => {
    const r = simulate(160, 1000 / 60, 1);
    expect(r.lastVisible).toBeGreaterThan(CINEMATIC_HIDE_LIMIT_MS);
  });
});
