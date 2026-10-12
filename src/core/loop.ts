import { MAX_FRAME_DELTA_MS } from '../config/sim';
import { advanceClock, createFixedStepClock, type FixedStepResult } from './fixedStep';

export interface LoopCallbacks {
  /** Advance the simulation by exactly one fixed tick. */
  update(): void;
  /**
   * Draw the current state; `alpha` interpolates between the last two ticks.
   * `frameDeltaMs` is the clamped wall time since the previous frame, for cosmetic smoothing only.
   */
  render(alpha: number, frameDeltaMs: number): void;
  /** Called after each frame with the measured cost of update + render, for the debug overlay. */
  frameMeasured?(frameDeltaMs: number, workMs: number): void;
}

export interface GameLoop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

/** requestAnimationFrame driver around the fixed-step clock. Stopping fully halts rendering to save battery. */
export function createGameLoop(callbacks: LoopCallbacks): GameLoop {
  const clock = createFixedStepClock();
  const result: FixedStepResult = { steps: 0, alpha: 0 };
  let frameHandle = 0;
  let lastTime = 0;
  let running = false;

  const frame = (now: number): void => {
    frameHandle = requestAnimationFrame(frame);
    const delta = now - lastTime;
    lastTime = now;

    const workStart = performance.now();
    advanceClock(clock, delta, result);
    for (let i = 0; i < result.steps; i++) callbacks.update();
    callbacks.render(result.alpha, Math.min(delta, MAX_FRAME_DELTA_MS));
    callbacks.frameMeasured?.(delta, performance.now() - workStart);
  };

  return {
    start() {
      if (running) return;
      running = true;
      // Resume without catch-up: time spent paused never reaches the simulation.
      clock.accumulatorMs = 0;
      lastTime = performance.now();
      frameHandle = requestAnimationFrame(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frameHandle);
    },
    get running() {
      return running;
    },
  };
}
