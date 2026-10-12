import '@fontsource/saira-condensed/latin-700.css';
import '@fontsource/noto-sans/latin-400.css';
import './ui/styles.css';

import { EMBER_COUNT } from './config/duelPresentation';
import { ENEMY_TEAM, PLAYER_TEAM } from './config/fighters';
import { TICK_MS } from './config/sim';
import { BUILD_ID } from './core/buildInfo';
import { parseLaunchFlags } from './core/flags';
import { createGameLoop } from './core/loop';
import { installErrorCapture } from './debug/errorCapture';
import { createLogger } from './debug/log';
import { createDebugOverlay, type DebugOverlay } from './debug/overlay';
import { activeFighter } from './game/duel/rules';
import type { Side } from './game/duel/types';
import { createDuelView } from './render/duelView';
import { countDisplayObjects, createStage, type StageMetrics } from './render/stage';
import { createDuelScene, type DuelPhase } from './scenes/duelScene';
import { runBootScreen } from './ui/bootScreen';
import { createDuelHud } from './ui/duelHud';
import { watchPlayability } from './ui/playability';

/** Read-only hook for automated tests, only present with `?debug=1`. */
interface DebugHook {
  readonly phase: () => DuelPhase;
  readonly turnSide: () => Side;
  readonly winner: () => Side | null;
  readonly activeIndex: (side: Side) => number;
  readonly hp: (side: Side) => number;
  readonly energy: (side: Side) => number;
  readonly tick: () => number;
}
declare global {
  interface Window {
    __sovereigns?: DebugHook;
  }
}

const log = createLogger();
installErrorCapture(log);

async function boot(): Promise<void> {
  const flags = parseLaunchFlags(location.search);
  log.info(
    `Build ${BUILD_ID}${flags.debug ? ' · debug' : ''}${flags.benchmark ? ' · benchmark' : ''}${flags.speed !== 1 ? ` · speed ×${flags.speed}` : ''}`,
  );
  const overlay: DebugOverlay | null = flags.debug ? createDebugOverlay(log) : null;

  const host = document.getElementById('game-root');
  const hudHost = document.getElementById('hud-root');
  if (!host || !hudHost) throw new Error('Missing #game-root or #hud-root');

  const ready = (async () => {
    // Pixi measures text with canvas fonts, so the display font must be loaded first.
    await document.fonts.load('700 64px "Saira Condensed"');
    const stage = await createStage(host);
    const view = createDuelView(
      stage.app.renderer,
      { player: PLAYER_TEAM, enemy: ENEMY_TEAM },
      flags.benchmark ? EMBER_COUNT.benchmark : EMBER_COUNT.normal,
    );
    stage.world.addChild(view.root);
    return { stage, view };
  })();

  await runBootScreen(
    log,
    ready.then(() => undefined),
  );
  const { stage, view } = await ready;
  document.body.dataset['scene'] = 'duel';

  // The HUD calls into the scene, which is created right after; requests before then are ignored.
  let scene: ReturnType<typeof createDuelScene> | null = null;
  const hud = createDuelHud(hudHost, {
    onPlayCard: (index) => scene?.requestPlay(index),
    onSwitch: (index) => scene?.requestSwitch(index),
    onCharge: () => scene?.requestCharge(),
    onRestart: () => scene?.restart(),
  });
  const duel = createDuelScene({ view, hud, log, speed: flags.speed });
  scene = duel;

  let metrics: StageMetrics = stage.fit();
  const paintBackdrop = (): void => {
    const started = performance.now();
    view.resize(metrics.logicalHeight, metrics.pixelsPerUnit, hud.panelHeight / metrics.cssPerUnit);
    log.info(`Backdrop painted in ${Math.round(performance.now() - started)} ms`);
  };
  paintBackdrop();
  log.info(
    `Renderer ${stage.app.renderer.name} @ ${stage.resolution}x, 720×${Math.round(metrics.logicalHeight)} logical`,
  );

  let tick = 0;
  const loop = createGameLoop({
    update() {
      tick++;
      duel.update();
    },
    render(alpha, frameDeltaMs) {
      const timeSec = ((tick + alpha) * TICK_MS) / 1000;
      view.render(timeSec, (frameDeltaMs / 1000) * flags.speed);
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

  if (flags.debug) {
    window.__sovereigns = {
      phase: () => duel.phase,
      turnSide: () => duel.state.turnSide,
      winner: () => duel.state.winner,
      activeIndex: (side) => duel.state.teams[side].activeIndex,
      hp: (side) => activeFighter(duel.state.teams[side]).hp,
      energy: (side) => duel.state.teams[side].energy,
      tick: () => tick,
    };
  }

  // Resize at most once per frame, and only when the size really changed.
  let resizeQueued = false;
  const onResize = (): void => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      const next = stage.fit();
      const unchanged =
        Math.abs(next.logicalHeight - metrics.logicalHeight) < 0.5 &&
        Math.abs(next.pixelsPerUnit - metrics.pixelsPerUnit) < 0.01;
      metrics = next;
      if (unchanged) return;
      paintBackdrop();
      if (!loop.running) stage.render();
    });
  };
  window.addEventListener('resize', onResize);

  watchPlayability((playable) => {
    if (playable) {
      loop.start();
      log.debug('Resumed');
    } else {
      loop.stop();
      log.debug('Paused');
    }
  });
}

boot().catch((error: unknown) => {
  log.error('Boot failed', error);
  const panel = document.getElementById('error-panel');
  const message = document.getElementById('error-message');
  if (panel && message) {
    message.textContent = error instanceof Error ? (error.stack ?? error.message) : String(error);
    panel.hidden = false;
  }
});
