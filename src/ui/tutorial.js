// Tutorial prompts (GDD §9.4), driven by stage.tutorial_steps. Presentation only: it watches logic
// events/snapshots, slows the tick rate while a prompt shows, and uses battle.holdRiposteWindow().

// Event triggers get ctx = { activeSlot } (the player's active fighter right now). Any event that names a
// fighter slot must be for the active fighter: a prompt has to point at something the player can do.
const mine = (e, ctx) => e.side === 'player' && (e.slot === undefined || e.slot === ctx.activeSlot);
const EVENT_TRIGGERS = {
  battle_start: (e) => e.type === 'fight_start',
  enemy_windup: (e) => e.type === 'windup_start' && e.side === 'enemy',
  perfect_slip: (e, ctx) => e.type === 'perfect_slip' && mine(e, ctx),
  chain_possible: (e, ctx) => e.type === 'link_open' && mine(e, ctx),
  // ignition_ready / burst_ready are state triggers only (below): they fire when the button can really be
  // tapped, not when a benched fighter's Ignition unlocks (BUG-2-02).
};

const STATE_TRIGGERS = {
  card_playable: (s) => {
    const f = s.teams.player.fighters[s.teams.player.activeSlot];
    return !!(f && f.hand.some((c) => c && c.playable));
  },
  vigor_full: (s) => s.teams.player.vigor >= s.teams.player.vigorMax,
  tag_ready: (s) => s.teams.player.tagReady,
  ignition_ready: (s) => s.teams.player.igniteReady,
  burst_ready: (s) => s.teams.player.burstReady,
};

function activeFighter(s) {
  const t = s.teams.player;
  return t.fighters[t.activeSlot];
}

// Can the required action still be done? A step whose action became impossible ends at once, so the
// tutorial never sits in slow-mo (or holds the Riposte window) waiting for something that cannot happen
// (BUG-2-01: Tag/KO during the Riposte prompt; BUG-2-02: Ignition owner benched).
const STILL_POSSIBLE = {
  riposte: (s) => {
    const f = activeFighter(s);
    return s.teams.player.riposteWindowTicks > 0 && !!f && !f.ko;
  },
  ignite: (s) => {
    const f = activeFighter(s);
    return !!(f && !f.ko && f.ignition && f.ignition.has && f.ignition.available && !f.ignition.used && !f.ignition.active);
  },
  tri_burst: (s) => !s.teams.player.burstUsed && s.teams.player.burst >= s.teams.player.burstMax,
  tag: (s) => s.teams.player.fighters.some((f) => !f.active && !f.ko),
};

// Timings come from data via buildRules (GDD §9.4 round 3): rules.tutorialPromptMaxS = the cap (exit 4, a
// last-resort exit; battle.json tutorial_prompt_max_s, default 20 in src/logic/rules.js), rules.tutorialNoneS =
// how long a `none` step shows (exit 2; tutorial_none_s, default 3), rules.tutorialSlowmo = the slow-mo factor.
// Both are measured in shown time: wall-clock time while the prompt is on screen and the battle is not paused,
// at most 100 ms per rendered frame.
const MAX_FRAME_MS = 100;

const ACTION_DONE = {
  play_card: (e) => e.type === 'card_played' && e.side === 'player',
  slip: (e) => e.type === 'slip' && e.side === 'player',
  riposte: (e) => (e.type === 'riposte' && e.side === 'player') || (e.type === 'card_played' && e.side === 'player' && e.riposte),
  dash_forward: (e) => e.type === 'dash' && e.side === 'player' && e.dir === 'forward',
  dash_back: (e) => e.type === 'dash' && e.side === 'player' && e.dir === 'back',
  tag: (e) => e.type === 'tag' && e.side === 'player',
  ignite: (e) => e.type === 'ignition' && e.side === 'player',
  tri_burst: (e) => e.type === 'tri_burst_start' && e.side === 'player',
};

