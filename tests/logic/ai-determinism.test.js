// GDD §5.0 determinism and §5.15 AI acceptance criteria (headless, no renderer).
import { describe, it, expect } from 'vitest';
import { createBattle, createContent } from '../../src/logic/index.js';
import { loadBundle, loadGddBundle, readJson, readGddJson } from '../helpers/load-data.js';
import { runBattle } from '../../scripts/sim.js';

const content = createContent(loadBundle());
const TEAM = readJson('data/economy.json').starting.team;
const GDD_TEAM = readGddJson('economy.json').starting.team;
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

/**
 * 1,000 seeded headless battles per tier on stage_003, scripted player = fighter-tier AI.
 * Returns the counters every §5.15 AC below needs.
 */
function tierRuns(content, team) {
  const N = 1000;
  const r = {
    results: {}, rejected: 0, earlySlips: 0, slipsChecked: 0, rookiePerfect: 0, rookieBurst: 0,
    approachTimeouts: 0, perfectPlans: 0, normalPlans: 0, slipPlanErrors: [], normalRollPerfect: 0,
  };
  for (const tier of TIERS) {
    let wins = 0;
    for (let seed = 1; seed <= N; seed++) {
      const b = createBattle({
        content, stageId: 'stage_003', playerTeam: team,
        playerController: { aiTier: 'fighter' }, enemyController: { aiTier: tier }, skipIntro: true,
      }, seed);
      const perfectStarts = { player: {}, enemy: {} };
      while (!b.getResult()) {
        for (const e of b.step()) {
          if (e.type === 'whiff' && e.reason === 'approach_timeout') r.approachTimeouts++;
          if (e.type === 'perfect_slip') perfectStarts[e.side][e.slipStart] = true;
          if (e.type === 'input_rejected') r.rejected++;
          if (tier === 'rookie' && e.side === 'enemy' && e.type === 'perfect_slip') r.rookiePerfect++;
          if (tier === 'rookie' && e.side === 'enemy' && e.type === 'tri_burst_start') r.rookieBurst++;
        }
      }
      for (const side of ['player', 'enemy']) {
        for (const s of b.controllers[side].slipLog) {
          r.slipsChecked++;
          if (s.slipTick - s.windupStart < s.reactionTicks) r.earlySlips++;
          // AC-5.15.5: perfect roll → firstHit − 6 (or its decision tick if later); normal roll → firstHit − 15
          // (or later), never ≤ 9 ticks before the hit, and never a perfect_slip. `planTick` is the decision
          // tick, or the tick the AI re-planned because the predicted hit tick moved (its own dash).
          const planned = Math.max(s.firstHit - s.offset, s.planTick);
          if (s.perfectRoll) {
            r.perfectPlans++;
            if (s.offset !== 6 || s.slipTick !== planned) r.slipPlanErrors.push(s);
          } else {
            r.normalPlans++;
            if (s.offset !== 15 || s.slipTick !== planned || s.firstHit - s.slipTick <= 9) r.slipPlanErrors.push(s);
            if (perfectStarts[side][s.slipTick]) r.normalRollPerfect++;
          }
        }
      }
      if (b.getResult().outcome === 'win') wins++;
    }
    r.results[tier] = wins / N;
  }
  return r;
}

describe('§5.15 AI, P-class ACs on live data (1,000 seeded headless battles per tier, stage_003, scripted player = fighter-tier AI)', () => {
  const live = tierRuns(content, TEAM);
  it('AC-5.15.1: the scripted player\'s win rate strictly decreases rookie → fighter → veteran → master', () => {
    console.log('[AC-5.15.1] live win rates', JSON.stringify(live.results));
    expect(live.results.rookie).toBeGreaterThan(live.results.fighter);
    expect(live.results.fighter).toBeGreaterThan(live.results.veteran);
    expect(live.results.veteran).toBeGreaterThan(live.results.master);
  });
  it('AC-5.15.2: the AI never takes an action it could not afford or that its state forbids (0 rejected AI inputs)', () => {
    expect(live.rejected).toBe(0);
  });
  it('AC-5.1.5 (1,000-battle part, live data): 0 approach_timeout whiffs in the headless battles', () => {
    expect(live.approachTimeouts).toBe(0);
  });
  it('AC-5.15.4: the AI never starts a Slip earlier than reaction_s after the windup start it dodges', () => {
    expect(live.slipsChecked).toBeGreaterThan(100);
    expect(live.earlySlips).toBe(0);
  });
});

describe('§5.15 AI, W-class ACs on FX-GDD (GDD §15.4; same 1,000 seeded battles per tier)', () => {
  const gdd = tierRuns(createContent(loadGddBundle()), GDD_TEAM);
  it('AC-5.15.3: a rookie never Perfect Slips and never uses Tri-Burst', () => {
    expect(gdd.rookiePerfect).toBe(0);
    expect(gdd.rookieBurst).toBe(0);
  });
  it('AC-5.15.5: AI slips start 6 (perfect roll) or 15 (normal roll) ticks before the hit, or at the decision tick if later; normal rolls never ≤ 9 ticks before and never Perfect', () => {
    expect(gdd.perfectPlans).toBeGreaterThan(50);
    expect(gdd.normalPlans).toBeGreaterThan(50);
    expect(gdd.slipPlanErrors).toEqual([]);
    expect(gdd.normalRollPerfect).toBe(0);
  });
});
