import { DEFAULT_TEAM, findSovereign, STARTER_IDS } from '../config/sovereigns';
import { BANNERS, MAX_GEMS, PITY_LIMIT, STARTING_GEMS } from '../config/summons';

/*
 * Save format (CLAUDE.md §10). Pure functions only: parsing, migrating, validating, and repairing
 * are unit-tested without touching browser storage.
 */

export const SAVE_SCHEMA_VERSION = 3;

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

/** Summon progress (game-design.md §6). */
export interface SummonProgress {
  /** Random per save; with `pulls` it fixes every roll, so summons can't be rerolled by reloading. */
  seed: number;
  /** Total Sovereigns ever summoned. */
  pulls: number;
  /** Per banner id: summons since the last 5★. */
  pity: Record<string, number>;
}

export interface SaveData {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  /** Recruited Sovereign ids. */
  ownedSovereigns: string[];
  /** Battle team; slot 1 leads. Always three different owned Sovereigns. */
  team: [string, string, string];
  story: { clearedStages: string[] };
  settings: Settings;
  gems: number;
  summons: SummonProgress;
  /** Per Sovereign id: shards from duplicates (spent on Limit Breaks in M7). */
  shards: Record<string, number>;
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
  /**
   * v2 → v3 (M6): Gems, summons, shards. Existing players get the welcome gift plus the Prologue
   * first-clear reward they earned before rewards existed. Values are frozen here on purpose:
   * later tuning must not change what this migration granted.
   */
  2: (data) => {
    const story = isRecord(data['story']) ? data['story'] : {};
    const clearedPrologue = stringArray(story['clearedStages']).includes('prologue');
    return {
      ...data,
      gems: 500 + (clearedPrologue ? 100 : 0),
      summons: { seed: randomSeed(), pulls: 0, pity: {} },
      shards: {},
    };
  },
};

/** A random 32-bit seed (not gameplay-critical randomness, so the platform source is fine). */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  }
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

export function createDefaultSave(seed: number = randomSeed()): SaveData {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    ownedSovereigns: [...STARTER_IDS],
    team: [...DEFAULT_TEAM],
    story: { clearedStages: [] },
    settings: { ...DEFAULT_SETTINGS },
    gems: STARTING_GEMS,
    summons: { seed, pulls: 0, pity: {} },
    shards: {},
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

  const rawGems = raw['gems'];
  let gems = 0;
  if (typeof rawGems === 'number' && Number.isFinite(rawGems) && rawGems >= 0) {
    gems = Math.min(MAX_GEMS, Math.floor(rawGems));
    if (gems !== rawGems) issues.push('Gem balance was not a whole number in range');
  } else {
    issues.push('Gem balance was invalid; set to 0');
  }

  const rawSummons = isRecord(raw['summons']) ? raw['summons'] : {};
  const wholeNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0;
  const rawSeed = rawSummons['seed'];
  let seed: number;
  if (wholeNumber(rawSeed) && rawSeed <= 0xffff_ffff) {
    seed = rawSeed;
  } else {
    seed = randomSeed();
    issues.push('Summon seed was invalid; made a new one');
  }
  const rawPulls = rawSummons['pulls'];
  const pulls = wholeNumber(rawPulls) ? rawPulls : 0;
  if (pulls !== rawPulls) issues.push('Summon count was invalid; reset');
  const rawPity = isRecord(rawSummons['pity']) ? rawSummons['pity'] : {};
  const pity: Record<string, number> = {};
  for (const banner of BANNERS) {
    const value = rawPity[banner.id];
    if (value === undefined) continue;
    if (wholeNumber(value) && value < PITY_LIMIT) pity[banner.id] = value;
    else issues.push(`Pity for "${banner.id}" was invalid; reset`);
  }

  const rawShards = isRecord(raw['shards']) ? raw['shards'] : {};
  const shards: Record<string, number> = {};
  for (const [id, value] of Object.entries(rawShards)) {
    if (findSovereign(id) && wholeNumber(value)) {
      if (value > 0) shards[id] = value;
    } else {
      issues.push(`Dropped invalid shards for "${id}"`);
    }
  }

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
    gems,
    summons: { seed, pulls, pity },
    shards,
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
