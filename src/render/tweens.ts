import { clamp } from '../core/math';

interface Tween {
  elapsed: number;
  readonly duration: number;
  readonly update: (t: number) => void;
  readonly done: (() => void) | undefined;
}

/** Minimal time-based animation runner, advanced by the game loop (so pausing freezes it). */
export interface TweenRunner {
  add(durationMs: number, update: (t: number) => void, done?: () => void): void;
  update(dtMs: number): void;
  /** Finishes every running tween immediately (used on restart). */
  finishAll(): void;
  readonly active: number;
}

export function createTweenRunner(): TweenRunner {
  let tweens: Tween[] = [];
  return {
    add(duration, update, done) {
      tweens.push({ elapsed: 0, duration: Math.max(1, duration), update, done });
      update(0);
    },
    update(dtMs) {
      if (tweens.length === 0) return;
      const finished: Tween[] = [];
      for (const tween of tweens) {
        tween.elapsed += dtMs;
        const t = clamp(tween.elapsed / tween.duration, 0, 1);
        tween.update(t);
        if (t >= 1) finished.push(tween);
      }
      if (finished.length === 0) return;
      tweens = tweens.filter((tween) => !finished.includes(tween));
      for (const tween of finished) tween.done?.();
    },
    finishAll() {
      const all = tweens;
      tweens = [];
      for (const tween of all) {
        tween.update(1);
        tween.done?.();
      }
    },
    get active() {
      return tweens.length;
    },
  };
}
