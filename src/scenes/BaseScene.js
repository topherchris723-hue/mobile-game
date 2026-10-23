// Shared scene plumbing: logical-unit camera, sharp text, buttons with instant press feedback,
// fade transitions, re-layout on resize, and a registry of touch targets for the Playwright checks.
import Phaser from 'phaser';
import { COLORS, FONT, hex } from '../ui/theme.js';
import { t } from '../ui/strings.js';
import { data } from '../ui/game-data.js';
import { sfx } from '../ui/feedback.js';
import { TEST_HOOKS, testHooks } from '../ui/test-hooks.js';

export class BaseScene extends Phaser.Scene {
  init(initData) {
    this.initData = initData || {};
    this.leaving = false;
    this.targets = [];
  }

  /** Call first in create(). */
  setupView(bgColor) {
    this.vp = this.registry.get('viewport');
    this.W = this.vp.W;
    this.H = this.vp.H;
    const cam = this.cameras.main;
    cam.setOrigin(0, 0);
    cam.setZoom(this.vp.zoom);
    cam.setScroll(0, 0);
    cam.setBackgroundColor(bgColor !== undefined ? bgColor : COLORS.bg);
    cam.fadeIn(180, 5, 6, 13);
    const onViewport = () => {
      if (!this.leaving) this.scene.restart(this.restartData());
    };
    this.game.events.on('viewport-changed', onViewport);
    this.events.once('shutdown', () => this.game.events.off('viewport-changed', onViewport));
    const T = TEST_HOOKS ? testHooks() : null;
    if (T) T.sceneKey = this.scene.key;
  }

  /** Data used to rebuild this scene after a resize. */
  restartData() {
    return this.initData;
  }

  /** Text in logical px, rendered at device resolution. */
  text(x, y, str, size, color, extra) {
    const style = Object.assign(
      {
        fontFamily: FONT,
        fontSize: Math.max(12, size || 16) + 'px',
        color: color || COLORS.text,
        resolution: this.vp.zoom,
      },
      extra || {}
    );
    return this.add.text(x, y, str, style);
  }

  registerTarget(id, rectFn, enabledFn) {
    const t0 = { id: id, rect: rectFn, enabled: enabledFn || (() => true) };
    this.targets.push(t0);
    return t0;
  }

  /**
   * A button: rounded rect + label. Press state on pointerdown (scale + highlight, < 1 frame),
   * action on release inside. kind: 'primary' | 'secondary' | 'danger' | 'disabled'.
   * armMs: ignore presses for this long after the button is created, so the second tap of a double tap
   * that opened a menu cannot hit a button drawn under the finger (BUG-2-03). Use it for every new menu.
   */
  button(opts) {
    const o = Object.assign({ kind: 'primary', fontSize: 20, enabled: true }, opts);
    const w = o.w;
    const h = o.h;
    const c = this.add.container(o.x + w / 2, o.y + h / 2);
    const g = this.add.graphics();
    const label = this.text(0, o.sublabel ? -8 : 0, o.label, o.fontSize, o.kind === 'primary' ? COLORS.textDark : COLORS.text, {
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: w - 16 },
    }).setOrigin(0.5);
    c.add([g, label]);
    let sub = null;
    if (o.sublabel) {
      sub = this.text(0, 12, o.sublabel, 12, o.kind === 'primary' ? COLORS.textDark : COLORS.textDim, { align: 'center' }).setOrigin(0.5);
      c.add(sub);
    }
    const state = { enabled: o.enabled && o.kind !== 'disabled', pressed: false, kind: o.kind };
    const draw = () => {
      g.clear();
      let fill = COLORS.accent;
      let stroke = 0xffffff;
      if (state.kind === 'secondary') {
        fill = COLORS.panelLight;
        stroke = COLORS.stroke;
      } else if (state.kind === 'danger') {
        fill = 0xb83a3a;
        stroke = 0xff9a9a;
      }
      if (!state.enabled) {
        fill = COLORS.disabled;
        stroke = 0x555a78;
      }
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      if (state.pressed) {
        g.fillStyle(0xffffff, 0.25);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      }
      g.lineStyle(2, stroke, state.enabled ? 0.9 : 0.4);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      label.setColor(state.enabled ? (state.kind === 'primary' ? COLORS.textDark : COLORS.text) : COLORS.textDim);
    };
    draw();
    const zone = this.add.zone(o.x, o.y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const armedAt = performance.now() + (o.armMs || 0);
    zone.on('pointerdown', () => {
      if (this.leaving) return;
      if (performance.now() < armedAt) return;
      state.pressed = true;
      c.setScale(0.95);
      draw();
      sfx(state.enabled ? 'ui_press' : 'ui_denied');
    });
    const release = (fire) => {
      if (!state.pressed) return;
      state.pressed = false;
      draw();
      this.tweens.add({ targets: c, scale: 1, duration: 90, ease: 'Back.Out' });
      if (!fire) return;
      if (state.enabled) {
        if (o.onTap) o.onTap();
      } else {
        this.shake(c);
        if (o.onDisabledTap) o.onDisabledTap();
      }
    };
    zone.on('pointerup', () => release(true));
    zone.on('pointerout', () => release(false));
    this.registerTarget(o.id, () => ({ x: o.x, y: o.y, w: w, h: h }), () => state.enabled);
    return {
      container: c,
      zone: zone,
      label: label,
      setEnabled(v) {
        state.enabled = v;
        draw();
      },
      setLabel(s) {
        label.setText(s);
      },
    };
  }

