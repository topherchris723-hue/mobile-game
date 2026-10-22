// Gesture recognizer (GDD §5.2). Pure: feed it pointer samples (logical px, ms); it calls back.
//  - tap: moved < 12 px and lasted < 300 ms (fired on release, at the start point)
//  - swipe: moved ≥ 24 px within 300 ms (fired as soon as the threshold is crossed);
//    direction = dominant axis, |dy| ≥ |dx| ⇒ vertical (a tie goes to vertical, AC-5.2.3)
//  - long-press: held ≥ 400 ms without moving 12 px (fires once; release ends it, never a tap)

export const GESTURE = {
  tapMaxMovePx: 12,
  tapMaxMs: 300,
  swipeMinPx: 24,
  swipeMaxMs: 300,
  longPressMs: 400,
};

export class GestureTracker {
  /** cb = { onDown(x,y), onTap(x,y), onSwipe(dir, x0, y0), onLongPress(x,y), onLongPressEnd(), onCancel() } */
  constructor(cb, cfg) {
    this.cb = cb;
    this.cfg = Object.assign({}, GESTURE, cfg || {});
    this.active = null;
  }

  down(id, x, y, t) {
    if (this.active) return; // one thumb: ignore extra fingers
    this.active = { id, x0: x, y0: y, t0: t, moved: false, done: false, long: false };
    if (this.cb.onDown) this.cb.onDown(x, y);
  }

  move(id, x, y, t) {
    const a = this.active;
    if (!a || a.id !== id || a.done) return;
    const dx = x - a.x0;
    const dy = y - a.y0;
    const dist = Math.hypot(dx, dy);
    if (dist >= this.cfg.tapMaxMovePx && !a.moved) {
      a.moved = true;
      if (!a.long && this.cb.onCancel) this.cb.onCancel();
    }
    if (!a.long && dist >= this.cfg.swipeMinPx && t - a.t0 <= this.cfg.swipeMaxMs) {
      a.done = true;
      this.cb.onSwipe(swipeDir(dx, dy), a.x0, a.y0);
    }
  }

  up(id, x, y, t) {
    const a = this.active;
    if (!a || a.id !== id) return;
    this.active = null;
    if (a.long) {
      if (this.cb.onLongPressEnd) this.cb.onLongPressEnd();
      return;
    }
    if (a.done) return;
    const dx = x - a.x0;
    const dy = y - a.y0;
    const dist = Math.hypot(dx, dy);
    const dur = t - a.t0;
    if (dist >= this.cfg.swipeMinPx && dur <= this.cfg.swipeMaxMs) {
      this.cb.onSwipe(swipeDir(dx, dy), a.x0, a.y0);
      return;
    }
    if (dist < this.cfg.tapMaxMovePx && dur < this.cfg.tapMaxMs) {
      this.cb.onTap(a.x0, a.y0);
      return;
    }
    if (this.cb.onCancel) this.cb.onCancel();
  }

  /** Call every frame for long-press timing. */
  update(t) {
    const a = this.active;
    if (!a || a.done || a.long || a.moved) return;
    if (t - a.t0 >= this.cfg.longPressMs) {
      a.long = true;
      if (this.cb.onLongPress) this.cb.onLongPress(a.x0, a.y0);
    }
  }

  cancel() {
    if (this.active && this.active.long && this.cb.onLongPressEnd) this.cb.onLongPressEnd();
    this.active = null;
  }
}

export function swipeDir(dx, dy) {
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'up' : 'down';
  return dx > 0 ? 'right' : 'left';
}
