// Safety and performance limiters (GDD §17.3, §17.4). Pure, time-injected (real ms), no allocation per call
// except where noted. Each one is fed `now` by the caller so tests can drive exact timelines.

/**
 * Screen-flash limiter: at most `max` flash STARTS in any rolling 1,000 ms window (start > now − window).
 * A request over the limit is dropped (not delayed) and does not count. AC-17.3.
 */
export class FlashLimiter {
  constructor(max, windowMs) {
    this.max = Math.max(0, Math.min(3, max === undefined ? 3 : max)); // never above 3 (WCAG 2.3.1)
    this.windowMs = windowMs || 1000;
    this.starts = new Float64Array(Math.max(1, this.max)); // ring buffer of the last `max` accepted starts
    this.n = 0;
    this.head = 0;
  }

  /** Count of accepted starts with start > now − window. */
  countInWindow(now) {
    let c = 0;
    for (let i = 0; i < this.n; i++) if (this.starts[i] > now - this.windowMs) c += 1;
    return c;
  }

  /** True if a flash may start now (and records it). False = drop it. */
  request(now) {
    if (this.max === 0) return false;
    if (this.countInWindow(now) >= this.max) return false;
    this.starts[this.head] = now;
    this.head = (this.head + 1) % this.max;
    if (this.n < this.max) this.n += 1;
    return true;
  }

  reset() {
    this.n = 0;
    this.head = 0;
  }
}

/**
 * Sprite (fighter hit-flash) gate per sprite: a new ONSET at most once per `minIntervalMs`. A hit inside the interval
 * while the tint is still lit refreshes it (holds it lit) instead of re-flashing; a hit inside the interval after the
 * tint went dark is dropped (no visible flash). AC-17.4.
 * Level profile: onset → full, linear fade over `fadeMs`; each refresh holds full for `holdMs`, then fades.
 */
export class SpriteFlashGate {
  constructor(minIntervalMs) {
    this.minInterval = Math.max(334, minIntervalMs || 334);
    this.lastOnset = -Infinity;
    this.holdUntil = -Infinity; // full level until this time
    this.fadeMs = 167;
    this.full = 0;
    this.onsets = 0;
  }

  /** Current tint level 0..full at time `now`. */
  level(now) {
    if (now <= this.holdUntil) return this.full;
    const k = 1 - (now - this.holdUntil) / this.fadeMs;
    return k > 0 ? this.full * k : 0;
  }

  /**
   * A hit wants a flash. Returns 'onset' | 'refresh' | 'dropped'.
   * holdMs: how long a refresh keeps the tint at full (covers multi-hit intervals so it never flickers).
   */
  hit(now, alpha, fadeMs, holdMs) {
    const lit = this.level(now) > 0;
    if (now - this.lastOnset >= this.minInterval) {
      this.lastOnset = now;
      this.onsets += 1;
      this.full = lit ? Math.max(this.full, alpha) : alpha;
      this.fadeMs = Math.max(16, fadeMs);
      this.holdUntil = lit ? Math.max(this.holdUntil, now + (holdMs || 0)) : now;
      return 'onset';
    }
    if (lit) {
      this.holdUntil = Math.max(this.holdUntil, now + (holdMs === undefined ? 100 : holdMs));
      return 'refresh';
    }
    return 'dropped';
  }

  /** Lit from the first onset until the fade after the last hit ends. */
  litUntil() {
    return this.holdUntil + this.fadeMs;
  }

  reset() {
    this.lastOnset = -Infinity;
    this.holdUntil = -Infinity;
    this.full = 0;
  }
}

/**
 * Camera shake gate: intensity ≤ maxIntensity, duration ≤ maxMs, one shake at a time; a new shake replaces the
 * running one only if its intensity is strictly higher (§17.3).
 */
export class ShakeGate {
  constructor(maxIntensity, maxMs) {
    this.maxIntensity = Math.min(0.012, maxIntensity === undefined ? 0.012 : maxIntensity);
    this.maxMs = Math.min(300, maxMs === undefined ? 300 : maxMs);
    this.until = -Infinity;
    this.intensity = 0;
  }

  /** Returns null (refused) or { ms, intensity } clamped to the limits. */
  request(now, ms, intensity) {
    const i = Math.min(this.maxIntensity, Math.max(0, intensity || 0));
    const d = Math.min(this.maxMs, Math.max(0, ms || 0));
    if (i <= 0 || d <= 0) return null;
    const running = now < this.until;
    if (running && i <= this.intensity) return null;
    this.until = now + d;
    this.intensity = i;
    return { ms: d, intensity: i };
  }

  running(now) {
    return now < this.until;
  }

  stop() {
    this.until = -Infinity;
    this.intensity = 0;
  }
}

/**
 * Auto quality: starts 'high'; switches to 'low' once the median frame time over the last `windowFrames` frames
 * exceeds `thresholdMs`, and never switches back in this scene (§17.4). Median is computed every `everyFrames`.
 */
export class QualityMonitor {
  constructor(windowFrames, thresholdMs, everyFrames) {
    this.window = Math.max(1, windowFrames || 120);
    this.threshold = thresholdMs || 22.2;
    this.every = everyFrames || 10;
    this.buf = new Float64Array(this.window);
    this.tmp = new Float64Array(this.window);
    this.n = 0;
    this.head = 0;
    this.sinceCheck = 0;
    this.quality = 'high';
    this.lastMedian = 0;
  }

  /** Feed one frame time (ms). Returns the current quality. */
  frame(ms) {
    if (!(ms > 0) || this.quality === 'low') return this.quality;
    this.buf[this.head] = ms;
    this.head = (this.head + 1) % this.window;
    if (this.n < this.window) this.n += 1;
    this.sinceCheck += 1;
    if (this.n >= this.window && this.sinceCheck >= this.every) {
      this.sinceCheck = 0;
      this.lastMedian = this.median();
      if (this.lastMedian > this.threshold) this.quality = 'low';
    }
    return this.quality;
  }

  median() {
    const n = this.n;
    if (n === 0) return 0;
    const t = this.tmp.subarray(0, n);
    t.set(this.buf.subarray(0, n));
    t.sort();
    return n % 2 ? t[(n - 1) >> 1] : (t[n / 2 - 1] + t[n / 2]) / 2;
  }
}
