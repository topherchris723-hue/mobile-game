import { createSfx } from '../audio/sfx';
import { getSovereign } from '../config/sovereigns';
import { getStage } from '../config/story';
import type { LaunchFlags } from '../core/flags';
import type { Logger } from '../debug/log';
import type { DebugOverlay } from '../debug/overlay';
import { createPortraitCache } from '../render/portraits';
import type { Stage } from '../render/stage';
import type { Settings } from '../save/saveData';
import type { SaveStore } from '../save/saveStore';
import { element } from '../ui/dom';
import { createFeedback } from '../ui/feedback';
import { createMenuBackdrop } from '../ui/menuBackdrop';
import { createHomeScreen, type Screen } from '../ui/screens/homeScreen';
import { createSettingsSheet } from '../ui/screens/settingsSheet';
import { createSovereignsScreen } from '../ui/screens/sovereignsScreen';
import { createStoryScreen } from '../ui/screens/storyScreen';
import { createBattleSession, type BattleSession } from './battleSession';

/*
 * Screen flow: Home ⇄ Story / Sovereigns, Story → Battle → Home. Menus are HTML over a static
 * painted backdrop; battles use the Pixi stage. Exactly one of them is alive at a time, and
 * whichever was showing is disposed before the next starts.
 */

export type ScreenId = 'home' | 'story' | 'sovereigns' | 'battle';

export interface App {
  readonly screen: ScreenId;
  readonly battle: BattleSession | null;
  showHome(): void;
  setPlayable(playable: boolean): void;
  resize(): void;
}

export interface AppDeps {
  readonly stage: Stage;
  readonly screenHost: HTMLElement;
  readonly hudHost: HTMLElement;
  readonly save: SaveStore;
  readonly flags: LaunchFlags;
  readonly log: Logger;
  readonly overlay: DebugOverlay | null;
}

export function createApp(deps: AppDeps): App {
  const { save, log } = deps;
  const portraits = createPortraitCache(deps.stage.app.renderer);
  const sfx = createSfx(log);
  const feedback = createFeedback(sfx, () => save.data.settings);
  const applySettings = (settings: Readonly<Settings>): void => {
    // CSS reads this to drop decorative motion (cut-in slide, etc.).
    document.body.dataset['reduceMotion'] = String(settings.reduceMotion);
  };
  applySettings(save.data.settings);
  const backdrop = createMenuBackdrop(deps.screenHost);
  const toastNode = element('div', 'toast menu-toast', deps.screenHost);
  toastNode.setAttribute('role', 'status');
  let toastTimer = 0;
  const toast = (message: string): void => {
    window.clearTimeout(toastTimer);
    toastNode.textContent = message;
    toastNode.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      toastNode.classList.remove('is-visible');
    }, 2200);
  };

  let screen: ScreenId = 'home';
  let menu: Screen | null = null;
  let sheet: Screen | null = null;
  let battle: BattleSession | null = null;
  let playable = true;

  const closeSheet = (): void => {
    sheet?.dispose();
    sheet = null;
  };

  const leaveCurrent = (): void => {
    closeSheet();
    menu?.dispose();
    menu = null;
    battle?.dispose();
    battle = null;
  };

  const enter = (id: ScreenId): void => {
    screen = id;
    document.body.dataset['scene'] = id;
    log.debug(`Screen: ${id}`);
  };

  const showHome = (): void => {
    leaveCurrent();
    enter('home');
    menu = createHomeScreen(deps.screenHost, {
      save,
      portraits,
      toast,
      onStory: showStory,
      onSovereigns: showSovereigns,
      onSettings: showSettings,
    });
  };

  function showSettings(): void {
    closeSheet();
    sheet = createSettingsSheet(deps.screenHost, {
      save,
      onChange: (settings) => {
        applySettings(settings);
        feedback.cue('tap');
      },
      onClose: closeSheet,
    });
  }

  function showStory(): void {
    leaveCurrent();
    enter('story');
    menu = createStoryScreen(deps.screenHost, { save, onBattle: startBattle, onBack: showHome });
  }

  function showSovereigns(): void {
    leaveCurrent();
    enter('sovereigns');
    menu = createSovereignsScreen(deps.screenHost, { save, portraits, toast, onBack: showHome });
  }

  function startBattle(stageId: string): void {
    leaveCurrent();
    enter('battle');
    const stageSpec = getStage(stageId);
    battle = createBattleSession({
      stage: deps.stage,
      hudHost: deps.hudHost,
      stageSpec,
      team: save.data.team.map(getSovereign),
      flags: deps.flags,
      log,
      overlay: deps.overlay,
      save,
      portraits,
      feedback,
      onFinished: (winner) => {
        if (winner === 'player' && !save.data.story.clearedStages.includes(stageId)) {
          save.update((data) => {
            data.story.clearedStages.push(stageId);
          });
          log.info(`Stage "${stageId}" cleared`);
        }
      },
      onExit: showHome,
    });
    battle.setPlayable(playable);
  }

  return {
    get screen() {
      return screen;
    },
    get battle() {
      return battle;
    },
    showHome,
    setPlayable(next) {
      playable = next;
      battle?.setPlayable(next);
      sfx.setSuspended(!next);
    },
    resize() {
      if (battle) battle.resize();
      else backdrop.repaint();
    },
  };
}
