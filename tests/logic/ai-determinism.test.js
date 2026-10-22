// GDD §5.0 determinism and §5.15 AI acceptance criteria (headless, no renderer).
import { describe, it, expect } from 'vitest';
import { createBattle, createContent } from '../../src/logic/index.js';
import { loadBundle, readJson } from '../helpers/load-data.js';
import { runBattle } from '../../scripts/sim.js';

const content = createContent(loadBundle());
const TEAM = readJson('data/economy.json').starting.team;
const TIERS = ['rookie', 'fighter', 'veteran', 'master'];

/** Run one AI-vs-AI battle and collect its full event log. */
function runLogged(seed, stageId, enemyTier, playerTier) {
  const b = createBattle({
    content, stageId, playerTeam: TEAM,
    playerController: { aiTier: playerTier || 'fighter' },
    enemyController: enemyTier ? { aiTier: enemyTier } : 'ai',
    skipIntro: true,
  }, seed);
  const log = [];
  while (!b.getResult()) for (const e of b.step()) log.push(e);
  return { b, log };
}

describe('§5.0 determinism', () => {
  it('same seed ⇒ identical battle (full event log, final state and result)', () => {
    for (const stage of ['stage_001', 'stage_003', 'stage_005']) {
      const a = runLogged(42, stage);
      const c = runLogged(42, stage);
      expect(JSON.stringify(c.log)).toBe(JSON.stringify(a.log));
      expect(JSON.stringify(c.b.getState())).toBe(JSON.stringify(a.b.getState()));
      expect(c.b.getResult()).toEqual(a.b.getResult());
    }
  });
  it('different seeds give different battles', () => {
    const a = runLogged(1, 'stage_003');
    const c = runLogged(2, 'stage_003');
    expect(JSON.stringify(c.log)).not.toBe(JSON.stringify(a.log));
  });
  it('same seed + same human input log ⇒ identical battle', () => {
    const inputs = {};
    for (let t = 0; t < 3000; t += 37) inputs[t] = [{ type: 'card', slot: t % 4 }];
    for (let t = 11; t < 3000; t += 53) inputs[t] = [{ type: 'slip' }];
    const play = () => {
      const b = createBattle({ content, stageId: 'stage_002', playerTeam: TEAM, skipIntro: true }, 7);
      const log = [];
      let real = 0;
      while (!b.getResult() && real < 4000) { for (const e of b.step(inputs[real] || [])) log.push(e); real++; }
      return JSON.stringify(log) + JSON.stringify(b.getState());
    };
    expect(play()).toBe(play());
  });
  it('the headless runner (scripts/sim.js) is deterministic', () => {
    const opts = { stageId: 'stage_004', team: TEAM, playerTier: 'veteran' };
    const r1 = runBattle(content, opts, 9);
    const r2 = runBattle(content, opts, 9);
    expect(r2).toEqual(r1);
  });
  it('getState() is a plain JSON-serialisable snapshot', () => {
    const { b } = runLogged(5, 'stage_001');
    const s = b.getState();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('§5.15 AI (1,000 seeded headless battles per tier, stage_003, scripted player = fighter-tier AI)', () => {
  const N = 1000;
  const results = {};
  let rejected = 0;
  let earlySlips = 0;
  let slipsChecked = 0;
  let rookiePerfect = 0;
  let rookieBurst = 0;
  for (const tier of TIERS) {
    let wins = 0;
    for (let seed = 1; seed <= N; seed++) {
      const b = createBattle({
        content, stageId: 'stage_003', playerTeam: TEAM,
        playerController: { aiTier: 'fighter' }, enemyController: { aiTier: tier }, skipIntro: true,
      }, seed);
      while (!b.getResult()) {
        for (const e of b.step()) {
          if (e.type === 'input_rejected') rejected++;
          if (tier === 'rookie' && e.side === 'enemy' && e.type === 'perfect_slip') rookiePerfect++;
          if (tier === 'rookie' && e.side === 'enemy' && e.type === 'tri_burst_start') rookieBurst++;
        }
      }
      for (const side of ['player', 'enemy']) {
        for (const s of b.controllers[side].slipLog) {
          slipsChecked++;
          if (s.slipTick - s.windupStart < s.reactionTicks) earlySlips++;
        }
      }
      if (b.getResult().outcome === 'win') wins++;
    }
    results[tier] = wins / N;
  }
  it('AC-5.15.1: the scripted player\'s win rate strictly decreases rookie → fighter → veteran → master', () => {
    expect(results.rookie).toBeGreaterThan(results.fighter);
    expect(results.fighter).toBeGreaterThan(results.veteran);
    expect(results.veteran).toBeGreaterThan(results.master);
  });
  it('AC-5.15.2: the AI never takes an action it could not afford or that its state forbids (0 rejected AI inputs)', () => {
    expect(rejected).toBe(0);
  });
  it('AC-5.15.3: a rookie never Perfect Slips and never uses Tri-Burst', () => {
    expect(rookiePerfect).toBe(0);
    expect(rookieBurst).toBe(0);
  });
  it('AC-5.15.4: the AI never starts a Slip earlier than reaction_s after the windup start it dodges', () => {
    expect(slipsChecked).toBeGreaterThan(100);
    expect(earlySlips).toBe(0);
  });
});
