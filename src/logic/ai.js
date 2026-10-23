// AI opponent. GDD §5.15. It uses the same permission checks as human input (battle.*Mode),
// so it can never take an action it could not afford or that its state does not allow.
// It reads only public state: positions, HP, gauges, the opponent's visible windup, and its own hand.

const PREF_CLOSE = ['fist', 'signature', 'bolt'];

/** Outcomes of one reactive-dodge decision (GDD §5.15 round 3), as logged in AiController.dodgeLog. */
export const DODGE_DECISION_OUTCOMES = ['resolved', 'cannot_slip', 'no_slip', 'too_late', 'planned'];
const PREF_FAR = ['bolt', 'signature', 'fist'];

export class AiController {
  /**
   * battle: the Battle; side: 'player' | 'enemy'; rng: SeededRng for this AI;
   * fixedTier: tier name, or null to use the active enemy fighter's own ai_tier.
   */
  constructor(battle, side, rng, fixedTier) {
    this.battle = battle;
    this.side = side;
    this.rng = rng;
    this.fixedTier = fixedTier;
    this.nextThink = 0;
    this.watched = null;       // opponent card action being watched for a reactive dodge
    this.decisionTick = -1;    // its decision tick D (GDD §5.15 round 3)
    this.decided = false;      // true once the one decision for `watched` has been made
    this.plannedSlipAt = -1;
    this.pendingCombo = false;
    this.pendingRiposte = false;
    this.lastEventCount = 0;
    this.slipLog = [];         // [{ slipTick, windupStart, perfectRoll, firstHit, decisionTick }] for AC-5.15.4/5.15.5
    // One entry per opposing card decision (AC-5.15.7): { actionId, cardId, oppSide, windupStart, decisionTick, tick,
    // outcome: one of DODGE_DECISION_OUTCOMES, slipRoll: number|null, perfectRoll: number|null }.
    this.dodgeLog = [];
    this.plan = null;          // the current planned slip (roll result and predicted hit tick)
  }

  /** The tier parameters in effect right now. */
  tier() {
    const b = this.battle;
    let name = this.fixedTier;
    if (!name) name = b.activeFighter(this.side).def.aiTier || 'rookie';
    return b.rules.aiTiers[name];
  }

  /** Called once per tick at step 2. Returns a list of inputs (at most one). */
  decide() {
    const b = this.battle;
    const now = b.tick;
    const tier = this.tier();
    this.readLastEvents();
    // The reactive-dodge decision runs first on every tick, so it is made exactly on its decision tick D
    // (GDD §5.15 round 3), whatever else the AI does this tick (Riposte, combo, KO'd fighter).
    this.reactiveDodge(tier);
    const me = b.activeFighter(this.side);
    if (me.ko) return [];

    // Riposte after our own Perfect Slip.
    if (this.pendingRiposte) {
      this.pendingRiposte = false;
      if (this.rng.next() < tier.riposteChance) {
        const slot = this.pickCard(true, false, 0);
        if (slot >= 0) return [{ type: 'card', slot: slot }];
      }
    }
    // Combo: our card landed and the link window is open.
    if (this.pendingCombo) {
      this.pendingCombo = false;
      if (me.linkWindow && this.rng.next() < tier.comboContinue) {
        const slot = this.pickCard(false, true, 0);
        if (slot >= 0) return [{ type: 'card', slot: slot }];
      }
    }

    const dodge = this.plannedSlip(tier);
    if (dodge) return [dodge];

    if (now < this.nextThink) return [];
    const st = me.state;
    const canAct = st === 'Idle' || st === 'Dashing' || (st === 'Recovery' && me.linkWindow) || st === 'Hitstun';
    if (!canAct) return [];
    const jitter = 1 + tier.thinkJitter * (2 * this.rng.next() - 1);
    this.nextThink = now + Math.max(1, Math.round(tier.thinkTicks * jitter));
    return this.think(tier);
  }

  /** Watch events from the previous tick (our link window, our perfect slip). */
  readLastEvents() {
    const evs = this.battle.aiFeed;
    for (const e of evs) {
      if (e.side !== this.side) continue;
      if (e.type === 'link_open') this.pendingCombo = true;
      if (e.type === 'perfect_slip') this.pendingRiposte = true;
    }
  }

