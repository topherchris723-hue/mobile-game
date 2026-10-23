// Battle engine. GDD §5. Pure logic: no DOM, no Phaser. Deterministic for a given seed + input log.
//
// Time model: `this.tick` counts unfrozen fight ticks (60 per second). Every deadline in this file
// (hit ticks, refills, cooldowns, i-frames) is an absolute value of `this.tick`, so global freezes
// (hitstop, cinematics, KO, pause) automatically stop every timer (GDD §5.0).
//
// Order inside one tick (GDD §5.0): 1 inputs → 2 AI → 3 timers → 4 movement → 5 hits → 6 KO → 7 win/lose.

import { SeededRng } from './rng.js';
import { Deck } from './deck.js';
import { createContent, playerFighterDef, enemyFighterDef, getStage } from './content.js';
import { VIGOR_SCALE, vigorUnits } from './rules.js';
import {
  safeFloor, clamp, typeMult, comboMult, buffFactor, hitDamage, triBurstHit,
  burstGainDealt, burstGainTaken, timeoutResultExact,
} from './formulas.js';
import { AiController } from './ai.js';

export const SIDES = ['player', 'enemy'];

export const STATES = {
  Idle: 'Idle', Dashing: 'Dashing', Windup: 'Windup', Active: 'Active', Recovery: 'Recovery',
  Slipping: 'Slipping', SlipRecovery: 'SlipRecovery', Hitstun: 'Hitstun', Knockdown: 'Knockdown',
  Cinematic: 'Cinematic', KO: 'KO', Benched: 'Benched',
};

/** Every event type step() can emit (README "Events"). Consumers map each one (L-shared-009). */
export const BATTLE_EVENT_TYPES = [
  'fight_start', 'card_played', 'card_buffered', 'windup_start', 'hit', 'hit_discarded', 'whiff', 'interrupt',
  'card_cancelled', 'link_open', 'chain_end', 'knockdown', 'getup', 'dash', 'slip', 'perfect_slip', 'dodge', 'riposte',
  'riposte_window_end', 'tag', 'tag_strike', 'ko', 'fighter_enter', 'ignition_ready', 'ignition', 'ignition_end',
  'burst_ready', 'tri_burst_start', 'tri_burst', 'tri_burst_hit', 'tri_burst_whiff', 'climax_cinematic', 'effect',
  'buff_end', 'card_drawn', 'input_rejected', 'freeze_end', 'battle_end',
];

/** `hit_discarded.reason` values (GDD §5.10 round 3: a hit on a rushing fighter is discarded). */
export const HIT_DISCARD_REASONS = ['rush_invulnerable'];

/** `tri_burst_whiff.reason` values (GDD §5.10). */
export const TRI_BURST_WHIFF_REASONS = ['invulnerable', 'safety_net'];

const S = STATES;
const BUFF_TYPES = ['atk_up', 'def_up', 'atk_down', 'def_down'];

/** The other side. */
export function opposite(side) {
  return side === 'player' ? 'enemy' : 'player';
}

/** +1 if this side's forward is toward higher x (player), −1 for the enemy. */
function forwardSign(side) {
  return side === 'player' ? 1 : -1;
}

/** Round a gauge value to 1e-6 so float sums like 99.9999999 reach 100. */
function roundGauge(v) {
  return Math.round(v * 1000000) / 1000000;
}

export class Battle {
  /**
   * config: {
   *   data: { battle, characters, cards, enemies, stages, economy? }  (parsed data files), or
   *   content: result of createContent(data) (reuse it when running many battles),
   *   stageId: 'stage_001'  — or enemyTeam: ['enemy_x', ...] with optional timerS,
   *   playerTeam: ['char_a', ...] or [{ characterId, resonance }, ...],
   *   playerController: 'human' (default) or { aiTier: 'fighter' },
   *   enemyController: 'ai' (default: each enemy's own ai_tier), { aiTier: 'master' } (force a tier),
   *                    or 'human' (inputs come from step({ enemy: [...] })),
   *   skipIntro: false,
   * }
   */
  constructor(config, seed) {
    this.content = config.content || createContent(config.data);
    const R = this.content.rules;
    this.rules = R;
    this.seed = seed >>> 0;
    this.rng = new SeededRng(this.seed);
    const aiRngPlayer = this.rng.fork();
    const aiRngEnemy = this.rng.fork();

    let enemyIds = config.enemyTeam;
    let timerS = config.timerS;
    this.stageId = config.stageId || null;
    if (config.stageId) {
      const stage = getStage(this.content, config.stageId);
      enemyIds = stage.enemy_team;
      if (typeof timerS !== 'number') timerS = stage.timer_s;
    }
    if (typeof timerS !== 'number') timerS = R.timer.defaultS;
    this.timerTicks = Math.round(timerS * R.tickRate);

    const playerDefs = config.playerTeam.map((e) => playerFighterDef(this.content, e));
    const enemyDefs = enemyIds.map((id) => enemyFighterDef(this.content, id));

    this.tick = 0;               // unfrozen fight ticks elapsed
    this.phase = config.skipIntro ? 'fight' : 'intro';
    this.introLeft = config.skipIntro ? 0 : R.introTicks;
    this.paused = false;
    this.freezes = [];           // [{ kind, ticksLeft, side }]; the first one is counting down
    this.queuedInputs = { player: [], enemy: [] };
    this.events = [];
    this.aiFeed = [];            // events since the AIs last looked (they react on the next unfrozen tick)
    this.result = null;
    this.actionSeq = 0;          // id source for card actions (the AI identifies an opposing card by its id, §5.15)

    this.teams = {
      player: this.makeTeam('player', playerDefs, R.arena.startXPlayer),
      enemy: this.makeTeam('enemy', enemyDefs, R.arena.startXEnemy),
    };

    this.controllers = { player: null, enemy: null };
    const pc = config.playerController;
    if (pc && typeof pc === 'object' && pc.aiTier) {
      this.controllers.player = new AiController(this, 'player', aiRngPlayer, pc.aiTier);
    }
    const ec = config.enemyController;
    if (ec !== 'human') {
      const forced = ec && typeof ec === 'object' && ec.aiTier ? ec.aiTier : null;
      this.controllers.enemy = new AiController(this, 'enemy', aiRngEnemy, forced);
    }
    if (this.phase === 'fight') this.emit({ type: 'fight_start' });
  }

  // ------------------------------------------------------------------ setup

