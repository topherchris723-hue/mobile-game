// Release reviewer's independent bot. Usage: node reviewer-bot.mjs <count> <seedBase>
import fs from 'node:fs';
import { createBattle, createContent } from './src/logic/index.js';

const read = (f) => JSON.parse(fs.readFileSync('data/' + f, 'utf8'));
const data = {
  battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'),
  enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json'),
};
const content = createContent(data);
const stages = data.stages.stages.map((s) => s.id);
const chars = data.characters.characters.filter((c) => c.playable);
const tiers = Object.keys(data.battle.ai_tiers);

let s0 = 0;
function rnd() { s0 = (s0 + 0x6D2B79F5) | 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = (a) => a[Math.floor(rnd() * a.length)];

const count = Number(process.argv[2] || 600);
const seedBase = Number(process.argv[3] || 9000);
const MAX_TICKS = 60 * 60 * 10;
const problems = [];
const tally = {};
const modes = ['fuzz', 'greedy', 'ai', 'idle'];

function checkNum(v, label, issues) {
  if (typeof v !== 'number' || !Number.isFinite(v)) issues.push(label + ' not finite: ' + v);
  else if (v < 0) issues.push(label + ' negative: ' + v);
}

for (let i = 0; i < count; i++) {
  const seed = seedBase + i;
  s0 = seed * 7919;
  const stageId = stages[i % stages.length];
  const mode = modes[Math.floor(i / stages.length) % modes.length];
  const pool = chars.slice();
  const team = [];
  while (team.length < 3) {
    const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    team.push({ characterId: c.id, resonance: Math.floor(rnd() * 5) });
  }
  const opts = { content, stageId, playerTeam: team, skipIntro: rnd() < 0.5 };
  if (mode === 'ai') opts.playerController = { aiTier: pick(tiers) };
  let b;
  const issues = [];
  try {
    b = createBattle(opts, seed);
    let ticks = 0;
    let lastTimer = null; let timerStuck = 0;
    while (!b.getResult() && ticks < MAX_TICKS) {
      let inputs = [];
      const st = b.getState();
      const me = st.teams.player;
      if (mode === 'fuzz') {
        const r = rnd();
        if (r < 0.08) inputs.push({ type: 'card', slot: Math.floor(rnd() * 5) - (rnd() < 0.05 ? 1 : 0) });
        else if (r < 0.11) inputs.push({ type: 'dash', dir: rnd() < 0.5 ? 'forward' : 'back' });
        else if (r < 0.13) inputs.push({ type: 'slip' });
        else if (r < 0.14) inputs.push({ type: 'tag', slot: Math.floor(rnd() * 3) });
        else if (r < 0.145) inputs.push({ type: 'ignite' });
        else if (r < 0.15) inputs.push({ type: 'tri_burst' });
        if (rnd() < 0.002) { b.setPaused(true); b.step([]); b.setPaused(false); }
        if (rnd() < 0.00005) b.retreat();
      } else if (mode === 'greedy') {
        const f = me.fighters[me.activeSlot];
        if (me.burstReady) inputs.push({ type: 'tri_burst' });
        else if (me.igniteReady) inputs.push({ type: 'ignite' });
        else {
          const en = st.teams.enemy.fighters[st.teams.enemy.activeSlot];
          if (en && en.action && en.action.phase === 'windup' && rnd() < 0.3) inputs.push({ type: 'slip' });
          else {
            const k = f.hand.findIndex((h) => h && h.playable);
            if (k >= 0 && rnd() < 0.5) inputs.push({ type: 'card', slot: k });
            else if (me.tagReady && f.hp < f.maxHp * 0.3) {
              const t = me.fighters.find((x) => !x.ko && !x.active);
              if (t) inputs.push({ type: 'tag', slot: t.slot });
            }
          }
        }
      }
      b.step(inputs);
      ticks++;
      const s = b.getState();
      for (const side of ['player', 'enemy']) {
        const t = s.teams[side];
        checkNum(t.vigor, side + '.vigor', issues); checkNum(t.burst, side + '.burst', issues); checkNum(t.x, side + '.x', issues);
        if (t.vigor > t.vigorMax + 1e-9) issues.push(side + ' vigor>max ' + t.vigor);
        if (t.burst > t.burstMax + 1e-9) issues.push(side + ' burst>max ' + t.burst);
        for (const f of t.fighters) {
          checkNum(f.hp, side + '.hp', issues); checkNum(f.maxHp, side + '.maxHp', issues);
          if (f.hp > f.maxHp) issues.push(side + ' hp>max');
        }
      }
      checkNum(s.distance, 'distance', issues);
      checkNum(s.timer.ticksLeft, 'timer', issues);
      if (s.phase === 'fight' && !s.freeze && !s.paused) {
        if (lastTimer === s.timer.ticksLeft) timerStuck++; else timerStuck = 0;
        if (timerStuck > 600) { issues.push('timer stuck 10s at ' + s.timer.ticksLeft); break; }
      }
      lastTimer = s.timer.ticksLeft;
      if (issues.length) break;
    }
    const res = b.getResult();
    if (!res && !issues.length) issues.push('never ended after ' + ticks + ' ticks');
    if (res) {
      const key = stageId + '/' + mode;
      tally[key] = tally[key] || { win: 0, lose: 0, draw: 0, n: 0, maxS: 0 };
      tally[key][res.outcome]++; tally[key].n++;
      tally[key].maxS = Math.max(tally[key].maxS, res.timeElapsedS);
      if (!Number.isFinite(res.timeElapsedS)) issues.push('result time NaN');
    }
  } catch (e) {
    issues.push('CRASH ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
  if (issues.length) problems.push({ seed, stageId, mode, team: team.map((t) => t.characterId + ':R' + t.resonance), issues: issues.slice(0, 5) });
}
console.log(JSON.stringify({ battles: count, problems: problems.length, tally }, null, 1));
if (problems.length) console.log(JSON.stringify(problems.slice(0, 20), null, 1));
