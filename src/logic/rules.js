// Converts data/battle.json into the rule constants the engine uses, with every duration in ticks.
// GDD §5.0: ticks = round(seconds × 60). Nothing in here is a game number; all come from data.

/** Seconds → ticks at the given tick rate. */
export function toTicks(seconds, tickRate) {
  return Math.round(seconds * tickRate);
}

// Vigor is stored as an integer in units of 1/VIGOR_SCALE so regen sums are exact (5 → 10 in exactly 300 ticks).
export const VIGOR_SCALE = 6000;

/** Vigor value → integer units. */
export function vigorUnits(v) {
  return Math.round(v * VIGOR_SCALE);
}

/** Build the rules object from the parsed battle.json. */
export function buildRules(b) {
  const hz = b.tick_rate;
  const t = (s) => toTicks(s, hz);
  const tag = b.tag;
  const initialCd = typeof tag.initial_cooldown_s === 'number' ? tag.initial_cooldown_s : 5; // GDD §5.8 default
  const aiTiers = {};
  for (const name of Object.keys(b.ai_tiers)) {
    const a = b.ai_tiers[name];
    aiTiers[name] = {
      name: name,
      thinkTicks: t(a.think_interval_s),
      thinkJitter: typeof a.think_jitter === 'number' ? a.think_jitter : 0.2,
      reactionTicks: t(a.reaction_s),
      slipChance: a.slip_chance,
      perfectSlipChance: a.perfect_slip_chance,
      riposteChance: a.riposte_chance,
      comboContinue: a.combo_continue,
      breakSlipChance: a.break_slip_chance,
      tagHpPct: a.tag_hp_pct,
      climaxChance: a.climax_chance,
      igniteDelayTicks: t(a.ignite_delay_s),
      usesBurst: a.uses_burst,
      vigorReserve: vigorUnits(a.vigor_reserve),
      aggression: a.aggression,
      preferredDistance: a.preferred_distance,
    };
  }
  return {
    tickRate: hz,
    arena: {
      width: b.arena.width,
      startXPlayer: b.arena.start_x_player,
      startXEnemy: b.arena.start_x_enemy,
      meleeRange: b.arena.melee_range,
      minDistance: b.arena.min_distance,
      dashDistance: b.arena.dash_distance,
      dashTicks: t(b.arena.dash_time_s),
      approachPerTick: b.arena.approach_speed / hz,
      approachTimeoutTicks: t(b.arena.approach_timeout_s),
    },
    vigor: {
      max: vigorUnits(b.vigor.max),
      start: vigorUnits(b.vigor.start),
      regenPerTick: Math.round(vigorUnits(b.vigor.regen_per_s) / hz),
    },
    hand: {
      size: b.hand.size,
      refillTicks: t(b.hand.refill_delay_s),
    },
    slip: {
      cost: vigorUnits(b.slip.cost),
      breakCost: vigorUnits(b.slip.break_cost),
      iframeTicks: t(b.slip.iframes_s),
      perfectTicks: t(b.slip.perfect_window_s),
      recoveryTicks: t(b.slip.recovery_s),
      perfectRefund: vigorUnits(b.slip.perfect_refund),
      perfectBurstGain: b.slip.perfect_burst_gain,
    },
    riposte: {
      windowTicks: t(b.riposte.window_s),
      damageMult: b.riposte.damage_mult,
      firstHitTicks: t(b.riposte.first_hit_delay_s),
      allowedTypes: b.riposte.allowed_types.slice(),
    },
    combo: {
      bonusPerCard: b.combo.bonus_per_card,
      bonusMaxSteps: b.combo.bonus_max_steps,
      maxCards: b.combo.max_cards,
      bufferTicks: t(b.combo.buffer_s),
      knockdownDistance: b.combo.knockdown_distance,
      getupTicks: t(b.combo.getup_s),
      chainBurstMinCards: b.combo.chain_burst_min_cards,
      chainBurstGain: b.combo.chain_burst_gain,
    },
    tag: {
      cooldownTicks: t(tag.cooldown_s),
      initialCooldownTicks: t(initialCd),
      escapeCost: vigorUnits(tag.escape_cost),
      invulnTicks: t(tag.invuln_s),
      strikePower: tag.strike_power,
      strikeHitstunTicks: t(tag.strike_hitstun_s),
      strikeKnockback: tag.strike_knockback,
      strikeFirstHitTicks: t(tag.strike_first_hit_delay_s),
    },
    ko: {
      animTicks: t(b.ko.anim_s),
      incomingInvulnTicks: t(b.ko.incoming_invuln_s),
      allyKoBurstGain: b.ko.ally_ko_burst_gain,
    },
    hitstopTicks: {
      fist: t(b.hitstop_s.fist),
      bolt: t(b.hitstop_s.bolt),
      signature: t(b.hitstop_s.signature),
      climax: t(b.hitstop_s.climax),
    },
    ignition: {
      cinematicTicks: t(b.ignition.cinematic_s),
      vigorGain: vigorUnits(b.ignition.vigor_gain),
      enemyPush: b.ignition.enemy_push,
    },
    burst: {
      max: b.burst.max,
      gainDealtFactor: b.burst.gain_dealt_factor,
      gainTakenFactor: b.burst.gain_taken_factor,
      powerPerMember: b.burst.power_per_member,
      rushTicks: t(b.burst.rush_time_s),
      whiffRefundPct: b.burst.whiff_refund_pct,
      cinematicTicks: t(b.burst.cinematic_s),
      usesPerBattle: b.burst.uses_per_battle,
    },
    damage: {
      defConstant: b.damage.def_constant,
      critMult: b.damage.crit_mult,
      critCap: b.damage.crit_cap,
      minHit: b.damage.min_hit,
      maxHit: b.damage.max_hit,
      buffMin: b.damage.buff_factor_min,
      buffMax: b.damage.buff_factor_max,
    },
    timer: { defaultS: b.timer.default_s },
    introTicks: t(b.intro_s),
    tutorialSlowmo: b.tutorial_slowmo,
    // GDD §9.4 round 3: prompt cap and 'none' step length in seconds of shown time (optional in data)
    tutorialPromptMaxS: typeof b.tutorial_prompt_max_s === 'number' ? b.tutorial_prompt_max_s : 20,
    tutorialNoneS: typeof b.tutorial_none_s === 'number' ? b.tutorial_none_s : 3,
    typeChart: b.type_chart,
    aiTiers: aiTiers,
  };
}