  shake(obj) {
    const x0 = obj.x;
    this.tweens.add({
      targets: obj,
      x: { from: x0 - 6, to: x0 },
      duration: 220,
      ease: 'Elastic.Out',
      onComplete: () => (obj.x = x0),
    });
  }

  /** Small transient message (toast) near the bottom third. */
  toast(msg, y) {
    const ty = y !== undefined ? y : this.H * 0.62;
    const txt = this.text(this.W / 2, ty, msg, 14, COLORS.text, { align: 'center', wordWrap: { width: this.W - 48 } }).setOrigin(0.5);
    const pad = 10;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRoundedRect(this.W / 2 - txt.width / 2 - pad, ty - txt.height / 2 - pad / 2, txt.width + pad * 2, txt.height + pad, 10);
    const cont = this.add.container(0, 0, [bg, txt]).setDepth(1000).setAlpha(0);
    this.tweens.add({ targets: cont, alpha: 1, y: -6, duration: 120 });
    this.time.delayedCall(1700, () => this.tweens.add({ targets: cont, alpha: 0, duration: 250, onComplete: () => cont.destroy() }));
  }

  /** Top bar: back button (left, 44×44), title, Jade balance (right, GDD §4). */
  topBar(title, backTo, backData) {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bgTop, 1);
    g.fillRect(0, 0, this.W, 52);
    g.lineStyle(1, COLORS.stroke, 0.6);
    g.lineBetween(0, 52, this.W, 52);
    if (backTo) {
      this.button({
        id: 'back',
        x: 4,
        y: 4,
        w: 44,
        h: 44,
        label: t('back_icon'),
        kind: 'secondary',
        fontSize: 18,
        onTap: () => this.goTo(backTo, backData || {}),
      });
    }
    const jade = this.jadeLabel(this.W - 12, 26);
    if (title) {
      const x = backTo ? 58 : 14;
      const maxW = jade.name.x - jade.name.width - 12 - x;
      const tt = this.text(x, 26, title, 20, COLORS.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
      let str = title;
      while (tt.width > maxW && str.length > 1) {
        str = str.slice(0, -1);
        tt.setText(str.trimEnd() + '…');
      }
    }
  }

  jadeLabel(rightX, cy) {
    const cur = data.currenciesById.cur_jade;
    const txt = this.text(rightX, cy, String(data.jade()), 16, COLORS.text, { fontStyle: 'bold' }).setOrigin(1, 0.5);
    const g = this.add.graphics();
    const ix = rightX - txt.width - 14;
    g.fillStyle(0x3ddc97, 1);
    g.fillPoints(
      [
        { x: ix, y: cy - 8 },
        { x: ix + 7, y: cy },
        { x: ix, y: cy + 8 },
        { x: ix - 7, y: cy },
      ],
      true
    );
    const name = this.text(ix - 12, cy, cur ? cur.name : '', 12, COLORS.textDim).setOrigin(1, 0.5);
    return { txt, g, name };
  }

  goTo(key, sceneData) {
    if (this.leaving) return;
    this.leaving = true;
    sfx('ui_transition');
    this.cameras.main.fadeOut(160, 5, 6, 13);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, sceneData || {}));
  }

  /** CSS-px rectangles of all touch targets (used by the Playwright checks). */
  targetsInCss() {
    const canvas = this.game.canvas.getBoundingClientRect();
    const k = canvas.width / this.W;
    return this.targets.map((tg) => {
      const r = tg.rect();
      return {
        id: tg.id,
        enabled: tg.enabled(),
        x: canvas.left + r.x * k,
        y: canvas.top + r.y * k,
        w: r.w * k,
        h: r.h * k,
        logical: r,
      };
    });
  }
}

export { t };
export function backLabel() {
  return t('back');
}
export { hex };
