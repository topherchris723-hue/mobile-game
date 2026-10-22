#!/usr/bin/env node
// QA round 2: can the stage_001 tutorial get stuck in 0.3x slow-mo with a prompt the player cannot finish?
// Drives the real logic + the real TutorialController (src/ui/tutorial.js is pure JS) headlessly.
import fs from 'node:fs';
import { createBattle, createContent } from '../../src/logic/index.js';
import { TutorialController } from '../../src/ui/tutorial.js';
const read = (f) => JSON.parse(fs.readFileSync(new URL('../../data/' + f, import.meta.url)));
const D = { battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'), enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json') };
const content = createContent(D);
const stage = D.stages.stages[0];

function setup(seed) {
  const b = createBattle({ content, stageId: stage.id, playerTeam: D.economy.starting.team }, seed);
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
const active = (tut) => (tut.active ? tut.active.step.trigger + '/' + tut.active.step.required_action : null);

// Scenario A: Perfect Slip opens the held Riposte prompt; the player Tags instead of tapping a card.
let A = null;
for (let seed = 1; seed < 60 && !A; seed++) {
  const { b, tut, step, wind } = setup(seed);
  let slipFor = -1;
  for (let i = 0; i < 60 * 60 && !b.getResult(); i++) {
    const st = b.getState();
    const act = tut.active && tut.active.step;
    const inp = [];
    if (act && act.required_action === 'play_card') inp.push({ type: 'card', slot: st.teams.player.fighters[st.teams.player.activeSlot].hand.findIndex((c) => c && c.playable) });
    const w = wind();
    if (w && w.tick !== slipFor && st.tick === w.windupEnd - 4) { slipFor = w.tick; inp.push({ type: 'slip' }); }
    if (act && act.trigger === 'perfect_slip' && st.teams.player.tagReady) {
      inp.push({ type: 'tag', slot: 1 });
      step(inp.filter((x) => x.slot !== -1));
      // now watch 60 s of battle
      let stuckTicks = 0;
      for (let k = 0; k < 60 * 60 && !b.getResult(); k++) { step([]); if (tut.active && tut.active.step.trigger === 'perfect_slip') stuckTicks++; }
      A = { seed, stuckTicks, riposteWindow: b.getState().teams.player.riposteWindowTicks, held: b.teams.player.riposteHeld, active: active(tut), result: b.getResult() && b.getResult().outcome };
      break;
    }
    step(inp.filter((x) => x.slot !== -1));
  }
}
console.log('Scenario A (tag during held Riposte prompt):', JSON.stringify(A));

// Scenario B: at the tag_ready prompt the player tags Tavi out; Tavi's Ignition becomes ready while benched.
{
  const { b, tut, step } = setup(7);
  let res = null;
  let tagged = false;
  for (let i = 0; i < 60 * 200 && !b.getResult(); i++) {
    const st = b.getState();
    const act = tut.active && tut.active.step;
    const inp = [];
    if (act && act.required_action === 'play_card') inp.push({ type: 'card', slot: st.teams.player.fighters[st.teams.player.activeSlot].hand.findIndex((c) => c && c.playable) });
    if (act && act.required_action === 'slip') inp.push({ type: 'slip' });
    if (act && act.required_action === 'riposte') inp.push({ type: 'card', slot: st.teams.player.fighters[st.teams.player.activeSlot].hand.findIndex((c) => c && c.riposte) });
    if (act && act.required_action === 'tag' && !tagged) { inp.push({ type: 'tag', slot: 1 }); tagged = true; }
    step(inp.filter((x) => x.slot !== -1));
    if (tagged && tut.active && tut.active.step.trigger === 'ignition_ready') {
      const s2 = b.getState();
      const t = s2.teams.player;
      let stuck = 0;
      for (let k = 0; k < 60 * 20 && !b.getResult(); k++) { step([]); if (tut.active && tut.active.step.trigger === 'ignition_ready') stuck++; }
      res = { tick: s2.tick, activeSlot: t.activeSlot, activeName: t.fighters[t.activeSlot].name, activeHasIgnition: t.fighters[t.activeSlot].ignition.has, igniteReady: t.igniteReady, readyFighter: t.fighters.filter((f) => f.ignition.available).map((f) => f.name), stuckTicksIn20s: stuck };
      break;
    }
  }
  console.log('Scenario B (Ignition prompt for a benched fighter):', JSON.stringify(res));
}

// Scenario B2: deterministic — tag to Lark (no Ignition) right when Tag is ready, then do nothing; enemy can't
// KO Lark (QA sets Lark's HP high so the bench state is stable). Which prompt fires, and can it be completed?
{
  const { b, tut, step } = setup(3);
  b.teams.player.fighters[1].hp = b.teams.player.fighters[1].def.maxHp = 10 ** 7;
  let tagged = false;
  let out = null;
  for (let i = 0; i < 60 * 120 && !b.getResult(); i++) {
    const st = b.getState();
    const inp = [];
    if (!tagged && st.teams.player.tagReady) { inp.push({ type: 'tag', slot: 1 }); tagged = true; }
    const evs = step(inp);
    if (tut.active && tut.active.step.required_action === 'play_card') tut.complete(); // skip unrelated prompts
    if (tut.active && tut.active.step.required_action === 'none') tut.complete();
    if (tut.active && tut.active.step.required_action === 'slip') tut.complete();
    if (tut.active && tut.active.step.required_action === 'tag') tut.complete();
    const ev = evs.find((e) => e.type === 'ignition_ready' && e.side === 'player');
    if (ev) {
      const s2 = b.getState();
      out = { tick: s2.tick, eventSlot: ev.slot, activeSlot: s2.teams.player.activeSlot, activeName: s2.teams.player.fighters[s2.teams.player.activeSlot].name, activeHasIgnition: s2.teams.player.fighters[s2.teams.player.activeSlot].ignition.has, igniteButtonShown: s2.teams.player.igniteReady, tutorialPrompt: active(tut) };
      let stuck = 0;
      for (let k = 0; k < 60 * 20 && !b.getResult(); k++) { step([]); if (tut.active && tut.active.step.trigger === 'ignition_ready') stuck++; }
      out.promptStillShownTicksOf1200 = stuck;
      out.slowmoSpeed = tut.speed();
      break;
    }
  }
  console.log('Scenario B2 (ignition_ready from a benched fighter):', JSON.stringify(out));
}
