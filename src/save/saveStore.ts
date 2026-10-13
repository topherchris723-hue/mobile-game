import type { Logger } from '../debug/log';
import { parseSave, serializeSave, type LoadStatus, type SaveData } from './saveData';

/** The single localStorage key for this game (CLAUDE.md §10). */
export const SAVE_KEY = 'shattered-sovereigns/save';

export interface SaveStore {
  /** Current save. Change it only through update(). */
  readonly data: Readonly<SaveData>;
  readonly loadStatus: LoadStatus;
  /** Applies a change and writes it immediately (mobile browsers can kill a tab without warning). */
  update(change: (data: SaveData) => void): void;
}

/** Minimal slice of the Web Storage API, so tests can pass an in-memory fake. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function readStorage(storage: KeyValueStorage | null, log: Logger): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(SAVE_KEY);
  } catch (error) {
    log.warn(`Could not read the save: ${String(error)}`);
    return null;
  }
}

/** Opens the save. If storage is unavailable (private mode, blocked), play continues in memory. */
export function createSaveStore(storage: KeyValueStorage | null, log: Logger): SaveStore {
  const loaded = parseSave(readStorage(storage, log));
  for (const issue of loaded.issues) log.warn(`Save: ${issue}`);
  log.info(`Save ${loaded.status}`);
  let data = loaded.data;
  // A save from a newer game version must never be overwritten by this one.
  const writable = storage !== null && loaded.status !== 'future';

  const write = (): void => {
    if (!writable) return;
    try {
      storage.setItem(SAVE_KEY, serializeSave(data));
    } catch (error) {
      log.warn(`Could not write the save: ${String(error)}`);
    }
  };
  if (loaded.status !== 'loaded') write();

  return {
    get data() {
      return data;
    },
    loadStatus: loaded.status,
    update(change) {
      const next = structuredClone(data);
      change(next);
      data = next;
      write();
    },
  };
}

/** localStorage, or null where the browser refuses access to it. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
