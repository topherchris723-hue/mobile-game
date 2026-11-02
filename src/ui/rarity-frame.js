// Summon rarity frames (STYLE_GUIDE §6, §11 item 8). Three cues at once — colour, star count (drawn by the caller)
// and FRAME SHAPE — so rarity reads without colour: ★3 single 2 px border, plain corners; ★4 double border
// (2 px + 1 px inset) with small notched corners; ★5 3 px gold border + inner glow + four corner gems.
import { rarityColor } from './summon-view.js';

export const FRAME_STYLE = {
  3: { borders: 1, notches: false, gems: 0, outer: 2 },
  4: { borders: 2, notches: true, gems: 0, outer: 2 },
  5: { borders: 1, notches: false, gems: 4, outer: 3, glow: true },
};
export const GEM_COLOR = 0xffc23d;

export function frameStyle(rarity) {
  return FRAME_STYLE[rarity] || FRAME_STYLE[3];
}

/** Draw the rarity frame into Graphics g (rounded rect x, y, w, h, radius r). Returns the style used. */
export function drawRarityFrame(g, x, y, w, h, r, rarity) {
  const st = frameStyle(rarity);
  const col = rarityColor(rarity);
  if (st.glow) {
    for (let i = 1; i <= 3; i++) {
      g.lineStyle(2, col, 0.22 / i);
      g.strokeRoundedRect(x + 2 + i * 2, y + 2 + i * 2, w - 4 - i * 4, h - 4 - i * 4, Math.max(2, r - i * 2));
    }
  }
  g.lineStyle(st.outer, col, 1);
  g.strokeRoundedRect(x, y, w, h, r);
  if (st.borders >= 2) {
    g.lineStyle(1, col, 0.9);
    g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 4));
  }
  if (st.notches) {
    // small notched corners: a dark triangle cut + a short diagonal edge at each corner
    const n = 7;
    g.fillStyle(0x0d1020, 1);
    g.lineStyle(2, col, 1);
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      g.fillTriangle(cx, cy, cx + sx * n, cy, cx, cy + sy * n);
      g.lineBetween(cx + sx * n, cy, cx, cy + sy * n);
    }
  }
  if (st.gems) {
    // four corner gems (gold diamonds with a dark outline)
    const d = 5;
    g.fillStyle(GEM_COLOR, 1);
    g.lineStyle(1, 0x14172b, 0.8);
    for (const [cx, cy] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) {
      const pts = [{ x: cx, y: cy - d }, { x: cx + d, y: cy }, { x: cx, y: cy + d }, { x: cx - d, y: cy }];
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    }
  }
  return st;
}

/** ★5 light sweep: a thin white band crossing the frame every 2 s (scene tween, masked to the frame). */
export function addLightSweep(scene, container, x, y, w, h, r) {
  const band = scene.add.graphics();
  band.fillStyle(0xffffff, 0.18);
  band.fillPoints([{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14 - h * 0.5, y: h }, { x: -h * 0.5, y: h }], true);
  band.setPosition(x - 20, y);
  const m = scene.make.graphics({ add: false });
  m.fillStyle(0xffffff);
  m.fillRoundedRect(x, y, w, h, r);
  band.setMask(m.createGeometryMask());
  if (container) container.add(band);
  scene.tweens.add({ targets: band, x: x + w + h * 0.5, duration: 700, repeat: -1, repeatDelay: 1300 });
  return band;
}