  /**
   * Reactive dodge decision (GDD §5.15, round 3 "one decision per opposing card"). For each opposing card action
   * the AI decides exactly once, on its decision tick D = windup start + round(reaction_s × 60):
   *   1. first hit already resolved (landed or whiffed) → "no slip", no roll ('resolved');
   *   2. the AI cannot Slip now (state, Vigor < slip.cost) → "no slip", no roll ('cannot_slip');
   *   3. one roll < slip_chance: fail → 'no_slip'; success → one roll < perfect_slip_chance and plan the Slip
   *      ('planned'), or 'too_late' if a normal roll could only produce a Perfect Slip.
   * A decided card is never re-examined. Every decision is appended to `dodgeLog` (AC-5.15.7). A projectile card whose
   * thrower was hit after the windup (detached, still flying) is decided the same way (AC-5.15.8).
   * Uses the AI's seeded rng for the 0, 1 or 2 rolls; returns nothing (the Slip itself comes from plannedSlip()).
   */
  reactiveDodge(tier) {
    const b = this.battle;
    const now = b.tick;
    const oppSide = this.side === 'player' ? 'enemy' : 'player';
    const opp = b.activeFighter(oppSide);
    const a = opp.action;
    // A detached projectile card (thrower hit after its windup, §5.5) keeps its decision until it is decided and
    // any planned Slip is done, even if the thrower already plays a new card (GDD §5.15 round 3).
    const keepDetached = this.watched !== null && this.watchingDetached(this.watched, oppSide) &&
      (!this.decided || this.plannedSlipAt >= 0);
    if (!keepDetached && a && a.kind === 'card' && a.windupStart >= 0 && a !== this.watched) {
      this.watched = a;
      this.decisionTick = a.windupStart + tier.reactionTicks;
      this.decided = false;
      this.plannedSlipAt = -1;
      this.plan = null;
    }
    if (!this.watched) return;
    const w = this.watched;
    if (opp.action !== w && !this.watchingDetached(w, oppSide)) { // the card ended, was interrupted or cancelled
      this.watched = null;
      this.plannedSlipAt = -1;
      return;
    }
    const SL = b.rules.slip;
    if (!this.decided && now >= this.decisionTick) {
      this.decided = true;
      const rec = {
        actionId: w.id, cardId: w.cardId, oppSide: oppSide, windupStart: w.windupStart, decisionTick: this.decisionTick,
        tick: now, outcome: '', slipRoll: null, perfectRoll: null,
      };
      this.dodgeLog.push(rec);
      if (w.landed !== null) { rec.outcome = 'resolved'; return; }
      const slip = b.slipMode(this.side);
      if (!slip.ok || slip.isBreak) { rec.outcome = 'cannot_slip'; return; }
      rec.slipRoll = this.rng.next();
      if (rec.slipRoll >= tier.slipChance) { rec.outcome = 'no_slip'; return; }
      rec.perfectRoll = this.rng.next();
      const perfect = rec.perfectRoll < tier.perfectSlipChance;
      const firstHit = this.predictFirstHit(w);
      // GDD: perfect → start 6 ticks before the hit, else 15. Derived from data: 2/3 of the
      // perfect window, and the middle of the normal-dodge band.
      const offset = perfect ? Math.floor((SL.perfectTicks * 2) / 3) : Math.floor((SL.perfectTicks + SL.iframeTicks) / 2);
      const at = firstHit - offset;
      if (!perfect && firstHit - Math.max(at, now) <= SL.perfectTicks) {
        // Too late for a normal dodge; slipping now would be a Perfect Slip this roll did not earn.
        rec.outcome = 'too_late';
        return;
      }
      rec.outcome = 'planned';
      this.plannedSlipAt = Math.max(at, now);
      this.plan = { perfectRoll: perfect, firstHit: firstHit, decisionTick: now, planTick: now, offset: offset };
      return;
    }
    if (this.plannedSlipAt < 0 || !this.plan) return;
    if (w.landed !== null) { this.plannedSlipAt = -1; return; } // the first hit resolved first: nothing to dodge
    // Re-plan if the predicted hit tick moved (e.g. our own dash changed a projectile's travel time),
    // so the slip still starts `offset` ticks before the hit and a normal roll never becomes Perfect.
    const firstHit = this.predictFirstHit(w);
    if (firstHit !== this.plan.firstHit) {
      const at = firstHit - this.plan.offset;
      this.plan.firstHit = firstHit;
      this.plan.planTick = now;
      if (!this.plan.perfectRoll && firstHit - Math.max(at, now) <= SL.perfectTicks) {
        this.plannedSlipAt = -1;
        return;
      }
      this.plannedSlipAt = Math.max(at, now);
    }
  }

  /** Is `w` a projectile card still flying after its thrower was hit (in the opponent team's inFlight list)? */
  watchingDetached(w, oppSide) {
    return w.detached === true && this.battle.teams[oppSide].inFlight.indexOf(w) >= 0 && w.nextHit < w.hitTicks.length;
  }

