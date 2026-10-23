// GDD §5.15 round 3 "one decision per opposing card", AC-5.15.7 (P: live data, expectations computed from it).
// For each opposing card the AI decides exactly once, on tick D = windup start + round(reaction_s × 60), in step 2:
// first hit resolved → no slip (no roll); cannot Slip now → no slip (no roll); else one slip_chance roll and, on
// success, one perfect_slip_chance roll. A decided card is never re-examined.
import { describe, it, expect } from 'vitest';
import { createBattle, createContent } from '../../src/logic/index.js';
import { loadBundle, readJson } from '../helpers/load-data.js';
import { giveCard, setVigor, setClose, step, ofType } from '../helpers/battle-helpers.js';

const bundle = loadBundle();
bundle.economy = readJson('data/economy.json');
const content = createContent(bundle);
const TEAM = readJson('data/economy.json').starting.team;
const TIERS = readJson('data/battle.json').ai_tiers;

/** The live climax with the longest windup (the unit test needs D + 1 … first hit to exist). */
function longClimax() {
  let best = null;
  for (const id of Object.keys(content.cards)) {
    const c = content.cards[id];
    if (c.type === 'climax' && c.delivery === 'melee' && (!best || c.windup_s > best.windup_s)) best = c;
  }
  return best;
}
const CLIMAX = longClimax();
const WINDUP_TICKS = Math.round(CLIMAX.windup_s * 60);

/** A human player against a fixed-tier AI enemy at melee range, the player holding CLIMAX with Vigor 10. */
function climaxBattle(seed, tier) {
  const b = createBattle({
    content, stageId: 'stage_003', playerTeam: TEAM, playerController: 'human', enemyController: { aiTier: tier }, skipIntro: true,
  }, seed);
  setClose(b);
  giveCard(b, 'player', 0, CLIMAX.id);
  setVigor(b, 'player', 10);
  return b;
}

/** Stub RNG: next() returns fn(callNumber), callNumber 1-based. */
function stubRng(fn) {
  const r = { calls: 0 };
  r.next = () => { r.calls += 1; return fn(r.calls); };
  r.nextInt = (n) => Math.floor(r.next() * n);
  return r;
}

