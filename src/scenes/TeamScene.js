// Team (view roster, set team) and Team Select (before a battle). GDD §4, §9.1 (team power).
import { BaseScene, t } from './BaseScene.js';
import { COLORS, auraColor } from '../ui/theme.js';
import { data } from '../ui/game-data.js';
import { drawAuraIcon } from '../ui/icons.js';

export class TeamScene extends BaseScene {
  constructor() {
    super('Team');
  }

  create() {
    this.setupView();
    const { W, H } = this;
    const battleMode = this.initData.mode === 'battle';
    this.stage = battleMode ? data.stage(this.initData.stageId) : null;
    this.selected = this.initData.selected !== undefined ? this.initData.selected : 0;
    this.topBar(battleMode ? t('team_select_title') : t('team_title'), battleMode ? 'Story' : 'Home');

    this.dyn = this.add.container(0, 0);
    this.slotTop = 72;
    this.drawAll();

    if (battleMode) {
      this.button({
        id: 'team_fight',
        x: 16,
        y: H - 72,
        w: W - 32,
        h: 56,
        label: t('team_fight'),
        fontSize: 24,
        onTap: () => this.goTo('Battle', { stageId: this.stage.id }),
      });
    }
  }

  restartData() {
    return Object.assign({}, this.initData, { selected: this.selected });
  }

  drawAll() {
    // Rebuild only the dynamic part (slots, roster, power); buttons are recreated each time.
    this.dyn.removeAll(true);
    this.targets = this.targets.filter((tg) => !tg.dynamic);
    const { W, H } = this;
    const team = data.team();
    const slotW = 104;
    const slotH = 132;
    const gap = 8;
    const x0 = (W - (slotW * 3 + gap * 2)) / 2;

    team.forEach((id, i) => {
      const x = x0 + i * (slotW + gap);
      const y = this.slotTop;
      this.fighterTile(id, x, y, slotW, slotH, i === this.selected, i === 0 ? t('team_slot_lead') : String(i + 1), 'team_slot_' + i, () => {
        this.selected = i;
        this.drawAll();
      });
    });

    const power = data.teamPower();
    let color = COLORS.text;
    if (this.stage) color = power >= this.stage.recommended_power ? COLORS.good : COLORS.bad;
    const pTxt = this.text(W / 2, this.slotTop + slotH + 16, t('team_power', { power: power }), 15, color, { fontStyle: 'bold' }).setOrigin(0.5);
    this.dyn.add(pTxt);
    this.dyn.add(this.text(W / 2, this.slotTop + slotH + 38, t('team_hint'), 12, COLORS.textDim).setOrigin(0.5));

    // Roster grid
    const rosterTop = this.slotTop + slotH + 66;
    this.dyn.add(this.text(16, rosterTop, t('team_roster'), 14, COLORS.textDim, { fontStyle: 'bold' }));
    const cols = 4;
    const tw = 76;
    const th = 96;
    const tg = (W - 32 - cols * tw) / (cols - 1);
    data.save.roster.forEach((r, i) => {
      const ch = data.character(r.character_id);
      if (!ch) return;
      const x = 16 + (i % cols) * (tw + tg);
      const y = rosterTop + 24 + Math.floor(i / cols) * (th + 8);
      if (y + th > H - 88) return; // simple cut-off; scrolling comes with a bigger roster
      const inTeam = team.indexOf(ch.id);
      this.fighterTile(ch.id, x, y, tw, th, false, inTeam >= 0 ? String(inTeam + 1) : '', 'roster_' + ch.id, () => this.place(ch.id), true);
    });
  }

  fighterTile(charId, x, y, w, h, selected, badge, id, onTap, compact) {
    const ch = data.character(charId);
    if (!ch) return null; // unknown id: draw nothing rather than crash (BUG-2-04 guard)
    const c = this.add.container(x + w / 2, y + h / 2);
    const g = this.add.graphics();
    const col = auraColor(ch.aura);
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle(col, 0.18);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.lineStyle(selected ? 4 : 2, selected ? COLORS.accent : col, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    drawAuraIcon(g, ch.aura, 0, compact ? -18 : -28, compact ? 16 : 22);
    c.add(g);
    c.add(this.text(0, compact ? 10 : 6, ch.name, compact ? 13 : 16, COLORS.text, { fontStyle: 'bold' }).setOrigin(0.5));
    c.add(this.text(0, compact ? 28 : 26, '★'.repeat(ch.rarity), 12, COLORS.accentText).setOrigin(0.5));
    if (!compact) c.add(this.text(0, 46, t('fighter_power', { power: data.fighterPower(charId) }), 12, COLORS.textDim).setOrigin(0.5));
    if (badge) {
      const b = this.text(-w / 2 + 6, -h / 2 + 4, badge, 12, COLORS.accentText, { fontStyle: 'bold' });
      c.add(b);
    }
    this.dyn.add(c);
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    this.dyn.add(zone);
    zone.on('pointerdown', () => c.setScale(0.95));
    zone.on('pointerout', () => c.setScale(1));
    zone.on('pointerup', () => {
      c.setScale(1);
      onTap();
    });
    const tg = this.registerTarget(id, () => ({ x, y, w, h }));
    tg.dynamic = true;
    return c;
  }

  place(charId) {
    const team = data.team().slice();
    const from = team.indexOf(charId);
    if (from === this.selected) return;
    if (from >= 0) {
      team[from] = team[this.selected];
      team[this.selected] = charId;
    } else {
      team[this.selected] = charId;
    }
    if (!data.setTeam(team)) {
      this.toast(t('team_family_clash'));
      return;
    }
    this.drawAll();
  }
}
