#!/usr/bin/env node
// QA round 2 targeted engine edge cases (GDD §5). Prints PASS/FAIL/INFO per probe.
import { scriptedBattle, setClose, setVigor, vigor } from '../helpers/battle-helpers.js';

const out = [];
const log = (k, name, msg) => { out.push(k); console.log(k + ' ' + name + ': ' + msg); };
const run = (b, n, inp) => { const evs = []; for (let i = 0; i < n; i++) evs.push(...b.step(i === 0 && inp ? inp : undefined)); return evs; };

// 1. BUG-2-08 / AC-5.9.7: the enemy taps IGNITE on every tick of the player's Tri-Burst rush (T..T+18).
//    Round-2 rule (GDD §5.0 Tri-Burst lock): every one is rejected `not_now`, the rush resolves on T+18 and is not
//    cancelled, and the enemy's Ignition stays unused and available.
{
  const b = scriptedBattle({ enemyTeam: ['enemy_corvane_001'] });
  setClose(b);
  b.teams.player.burst = 100;
  const ef = b.activeFighter('enemy');
  ef.ign.available = true;
  const T = b.tick;
  const evs = [...b.step({ player: [{ type: 'tri_burst' }], enemy: [{ type: 'ignite' }] })];
  for (let i = 0; i < 18; i++) evs.push(...b.step({ player: [], enemy: [{ type: 'ignite' }] }));
  const rejects = evs.filter((e) => e.type === 'input_rejected' && e.side === 'enemy' && e.input.type === 'ignite');
  const notNow = rejects.every((e) => e.reason === 'not_now');
  const resolve = evs.find((e) => e.type === 'tri_burst' || e.type === 'tri_burst_whiff');
  const cancelled = evs.some((e) => e.type === 'card_cancelled' && e.reason === 'ignition');
  const ok = rejects.length === 19 && notNow && resolve && resolve.tick === T + 18 && !cancelled && !ef.ign.used && ef.ign.available && b.teams.player.burstUsed === (resolve.type === 'tri_burst');
  log(ok ? 'PASS' : 'FAIL', 'ignite-vs-tri-burst-rush (AC-5.9.7)',
    'enemy ignite rejects=' + rejects.length + '/19 all not_now=' + notNow + ' resolve=' + (resolve && resolve.type) + '@T+' + (resolve ? resolve.tick - T : '-') +
    ' cancelledByIgnition=' + cancelled + ' enemyIgnitionUsed=' + ef.ign.used + ' available=' + ef.ign.available + ' playerBurstUsed=' + b.teams.player.burstUsed);
}

// 1b. AC-5.10.6: both teams at 100 tap TRI-BURST on the same tick: only the player's rush starts.
{
  const b = scriptedBattle();
  setClose(b);
  b.teams.player.burst = 100; b.teams.enemy.burst = 100;
  const evs = b.step({ player: [{ type: 'tri_burst' }], enemy: [{ type: 'tri_burst' }] });
  const starts = evs.filter((e) => e.type === 'tri_burst_start').map((e) => e.side);
  const rej = evs.find((e) => e.type === 'input_rejected' && e.side === 'enemy' && e.input.type === 'tri_burst');
  log(starts.join() === 'player' && rej && rej.reason === 'not_now' && b.teams.enemy.burst === 100 ? 'PASS' : 'FAIL', 'simultaneous-tri-burst (AC-5.10.6)', 'starts=' + starts + ' enemyReject=' + (rej && rej.reason) + ' enemyBurst=' + b.teams.enemy.burst);
}

// 2. Double tap on the same card slot in one tick: one card, one Vigor charge.
{
  const b = scriptedBattle();
  setClose(b); setVigor(b, 'player', 10);
  const evs = b.step({ player: [{ type: 'card', slot: 0 }, { type: 'card', slot: 0 }] });
  const played = evs.filter((e) => e.type === 'card_played').length;
  log(played === 1 ? 'PASS' : 'FAIL', 'double-tap-same-slot', 'card_played x' + played + ', vigor ' + vigor(b, 'player').toFixed(3));
}

// 3. Tap during an Ignition cinematic is ignored (not queued) and charges nothing.
{
  const b = scriptedBattle();
  setClose(b); setVigor(b, 'player', 5);
  const f = b.activeFighter('player');
  f.ign.available = true;
  b.step({ player: [{ type: 'ignite' }] });
  const v0 = vigor(b, 'player');
  const evs = [];
  for (let i = 0; i < 10; i++) evs.push(...b.step({ player: [{ type: 'card', slot: 1 }, { type: 'slip' }] }));
  log(evs.filter((e) => e.type === 'card_played' || e.type === 'slip').length === 0 && vigor(b, 'player') === v0 ? 'PASS' : 'FAIL',
    'taps-during-ignition-cinematic', 'freeze=' + (b.freezes[0] && b.freezes[0].kind) + ' vigor ' + v0 + ' -> ' + vigor(b, 'player'));
}

// 4. Retreat during a freeze, and step() after the result: no events, result stays.
{
  const b = scriptedBattle();
  b.retreat();
  const r1 = JSON.stringify(b.getResult());
  const evs = run(b, 50, { player: [{ type: 'card', slot: 0 }] });
  b.retreat();
  log(evs.length === 0 && JSON.stringify(b.getResult()) === r1 && b.getResult().outcome === 'lose' ? 'PASS' : 'FAIL', 'retreat-idempotent', r1);
}

// 5. Unknown / malformed inputs do not crash.
{
  const b = scriptedBattle();
  let ok = true;
  try {
    run(b, 5, { player: [{ type: 'card', slot: 9 }, { type: 'card', slot: -1 }, { type: 'tag', slot: 7 }, { type: 'zzz' }, { type: 'dash' }, {}] });
  } catch (e) { ok = false; console.log(e); }
  log(ok ? 'PASS' : 'FAIL', 'malformed-inputs', 'no exception=' + ok);
}

// 6. Pause then unpause: timer and tick identical.
{
  const b = scriptedBattle();
  run(b, 30);
  const s0 = b.getState();
  b.setPaused(true); run(b, 600, { player: [{ type: 'card', slot: 0 }] }); b.setPaused(false);
  const s1 = b.getState();
  log(s0.tick === s1.tick && s0.timer.ticksLeft === s1.timer.ticksLeft && s0.teams.player.vigor === s1.teams.player.vigor ? 'PASS' : 'FAIL', 'pause-freezes-all', 'tick ' + s0.tick + '->' + s1.tick);
}

// 7. Tag tapped during KO freeze / to a KO'd slot is rejected.
{
  const b = scriptedBattle();
  b.teams.player.fighters[1].ko = true; b.teams.player.fighters[1].hp = 0; b.teams.player.fighters[1].state = 'KO';
  b.teams.player.tagReadyAt = 0;
  const evs = b.step({ player: [{ type: 'tag', slot: 1 }] });
  log(evs.some((e) => e.type === 'input_rejected' && e.reason === 'target') && b.teams.player.active === 0 ? 'PASS' : 'FAIL', 'tag-to-ko-slot', JSON.stringify(evs.map((e) => e.type)));
}

const fails = out.filter((k) => k === 'FAIL').length;
console.log('edge-cases: ' + out.length + ' probes, ' + fails + ' FAIL');
process.exitCode = fails ? 1 : 0;
