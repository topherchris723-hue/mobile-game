// Tutorial prompts (GDD §9.4), driven by stage.tutorial_steps. Presentation only: it watches logic
// events/snapshots, slows the tick rate while a prompt shows, and uses battle.holdRiposteWindow().

const EVENT_TRIGGERS = {
  battle_start: (e) => e.type === 'fight_start',
  enemy_windup: (e) => e.type === 'windup_start' && e.side === 'enemy',
  perfect_slip: (e) => e.type === 'perfect_slip' && e.side === 'player',
  chain_possible: (e) => e.type === 'link_open' && e.side === 'player',
  ignition_ready: (e) => e.type === 'ignition_ready' && e.side === 'player',
  burst_ready: (e) => e.type === 'burst_ready' && e.side === 'player',
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
  /** steps = stage.tutorial_steps; slowmo = battle.json tutorial_slowmo (0.3). */
  constructor(steps, battle, slowmo, noneMs) {
    this.steps = steps || [];
    this.battle = battle;
    this.slowmo = slowmo || 0.3;
    this.noneMs = noneMs || 3000;
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
    this.active = { index, step, startMs: nowMs };
    if (step.trigger === 'perfect_slip') this.battle.holdRiposteWindow('player', true);
    this.emit();
  }

  complete() {
    if (!this.active) return;
    if (this.active.step.trigger === 'perfect_slip') this.battle.holdRiposteWindow('player', false);
    this.active = null;
    this.emit();
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
        continue;
      }
      for (let i = 0; i < this.steps.length; i++) {
        if (this.fired.has(i)) continue;
        const trig = EVENT_TRIGGERS[this.steps[i].trigger];
        if (trig && trig(e)) {
          this.start(i, nowMs);
          break;
        }
      }
    }
  }

  /** Check state-based triggers and the timed 'none' steps. Call once per frame. */
  handleState(state, nowMs) {
    if (state.result) return;
    if (this.active) {
      if (this.active.step.required_action === 'none' && nowMs - this.active.startMs >= this.noneMs) this.complete();
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
