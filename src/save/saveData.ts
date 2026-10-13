import { DEFAULT_TEAM, findSovereign, STARTER_IDS } from '../config/sovereigns';

/*
 * Save format (CLAUDE.md §10). Pure functions only: parsing, migrating, validating, and repairing
 * are unit-tested without touching browser storage.
 */

export const SAVE_SCHEMA_VERSION = 2;

export type BattleSpeed = 1 | 2;

/** Player preferences (CLAUDE.md §11 accessibility). */
export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Disables screen shake and flashes (CLAUDE.md §5). */
  reduceMotion: boolean;
  battleSpeed: BattleSpeed;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  sound: true,
  haptics: true,
  reduceMotion: false,
  battleSpeed: 1,
};

export interface SaveData {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  /** Recruited Sovereign ids. */
  ownedSovereigns: string[];
  /** Battle team; slot 1 leads. Always three different owned Sovereigns. */
  team: [string, string, string];
  story: { clearedStages: string[] };
  settings: Settings;
}

export type LoadStatus =
  /** No save yet: fresh defaults. */
  | 'new'
  /** Loaded as written. */
  | 'loaded'
  /** Loaded, but some fields were invalid and were fixed. */
  | 'repaired'
  /** Unreadable: replaced with defaults. */
  | 'reset'
  /** Written by a newer game version: defaults in memory, never written back (protects it). */
  | 'future';

export interface LoadResult {
  readonly data: SaveData;
  readonly status: LoadStatus;
  readonly issues: readonly string[];
}

/** Upgrades a save from version N to N+1. Add one entry per schema change; never edit old ones. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /** v1 → v2 (M4): settings added, with defaults. */
  1: (data) => ({ ...data, settings: { ...DEFAULT_SETTINGS } }),
};

export function createDefaultSave(): SaveData {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    ownedSovereigns: [...STARTER_IDS],
    team: [...DEFAULT_TEAM],
    story: { clearedStages: [] },
    settings: { ...DEFAULT_SETTINGS },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Brings any current-version object into a valid SaveData, recording what had to be fixed. */
function repair(raw: Record<string, unknown>, issues: string[]): SaveData {
  const defaults = createDefaultSave();

  let owned = [...new Set(stringArray(raw['ownedSovereigns']))].filter((id) => {
    const known = findSovereign(id) !== undefined;
    if (!known) issues.push(`Dropped unknown Sovereign "${id}"`);
    return known;
  });
  if (owned.length < 3) {
    issues.push('Fewer than three Sovereigns owned; restored the starters');
    owned = [...new Set([...owned, ...defaults.ownedSovereigns])];
  }

  const wanted = stringArray(raw['team']);
  const team: string[] = [];
  for (const id of wanted.slice(0, 3)) {
    if (owned.includes(id) && !team.includes(id)) team.push(id);
    else issues.push(`Removed "${id}" from the team`);
  }
  for (const id of owned) {
    if (team.length >= 3) break;
    if (!team.includes(id)) team.push(id);
  }
  if (wanted.length !== 3 && team.length === 3 && wanted.length > 0) {
    issues.push('Team did not have exactly three members');
  }

  const story = isRecord(raw['story']) ? raw['story'] : {};
  const clearedStages = [...new Set(stringArray(story['clearedStages']))];

  const rawSettings = isRecord(raw['settings']) ? raw['settings'] : {};
  const flag = (key: 'sound' | 'haptics' | 'reduceMotion'): boolean => {
    const value = rawSettings[key];
    if (typeof value === 'boolean') return value;
    issues.push(`Setting "${key}" reset to default`);
    return DEFAULT_SETTINGS[key];
  };
  const speed = rawSettings['battleSpeed'];
  const settings: Settings = {
    sound: flag('sound'),
    haptics: flag('haptics'),
    reduceMotion: flag('reduceMotion'),
    battleSpeed: speed === 1 || speed === 2 ? speed : DEFAULT_SETTINGS.battleSpeed,
  };
  if (speed !== settings.battleSpeed) issues.push('Battle speed reset to default');

  const [a, b, c] = team;
  if (a === undefined || b === undefined || c === undefined) {
    throw new Error('Repair produced an incomplete team');
  }
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    ownedSovereigns: owned,
    team: [a, b, c],
    story: { clearedStages },
    settings,
  };
}

/**
 * Turns whatever is in storage into valid save data. Never throws: corrupted data falls back to
 * defaults with the reason recorded (CLAUDE.md §10).
 */
export function parseSave(
  raw: string | null,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  currentVersion: number = SAVE_SCHEMA_VERSION,
): LoadResult {
  if (raw === null || raw === '') return { data: createDefaultSave(), status: 'new', issues: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: createDefaultSave(), status: 'reset', issues: ['Save was not valid JSON'] };
  }
  if (!isRecord(parsed) || typeof parsed['schemaVersion'] !== 'number') {
    return { data: createDefaultSave(), status: 'reset', issues: ['Save had no schema version'] };
  }

  let version = parsed['schemaVersion'];
  if (version > currentVersion) {
    return {
      data: createDefaultSave(),
      status: 'future',
      issues: [`Save is from a newer version (${version} > ${currentVersion})`],
    };
  }

  let data: Record<string, unknown> = parsed;
  while (version < currentVersion) {
    const migrate = migrations[version];
    if (!migrate) {
      return {
        data: createDefaultSave(),
        status: 'reset',
        issues: [`No migration from schema version ${version}`],
      };
    }
    data = { ...migrate(data), schemaVersion: version + 1 };
    version++;
  }

  const issues: string[] = [];
  const repaired = repair(data, issues);
  return { data: repaired, status: issues.length > 0 ? 'repaired' : 'loaded', issues };
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}
