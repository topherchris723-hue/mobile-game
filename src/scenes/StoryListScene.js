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
      const left = -(W - 32) / 2 + 12;
      const nameColor = unlocked ? COLORS.text : COLORS.textDim;
      c.add(this.text(left, -cardH / 2 + 8, stage.order + '. ' + stage.name, 15, nameColor, { fontStyle: 'bold' }));
      c.add(
        this.text(left, -cardH / 2 + 30, unlocked ? stage.description : t('stage_locked'), 12, COLORS.textDim, {
          wordWrap: { width: W - 32 - 24 },
          maxLines: 2,
        })
      );
      const powerOk = teamPower >= stage.recommended_power;
      c.add(
        this.text(left, cardH / 2 - 20, t('stage_rec_power', { rec: stage.recommended_power, team: teamPower }), 12, powerOk ? COLORS.good : COLORS.bad)
      );
      if (rec && rec.cleared) {
        const total = (stage.missions || []).length;
        const tag = this.text((W - 32) / 2 - 10, -cardH / 2 + 9, t('stage_cleared'), 12, COLORS.good, { fontStyle: 'bold' }).setOrigin(1, 0);
        c.add(tag);
        c.add(
          this.text((W - 32) / 2 - 10, cardH / 2 - 20, t('stage_missions', { done: rec.missions_completed.length, total: total }), 12, COLORS.textDim).setOrigin(1, 0)
        );
      }
    });
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
