/** URL switches for on-device diagnostics (CLAUDE.md §8). Read once at boot. */
export interface LaunchFlags {
  /** `?debug=1` — FPS overlay, log panel, and a read-only state hook for automated tests. */
  readonly debug: boolean;
  /** `?bench=1` — worst-case duel load (six fighters, dense effects) to measure performance. */
  readonly benchmark: boolean;
}

export function parseLaunchFlags(search: string): LaunchFlags {
  const params = new URLSearchParams(search);
  const isOn = (key: string): boolean => {
    const value = params.get(key);
    return value === '1' || value === 'true';
  };
  return { debug: isOn('debug'), benchmark: isOn('bench') };
}
