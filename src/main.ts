import '@fontsource/saira-condensed/latin-700.css';
import '@fontsource/noto-sans/latin-400.css';
import './ui/styles.css';

import { BUILD_ID } from './core/buildInfo';
import { parseLaunchFlags } from './core/flags';
import { installErrorCapture } from './debug/errorCapture';
import { createLogger } from './debug/log';
import { createDebugOverlay, type DebugOverlay } from './debug/overlay';
import { activeFighter } from './game/duel/rules';
import type { Side } from './game/duel/types';
import { createStage } from './render/stage';
import { browserStorage, createSaveStore } from './save/saveStore';
import { createApp, type ScreenId } from './scenes/app';
import type { DuelPhase } from './scenes/duelScene';
import { runBootScreen } from './ui/bootScreen';
import { watchPlayability } from './ui/playability';

/** Read-only hook for automated tests, only present with `?debug=1`. */
interface DebugHook {
  readonly screen: () => ScreenId;
  readonly phase: () => DuelPhase | null;
  readonly turnSide: () => Side | null;
  readonly turnNumber: () => number;
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

  const gameHost = document.getElementById('game-root');
  const hudHost = document.getElementById('hud-root');
  const screenHost = document.getElementById('screen-root');
  if (!gameHost || !hudHost || !screenHost) throw new Error('Missing a root element');

  const save = createSaveStore(browserStorage(), log);
  const ready = (async () => {
    // Pixi measures text with canvas fonts, so the display font must be loaded first.
    await document.fonts.load('700 64px "Saira Condensed"');
    return createStage(gameHost);
  })();

  await runBootScreen(
    log,
    ready.then(() => undefined),
  );
  const stage = await ready;
  log.info(`Renderer ${stage.app.renderer.name} @ ${stage.resolution}x`);

  const app = createApp({ stage, screenHost, hudHost, save, flags, log, overlay });
  app.showHome();

  if (flags.debug) {
    let tick = 0;
    const countTicks = (): void => {
      if (app.battle?.loop.running) tick++;
      requestAnimationFrame(countTicks);
    };
    requestAnimationFrame(countTicks);
    const duel = () => app.battle?.scene ?? null;
    window.__sovereigns = {
      screen: () => app.screen,
      phase: () => duel()?.phase ?? null,
      turnSide: () => duel()?.state.turnSide ?? null,
      turnNumber: () => duel()?.state.turnNumber ?? 0,
      winner: () => duel()?.state.winner ?? null,
      activeIndex: (side) => duel()?.state.teams[side].activeIndex ?? -1,
      hp: (side) => {
        const scene = duel();
        return scene ? activeFighter(scene.state.teams[side]).hp : -1;
      },
      energy: (side) => duel()?.state.teams[side].energy ?? -1,
      tick: () => tick,
    };
  }

  // Resize at most once per frame.
  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      app.resize();
    });
  });

  watchPlayability((playable) => {
    app.setPlayable(playable);
    log.debug(playable ? 'Resumed' : 'Paused');
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
