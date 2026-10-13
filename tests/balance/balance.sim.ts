/* eslint-disable no-console -- this tool's console output is its report. */
import { it } from 'vitest';
import { ENEMY_TEAM, type FighterSpec } from '../../src/config/fighters';
import { DEFAULT_TEAM, getSovereign, ROSTER } from '../../src/config/sovereigns';
import { createRng } from '../../src/core/rng';
import { chooseAction } from '../../src/game/duel/ai';
import { applyAction, createDuel } from '../../src/game/duel/rules';
import type { Side } from '../../src/game/duel/types';
import { applyLeaderSkill } from '../../src/game/leader';

/*
 * Balance report (`npm run balance`). Both sides are played by the enemy AI, so results compare
 * teams, not player skill. Use it before and after any change to battle numbers or Passives.
 */

const MAX_ACTIONS = 400;

function playOut(player: readonly FighterSpec[], enemy: readonly FighterSpec[], seed: number) {
  const ledPlayer = applyLeaderSkill(player.map((f) => getSovereign(f.id)));
  const { state } = createDuel({
    player: ledPlayer.fighters,
    enemy,
    seed,
    bonusEnergy: { player: ledPlayer.bonusEnergy },
  });
  for (let i = 0; i < MAX_ACTIONS && !state.winner; i++) {
    const side: Side = state.turnSide;
    if (!applyAction(state, side, chooseAction(state, side)).ok) {
      applyAction(state, side, { kind: 'charge' });
    }
  }
  return { winner: state.winner, turns: state.turnNumber };
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

it('Prologue: starter team vs the Rift enemies', () => {
  const team = DEFAULT_TEAM.map(getSovereign);
  const games = 400;
  let wins = 0;
  let turns = 0;
  for (let seed = 1; seed <= games; seed++) {
    const result = playOut(team, ENEMY_TEAM, seed);
    if (result.winner === 'player') wins++;
    turns += result.turns;
  }
  console.log(
    `\nPrologue (${games} games): starter win rate ${pct(wins / games)}, avg ${(turns / games).toFixed(1)} turns`,
  );
});

it('Sovereigns: win rate when on a random team vs another random team', () => {
  const rng = createRng(2026);
  const games = 6000;
  const record = new Map(ROSTER.map((s) => [s.id, { wins: 0, games: 0 }]));
  const pick = (): FighterSpec[] => {
    const pool = [...ROSTER];
    const team: FighterSpec[] = [];
    while (team.length < 3) {
      const [chosen] = pool.splice(rng.int(0, pool.length - 1), 1);
      if (chosen) team.push(chosen);
    }
    return team;
  };
  for (let seed = 1; seed <= games; seed++) {
    const a = pick();
    const b = pick();
    // Team B gets its Leader Skill too: play it as the "player" side of a mirrored duel.
    const ledB = applyLeaderSkill(b.map((f) => getSovereign(f.id))).fighters;
    const { winner } = playOut(a, ledB, seed);
    for (const f of a) {
      const r = record.get(f.id);
      if (r) {
        r.games++;
        if (winner === 'player') r.wins++;
      }
    }
    for (const f of b) {
      const r = record.get(f.id);
      if (r) {
        r.games++;
        if (winner === 'enemy') r.wins++;
      }
    }
  }
  const rows = ROSTER.map((s) => {
    const r = record.get(s.id) ?? { wins: 0, games: 1 };
    return { s, rate: r.wins / Math.max(1, r.games) };
  }).sort((x, y) => y.rate - x.rate);
  console.log(`\nSovereign win rates (${games} random 3v3 games, AI vs AI):`);
  for (const { s, rate } of rows) {
    console.log(`  ${s.name.padEnd(8)} ${s.rarity}★ ${s.passive.padEnd(15)} ${pct(rate)}`);
  }
});
