import { BUILD_ID } from '../../core/buildInfo';
import type { Settings } from '../../save/saveData';
import type { SaveStore } from '../../save/saveStore';
import { button, element } from '../dom';
import type { Screen } from './homeScreen';

/*
 * Settings (CLAUDE.md §8, §11): sound, vibration, reduce motion, battle speed, and the build id
 * for bug reports. Each change is saved immediately and takes effect at once.
 */

export interface SettingsSheetDeps {
  readonly save: SaveStore;
  /** Called after any change, so the app can apply it (e.g. the reduce-motion attribute). */
  readonly onChange: (settings: Readonly<Settings>) => void;
  readonly onClose: () => void;
}

type ToggleKey = 'sound' | 'haptics' | 'reduceMotion';

interface ToggleSpec {
  readonly key: ToggleKey;
  readonly label: string;
  readonly detail: string;
}

const canVibrate = 'vibrate' in navigator;

const TOGGLES: readonly ToggleSpec[] = [
  { key: 'sound', label: 'Sound effects', detail: 'Hits, cards, and big moves in battle' },
  {
    key: 'haptics',
    label: 'Vibration',
    detail: canVibrate ? 'Short pulses on hits and big moves' : 'Not supported by this browser',
  },
  { key: 'reduceMotion', label: 'Reduce motion', detail: 'Turns off screen shake and flashes' },
];

export function createSettingsSheet(host: HTMLElement, deps: SettingsSheetDeps): Screen {
  const sheet = element('div', 'detail-sheet settings-sheet', host);
  const panel = element('div', 'detail-panel panel-light', sheet);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Settings');
  element('h2', 'settings-title', panel).textContent = 'Settings';
  const list = element('div', 'settings-list', panel);

  const change = (apply: (settings: Settings) => void): void => {
    deps.save.update((data) => {
      apply(data.settings);
    });
    deps.onChange(deps.save.data.settings);
    render();
  };

  const toggles = TOGGLES.map((spec) => {
    const row = element('button', 'settings-row', list);
    row.type = 'button';
    row.dataset['setting'] = spec.key;
    row.setAttribute('role', 'switch');
    const text = element('span', 'settings-text', row);
    element('span', 'settings-label', text).textContent = spec.label;
    element('span', 'settings-detail', text).textContent = spec.detail;
    const state = element('span', 'settings-state', row);
    row.addEventListener('click', () => {
      change((settings) => {
        settings[spec.key] = !settings[spec.key];
      });
    });
    return { spec, row, state };
  });

  const speedRow = element('button', 'settings-row', list);
  speedRow.type = 'button';
  speedRow.dataset['setting'] = 'battleSpeed';
  const speedText = element('span', 'settings-text', speedRow);
  element('span', 'settings-label', speedText).textContent = 'Battle speed';
  element('span', 'settings-detail', speedText).textContent = 'Also switchable during battle';
  const speedState = element('span', 'settings-state', speedRow);
  speedRow.addEventListener('click', () => {
    change((settings) => {
      settings.battleSpeed = settings.battleSpeed === 1 ? 2 : 1;
    });
  });

  element('p', 'settings-build', panel).textContent = `Build ${BUILD_ID}`;
  button('button-primary settings-close', 'Done', panel).addEventListener('click', deps.onClose);
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) deps.onClose();
  });

  const render = (): void => {
    const settings = deps.save.data.settings;
    for (const { spec, row, state } of toggles) {
      const on = settings[spec.key];
      row.setAttribute('aria-checked', String(on));
      row.classList.toggle('is-on', on);
      state.textContent = on ? 'On' : 'Off';
    }
    speedState.textContent = `${settings.battleSpeed}×`;
  };
  render();

  return {
    dispose() {
      sheet.remove();
    },
  };
}
