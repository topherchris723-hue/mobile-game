import { MOVEMENT_ZONE_WIDTH_FRACTION } from '../config/input';
import type { ArenaCommand } from '../game/arena';
import { createGestureRecognizer, type GestureEvent } from './gestures';

export interface MovementInput {
  /** Commands gathered since the last call; the caller owns the array until the next call. */
  drainCommands(): readonly ArenaCommand[];
  /** Runs hold detection; call once per rendered frame. */
  update(now: number): void;
  dispose(): void;
}

/**
 * Reads lane swipes and guard holds from the left part of `surface` and buffers them as
 * arena commands for the next simulation tick (never applied straight from event handlers).
 */
export function createMovementInput(surface: HTMLElement, fighterId: number): MovementInput {
  const recognizer = createGestureRecognizer();
  const gestureBuffer: GestureEvent[] = [];
  let pending: ArenaCommand[] = [];
  let spare: ArenaCommand[] = [];
  /** Guard stays up while at least one hold is active (two thumbs may both hold). */
  let activeHolds = 0;
  const ownedPointers = new Set<number>();

  const flushGestures = (): void => {
    for (const gesture of gestureBuffer) {
      if (gesture.kind === 'swipe') {
        pending.push({ kind: 'step', fighterId, direction: gesture.direction });
      } else if (gesture.kind === 'holdStart') {
        activeHolds++;
        if (activeHolds === 1) pending.push({ kind: 'guard', fighterId, active: true });
      } else {
        activeHolds = Math.max(0, activeHolds - 1);
        if (activeHolds === 0) pending.push({ kind: 'guard', fighterId, active: false });
      }
    }
    gestureBuffer.length = 0;
  };

  const onDown = (event: PointerEvent): void => {
    const bounds = surface.getBoundingClientRect();
    if (event.clientX - bounds.left > bounds.width * MOVEMENT_ZONE_WIDTH_FRACTION) return;
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
    ownedPointers.add(event.pointerId);
    recognizer.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
  };
  const onMove = (event: PointerEvent): void => {
    if (!ownedPointers.has(event.pointerId)) return;
    recognizer.move(event.pointerId, event.clientX, event.clientY, gestureBuffer);
    flushGestures();
  };
  const onEnd = (event: PointerEvent): void => {
    if (!ownedPointers.delete(event.pointerId)) return;
    recognizer.up(event.pointerId, gestureBuffer);
    flushGestures();
  };
  const onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerup', onEnd);
  surface.addEventListener('pointercancel', onEnd);
  surface.addEventListener('contextmenu', onContextMenu);

  return {
    drainCommands() {
      const out = pending;
      pending = spare;
      spare = out;
      pending.length = 0;
      return out;
    },
    update(now) {
      recognizer.update(now, gestureBuffer);
      flushGestures();
    },
    dispose() {
      surface.removeEventListener('pointerdown', onDown);
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerup', onEnd);
      surface.removeEventListener('pointercancel', onEnd);
      surface.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
