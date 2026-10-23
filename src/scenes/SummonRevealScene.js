// Summon reveal + results (GDD §11.1). Only reached after summonAndSave has written the save, so quitting here
// changes nothing (AC-11.5). Reveal in pull order (pull 1 first), one tap skips to the results grid; the grid
// tags each pull NEW / Resonance +1 (Rn) / +N Jade. OK returns to the Summon screen.
// Placeholder shapes and colours by rarity; vfx-developer polishes this later.
import { BaseScene, t } from './BaseScene.js';
import { COLORS } from '../ui/theme.js';
import { data } from '../ui/game-data.js';
import { drawAuraIcon } from '../ui/icons.js';
import { sfx, haptic } from '../ui/feedback.js';
import { outcomeTag, guaranteeText, eventText, rarityColor, stars } from '../ui/summon-view.js';
import { TEST_HOOKS, testHooks } from '../ui/test-hooks.js';

const SKIP_ARM_MS = 300; // the 2nd tap of the Confirm double tap must not skip the reveal
const PULL_MS = { 3: 850, 4: 1150, 5: 1900 };

const hex6 = (n) => '#' + n.toString(16).padStart(6, '0');

export class SummonRevealScene extends BaseScene {
  constructor() {
    super('SummonReveal');
  }

  restartData() {
    // After a resize, go straight to the results (never replay a reveal).
    return Object.assign({}, this.initData, { skipped: true });
  }

  create() {
    this.setupView(0x07080f);
    const { W, H } = this;
    const r = this.initData.result;
    this.result = r;
    this.currencyName = data.currenciesById.cur_jade ? data.currenciesById.cur_jade.name : '';
    this.phase = 'reveal';
    this.index = -1;
    this.layer = this.add.container(0, 0);
    this.ui = {};
    const T = TEST_HOOKS ? testHooks() : null;
    if (T) {
      (T.summonLog = T.summonLog || []).push({ type: 'reveal_start', t: performance.now(), count: r ? r.results.length : 0 });
      T.summonReveal = () => ({ phase: this.phase, index: this.index, rows: this.ui.rows || null, warning: this.ui.warning || null });
    }
    if (!r || !r.results || !r.results.length) {
      this.goTo('Summon');
      return;
    }
    // Background rays
    const bg = this.add.graphics().setDepth(-2);
    bg.setPosition(W / 2, H * 0.42);
    bg.fillStyle(0xffffff, 0.035);
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      bg.fillTriangle(0, 0, Math.cos(a) * 700, Math.sin(a) * 700, Math.cos(a + 0.12) * 700, Math.sin(a + 0.12) * 700);
    }
    this.tweens.add({ targets: bg, angle: 360, duration: 30000, repeat: -1 });
    this.bg = bg;
    this.jadeLabel(W - 12, 26);

    if (this.initData.skipped) {
      this.showResults();
      return;
    }
    this.counter = this.text(14, 26, '', 14, COLORS.textDim, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.hint = this.text(W / 2, H - 120, t('summon_tap_to_skip'), 12, COLORS.textDim).setOrigin(0.5);
    // Tap anywhere = skip (and an explicit Skip button in the thumb zone).
    const armAt = performance.now() + SKIP_ARM_MS;
    this.skipZone = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive().setDepth(-1);
    this.skipZone.on('pointerup', () => {
      if (performance.now() >= armAt) this.skip();
    });
    this.skipBtn = this.button({ id: 'summon_skip', x: W - 16 - 120, y: H - 16 - 56, w: 120, h: 56, label: t('summon_skip'), kind: 'secondary', armMs: SKIP_ARM_MS, onTap: () => this.skip() });
    this.nextPull();
  }

  skip() {
    if (this.phase !== 'reveal') return;
    sfx('ui_press');
    this.showResults();
  }

