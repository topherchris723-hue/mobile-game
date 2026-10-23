// ui-developer round 3: GDD §9.4 round-3 ruling, AC-9.4.3 … AC-9.4.7, on the real TutorialController.
// Timings are read from content.rules (data), never hardcoded here: the balance-analyst may change battle.json.
import { describe, it, expect } from 'vitest';
import { createBattle, createContent, buildRules } from '../../src/logic/index.js';
import { TutorialController } from '../../src/ui/tutorial.js';
import { loadBundle, readJson } from '../helpers/load-data.js';

const bundle = loadBundle();
bundle.economy = readJson('data/economy.json');
const content = createContent(bundle);
const stage = bundle.stages.stages.find((s) => s.id === 'stage_001');
const FRAME = 1000 / 60;
const TICK = 1000 / 60;

/**
 * Real battle + controller driven like BattleScene: one rendered frame = FRAME ms of wall clock; logic ticks
 * accumulate at tut.speed(). `keep` = triggers the harness lets run; any other step is completed at once
 * (as if the player did it), so the step under test can fire.
 */
function harness(c, keep, seed, opts) {
  const o = opts || {};
  const b = createBattle({ content: c, stageId: stage.id, playerTeam: bundle.economy.starting.team }, seed || 1);
  for (const f of b.teams.player.fighters) f.hp = f.def.maxHp = 10 ** 7; // nobody gets KO'd: only the tutorial is tested
  for (const f of b.teams.enemy.fighters) f.hp = f.def.maxHp = 10 ** 7;
  const tut = new TutorialController(stage.tutorial_steps, b, o.rules || c.rules);
  let ms = 0;
  let acc = 0;
  const frame = (inputs) => {
    ms += FRAME;
    acc += FRAME * tut.speed();
    let evs = [];
    let first = true;
    while (acc >= TICK) {
      acc -= TICK;
      const e = b.step(first ? inputs || [] : []);
      first = false;
      tut.handleEvents(e, ms);
      evs = evs.concat(e);
    }
    tut.handleState(b.getState(), ms);
    if (tut.active && keep.indexOf(tut.active.step.trigger) < 0) tut.complete();
    return evs;
  };
  return { b, tut, frame, now: () => ms, advanceClock: (d) => (ms += d) };
}
const trig = (tut) => (tut.active ? tut.active.step.trigger : null);

/** Run until the `tag_ready` step fires, then never tag. Returns timings of its close. pauseAtMs: a pause of pauseMs. */
function capRun(c, opts) {
  const o = opts || {};
  const h = harness(c, ['tag_ready'], 1, o);
  let firedAt = null;
  for (let i = 0; i < 60 * 120 && firedAt === null; i++) {
    h.frame([]);
    if (trig(h.tut) === 'tag_ready') firedAt = h.now();
  }
  if (firedAt === null) return null;
  const firedTick = h.b.getState().tick;
  let closedAt = null;
  let shownAtClose = null;
  let paused = false;
  let maxShown = 0;
  for (let i = 0; i < 60 * 60 && closedAt === null; i++) {
    if (o.pauseMs && !paused && h.now() - firedAt >= 5000) {
      // pause menu: no frames reach the controller, logic paused; resume resets the clock (BattleScene.closePause)
      paused = true;
      h.b.setPaused(true);
      h.advanceClock(o.pauseMs);
      h.b.setPaused(false);
      if (!o.noReset) h.tut.resetClock(h.now());
    }
    const shownBefore = h.tut.active ? h.tut.active.shownMs : null;
    h.frame([]);
    if (h.tut.active) maxShown = Math.max(maxShown, h.tut.active.shownMs);
    if (trig(h.tut) !== 'tag_ready') {
      closedAt = h.now();
      shownAtClose = shownBefore;
    }
    if (o.maxFrames && i > o.maxFrames) break;
  }
  const speedAfter = h.tut.speed();
  let again = 0;
  for (let i = 0; i < 600; i++) {
    h.frame([]);
    if (trig(h.tut) === 'tag_ready') again++;
  }
  return { firedAt, firedTick, closedAt, wall: closedAt === null ? null : closedAt - firedAt, shownAtClose, speedAfter, again, maxShown };
}

