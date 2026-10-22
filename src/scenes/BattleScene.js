// Battle: a renderer for the pure logic in src/logic. Fixed 60 Hz accumulator → battle.step(inputs);
// every frame draws battle.getState(). Inputs come from gestures (GDD §5.2); feedback from events.
import { BaseScene, t } from './BaseScene.js';
import { COLORS, auraColor, hex } from '../ui/theme.js';
import { data } from '../ui/game-data.js';
import { createBattle } from '../logic/index.js';
import { battleLayout, arenaToScreen, contains } from '../ui/layout.js';
import { GestureTracker } from '../ui/gestures.js';
import { TutorialController } from '../ui/tutorial.js';
import { FighterView } from '../ui/fighter-view.js';
import { BattleHud } from '../ui/battle-hud.js';
import { sfx, haptic } from '../ui/feedback.js';
import { cardColor } from '../ui/icons.js';
import { FloatPlacer } from '../ui/float-placer.js';

const TICK_MS = 1000 / 60;
const MENU_ARM_MS = 250; // new menus (and the battle after a menu closes) ignore input this long
const MAX_STEPS_PER_FRAME = 8; // keeps real-time speed down to ~8 fps; below that the battle slows instead of jumping

function randomSeed() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('seed')) return Number(params.get('seed')) >>> 0;
  const a = new Uint32Array(1);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return a[0];
}

export class BattleScene extends BaseScene {
  constructor() {
    super('Battle');
  }

  create() {
    this.setupView(0x141a33);
    const { H } = this;
    this.L = battleLayout(H);
    this.stage = data.stage(this.initData.stageId);

    // Resume after a resize (scene restart) or start a new battle.
    if (this.initData.live) {
      this.battle = this.initData.live.battle;
      this.tutorial = this.initData.live.tutorial;
      this.seed = this.initData.live.seed;
    } else {
      this.seed = randomSeed();
      this.battle = createBattle({ content: data.content, stageId: this.stage.id, playerTeam: data.teamEntries() }, this.seed);
      this.tutorial = data.tutorialActive(this.stage)
        ? new TutorialController(this.stage.tutorial_steps, this.battle, data.raw.battle.tutorial_slowmo)
        : null;
    }
    this.acc = 0;
    this.pendingInputs = [];
    this.ending = false;
    this.menuOpen = false;
    this.overlay = null;
    this.pressed = null;
    this.comboShown = { player: 0, enemy: 0 };

    this.buildArena();
    const R = data.content.rules;
    this.hud = new BattleHud(this, this.L, { refillTicks: R.hand.refillTicks, riposteWindowTicks: R.riposte.windowTicks });
    this.buildPause();
    this.buildFx();
    this.buildTutorialUi();
    this.registerBattleTargets();
    this.setupInput();

    this.onVisibility = () => {
      if (document.hidden) this.openPause();
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.game.events.on('hidden', this.onVisibility);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.game.events.off('hidden', this.onVisibility);
    });