  nextPull() {
    if (this.phase !== 'reveal') return;
    this.index += 1;
    const r = this.result;
    if (this.index >= r.results.length) {
      this.showResults();
      return;
    }
    const res = r.results[this.index];
    this.counter.setText(t('summon_pull_counter', { pull: res.pull, count: r.results.length }));
    this.layer.removeAll(true);
    const { W, H } = this;
    const cx = W / 2;
    const cy = H * 0.42;
    const col = rarityColor(res.rarity);
    // 1) orb charges in the rarity colour (the tease), 2) flash, 3) the fighter card pops.
    const orb = this.add.graphics();
    orb.fillStyle(col, 0.35);
    orb.fillCircle(0, 0, 46);
    orb.fillStyle(col, 1);
    orb.fillCircle(0, 0, 30);
    orb.fillStyle(0xffffff, 0.85);
    orb.fillCircle(-8, -8, 9);
    orb.setPosition(cx, cy).setScale(0.1);
    this.layer.add(orb);
    sfx('summon_orb_' + res.rarity);
    const chargeMs = res.rarity >= 5 ? 700 : res.rarity === 4 ? 420 : 260;
    this.tweens.add({ targets: orb, scale: 1, duration: 220, ease: 'Back.Out' });
    if (res.rarity >= 4) this.tweens.add({ targets: orb, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: Math.floor(chargeMs / 120), delay: 200 });
    this.time.delayedCall(chargeMs, () => {
      if (this.phase !== 'reveal') return;
      this.flash(col, res.rarity);
      orb.destroy();
      this.showCard(res, cx, cy);
      this.time.delayedCall(PULL_MS[res.rarity] || PULL_MS[3], () => this.nextPull());
    });
  }

  flash(col, rarity) {
    const { W, H } = this;
    const f = this.add.graphics();
    f.fillStyle(rarity >= 5 ? 0xffffff : col, rarity >= 5 ? 0.9 : 0.45);
    f.fillRect(0, 0, W, H);
    this.layer.add(f);
    this.tweens.add({ targets: f, alpha: 0, duration: rarity >= 5 ? 420 : 220, onComplete: () => f.destroy() });
    if (rarity >= 5) {
      this.cameras.main.shake(260, 0.012);
      haptic(80);
    }
    sfx('summon_reveal_' + rarity);
  }

