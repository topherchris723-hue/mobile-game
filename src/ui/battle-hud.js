// Battle HUD (GDD §14 layout). Reads the logic snapshot every frame; never changes logic state.
import { burstVisual, BURST_LABEL_KEYS } from './hud-state.js';
import { COLORS, auraColor } from './theme.js';
import { drawAuraIcon, drawCardTypeIcon, cardColor } from './icons.js';
import { t } from './strings.js';

function pie(g, cx, cy, r, frac, color, alpha) {
  if (frac <= 0) return;
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(cx, cy);
  g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac), false);
  g.closePath();
  g.fillPath();
}

export class BattleHud {
  constructor(scene, L, rules) {
    this.s = scene;
    this.L = L;
    this.rules = rules;
    this.shownHp = { player: null, enemy: null };
    this.lagHp = { player: null, enemy: null };
    this.lagHold = { player: 0, enemy: 0 };
    this.cardKeys = [null, null, null, null];
    this.cardViews = [];
    this.benchMap = [null, null]; // bench index → team slot
    this.keys = {}; // change detection: redraw Graphics / re-raster Text only when what they show changed
    this.buildTopBar();
    this.buildPlayerStatus();
    this.buildVigor();
    this.buildHand();
    this.buildSwipePad();
  }

  // ---------------------------------------------------------------- top bar
  buildTopBar() {
    const s = this.s;
    const W = this.L.W;
    const g = s.add.graphics();
    g.fillStyle(COLORS.bgTop, 0.92);
    g.fillRect(0, 0, W, 44);
    g.lineStyle(1, COLORS.stroke, 0.6);
    g.lineBetween(0, 44, W, 44);
    this.enemyIcon = s.add.graphics();
    this.enemyName = s.text(26, 12, '', 13, COLORS.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.timerText = s.text(W / 2, 12, '', 20, COLORS.text, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
    this.enemyPips = s.add.graphics();
    this.enemyHpG = s.add.graphics();
    this.enemyHpText = s.text(296, 32, '', 12, COLORS.text, { stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0.5);
  }

  // ---------------------------------------------------------------- player status row
  buildPlayerStatus() {
    const s = this.s;
    const L = this.L;
    this.playerIcon = s.add.graphics();
    this.playerName = s.text(L.playerHp.x + 18, L.playerHp.nameY + 8, '', 13, COLORS.text, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 0.5);
    this.playerHpText = s.text(L.playerHp.x + L.playerHp.w, L.playerHp.nameY + 8, '', 12, COLORS.text, { stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0.5);
    this.playerHpG = s.add.graphics();

    const sg = s.add.graphics();
    sg.fillStyle(COLORS.bgTop, 0.95);
    sg.fillRect(0, L.arena.bottom, L.W, L.H - L.arena.bottom);
    sg.lineStyle(1, COLORS.stroke, 0.5);
    sg.lineBetween(0, L.arena.bottom, L.W, L.arena.bottom);
    sg.setDepth(-1);

    this.benchViews = L.bench.map((r) => {
      const c = s.add.container(r.x + r.w / 2, r.y + r.h / 2);
      const g = s.add.graphics();
      const name = s.text(0, r.h / 2 - 9, '', 12, COLORS.text, { stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
      const cd = s.text(0, -4, '', 14, COLORS.text, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
      c.add([g, name, cd]);
      return { c, g, name, cd, r, key: null };
    });

    const ri = L.riposteInfo;
    this.riposteG = s.add.graphics();
    this.riposteText = s.text(ri.x + ri.w / 2, ri.y + 18, t('battle_riposte_window'), 14, COLORS.accentText, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setVisible(false);

    const ig = L.ignite;
    this.igniteC = s.add.container(ig.x + ig.w / 2, ig.y + ig.h / 2);
    this.igniteG = s.add.graphics();
    this.igniteText = s.text(0, 0, t('battle_ignite'), 12, '#ffffff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
    this.igniteC.add([this.igniteG, this.igniteText]);
    this.igniteC.setVisible(false);
    this.igniteVisible = false;

    const b = L.burst;
    this.burstC = s.add.container(b.x + b.w / 2, b.y + b.h / 2);
    this.burstG = s.add.graphics();
    this.burstText = s.text(0, 0, t('battle_tri_burst'), 12, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 3, wordWrap: { width: 60 } }).setOrigin(0.5);
    this.burstC.add([this.burstG, this.burstText]);
  }

  buildVigor() {
    const s = this.s;
    this.vigorG = s.add.graphics();
    this.vigorText = s.text(this.L.vigor.numX + 10, this.L.vigor.y + this.L.vigor.h / 2, '', 16, '#3dc8ff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
    this.vigorFlash = 0;
  }

  buildHand() {
    const s = this.s;
    for (let i = 0; i < 4; i++) {
      const r = this.L.cardRect(i);
      const c = s.add.container(r.x + r.w / 2, r.y + r.h / 2);
      const g = s.add.graphics();
      const cost = s.text(-r.w / 2 + 15, -r.h / 2 + 15, '', 16, '#ffffff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
      const name = s.text(0, 6, '', 12, '#ffffff', { fontStyle: 'bold', align: 'center', wordWrap: { width: r.w - 10 }, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5);
      const type = s.text(0, r.h / 2 - 12, '', 12, '#ffffff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5);
      const refill = s.add.graphics();
      const badge = s.text(0, -r.h / 2 - 2, '', 12, COLORS.accentText, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1);
      c.add([g, refill, cost, name, type, badge]);
      this.cardViews.push({ c, g, cost, name, type, refill, badge, r });
    }
  }

  buildSwipePad() {
    const s = this.s;
    const p = this.L.swipePad;
    const cy = (p.top + p.bottom) / 2;
    this.padG = s.add.graphics();
    const g = this.padG;
    g.lineStyle(2, COLORS.stroke, 0.35);
    g.strokeRoundedRect(8, p.top + 6, this.L.W - 16, p.bottom - p.top - 12, 16);
    s.text(this.L.W / 2, cy - 14, t('battle_swipe_dash'), 13, COLORS.textDim).setOrigin(0.5).setAlpha(0.8);
    s.text(this.L.W / 2, cy + 12, t('battle_swipe_slip'), 13, COLORS.textDim).setOrigin(0.5).setAlpha(0.8);
  }

  dirty(name, key) {
    if (this.keys[name] === key) return false;
    this.keys[name] = key;
    return true;
  }

  // ---------------------------------------------------------------- per frame
  update(state, dt, now) {
    this.updateTopBar(state, dt);
    this.updatePlayerStatus(state, dt, now);
    this.updateVigor(state, dt);
    this.updateHand(state, now);
  }

  easeHp(side, hp, dt, maxHp) {
    if (this.shownHp[side] === null) {
      this.shownHp[side] = hp;
      this.lagHp[side] = hp;
    }
    // front bar eases quickly, the yellow "damage taken" bar follows after a short hold
    this.shownHp[side] += (hp - this.shownHp[side]) * Math.min(1, dt * 0.02);
    if (hp < this.lagHp[side]) {
      this.lagHold[side] -= dt;
      if (this.lagHold[side] <= 0) this.lagHp[side] += (hp - this.lagHp[side]) * Math.min(1, dt * 0.006);
    } else {
      this.lagHp[side] = hp;
      this.lagHold[side] = 350;
    }
    // R-2 (AC-17.7): end the exponential tails once they are below one bar pixel (≈ maxHp / 300), so the bar,
    // its Graphics and the HP number stop re-rendering every frame for ~1 s after each hit. Looks the same.
    const eps = maxHp ? maxHp / 300 : 0;
    if (Math.abs(hp - this.shownHp[side]) < eps) this.shownHp[side] = hp;
    if (Math.abs(hp - this.lagHp[side]) < eps) this.lagHp[side] = hp;
  }

  /** HP value → bar pixel key (redraw only when a pixel changes). */
  hpPx(v, maxHp, w) {
    return Math.round((Math.max(0, v) / maxHp) * w);
  }

  onDamage(side) {
    this.lagHold[side] = 350;
  }

  resetHp(side) {
    this.shownHp[side] = null;
  }

  drawHpBar(g, x, y, w, h, side, maxHp, color) {
    g.fillStyle(COLORS.hpBack, 1);
    g.fillRoundedRect(x, y, w, h, 3);
    const lag = Math.max(0, this.lagHp[side] / maxHp);
    const cur = Math.max(0, this.shownHp[side] / maxHp);
    g.fillStyle(COLORS.hpLag, 1);
    g.fillRoundedRect(x, y, w * lag, h, 3);
    g.fillStyle(color, 1);
    if (cur > 0) g.fillRoundedRect(x, y, Math.max(2, w * cur), h, 3);
    g.lineStyle(1, 0xffffff, 0.6);
    g.strokeRoundedRect(x, y, w, h, 3);
  }

  updateTopBar(state, dt) {
    const team = state.teams.enemy;
    const f = team.fighters[team.activeSlot];
    if (this.enemyKey !== f.characterId + f.slot) {
      this.enemyKey = f.characterId + f.slot;
      this.enemyIcon.clear();
      drawAuraIcon(this.enemyIcon, f.aura, 15, 12, 7);
      this.enemyName.setText(f.name);
      this.resetHp('enemy');
    }
    this.timerText.setText(String(state.timer.secondsShown));
    const low = state.timer.secondsShown <= 10;
    if (this.dirty('timerLow', low)) this.timerText.setColor(low ? COLORS.bad : COLORS.text);
    this.easeHp('enemy', f.hp, dt, f.maxHp);
    if (this.dirty('ehp', this.hpPx(this.shownHp.enemy, f.maxHp, 292) + '|' + this.hpPx(this.lagHp.enemy, f.maxHp, 292) + '|' + Math.round(this.shownHp.enemy) + '|' + f.maxHp)) {
      this.enemyHpG.clear();
      this.drawHpBar(this.enemyHpG, 8, 26, 292, 12, 'enemy', f.maxHp, COLORS.hpEnemy);
      this.enemyHpText.setText(Math.max(0, Math.round(this.shownHp.enemy)) + '');
    }
    // bench pips (one per enemy fighter) + burst pips (5 segments of 20)
    const pipKey = team.fighters.map((x) => (x.ko ? 'k' : x.active ? 'a' : 'b')).join('') + '|' + (team.burstUsed ? -1 : Math.round(team.burst));
    if (!this.dirty('epips', pipKey)) return;
    const g = this.enemyPips;
    g.clear();
    team.fighters.forEach((ef, i) => {
      const cx = 226 + i * 13;
      if (ef.ko) {
        g.lineStyle(2, 0x777777, 1);
        g.lineBetween(cx - 4, 8, cx + 4, 16);
        g.lineBetween(cx + 4, 8, cx - 4, 16);
      } else {
        g.fillStyle(auraColor(ef.aura), 1);
        g.fillCircle(cx, 12, 5);
        if (ef.active) {
          g.lineStyle(2, 0xffffff, 1);
          g.strokeCircle(cx, 12, 6);
        }
      }
    });
    const segs = 5;
    const frac = team.burstUsed ? 0 : team.burst / team.burstMax;
    for (let i = 0; i < segs; i++) {
      const x = 268 + i * 7;
      const fill = Math.max(0, Math.min(1, frac * segs - i));
      g.fillStyle(0x333a5c, 1);
      g.fillRect(x, 8, 5, 9);
      if (fill > 0) {
        g.fillStyle(COLORS.burst, 1);
        g.fillRect(x, 8 + 9 * (1 - fill), 5, 9 * fill);
      }
    }
  }

  updatePlayerStatus(state, dt, now) {
    const L = this.L;
    const team = state.teams.player;
    const f = team.fighters[team.activeSlot];
    if (this.playerKey !== f.characterId) {
      this.playerKey = f.characterId;
      this.playerIcon.clear();
      drawAuraIcon(this.playerIcon, f.aura, L.playerHp.x + 7, L.playerHp.nameY + 8, 7);
      this.playerName.setText(f.name);
      this.resetHp('player');
    }
    this.easeHp('player', f.hp, dt, f.maxHp);
    const g = this.playerHpG;
    const ignOn = !!(f.ignition && f.ignition.active);
    const hpKey = [Math.round(this.shownHp.player), this.hpPx(this.lagHp.player, f.maxHp, L.playerHp.w), f.maxHp, ignOn ? Math.ceil(f.ignition.ticksLeft / 6) : -1].join('|');
    const hpDirty = this.dirty('php', hpKey);
    if (hpDirty) {
      g.clear();
      this.drawHpBar(g, L.playerHp.x, L.playerHp.y, L.playerHp.w, L.playerHp.h, 'player', f.maxHp, COLORS.hpPlayer);
      this.playerHpText.setText(Math.max(0, Math.round(this.shownHp.player)) + ' / ' + f.maxHp);
    }
    // Ignition timer bar under the HP bar
    if (hpDirty && ignOn) {
      const max = f.ignition.maxTicks || this.ignitionMax(f);
      g.fillStyle(COLORS.ignite, 1);
      g.fillRect(L.playerHp.x, L.playerHp.y + L.playerHp.h + 2, L.playerHp.w * Math.min(1, f.ignition.ticksLeft / max), 4);
    }

    // Bench portraits: benched slots in slot order
    const benchSlots = team.fighters.filter((x) => x.slot !== team.activeSlot).map((x) => x.slot);
    this.benchViews.forEach((bv, i) => {
      const slot = benchSlots[i];
      this.benchMap[i] = slot === undefined ? null : slot;
      const bf = slot === undefined ? null : team.fighters[slot];
      const bKey = bf ? [bf.characterId, bf.ko, Math.round((bf.hp / bf.maxHp) * 100), Math.ceil(team.tagCooldownTicks / 2), team.tagReady].join('|') : 'none';
      if (!this.dirty('bench' + i, bKey)) return;
      const g2 = bv.g;
      g2.clear();
      const w = bv.r.w;
      const h = bv.r.h;
      if (!bf) {
        bv.name.setText('');
        bv.cd.setText('');
        return;
      }
      const col = bf.ko ? 0x555555 : auraColor(bf.aura);
      g2.fillStyle(COLORS.panel, 1);
      g2.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g2.fillStyle(col, bf.ko ? 0.3 : 0.35);
      g2.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      drawAuraIcon(g2, bf.aura, 0, -6, 12, bf.ko ? 0x666666 : undefined);
      // HP sliver
      g2.fillStyle(COLORS.hpBack, 1);
      g2.fillRect(-w / 2 + 4, h / 2 - 20, w - 8, 3);
      g2.fillStyle(COLORS.hpPlayer, 1);
      g2.fillRect(-w / 2 + 4, h / 2 - 20, (w - 8) * Math.max(0, bf.hp / bf.maxHp), 3);
      bv.name.setText(bf.name);
      if (this.dirty('benchKo' + i, bf.ko)) bv.name.setColor(bf.ko ? COLORS.textDim : COLORS.text);
      let cdText = '';
      if (bf.ko) {
        g2.lineStyle(3, 0xff5d5d, 0.9);
        g2.lineBetween(-14, -20, 14, 8);
        g2.lineBetween(14, -20, -14, 8);
      } else if (team.tagCooldownTicks > 0) {
        const max = Math.max(team.tagCooldownMaxTicks, team.tagCooldownTicks);
        pie(g2, 0, -4, 22, team.tagCooldownTicks / max, 0x000000, 0.65);
        cdText = String(Math.ceil(team.tagCooldownTicks / 60));
      }
      const ready = !bf.ko && team.tagReady;
      g2.lineStyle(ready ? 3 : 2, ready ? COLORS.accent : COLORS.stroke, 1);
      g2.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      bv.cd.setText(cdText);
    });

    // Riposte window indicator
    const ri = L.riposteInfo;
    this.riposteG.clear();
    if (team.riposteWindowTicks > 0) {
      this.riposteText.setVisible(true);
      const frac = Math.min(1, team.riposteWindowTicks / (this.rules ? this.rules.riposteWindowTicks || 48 : 48));
      this.riposteG.fillStyle(0x000000, 0.5);
      this.riposteG.fillRoundedRect(ri.x, ri.y + 32, ri.w, 8, 4);
      this.riposteG.fillStyle(COLORS.accent, 1);
      this.riposteG.fillRoundedRect(ri.x, ri.y + 32, ri.w * frac, 8, 4);
      this.riposteText.setScale(1 + 0.08 * Math.sin(now / 60));
    } else {
      this.riposteText.setVisible(false);
    }

    // IGNITE (56×56): shown while the active fighter can ignite
    const canShow = !!(f.ignition && f.ignition.has && f.ignition.available && !f.ignition.used && !f.ignition.active && !f.ko);
    if (canShow !== this.igniteVisible) {
      this.igniteVisible = canShow;
      this.igniteC.setVisible(canShow);
      if (canShow) {
        this.igniteC.setScale(0.2);
        this.s.tweens.add({ targets: this.igniteC, scale: 1, duration: 260, ease: 'Back.Out' });
      }
    }
    // GDD §5.0: while any Tri-Burst rush runs, IGNITE is locked: draw it grey, no pulse.
    const locked = !!state.triBurstLock;
    if (canShow && locked) {
      const ig = this.igniteG;
      ig.clear();
      ig.fillStyle(COLORS.disabled, 1);
      ig.fillCircle(0, 0, 26);
      ig.lineStyle(2, 0x555a78, 1);
      ig.strokeCircle(0, 0, 26);
      this.igniteText.setAlpha(0.5);
    } else if (canShow) {
      this.igniteText.setAlpha(1);
      const ig = this.igniteG;
      ig.clear();
      const pulse = 0.5 + 0.5 * Math.sin(now / 120);
      ig.fillStyle(COLORS.ignite, 0.35 + 0.3 * pulse);
      ig.fillCircle(0, 0, 30 + pulse * 3);
      ig.fillStyle(COLORS.ignite, 1);
      ig.fillCircle(0, 0, 26);
      ig.lineStyle(2, 0xffffff, 1);
      ig.strokeCircle(0, 0, 26);
    }

    // TRI-BURST (64×64), 4 looks (round 3): charging = dark + orange ring filling; ready = orange pulsing disc +
    // white ring + scale pulse; locked (gauge full, tap refused now) = grey disc, grey dashed ring, padlock, "WAIT";
    // used = dark, no ring, "USED".
    const bg = this.burstG;
    const vis = burstVisual(team);
    const frac = team.burstUsed ? 0 : team.burst / team.burstMax;
    this.burstVisual = vis;
    if (!this.dirty('burst', Math.round(frac * 200) + '|' + vis) && vis !== 'ready') return;
    bg.clear();
    this.burstC.setScale(1);
    if (vis === 'ready') {
      const pulse = 0.5 + 0.5 * Math.sin(now / 110);
      bg.fillStyle(COLORS.burst, 0.35);
      bg.fillCircle(0, 0, 31 + pulse * 3);
      bg.fillStyle(COLORS.burst, 1);
      bg.fillCircle(0, 0, 29);
      bg.lineStyle(3, 0xffffff, 1);
      bg.strokeCircle(0, 0, 29);
      this.burstC.setScale(1 + 0.05 * pulse);
    } else if (vis === 'locked') {
      bg.fillStyle(COLORS.disabled, 1);
      bg.fillCircle(0, 0, 31);
      bg.lineStyle(4, 0x6a7090, 1);
      for (let i = 0; i < 12; i++) {
        const a0 = (Math.PI * 2 * i) / 12;
        bg.beginPath();
        bg.arc(0, 0, 27, a0, a0 + Math.PI / 12, false);
        bg.strokePath();
      }
      // padlock above the label
      bg.lineStyle(2, 0xd8dcf0, 1);
      bg.beginPath();
      bg.arc(0, -15, 4, Math.PI, 0, false);
      bg.strokePath();
      bg.fillStyle(0xd8dcf0, 1);
      bg.fillRect(-6, -15, 12, 9);
    } else {
      bg.fillStyle(COLORS.panel, 1);
      bg.fillCircle(0, 0, 31);
      if (vis === 'charging') {
        bg.lineStyle(6, 0x333a5c, 1);
        bg.strokeCircle(0, 0, 27);
        if (frac > 0) {
          bg.lineStyle(6, COLORS.burst, 1);
          bg.beginPath();
          bg.arc(0, 0, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
          bg.strokePath();
        }
      }
    }
    this.burstText.setText(t(BURST_LABEL_KEYS[vis]));
    this.burstText.setY(vis === 'locked' ? 6 : 0);
    this.burstText.setColor(vis === 'ready' ? COLORS.textDark : vis === 'locked' ? '#d8dcf0' : '#ffffff');
    this.burstText.setStroke(vis === 'ready' ? '#ffffff' : '#000000', vis === 'ready' ? 0 : 3);
    this.burstText.setAlpha(vis === 'charging' ? 0.75 : 1);
  }

  ignitionMax(f) {
    if (!this.ignMax) this.ignMax = {};
    if (!this.ignMax[f.characterId] || f.ignition.ticksLeft > this.ignMax[f.characterId]) this.ignMax[f.characterId] = f.ignition.ticksLeft;
    return this.ignMax[f.characterId];
  }

  updateVigor(state, dt) {
    const team = state.teams.player;
    const v = this.L.vigor;
    const g = this.vigorG;
    if (!this.dirty('vigor', Math.round(team.vigor * 40) + '|' + team.vigorMax + '|' + Math.round(this.vigorFlash * 20))) return;
    g.clear();
    const n = team.vigorMax;
    const gap = 3;
    const sw = (v.w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const x = v.x + i * (sw + gap);
      g.fillStyle(COLORS.vigorEmpty, 1);
      g.fillRoundedRect(x, v.y, sw, v.h, 3);
      const fill = Math.max(0, Math.min(1, team.vigor - i));
      if (fill > 0) {
        g.fillStyle(fill >= 1 ? COLORS.vigor : 0x1f7fa8, 1);
        g.fillRoundedRect(x, v.y, sw * fill, v.h, 3);
      }
    }
    if (this.vigorFlash > 0) {
      g.lineStyle(3, 0xff5d5d, this.vigorFlash);
      g.strokeRoundedRect(v.x - 2, v.y - 2, v.w + 4, v.h + 4, 4);
      this.vigorFlash = Math.max(0, this.vigorFlash - dt / 400);
    }
    this.vigorText.setText(String(team.vigorShown));
  }

  flashVigor() {
    this.vigorFlash = 1;
  }

  updateHand(state, now) {
    const team = state.teams.player;
    const f = team.fighters[team.activeSlot];
    const refillTicks = this.rules ? this.rules.refillTicks : 90;
    const riposteOpen = team.riposteWindowTicks > 0;
    for (let i = 0; i < 4; i++) {
      const cv = this.cardViews[i];
      const card = f.hand[i];
      const key = card ? [f.characterId, card.cardId, card.affordable, card.playable, card.riposte, riposteOpen].join('|') : 'empty|' + f.characterId;
      if (key !== this.cardKeys[i]) {
        const wasEmpty = this.cardKeys[i] && this.cardKeys[i].startsWith('empty');
        this.cardKeys[i] = key;
        this.drawCard(cv, card, riposteOpen);
        if (card && wasEmpty) {
          cv.c.setScale(0.6).setAlpha(0.3);
          this.s.tweens.add({ targets: cv.c, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
        }
      }
      cv.refill.clear();
      if (!card) {
        const left = f.handRefillTicks[i] || 0;
        const frac = 1 - Math.min(1, left / refillTicks);
        const r = cv.r;
        cv.refill.fillStyle(COLORS.vigor, 0.5);
        cv.refill.fillRoundedRect(-r.w / 2 + 8, r.h / 2 - 16, (r.w - 16) * frac, 6, 3);
      } else if (card.riposte && riposteOpen) {
        const r = cv.r;
        cv.refill.lineStyle(3, COLORS.accent, 0.6 + 0.4 * Math.sin(now / 70));
        cv.refill.strokeRoundedRect(-r.w / 2 - 2, -r.h / 2 - 2, r.w + 4, r.h + 4, 12);
      }
    }
  }

  drawCard(cv, card, riposteOpen) {
    const g = cv.g;
    const r = cv.r;
    g.clear();
    cv.badge.setText('');
    if (!card) {
      g.lineStyle(2, COLORS.stroke, 0.5);
      g.strokeRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, 10);
      g.fillStyle(0x000000, 0.25);
      g.fillRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, 10);
      cv.cost.setText('');
      cv.name.setText('');
      cv.type.setText('');
      return;
    }
    const col = cardColor(card.type);
    const grey = !card.affordable;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-r.w / 2, -r.h / 2 + 3, r.w, r.h, 10);
    g.fillStyle(grey ? 0x3b3f55 : col, 1);
    g.fillRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, 10);
    g.fillStyle(0xffffff, grey ? 0.04 : 0.12);
    g.fillRoundedRect(-r.w / 2 + 4, -r.h / 2 + 4, r.w - 8, r.h / 2 - 4, 8);
    // type icon (shape, so colour is not the only cue)
    drawCardTypeIcon(g, card.type, r.w / 2 - 16, -r.h / 2 + 16, 9, grey ? 0x8a8fa8 : 0xffffff);
    // cost badge
    const free = card.riposte && riposteOpen;
    g.fillStyle(free ? COLORS.accent : 0x10142a, 1);
    g.fillCircle(-r.w / 2 + 15, -r.h / 2 + 15, 12);
    g.lineStyle(2, grey ? 0x777777 : 0xffffff, 1);
    g.strokeCircle(-r.w / 2 + 15, -r.h / 2 + 15, 12);
    g.lineStyle(2, grey ? 0x555a78 : 0xffffff, grey ? 0.5 : 0.9);
    g.strokeRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, 10);
    cv.cost.setText(free ? '0' : String(card.cost));
    cv.cost.setColor(free ? COLORS.textDark : grey ? '#9aa0bd' : '#ffffff');
    cv.cost.setStroke(free ? '#ffffff' : '#000000', free ? 0 : 3);
    cv.name.setText(card.name);
    cv.name.setColor(grey ? '#9aa0bd' : '#ffffff');
    cv.type.setText(t('card_type_' + card.type));
    cv.type.setColor(grey ? '#9aa0bd' : '#ffffff');
    cv.c.setAlpha(grey ? 0.85 : 1);
  }

  setBadge(i, text) {
    this.cardViews[i].badge.setText(text);
  }

  pressCard(i, down) {
    const cv = this.cardViews[i];
    this.s.tweens.killTweensOf(cv.c);
    cv.c.setAlpha(1);
    if (down) cv.c.setScale(0.92);
    else this.s.tweens.add({ targets: cv.c, scale: 1, duration: 90, ease: 'Back.Out' });
  }

  playCardAnim(i) {
    const cv = this.cardViews[i];
    this.s.tweens.killTweensOf(cv.c);
    const y0 = cv.r.y + cv.r.h / 2;
    cv.c.setScale(1.05);
    this.s.tweens.add({
      targets: cv.c,
      y: y0 - 40,
      alpha: 0,
      duration: 180,
      ease: 'Quad.Out',
      onComplete: () => {
        cv.c.setY(y0);
        cv.c.setAlpha(1);
        cv.c.setScale(1);
      },
    });
  }

  shakeCard(i) {
    this.s.shake(this.cardViews[i].c);
  }

  pressBench(i, down) {
    this.benchViews[i].c.setScale(down ? 0.92 : 1);
  }

  shakeBench(i) {
    this.s.shake(this.benchViews[i].c);
  }

  pressButton(which, down) {
    const c = which === 'ignite' ? this.igniteC : this.burstC;
    c.setScale(down ? 0.9 : 1);
  }
}
