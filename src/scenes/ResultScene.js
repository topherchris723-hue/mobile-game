// Result screen: outcome, time, stats, rewards and missions (from applyBattleResult), then onward.
import { BaseScene, t } from './BaseScene.js';
import { COLORS } from '../ui/theme.js';
import { data } from '../ui/game-data.js';
import { sfx } from '../ui/feedback.js';
import { hasString } from '../ui/strings.js';

export class ResultScene extends BaseScene {
  constructor() {
    super('Result');
  }

  create() {
    this.setupView();
    const { W, H } = this;
    const d = this.initData;
    const stage = data.stage(d.stageId);
    const res = d.result || { outcome: 'lose', reason: 'retreat', timeElapsedS: 0, stats: {} };
    this.topBar(stage ? stage.name : '', 'Story');

    const titleKey = res.outcome === 'win' ? 'result_win' : res.outcome === 'draw' ? 'result_draw' : 'result_lose';
    const color = res.outcome === 'win' ? COLORS.accentText : res.outcome === 'draw' ? COLORS.text : COLORS.bad;
    const title = this.text(W / 2, 112, t(titleKey), 44, color, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
    title.setScale(2).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 300, ease: 'Back.Out' });
    sfx('result_' + res.outcome);

    const reasonKey = 'result_reason_' + res.reason;
    if (res.reason && !hasString(reasonKey)) console.warn('[result] no string for reason', res.reason);
    if (res.outcome !== 'win' && res.reason && hasString(reasonKey)) this.text(W / 2, 152, t(reasonKey), 14, COLORS.textDim).setOrigin(0.5);
    this.text(W / 2, 180, t('result_time', { time: (res.timeElapsedS || 0).toFixed(1) }), 16, COLORS.text).setOrigin(0.5);
    const s = res.stats || {};
    this.text(W / 2, 206, t('result_stats', { ps: s.perfectSlips || 0, chain: s.maxChain || 0, kos: s.playerKos || 0 }), 12, COLORS.textDim, {
      align: 'center',
      wordWrap: { width: W - 32 },
    }).setOrigin(0.5);

    // Rewards panel
    const panelY = 236;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(16, panelY, W - 32, 170, 14);
    g.lineStyle(2, COLORS.stroke, 1);
    g.strokeRoundedRect(16, panelY, W - 32, 170, 14);
    this.text(32, panelY + 14, t('result_rewards'), 15, COLORS.accentText, { fontStyle: 'bold' });
    const lines = [];
    const missions = d.missions || [];
    const rewards = d.rewards || [];
    // applyBattleResult lists clear rewards first, then one reward per newly completed mission (same order).
    const clearRewards = rewards.slice(0, rewards.length - missions.length);
    const rewardText = (r) => {
      if (r.type === 'currency') {
        const cur = data.currenciesById[r.currency_id];
        return t('result_reward_currency', { amount: r.amount, currency: cur ? cur.name : r.currency_id });
      }
      const ch = data.character(r.character_id);
      return t('result_reward_character', { name: ch ? ch.name : r.character_id });
    };
    for (const r of clearRewards) lines.push(rewardText(r));
    missions.forEach((mid, i) => {
      const m = stage && (stage.missions || []).find((x) => x.id === mid);
      const r = rewards[clearRewards.length + i];
      if (m) lines.push(t('result_mission_done', { text: m.text }) + (r ? '  ' + rewardText(r) : ''));
    });
    if (!lines.length) lines.push(t('result_no_rewards'));
    lines.slice(0, 6).forEach((ln, i) => {
      const tx = this.text(32, panelY + 42 + i * 21, ln, 14, COLORS.text, { wordWrap: { width: W - 64 } }).setAlpha(0);
      this.tweens.add({ targets: tx, alpha: 1, x: 36, duration: 200, delay: 250 + i * 120 });
    });

    // Buttons (thumb zone)
    const bw = W - 32;
    if (res.outcome === 'win') {
      this.button({ id: 'result_continue', x: 16, y: H - 72, w: bw, h: 56, label: t('result_continue'), onTap: () => this.continueOn(stage) });
    } else {
      this.button({ id: 'result_retry', x: 16, y: H - 144, w: bw, h: 56, label: t('result_retry'), onTap: () => this.goTo('Battle', { stageId: stage.id }) });
      this.button({ id: 'result_to_story', x: 16, y: H - 72, w: bw, h: 56, label: t('result_to_story'), kind: 'secondary', onTap: () => this.goTo('Story') });
    }
  }

  continueOn(stage) {
    const post = stage && stage.story && stage.story.post;
    if (post && data.scenesById[post]) this.goTo('Dialogue', { sceneId: post, next: 'Story', nextData: {} });
    else this.goTo('Story');
  }
}