  showCard(res, cx, cy) {
    const ch = data.character(res.character_id);
    const col = rarityColor(res.rarity);
    const cw = 220;
    const chh = 250;
    const c = this.add.container(cx, cy);
    const g = this.add.graphics();
    if (res.rarity >= 4) {
      // burst rays behind the card
      g.fillStyle(col, res.rarity >= 5 ? 0.35 : 0.22);
      const n = res.rarity >= 5 ? 14 : 8;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        g.fillTriangle(0, 0, Math.cos(a) * 190, Math.sin(a) * 190, Math.cos(a + 0.14) * 190, Math.sin(a + 0.14) * 190);
      }
    }
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(-cw / 2, -chh / 2, cw, chh, 16);
    g.fillStyle(col, 0.2);
    g.fillRoundedRect(-cw / 2, -chh / 2, cw, chh, 16);
    g.lineStyle(4, col, 1);
    g.strokeRoundedRect(-cw / 2, -chh / 2, cw, chh, 16);
    c.add(g);
    if (ch) {
      const icon = this.add.graphics();
      drawAuraIcon(icon, ch.aura, 0, -56, 36);
      c.add(icon);
    }
    c.add(this.text(0, 6, ch ? ch.name : '', 24, COLORS.text, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5));
    c.add(this.text(0, 36, stars(res.rarity), 18, hex6(col), { fontStyle: 'bold' }).setOrigin(0.5));
    c.add(this.text(0, 62, ch ? t('aura_' + ch.aura) : '', 12, COLORS.textDim).setOrigin(0.5));
    const tag = this.tagPill(0, 92, res, 15);
    c.add(tag);
    const extras = [];
    const gt = guaranteeText(res.guarantee, this.result.count);
    if (gt) extras.push(gt);
    for (const ev of this.result.events || []) if (ev.type === 'summon_pity_reset' && ev.pull === res.pull) extras.push(eventText(ev, this.currencyName));
    if (extras.length) c.add(this.text(0, chh / 2 + 22, extras.join('  ·  '), 14, COLORS.accentText, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3, align: 'center', wordWrap: { width: this.W - 32 } }).setOrigin(0.5));
    c.setScale(0.55).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.layer.add(c);
  }

  /** Outcome pill: NEW (gold), Resonance +1 (Rn) (violet), +N Jade (green). Text + colour + shape. */
  tagPill(x, y, res, size) {
    const str = outcomeTag(res);
    const fill = res.outcome === 'new' ? COLORS.accent : res.outcome === 'resonance' ? 0x7a52d9 : 0x2fa874;
    const txtCol = res.outcome === 'new' ? COLORS.textDark : '#ffffff';
    const c = this.add.container(x, y);
    const tx = this.text(0, 0, str, size, txtCol, { fontStyle: 'bold' }).setOrigin(0.5);
    const w = tx.width + 16;
    const h = tx.height + 6;
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    c.add([g, tx]);
    c.pillW = w;
    return c;
  }

  showResults() {
    if (this.phase === 'results') return;
    this.phase = 'results';
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.tweens.add({ targets: this.bg, angle: this.bg.angle + 360, duration: 30000, repeat: -1 });
    this.layer.removeAll(true);
    if (this.skipZone) this.skipZone.destroy();
    if (this.skipBtn) {
      this.skipBtn.container.destroy();
      this.skipBtn.zone.destroy();
      this.targets = this.targets.filter((tg) => tg.id !== 'summon_skip');
    }
    if (this.hint) this.hint.destroy();
    if (this.counter) this.counter.destroy();
    const { W, H } = this;
    const r = this.result;
    this.text(14, 26, t('summon_results_title'), 20, COLORS.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    const rows = [];
    const okY = H - 16 - 56;
    if (r.results.length === 1) {
      this.showCard(r.results[0], W / 2, H * 0.4);
    } else {
      const top = 64;
      const avail = okY - 40 - top;
      const rowH = Math.min(52, Math.floor(avail / r.results.length) - 4);
      r.results.forEach((res, i) => {
        const y = top + i * (rowH + 4);
        const ch = data.character(res.character_id);
        const col = rarityColor(res.rarity);
        const c = this.add.container(0, 0);
        const g = this.add.graphics();
        g.fillStyle(COLORS.panel, 1);
        g.fillRoundedRect(12, y, W - 24, rowH, 10);
        g.fillStyle(col, res.rarity >= 5 ? 0.3 : res.rarity === 4 ? 0.18 : 0.08);
        g.fillRoundedRect(12, y, W - 24, rowH, 10);
        g.lineStyle(res.rarity >= 5 ? 3 : 2, col, 1);
        g.strokeRoundedRect(12, y, W - 24, rowH, 10);
        if (ch) drawAuraIcon(g, ch.aura, 34, y + rowH / 2, 11);
        c.add(g);
        const name = this.text(54, y + rowH / 2 - 8, ch ? ch.name : '', 15, COLORS.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
        const st = this.text(54, y + rowH / 2 + 9, stars(res.rarity), 12, hex6(col)).setOrigin(0, 0.5);
        c.add([name, st]);
        const pill = this.tagPill(0, y + rowH / 2, res, 13);
        pill.x = W - 22 - pill.pillW / 2;
        c.add(pill);
        rows.push({ pull: res.pull, name: ch ? ch.name : '', rarity: res.rarity, tag: outcomeTag(res), y: y, h: rowH, nameRight: name.x + name.width, pillLeft: pill.x - pill.pillW / 2 });
        c.setAlpha(0);
        c.x = 24;
        this.tweens.add({ targets: c, alpha: 1, x: 0, duration: 180, delay: i * 40, ease: 'Cubic.Out' });
      });
    }
    if (r.results.length === 1) {
      const res = r.results[0];
      const ch = data.character(res.character_id);
      rows.push({ pull: res.pull, name: ch ? ch.name : '', rarity: res.rarity, tag: outcomeTag(res) });
    }
    this.ui.rows = rows;
    const capped = (r.events || []).filter((e) => e.type === 'summon_currency_capped');
    if (capped.length) {
      const lost = capped.reduce((s, e) => s + (e.lost || 0), 0);
      this.ui.warning = eventText({ type: 'summon_currency_capped', lost: lost }, this.currencyName);
      this.text(W / 2, okY - 22, this.ui.warning, 12, COLORS.bad, { align: 'center', wordWrap: { width: W - 32 } }).setOrigin(0.5);
    }
    this.button({ id: 'summon_ok', x: 16, y: okY, w: W - 32, h: 56, label: t('summon_ok'), armMs: SKIP_ARM_MS, onTap: () => this.goTo('Summon') });
    sfx('summon_results');
  }
}
