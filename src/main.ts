import '@fontsource/saira-condensed/latin-700.css';
import '@fontsource/noto-sans/latin-400.css';
import './ui/styles.css';

import { ARENA_SEED, EMBER_COUNT } from './config/arena';
import { TICK_MS } from './config/sim';
import { BUILD_ID } from './core/buildInfo';
import { parseLaunchFlags } from './core/flags';
import { createGameLoop } from './core/loop';
import { installErrorCapture } from './debug/errorCapture';
import { createLogger } from './debug/log';
import { createDebugOverlay, type DebugOverlay } from './debug/overlay';
import { createArenaState, stepArena } from './game/arena';
import { createMovementInput } from './input/movementInput';
import { createArenaView } from './render/arenaView';
import { countDisplayObjects, createStage, type StageMetrics } from './render/stage';
import { showArenaHint } from './ui/arenaHint';
import { runBootScreen } from './ui/bootScreen';
import { watchPlayability } from './ui/playability';

/** Read-only hook for automated tests, only present with `?debug=1`. */
interface DebugHook {
  readonly playerLane: () => number;
  readonly playerGuarding: () => boolean;
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
    `Build ${BUILD_ID}${flags.debug ? ' · debug' : ''}${flags.benchmark ? ' · benchmark' : ''}`,
  );
  const overlay: DebugOverlay | null = flags.debug ? createDebugOverlay(log) : null;

  const host = document.getElementById('game-root');
  if (!host) throw new Error('Missing #game-root');

  const arena = createArenaState({ seed: ARENA_SEED, fightersPerSide: flags.benchmark ? 3 : 1 });
  const ready = (async () => {
    const stage = await createStage(host);
    const view = createArenaView(
      arena,
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
  document.body.dataset['scene'] = 'arena';

  let metrics: StageMetrics = stage.fit();
  const paintBackdrop = (): void => {
    const started = performance.now();
    view.resize(metrics.logicalWidth, metrics.pixelsPerUnit);
    log.info(`Backdrop painted in ${Math.round(performance.now() - started)} ms`);
  };
  paintBackdrop();
  log.info(
    `Renderer ${stage.app.renderer.name} @ ${stage.resolution}x, ${Math.round(metrics.logicalWidth)}×720 logical`,
  );

  const input = createMovementInput(stage.app.canvas, arena.controlledFighterId);

  const loop = createGameLoop({
    update() {
      stepArena(arena, input.drainCommands());
    },
    render(alpha, frameDeltaMs) {
      input.update(performance.now());
      const timeSec = ((arena.tick + alpha) * TICK_MS) / 1000;
      view.render(alpha, timeSec, frameDeltaMs / 1000);
      stage.render();
    },
    frameMeasured(frameDeltaMs, workMs) {
      overlay?.recordFrame(frameDeltaMs, workMs);
    },
  });

  overlay?.setStatsSource(() => ({
    scene: 'arena-test',
    renderer: stage.app.renderer.name,
    resolution: stage.resolution,
    logicalWidth: metrics.logicalWidth,
    displayObjects: countDisplayObjects(stage.app.stage),
    fighters: arena.fighters.length,
  }));

  if (flags.debug) {
    window.__sovereigns = {
      playerLane: () => arena.fighters.find((f) => f.id === arena.controlledFighterId)?.lane ?? -1,
      playerGuarding: () =>
        arena.fighters.find((f) => f.id === arena.controlledFighterId)?.guarding ?? false,
      tick: () => arena.tick,
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
      if (
        Math.abs(next.logicalWidth - metrics.logicalWidth) < 0.5 &&
        Math.abs(next.pixelsPerUnit - metrics.pixelsPerUnit) < 0.01
      ) {
        return;
      }
      metrics = next;
      paintBackdrop();
      if (!loop.running) stage.render();
    });
  };
  window.addEventListener('resize', onResize);

  watchPlayability((playable) => {
    if (playable) {
      // Input that arrived while paused is stale; never replay it.
      input.drainCommands();
      loop.start();
      log.debug('Resumed');
    } else {
      loop.stop();
      log.debug('Paused');
    }
  });
  showArenaHint();
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
