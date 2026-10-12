import { BATTLE_BACKGROUND_DESATURATION, CHARACTER } from '../config/palette';

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function pack(r: number, g: number, b: number): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Linear blend between two 0xRRGGBB colours. */
export function mixColor(from: number, to: number, t: number): number {
  const [r1, g1, b1] = channels(from);
  const [r2, g2, b2] = channels(to);
  return pack(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Moves a colour toward its own luminance grey by `amount` (0 = unchanged, 1 = grey). */
export function desaturate(color: number, amount: number): number {
  const [r, g, b] = channels(color);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return pack(r + (luma - r) * amount, g + (luma - g) * amount, b + (luma - b) * amount);
}

/** Cel shadow tone for a base colour: hue-shifted toward violet, never grey (style guide §4). */
export function celShadow(color: number): number {
  return mixColor(color, CHARACTER.celShadowTarget, CHARACTER.celShadowStrength);
}

/** Background colour adjusted for the battle readability rule (style guide §7). */
export function battleBackground(color: number): number {
  return desaturate(color, BATTLE_BACKGROUND_DESATURATION);
}

export function toCss(color: number, alpha = 1): string {
  const [r, g, b] = channels(color);
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}