describe('AC-9.4.3: the prompt cap (rules.tutorialPromptMaxS of shown time)', () => {
  const capMs = content.rules.tutorialPromptMaxS * 1000;

  it('tag_ready never tagged: closes after the cap (± one frame), speed 1.0, never fires again', () => {
    const r = capRun(content);
    expect(r, 'tag_ready fired').not.toBeNull();
    expect(Math.abs(r.wall - capMs)).toBeLessThanOrEqual(FRAME + 0.5);
    expect(r.speedAfter).toBe(1);
    expect(r.again).toBe(0);
  });

  it('a 10 s pause in the middle does not count: wall clock = cap + 10 s, shown = cap', () => {
    const r = capRun(content, { pauseMs: 10000 });
    expect(Math.abs(r.wall - (capMs + 10000))).toBeLessThanOrEqual(FRAME + 0.5);
    expect(r.speedAfter).toBe(1);
  });

  it('without resetClock the paused time still adds at most one 100 ms frame', () => {
    const r = capRun(content, { pauseMs: 10000, noReset: true });
    const w = r.wall - 10000;
    expect(w).toBeLessThanOrEqual(capMs + FRAME + 0.5);
    expect(w).toBeGreaterThanOrEqual(capMs - 100 - FRAME);
  });

  it('with tutorial_prompt_max_s removed from battle.json the default from buildRules gives the same result', () => {
    const battle = JSON.parse(JSON.stringify(bundle.battle));
    delete battle.tutorial_prompt_max_s;
    const c2 = createContent(Object.assign({}, bundle, { battle }));
    expect(c2.rules.tutorialPromptMaxS).toBe(buildRules(battle).tutorialPromptMaxS);
    const r = capRun(c2);
    expect(Math.abs(r.wall - c2.rules.tutorialPromptMaxS * 1000)).toBeLessThanOrEqual(FRAME + 0.5);
  });

  it('must-FAIL input: with no cap (Infinity) the prompt is still shown past cap + 1 s', () => {
    const rules = Object.assign({}, content.rules, { tutorialPromptMaxS: Infinity });
    const r = capRun(content, { rules, maxFrames: Math.ceil(((capMs + 1500) / FRAME)) });
    expect(r.closedAt).toBeNull();
    expect(r.maxShown).toBeGreaterThan(capMs + 1000);
  });
});

describe('AC-9.4.5: ignition_ready only for the active fighter', () => {
  it('Tavi benched when its Ignition unlocks: no prompt while benched; prompt on the first active, unfrozen frame', () => {
    const h = harness(content, ['ignition_ready'], 3);
    const tavi = h.b.getState().teams.player.fighters.findIndex((f) => f.characterId === 'char_tavi_001');
    expect(tavi).toBe(h.b.getState().teams.player.activeSlot);
    let taggedOut = false;
    let promptWhileBenched = 0;
    let unlockedWhileBenched = false;
    let taggedBack = false;
    let firstActiveFrame = null;
    let promptFrame = null;
    for (let i = 0; i < 60 * 150 && promptFrame === null && !h.b.getResult(); i++) {
      const st = h.b.getState();
      const inp = [];
      const benched = st.teams.player.activeSlot !== tavi;
      if (!taggedOut && st.phase === 'fight' && st.teams.player.tagReady) {
        inp.push({ type: 'tag', slot: (tavi + 1) % 3 });
        taggedOut = true;
      } else if (taggedOut && benched && st.teams.player.fighters[tavi].ignition.available && st.teams.player.tagReady) {
        unlockedWhileBenched = true;
        inp.push({ type: 'tag', slot: tavi });
        taggedBack = true;
      }
      h.frame(inp);
      const s2 = h.b.getState();
      const active = s2.teams.player.activeSlot === tavi;
      if (!active && trig(h.tut) === 'ignition_ready') promptWhileBenched++;
      if (taggedBack && active && !s2.freeze && s2.teams.player.igniteReady && firstActiveFrame === null) firstActiveFrame = i;
      if (trig(h.tut) === 'ignition_ready' && promptFrame === null) promptFrame = i;
    }
    expect(taggedOut).toBe(true);
    expect(unlockedWhileBenched, 'Ignition unlocked while Tavi was benched').toBe(true);
    expect(promptWhileBenched).toBe(0);
    expect(promptFrame).not.toBeNull();
    expect(promptFrame).toBe(firstActiveFrame);
  });
});