describe('AC-5.15.7 one reactive-dodge decision per opposing card, on tick D', () => {
  it('unit: a fighter-tier AI whose slip_chance roll fails on D (stub 0.99) does not Slip on any tick D+1 … first hit (later rolls would get 0.0)', () => {
    expect(WINDUP_TICKS).toBeGreaterThanOrEqual(30);
    const b = climaxBattle(1, 'fighter');
    const ai = b.controllers.enemy;
    ai.nextThink = 1e9; // no thinks: the reactive dodge is the only thing that uses the AI's rolls
    let firstRollTick = -1;
    ai.rng = stubRng((n) => {
      if (n === 1) { firstRollTick = b.tick; return 0.99; }
      return 0.0; // an AI that rolls again would now always slip
    });
    setVigor(b, 'enemy', 10);
    const T = b.tick;
    const evs = [];
    for (const e of step(b, [{ type: 'card', slot: 0 }])) evs.push(e);
    const windup = ofType(evs, 'windup_start', 'player')[0];
    expect(windup).toBeDefined();
    const D = windup.tick + Math.round(TIERS.fighter.reaction_s * 60);
    const firstHit = windup.windupEnd;
    expect(D).toBeGreaterThan(T);
    expect(firstHit).toBeGreaterThan(D + 1);
    let guard = 0;
    while (b.tick <= firstHit && !b.getResult() && guard++ < 2000) for (const e of step(b)) evs.push(e);
    expect(firstRollTick).toBe(D);
    expect(ofType(evs, 'slip', 'enemy')).toHaveLength(0);
    expect(ai.rng.calls).toBe(1);
  });

  it('unit: the decision is made on D even when the AI plays a Riposte on D (no skipped or late decision)', () => {
    const b = climaxBattle(2, 'fighter');
    const ai = b.controllers.enemy;
    ai.nextThink = 1e9;
    const callTicks = [];
    ai.rng = stubRng(() => { callTicks.push(b.tick); return 0.0; }); // every roll succeeds
    setVigor(b, 'enemy', 10);
    const T = b.tick;
    step(b, [{ type: 'card', slot: 0 }]);
    const D = T + Math.round(TIERS.fighter.reaction_s * 60);
    while (b.tick < D) step(b);
    // As if the AI had just Perfect-Slipped: a Riposte window is open and it rolls riposte_chance on D too.
    ai.pendingRiposte = true;
    b.teams.enemy.riposteTicks = 48;
    const evs = step(b);
    expect(ofType(evs, 'riposte', 'enemy')).toHaveLength(1); // the Riposte really is played on D
    // On D: slip roll + perfect roll (the decision) and the riposte roll. An AI that lets the Riposte pre-empt
    // the decision rolls only once on D and never decides this card.
    expect(callTicks.filter((t) => t === D)).toHaveLength(3);
    const recs = ai.dodgeLog.filter((r) => r.decisionTick === D);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ tick: D, slipRoll: 0 });
  });

  it('decision log: "cannot Slip" on D (Vigor < slip.cost) → decided no slip, no roll, never re-examined when Vigor returns', () => {
    const b = climaxBattle(3, 'fighter');
    const ai = b.controllers.enemy;
    ai.nextThink = 1e9;
    ai.rng = stubRng(() => 0.0);
    setVigor(b, 'enemy', 0);
    const T = b.tick;
    const evs = step(b, [{ type: 'card', slot: 0 }]);
    const firstHit = ofType(evs, 'windup_start', 'player')[0].windupEnd;
    const D = T + Math.round(TIERS.fighter.reaction_s * 60);
    while (b.tick < D) step(b);
    setVigor(b, 'enemy', 0);
    step(b); // tick D: cannot Slip
    setVigor(b, 'enemy', 10); // Vigor is back right after D
    const later = [];
    while (b.tick <= firstHit) for (const e of step(b)) later.push(e);
    expect(ofType(later, 'slip', 'enemy')).toHaveLength(0);
    expect(ai.rng.calls).toBe(0);
    const recs = ai.dodgeLog.filter((r) => r.decisionTick === D);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ tick: D, outcome: 'cannot_slip', slipRoll: null, perfectRoll: null });
  });

  it('statistical: over 10,000 seeded player Climax windups (AI Vigor ≥ 2 and Idle on D) the fighter-tier slipped share is within ±2 points of slip_chance', () => {
    const p = TIERS.fighter.slip_chance;
    let n = 0;
    let slipped = 0;
    let seed = 0;
    while (n < 10000 && seed < 40000) {
      seed += 1;
      const b = climaxBattle(seed, 'fighter');
      const T = b.tick;
      const evs = step(b, [{ type: 'card', slot: 0 }]);
      const w = ofType(evs, 'windup_start', 'player')[0];
      if (!w) continue;
      const D = T + Math.round(TIERS.fighter.reaction_s * 60);
      const all = [];
      while (b.tick < D) for (const e of step(b)) all.push(e);
      // Qualify the trial on the state the AI sees in step 2 of tick D.
      const me = b.activeFighter('enemy');
      const qualifies = me.state === 'Idle' && b.teams.enemy.vigor >= 2 * 6000 && b.activeFighter('player').action && b.activeFighter('player').action.phase === 'windup';
      let guard = 0;
      while (b.tick <= w.windupEnd && !b.getResult() && guard++ < 1000) for (const e of step(b)) all.push(e);
      if (!qualifies) continue;
      n += 1;
      if (ofType(all, 'slip', 'enemy').some((e) => e.tick >= D)) slipped += 1;
    }
    console.log('[AC-5.15.7] fighter slipped share', slipped + '/' + n, '=', (slipped / n).toFixed(4), 'slip_chance', p, 'seeds used', seed);
    expect(n).toBe(10000);
    expect(Math.abs(slipped / n - p)).toBeLessThanOrEqual(0.02);
  });
});
