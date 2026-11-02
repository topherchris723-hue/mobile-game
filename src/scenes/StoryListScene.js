import { BaseScene, t } from './BaseScene.js';
import { COLORS } from '../ui/theme.js';
import { data } from '../ui/game-data.js';

export class StoryListScene extends BaseScene {
  constructor() {
    super('Story');
  }

  create() {
    this.setupView();
    const { W, H } = this;
    this.topBar(t('story_title'), 'Home');

    const list = data.stageList();
    const teamPower = data.teamPower();
    const cardH = 88;
    const gap = 8;
    // Anchor the list to the bottom (thumb zone) when there is spare height.
    const total = list.length * (cardH + gap) - gap;
    const top = Math.max(64 + 22, H - 16 - total);
    const chapter = list.length ? data.chapter(list[0].chapter_id) : null;
    if (chapter) this.text(16, top - 20, chapter.name, 14, COLORS.textDim, { fontStyle: 'bold' }).setOrigin(0, 0.5);

    list.forEach((stage, i) => {
      const y = top + i * (cardH + gap);
      const unlocked = data.isUnlocked(stage);
      const rec = data.stageRecord(stage.id);
      const btn = this.button({
        id: 'stage_' + stage.id,
        x: 16,
        y: y,
        w: W - 32,
        h: cardH,
        label: '',
        kind: 'secondary',
        enabled: unlocked,
        onTap: () => this.startStage(stage),
        onDisabledTap: () => this.toast(t('stage_locked'), y - 24),
      });
      const c = btn.container;
      const innerW = W - 32;
      const left = -innerW / 2 + 12;
      const right = innerW / 2 - 10;
      const nameColor = unlocked ? COLORS.text : COLORS.textDim;
      const title = this.text(left, -cardH / 2 + 8, stage.order + '. ' + stage.name, 15, nameColor, { fontStyle: 'bold' });
      c.add(title);
      c.add(
        this.text(left, -cardH / 2 + 30, unlocked ? stage.description : t('stage_locked'), 12, COLORS.textDim, {
          wordWrap: { width: innerW - 24 },
          maxLines: 2,
        })
      );
      const powerOk = teamPower >= stage.recommended_power;
      const power = this.text(left, cardH / 2 - 20, t('stage_rec_power', { rec: stage.recommended_power, team: teamPower }), 12, powerOk ? COLORS.good : COLORS.bad);
      c.add(power);
      if (rec && rec.cleared) {
        const total = (stage.missions || []).length;
        const tag = this.text(right, -cardH / 2 + 9, t('stage_cleared'), 12, COLORS.good, { fontStyle: 'bold' }).setOrigin(1, 0);
        c.add(tag);
        // BUG-2-06: the Missions count shares the bottom row with the power line. Never let them touch:
        // fall back to the short form, then trim the power line.
        const vars = { done: rec.missions_completed.length, total: total };
        const ms = this.text(right, cardH / 2 - 20, t('stage_missions', vars), 12, COLORS.textDim).setOrigin(1, 0);
        if (power.x + power.width + 12 > right - ms.width) ms.setText(t('stage_missions_short', vars));
        c.add(ms);
        this.fitText(power, right - ms.width - 12 - left);
        this.fitText(title, right - tag.width - 10 - left);
      } else {
        this.fitText(title, right - left);
        this.fitText(power, right - left);
      }
    });
  }

  /** Trim a one-line text with an ellipsis until it is at most maxW wide. */
  fitText(tx, maxW) {
    let str = tx.text;
    while (tx.width > maxW && str.length > 1) {
      str = str.slice(0, -1);
      tx.setText(str.trimEnd() + '…');
    }
  }

  startStage(stage) {
    const pre = stage.story && stage.story.pre;
    const next = { mode: 'battle', stageId: stage.id };
    if (pre && data.scenesById[pre]) {
      this.goTo('Dialogue', { sceneId: pre, next: 'Team', nextData: next });
    } else {
      this.goTo('Team', next);
    }
  }
}
