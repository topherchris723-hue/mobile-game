import { BaseScene, t } from './BaseScene.js';
import { COLORS } from '../ui/theme.js';
import { data } from '../ui/game-data.js';
import { drawAuraIcon } from '../ui/icons.js';

export class HomeScene extends BaseScene {
  constructor() {
    super('Home');
  }

  create() {
    this.setupView();
    const { W, H } = this;
    this.topBar(t('game_title'), null, null, { gear: () => this.goTo('Settings', { from: 'Home' }) });

    // Team preview in the upper half (non-interactive).
    const team = data.team();
    const g = this.add.graphics();
    team.forEach((id, i) => {
      const ch = data.character(id);
      if (!ch) return; // data.team() only returns known ids; belt and braces
      const cx = W / 2 + (i - 1) * 104;
      const cy = H * 0.3;
      g.fillStyle(COLORS.panel, 1);
      g.fillRoundedRect(cx - 44, cy - 60, 88, 120, 14);
      g.lineStyle(2, COLORS.stroke, 0.8);
      g.strokeRoundedRect(cx - 44, cy - 60, 88, 120, 14);
      drawAuraIcon(g, ch.aura, cx, cy - 18, 22);
      this.text(cx, cy + 22, ch.name, 16, COLORS.text, { fontStyle: 'bold' }).setOrigin(0.5);
      this.text(cx, cy + 42, t('aura_' + ch.aura), 12, COLORS.textDim).setOrigin(0.5);
    });
    this.text(W / 2, H * 0.3 + 80, t('team_power', { power: data.teamPower() }), 14, COLORS.textDim).setOrigin(0.5);

    if (data.saveDamaged) {
      this.toast(t('save_damaged'), H * 0.48);
      data.saveDamaged = false;
    } else if (data.repairNotice) {
      // Short notice for team/summon repairs on load (not for settings_repaired, ruling R4-1).
      this.toast(t('home_save_repaired'), H * 0.48);
      this.repairNoticeShown = true;
      data.repairNotice = false;
    }

    // GDD §4: Home has Story, Summon, Team. Primary buttons full width − 32, height 56, lower half.
    const bw = W - 32;
    const y0 = H - 72 * 3 - 16;
    this.button({ id: 'home_story', x: 16, y: y0, w: bw, h: 56, label: t('home_story'), onTap: () => this.goTo('Story') });
    this.button({
      id: 'home_summon',
      x: 16,
      y: y0 + 72,
      w: bw,
      h: 56,
      label: t('home_summon'),
      onTap: () => this.goTo('Summon'),
    });
    this.button({
      id: 'home_team',
      x: 16,
      y: y0 + 144,
      w: bw,
      h: 56,
      label: t('home_team'),
      kind: 'secondary',
      onTap: () => this.goTo('Team', { mode: 'edit' }),
    });
  }
}
