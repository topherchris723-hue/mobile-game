import { describe, expect, it } from 'vitest';
import { CHARACTER } from '../../src/config/palette';
import { celShadow, desaturate, mixColor, toCss } from '../../src/render/color';

describe('colour rules', () => {
  it('mixes channel by channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0x123456, 0xabcdef, 0)).toBe(0x123456);
    expect(mixColor(0x123456, 0xabcdef, 1)).toBe(0xabcdef);
  });

  it('desaturates toward luminance, leaving greys unchanged', () => {
    expect(desaturate(0x808080, 0.5)).toBe(0x808080);
    const r = desaturate(0xff0000, 1);
    expect(r >> 16).toBe(r & 0xff);
  });

  it('makes cel shadows darker and cooler (violet-shifted), never a plain grey', () => {
    const base = 0xf87844;
    const shadow = celShadow(base);
    expect(shadow).toBe(mixColor(base, CHARACTER.celShadowTarget, CHARACTER.celShadowStrength));
    const channels = (c: number) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff] as const;
    const [br, bg, bb] = channels(base);
    const [sr, sg, sb] = channels(shadow);
    expect(sr + sg + sb).toBeLessThan(br + bg + bb);
    expect(sb / sr).toBeGreaterThan(bb / br);
    expect(new Set([sr, sg, sb]).size).toBeGreaterThan(1);
  });

  it('formats CSS colours', () => {
    expect(toCss(0x1e1424)).toBe('rgb(30 20 36)');
    expect(toCss(0x1e1424, 0.5)).toBe('rgb(30 20 36 / 0.5)');
  });
});