/** Fake battle/state helpers for controller-only checks. */
function fakeBattle(activeSlot) {
  return { teams: { player: { active: activeSlot } }, held: [], holdRiposteWindow(side, on) { this.held.push(on); }, getState() { return { teams: { player: { activeSlot } } }; } };
}
function fakeState(over) {
  const f = (slot, active) => ({ slot, active, ko: false, hand: [], ignition: { has: false, available: false, used: false, active: false } });
  const team = Object.assign({ activeSlot: 0, igniteReady: false, burstReady: false, tagReady: false, vigor: 0, vigorMax: 10, riposteWindowTicks: 0, burst: 0, burstMax: 100, burstUsed: false, fighters: [f(0, true), f(1, false), f(2, false)] }, over || {});
  return { phase: 'fight', freeze: null, result: null, teams: { player: team } };
}

describe('AC-9.4.6: event triggers fire only for the player active fighter', () => {
  const steps = stage.tutorial_steps.filter((s) => s.trigger === 'chain_possible' || s.trigger === 'perfect_slip');
  it('stage_001 has both steps (the test is not blind)', () => {
    expect(steps.map((s) => s.trigger).sort()).toEqual(['chain_possible', 'perfect_slip']);
  });
  const run = (ev) => {
    const tut = new TutorialController(steps, fakeBattle(0), content.rules);
    tut.handleEvents([ev], 0);
    return trig(tut);
  };
  it('must-FAIL inputs: enemy link_open and enemy perfect_slip fire nothing', () => {
    expect(run({ type: 'link_open', side: 'enemy' })).toBeNull();
    expect(run({ type: 'perfect_slip', side: 'enemy', slot: 0 })).toBeNull();
  });
  it('player link_open on the active slot fires chain_possible; on a benched slot nothing', () => {
    expect(run({ type: 'link_open', side: 'player', slot: 0 })).toBe('chain_possible');
    expect(run({ type: 'link_open', side: 'player', slot: 2 })).toBeNull();
    expect(run({ type: 'perfect_slip', side: 'player', slot: 0 })).toBe('perfect_slip');
    expect(run({ type: 'perfect_slip', side: 'player', slot: 1 })).toBeNull();
  });
});

describe('AC-9.4.7: the `none` step closes after rules.tutorialNoneS of shown time', () => {
  it('vigor_full ("Cards cost Vigor…", none) closes at tutorialNoneS ± one frame', () => {
    const step = stage.tutorial_steps.find((s) => s.trigger === 'vigor_full');
    expect(step.required_action).toBe('none');
    const tut = new TutorialController([step], fakeBattle(0), content.rules);
    const st = fakeState({ vigor: 10, vigorMax: 10 });
    tut.handleState(st, 0);
    expect(trig(tut)).toBe('vigor_full');
    let closed = null;
    for (let ms = FRAME; ms < 10000 && closed === null; ms += FRAME) {
      tut.handleState(st, ms);
      if (!tut.active) closed = ms;
    }
    expect(Math.abs(closed - content.rules.tutorialNoneS * 1000)).toBeLessThanOrEqual(FRAME + 0.5);
    expect(tut.speed()).toBe(1);
  });
});

