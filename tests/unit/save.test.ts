import { describe, expect, it } from 'vitest';
import { DEFAULT_TEAM, STARTER_IDS } from '../../src/config/sovereigns';
import { createLogger } from '../../src/debug/log';
import {
  createDefaultSave,
  parseSave,
  SAVE_SCHEMA_VERSION,
  serializeSave,
  type Migration,
} from '../../src/save/saveData';
import { createSaveStore, SAVE_KEY, type KeyValueStorage } from '../../src/save/saveStore';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  items: Record<string, string>;
} {
  const items = { ...initial };
  return {
    items,
    getItem: (key) => items[key] ?? null,
    setItem: (key, value) => {
      items[key] = value;
    },
  };
}

describe('parseSave', () => {
  it('starts fresh with the starters and default team', () => {
    const result = parseSave(null);
    expect(result.status).toBe('new');
    expect(result.data.ownedSovereigns).toEqual(STARTER_IDS);
    expect(result.data.team).toEqual(DEFAULT_TEAM);
    expect(result.data.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  it('round-trips a valid save unchanged', () => {
    const save = createDefaultSave();
    save.team = ['goro', 'kaien', 'corrin'];
    save.story.clearedStages = ['prologue'];
    const result = parseSave(serializeSave(save));
    expect(result.status).toBe('loaded');
    expect(result.data).toEqual(save);
  });

  it('falls back to defaults for corrupted data, never throwing', () => {
    for (const raw of ['{not json', '[]', '"text"', '{}', '{"schemaVersion":"1"}']) {
      const result = parseSave(raw);
      expect(result.status).toBe('reset');
      expect(result.data).toEqual(createDefaultSave());
    }
  });

  it('repairs unknown Sovereigns, duplicates, and invalid team members', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      ownedSovereigns: ['kaien', 'kaien', 'ghost', 'maris', 'goro'],
      team: ['kaien', 'kaien', 'ghost'],
      story: { clearedStages: ['prologue', 7] },
    });
    const result = parseSave(raw);
    expect(result.status).toBe('repaired');
    expect(result.data.ownedSovereigns).toEqual(['kaien', 'maris', 'goro']);
    expect(new Set(result.data.team).size).toBe(3);
    expect(result.data.team[0]).toBe('kaien');
    for (const id of result.data.team) expect(result.data.ownedSovereigns).toContain(id);
    expect(result.data.story.clearedStages).toEqual(['prologue']);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('restores starters if too few Sovereigns are owned', () => {
    const raw = JSON.stringify({ schemaVersion: 1, ownedSovereigns: ['kaien'], team: [] });
    const result = parseSave(raw);
    expect(result.data.ownedSovereigns.length).toBeGreaterThanOrEqual(3);
    expect(new Set(result.data.team).size).toBe(3);
  });

  it('runs migrations in order from older versions', () => {
    const calls: number[] = [];
    const migrations: Record<number, Migration> = {
      1: (data) => {
        calls.push(1);
        return { ...data, addedInV2: true };
      },
      2: (data) => {
        calls.push(2);
        return { ...data, team: ['maris', 'kaien', 'torvan'] };
      },
    };
    const v1 = serializeSave(createDefaultSave());
    const result = parseSave(v1, migrations, 3);
    expect(calls).toEqual([1, 2]);
    expect(result.data.team).toEqual(['maris', 'kaien', 'torvan']);
  });

  it('resets if a migration step is missing', () => {
    const result = parseSave(serializeSave(createDefaultSave()), {}, 2);
    expect(result.status).toBe('reset');
  });

  it('refuses to adopt a save from a newer game version', () => {
    const raw = JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION + 1, team: ['x'] });
    expect(parseSave(raw).status).toBe('future');
  });
});

describe('createSaveStore', () => {
  const log = createLogger();

  it('writes a fresh save immediately and persists updates', () => {
    const storage = memoryStorage();
    const store = createSaveStore(storage, log);
    expect(storage.items[SAVE_KEY]).toBeDefined();
    store.update((data) => {
      data.team = ['torvan', 'kaien', 'maris'];
    });
    expect(parseSave(storage.items[SAVE_KEY] ?? null).data.team).toEqual([
      'torvan',
      'kaien',
      'maris',
    ]);
  });

  it('keeps earlier data snapshots immutable', () => {
    const store = createSaveStore(memoryStorage(), log);
    const before = store.data;
    store.update((data) => {
      data.story.clearedStages.push('prologue');
    });
    expect(before.story.clearedStages).toEqual([]);
    expect(store.data.story.clearedStages).toEqual(['prologue']);
  });

  it('never overwrites a save from a newer version', () => {
    const future = JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION + 1, secret: true });
    const storage = memoryStorage({ [SAVE_KEY]: future });
    const store = createSaveStore(storage, log);
    store.update((data) => {
      data.story.clearedStages.push('prologue');
    });
    expect(storage.items[SAVE_KEY]).toBe(future);
  });

  it('keeps working in memory when storage throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const store = createSaveStore(broken, log);
    store.update((data) => {
      data.story.clearedStages.push('prologue');
    });
    expect(store.data.story.clearedStages).toEqual(['prologue']);
  });

  it('works with no storage at all', () => {
    const store = createSaveStore(null, log);
    expect(store.loadStatus).toBe('new');
  });
});
