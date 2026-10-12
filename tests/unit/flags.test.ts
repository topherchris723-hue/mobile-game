import { describe, expect, it } from 'vitest';
import { parseLaunchFlags } from '../../src/core/flags';

describe('parseLaunchFlags', () => {
  it('defaults everything off', () => {
    expect(parseLaunchFlags('')).toEqual({ debug: false, benchmark: false });
  });

  it('accepts 1 and true', () => {
    expect(parseLaunchFlags('?debug=1&bench=true')).toEqual({ debug: true, benchmark: true });
  });

  it('treats other values as off', () => {
    expect(parseLaunchFlags('?debug=0&bench=yes')).toEqual({ debug: false, benchmark: false });
  });
});