describe('L-ui-001: every stage_001 step ends within one frame when its action becomes impossible', () => {
  // [trigger, state while possible, state when impossible]
  const IMPOSSIBLE = {
    riposte: [{ riposteWindowTicks: 30 }, { riposteWindowTicks: 0 }],
    ignite: [
      { fighters: [{ slot: 0, active: true, ko: false, hand: [], ignition: { has: true, available: true, used: false, active: false } }, { slot: 1, active: false, ko: false, hand: [] }, { slot: 2, active: false, ko: false, hand: [] }], igniteReady: true },
      { activeSlot: 1, fighters: [{ slot: 0, active: false, ko: false, hand: [], ignition: { has: true, available: true, used: false, active: false } }, { slot: 1, active: true, ko: false, hand: [], ignition: { has: false } }, { slot: 2, active: false, ko: false, hand: [] }] },
    ],
    tri_burst: [{ burst: 100, burstReady: true }, { burst: 100, burstUsed: true }],
    tag: [{ tagReady: true }, { fighters: [{ slot: 0, active: true, ko: false, hand: [] }, { slot: 1, active: false, ko: true, hand: [] }, { slot: 2, active: false, ko: true, hand: [] }] }],
  };
  for (const step of stage.tutorial_steps) {
    const a = step.required_action;
    if (IMPOSSIBLE[a]) {
      it(`${step.trigger} (${a}): gone one frame after the action is impossible, hold released`, () => {
        const fb = fakeBattle(0);
        const tut = new TutorialController([step], fb, content.rules);
        tut.start(0, 0);
        tut.handleState(fakeState(IMPOSSIBLE[a][0]), 0);
        tut.handleState(fakeState(IMPOSSIBLE[a][0]), FRAME);
        expect(trig(tut), 'still shown while possible').toBe(step.trigger);
        tut.handleState(fakeState(IMPOSSIBLE[a][1]), 2 * FRAME);
        expect(tut.active).toBeNull();
        expect(tut.speed()).toBe(1);
        if (step.trigger === 'perfect_slip') expect(fb.held).toEqual([true, false]);
      });
    } else {
      it(`${step.trigger} (${a}): never impossible — ends by the cap or its own exit, never stuck`, () => {
        const tut = new TutorialController([step], fakeBattle(0), content.rules);
        tut.start(0, 0);
        const st = fakeState({});
        let ms = 0;
        while (tut.active && ms < content.rules.tutorialPromptMaxS * 1000 + 1000) tut.handleState(st, (ms += FRAME));
        expect(tut.active).toBeNull();
        expect(ms).toBeLessThanOrEqual(content.rules.tutorialPromptMaxS * 1000 + FRAME + 0.5);
      });
    }
  }
});

describe('TutorialController reads its timings from data only', () => {
  it('throws without rules (no hidden 20 s / 3 s fallback)', () => {
    expect(() => new TutorialController([], fakeBattle(0), undefined)).toThrow(/buildRules/);
    expect(() => new TutorialController([], fakeBattle(0), 0.3)).toThrow(/buildRules/);
  });
  it('a changed tutorial_none_s in data changes the none-step time', () => {
    const rules = Object.assign({}, content.rules, { tutorialNoneS: content.rules.tutorialNoneS + 2 });
    const step = { trigger: 'vigor_full', text: 'x', required_action: 'none' };
    const tut = new TutorialController([step], fakeBattle(0), rules);
    const st = fakeState({ vigor: 10 });
    tut.handleState(st, 0);
    let ms = 0;
    while (tut.active && ms < 20000) tut.handleState(st, (ms += FRAME));
    expect(Math.abs(ms - rules.tutorialNoneS * 1000)).toBeLessThanOrEqual(FRAME + 0.5);
  });
});