    const st = this.battle.getState();
    this.render(st, 0); // first: the intro is laid out around the fighters' name labels
    if (st.phase === 'intro') this.showIntro(st);
    if (st.paused) this.openPause();
  }

  restartData() {
    return { stageId: this.stage.id, live: { battle: this.battle, tutorial: this.tutorial, seed: this.seed } };
  }

  // ------------------------------------------------------------------ build
  buildArena() {
    const L = this.L;
    const a = L.arena;
    const g = this.add.graphics().setDepth(-5);
    // sky gradient bands
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const y = a.top + ((a.floorY - a.top) * i) / bands;
      g.fillStyle(0x1a2350 + i * 0x020304, 1);
      g.fillRect(0, y, L.W, (a.floorY - a.top) / bands + 1);
    }
    // distant peaks
    g.fillStyle(0x222b5c, 1);
    g.fillTriangle(-20, a.floorY, 90, a.floorY - 120 - L.extra * 0.3, 200, a.floorY);
    g.fillTriangle(140, a.floorY, 270, a.floorY - 90 - L.extra * 0.3, 400, a.floorY);
    // ring floor
    g.fillStyle(0x2e2a44, 1);
    g.fillRect(0, a.floorY, L.W, a.bottom - a.floorY);
    g.lineStyle(2, 0x8f86c9, 0.7);
    g.lineBetween(0, a.floorY, L.W, a.floorY);
    this.fighters = { player: new FighterView(this, 1), enemy: new FighterView(this, -1) };
    this.distanceText = null;
  }

  buildPause() {
    const p = this.L.pause;
    this.pauseBtn = this.button({ id: 'battle_pause', x: p.x, y: p.y, w: p.w, h: p.h, label: t('pause_icon'), kind: 'secondary', fontSize: 16, onTap: () => this.openPause() });
  }

  buildFx() {
    this.floats = new FloatPlacer();
    this.shoutTxt = {};
    this.fxLayer = this.add.container(0, 0).setDepth(50);
    const a = this.L.arena;
    this.comboText = this.text(16, a.top + 56, '', 22, COLORS.accentText, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 }).setOrigin(0, 0.5).setDepth(51).setAlpha(0);
    this.comboHits = this.text(18, a.top + 80, '', 14, COLORS.text, { stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(51).setAlpha(0);
    this.enemyCombo = this.text(this.L.W - 16, a.top + 56, '', 18, COLORS.bad, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(51).setAlpha(0);
    this.cinematic = this.add.container(0, 0).setDepth(80).setVisible(false);
    this.cinG = this.add.graphics();
    this.cinTitle = this.text(this.L.W / 2, 0, '', 30, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 6, wordWrap: { width: this.L.W - 32 } }).setOrigin(0.5);
    this.cinSub = this.text(this.L.W / 2, 0, '', 16, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 4, wordWrap: { width: this.L.W - 40 } }).setOrigin(0.5);
    this.cinematic.add([this.cinG, this.cinTitle, this.cinSub]);
    this.tooltip = this.add.container(0, 0).setDepth(90).setVisible(false);
  }

  buildTutorialUi() {
    this.tutLayer = this.add.container(0, 0).setDepth(70).setVisible(false);
    this.tutBox = this.add.graphics();
    this.tutText = this.text(this.L.W / 2, 0, '', 15, '#ffffff', { fontStyle: 'bold', align: 'center', wordWrap: { width: this.L.W - 56 } }).setOrigin(0.5);
    this.tutHand = this.add.graphics();
    this.tutLayer.add([this.tutBox, this.tutText, this.tutHand]);
    this.tutStepIndex = null;
  }

  registerBattleTargets() {
    const L = this.L;
    for (let i = 0; i < 4; i++) this.registerTarget('card_' + i, () => L.cardRect(i));
    L.bench.forEach((r, i) => this.registerTarget('bench_' + i, () => r));
    this.registerTarget('ignite', () => L.ignite, () => this.hud.igniteVisible);
    this.registerTarget('tri_burst', () => L.burst);
  }

  // ------------------------------------------------------------------ input
  setupInput() {
    this.gestures = new GestureTracker({
      onDown: (x, y) => this.pressAt(x, y, true),
      onCancel: () => this.releasePress(),
      onTap: (x, y) => {
        this.releasePress();
        this.tapAt(x, y);
      },
      onSwipe: (dir) => {
        this.releasePress();
        this.swipe(dir);
      },
      onLongPress: (x, y) => this.longPress(x, y),
      onLongPressEnd: () => {
        this.releasePress();
        this.tooltip.setVisible(false);
      },
    });
    // Convert through the camera (zoom, origin 0,0) → logical units.
    const cam = this.cameras.main;
    const at = (p) => cam.getWorldPoint(p.x, p.y);
    // Time gestures by the DOM event's own timestamp, not by when a busy frame got round to it.
    const ts = (p) => (p.event && p.event.timeStamp ? p.event.timeStamp : performance.now());
    const blocked = (w) => this.menuOpen || this.ending || contains(this.L.pause, w.x, w.y) || performance.now() < (this.inputArmedAt || 0);
    this.input.on('pointerdown', (p) => {
      const w = at(p);
      if (blocked(w)) return;
      this.gestures.down(p.id, w.x, w.y, ts(p));
    });
    this.input.on('pointermove', (p) => {
      if (this.menuOpen) return;
      const w = at(p);
      this.gestures.move(p.id, w.x, w.y, ts(p));
    });
    const up = (p) => {
      if (this.menuOpen) return;
      const w = at(p);
      this.gestures.up(p.id, w.x, w.y, ts(p));
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  }

  hitTest(x, y) {
    const L = this.L;
    for (let i = 0; i < 4; i++) if (contains(L.cardRect(i), x, y)) return { kind: 'card', i };
    for (let i = 0; i < 2; i++) if (contains(L.bench[i], x, y)) return { kind: 'bench', i };
    if (this.hud.igniteVisible && contains(L.ignite, x, y)) return { kind: 'ignite' };
    if (contains(L.burst, x, y)) return { kind: 'burst' };
    return null;
  }

  pressAt(x, y) {
    const h = this.hitTest(x, y);
    this.pressed = h;
    if (!h) return;
    sfx('ui_press');
    if (h.kind === 'card') this.hud.pressCard(h.i, true);
    else if (h.kind === 'bench') this.hud.pressBench(h.i, true);
    else this.hud.pressButton(h.kind, true);
  }

  releasePress() {
    const h = this.pressed;
    this.pressed = null;
    if (!h) return;
    if (h.kind === 'card') this.hud.pressCard(h.i, false);
    else if (h.kind === 'bench') this.hud.pressBench(h.i, false);
    else this.hud.pressButton(h.kind, false);
  }

  tapAt(x, y) {
    const h = this.hitTest(x, y);
    if (!h) return;
    if (h.kind === 'card') this.queue({ type: 'card', slot: h.i });
    else if (h.kind === 'bench') {
      const slot = this.hud.benchMap[h.i];
      if (slot !== null && slot !== undefined) {
        this.lastBenchTap = h.i;
        this.queue({ type: 'tag', slot: slot });
      }
    } else if (h.kind === 'ignite') this.queue({ type: 'ignite' });
    else if (h.kind === 'burst') this.queue({ type: 'tri_burst' });
  }

  swipe(dir) {
    sfx('swipe_' + dir);
    if (dir === 'right') this.queue({ type: 'dash', dir: 'forward' });
    else if (dir === 'left') this.queue({ type: 'dash', dir: 'back' });
    else this.queue({ type: 'slip' });
    this.swipeTrail(dir);
  }

  queue(input) {
    if (this.ending) return;
    this.pendingInputs.push(input);
    if (window.__TEST__) (window.__TEST__.inputLog = window.__TEST__.inputLog || []).push(input);
  }

  longPress(x, y) {
    const h = this.hitTest(x, y);
    if (!h || h.kind !== 'card') return;
    const st = this.battle.getState();
    const f = st.teams.player.fighters[st.teams.player.activeSlot];
    const c = f.hand[h.i];
    if (!c) return;
    this.showTooltip(c, h.i);
  }

  showTooltip(handCard, i) {
    const def = data.card(handCard.cardId);
    const tt = this.tooltip;
    tt.removeAll(true);
    const W = this.L.W;
    const w = W - 32;
    const r = this.L.cardRect(i);
    const title = this.text(28, 0, handCard.name, 16, '#ffffff', { fontStyle: 'bold' });
    const meta = this.text(28, 24, t('card_tooltip_meta', { type: t('card_type_' + handCard.type), cost: handCard.cost, power: def ? def.power : '-', hits: def ? def.hits : '-' }), 12, COLORS.textDim);
    const desc = this.text(28, 46, def ? def.description : '', 13, '#ffffff', { wordWrap: { width: w - 24 } });
    const h = 46 + desc.height + 14;
    const y = r.y - h - 10;
    const g = this.add.graphics();
    g.fillStyle(0x0b0e1e, 0.95);
    g.fillRoundedRect(16, -12, w, h, 12);
    g.lineStyle(2, cardColor(handCard.type), 1);
    g.strokeRoundedRect(16, -12, w, h, 12);
    tt.add([g, title, meta, desc]);
    tt.setY(y + 12).setVisible(true).setAlpha(0);
    this.tweens.add({ targets: tt, alpha: 1, duration: 100 });
  }

  // ------------------------------------------------------------------ pause
  openPause() {
    if (this.menuOpen || this.ending || this.battle.getResult()) return;
    this.battle.setPaused(true);
    this.menuOpen = true;
    this.gestures.cancel();
    this.releasePress();
    this.showMenu('pause');
  }

  showMenu(kind) {
    if (this.menu) this.menu.destroy();
    this.targets = this.targets.filter((tg) => !tg.menu);
    const { W, H } = this;
    const before = this.targets.length;
    const m = this.add.container(0, 0).setDepth(100);
    const dim = this.add.graphics();
    dim.fillStyle(COLORS.overlay, 0.8);
    dim.fillRect(0, 0, W, H);
    // swallow taps behind the menu
    const blocker = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    m.add([dim, blocker]);
    const panelTop = H - 300;
    const pg = this.add.graphics();
    pg.fillStyle(COLORS.panel, 1);
    pg.fillRoundedRect(16, panelTop, W - 32, 268, 16);
    pg.lineStyle(2, COLORS.stroke, 1);
    pg.strokeRoundedRect(16, panelTop, W - 32, 268, 16);
    m.add(pg);
    const title = kind === 'pause' ? t('battle_paused') : t('battle_retreat_confirm');
    m.add(this.text(W / 2, panelTop + 40, title, kind === 'pause' ? 24 : 16, '#ffffff', { fontStyle: 'bold', align: 'center', wordWrap: { width: W - 64 } }).setOrigin(0.5));
    const bw = W - 64;
    let b1;
    let b2;
    // BUG-2-03: the destructive "Yes, retreat" never sits where "Retreat" was (that slot holds Cancel),
    // and every menu button ignores presses for MENU_ARM_MS after it appears.
    const arm = MENU_ARM_MS;
    if (kind === 'pause') {
      b1 = this.button({ id: 'menu_resume', x: 32, y: panelTop + 96, w: bw, h: 56, label: t('battle_resume'), armMs: arm, onTap: () => this.closePause() });
      b2 = this.button({ id: 'menu_retreat', x: 32, y: panelTop + 176, w: bw, h: 56, label: t('battle_retreat'), kind: 'secondary', armMs: arm, onTap: () => this.showMenu('confirm') });
    } else {
      b1 = this.button({ id: 'menu_retreat_yes', x: 32, y: panelTop + 96, w: bw, h: 56, label: t('battle_retreat_yes'), kind: 'danger', armMs: arm, onTap: () => this.doRetreat() });
      b2 = this.button({ id: 'menu_cancel', x: 32, y: panelTop + 176, w: bw, h: 56, label: t('battle_cancel'), kind: 'secondary', armMs: arm, onTap: () => this.showMenu('pause') });
    }
    m.add([b1.container, b1.zone, b2.container, b2.zone]);
    for (let i = before; i < this.targets.length; i++) this.targets[i].menu = true;
    m.setAlpha(0);
    this.tweens.add({ targets: m, alpha: 1, duration: 120 });
    this.menu = m;
  }

  closePause() {
    if (this.menu) this.menu.destroy();
    this.menu = null;
    this.targets = this.targets.filter((tg) => !tg.menu);
    this.menuOpen = false;
    this.acc = 0;
    this.inputArmedAt = performance.now() + MENU_ARM_MS; // the 2nd tap of a double tap on Resume is not a card tap
    this.battle.setPaused(false);
  }

  doRetreat() {
    if (this.menu) this.menu.destroy();
    this.menu = null;
    this.targets = this.targets.filter((tg) => !tg.menu);
    this.battle.setPaused(false);
    this.battle.retreat();
    this.finishBattle(this.battle.getResult(), 200);
  }

  // ------------------------------------------------------------------ loop
  update(time, delta) {
    const now = performance.now();
    if (!this.menuOpen && !this.ending) {
      this.gestures.update(now);
      const speed = this.tutorial ? this.tutorial.speed() : 1;
      this.acc += Math.min(delta, 130) * speed;
      let steps = 0;
      while (this.acc >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
        this.acc -= TICK_MS;
        steps += 1;
        const inputs = this.pendingInputs;
        this.pendingInputs = [];
        const events = this.battle.step(inputs);
        this.handleEvents(events, now);
        if (this.tutorial) this.tutorial.handleEvents(events, now);
        if (this.ending) break;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.acc = Math.min(this.acc, TICK_MS);
    }
    const st = this.battle.getState();
    if (this.tutorial && !this.ending && !this.menuOpen) this.tutorial.handleState(st, now);
    this.render(st, delta);
  }

  render(st, delta) {
    const L = this.L;
    const now = performance.now();
    const frozen = !!st.freeze || st.paused;
    // Presentation only: keep the two silhouettes from overlapping at close range (logic distance is unchanged).
    let px = arenaToScreen(st.teams.player.x, st.arenaWidth, L);
    let ex = arenaToScreen(st.teams.enemy.x, st.arenaWidth, L);
    const MIN_GAP = 62;
    if (ex - px < MIN_GAP) {
      const mid = Math.max(L.arena.left + MIN_GAP / 2, Math.min(L.arena.right - MIN_GAP / 2, (px + ex) / 2));
      px = mid - MIN_GAP / 2;
      ex = mid + MIN_GAP / 2;
    }
    const sx = { player: px, enemy: ex };
    for (const side of ['player', 'enemy']) {
      const team = st.teams[side];
      const f = team.fighters[team.activeSlot];
      this.fighters[side].update(f, sx[side], L.arena.floorY, now, frozen);
    }
    this.hud.update(st, delta || 0, now);
    this.updateCombo(st);
    this.updateTutorialUi(now);
    if (window.__TEST__) window.__TEST__.lastFrame = now;
  }

  updateCombo(st) {
    const pc = st.teams.player.chain;
    if (pc.cards >= 2 && pc.cards !== this.comboShown.player) {
      this.comboText.setText(t('battle_combo', { n: pc.cards })).setAlpha(1).setScale(1.5);
      this.tweens.add({ targets: this.comboText, scale: 1, duration: 160, ease: 'Back.Out' });
    }
    if (pc.hits >= 2) this.comboHits.setText(t('battle_hits', { n: pc.hits })).setAlpha(1);
    this.comboShown.player = pc.cards;
    const ec = st.teams.enemy.chain;
    if (ec.cards >= 2 && ec.cards !== this.comboShown.enemy) {
      this.enemyCombo.setText(t('battle_combo', { n: ec.cards })).setAlpha(1).setScale(1.4);
      this.tweens.add({ targets: this.enemyCombo, scale: 1, duration: 160, ease: 'Back.Out' });
    }
    this.comboShown.enemy = ec.cards;
  }

  fadeCombo(side) {
    const targets = side === 'player' ? [this.comboText, this.comboHits] : [this.enemyCombo];
    this.tweens.add({ targets, alpha: 0, duration: 400, delay: 300 });
  }

  // ------------------------------------------------------------------ events → feedback
  handleEvents(events, now) {
    const st = events.length ? this.battle.getState() : null;
    if (window.__TEST__ && events.length) {
      const log = (window.__TEST__.eventLog = window.__TEST__.eventLog || []);
      for (const e of events) log.push(e);
      if (log.length > 400) log.splice(0, log.length - 400);
    }
    for (const e of events) {
      switch (e.type) {
        case 'fight_start':
          this.hideIntro();
          this.callout(t('battle_fight'), COLORS.accentText, 44);
          sfx('fight');
          break;
        case 'card_played':
          if (e.side === 'player') this.hud.playCardAnim(e.slot);
          this.shout(e.side, (data.card(e.cardId) || {}).shout);
          sfx('card_' + e.cardType);
          break;
        case 'card_buffered':
          if (e.side === 'player') {
            this.hud.setBadge(e.slot, t('battle_buffered'));
            this.time.delayedCall(400, () => this.hud.setBadge(e.slot, ''));
          }
          break;
        case 'input_rejected':
          if (e.side === 'player') this.rejected(e);
          break;
        case 'hit':
          this.onHit(e, st);
          break;
        case 'perfect_slip':
          this.callout(t('battle_perfect_slip'), COLORS.accentText, 30, e.side);
          if (e.side === 'player') haptic(40);
          sfx('perfect_slip');
          break;
        case 'dodge':
          this.floatText(this.bodyPos(e.side), t('battle_dodge'), '#9fd8ff', 16);
          break;
        case 'riposte':
          this.callout(t('battle_riposte'), '#ffffff', 30, e.side);
          break;
        case 'slip':
          sfx('slip');
          break;
        case 'tag':
          this.floatText(this.bodyPos(e.side), t('battle_tag'), COLORS.accentText, 20);
          this.shoutChar(e.side, st, 'tag_in');
          sfx('tag');
          break;
        case 'tag_strike':
          this.floatText(this.bodyPos(e.side), t('battle_tag_strike'), COLORS.accentText, 18);
          break;
        case 'ko':
          this.callout(t('battle_ko'), COLORS.bad, 48);
          this.cameras.main.shake(250, 0.01);
          sfx('ko');
          break;
        case 'fighter_enter':
          this.shoutChar(e.side, st, 'tag_in');
          break;
        case 'ignition':
          this.showCinematic('ignition', e, st);
          haptic(80);
          sfx('ignition');
          break;
        case 'tri_burst_start':
          sfx('tri_burst_start');
          break;
        case 'tri_burst':
          this.showCinematic('tri_burst', e, st);
          haptic(80);
          break;
        case 'tri_burst_hit':
          this.onTriBurstHit(e);
          break;
        case 'tri_burst_whiff':
          this.callout(t('battle_tri_burst_whiff'), COLORS.textDim, 22);
          break;
        case 'climax_cinematic':
          this.showCinematic('climax', e, st);
          sfx('climax');
          break;
        case 'freeze_end':
          if (e.kind === 'ignition' || e.kind === 'tri_burst' || e.kind === 'climax') this.hideCinematic();
          break;
        case 'chain_end':
          this.fadeCombo(e.side);
          break;
        case 'battle_end':
          this.finishBattle(this.battle.getResult(), 1400);
          break;
        default:
          break;
      }
    }
  }

  rejected(e) {
    const inp = e.input || {};
    sfx('denied');
    if (inp.type === 'card') this.hud.shakeCard(inp.slot);
    if (inp.type === 'tag' && this.lastBenchTap !== undefined) this.hud.shakeBench(this.lastBenchTap);
    if (e.reason === 'vigor') {
      this.hud.flashVigor();
      this.smallFlash(t('battle_no_vigor'));
    } else if (e.reason === 'cooldown') {
      this.smallFlash(t('battle_cooldown'));
    } else if (e.reason === 'not_now' && (inp.type === 'ignite' || inp.type === 'tri_burst') && this.battle.getState().triBurstLock) {
      this.smallFlash(t('battle_tri_burst_lock'));
    }
  }

  onHit(e, st) {
    const target = e.side === 'player' ? 'enemy' : 'player';
    const fv = this.fighters[target];
    fv.hitFlash();
    this.hud.onDamage(target);
    const pos = fv.headPos();
    const crit = e.crit;
    // Numbers and type tags share the body row under the name labels; the placer stacks them (BUG-2-10).
    const bodyY = this.L.arena.floorY - 50;
    this.floatText({ x: pos.x, y: bodyY }, String(e.damage), crit ? '#ffd84a' : '#ffffff', crit ? 26 : 20, true);
    if (crit) this.floatText({ x: pos.x, y: bodyY - 30 }, t('battle_crit'), '#ffd84a', 14);
    if (e.typeMult > 1.0001 && e.hitIndex === 0) this.floatText({ x: pos.x, y: bodyY - 30 }, t('battle_weak'), COLORS.good, 16);
    if (e.typeMult < 0.9999 && e.hitIndex === 0) this.floatText({ x: pos.x, y: bodyY - 30 }, t('battle_resist'), COLORS.textDim, 14);
    this.impact(pos.x, pos.y + 60, cardColor(e.cardType));
    if (target === 'player') haptic(20);
    if (e.cardType === 'climax' || crit) this.cameras.main.shake(120, 0.006);
    sfx('hit_' + e.cardType);
  }

  onTriBurstHit(e) {
    const target = e.side === 'player' ? 'enemy' : 'player';
    const pos = this.fighters[target].headPos();
    this.fighters[target].hitFlash();
    this.hud.onDamage(target);
    this.floatText({ x: pos.x, y: this.L.arena.floorY - 50 }, String(e.damage), '#ffa53d', 28, true);
  }

  // ------------------------------------------------------------------ fx helpers
  bodyPos(side) {
    return { x: this.fighters[side].headPos().x, y: this.L.arena.floorY - 50 };
  }

  /**
   * Rows for floating texts (logical y). The fighters' name labels sit on one fixed row; nothing floats
   * across it. `upper` = above the names (shouts, callouts), `body` = below them (numbers, tags).
   */
  floatBands() {
    const a = this.L.arena;
    const fp = this.fighters.player;
    const fe = this.fighters.enemy;
    const nameTop = Math.min(fp.nameTop(), fe.nameTop());
    const nameBottom = Math.max(fp.nameBottom(), fe.nameBottom());
    return { upper: { top: a.top + 2, bottom: nameTop - 2 }, body: { top: nameBottom + 2, bottom: a.floorY - 2 } };
  }

  /** Fixed texts the floating ones must not cover: name labels, combo counters, the tutorial prompt. */
  floatAvoid() {
    const out = [this.fighters.player.nameRect(), this.fighters.enemy.nameRect()];
    for (const tx of [this.comboText, this.comboHits, this.enemyCombo]) {
      if (tx && tx.alpha > 0.05 && tx.text) {
        const b = tx.getBounds();
        out.push({ x: b.x, y: b.y, w: b.width, h: b.height });
      }
    }
    if (this.tutLayer && this.tutLayer.visible && this.tutRect) out.push(this.tutRect);
    for (const c of [this.introC, this.introFading]) {
      if (!c || !c.list) continue;
      for (const o of c.list) {
        if (o.type !== 'Text') continue;
        const b = o.getBounds();
        out.push({ x: b.x, y: b.y, w: b.width, h: b.height });
      }
    }
    return out;
  }

  /**
   * Spawn one floating text through the placer. o: { x, y, str, size, color, style, bands: ['body'|'upper'],
   * priority, pop (start scale), rise (px), hold (ms before fading), fade (ms), depth }.
   * Returns the Text or null when there is no room (low-priority texts are simply skipped).
   */
  spawnFloat(o) {
    const style = Object.assign({ fontStyle: 'bold', stroke: '#000000', strokeThickness: 4, align: 'center' }, o.style || {});
    const tx = this.text(0, 0, o.str, o.size, o.color, style).setOrigin(0.5).setDepth(o.depth || 60);
    const pop = o.pop || 1;
    const rise = o.rise || 0;
    const hold = o.hold !== undefined ? o.hold : 180;
    const fade = o.fade || 650;
    const bands = this.floatBands();
    const evict = () => {
      this.tweens.killTweensOf(tx);
      tx.destroy();
    };
    const res = this.floats.place({
      w: tx.width * pop + 2,
      h: tx.height * pop + rise + 2,
      x: o.x,
      y: o.y,
      bands: (o.bands || ['body']).map((k) => bands[k]),
      avoid: this.floatAvoid(),
      minX: 2,
      maxX: this.L.W - 2,
      now: this.time.now,
      ttl: hold + fade + 160,
      priority: o.priority || 0,
      onEvict: evict,
    });
    if (!res) {
      tx.destroy();
      return null;
    }
    tx.setPosition(res.x, res.y + rise / 2).setScale(pop);
    if (o.fadeIn) {
      tx.setAlpha(0);
      this.tweens.add({ targets: tx, alpha: 1, duration: 120 });
    }
    this.tweens.add({ targets: tx, scale: 1, duration: 140, ease: 'Back.Out' });
    this.tweens.add({
      targets: tx,
      y: res.y - rise / 2,
      alpha: 0,
      duration: fade,
      delay: hold,
      ease: 'Quad.In',
      onComplete: () => {
        this.floats.release(evict);
        tx.destroy();
      },
    });
    tx.evict = () => {
      this.floats.release(evict);
      evict();
    };
    return tx;
  }

  floatText(pos, str, color, size, pop) {
    return this.spawnFloat({ x: pos.x, y: pos.y, str, color, size, pop: pop ? 1.35 : 1, rise: 14, bands: ['body'], priority: 2 });
  }

  impact(x, y, color) {
    const g = this.add.graphics().setDepth(55);
    g.fillStyle(color, 0.8);
    g.fillCircle(0, 0, 14);
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeCircle(0, 0, 18);
    g.setPosition(x, y);
    this.tweens.add({ targets: g, scale: 2.2, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  callout(str, color, size, side) {
    const a = this.L.arena;
    const x = side === 'enemy' ? this.L.W * 0.66 : side === 'player' ? this.L.W * 0.34 : this.L.W / 2;
    const y = a.top + (a.floorY - a.top) * 0.35;
    return this.spawnFloat({
      x, y, str, color, size,
      style: { strokeThickness: 6 },
      bands: ['upper', 'body'],
      priority: size >= 40 ? 4 : 3,
      pop: 1.3,
      fadeIn: true,
      rise: 12,
      hold: 750,
      fade: 300,
      depth: 65,
    });
  }

  smallFlash(str) {
    const v = this.L.vigor;
    if (this.flashTxt) this.flashTxt.destroy();
    const tx = this.text(this.L.W / 2, v.y - 14, str, 14, COLORS.bad, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(66);
    this.flashTxt = tx;
    this.tweens.add({ targets: tx, alpha: 0, duration: 400, delay: 600, onComplete: () => tx.destroy() });
  }

  shout(side, str) {
    if (!str) return;
    const pos = this.fighters[side].headPos();
    const old = this.shoutTxt[side];
    if (old && old.scene && old.evict) old.evict();
    this.shoutTxt[side] = this.spawnFloat({
      x: pos.x,
      y: this.floatBands().upper.bottom - 12,
      str,
      size: 13,
      color: '#ffffff',
      style: { fontStyle: 'italic', strokeThickness: 3, wordWrap: { width: 150 } },
      bands: ['upper'],
      priority: 1,
      pop: 1.1,
      hold: 900,
      fade: 300,
      depth: 58,
    });
  }

  shoutChar(side, st, key) {
    if (!st) return;
    const team = st.teams[side];
    const f = team.fighters[team.activeSlot];
    const ch = data.character(f.characterId);
    if (ch && ch.shouts && ch.shouts[key]) this.shout(side, ch.shouts[key]);
  }

  swipeTrail(dir) {
    const p = this.L.swipePad;
    const cx = this.L.W / 2;
    const cy = (p.top + p.bottom) / 2;
    const g = this.add.graphics().setDepth(40);
    g.lineStyle(6, 0xffffff, 0.7);
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    g.lineBetween(cx - d[0] * 40, cy - d[1] * 30, cx + d[0] * 40, cy + d[1] * 30);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(cx + d[0] * 40, cy + d[1] * 30, 7);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  showIntro(st) {
    const { W } = this;
    const a = this.L.arena;
    const p = st.teams.player.fighters[st.teams.player.activeSlot];
    const e = st.teams.enemy.fighters[st.teams.enemy.activeSlot];
    const c = this.add.container(0, 0).setDepth(75);
    const g = this.add.graphics();
    c.add(g);
    // BUG-2-09: stack names, then the shout, inside a band that ends above the fighters' name labels.
    const top = a.top + 8;
    const limit = this.floatBands().upper.bottom; // just above the name labels
    const rowY = top + 24;
    const nameStyle = { fontStyle: 'bold', stroke: '#000000', strokeThickness: 5 };
    c.add(this.text(W * 0.25, rowY, p.name, 24, hex(auraColor(p.aura)), nameStyle).setOrigin(0.5));
    c.add(this.text(W / 2, rowY, t('battle_vs'), 26, COLORS.accentText, nameStyle).setOrigin(0.5));
    c.add(this.text(W * 0.75, rowY, e.name, 24, hex(auraColor(e.aura)), nameStyle).setOrigin(0.5));
    let bottom = rowY + 22;
    const ch = data.character(p.characterId);
    if (ch && ch.shouts && ch.shouts.intro) {
      const sh = this.text(W / 2, bottom + 4, ch.shouts.intro, 14, '#ffffff', { fontStyle: 'italic', align: 'center', wordWrap: { width: W - 40 } }).setOrigin(0.5, 0);
      if (sh.y + sh.height > limit - 4) sh.setY(Math.max(rowY + 18, limit - 4 - sh.height));
      c.add(sh);
      bottom = sh.y + sh.height;
    }
    const panelBottom = Math.min(limit - 1, bottom + 8);
    g.fillStyle(0x000000, 0.55);
    g.fillRect(0, top, W, panelBottom - top);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.introC = c;
  }

  hideIntro() {
    if (!this.introC) return;
    const c = this.introC;
    this.introC = null;
    this.introFading = c; // still on screen for 200 ms: floating texts keep clear of it
    this.tweens.add({
      targets: c,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        if (this.introFading === c) this.introFading = null;
        c.destroy();
      },
    });
  }

  showCinematic(kind, e, st) {
    const { W } = this;
    const a = this.L.arena;
    const g = this.cinG;
    g.clear();
    let title = '';
    let sub = '';
    let color = 0xffffff;
    const team = st ? st.teams[e.side] : null;
    const f = team ? team.fighters[team.activeSlot] : null;
    if (kind === 'ignition') {
      title = e.name || (f && f.ignition ? f.ignition.name : '');
      sub = e.shout || '';
      color = f ? auraColor(f.aura) : COLORS.ignite;
    } else if (kind === 'tri_burst') {
      title = t('battle_tri_burst');
      const ch = f ? data.character(f.characterId) : null;
      sub = ch && ch.shouts ? ch.shouts.tri_burst || '' : '';
      color = COLORS.burst;
    } else {
      const card = data.card(e.cardId);
      title = card ? card.name : t('battle_climax');
      sub = card ? card.shout || '' : '';
      color = cardColor('climax');
    }
    const cy = a.top + (a.floorY - a.top) * 0.45;
    g.fillStyle(0x000000, 0.55);
    g.fillRect(0, a.top, W, a.bottom - a.top);
    g.fillStyle(color, 0.85);
    g.fillRect(0, cy - 46, W, 92);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(0, cy - 50, W, 4);
    g.fillRect(0, cy + 46, W, 4);
    this.cinTitle.setText(title).setY(cy - 12);
    this.cinSub.setText(sub).setY(cy + 22);
    this.cinematic.setVisible(true).setAlpha(0);
    this.cinTitle.setScale(1.8);
    this.tweens.add({ targets: this.cinematic, alpha: 1, duration: 120 });
    this.tweens.add({ targets: this.cinTitle, scale: 1, duration: 260, ease: 'Back.Out' });
    this.cameras.main.flash(120, 255, 255, 255);
  }

  hideCinematic() {
    this.tweens.add({ targets: this.cinematic, alpha: 0, duration: 160, onComplete: () => this.cinematic.setVisible(false) });
  }

  // ------------------------------------------------------------------ tutorial
  updateTutorialUi(now) {
    const act = this.tutorial ? this.tutorial.active : null;
    if (!act) {
      if (this.tutStepIndex !== null) {
        this.tutStepIndex = null;
        this.tweens.add({ targets: this.tutLayer, alpha: 0, duration: 150, onComplete: () => this.tutLayer.setVisible(false) });
      }
      return;
    }
    const L = this.L;
    if (this.tutStepIndex !== act.index) {
      this.tutStepIndex = act.index;
      const y = L.arena.top + 12;
      this.tutText.setText(act.step.text).setY(y + 32);
      const h = Math.max(48, this.tutText.height + 22);
      this.tutText.setY(y + h / 2);
      this.tutBox.clear();
      this.tutBox.fillStyle(0x000000, 0.8);
      this.tutBox.fillRoundedRect(16, y, L.W - 32, h, 12);
      this.tutRect = { x: 16, y: y, w: L.W - 32, h: h };
      this.tutBox.lineStyle(2, COLORS.accent, 1);
      this.tutBox.strokeRoundedRect(16, y, L.W - 32, h, 12);
      this.tutLayer.setVisible(true).setAlpha(0);
      this.tweens.killTweensOf(this.tutLayer);
      this.tweens.add({ targets: this.tutLayer, alpha: 1, duration: 150 });
      sfx('tutorial_prompt');
    }
    // pointing hand toward the control for the required action
    const target = this.tutorialTarget(act.step.required_action);
    const g = this.tutHand;
    g.clear();
    if (!target) return;
    const phase = (now % 900) / 900;
    let x = target.x;
    let y = target.y;
    if (target.swipe === 'up') y -= phase * 40;
    if (target.swipe === 'right') x += phase * 50;
    if (target.swipe === 'left') x -= phase * 50;
    if (!target.swipe) y += Math.sin(phase * Math.PI * 2) * 6;
    g.fillStyle(0xffffff, 1);
    g.lineStyle(2, 0x000000, 1);
    // simple pointing hand: finger + palm
    g.fillRoundedRect(x - 5, y, 10, 24, 5);
    g.strokeRoundedRect(x - 5, y, 10, 24, 5);
    g.fillRoundedRect(x - 12, y + 18, 26, 24, 8);
    g.strokeRoundedRect(x - 12, y + 18, 26, 24, 8);
  }

  tutorialTarget(action) {
    const L = this.L;
    const pad = L.swipePad;
    switch (action) {
      case 'play_card':
      case 'riposte': {
        const st = this.battle.getState();
        const f = st.teams.player.fighters[st.teams.player.activeSlot];
        let i = f.hand.findIndex((c) => c && (action === 'riposte' ? c.riposte : c.playable));
        if (i < 0) i = 0;
        const r = L.cardRect(i);
        return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      }
      case 'slip':
        return { x: L.W / 2, y: (pad.top + pad.bottom) / 2 - 10, swipe: 'up' };
      case 'dash_forward':
        return { x: L.W / 2 - 25, y: (pad.top + pad.bottom) / 2 - 10, swipe: 'right' };
      case 'dash_back':
        return { x: L.W / 2 + 25, y: (pad.top + pad.bottom) / 2 - 10, swipe: 'left' };
      case 'tag':
        return { x: L.bench[0].x + 26, y: L.bench[0].y + 26 };
      case 'ignite':
        return { x: L.ignite.x + 28, y: L.ignite.y + 28 };
      case 'tri_burst':
        return { x: L.burst.x + 32, y: L.burst.y + 32 };
      case 'none':
        return { x: L.vigor.x + L.vigor.w / 2, y: L.vigor.y + 4 };
      default:
        return null;
    }
  }

  // ------------------------------------------------------------------ end
  finishBattle(result, delayMs) {
    if (this.ending) return;
    this.ending = true;
    this.gestures.cancel();
    this.releasePress();
    if (result && result.reason === 'timeout') this.callout(t('result_reason_timeout'), COLORS.accentText, 34);
    const out = data.applyResult(this.stage, result);
    this.time.delayedCall(delayMs, () => this.goTo('Result', { stageId: this.stage.id, result: result, rewards: out.rewards, missions: out.missions }));
  }
}
