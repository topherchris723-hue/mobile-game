// AI opponent. GDD §5.15. It uses the same permission checks as human input (battle.*Mode),
// so it can never take an action it could not afford or that its state does not allow.
// It reads only public state: positions, HP, gauges, the opponent's visible windup, and its own hand.

const PREF_CLOSE = ['fist', 'signature', 'bolt'];
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
    this.watched = null;       // opponent action being watched for a reactive dodge
    this.reactAt = -1;
    this.plannedSlipAt = -1;
    this.pendingCombo = false;
    this.pendingRiposte = false;
    this.lastEventCount = 0;
    this.slipLog = [];         // [{ slipTick, windupStart }] for AC-5.15.4 checks
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

    const dodge = this.reactiveDodge(tier);
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

  /** Reactive dodge (GDD §5.15): react to the opponent's windup only after reaction_s. */
  reactiveDodge(tier) {
    const b = this.battle;
    const now = b.tick;
    const opp = b.activeFighter(this.side === 'player' ? 'enemy' : 'player');
    const a = opp.action;
    if (a && a.kind === 'card' && a.windupStart >= 0 && a !== this.watched) {
      this.watched = a;
      this.reactAt = a.windupStart + tier.reactionTicks;
      this.plannedSlipAt = -1;
    }
    if (!this.watched) return null;
    const w = this.watched;
    if (opp.action !== w || w.landed !== null) {
      this.watched = null;
      this.plannedSlipAt = -1;
      return null;
    }
    if (this.reactAt >= 0 && now >= this.reactAt) {
      this.reactAt = -1;
      const firstHit = this.predictFirstHit(w);
      const slip = b.slipMode(this.side);
      if (!slip.ok || slip.isBreak) { this.watched = null; return null; }
      if (this.rng.next() >= tier.slipChance) { this.watched = null; return null; }
      const perfect = this.rng.next() < tier.perfectSlipChance;
      const SL = b.rules.slip;
      // GDD: perfect → start 6 ticks before the hit, else 15. Derived from data: 2/3 of the
      // perfect window, and the middle of the normal-dodge band.
      const offset = perfect ? Math.floor((SL.perfectTicks * 2) / 3) : Math.floor((SL.perfectTicks + SL.iframeTicks) / 2);
      const at = firstHit - offset;
      if (!perfect && firstHit - Math.max(at, now) <= SL.perfectTicks) {
        // Too late for a normal dodge; slipping now would be a Perfect Slip this roll did not earn.
        this.watched = null;
        return null;
      }
      this.plannedSlipAt = Math.max(at, now);
    }
    if (this.plannedSlipAt >= 0 && now >= this.plannedSlipAt) {
      this.plannedSlipAt = -1;
      const windupStart = w.windupStart;
      this.watched = null;
      if (b.slipMode(this.side).ok && !b.slipMode(this.side).isBreak) {
        this.slipLog.push({ slipTick: now, windupStart: windupStart, reactionTicks: tier.reactionTicks });
        return { type: 'slip' };
      }
    }
    return null;
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
    // 2. Ignite
    if (b.igniteMode(this.side).ok && now - me.ign.availableAt >= tier.igniteDelayTicks) return [{ type: 'ignite' }];
    if (me.state === 'Hitstun') return [];
    // 3. Tri-Burst
    if (tier.usesBurst && b.triBurstMode(this.side).ok) return [{ type: 'tri_burst' }];
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
