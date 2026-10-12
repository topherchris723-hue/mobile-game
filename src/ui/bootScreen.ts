import { BUILD_ID } from '../core/buildInfo';
import type { Logger } from '../debug/log';

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/**
 * Best effort: go fullscreen (hides Chrome's address bar) and lock portrait. Both must happen
 * inside a user gesture and either may be refused, so failures are logged, never fatal.
 */
async function enterImmersivePortrait(log: Logger): Promise<void> {
  const isInstalledApp = window.matchMedia('(display-mode: fullscreen)').matches;
  if (!isInstalledApp && !document.fullscreenElement && document.fullscreenEnabled) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (error) {
      log.info(`Fullscreen not available: ${String(error)}`);
    }
  }
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (orientation?.lock) {
    try {
      await orientation.lock('portrait');
    } catch (error) {
      log.info(`Portrait lock not available: ${String(error)}`);
    }
  }
}

/** Shows the start screen until the player taps Start, then hands over to the game. */
export function runBootScreen(log: Logger, ready: Promise<void>): Promise<void> {
  const screen = document.getElementById('boot-screen');
  const button = document.getElementById('start-button');
  const buildTag = document.getElementById('boot-build');
  if (!screen || !(button instanceof HTMLButtonElement)) {
    throw new Error('Boot screen markup is missing');
  }
  if (buildTag) buildTag.textContent = `Build ${BUILD_ID}`;

  return new Promise((resolve, reject) => {
    ready.then(
      () => {
        button.disabled = false;
        button.textContent = 'Tap to start';
      },
      (error: unknown) => {
        button.textContent = 'Failed to load';
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );

    button.addEventListener(
      'click',
      () => {
        void enterImmersivePortrait(log);
        screen.classList.add('is-leaving');
        window.setTimeout(() => {
          screen.hidden = true;
        }, 300);
        resolve();
      },
      { once: true },
    );
  });
}
