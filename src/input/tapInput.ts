import { TAP } from '../config/input';

export interface PointerSample {
  readonly x: number;
  readonly y: number;
  readonly time: number;
}

/** Pure tap rule, unit-tested: short and nearly still. */
export function isTap(down: PointerSample, up: PointerSample): boolean {
  return (
    Math.hypot(up.x - down.x, up.y - down.y) <= TAP.maxMovementPx &&
    up.time - down.time <= TAP.maxDurationMs
  );
}

export interface TapInput {
  dispose(): void;
}

/**
 * Reports taps on `surface` in CSS pixels relative to its top-left corner. Each finger is tracked
 * separately; a touch that drags or lingers is not a tap. Callers turn taps into simulation
 * commands; nothing here touches game state (CLAUDE.md §6).
 */
export function createTapInput(
  surface: HTMLElement,
  onTap: (x: number, y: number) => void,
): TapInput {
  const downs = new Map<number, PointerSample>();

  const onDown = (event: PointerEvent): void => {
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
    downs.set(event.pointerId, { x: event.clientX, y: event.clientY, time: event.timeStamp });
  };
  const onUp = (event: PointerEvent): void => {
    const down = downs.get(event.pointerId);
    downs.delete(event.pointerId);
    if (!down) return;
    if (!isTap(down, { x: event.clientX, y: event.clientY, time: event.timeStamp })) return;
    const bounds = surface.getBoundingClientRect();
    onTap(event.clientX - bounds.left, event.clientY - bounds.top);
  };
  const onCancel = (event: PointerEvent): void => {
    downs.delete(event.pointerId);
  };
  const onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('pointerup', onUp);
  surface.addEventListener('pointercancel', onCancel);
  surface.addEventListener('contextmenu', onContextMenu);
  return {
    dispose() {
      surface.removeEventListener('pointerdown', onDown);
      surface.removeEventListener('pointerup', onUp);
      surface.removeEventListener('pointercancel', onCancel);
      surface.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
