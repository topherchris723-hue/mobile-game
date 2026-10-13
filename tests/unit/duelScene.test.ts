import { describe, expect, it } from 'vitest';
import type { CueId } from '../../src/config/feedback';
import { ENEMY_TEAM, signature } from '../../src/config/fighters';
import { DEFAULT_TEAM, getSovereign } from '../../src/config/sovereigns';
import { createLogger } from '../../src/debug/log';
import { activeFighter, crossoverPartners } from '../../src/game/duel/rules';
import type { DuelView, HitImpact } from '../../src/render/duelView';
import { createDuelScene, type DuelScene } from '../../src/scenes/duelScene';
import type { CutInInfo, DuelHud } from '../../src/ui/duelHud';

/*
 * Presentation sequencing with fake view/HUD: what the player sees and hears, in what order.
 * Rules themselves are covered in duel.test.ts.
 */

type Call =
  | { kind: 'cutIn'; info: CutInInfo }
  | { kind: 'endCutIn' }
  | { kind: 'attack'; card: string }
  | { kind: 'crossover' }
  | { kind: 'hit'; impact: HitImpact; side: string }
  | { kind: 'cue'; id: CueId };

function setup(): { scene: DuelScene; calls: Call[] } {
  const calls: Call[] = [];
  const noop = () => undefined;
  const view: DuelView = {
    root: null as unknown as DuelView['root'], // never touched by the scene
    resize: noop,
    setBottomReserved: noop,
    reset: noop,
    render: noop,
    attack: (_side, kind) => calls.push({ kind: 'attack', card: kind }),
    hit: (side, _amount, _effectiveness, _guarded, impact) =>
      calls.push({ kind: 'hit', impact, side }),
    heal: noop,
    status: noop,
    charge: noop,
    switchIn: noop,
    knockOut: noop,
    crossover: () => calls.push({ kind: 'crossover' }),
    drain: noop,
    setGuardPose: noop,
    dispose: noop,
  };
  const hud: DuelHud = {
    panelHeight: 0,
    onPanelResize: noop,
    reset: noop,
    applyEvent: noop,
    showControls: noop,
    toast: noop,
    cutIn: (info) => calls.push({ kind: 'cutIn', info }),
    endCutIn: () => calls.push({ kind: 'endCutIn' }),
    setSpeed: noop,
    showResult: noop,
    dispose: noop,
  };
  const scene = createDuelScene({
    view,
    hud,
    log: createLogger(),
    feedback: { cue: (id) => calls.push({ kind: 'cue', id }) },
    speed: () => 1,
    player: DEFAULT_TEAM.map(getSovereign),
    enemy: ENEMY_TEAM,
    seed: 7,
    playerBonusEnergy: 0,
    onFinished: () => null,
  });
  return { scene, calls };
}

function runUntilPlayerInput(scene: DuelScene, limit = 20_000): void {
  for (let i = 0; i < limit; i++) {
    scene.update();
    if (scene.phase === 'playerInput') return;
  }
  throw new Error('Never reached player input');
}

/** Runs until the queued action has fully played out and it's the player's turn again (or over). */
function runTurn(scene: DuelScene): void {
  scene.update();
  for (let i = 0; i < 20_000; i++) {
    scene.update();
    if (scene.phase === 'playerInput' || scene.phase === 'ended') return;
  }
  throw new Error('Turn never finished');
}

describe('duel scene presentation', () => {
  it('shows a Signature cut-in before the attack, and lands its hit as heavy', () => {
    const { scene, calls } = setup();
    runUntilPlayerInput(scene);
    const team = scene.state.teams.player;
    activeFighter(team).hand[0] = { uid: 9999, spec: signature('Test Finisher') };
    team.energy = 10;
    calls.length = 0;
    scene.requestPlay(0);
    runTurn(scene);

    const cutIn = calls.findIndex((c) => c.kind === 'cutIn');
    const attack = calls.findIndex((c) => c.kind === 'attack' && c.card === 'signature');
    const ended = calls.findIndex((c) => c.kind === 'endCutIn');
    expect(cutIn).toBeGreaterThanOrEqual(0);
    expect(ended).toBeGreaterThan(cutIn);
    expect(attack).toBeGreaterThan(ended);
    const shown = calls[cutIn];
    expect(shown?.kind === 'cutIn' && shown.info.title).toBe('Test Finisher');
    const hit = calls.find((c) => c.kind === 'hit' && c.side === 'enemy');
    expect(hit?.kind === 'hit' && hit.impact.heavy).toBe(true);
    expect(calls).toContainEqual({ kind: 'cue', id: 'tap' });
    expect(calls).toContainEqual({ kind: 'cue', id: 'cutIn' });
    expect(calls).toContainEqual({ kind: 'cue', id: 'hitHeavy' });
  });

  it('shows both fighters in a Crossover cut-in', () => {
    const { scene, calls } = setup();
    runUntilPlayerInput(scene);
    scene.state.teams.player.energy = 10;
    const partner = crossoverPartners(scene.state, 'player')[0];
    expect(partner).toBeDefined();
    calls.length = 0;
    scene.requestCrossover(partner ?? 1);
    runTurn(scene);
    const shown = calls.find((c) => c.kind === 'cutIn');
    expect(shown?.kind === 'cutIn' && shown.info.fighters.length).toBe(2);
    expect(shown?.kind === 'cutIn' && shown.info.kicker).toBe('Crossover Burst');
    expect(calls.findIndex((c) => c.kind === 'crossover')).toBeGreaterThan(
      calls.findIndex((c) => c.kind === 'endCutIn'),
    );
  });

  it('answers a refused tap with the deny cue and no action', () => {
    const { scene, calls } = setup();
    runUntilPlayerInput(scene);
    scene.state.teams.player.energy = 0;
    activeFighter(scene.state.teams.player).hand[0] = { uid: 9998, spec: signature('Too Costly') };
    calls.length = 0;
    scene.requestPlay(0);
    scene.update();
    expect(calls).toEqual([{ kind: 'cue', id: 'deny' }]);
    expect(scene.phase).toBe('playerInput');
  });

  it('normal attacks land as normal hits', () => {
    const { scene, calls } = setup();
    runUntilPlayerInput(scene);
    const team = scene.state.teams.player;
    activeFighter(team).hand[0] = {
      uid: 9997,
      spec: { kind: 'strike', name: 'Jab', cost: 1, power: 1 },
    };
    team.energy = 5;
    calls.length = 0;
    scene.requestPlay(0);
    runTurn(scene);
    const hit = calls.find((c) => c.kind === 'hit' && c.side === 'enemy');
    expect(hit?.kind === 'hit' && hit.impact.heavy).toBe(false);
    expect(calls.some((c) => c.kind === 'cutIn' && c.info.side === 'player')).toBe(false);
  });
});
