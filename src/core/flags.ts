/** URL switches for on-device diagnostics (CLAUDE.md §8). Read once at boot. */
export interface LaunchFlags {
  /** `?debug=1` — FPS overlay, log panel, and a read-only state hook for automated tests. */
  readonly debug: boolean;
  /** `?bench=1` — dense effects to measure rendering headroom. */
  readonly benchmark: boolean;
  /** `?speed=N` — animation speed multiplier (0.25–20), for testing long battles quickly. */
  readonly speed: number;
}

export function parseLaunchFlags(search: string): LaunchFlags {
  const params = new URLSearchParams(search);
  const isOn = (key: string): boolean => {
    const value = params.get(key);
    return value === '1' || value === 'true';
  };
  const speed = Number(params.get('speed') ?? '1');
  return {
    debug: isOn('debug'),
    benchmark: isOn('bench'),
    speed: Number.isFinite(speed) && speed > 0 ? Math.min(20, Math.max(0.25, speed)) : 1,
  };
}
