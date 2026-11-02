// Settings screen helpers (GDD §19). Pure: no Phaser, unit-tested.

export const VOLUME_STEP = 0.1;
export const VOLUME_KEYS = ['master_volume', 'bgm_volume', 'sfx_volume'];
export const TOGGLE_KEYS = ['muted', 'reduce_motion', 'haptics'];

/** Round to the 0.1 grid and clamp to [0, 1] (stored rounded to 1 decimal, ruling R4-1). */
export function snapVolume(v) {
  const n = Math.round((Number(v) || 0) * 10) / 10;
  return Math.max(0, Math.min(1, n));
}

/** One − / + step from v (dir −1 / +1). */
export function stepVolume(v, dir) {
  return snapVolume(snapVolume(v) + dir * VOLUME_STEP);
}

/** Slider x (0..1 along the track) → snapped volume. */
export function volumeFromTrack(frac) {
  return snapVolume(frac);
}

/** 0.7 → 70 (shown as "70%"). */
export function percent(v) {
  return Math.round(snapVolume(v) * 100);
}

/** Which volume changes play the ui_slider preview (§19: Master and Sound effects, not Music). */
export function previewsOnChange(key) {
  return key === 'master_volume' || key === 'sfx_volume';
}
