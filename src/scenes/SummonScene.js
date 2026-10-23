// Summon screen (GDD §11.1). Banner, featured fighters, pity line, first-×10 line, Rates & rules, ×1 / ×10
// with cost and affordability, a confirm dialog (armed after 250 ms, never over the button that opened it),
// then summonAndSave → reveal. Rules and numbers come from src/logic via src/ui/summon-view.js.
import { BaseScene, t } from './BaseScene.js';
import { COLORS, auraColor } from '../ui/theme.js';
import { data } from '../ui/game-data.js';
import { drawAuraIcon } from '../ui/icons.js';
import { sfx } from '../ui/feedback.js';
import { summonScreenModel, rateTableModel, rejectText, rarityColor, stars } from '../ui/summon-view.js';
import { summonAndSave } from '../state/summon-save.js';
import { testHooks, testSeedParam } from '../ui/test-hooks.js';

const MENU_ARM_MS = 250; // GDD §11.1: the dialog ignores input for its first 250 ms (BUG-2-03 lesson)
const MODAL_DEPTH = 200;

export class SummonScene extends BaseScene {
  constructor() {
    super('Summon');
  }

  create() {
    this.setupView();
    const { W, H } = this;
    this.modal = null;
    this.processing = false;
    this.topBar(t('summon_title'), 'Home');
    this.currencyName = data.currenciesById.cur_jade ? data.currenciesById.cur_jade.name : '';
    const m = summonScreenModel(data.save, data.content, new Date().toISOString(), this.currencyName);
    this.model = m;
    this.ui = { pity: null, firstMulti: null, none: null, buttons: {} };
    if (!m.banner) {
      // AC-11.13: no open banner → the message and no Summon buttons.
      this.ui.none = this.text(W / 2, H * 0.42, m.noneText, 16, COLORS.textDim, { align: 'center', wordWrap: { width: W - 48 } }).setOrigin(0.5);
      return;
    }
    const extra = Math.max(0, H - 640);
    const panel = { x: 12, y: 60, w: W - 24, h: 190 + Math.round(extra * 0.45) };
    this.drawBanner(m, panel);

    let y = panel.y + panel.h + 20;
    this.ui.pity = this.text(W / 2, y, m.pityText, 14, COLORS.text, { fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    y += 24;
    if (m.firstMultiText) {
      this.ui.firstMulti = this.text(W / 2, y, m.firstMultiText, 14, COLORS.accentText, { fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
      this.tweens.add({ targets: this.ui.firstMulti, scale: { from: 1, to: 1.06 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    // Thumb zone (bottom): Rates, ×1, ×10. Primary buttons are full width − 32, 56 high (GDD §14).
    const bw = W - 32;
    const yMulti = H - 16 - 56;
    const ySingle = yMulti - 12 - 56;
    const yRates = ySingle - 12 - 44;
    this.button({ id: 'summon_rates', x: W / 2 - 90, y: yRates, w: 180, h: 44, label: t('summon_rates_button'), kind: 'secondary', fontSize: 15, onTap: () => this.openRates() });
    const [b1, b10] = m.buttons;
    this.ui.buttons[b1.id] = this.summonButton(b1, 16, ySingle, bw, 'secondary');
    this.ui.buttons[b10.id] = this.summonButton(b10, 16, yMulti, bw, 'primary');

    const T = testHooks();
    if (T) T.summonScreen = () => this.snapshot();
  }

  summonButton(b, x, y, w, kind) {
    const btn = this.button({
      id: b.id,
      x: x,
      y: y,
      w: w,
      h: 56,
      label: b.label,
      sublabel: b.ok ? undefined : b.sublabel,
      kind: kind,
      fontSize: 17,
      enabled: b.ok,
      onTap: () => this.openConfirm(b),
      onDisabledTap: () => this.toast(b.sublabel, y - 30),
    });
    btn.model = b;
    btn.baseEnabled = b.ok;
    return btn;
  }

  /** Both Summon buttons off while a dialog, a summon or a reveal is in progress (AC-11.12). */
  setSummonEnabled(on) {
    for (const k of Object.keys(this.ui.buttons)) {
      const btn = this.ui.buttons[k];
      btn.setEnabled(on && btn.baseEnabled);
    }
  }

  drawBanner(m, p) {
    const g = this.add.graphics();
    const feat = m.banner.featured.map((f) => data.character(f.character_id)).filter(Boolean);
    const c1 = feat[0] ? auraColor(feat[0].aura) : COLORS.accent;
    const c2 = feat[1] ? auraColor(feat[1].aura) : COLORS.panelLight;
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(p.x, p.y, p.w, p.h, 16);
    // placeholder banner art: two aura-coloured halves and light rays (art-director replaces later)
    g.fillStyle(c1, 0.22);
    g.fillTriangle(p.x + 8, p.y + 8, p.x + p.w * 0.62, p.y + 8, p.x + 8, p.y + p.h - 8);
    g.fillStyle(c2, 0.22);
    g.fillTriangle(p.x + p.w - 8, p.y + p.h - 8, p.x + p.w * 0.38, p.y + p.h - 8, p.x + p.w - 8, p.y + 8);
    const rays = this.add.graphics();
    rays.setPosition(p.x + p.w / 2, p.y + p.h * 0.62);
    rays.fillStyle(0xffffff, 0.05);
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      rays.fillTriangle(0, 0, Math.cos(a) * 260, Math.sin(a) * 260, Math.cos(a + 0.18) * 260, Math.sin(a + 0.18) * 260);
    }
    const mask = this.make.graphics({ add: false });
    mask.fillStyle(0xffffff);
    mask.fillRoundedRect(p.x, p.y, p.w, p.h, 16);
    rays.setMask(mask.createGeometryMask());
    this.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
    const frame = this.add.graphics();
    frame.lineStyle(2, COLORS.accent, 0.9);
    frame.strokeRoundedRect(p.x, p.y, p.w, p.h, 16);

    this.text(p.x + p.w / 2, p.y + 22, m.banner.name, 18, COLORS.accentText, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: p.w - 24 } }).setOrigin(0.5);
    this.text(p.x + 14, p.y + 44, t('summon_featured'), 12, COLORS.textDim, { fontStyle: 'bold' }).setOrigin(0, 0.5);

    // Featured fighters: portrait (aura shape) + name + rarity + aura (GDD §11.1)
    const n = Math.max(1, feat.length);
    const cw = Math.min(132, (p.w - 24 - (n - 1) * 12) / n);
    const ch = Math.min(p.h - 66, 150);
    const top = p.y + 56 + (p.h - 66 - ch) / 2;
    feat.forEach((c, i) => {
      const cx = p.x + p.w / 2 + (i - (n - 1) / 2) * (cw + 12);
      const cg = this.add.graphics();
      cg.fillStyle(0x0d1020, 0.75);
      cg.fillRoundedRect(cx - cw / 2, top, cw, ch, 12);
      cg.lineStyle(2, rarityColor(c.rarity), 1);
      cg.strokeRoundedRect(cx - cw / 2, top, cw, ch, 12);
      const icon = this.add.graphics();
      drawAuraIcon(icon, c.aura, cx, top + ch * 0.32, Math.min(24, ch * 0.18));
      this.tweens.add({ targets: icon, y: { from: 0, to: -3 }, duration: 900 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.text(cx, top + ch * 0.62, c.name, 16, COLORS.text, { fontStyle: 'bold' }).setOrigin(0.5);
      this.text(cx, top + ch * 0.62 + 19, stars(c.rarity), 12, COLORS.accentText).setOrigin(0.5);
      this.text(cx, top + ch * 0.62 + 36, t('aura_' + c.aura), 12, COLORS.textDim).setOrigin(0.5);
    });
  }

  // ------------------------------------------------------------------ modals
  /** A modal layer: dim background that swallows taps, plus a panel. Returns { add, close }. */
  openModal() {
    this.closeModal();
    const { W, H } = this;
    const objs = [];
    const dim = this.add.graphics().setDepth(MODAL_DEPTH);
    dim.fillStyle(COLORS.overlay, 0.78);
    dim.fillRect(0, 0, W, H);
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 120 });
    const blocker = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive().setDepth(MODAL_DEPTH);
    objs.push(dim, blocker);
    const before = this.targets.length;
    this.modal = {
      objs,
      add: (o, d) => {
        o.setDepth(MODAL_DEPTH + (d || 1));
        objs.push(o);
        return o;
      },
      addButton: (btn) => {
        btn.container.setDepth(MODAL_DEPTH + 2);
        btn.zone.setDepth(MODAL_DEPTH + 3);
        objs.push(btn.container, btn.zone);
        return btn;
      },
      targetStart: before,
    };
    this.setSummonEnabled(false);
    return this.modal;
  }

  closeModal(keepDisabled) {
    if (!this.modal) return;
    for (const o of this.modal.objs) o.destroy();
    this.targets = this.targets.slice(0, this.modal.targetStart);
    this.modal = null;
    if (!keepDisabled) this.setSummonEnabled(true);
  }

  openConfirm(b) {
    if (this.processing || this.modal || this.leaving) return;
    sfx('ui_open');
    const { W, H } = this;
    const md = this.openModal();
    // The dialog sits in the middle; the Summon buttons are at the bottom, so Confirm never covers them.
    const top = Math.round(H * 0.28);
    const pg = md.add(this.add.graphics());
    pg.fillStyle(COLORS.panel, 1);
    pg.fillRoundedRect(16, top, W - 32, 232, 16);
    pg.lineStyle(2, COLORS.accent, 1);
    pg.strokeRoundedRect(16, top, W - 32, 232, 16);
    md.add(this.text(W / 2, top + 44, b.confirmText, 16, COLORS.text, { fontStyle: 'bold', align: 'center', wordWrap: { width: W - 64 } }).setOrigin(0.5), 2);
    md.confirmBtn = md.addButton(this.button({ id: 'summon_confirm', x: 32, y: top + 92, w: W - 64, h: 56, label: t('summon_confirm'), armMs: MENU_ARM_MS, onTap: () => this.doSummon(b) }));
    md.addButton(this.button({ id: 'summon_cancel', x: 32, y: top + 160, w: W - 64, h: 56, label: t('summon_cancel'), kind: 'secondary', armMs: MENU_ARM_MS, onTap: () => this.closeModal() }));
    md.kind = 'confirm';
  }

  doSummon(b) {
    if (this.processing || this.leaving) return; // AC-11.12: one summon per confirm, ever
    this.processing = true;
    this.modal.confirmBtn.setEnabled(false);
    const seed = testSeedParam('summonSeed'); // test builds only; release builds pick a crypto seed
    const r = summonAndSave(data.storage, data.save, this.model.banner.id, b.count, data.content, Date.now(), seed === null ? undefined : seed);
    const T = testHooks();
    if (T) (T.summonLog = T.summonLog || []).push({ type: 'summon_returned', ok: r.ok, reason: r.reason, t: performance.now() });
    if (!r.ok) {
      // AC-11.10: nothing changed (the logic never touched data.save); say so and stay here.
      this.processing = false;
      this.closeModal();
      sfx('ui_denied');
      this.showError(rejectText(r.reason));
      return;
    }
    // The save is already written (one setItem) — only now may the reveal start (AC-11.5, AC-11.10).
    data.adoptSave(r.saveAfter);
    sfx('summon_confirm');
    this.closeModal(true);
    this.goTo('SummonReveal', { result: r });
  }

  showError(msg) {
    const { W, H } = this;
    if (this.ui.error) this.ui.error.destroy();
    const txt = this.text(W / 2, 0, msg, 15, COLORS.bad, { fontStyle: 'bold', align: 'center', wordWrap: { width: W - 64 } }).setOrigin(0.5);
    const y = Math.round(H * 0.5);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(W / 2 - txt.width / 2 - 14, y - txt.height / 2 - 10, txt.width + 28, txt.height + 20, 12);
    bg.lineStyle(2, 0xff5d5d, 1);
    bg.strokeRoundedRect(W / 2 - txt.width / 2 - 14, y - txt.height / 2 - 10, txt.width + 28, txt.height + 20, 12);
    txt.setY(y);
    const c = this.add.container(0, 0, [bg, txt]).setDepth(150);
    c.setScale(1);
    this.tweens.add({ targets: c, alpha: { from: 0, to: 1 }, duration: 120 });
    this.ui.error = c;
    this.ui.errorText = msg;
    this.time.delayedCall(3500, () => {
      if (this.ui.error === c) this.tweens.add({ targets: c, alpha: 0, duration: 250 });
    });
  }

  openRates() {
    if (this.processing || this.modal || this.leaving) return;
    sfx('ui_open');
    const { W, H } = this;
    const md = this.openModal();
    md.kind = 'rates';
    const R = rateTableModel(this.model.rates, data.content.characters, data.raw.economy);
    const px = 12;
    const pw = W - 24;
    const top = 60;
    const closeY = H - 16 - 56;
    const pg = md.add(this.add.graphics());
    pg.fillStyle(COLORS.panel, 1);
    pg.fillRoundedRect(px, top, pw, closeY - 12 - top, 16);
    pg.lineStyle(2, COLORS.stroke, 1);
    pg.strokeRoundedRect(px, top, pw, closeY - 12 - top, 16);
    md.add(this.text(W / 2, top + 22, t('summon_rates_title'), 18, COLORS.accentText, { fontStyle: 'bold' }).setOrigin(0.5), 2);

    // Scrollable body (drag) in case the rules text grows; masked to the panel.
    const viewTop = top + 44;
    const viewBottom = closeY - 20;
    const body = md.add(this.add.container(0, viewTop), 2);
    let y = 0;
    const lines = [];
    for (const row of R.rows) {
      const isR = row.kind === 'rarity';
      if (isR && y > 0) y += 6;
      const size = isR ? 15 : 14;
      const col = isR ? '#' + rarityColor(row.rarity).toString(16).padStart(6, '0') : COLORS.text;
      const l = this.text(px + (isR ? 16 : 32), y, isR ? stars(row.rarity) : row.label, size, col, { fontStyle: isR ? 'bold' : 'normal' });
      const r = this.text(px + pw - 16, y, row.percent, size, isR ? col : COLORS.text, { fontStyle: isR ? 'bold' : 'normal' }).setOrigin(1, 0);
      body.add([l, r]);
      lines.push({ kind: row.kind, label: isR ? 'R' + row.rarity : row.label, percent: row.percent });
      y += isR ? 21 : 19;
    }
    y += 10;
    for (const para of R.rules) {
      const tx = this.text(px + 16, y, para, 12, COLORS.textDim, { wordWrap: { width: pw - 32 } });
      body.add(tx);
      y += tx.height + 6;
    }
    const contentH = y;
    const mask = this.make.graphics({ add: false });
    mask.fillStyle(0xffffff);
    mask.fillRect(px, viewTop, pw, viewBottom - viewTop);
    body.setMask(mask.createGeometryMask());
    const maxScroll = Math.max(0, contentH - (viewBottom - viewTop));
    if (maxScroll > 0) {
      const drag = md.add(this.add.zone(px, viewTop, pw, viewBottom - viewTop).setOrigin(0).setInteractive(), 3);
      let startY = null;
      let startC = 0;
      drag.on('pointerdown', (p) => {
        startY = p.y;
        startC = body.y;
      });
      drag.on('pointermove', (p) => {
        if (startY === null || !p.isDown) return;
        const dy = (p.y - startY) / this.vp.zoom;
        body.y = Math.max(viewTop - maxScroll, Math.min(viewTop, startC + dy));
      });
      drag.on('pointerup', () => (startY = null));
    }
    md.ratesLines = lines;
    md.rules = R.rules;
    md.maxScroll = maxScroll;
    md.addButton(this.button({ id: 'summon_rates_close', x: 16, y: closeY, w: W - 32, h: 56, label: t('summon_close'), kind: 'secondary', armMs: MENU_ARM_MS, onTap: () => this.closeModal() }));
  }

  /** Test snapshot: what the screen shows right now. */
  snapshot() {
    const m = this.model;
    const out = {
      none: this.ui.none ? this.ui.none.text : null,
      pity: this.ui.pity ? this.ui.pity.text : null,
      firstMulti: this.ui.firstMulti ? this.ui.firstMulti.text : null,
      buttons: m.buttons ? m.buttons.map((b) => ({ id: b.id, ok: b.ok, label: b.label, sublabel: b.sublabel, cost: b.cost })) : [],
      modal: this.modal ? this.modal.kind : null,
      rates: this.modal && this.modal.ratesLines ? this.modal.ratesLines : null,
      rules: this.modal && this.modal.rules ? this.modal.rules : null,
      error: this.ui.error && this.ui.error.alpha > 0 ? this.ui.errorText : null,
      processing: this.processing,
    };
    return out;
  }
}
