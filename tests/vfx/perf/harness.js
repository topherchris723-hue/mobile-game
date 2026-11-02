// VFX performance harness (GDD AC-17.6 / AC-17.7 style measurement; owned by vfx-developer, not shipped).
// A real AI-vs-AI stage battle drives createVfx() with stand-in fighters. URL params: rm=1 (reduce motion),
// q=low|high (force quality), speed=N (logic ticks per frame step multiplier), stress=1 (must-FAIL proof: 5,000
// particle budget + a Climax hit every frame), seed=N, stage=stage_005.
import Phaser from 'phaser';
import { createVfx } from '../../../src/vfx/index.js';
import vfxJson from '../../../data/vfx.json';
import { createBattle, createContent } from '../../../src/logic/index.js';
import { battleLayout, arenaToScreen } from '../../../src/ui/layout.js';
import battle from '../../../data/battle.json';
import characters from '../../../data/characters.json';
import cards from '../../../data/cards.json';
import enemies from '../../../data/enemies.json';
import stages from '../../../data/stages.json';
import economy from '../../../data/economy.json';
import banners from '../../../data/banners.json';
import { AURA_COLORS } from '../../../src/ui/theme.js';

const P = new URLSearchParams(location.search);
const stress = P.get('stress') === '1';
const speed = Number(P.get('speed') || 1);
const perf = (window.__perf = { frames: [], particlesMax: 0, flashes: 0, shakes: 0, events: {}, done: false, cap: 0 });

class Harness extends Phaser.Scene {
  create() {
    this.L = battleLayout(640);
    const a = this.L.arena;
    const g = this.add.graphics().setDepth(-5);
    g.fillStyle(0x1a2350, 1).fillRect(0, a.top, 360, a.floorY - a.top);
    g.fillStyle(0x2e2a44, 1).fillRect(0, a.floorY, 360, a.bottom - a.floorY);
    const content = createContent({ battle, characters, cards, enemies, stages, economy, banners });
    this.battle = createBattle({ content, stageId: P.get('stage') || 'stage_005', playerTeam: economy.starting.team,
      playerController: { aiTier: 'master' }, skipIntro: true }, Number(P.get('seed') || 3));
    this.fighters = {};
    for (const side of ['player', 'enemy']) {
      const root = this.add.container(0, a.floorY);
      const body = this.add.graphics();
      root.add(body);
      this.fighters[side] = { root, body, aura: null };
    }
    let data = vfxJson;
    if (stress) {
      data = JSON.parse(JSON.stringify(vfxJson));
      data.limits.max_particles_high = 5000;
      data.limits.max_emitters = 16;
      data.effects.sparks_climax_default.layers[0].count = 100;
    }
    this.vfx = createVfx(this, data, { reduce_motion: P.get('rm') === '1' }, { mode: 'battle', fighters: this.fighters, quality: P.get('q') || (stress ? 'high' : undefined) });
    this.acc = 0;
    this.last = performance.now();
  }

  update(time, delta) {
    const now = performance.now();
    perf.frames.push(now - this.last);
    this.last = now;
    if (perf.done) return;
    this.acc += Math.min(delta, 130) * speed;
    let n = 0;
    while (this.acc >= 1000 / 60 && n < 12 * speed) {
      this.acc -= 1000 / 60;
      n += 1;
      const ev = this.battle.step();
      for (const e of ev) perf.events[e.type] = (perf.events[e.type] || 0) + 1;
      if (stress) ev.push({ type: 'hit', side: 'player', cardType: 'climax', cardId: 'x', hitIndex: 1, crit: false, chainIndex: 1 });
      if (ev.length) this.vfx.onBattleEvents(ev, this.battle.getState(), now);
      if (this.battle.getResult()) { perf.done = true; break; }
    }
    const st = this.battle.getState();
    for (const side of ['player', 'enemy']) {
      const t = st.teams[side];
      const f = t.fighters[t.activeSlot];
      const v = this.fighters[side];
      v.root.x = arenaToScreen(t.x, st.arenaWidth, this.L);
      if (v.aura !== f.aura) {
        v.aura = f.aura;
        v.body.clear().fillStyle(AURA_COLORS[f.aura] || 0x888888, 1).fillRoundedRect(-22, -80, 44, 50, 10).fillCircle(0, -94, 13).fillRect(-16, -34, 32, 34);
      }
    }
    const S = this.vfx.core.store;
    perf.particlesMax = Math.max(perf.particlesMax, S.liveCount);
    perf.cap = this.vfx.core.particleCap();
    perf.flashes = this.vfx.stats.flashes.length;
    perf.shakes = this.vfx.stats.shakes.length;
    perf.quality = this.vfx.core.quality;
  }
}

new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 360, height: 640, backgroundColor: '#0d1020', scene: Harness, fps: { target: 60 } });
