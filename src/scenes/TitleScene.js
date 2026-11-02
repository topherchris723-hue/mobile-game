import { BaseScene, t } from './BaseScene.js';
import { COLORS, AURA_COLORS } from '../ui/theme.js';
import { drawAuraIcon } from '../ui/icons.js';

export class TitleScene extends BaseScene {
  constructor() {
    super('Title');
  }

  create() {
    this.setupView();
    const { W, H } = this;
    // Background: soft rays in the five aura colours.
    const g = this.add.graphics();
    const auras = Object.keys(AURA_COLORS);
    auras.forEach((a, i) => {
      g.fillStyle(AURA_COLORS[a], 0.08);
      g.fillTriangle(W / 2, H * 0.36, -60 + i * 120, -40, 20 + i * 120, -40);
    });
    const icons = this.add.graphics();
    auras.forEach((a, i) => drawAuraIcon(icons, a, W / 2 - 96 + i * 48, H * 0.46, 13));

    const title = this.text(W / 2, H * 0.3, t('game_title'), 40, COLORS.accentText, {
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center',
    }).setOrigin(0.5);
    this.text(W / 2, H * 0.3 + 38, t('game_subtitle'), 13, COLORS.textDim).setOrigin(0.5);
    title.setScale(0.6);
    this.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.Out' });

    // Whole screen is the start button; an explicit button sits in the thumb zone.
    this.button({
      id: 'start',
      x: 16,
      y: H - 120,
      w: W - 32,
      h: 56,
      label: t('tap_to_start'),
      onTap: () => this.goTo('Home'),
    });
  }
}
