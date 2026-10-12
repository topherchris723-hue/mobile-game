import { GESTURE } from '../config/input';

/** `direction` −1 = swipe up (toward the far lane), +1 = swipe down (toward the near lane). */
export type GestureEvent =
  | { readonly kind: 'swipe'; readonly direction: -1 | 1 }
  | { readonly kind: 'holdStart' }
  | { readonly kind: 'holdEnd' };

export type GestureThresholds = typeof GESTURE;

type TrackState = 'pending' | 'holding' | 'consumed';

interface Track {
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  state: TrackState;
  /** Cleared once the touch drifts too far to ever become a hold. */
  holdEligible: boolean;
}

const SWIPE_UP: GestureEvent = { kind: 'swipe', direction: -1 };
const SWIPE_DOWN: GestureEvent = { kind: 'swipe', direction: 1 };
const HOLD_START: GestureEvent = { kind: 'holdStart' };
const HOLD_END: GestureEvent = { kind: 'holdEnd' };

/**
 * Turns raw pointer positions into swipe and hold gestures, one gesture per touch:
 * a touch that has become a hold can never also swipe, and a swiped touch can never hold.
 * Pure (no DOM), so it is unit-tested directly; positions are CSS pixels, times milliseconds.
 */
export interface GestureRecognizer {
  down(pointerId: number, x: number, y: number, time: number): void;
  move(pointerId: number, x: number, y: number, out: GestureEvent[]): void;
  up(pointerId: number, out: GestureEvent[]): void;
  /** Promotes still touches to holds; call once per frame. */
  update(time: number, out: GestureEvent[]): void;
  /** Number of touches currently tracked. */
  readonly activeCount: number;
}

export function createGestureRecognizer(
  thresholds: GestureThresholds = GESTURE,
): GestureRecognizer {
  const tracks = new Map<number, Track>();

  return {
    down(pointerId, x, y, time) {
      tracks.set(pointerId, {
        startX: x,
        startY: y,
        startTime: time,
        state: 'pending',
        holdEligible: true,
      });
    },

    move(pointerId, x, y, out) {
      const track = tracks.get(pointerId);
      if (!track || track.state !== 'pending') return;
      const dx = x - track.startX;
      const dy = y - track.startY;
      if (Math.hypot(dx, dy) > thresholds.holdMaxMovementPx) track.holdEligible = false;

      const isVertical = Math.abs(dy) > Math.abs(dx) * thresholds.swipeDirectionRatio;
      if (isVertical && Math.abs(dy) >= thresholds.swipeMinDistancePx) {
        track.state = 'consumed';
        out.push(dy < 0 ? SWIPE_UP : SWIPE_DOWN);
      }
    },

    up(pointerId, out) {
      const track = tracks.get(pointerId);
      if (!track) return;
      if (track.state === 'holding') out.push(HOLD_END);
      tracks.delete(pointerId);
    },

    update(time, out) {
      for (const track of tracks.values()) {
        if (
          track.state === 'pending' &&
          track.holdEligible &&
          time - track.startTime >= thresholds.holdMinDurationMs
        ) {
          track.state = 'holding';
          out.push(HOLD_START);
        }
      }
    },

    get activeCount() {
      return tracks.size;
    },
  };
}
