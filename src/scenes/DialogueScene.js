// Pre/post-battle story scenes (GDD §10): tap advances a line, Skip ends the scene.
import { BaseScene, t } from './BaseScene.js';
import { COLORS, auraColor } from '../ui/theme.js';
import { data } from '../ui/game-data.js';
import { drawAuraIcon } from '../ui/icons.js';
import { sfx } from '../ui/feedback.js';

export class DialogueScene extends BaseScene {
  constructor() {
    super('Dialogue');
  }

  create() {
    this.setupView(0x111530);
    const { W, H } = this;
    this.sceneDef = data.scenesById[this.initData.sceneId];
    this.lineIndex = this.initData.lineIndex || 0;
    this.topBar(null, this.initData.backTo || 'Story');

    this.portrait = this.add.graphics();
    this.portraitName = this.text(0, 0, '', 14, COLORS.text, { fontStyle: 'bold' }).setOrigin(0.5);

    const boxY = H - 252;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(12, boxY, W - 24, 160, 14);
    g.lineStyle(2, COLORS.stroke, 0.9);
    g.strokeRoundedRect(12, boxY, W - 24, 160, 14);
    this.speaker = this.text(28, boxY + 12, '', 15, COLORS.accentText, { fontStyle: 'bold' });
    this.body = this.text(28, boxY + 38, '', 15, COLORS.text, { wordWrap: { width: W - 56 }, lineSpacing: 4 });

    // Tap anywhere in the story area advances.
    const area = this.add.zone(0, 56, W, H - 56 - 84).setOrigin(0, 0).setInteractive();
    area.on('pointerup', () => this.advance());

    const bw = (W - 32 - 8) / 2;
    this.button({ id: 'dialogue_skip', x: 16, y: H - 72, w: bw, h: 56, label: t('skip'), kind: 'secondary', onTap: () => this.finish() });
    this.button({ id: 'dialogue_next', x: 16 + bw + 8, y: H - 72, w: bw, h: 56, label: t('next'), onTap: () => this.advance() });

    if (!this.sceneDef) {
      this.finish();
      return;
    }
    this.showLine();
  }

  restartData() {
    return Object.assign({}, this.initData, { lineIndex: this.lineIndex });
  }

  speakerInfo(line) {
    if (line.speaker === 'narrator') return { name: '', aura: null };
    if (line.speaker === 'npc') return { name: line.name || '', aura: null };
    const ch = data.character(line.speaker);
    return ch ? { name: ch.name, aura: ch.aura } : { name: '', aura: null };
  }

  showLine() {
    const line = this.sceneDef.lines[this.lineIndex];
    const info = this.speakerInfo(line);
    const { W, H } = this;
    this.portrait.clear();
    this.portraitName.setText('');
    if (info.aura) {
      const cx = line.side === 'right' ? W - 96 : line.side === 'center' ? W / 2 : 96;
      const cy = H - 340;
      this.portrait.fillStyle(auraColor(info.aura), 0.25);
      this.portrait.fillRoundedRect(cx - 60, cy - 90, 120, 150, 18);
      this.portrait.lineStyle(3, auraColor(info.aura), 1);
      this.portrait.strokeRoundedRect(cx - 60, cy - 90, 120, 150, 18);
      drawAuraIcon(this.portrait, info.aura, cx, cy - 20, 30);
      this.portraitName.setPosition(cx, cy + 40).setText(info.name);
      this.portrait.setAlpha(0);
      this.tweens.add({ targets: this.portrait, alpha: 1, duration: 150 });
    }
    this.speaker.setText(info.name);
    this.body.setText(line.text).setAlpha(0);
    this.tweens.add({ targets: this.body, alpha: 1, duration: 140 });
  }

  advance() {
    if (this.leaving || !this.sceneDef) return;
    sfx('ui_advance');
    this.lineIndex += 1;
    if (this.lineIndex >= this.sceneDef.lines.length) this.finish();
    else this.showLine();
  }

  finish() {
    this.goTo(this.initData.next || 'Story', this.initData.nextData || {});
  }
}