  /** Create one team with its fighters, shuffled decks and drawn hands (GDD §5.4). */
  makeTeam(side, defs, startX) {
    const R = this.rules;
    const fighters = [];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const deck = new Deck(R.hand.size);
      deck.reset(d.deck, this.rng);
      fighters.push({
        side: side,
        slot: i,
        def: d,
        hp: d.maxHp,
        state: i === 0 ? S.Idle : S.Benched,
        stateUntil: 0,
        invulnUntil: 0,
        ko: false,
        action: null,
        linkWindow: false,
        slip: null,
        dash: null,
        buffs: {},
        deck: deck,
        cardsPlayed: 0,
        ign: { available: false, availableAt: -1, used: false, active: false, endsAt: 0 },
      });
    }
    return {
      side: side,
      fighters: fighters,
      active: 0,
      x: startX,
      vigor: R.vigor.start,
      burst: 0,
      burstUsed: false,
      tagReadyAt: R.tag.initialCooldownTicks, // GDD §5.8 initial cooldown, counted from "FIGHT!"
      riposteTicks: 0,
      riposteHeld: false,
      buffered: null,
      inFlight: [],              // projectile cards still flying after their thrower was hit
      rush: null,                // this team's Tri-Burst rush action while it is in progress (GDD §5.10)
      chain: { active: false, cards: 0, hits: 0 },
      stats: { perfectSlips: 0, maxChain: 0, kos: 0, usedTriBurst: false, usedIgnition: false, cardsPlayed: 0 },
    };
  }

  // ------------------------------------------------------------------ helpers

  emit(ev) {
    ev.tick = this.tick;
    this.events.push(ev);
    this.aiFeed.push(ev);
  }

  activeFighter(side) {
    const t = this.teams[side];
    return t.fighters[t.active];
  }

  card(id) {
    return this.content.cards[id];
  }

  /** Is the fighter invulnerable on the current tick? (Slip i-frames, tag-in, getup, Tri-Burst rush.) */
  isInvulnerable(f) {
    const now = this.tick;
    if (f.state === S.Slipping && f.slip && now - f.slip.start <= this.rules.slip.iframeTicks) return true;
    if (f.state === S.Knockdown) return true;
    if (now < f.invulnUntil) return true;
    if (f.action && f.action.kind === 'tri_burst') return true;
    return false;
  }

  /**
   * Is the fighter armored right now? (GDD §5.5 round 2: approach, Windup and Active of an `armor: true`
   * card, not its Recovery; and during its own Tri-Burst rush.)
   */
  isArmored(f) {
    const a = f.action;
    if (!a || !a.armor) return false;
    if (a.kind === 'tri_burst') return true;
    return a.phase === 'approach' || a.phase === 'windup' || a.phase === 'active';
  }

  /**
   * Is this fighter rushing right now? (GDD §5.10 round 3: from step 1 of T through step 5 of T + 18 no hit of
   * any source affects it — in-flight projectiles and later hits of earlier cards included.)
   */
  isRushing(f) {
    const t = this.teams[f.side];
    return !f.ko && t.rush !== null && f.action === t.rush && t.fighters[t.active] === f;
  }

  /** Tri-Burst lock (GDD §5.0 round 2, BUG-2-08): true while either side's Tri-Burst rush is in progress. */
  triBurstLocked() {
    return this.teams.player.rush !== null || this.teams.enemy.rush !== null;
  }

  /** Effective ATK (GDD §5.11): base × ignition × buff factor. */
  atkEff(f) {
    const D = this.rules.damage;
    const ign = f.ign.active ? f.def.ignition.stat_mult.atk : 1;
    return f.def.atk * ign * buffFactor(this.buffValue(f, 'atk_up'), this.buffValue(f, 'atk_down'), D.buffMin, D.buffMax);
  }

  /** Effective DEF (GDD §5.11). */
  defEff(f) {
    const D = this.rules.damage;
    const ign = f.ign.active ? f.def.ignition.stat_mult.def : 1;
    return f.def.def * ign * buffFactor(this.buffValue(f, 'def_up'), this.buffValue(f, 'def_down'), D.buffMin, D.buffMax);
  }

  buffValue(f, type) {
    const b = f.buffs[type];
    return b ? b.value : 0;
  }

  /** Keep the active fighters inside the arena and at least min_distance apart. */
  clampX(side, x) {
    const A = this.rules.arena;
    if (side === 'player') return clamp(x, 0, Math.max(0, this.teams.enemy.x - A.minDistance));
    return clamp(x, Math.min(A.width, this.teams.player.x + A.minDistance), A.width);
  }

  distance() {
    return Math.abs(this.teams.enemy.x - this.teams.player.x);
  }

  /** Push a side's active fighter away from the opponent (knockback, Ignition push). Walls clamp it. */
  pushAway(side, amount) {
    const t = this.teams[side];
    t.x = clamp(t.x - forwardSign(side) * amount, 0, this.rules.arena.width);
  }

  /** Put an attacker at melee range of the defender (Riposte, Tag Strike, Tri-Burst). */
  snapToMelee(side) {
    const t = this.teams[side];
    const o = this.teams[opposite(side)];
    if (Math.abs(o.x - t.x) > this.rules.arena.meleeRange) {
      t.x = clamp(o.x - forwardSign(side) * this.rules.arena.meleeRange, 0, this.rules.arena.width);
    }
  }

  addVigor(team, units) {
    team.vigor = Math.min(this.rules.vigor.max, team.vigor + units);
  }

  addBurst(team, amount) {
    if (team.burstUsed) return;
    const B = this.rules.burst;
    const before = team.burst;
    team.burst = Math.min(B.max, roundGauge(team.burst + amount));
    if (before < B.max && team.burst >= B.max) this.emit({ type: 'burst_ready', side: team.side });
  }

  /** End a team's chain (its attack combo on the enemy). +Burst if it was long enough (GDD §5.7). */
  endChain(team, reason) {
    const c = team.chain;
    if (!c.active) return;
    const C = this.rules.combo;
    if (c.cards >= C.chainBurstMinCards) this.addBurst(team, C.chainBurstGain);
    this.emit({ type: 'chain_end', side: team.side, cards: c.cards, hits: c.hits, reason: reason });
    c.active = false;
    c.cards = 0;
    c.hits = 0;
  }

  setIdle(f) {
    f.state = S.Idle;
    f.action = null;
    f.linkWindow = false;
    f.slip = null;
    f.dash = null;
  }

  // ------------------------------------------------------------------ action permission checks
  // These are used both for human input and by the AI, so the AI follows exactly the same rules.

  /** Can this side start a normal (non-Riposte) card or a Riposte card from its hand right now? */
  cardPlayMode(side, slot) {
    const t = this.teams[side];
    const f = this.activeFighter(side);
    if (this.phase !== 'fight' || this.result || f.ko) return { ok: false, reason: 'not_now' };
    const id = f.deck.hand[slot];
    if (id === undefined || id === null) return { ok: false, reason: 'empty_slot' };
    const card = this.card(id);
    const riposteOk = t.riposteTicks > 0 && this.rules.riposte.allowedTypes.indexOf(card.type) >= 0;
    const st = f.state;
    if (st === S.Slipping || st === S.SlipRecovery) {
      return riposteOk ? { ok: true, riposte: true, cost: 0 } : { ok: false, reason: 'state' };
    }
    const normalState = st === S.Idle || st === S.Dashing || (st === S.Recovery && f.linkWindow);
    if (!normalState) {
      if ((st === S.Windup || st === S.Active) && f.action && f.action.kind === 'card') return { ok: false, reason: 'buffer' };
      return { ok: false, reason: 'state' };
    }
    if (riposteOk) return { ok: true, riposte: true, cost: 0 };
    const cost = vigorUnits(card.cost);
    if (t.vigor < cost) return { ok: false, reason: 'vigor' };
    return { ok: true, riposte: false, cost: cost };
  }

  /** Slip / Break Slip check. Returns { ok, isBreak, cost } or { ok:false, reason }. */
  slipMode(side) {
    const t = this.teams[side];
    const f = this.activeFighter(side);
    if (this.phase !== 'fight' || this.result || f.ko) return { ok: false, reason: 'not_now' };
    const SL = this.rules.slip;
    let isBreak = false;
    if (f.state === S.Hitstun) isBreak = true;
    else if (!(f.state === S.Idle || f.state === S.Dashing || (f.state === S.Recovery && f.linkWindow))) return { ok: false, reason: 'state' };
    const cost = isBreak ? SL.breakCost : SL.cost;
    if (t.vigor < cost) return { ok: false, reason: 'vigor' };
    return { ok: true, isBreak: isBreak, cost: cost };
  }

  /** Tag check (GDD §5.8). */
  tagMode(side, slot) {
    const t = this.teams[side];
    const f = this.activeFighter(side);
    if (this.phase !== 'fight' || this.result || f.ko) return { ok: false, reason: 'not_now' };
    const target = t.fighters[slot];
    if (!target || slot === t.active || target.ko) return { ok: false, reason: 'target' };
    if (this.tick < t.tagReadyAt) return { ok: false, reason: 'cooldown' };
    let escape = false;
    if (f.state === S.Hitstun) escape = true;
    else if (!(f.state === S.Idle || f.state === S.Dashing || (f.state === S.Recovery && f.linkWindow))) return { ok: false, reason: 'state' };
    const cost = escape ? this.rules.tag.escapeCost : 0;
    if (t.vigor < cost) return { ok: false, reason: 'vigor' };
    return { ok: true, escape: escape, cost: cost };
  }

  /** Is Tag ready in the `tag_ready` tutorial sense (cooldown 0, state allows, a living bench fighter)? */
  tagReady(side) {
    const t = this.teams[side];
    for (let i = 0; i < t.fighters.length; i++) {
      if (i !== t.active && !t.fighters[i].ko) {
        const m = this.tagMode(side, i);
        if (m.ok && !m.escape) return true;
      }
    }
    return false;
  }

  /** Ignition check (GDD §5.9). */
  igniteMode(side) {
    const f = this.activeFighter(side);
    if (this.phase !== 'fight' || this.result || f.ko) return { ok: false, reason: 'not_now' };
    if (this.triBurstLocked()) return { ok: false, reason: 'not_now' }; // no Ignition during any rush (§5.0)
    if (!f.def.ignition || f.ign.used || !f.ign.available) return { ok: false, reason: 'unavailable' };
    const st = f.state;
    const okState = st === S.Idle || st === S.Dashing || st === S.Windup || st === S.Active || st === S.Recovery || st === S.Hitstun;
    if (!okState) return { ok: false, reason: 'state' };
    if (f.action && f.action.kind === 'tri_burst') return { ok: false, reason: 'state' };
    return { ok: true };
  }

  /** Tri-Burst check (GDD §5.10). */
  triBurstMode(side) {
    const t = this.teams[side];
    const f = this.activeFighter(side);
    if (this.phase !== 'fight' || this.result || f.ko) return { ok: false, reason: 'not_now' };
    if (this.triBurstLocked()) return { ok: false, reason: 'not_now' }; // a rush is in progress (§5.0 lock)
    if (t.burstUsed || t.burst < this.rules.burst.max) return { ok: false, reason: 'gauge' };
    if (!(f.state === S.Idle || f.state === S.Dashing || (f.state === S.Recovery && f.linkWindow))) return { ok: false, reason: 'state' };
    return { ok: true };
  }

  /** Dash check: only from Idle (GDD §5.0 table). */
  dashMode(side) {
    const f = this.activeFighter(side);
    if (this.phase !== 'fight' || this.result || f.ko) return { ok: false, reason: 'not_now' };
    if (f.state !== S.Idle) return { ok: false, reason: 'state' };
    return { ok: true };
  }

  // ------------------------------------------------------------------ inputs (step 1)

  /** Apply one input for a side. Disallowed inputs are ignored and reported as `input_rejected`. */
  applyInput(side, input) {
    const reject = (reason) => this.emit({ type: 'input_rejected', side: side, input: input, reason: reason });
    switch (input.type) {
      case 'card': {
        const m = this.cardPlayMode(side, input.slot);
        if (!m.ok) {
          if (m.reason === 'buffer') {
            this.teams[side].buffered = { slot: input.slot, tick: this.tick };
            this.emit({ type: 'card_buffered', side: side, slot: input.slot });
            return;
          }
          reject(m.reason);
          return;
        }
        this.startCard(side, input.slot, m.riposte, m.cost);
        return;
      }
      case 'dash': {
        const m = this.dashMode(side);
        if (!m.ok) { reject(m.reason); return; }
        this.startDash(side, input.dir === 'back' ? -1 : 1);
        return;
      }
      case 'slip': {
        const m = this.slipMode(side);
        if (!m.ok) { reject(m.reason); return; }
        this.startSlip(side, m.isBreak, m.cost);
        return;
      }
      case 'tag': {
        const m = this.tagMode(side, input.slot);
        if (!m.ok) { reject(m.reason); return; }
        this.doTag(side, input.slot, m.escape, m.cost);
        return;
      }
      case 'ignite': {
        const m = this.igniteMode(side);
        if (!m.ok) { reject(m.reason); return; }
        this.doIgnite(side);
        return;
      }
      case 'tri_burst': {
        const m = this.triBurstMode(side);
        if (!m.ok) { reject(m.reason); return; }
        this.startTriBurst(side);
        return;
      }
      default:
        reject('unknown_input');
    }
  }

  /** Start a card from the hand. Approach → windup → hits → recovery (GDD §5.5). */
  startCard(side, slot, isRiposte, cost) {
    const R = this.rules;
    const t = this.teams[side];
    const f = this.activeFighter(side);
    t.vigor -= cost;
    const cardId = f.deck.play(slot, this.tick, R.hand.refillTicks);
    const card = this.card(cardId);
    f.cardsPlayed += 1;
    t.stats.cardsPlayed += 1;
    t.buffered = null;
    f.dash = null;
    f.slip = null;
    f.linkWindow = false;
    this.actionSeq += 1;
    const action = {
      id: this.actionSeq,
      kind: 'card',
      owner: f,
      cardId: cardId,
      card: card,
      isRiposte: isRiposte,
      phase: 'windup',
      startTick: this.tick,
      windupStart: this.tick,
      windupEnd: this.tick + Math.round(card.windup_s * R.tickRate),
      hitTicks: null,
      nextHit: 0,
      landed: null,
      targetSlot: -1,
      chainIndex: 1,
      critMult: 1,
      comboMult: 1,
      recoveryEnd: 0,
      armor: card.armor === true,
    };
    if (isRiposte) {
      t.riposteTicks = 0;
      if (card.delivery === 'melee') this.snapToMelee(side);
      action.phase = 'active';
      action.windupEnd = this.tick;
      action.hitTicks = this.buildHitTicks(card, this.tick + R.riposte.firstHitTicks);
      f.state = S.Active;
      this.emit({ type: 'riposte', side: side, slot: slot, cardId: cardId });
    } else if (card.delivery === 'melee' && this.distance() > R.arena.meleeRange) {
      action.phase = 'approach';
      action.windupStart = -1;
      f.state = S.Windup;
    } else {
      f.state = S.Windup;
    }
    f.action = action;
    this.emit({ type: 'card_played', side: side, slot: slot, cardId: cardId, cardType: card.type, riposte: isRiposte, cost: cost / VIGOR_SCALE });
    if (action.phase === 'windup') this.emit({ type: 'windup_start', side: side, cardId: cardId, cardType: card.type, windupEnd: action.windupEnd });
    this.applyEffects(side, card, 'use');
  }

  /** Hit ticks for a card whose first hit lands at `first`. */
  buildHitTicks(card, first) {
    const interval = Math.round(card.hit_interval_s * this.rules.tickRate);
    const list = [];
    for (let i = 0; i < card.hits; i++) list.push(first + i * interval);
    return list;
  }

  startDash(side, dir) {
    const f = this.activeFighter(side);
    const A = this.rules.arena;
    f.state = S.Dashing;
    f.dash = { fromX: this.teams[side].x, dir: dir, k: 0, n: A.dashTicks, start: this.tick };
    this.emit({ type: 'dash', side: side, dir: dir > 0 ? 'forward' : 'back' });
  }

  startSlip(side, isBreak, cost) {
    const t = this.teams[side];
    const f = this.activeFighter(side);
    t.vigor -= cost;
    f.action = null;
    f.dash = null;
    f.linkWindow = false;
    t.buffered = null;
    f.state = S.Slipping;
    f.slip = { start: this.tick, isBreak: isBreak, perfectGiven: false };
    if (isBreak) this.endChain(this.teams[opposite(side)], 'break_slip');
    this.emit({ type: 'slip', side: side, isBreak: isBreak, cost: cost / VIGOR_SCALE });
  }

  doTag(side, slot, escape, cost) {
    const R = this.rules;
    const t = this.teams[side];
    const out = this.activeFighter(side);
    t.vigor -= cost;
    if (out.ign.active) this.endIgnition(out, 'tag_out');
    out.action = null;
    out.dash = null;
    out.slip = null;
    out.linkWindow = false;
    out.state = S.Benched;
    t.buffered = null;
    t.riposteTicks = 0;
    t.active = slot;
    const inc = t.fighters[slot];
    this.setIdle(inc);
    inc.invulnUntil = this.tick + R.tag.invulnTicks;
    t.tagReadyAt = this.tick + R.tag.cooldownTicks;
    if (escape) this.endChain(this.teams[opposite(side)], 'tag_escape');
    this.emit({ type: 'tag', side: side, fromSlot: out.slot, toSlot: slot, escape: escape, cost: cost / VIGOR_SCALE });
    const enemy = this.activeFighter(opposite(side));
    if (enemy.state === S.Hitstun) this.startTagStrike(side);
  }

  /** Tag Strike: a free 1-hit melee attack when tagging in during enemy hitstun (GDD §5.8). */
  startTagStrike(side) {
    const R = this.rules;
    const f = this.activeFighter(side);
    const card = {
      id: 'tag_strike', type: 'fist', delivery: 'melee', power: R.tag.strikePower, hits: 1,
      windup_s: 0, hit_interval_s: 0, recovery_s: 0, hitstun_s: R.tag.strikeHitstunTicks / R.tickRate,
      knockback: R.tag.strikeKnockback, armor: false, effects: [], cinematic_s: 0,
    };
    this.snapToMelee(side);
    this.actionSeq += 1;
    f.action = {
      id: this.actionSeq, kind: 'card', owner: f, cardId: 'tag_strike', card: card, isRiposte: false, phase: 'active',
      startTick: this.tick, windupStart: -1, windupEnd: this.tick,
      hitTicks: [this.tick + R.tag.strikeFirstHitTicks], nextHit: 0, landed: null, targetSlot: -1,
      chainIndex: 1, critMult: 1, comboMult: 1, recoveryEnd: 0, armor: false, isTagStrike: true,
    };
    f.state = S.Active;
    this.emit({ type: 'tag_strike', side: side });
  }

  doIgnite(side) {
    const R = this.rules;
    const t = this.teams[side];
    const o = this.teams[opposite(side)];
    const f = this.activeFighter(side);
    const ig = f.def.ignition;
    // 1. cancel own card (no refund); own chain ends.
    f.action = null;
    f.dash = null;
    f.linkWindow = false;
    t.buffered = null;
    this.endChain(t, 'ignition');
    if (f.state === S.Hitstun) this.endChain(o, 'ignition');
    f.state = S.Idle;
    // 3. effects
    f.hp = Math.min(f.def.maxHp, f.hp + safeFloor(f.def.maxHp * ig.heal_pct));
    this.addVigor(t, R.ignition.vigorGain);
    this.pushAway(opposite(side), R.ignition.enemyPush);
    const e = this.activeFighter(opposite(side));
    if (e.action) {
      this.emit({ type: 'card_cancelled', side: opposite(side), cardId: e.action.cardId || e.action.kind, reason: 'ignition' });
      e.action = null;
      e.linkWindow = false;
      if (e.state === S.Windup || e.state === S.Active || e.state === S.Recovery) e.state = S.Idle;
      o.buffered = null;
    }
    o.inFlight = [];
    f.ign.used = true;
    f.ign.active = true;
    f.ign.endsAt = this.tick + Math.round(ig.duration_s * R.tickRate);
    f.deck.reset(f.def.ignitionDeck, this.rng);
    t.stats.usedIgnition = true;
    // 2. cinematic freeze
    this.freezes.push({ kind: 'ignition', ticksLeft: R.ignition.cinematicTicks, side: side });
    this.emit({ type: 'ignition', side: side, slot: f.slot, name: ig.name, shout: ig.shout || '' });
  }

  endIgnition(f, reason) {
    if (!f.ign.active) return;
    f.ign.active = false;
    if (!f.ko) f.deck.reset(f.def.deck, this.rng);
    this.emit({ type: 'ignition_end', side: f.side, slot: f.slot, reason: reason });
  }

  startTriBurst(side) {
    const R = this.rules;
    const t = this.teams[side];
    const f = this.activeFighter(side);
    t.burst = 0;
    t.buffered = null;
    f.dash = null;
    f.linkWindow = false;
    f.state = S.Active;
    f.action = { kind: 'tri_burst', phase: 'rush', startTick: this.tick, rushEnd: this.tick + R.burst.rushTicks, armor: true, cardId: null, startX: t.x };
    t.rush = f.action;
    this.emit({ type: 'tri_burst_start', side: side });
  }

  /**
   * A Tri-Burst rush that did not land: the gauge is refunded `whiff_refund_pct`, Tri-Burst is not used,
   * and the attacker is Idle at its rush-start x (GDD §5.10). reason: 'invulnerable' or 'safety_net'.
   */
  whiffTriBurst(side, reason) {
    const R = this.rules;
    const t = this.teams[side];
    const rush = t.rush;
    t.rush = null;
    t.burst = roundGauge(R.burst.max * R.burst.whiffRefundPct);
    if (t.burst >= R.burst.max) this.emit({ type: 'burst_ready', side: side });
    const f = this.activeFighter(side);
    if (rush && f.action === rush) {
      this.setIdle(f);
      t.x = this.clampX(side, rush.startX);
    }
    this.emit({ type: 'tri_burst_whiff', side: side, burst: t.burst, reason: reason });
  }

  /**
   * Safety net (GDD §5.10 round 2): a rush that ended without landing or whiffing counts as a whiff.
   * Since the round-3 ruling (absolute rush invulnerability, `hit_discarded`) nothing in today's rules can do that;
   * this guards future rule changes. AC-5.10.7 asserts it never fires.
   */
  checkRushSafetyNet() {
    for (const side of SIDES) {
      const t = this.teams[side];
      if (!t.rush) continue;
      const f = this.activeFighter(side);
      if (f.action !== t.rush || f.ko || this.tick > t.rush.rushEnd) this.whiffTriBurst(side, 'safety_net');
    }
  }

  // ------------------------------------------------------------------ card effects (GDD §5.13)

  applyEffects(side, card, when) {
    if (!card.effects) return;
    for (const ef of card.effects) {
      if (ef.on !== when) continue;
      const targetSide = ef.target === 'enemy' ? opposite(side) : side;
      const f = this.activeFighter(targetSide);
      const team = this.teams[targetSide];
      if (f.ko) continue;
      if (BUFF_TYPES.indexOf(ef.type) >= 0) {
        const old = f.buffs[ef.type];
        const value = old ? Math.max(old.value, ef.value) : ef.value;
        f.buffs[ef.type] = { value: value, ticksLeft: Math.round(ef.duration_s * this.rules.tickRate) };
      } else if (ef.type === 'heal_pct') {
        f.hp = Math.min(f.def.maxHp, f.hp + safeFloor(f.def.maxHp * ef.value));
      } else if (ef.type === 'vigor_gain') {
        this.addVigor(team, vigorUnits(ef.value));
      } else if (ef.type === 'burst_gain') {
        this.addBurst(team, ef.value);
      }
      this.emit({ type: 'effect', side: targetSide, slot: f.slot, effect: ef.type, value: ef.value });
    }
  }

  // ------------------------------------------------------------------ public API

  /** Advance one tick (1/60 s). inputs = { player: [...], enemy: [...] } or an array for the player. Returns this tick's events. */
  step(inputs) {
    this.events = [];
    if (this.result || this.paused) return this.events;
    let pIn = [];
    let eIn = [];
    if (Array.isArray(inputs)) pIn = inputs;
    else if (inputs) {
      pIn = inputs.player || [];
      eIn = inputs.enemy || [];
    }

    if (this.phase === 'intro') {
      this.introLeft -= 1;
      if (this.introLeft <= 0) {
        this.phase = 'fight';
        this.emit({ type: 'fight_start' });
      }
      return this.events;
    }

    if (this.freezes.length > 0) {
      const fr = this.freezes[0];
      if (fr.kind === 'hitstop') { // keep taps made during a few-frame hitstop instead of eating them
        for (const i of pIn) this.queuedInputs.player.push(i);
        for (const i of eIn) this.queuedInputs.enemy.push(i);
      }
      fr.ticksLeft -= 1;
      if (fr.ticksLeft <= 0) {
        this.freezes.shift();
        this.emit({ type: 'freeze_end', kind: fr.kind, side: fr.side });
      }
      return this.events;
    }

    // 1. player inputs (player side first, so simultaneous Ignitions resolve player-first)
    const queued = this.queuedInputs;
    this.queuedInputs = { player: [], enemy: [] };
    if (!this.controllers.player) for (const i of queued.player.concat(pIn)) this.applyInput('player', i);
    if (!this.controllers.enemy) for (const i of queued.enemy.concat(eIn)) this.applyInput('enemy', i);
    // 2. AI decisions
    for (const side of SIDES) {
      const c = this.controllers[side];
      if (c) {
        const list = c.decide();
        for (const i of list) this.applyInput(side, i);
      }
    }
    this.aiFeed = [];
    // 3. timers
    this.advanceTimers();
    // 4. movement
    this.advanceMovement();
    // 5. hits
    this.resolveHits();
    // 6. KO
    this.checkKos();
    this.checkRushSafetyNet();
    // 7. win / lose / timer
    this.checkEnd();
    this.tick += 1;
    return this.events;
  }

  /** Pause or resume (GDD §5.14). While paused, step() does nothing. */
  setPaused(paused) {
    this.paused = !!paused;
  }

  /** Retreat from the pause menu = loss (GDD §5.14). */
  retreat() {
    if (this.result) return;
    this.finish('lose', 'retreat');
  }

  /** Tutorial hook (GDD §9.4): hold the Riposte window open while a prompt is shown. */
  holdRiposteWindow(side, held) {
    this.teams[side].riposteHeld = !!held;
  }

  /** The battle result, or null while running. */
  getResult() {
    return this.result;
  }

  // ------------------------------------------------------------------ step 3: timers

  advanceTimers() {
    const R = this.rules;
    const now = this.tick;
    for (const side of SIDES) {
      const t = this.teams[side];
      const f = this.activeFighter(side);
      // Vigor regen (GDD §5.3), plus Ignition bonus
      let regen = R.vigor.regenPerTick;
      if (f.ign.active) regen += Math.round(vigorUnits(f.def.ignition.vigor_regen_bonus) / R.tickRate);
      this.addVigor(t, regen);
      if (t.riposteTicks > 0 && !t.riposteHeld) {
        t.riposteTicks -= 1;
        if (t.riposteTicks === 0) this.emit({ type: 'riposte_window_end', side: side });
      }
      // Hand refills for every fighter, benched ones included (GDD §5.4)
      for (const ff of t.fighters) {
        if (ff.ko) continue;
        const filled = ff.deck.update(now, this.rng);
        for (const slot of filled) this.emit({ type: 'card_drawn', side: side, slot: ff.slot, handSlot: slot, cardId: ff.deck.hand[slot] });
      }
      // Buffs tick only while their fighter is active (GDD §5.13)
      if (!f.ko) {
        for (const type of BUFF_TYPES) {
          const b = f.buffs[type];
          if (b) {
            b.ticksLeft -= 1;
            if (b.ticksLeft <= 0) {
              delete f.buffs[type];
              this.emit({ type: 'buff_end', side: side, slot: f.slot, effect: type });
            }
          }
        }
      }
      // Ignition duration
      if (f.ign.active && now >= f.ign.endsAt) this.endIgnition(f, 'duration');
      // Ignition triggers, checked for benched fighters too (GDD §5.9)
      for (const ff of t.fighters) this.checkIgnitionTriggers(t, ff);
      // State deadlines
      this.advanceFighterState(side, f);
    }
    // Chains end when the defender leaves hitstun (GDD §5.7)
    for (const side of SIDES) {
      const t = this.teams[side];
      if (t.chain.active) {
        const d = this.activeFighter(opposite(side));
        if (d.state !== S.Hitstun) this.endChain(t, 'hitstun_end');
      }
    }
  }

  checkIgnitionTriggers(team, f) {
    if (f.ko || !f.def.ignition || f.ign.used || f.ign.available) return;
    const R = this.rules;
    let koCount = 0;
    for (const o of team.fighters) if (o.ko) koCount += 1;
    for (const trg of f.def.ignition.triggers) {
      let met = false;
      if (trg.type === 'hp_below_pct') met = f.hp * 100 <= trg.value * f.def.maxHp;
      else if (trg.type === 'battle_time_s') met = this.tick + 1 >= Math.round(trg.value * R.tickRate); // elapsed incl. this tick
      else if (trg.type === 'cards_played') met = f.cardsPlayed >= trg.value;
      else if (trg.type === 'ally_ko') met = koCount >= trg.value;
      if (met) {
        f.ign.available = true;
        f.ign.availableAt = this.tick;
        this.emit({ type: 'ignition_ready', side: team.side, slot: f.slot });
        return;
      }
    }
  }

  advanceFighterState(side, f) {
    const R = this.rules;
    const now = this.tick;
    if (f.state === S.Hitstun && now >= f.stateUntil) {
      f.state = S.Idle;
    } else if (f.state === S.Knockdown && now >= f.stateUntil) {
      f.state = S.Idle;
      this.emit({ type: 'getup', side: side, slot: f.slot });
    } else if (f.state === S.Slipping && f.slip && now - f.slip.start > R.slip.iframeTicks) {
      f.state = S.SlipRecovery;
    } else if (f.state === S.SlipRecovery && f.slip && now - f.slip.start > R.slip.iframeTicks + R.slip.recoveryTicks) {
      this.setIdle(f);
    }
    const a = f.action;
    if (!a || a.kind !== 'card') return;
    if (a.phase === 'windup' && now >= a.windupEnd) this.beginHits(side, f);
    if (a.phase === 'recovery' && now >= a.recoveryEnd) this.setIdle(f);
  }

  /** Windup finished: schedule the hits (GDD §5.5 delivery rules). */
  beginHits(side, f) {
    const a = f.action;
    const card = a.card;
    let first = this.tick;
    if (card.delivery === 'projectile') first += Math.round((this.distance() / card.projectile_speed) * this.rules.tickRate);
    a.hitTicks = this.buildHitTicks(card, first);
    a.phase = 'active';
    f.state = S.Active;
  }

  // ------------------------------------------------------------------ step 4: movement

  advanceMovement() {
    const R = this.rules;
    const A = R.arena;
    for (const side of SIDES) {
      const t = this.teams[side];
      const f = this.activeFighter(side);
      if (f.state === S.Dashing && f.dash && this.tick > f.dash.start) {
        const d = f.dash;
        d.k += 1;
        const target = d.fromX + forwardSign(side) * d.dir * (A.dashDistance * d.k) / d.n;
        t.x = this.clampX(side, target);
        if (d.k >= d.n) this.setIdle(f);
      }
      const a = f.action;
      if (a && a.kind === 'card' && a.phase === 'approach' && this.tick > a.startTick) {
        const step = A.approachPerTick;
        const before = this.distance();
        if (before - A.meleeRange <= step / 2) {
          this.arrive(side, f);
        } else {
          t.x = this.clampX(side, t.x + forwardSign(side) * step);
          const after = this.distance();
          if (after - A.meleeRange <= step / 2) {
            this.arrive(side, f);
          } else if (this.tick - a.startTick >= A.approachTimeoutTicks) {
            // Approach timeout: the card whiffs and goes to Recovery (GDD §5.1)
            a.landed = false;
            a.phase = 'recovery';
            a.recoveryEnd = this.tick + Math.round(a.card.recovery_s * R.tickRate);
            f.state = S.Recovery;
            f.linkWindow = false;
            this.teams[side].buffered = null;
            this.emit({ type: 'whiff', side: side, cardId: a.cardId, reason: 'approach_timeout' });
          }
        }
      }
    }
  }

  arrive(side, f) {
    const R = this.rules;
    const t = this.teams[side];
    const o = this.teams[opposite(side)];
    if (Math.abs(o.x - t.x) > R.arena.meleeRange) t.x = this.clampX(side, o.x - forwardSign(side) * R.arena.meleeRange);
    const a = f.action;
    a.phase = 'windup';
    a.windupStart = this.tick;
    a.windupEnd = this.tick + Math.round(a.card.windup_s * R.tickRate);
    this.emit({ type: 'windup_start', side: side, cardId: a.cardId, cardType: a.card.type, windupEnd: a.windupEnd });
    if (a.windupEnd <= this.tick) this.beginHits(side, f);
  }

  // ------------------------------------------------------------------ step 5: hits

  resolveHits() {
    const R = this.rules;
    const now = this.tick;
    // Phase A: decide every hit from the state at the start of step 5.
    const planned = [];
    for (const side of SIDES) {
      const f = this.activeFighter(side);
      const a = f.action;
      if (!a) continue;
      const d = this.activeFighter(opposite(side));
      if (a.kind === 'tri_burst') {
        if (now >= a.rushEnd) planned.push(this.planTriBurst(side, f, d));
        continue;
      }
      if (a.phase !== 'active' || !a.hitTicks) continue;
      if (a.nextHit >= a.hitTicks.length || a.hitTicks[a.nextHit] !== now) continue;
      planned.push(this.planCardHit(side, a, d));
    }
    for (const side of SIDES) {
      const d = this.activeFighter(opposite(side));
      for (const a of this.teams[side].inFlight) {
        if (a.nextHit < a.hitTicks.length && a.hitTicks[a.nextHit] === now) planned.push(this.planCardHit(side, a, d));
      }
    }
    // Phase B: apply them together.
    let hitstop = 0;
    for (const p of planned) {
      if (!p) continue;
      const h = this.applyPlanned(p);
      if (h > hitstop) hitstop = h;
    }
    if (hitstop > 0) this.freezes.unshift({ kind: 'hitstop', ticksLeft: hitstop, side: null });
    // Phase C: finish cards whose last hit was this tick (link window, buffer, chain cap).
    for (const p of planned) if (p && p.kind === 'card') this.afterCardHit(p);
  }

  /** Decide a card hit: landed or whiffed, damage, crit, chain index. Pure read of current state. */
  planCardHit(side, a, d) {
    const R = this.rules;
    const f = a.owner;
    const card = a.card;
    const attackerTeam = this.teams[side];
    const hitIndex = a.nextHit;
    const p = { kind: 'card', side: side, f: f, d: d, a: a, hitIndex: hitIndex, damages: [], landed: false, perfect: false };
    if (hitIndex > 0 && a.landed && (d.slot !== a.targetSlot || d.ko)) return p; // target left (KO / tag)
    // GDD §5.10 round 3: a rushing fighter is untouchable; this overrides "the first hit decides the whole card".
    if (this.isRushing(d)) { p.discarded = true; return p; }
    if (hitIndex === 0) {
      if (this.isInvulnerable(d)) {
        p.landed = false;
        const sl = d.slip;
        if (d.state === S.Slipping && sl && !sl.isBreak && !sl.perfectGiven && this.tick - sl.start <= R.slip.perfectTicks) p.perfect = true;
        return p;
      }
      p.landed = true;
      p.defenderInHitstun = d.state === S.Hitstun;
      p.defArmored = this.isArmored(d);
      // A hit on an armored fighter never starts or extends a chain (GDD §5.5 round 2).
      const chainContinues = attackerTeam.chain.active && p.defenderInHitstun && !p.defArmored;
      p.chainIndex = chainContinues ? attackerTeam.chain.cards + 1 : 1;
      const critRate = Math.min(f.def.critRate, R.damage.critCap);
      p.crit = !a.isTagStrike && this.rng.next() < critRate;
      p.critMult = p.crit ? R.damage.critMult : 1;
      p.comboMult = comboMult(p.chainIndex, R.combo.bonusPerCard, R.combo.bonusMaxSteps);
    } else {
      if (!a.landed) return p; // the first hit decided the whole card
      p.landed = true;
      p.defArmored = this.isArmored(d);
      p.crit = a.critMult > 1;
      p.critMult = a.critMult;
      p.comboMult = a.comboMult;
      p.chainIndex = a.chainIndex;
    }
    const atk = this.atkEff(f);
    const def = this.defEff(d);
    const tm = typeMult(R.typeChart, f.def.aura, d.def.aura);
    p.typeMult = tm;
    const riposteMult = a.isRiposte ? R.riposte.damageMult : 1;
    const power = a.isTagStrike ? R.tag.strikePower : card.power;
    // A Climax applies all of its hits at once, during its cinematic (GDD §5.5).
    const n = card.type === 'climax' && hitIndex === 0 ? card.hits : 1;
    for (let i = 0; i < n; i++) {
      p.damages.push(hitDamage({
        atk: atk, power: power, hits: card.hits, typeMult: tm, critMult: p.critMult,
        comboMult: p.comboMult, riposteMult: riposteMult, def: def,
      }, R.damage));
    }
    return p;
  }

  planTriBurst(side, f, d) {
    const R = this.rules;
    const p = { kind: 'tri_burst', side: side, f: f, d: d, landed: false, perfect: false, damages: [] };
    if (this.isInvulnerable(d)) {
      const sl = d.slip;
      if (d.state === S.Slipping && sl && !sl.isBreak && !sl.perfectGiven && this.tick - sl.start <= R.slip.perfectTicks) p.perfect = true;
      return p;
    }
    p.landed = true;
    const t = this.teams[side];
    const def = this.defEff(d);
    p.members = [];
    for (const m of t.fighters) {
      if (m.ko) continue;
      // Buffs and Ignition count only for the active fighter (GDD §5.10).
      const atk = m === f ? this.atkEff(m) : m.def.atk;
      const tm = typeMult(R.typeChart, m.def.aura, d.def.aura);
      const dmg = triBurstHit(atk, tm, def, R.burst.powerPerMember, R.damage);
      p.damages.push(dmg);
      p.members.push(m.slot);
    }
    return p;
  }

  /** Apply one planned hit. Returns the hitstop ticks it asks for. */
  applyPlanned(p) {
    const R = this.rules;
    const side = p.side;
    const dSide = opposite(side);
    const at = this.teams[side];
    const dt = this.teams[dSide];
    const d = p.d;
    if (p.discarded) {
      // GDD §5.10 round 3: 0 damage, no hitstun/knockback, no Burst, no on-hit effects, no hitstop, not a dodge.
      // A discarded first hit leaves the card unlanded (its later hits follow the first-hit rule); a discarded Climax
      // first hit consumes all its hits, as they are applied together (§5.5).
      const card = p.a.card;
      if (p.hitIndex === 0) p.a.landed = false;
      p.a.nextHit += card.type === 'climax' && p.hitIndex === 0 ? card.hits : 1;
      this.emit({
        type: 'hit_discarded', side: side, cardId: p.a.cardId, cardType: card.type, targetSlot: d.slot,
        hitIndex: p.hitIndex, reason: 'rush_invulnerable',
      });
      return 0;
    }
    if (!p.landed) {
      if (p.kind === 'tri_burst') {
        this.whiffTriBurst(side, 'invulnerable');
      } else if (p.hitIndex === 0) {
        p.a.landed = false;
        this.emit({ type: 'whiff', side: side, cardId: p.a.cardId, reason: 'invulnerable' });
      }
      if (p.perfect) this.perfectSlip(dSide, d);
      else if (p.kind === 'tri_burst' || p.hitIndex === 0) {
        if (d.state === S.Slipping) this.emit({ type: 'dodge', side: dSide, slot: d.slot });
      }
      if (p.kind === 'card') p.a.nextHit += 1;
      return 0;
    }

    if (p.kind === 'tri_burst') {
      at.burstUsed = true;
      at.burst = 0;
      at.rush = null;
      at.stats.usedTriBurst = true;
      this.snapToMelee(side);
      this.freezes.push({ kind: 'tri_burst', ticksLeft: R.burst.cinematicTicks, side: side });
      this.emit({ type: 'tri_burst', side: side, members: p.members, damages: p.damages.slice() });
      for (let i = 0; i < p.damages.length; i++) {
        this.dealDamage(side, d, p.damages[i]);
        this.emit({ type: 'tri_burst_hit', side: side, memberSlot: p.members[i], damage: p.damages[i], targetSlot: d.slot, hpAfter: d.hp });
      }
      this.setIdle(p.f);
      // GDD §5.10 round 2: the target's card (armored or not, no refund) and its projectiles in flight are
      // cancelled, chains on both sides end, and unless the hits KO it the target is knocked down.
      if (d.action) {
        this.emit({ type: 'card_cancelled', side: dSide, cardId: d.action.cardId || d.action.kind, reason: 'tri_burst' });
      }
      d.action = null;
      d.dash = null;
      d.linkWindow = false;
      dt.buffered = null;
      dt.inFlight = [];
      this.endChain(at, 'tri_burst');
      this.endChain(dt, 'tri_burst');
      if (d.hp > 0) this.knockdown(dSide, d);
      return 0;
    }

    const a = p.a;
    const card = a.card;
    if (p.hitIndex === 0) {
      a.landed = true;
      a.targetSlot = d.slot;
      a.chainIndex = p.chainIndex;
      a.critMult = p.critMult;
      a.comboMult = p.comboMult;
      const c = at.chain;
      if (p.defArmored) {
        this.endChain(at, 'armor'); // no chain is open after a hit on an armored fighter (GDD §5.5)
      } else if (p.chainIndex === 1) {
        this.endChain(at, 'restart');
        c.active = true;
        c.cards = 1;
        c.hits = 0;
      } else {
        c.cards = p.chainIndex;
      }
      if (c.cards > at.stats.maxChain) at.stats.maxChain = c.cards;
      this.applyEffects(side, card, 'hit');
    }
    const hitsNow = p.damages.length;
    for (let i = 0; i < hitsNow; i++) {
      if (at.chain.active) at.chain.hits += 1;
      this.dealDamage(side, d, p.damages[i]);
      this.emit({
        type: 'hit', side: side, cardId: a.cardId, cardType: card.type, targetSlot: d.slot,
        damage: p.damages[i], crit: p.crit, typeMult: p.typeMult, chainIndex: a.chainIndex,
        comboHits: at.chain.hits, hitIndex: p.hitIndex + i, hits: card.hits, riposte: a.isRiposte, hpAfter: d.hp,
      });
    }
    a.nextHit += hitsNow;
    // Defender reaction: armor keeps going (GDD §5.5), otherwise hitstun + interrupt + knockback.
    if (!p.defArmored) {
      if (d.action && d.action.kind === 'card') {
        const da = d.action;
        if (da.phase === 'approach' || da.phase === 'windup') {
          this.emit({ type: 'interrupt', side: dSide, cardId: da.cardId });
        } else if (da.phase === 'active' && da.card.delivery === 'projectile' && da.nextHit < da.hitTicks.length) {
          da.detached = true; // already thrown: the volley keeps flying (GDD §5.5 interrupt covers windup/approach only)
          dt.inFlight.push(da);
        }
      }
      d.action = null;
      d.dash = null;
      d.slip = null;
      d.linkWindow = false;
      dt.buffered = null;
      d.state = S.Hitstun;
      d.stateUntil = this.tick + Math.round(card.hitstun_s * R.tickRate);
      this.pushAway(dSide, (card.knockback / card.hits) * hitsNow);
    }
    if (card.type === 'climax' && p.hitIndex === 0) {
      this.freezes.push({ kind: 'climax', ticksLeft: Math.round(card.cinematic_s * R.tickRate), side: side });
      this.emit({ type: 'climax_cinematic', side: side, cardId: a.cardId });
    }
    return R.hitstopTicks[card.type] || 0;
  }

  /** Subtract HP and give both teams their Burst gains (GDD §5.10). */
  dealDamage(side, d, dmg) {
    const R = this.rules;
    const at = this.teams[side];
    const dt = this.teams[opposite(side)];
    const real = Math.min(dmg, d.hp);
    d.hp -= real;
    this.addBurst(at, burstGainDealt(dmg, d.def.maxHp, R.burst.gainDealtFactor));
    this.addBurst(dt, burstGainTaken(dmg, d.def.maxHp, R.burst.gainTakenFactor));
  }

  perfectSlip(side, f) {
    const R = this.rules;
    const t = this.teams[side];
    f.slip.perfectGiven = true;
    this.addVigor(t, R.slip.perfectRefund);
    this.addBurst(t, R.slip.perfectBurstGain);
    t.riposteTicks = R.riposte.windowTicks;
    t.stats.perfectSlips += 1;
    this.emit({ type: 'perfect_slip', side: side, slot: f.slot, slipStart: f.slip.start });
  }

  knockdown(side, d) {
    const R = this.rules;
    d.action = null;
    d.dash = null;
    d.slip = null;
    d.linkWindow = false;
    d.state = S.Knockdown;
    d.stateUntil = this.tick + R.combo.getupTicks;
    this.pushAway(side, R.combo.knockdownDistance);
    this.emit({ type: 'knockdown', side: side, slot: d.slot });
  }

  /** After a card's hit this tick: open recovery/link window when its last hit is done (GDD §5.7). */
  afterCardHit(p) {
    const R = this.rules;
    const side = p.side;
    const f = p.f;
    const a = p.a;
    const t = this.teams[side];
    if (a.detached) {
      const idx = t.inFlight.indexOf(a);
      if (a.nextHit >= a.hitTicks.length && idx >= 0) t.inFlight.splice(idx, 1);
      return;
    }
    if (f.action !== a) return; // the card was cancelled this tick (trade into hitstun)
    if (a.nextHit < a.hitTicks.length) return;
    a.phase = 'recovery';
    a.recoveryEnd = this.tick + Math.round(a.card.recovery_s * R.tickRate);
    f.state = S.Recovery;
    f.linkWindow = a.landed === true;
    if (a.landed && a.chainIndex >= R.combo.maxCards) {
      const d = this.activeFighter(opposite(side));
      if (!d.ko && d.state === S.Hitstun) this.knockdown(opposite(side), d);
      this.endChain(t, 'chain_cap');
    }
    if (a.recoveryEnd <= this.tick) this.setIdle(f);
    if (f.linkWindow) this.emit({ type: 'link_open', side: side });
    const buf = t.buffered;
    t.buffered = null;
    if (buf && a.landed && this.tick - buf.tick <= R.combo.bufferTicks) this.applyInput(side, { type: 'card', slot: buf.slot });
  }

  // ------------------------------------------------------------------ step 6: KO

  checkKos() {
    const R = this.rules;
    for (const side of SIDES) {
      const t = this.teams[side];
      const f = this.activeFighter(side);
      if (f.ko || f.hp > 0) continue;
      f.ko = true;
      if (f.ign.active) this.endIgnition(f, 'ko');
      f.action = null;
      f.dash = null;
      f.slip = null;
      f.linkWindow = false;
      f.buffs = {};
      f.state = S.KO;
      t.buffered = null;
      t.riposteTicks = 0;
      t.stats.kos += 1;
      this.endChain(this.teams[opposite(side)], 'ko');
      this.addBurst(t, R.ko.allyKoBurstGain);
      this.freezes.push({ kind: 'ko', ticksLeft: R.ko.animTicks, side: side });
      this.emit({ type: 'ko', side: side, slot: f.slot });
      let next = -1;
      for (let i = 0; i < t.fighters.length; i++) {
        if (!t.fighters[i].ko) { next = i; break; }
      }
      if (next >= 0) {
        t.active = next;
        const inc = t.fighters[next];
        this.setIdle(inc);
        inc.invulnUntil = this.tick + R.ko.incomingInvulnTicks;
        t.tagReadyAt = this.tick; // tag cooldown resets to 0 (GDD §5.8)
        this.emit({ type: 'fighter_enter', side: side, slot: next });
      }
    }
  }

  // ------------------------------------------------------------------ step 7: end

  teamWiped(side) {
    for (const f of this.teams[side].fighters) if (!f.ko) return false;
    return true;
  }

  teamHp(side) {
    let hp = 0;
    let max = 0;
    for (const f of this.teams[side].fighters) {
      hp += f.hp;
      max += f.def.maxHp;
    }
    return { hp: hp, max: max };
  }

  checkEnd() {
    const pw = this.teamWiped('player');
    const ew = this.teamWiped('enemy');
    if (pw && ew) { this.finish('draw', 'double_ko'); return; }
    if (ew) { this.finish('win', 'ko'); return; }
    if (pw) { this.finish('lose', 'ko'); return; }
    if (this.tick + 1 >= this.timerTicks) {
      const p = this.teamHp('player');
      const e = this.teamHp('enemy');
      this.finish(timeoutResultExact(p.hp, p.max, e.hp, e.max), 'timeout');
    }
  }

  finish(outcome, reason) {
    const p = this.teams.player;
    const elapsedTicks = Math.min(this.tick + 1, this.timerTicks);
    const php = this.teamHp('player');
    const ehp = this.teamHp('enemy');
    this.result = {
      outcome: outcome,
      reason: reason,
      ticks: elapsedTicks,
      timeElapsedS: elapsedTicks / this.rules.tickRate,
      playerHpRatio: php.hp / php.max,
      enemyHpRatio: ehp.hp / ehp.max,
      stats: {
        playerKos: p.stats.kos,
        perfectSlips: p.stats.perfectSlips,
        maxChain: p.stats.maxChain,
        usedTriBurst: p.stats.usedTriBurst,
        usedIgnition: p.stats.usedIgnition,
        cardsPlayed: p.stats.cardsPlayed,
      },
    };
    this.emit({ type: 'battle_end', outcome: outcome, reason: reason });
  }

  // ------------------------------------------------------------------ snapshot

  /** A plain, JSON-serialisable snapshot of everything the UI needs. Safe to keep; it is a copy. */
  getState() {
    const R = this.rules;
    const teams = {};
    for (const side of SIDES) {
      const t = this.teams[side];
      const fighters = [];
      for (const f of t.fighters) {
        const hand = [];
        for (let i = 0; i < f.deck.hand.length; i++) {
          const id = f.deck.hand[i];
          if (id === null) {
            hand.push(null);
          } else {
            const c = this.card(id);
            const active = t.fighters[t.active] === f;
            const mode = active ? this.cardPlayMode(side, i) : { ok: false };
            hand.push({
              cardId: id, name: c.name, type: c.type, cost: c.cost,
              affordable: t.vigor >= vigorUnits(c.cost) || (t.riposteTicks > 0 && R.riposte.allowedTypes.indexOf(c.type) >= 0),
              playable: !!mode.ok, riposte: !!mode.riposte,
            });
          }
        }
        const buffs = [];
        for (const type of BUFF_TYPES) {
          const b = f.buffs[type];
          if (b) buffs.push({ type: type, value: b.value, ticksLeft: b.ticksLeft });
        }
        const a = f.action;
        fighters.push({
          slot: f.slot,
          characterId: f.def.characterId,
          enemyId: f.def.enemyId,
          name: f.def.name,
          aura: f.def.aura,
          boss: f.def.boss,
          hp: f.hp,
          maxHp: f.def.maxHp,
          atk: Math.floor(this.atkEff(f)),
          def: Math.floor(this.defEff(f)),
          state: f.state,
          ko: f.ko,
          active: t.active === f.slot,
          invulnerable: t.active === f.slot && !f.ko ? this.isInvulnerable(f) : false,
          action: a ? {
            kind: a.kind, cardId: a.cardId, cardType: a.card ? a.card.type : null, phase: a.phase,
            riposte: !!a.isRiposte, tagStrike: !!a.isTagStrike,
          } : null,
          linkWindow: f.linkWindow,
          hand: hand,
          handRefillTicks: f.deck.refillAt.map((x) => (x < 0 ? 0 : Math.max(0, x - this.tick))),
          drawCount: f.deck.draw.length,
          discardCount: f.deck.discard.length,
          buffs: buffs,
          ignition: {
            has: !!f.def.ignition,
            name: f.def.ignition ? f.def.ignition.name : null,
            available: f.ign.available && !f.ign.used,
            used: f.ign.used,
            active: f.ign.active,
            ticksLeft: f.ign.active ? Math.max(0, f.ign.endsAt - this.tick) : 0,
          },
        });
      }
      teams[side] = {
        side: side,
        activeSlot: t.active,
        x: t.x,
        vigor: t.vigor / VIGOR_SCALE,
        vigorShown: Math.floor(t.vigor / VIGOR_SCALE),
        vigorMax: R.vigor.max / VIGOR_SCALE,
        burst: t.burst,
        burstMax: R.burst.max,
        burstUsed: t.burstUsed,
        burstReady: this.triBurstMode(side).ok,
        igniteReady: this.igniteMode(side).ok,
        tagCooldownTicks: Math.max(0, t.tagReadyAt - this.tick),
        tagCooldownMaxTicks: R.tag.cooldownTicks,
        tagReady: this.tagReady(side),
        riposteWindowTicks: t.riposteTicks,
        chain: { cards: t.chain.cards, hits: t.chain.hits },
        fighters: fighters,
      };
    }
    const fr = this.freezes.length > 0 ? this.freezes[0] : null;
    const ticksLeft = Math.max(0, this.timerTicks - this.tick);
    return {
      tick: this.tick,
      phase: this.phase,
      introTicksLeft: this.introLeft,
      paused: this.paused,
      timer: { ticksLeft: ticksLeft, secondsShown: Math.ceil(ticksLeft / R.tickRate) },
      freeze: fr ? { kind: fr.kind, ticksLeft: fr.ticksLeft, side: fr.side } : null,
      distance: this.distance(),
      arenaWidth: R.arena.width,
      triBurstLock: this.triBurstLocked(), // IGNITE and the opponent's TRI-BURST are greyed (GDD §5.0)
      result: this.result ? JSON.parse(JSON.stringify(this.result)) : null,
      teams: teams,
    };
  }
}

/** Create a battle. See the Battle constructor for `config`. `seed` is a 32-bit integer. */
export function createBattle(config, seed) {
  return new Battle(config, seed);
}
