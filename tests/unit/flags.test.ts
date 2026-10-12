import { describe, expect, it } from 'vitest';
import { parseLaunchFlags } from '../../src/core/flags';

describe('parseLaunchFlags', () => {
  it('defaults everything off at normal speed', () => {
    expect(parseLaunchFlags('')).toEqual({ debug: false, benchmark: false, speed: 1 });
  });

  it('accepts 1 and true', () => {
    expect(parseLaunchFlags('?debug=1&bench=true')).toMatchObject({ debug: true, benchmark: true });
  });

  it('treats other values as off', () => {
    expect(parseLaunchFlags('?debug=0&bench=yes')).toMatchObject({
      debug: false,
      benchmark: false,
    });
  });

  it('clamps speed and ignores nonsense', () => {
    expect(parseLaunchFlags('?speed=4').speed).toBe(4);
    expect(parseLaunchFlags('?speed=999').speed).toBe(20);
    expect(parseLaunchFlags('?speed=0.01').speed).toBe(0.25);
    expect(parseLaunchFlags('?speed=fast').speed).toBe(1);
    expect(parseLaunchFlags('?speed=-2').speed).toBe(1);
  });
});