export class TutorialController {
  /** steps = stage.tutorial_steps; rules = content.rules (buildRules: tutorialSlowmo, tutorialNoneS, tutorialPromptMaxS). */
  constructor(steps, battle, rules) {
    if (!rules || typeof rules.tutorialPromptMaxS !== 'number' || typeof rules.tutorialNoneS !== 'number' || typeof rules.tutorialSlowmo !== 'number') {
      throw new Error('TutorialController needs rules from buildRules (tutorialSlowmo, tutorialNoneS, tutorialPromptMaxS)');
    }
    this.steps = steps || [];
    this.battle = battle;
    this.slowmo = rules.tutorialSlowmo;
    this.noneMs = rules.tutorialNoneS * 1000;
    this.maxPromptMs = rules.tutorialPromptMaxS * 1000;
    this.fired = new Set();
    this.active = null; // { index, step, startMs }
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this.active));
  }

  speed() {
    return this.active ? this.slowmo : 1;
  }

  start(index, nowMs) {
    this.fired.add(index);
    const step = this.steps[index];
    this.active = { index, step, startMs: nowMs, shownMs: 0 };
    if (step.trigger === 'perfect_slip') this.battle.holdRiposteWindow('player', true);
    this.emit();
  }

  /** End the active step (done, or its action became impossible). Always releases the Riposte hold. */
  complete() {
    if (!this.active) return;
    if (this.active.step.trigger === 'perfect_slip') this.battle.holdRiposteWindow('player', false);
    this.active = null;
    this.emit();
  }

  playerActiveSlot() {
    const t = this.battle && this.battle.teams && this.battle.teams.player;
    if (t && typeof t.active === 'number') return t.active;
    const st = this.battle.getState();
    return st.teams.player.activeSlot;
  }

  /** Feed the events of one logic tick. */
  handleEvents(events, nowMs) {
    for (const e of events) {
      if (e.type === 'battle_end') {
        this.complete();
        return;
      }
      if (this.active) {
        const done = ACTION_DONE[this.active.step.required_action];
        if (done && done(e)) this.complete();
        else if (this.active.step.required_action === 'riposte' && e.side === 'player' && (e.type === 'tag' || e.type === 'riposte_window_end')) this.complete();
        else if (this.active.step.required_action === 'riposte' && e.side === 'player' && e.type === 'ko') this.complete();
        continue;
      }
      const ctx = { activeSlot: this.playerActiveSlot() };
      for (let i = 0; i < this.steps.length; i++) {
        if (this.fired.has(i)) continue;
        const trig = EVENT_TRIGGERS[this.steps[i].trigger];
        if (trig && trig(e, ctx)) {
          this.start(i, nowMs);
          break;
        }
      }
    }
  }

  /** Call when the battle resumes from pause / background (nowMs = resume time): the paused time is not shown time (GDD §9.4). */
  resetClock(nowMs) {
    this.lastStateMs = typeof nowMs === 'number' ? nowMs : undefined;
  }

  /** Check state-based triggers and the timed 'none' steps. Call once per rendered frame (not while paused). */
  handleState(state, nowMs) {
    // Shown time counts only frames that reach here (not while the pause menu is open); one long frame
    // or a backgrounded tab adds at most 100 ms.
    const dt = this.lastStateMs === undefined ? 0 : Math.max(0, Math.min(MAX_FRAME_MS, nowMs - this.lastStateMs));
    this.lastStateMs = nowMs;
    if (state.result) return;
    if (this.active) {
      const action = this.active.step.required_action;
      this.active.shownMs += dt;
      const age = this.active.shownMs;
      if (action === 'none' && age >= this.noneMs) this.complete();
      else if (STILL_POSSIBLE[action] && !STILL_POSSIBLE[action](state)) this.complete();
      else if (age >= this.maxPromptMs) this.complete();
      return;
    }
    if (state.phase !== 'fight' || state.freeze) return;
    for (let i = 0; i < this.steps.length; i++) {
      if (this.fired.has(i)) continue;
      const trig = STATE_TRIGGERS[this.steps[i].trigger];
      if (trig && trig(state)) {
        this.start(i, nowMs);
        return;
      }
    }
  }
}
