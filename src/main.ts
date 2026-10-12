import '@fontsource/saira-condensed/latin-700.css';
import '@fontsource/noto-sans/latin-400.css';
import './ui/styles.css';

import { EMBER_COUNT } from './config/battlefield';
import { TICK_MS } from './config/sim';
import { BUILD_ID } from './core/buildInfo';
import { parseLaunchFlags } from './core/flags';
import { createGameLoop } from './core/loop';
import { installErrorCapture } from './debug/errorCapture';
import { createLogger } from './debug/log';
import { createDebugOverlay, type DebugOverlay } from './debug/overlay';
import {
  createBattlefieldState,
  stepBattlefield,
  type BattlefieldCommand,
} from './game/battlefield';
import { createTapInput } from './input/tapInput';
import { createBattlefieldView } from './render/battlefieldView';
import { countDisplayObjects, createStage, type StageMetrics } from './render/stage';
import { showArenaHint } from './ui/arenaHint';
import { runBootScreen } from './ui/bootScreen';
import { watchPlayability } from './ui/playability';

/** Read-only hook for automated tests, only present with `?debug=1`. */
interface DebugHook {
  readonly selectedUnit: () => number | null;
  /** Centre of a unit's body in CSS pixels, so tests can tap it. */
  readonly unitScreenPoint: (unitId: number) => { x: number; y: number } | null;
  readonly unitIds: () => readonly number[];
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

  const battlefield = createBattlefieldState({ benchmark: flags.benchmark });
  const ready = (async () => {
    const stage = await createStage(host);
    const view = createBattlefieldView(
      battlefield,
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
  document.body.dataset['scene'] = 'battlefield';

  let metrics: StageMetrics = stage.fit();
  const paintBackdrop = (): void => {
    const started = performance.now();
    view.resize(metrics.logicalHeight, metrics.pixelsPerUnit);
    log.info(`Backdrop painted in ${Math.round(performance.now() - started)} ms`);
  };
  paintBackdrop();
  log.info(
    `Renderer ${stage.app.renderer.name} @ ${stage.resolution}x, 720×${Math.round(metrics.logicalHeight)} logical`,
  );

  // Taps become commands applied on the next simulation tick, never direct state changes.
  let pending: BattlefieldCommand[] = [];
  const noCommands: readonly BattlefieldCommand[] = [];
  createTapInput(stage.app.canvas, (cssX, cssY) => {
    const unitId = view.unitAt(cssX / metrics.cssPerUnit, cssY / metrics.cssPerUnit);
    pending.push({ kind: 'select', unitId });
  });

  const loop = createGameLoop({
    update() {
      if (pending.length === 0) {
        stepBattlefield(battlefield, noCommands);
        return;
      }
      const commands = pending;
      pending = [];
      stepBattlefield(battlefield, commands);
    },
    render(alpha, frameDeltaMs) {
      const timeSec = ((battlefield.tick + alpha) * TICK_MS) / 1000;
      view.render(timeSec, frameDeltaMs / 1000);
      stage.render();
    },
    frameMeasured(frameDeltaMs, workMs) {
      overlay?.recordFrame(frameDeltaMs, workMs);
    },
  });

  overlay?.setStatsSource(() => ({
    scene: 'battlefield-test',
    renderer: stage.app.renderer.name,
    resolution: stage.resolution,
    logicalHeight: metrics.logicalHeight,
    displayObjects: countDisplayObjects(stage.app.stage),
    units: battlefield.units.length,
  }));

  if (flags.debug) {
    window.__sovereigns = {
      selectedUnit: () => battlefield.selectedUnitId,
      unitIds: () => battlefield.units.map((unit) => unit.id),
      unitScreenPoint: (unitId) => view.unitScreenPoint(unitId, metrics.cssPerUnit),
      tick: () => battlefield.tick,
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
        Math.abs(next.logicalHeight - metrics.logicalHeight) < 0.5 &&
        Math.abs(next.pixelsPerUnit - metrics.pixelsPerUnit) < 0.01
      ) {
        metrics = next;
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
      // Taps that arrived while paused are stale; never replay them.
      pending = [];
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
