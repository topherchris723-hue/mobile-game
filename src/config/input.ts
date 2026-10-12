/**
 * Gesture thresholds in CSS pixels / milliseconds. Tuned so a quick flick is a swipe and a
 * still thumb is a hold, and the two can never both fire for one touch (CLAUDE.md §6).
 */
export const GESTURE = {
  /** Vertical travel needed to count as a lane swipe. */
  swipeMinDistancePx: 24,
  /** Swipes must be mostly vertical: |dy| must exceed |dx| × this ratio. */
  swipeDirectionRatio: 1.2,
  /** A touch held this long without moving becomes a hold (guard). */
  holdMinDurationMs: 180,
  /** Movement allowed before a pending hold is cancelled. Must stay below swipeMinDistancePx. */
  holdMaxMovementPx: 12,
} as const;

/** Lane and guard gestures are read from the left part of the screen; cards will use the right. */
export const MOVEMENT_ZONE_WIDTH_FRACTION = 0.5;
