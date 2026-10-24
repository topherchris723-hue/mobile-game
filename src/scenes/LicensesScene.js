// Settings → Licenses (compliance round 6): shows dist/THIRD_PARTY_LICENSES.txt, which the build generates from the
// bundle's module list (scripts/third-party-licenses.mjs). Scroll by drag or the ▲ / ▼ buttons (thumb zone).
import { BaseScene, t } from './BaseScene.js';
import { COLORS } from '../ui/theme.js';
import { TEST_HOOKS, testHooks } from '../ui/test-hooks.js';

const ARM_MS = 250;
const TOP = 56;
const LINES_PER_TEXT = 40; // one Text per chunk keeps every text texture small (WebGL max texture size)

export class LicensesScene extends BaseScene {
  constructor() {
    super('Licenses');
  }

  musicContext() {
    return this.initData && this.initData.from === 'Battle' ? null : ['menu'];
  }

  create() {
    this.setupView(COLORS.bg);
    const { W, H } = this;
    this.from = this.initData.from || 'Home';
    this.state = { loaded: false, error: false, chars: 0, blocks: 0, scroll: 0, maxScroll: 0 };
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(COLORS.bgTop, 1);
    g.fillRect(0, 0, W, TOP);
    g.lineStyle(1, COLORS.stroke, 0.6);
    g.lineBetween(0, TOP, W, TOP);
    const back = this.button({ id: 'back', x: 4, y: 6, w: 44, h: 44, label: t('back_icon'), kind: 'secondary', fontSize: 18, armMs: ARM_MS, onTap: () => this.goTo('Settings', { from: this.from }) });
    back.container.setDepth(11);
    back.zone.setDepth(12);
    this.text(58, 28, t('licenses_title'), 20, COLORS.text, { fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(11);

    // scroll area: below the top bar, above the ▲ / ▼ buttons
    this.view = { top: TOP + 8, bottom: H - 16 - 44 - 12 };
    this.noticeBody = this.add.container(0, this.view.top);
    const m = this.make.graphics({ add: false });
    m.fillStyle(0xffffff);
    m.fillRect(0, this.view.top, W, this.view.bottom - this.view.top);
    this.noticeBody.setMask(m.createGeometryMask());
    this.status = this.text(W / 2, (this.view.top + this.view.bottom) / 2, t('licenses_loading'), 14, COLORS.textDim, { align: 'center', wordWrap: { width: W - 48 } }).setOrigin(0.5);

    const page = () => (this.view.bottom - this.view.top) * 0.8;
    this.button({ id: 'licenses_up', x: W - 16 - 44 - 8 - 44, y: H - 16 - 44, w: 44, h: 44, label: t('licenses_up'), kind: 'secondary', fontSize: 16, armMs: ARM_MS, onTap: () => this.scrollBy(page()) });
    this.button({ id: 'licenses_down', x: W - 16 - 44, y: H - 16 - 44, w: 44, h: 44, label: t('licenses_down'), kind: 'secondary', fontSize: 16, armMs: ARM_MS, onTap: () => this.scrollBy(-page()) });

    const zone = this.add.zone(0, this.view.top, W, this.view.bottom - this.view.top).setOrigin(0).setInteractive();
    let startY = null;
    let startScroll = 0;
    zone.on('pointerdown', (p) => {
      startY = p.y;
      startScroll = this.state.scroll;
    });
    this.input.on('pointermove', (p) => {
      if (startY === null || !p.isDown) return;
      this.setScroll(startScroll - (p.y - startY) / this.vp.zoom);
    });
    this.input.on('pointerup', () => (startY = null));

    const T = TEST_HOOKS ? testHooks() : null;
    if (T) T.licensesScreen = () => Object.assign({}, this.state, { text: this.fullText || '' });
    this.loadNotices();
  }

  async loadNotices() {
    try {
      const res = await fetch('./THIRD_PARTY_LICENSES.txt', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const txt = await res.text();
      if (/^\s*</.test(txt)) throw new Error('not a licence file'); // dev servers answer missing files with index.html
      if (!this.scene || !this.sys.isActive()) return;
      this.show(txt);
    } catch (e) {
      if (!this.sys || !this.sys.isActive()) return;
      this.state.error = true;
      this.status.setText(t('licenses_error'));
    }
  }

  show(txt) {
    const { W } = this;
    this.status.setVisible(false);
    this.fullText = txt;
    const lines = txt.split('\n');
    let y = 0;
    let blocks = 0;
    for (let i = 0; i < lines.length; i += LINES_PER_TEXT) {
      const chunk = lines.slice(i, i + LINES_PER_TEXT).join('\n');
      const tx = this.text(16, y, chunk, 12, COLORS.text, { wordWrap: { width: W - 32 }, lineSpacing: 2 });
      this.noticeBody.add(tx);
      y += tx.height;
      blocks += 1;
    }
    this.state.loaded = true;
    this.state.chars = txt.length;
    this.state.blocks = blocks;
    this.state.maxScroll = Math.max(0, y + 16 - (this.view.bottom - this.view.top));
  }

  scrollBy(dy) {
    this.setScroll(this.state.scroll - dy);
  }

  setScroll(v) {
    this.state.scroll = Math.max(0, Math.min(this.state.maxScroll, v));
    this.noticeBody.y = this.view.top - this.state.scroll;
  }
}
