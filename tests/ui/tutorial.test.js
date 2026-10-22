// ui-developer: TutorialController exits (BUG-2-01, BUG-2-02). Real logic + real stage_001 tutorial steps.
import { describe, it, expect } from 'vitest';
import { createBattle, createContent } from '../../src/logic/index.js';
import { TutorialController } from '../../src/ui/tutorial.js';
import { loadBundle, readJson } from '../helpers/load-data.js';

const bundle = loadBundle();
bundle.economy = readJson('data/economy.json');
const content = createContent(bundle);
const stage = bundle.stages.stages.find((s) => s.id === 'stage_001');

function setup(seed) {
  const b = createBattle({ content, stageId: stage.id, playerTeam: bundle.economy.starting.team }, seed);
  const tut = new TutorialController(stage.tutorial_steps, b, 0.3);
  let ms = 0;
  let lastWind = null;
  const step = (inputs) => {
    const evs = b.step(inputs || []);
    for (const e of evs) if (e.type === 'windup_start' && e.side === 'enemy') lastWind = e;
    tut.handleEvents(evs, ms);
    ms += 1000 / 60;
    tut.handleState(b.getState(), ms);
    return evs;
  };
  return { b, tut, step, wind: () => lastWind };
}
const trig = (tut) => (tut.active ? tut.active.step.trigger : null);
const playable = (st) => st.teams.player.fighters[st.teams.player.activeSlot].hand.findIndex((c) => c && c.playable);

/** Play until the perfect_slip (Riposte) prompt is showing. Returns the harness or null. */
function toRipostePrompt(seed, needTagReady) {
  const h = setup(seed);
  let slipFor = -1;
  for (let i = 0; i < 60 * 60 && !h.b.getResult(); i++) {
    const st = h.b.getState();
    const act = h.tut.active && h.tut.active.step;
    if (act && act.trigger === 'perfect_slip' && (!needTagReady || st.teams.player.tagReady)) return h;
    const inp = [];
    if (act && act.required_action === 'play_card' && playable(st) >= 0) inp.push({ type: 'card', slot: playable(st) });
    const w = h.wind();
    if (w && w.tick !== slipFor && st.tick === w.windupEnd - 4) {
      slipFor = w.tick;
      inp.push({ type: 'slip' });
    }
    h.step(inp);
  }
  return null;
}

describe('TutorialController exits (lesson: every held step needs an exit when its action becomes impossible)', () => {
  it('BUG-2-01: Tag during the Riposte prompt ends the prompt, releases the hold and normal speed', () => {
    let h = null;
    for (let seed = 1; seed < 60 && !h; seed++) h = toRipostePrompt(seed, true);
    expect(h, 'a seed reaching the Riposte prompt with Tag ready').not.toBeNull();
    expect(h.b.teams.player.riposteHeld).toBe(true);
    expect(h.tut.speed()).toBeLessThan(1);
    h.step([{ type: 'tag', slot: h.b.getState().teams.player.activeSlot === 0 ? 1 : 0 }]);
    expect(trig(h.tut)).not.toBe('perfect_slip');
    expect(h.b.teams.player.riposteHeld).toBe(false);
    let stuck = 0;
    for (let k = 0; k < 600; k++) {
      h.step([]);
      if (trig(h.tut) === 'perfect_slip') stuck++;
    }
    expect(stuck).toBe(0);
  });

  it('BUG-2-01: KO of the active fighter during the Riposte prompt ends the prompt and the hold', () => {
    let h = null;
    for (let seed = 1; seed < 60 && !h; seed++) h = toRipostePrompt(seed, false);
    expect(h).not.toBeNull();
    const t = h.b.teams.player;
    t.fighters[t.active].hp = 1; // the next enemy hit KOs; the window is cleared by the KO
    let ended = false;
    for (let k = 0; k < 60 * 60 && !h.b.getResult(); k++) {
      h.step([]);
      if (t.fighters.some((f) => f.ko)) {
        h.step([]);
        ended = trig(h.tut) !== 'perfect_slip' && t.riposteHeld === false;
        break;
      }
    }
    expect(ended).toBe(true);
  });

  it('BUG-2-02: ignition_ready of a benched fighter does not prompt; the prompt comes when IGNITE is tappable', () => {
    const h = setup(3);
    h.b.teams.player.fighters[1].hp = h.b.teams.player.fighters[1].def.maxHp = 10 ** 7;
    let tagged = false;
    let benchedEvent = null;
    for (let i = 0; i < 60 * 120 && !h.b.getResult(); i++) {
      const st = h.b.getState();
      const inp = [];
      if (!tagged && st.teams.player.tagReady) {
        inp.push({ type: 'tag', slot: 1 });
        tagged = true;
      }
      const evs = h.step(inp);
      if (h.tut.active && h.tut.active.step.trigger !== 'ignition_ready' && h.tut.active.step.required_action !== 'riposte') h.tut.complete();
      const ev = evs.find((e) => e.type === 'ignition_ready' && e.side === 'player');
      if (ev) {
        benchedEvent = { ev, activeSlot: h.b.getState().teams.player.activeSlot };
        break;
      }
    }
    expect(benchedEvent).not.toBeNull();
    expect(benchedEvent.ev.slot).not.toBe(benchedEvent.activeSlot);
    for (let k = 0; k < 120; k++) h.step([]);
    expect(trig(h.tut)).not.toBe('ignition_ready');
    expect(h.tut.speed()).toBe(1);
  });

  it('an ignite prompt ends if its fighter leaves (tagged out) before igniting', () => {
    const fake = { teams: { player: { active: 0 } }, holdRiposteWindow() {} };
    const steps = [{ trigger: 'ignition_ready', text: 'x', required_action: 'ignite' }];
    const tut = new TutorialController(steps, fake, 0.3);
    const f = (slot, active, ign) => ({ slot, active, ko: false, hand: [], ignition: { has: ign, available: ign, used: false, active: false } });
    const st = (activeSlot, ready) => ({
      phase: 'fight', freeze: null, result: null,
      teams: { player: { activeSlot, igniteReady: ready, burstReady: false, tagReady: false, vigor: 0, vigorMax: 10, riposteWindowTicks: 0, burst: 0, burstMax: 100, burstUsed: false,
        fighters: [f(0, activeSlot === 0, true), f(1, activeSlot === 1, false), f(2, activeSlot === 2, false)] } },
    });
    tut.handleState(st(0, true), 0);
    expect(trig(tut)).toBe('ignition_ready');
    tut.handleState(st(1, false), 16);
    expect(tut.active).toBeNull();
  });

  it('a prompt never holds slow-mo longer than the cap, and time in the pause menu does not count', () => {
    const fake = { teams: { player: { active: 0 } }, holdRiposteWindow() {} };
    const steps = [{ trigger: 'vigor_full', text: 'x', required_action: 'slip' }];
    const tut = new TutorialController(steps, fake, 0.3, 3000, 1000);
    const s = { phase: 'fight', freeze: null, result: null, teams: { player: { vigor: 10, vigorMax: 10, fighters: [] } } };
    tut.handleState(s, 0);
    expect(tut.active).not.toBeNull();
    tut.handleState(s, 60000); // 60 s in the pause menu = one capped frame
    expect(tut.active).not.toBeNull();
    for (let ms = 60016; ms < 61200; ms += 16) tut.handleState(s, ms);
    expect(tut.active).toBeNull();
  });
});
