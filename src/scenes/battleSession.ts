import { EMBER_COUNT } from '../config/duelPresentation';
import { TICK_MS } from '../config/sim';
import type { SovereignSpec } from '../config/sovereigns';
import type { StageSpec } from '../config/story';
import type { LaunchFlags } from '../core/flags';
import { createGameLoop, type GameLoop } from '../core/loop';
import type { Logger } from '../debug/log';
import type { DebugOverlay } from '../debug/overlay';
import type { Side } from '../game/duel/types';
import { applyLeaderSkill } from '../game/leader';
import { createDuelView } from '../render/duelView';
import type { PortraitCache } from '../render/portraits';
import { countDisplayObjects, type Stage, type StageMetrics } from '../render/stage';
import type { SaveStore } from '../save/saveStore';
import { createDuelHud, type BattleReward } from '../ui/duelHud';
import type { Feedback } from '../ui/feedback';
import { createDuelScene, type DuelScene } from './duelScene';

/*
 * One battle from start to exit: owns the Pixi duel view, the HTML HUD, the duel scene, and the
 * game loop, and releases all of them on dispose (CLAUDE.md §3: explicit lifecycles). The loop only
 * runs during battles, so menus cost no frames.
 */

export interface BattleSession {
  readonly scene: DuelScene;
  readonly loop: GameLoop;
  /** Re-fits after a resize; repaints the backdrop only if the size really changed. */
  resize(): void;
  setPlayable(playable: boolean): void;
  dispose(): void;
}

export interface BattleSessionOptions {
  readonly stage: Stage;
  readonly hudHost: HTMLElement;
  readonly stageSpec: StageSpec;
  readonly team: readonly SovereignSpec[];
  readonly flags: LaunchFlags;
  readonly log: Logger;
  readonly overlay: DebugOverlay | null;
  readonly save: SaveStore;
  readonly portraits: PortraitCache;
  readonly feedback: Feedback;
  readonly onFinished: (winner: Side) => BattleReward | null;
  readonly onExit: () => void;
}

export function createBattleSession(options: BattleSessionOptions): BattleSession {
  const { stage, flags, log, overlay, save } = options;
  const led = applyLeaderSkill(options.team);
  const view = createDuelView(
    stage.app.renderer,
    { player: led.fighters, enemy: options.stageSpec.enemies },
    flags.benchmark ? EMBER_COUNT.benchmark : EMBER_COUNT.normal,
    () => save.data.settings.reduceMotion,
  );
  // Cut-ins show portraits; render them now so the first Signature doesn't wait on them.
  for (const fighter of [...led.fighters, ...options.stageSpec.enemies]) {
    void options.portraits.get(fighter);
  }
  /** The player's 1×/2× choice, on top of the `?speed=` test flag. */
  const speed = (): number => flags.speed * save.data.settings.battleSpeed;
  stage.world.addChild(view.root);

  let scene: DuelScene | null = null;
  const hud = createDuelHud(
    options.hudHost,
    {
      onPlayCard: (index) => scene?.requestPlay(index),
      onSwitch: (index) => scene?.requestSwitch(index),
      onCharge: () => scene?.requestCharge(),
      onCrossover: (partner) => scene?.requestCrossover(partner),
      onRestart: () => scene?.restart(),
      onExit: () => {
        options.onExit();
      },
      onToggleSpeed: () => {
        save.update((data) => {
          data.settings.battleSpeed = data.settings.battleSpeed === 1 ? 2 : 1;
        });
        hud.setSpeed(save.data.settings.battleSpeed);
        options.feedback.cue('tap');
      },
    },
    options.portraits,
  );
  hud.setSpeed(save.data.settings.battleSpeed);
  const duel = createDuelScene({
    view,
    hud,
    log,
    feedback: options.feedback,
    speed,
    player: led.fighters,
    enemy: options.stageSpec.enemies,
    seed: options.stageSpec.seed,
    playerBonusEnergy: led.bonusEnergy,
    onFinished: options.onFinished,
  });
  scene = duel;

  let metrics: StageMetrics = stage.fit();
  const paintBackdrop = (): void => {
    const started = performance.now();
    view.resize(metrics.logicalHeight, metrics.pixelsPerUnit, hud.panelHeight / metrics.cssPerUnit);
    log.info(`Backdrop painted in ${Math.round(performance.now() - started)} ms`);
  };
  paintBackdrop();
  hud.onPanelResize((heightCss) => {
    view.setBottomReserved(heightCss / metrics.cssPerUnit);
  });

  let tick = 0;
  const loop = createGameLoop({
    update() {
      tick++;
      duel.update();
    },
    render(alpha, frameDeltaMs) {
      const timeSec = ((tick + alpha) * TICK_MS) / 1000;
      view.render(timeSec, (frameDeltaMs / 1000) * speed());
      stage.render();
    },
    frameMeasured(frameDeltaMs, workMs) {
      overlay?.recordFrame(frameDeltaMs, workMs);
    },
  });
  overlay?.setStatsSource(() => ({
    scene: `duel · ${duel.phase}`,
    renderer: stage.app.renderer.name,
    resolution: stage.resolution,
    logicalHeight: metrics.logicalHeight,
    displayObjects: countDisplayObjects(stage.app.stage),
  }));
  log.info(`Battle "${options.stageSpec.id}" with ${options.team.map((s) => s.name).join(', ')}`);

  return {
    scene: duel,
    loop,
    resize() {
      const next = stage.fit();
      const unchanged =
        Math.abs(next.logicalHeight - metrics.logicalHeight) < 0.5 &&
        Math.abs(next.pixelsPerUnit - metrics.pixelsPerUnit) < 0.01;
      metrics = next;
      if (unchanged) return;
      paintBackdrop();
      if (!loop.running) stage.render();
    },
    setPlayable(playable) {
      if (playable) loop.start();
      else loop.stop();
    },
    dispose() {
      loop.stop();
      hud.dispose();
      view.dispose();
      stage.render();
    },
  };
}
