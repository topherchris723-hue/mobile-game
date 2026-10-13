import { describe, expect, it } from 'vitest';
import { DEFAULT_TEAM, STARTER_IDS } from '../../src/config/sovereigns';
import { STARTING_GEMS } from '../../src/config/summons';
import { STARTING_COINS } from '../../src/config/progression';
import { levelCap } from '../../src/game/progression';
import { createLogger } from '../../src/debug/log';
import {
  createDefaultSave,
  DEFAULT_SETTINGS,
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
      // Defaults, apart from the freshly generated summon seed.
      expect(result.data).toEqual(createDefaultSave(result.data.summons.seed));
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

  it('upgrades a real v1 save to the current version, keeping the team and progress', () => {
    const v1 = JSON.stringify({
      schemaVersion: 1,
      ownedSovereigns: ['kaien', 'maris', 'torvan', 'goro'],
      team: ['goro', 'kaien', 'maris'],
      story: { clearedStages: ['prologue'] },
    });
    const result = parseSave(v1);
    expect(result.status).toBe('loaded');
    expect(result.data.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(result.data.team).toEqual(['goro', 'kaien', 'maris']);
    expect(result.data.story.clearedStages).toEqual(['prologue']);
    expect(result.data.settings).toEqual(DEFAULT_SETTINGS);
    // v2 → v3: welcome gift + the Prologue first-clear reward earned before rewards existed.
    expect(result.data.gems).toBe(STARTING_GEMS + 100);
    // v3 → v4: welcome Coins, everyone at level 1.
    expect(result.data.coins).toBe(STARTING_COINS);
    expect(result.data.progress).toEqual({});
  });

  it('upgrades a v3 save to v4 keeping Gems, summons, and shards', () => {
    const v3 = JSON.stringify({
      schemaVersion: 3,
      ownedSovereigns: [...STARTER_IDS, 'akari'],
      team: ['akari', 'kaien', 'maris'],
      story: { clearedStages: ['prologue'] },
      settings: DEFAULT_SETTINGS,
      gems: 120,
      summons: { seed: 9, pulls: 22, pity: { standard: 4 } },
      shards: { goro: 10 },
    });
    const result = parseSave(v3);
    expect(result.status).toBe('loaded');
    expect(result.data.gems).toBe(120);
    expect(result.data.summons).toEqual({ seed: 9, pulls: 22, pity: { standard: 4 } });
    expect(result.data.shards).toEqual({ goro: 10 });
    expect(result.data.coins).toBe(STARTING_COINS);
    expect(result.data.team[0]).toBe('akari');
  });

  it('repairs level progress: clamps to the cap, drops unowned and invalid entries', () => {
    const save = createDefaultSave(3);
    const raw = JSON.parse(serializeSave(save)) as Record<string, unknown>;
    raw['progress'] = {
      kaien: { level: 999, limitBreaks: 0 },
      maris: { level: 12, limitBreaks: 9 },
      akari: { level: 5, limitBreaks: 0 },
      torvan: 'high',
      goro: { level: 20, limitBreaks: 1 },
    };
    raw['coins'] = 'lots';
    const result = parseSave(JSON.stringify(raw));
    expect(result.status).toBe('repaired');
    expect(result.data.progress).toEqual({
      kaien: { level: levelCap(4, 0), limitBreaks: 0 },
      maris: { level: 12, limitBreaks: 0 },
      goro: { level: 20, limitBreaks: 1 },
    });
    expect(result.data.coins).toBe(0);
  });

  it('upgrades a v2 save that has not cleared the Prologue to the welcome gift only', () => {
    const v2 = JSON.stringify({
      schemaVersion: 2,
      ownedSovereigns: [...STARTER_IDS],
      team: [...DEFAULT_TEAM],
      story: { clearedStages: [] },
      settings: { ...DEFAULT_SETTINGS, battleSpeed: 2 },
    });
    const result = parseSave(v2);
    expect(result.status).toBe('loaded');
    expect(result.data.gems).toBe(STARTING_GEMS);
    expect(result.data.settings.battleSpeed).toBe(2);
    expect(result.data.summons.pulls).toBe(0);
    expect(result.data.summons.pity).toEqual({});
    expect(result.data.shards).toEqual({});
    expect(Number.isInteger(result.data.summons.seed)).toBe(true);
  });

  it('repairs invalid economy fields without granting anything', () => {
    const raw = JSON.parse(serializeSave(createDefaultSave(5))) as Record<string, unknown>;
    raw['gems'] = -40;
    raw['summons'] = { seed: 'x', pulls: 3.5, pity: { standard: 999, unknownBanner: 2 } };
    raw['shards'] = { kaien: 10, ghost: 5, maris: -1 };
    const result = parseSave(JSON.stringify(raw));
    expect(result.status).toBe('repaired');
    expect(result.data.gems).toBe(0);
    expect(result.data.summons.pulls).toBe(0);
    expect(result.data.summons.pity).toEqual({});
    expect(result.data.shards).toEqual({ kaien: 10 });
  });

  it('keeps a valid economy state exactly', () => {
    const save = createDefaultSave(42);
    save.gems = 1234;
    save.summons = { seed: 42, pulls: 33, pity: { standard: 12 } };
    save.shards = { goro: 15 };
    save.ownedSovereigns.push('akari');
    const result = parseSave(serializeSave(save));
    expect(result.status).toBe('loaded');
    expect(result.data).toEqual(save);
  });

  it('repairs invalid settings to defaults', () => {
    const save = createDefaultSave();
    const raw = JSON.parse(serializeSave(save)) as Record<string, unknown>;
    raw['settings'] = { sound: 'yes', haptics: false, reduceMotion: true, battleSpeed: 7 };
    const result = parseSave(JSON.stringify(raw));
    expect(result.status).toBe('repaired');
    expect(result.data.settings).toEqual({
      sound: DEFAULT_SETTINGS.sound,
      haptics: false,
      reduceMotion: true,
      battleSpeed: DEFAULT_SETTINGS.battleSpeed,
    });
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
    // A synthetic chain (1 → 2 → 3) independent of the real schema version.
    const v1 = JSON.stringify({ ...createDefaultSave(), schemaVersion: 1 });
    const result = parseSave(v1, migrations, 3);
    expect(calls).toEqual([1, 2]);
    expect(result.data.team).toEqual(['maris', 'kaien', 'torvan']);
  });

  it('resets if a migration step is missing', () => {
    const result = parseSave(serializeSave(createDefaultSave()), {}, SAVE_SCHEMA_VERSION + 1);
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