  /** The planned Slip input, on its tick, if the AI can still Slip (GDD §5.15). Returns an input or null. */
  plannedSlip(tier) {
    const b = this.battle;
    const now = b.tick;
    if (this.plannedSlipAt < 0 || now < this.plannedSlipAt || !this.watched) return null;
    this.plannedSlipAt = -1;
    const m = b.slipMode(this.side);
    if (!m.ok || m.isBreak) return null;
    const plan = this.plan || {};
    this.slipLog.push({
      slipTick: now, windupStart: this.watched.windupStart, reactionTicks: tier.reactionTicks,
      perfectRoll: plan.perfectRoll, firstHit: plan.firstHit, decisionTick: plan.decisionTick, planTick: plan.planTick, offset: plan.offset,
    });
    return { type: 'slip' };
  }

  /** Predicted tick of the first hit of an opponent action in windup (public info: windup + projectile). */
  predictFirstHit(a) {
    const b = this.battle;
    if (a.hitTicks) return a.hitTicks[0];
    let t = a.windupEnd;
    if (a.card.delivery === 'projectile') t += Math.round((b.distance() / a.card.projectile_speed) * b.rules.tickRate);
    return t;
  }

  /** The decision list, top to bottom; the first rule that applies wins. */
  think(tier) {
    const b = this.battle;
    const me = b.activeFighter(this.side);
    const t = b.teams[this.side];
    const now = b.tick;
    // 1. Break Slip in hitstun
    if (me.state === 'Hitstun') {
      const m = b.slipMode(this.side);
      if (m.ok && m.isBreak && this.rng.next() < tier.breakSlipChance) return [{ type: 'slip' }];
    }
    // Rules 2 and 3 are skipped while a Tri-Burst rush is in progress (GDD §5.0 Tri-Burst lock, §5.15).
    const locked = b.triBurstLocked();
    // 2. Ignite
    if (!locked && b.igniteMode(this.side).ok && now - me.ign.availableAt >= tier.igniteDelayTicks) return [{ type: 'ignite' }];
    if (me.state === 'Hitstun') return [];
    // 3. Tri-Burst
    if (!locked && tier.usesBurst && b.triBurstMode(this.side).ok) return [{ type: 'tri_burst' }];
    // 4. Tag when low
    if (me.hp < tier.tagHpPct * me.def.maxHp) {
      let best = -1;
      for (let i = 0; i < t.fighters.length; i++) {
        const f = t.fighters[i];
        if (i === t.active || f.ko) continue;
        if (best < 0 || f.hp > t.fighters[best].hp) best = i;
      }
      if (best >= 0) {
        const m = b.tagMode(this.side, best);
        if (m.ok && !m.escape) return [{ type: 'tag', slot: best }];
      }
    }
    // 5. Climax
    for (let i = 0; i < me.deck.hand.length; i++) {
      const id = me.deck.hand[i];
      if (id && b.card(id).type === 'climax' && b.cardPlayMode(this.side, i).ok) {
        if (this.rng.next() < tier.climaxChance) return [{ type: 'card', slot: i }];
        break;
      }
    }
    // 6. A normal card, keeping the Vigor reserve
    const slot = this.pickCard(false, false, tier.vigorReserve);
    if (slot >= 0 && this.rng.next() < tier.aggression) return [{ type: 'card', slot: slot }];
    // 7. Move
    const dist = b.distance();
    if (b.dashMode(this.side).ok) {
      if (dist > tier.preferredDistance + 5) return [{ type: 'dash', dir: 'forward' }];
      if (dist < tier.preferredDistance - 15 && this.rng.next() > tier.aggression) return [{ type: 'dash', dir: 'back' }];
    }
    return [];
  }

  /**
   * Pick a hand slot by distance preference. riposteOnly: only Riposte-able types (cost 0 then).
   * Climax is never picked here. Returns -1 if none is playable.
   */
  pickCard(riposteOnly, anyCost, reserve) {
    const b = this.battle;
    const me = b.activeFighter(this.side);
    const t = b.teams[this.side];
    const pref = b.distance() <= 30 ? PREF_CLOSE : PREF_FAR;
    for (const type of pref) {
      for (let i = 0; i < me.deck.hand.length; i++) {
        const id = me.deck.hand[i];
        if (!id) continue;
        const c = b.card(id);
        if (c.type !== type) continue;
        const m = b.cardPlayMode(this.side, i);
        if (!m.ok) continue;
        if (riposteOnly && !m.riposte) continue;
        if (!anyCost && !m.riposte && t.vigor - m.cost < reserve) continue;
        return i;
      }
    }
    return -1;
  }
}
