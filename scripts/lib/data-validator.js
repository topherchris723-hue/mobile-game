// Data validator for data/*.json (GDD §15). Used by `npm run validate-data` and by Vitest.
// Pure functions: everything is passed in (data objects, schemas, GDD text), nothing is read here,
// so tests can feed broken copies of the data.

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// GDD §15.1 file → schema table. The runtime save is validated separately (src/state).
export const DATA_FILES = [
  { file: 'characters.json', schema: 'characters.schema.json' },
  { file: 'cards.json', schema: 'cards.schema.json' },
  { file: 'enemies.json', schema: 'enemies.schema.json' },
  { file: 'stages.json', schema: 'stages.schema.json' },
  { file: 'story.json', schema: 'story.schema.json' },
  { file: 'banners.json', schema: 'banners.schema.json' },
  { file: 'economy.json', schema: 'economy.schema.json' },
  { file: 'battle.json', schema: 'battle.schema.json' },
  // Round 4 (GDD §17, §18): optional until the vfx-developer / audio-designer add them; absent → a notice, not an error.
  { file: 'vfx.json', schema: 'vfx.schema.json', optional: true },
  { file: 'audio.json', schema: 'audio.schema.json', optional: true },
];

export const AURAS = ['blaze', 'gale', 'stone', 'radiant', 'void'];

/**
 * Parse the banned-term list from the GDD §3 text (single source of truth, L-shared-008).
 * Returns { errorTerms: string[], warningTerms: string[] }. Throws if the list cannot be found,
 * so a reworded GDD fails loudly instead of silently disabling the scan.
 */
export function parseBannedTerms(gddText) {
  const start = gddText.indexOf('**Banned terms.**');
  if (start < 0) throw new Error('GDD §3: "**Banned terms.**" paragraph not found');
  const para = gddText.slice(start, start + 4000);
  const colon = para.indexOf(':');
  const end = para.indexOf('. ', colon);
  if (colon < 0 || end < 0) throw new Error('GDD §3: banned-term list could not be parsed');
  const listText = para.slice(colon + 1, end).replace(/\s+/g, ' ');
  const rawItems = listText.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

  // Words that GDD §3 calls "ordinary English words" are context-dependent → warnings.
  const warningTerms = [];
  const ordinary = para.match(/((?:"[^"]+"(?:,|\s+and\s+|\s)*)+)are ordinary English words/);
  if (ordinary) {
    const quoted = ordinary[1].match(/"([^"]+)"/g) || [];
    for (const q of quoted) warningTerms.push(q.replace(/"/g, '').toLowerCase());
  }

  const terms = [];
  for (const item of rawItems) {
    let text = item.replace(/\([^)]*\bas\b[^)]*\)/gi, '').trim(); // drop "(as a rarity)" etc.
    const variants = [];
    for (const part of text.split('/')) {
      const p = part.trim();
      const plural = p.match(/^(.*)\(s\)$/);
      if (plural) {
        variants.push(plural[1].trim());
        variants.push(plural[1].trim() + 's');
      } else if (p.length > 0) {
        variants.push(p);
      }
    }
    for (const v of variants) {
      const lower = v.toLowerCase();
      if (terms.indexOf(lower) < 0) terms.push(lower);
    }
  }
  if (terms.length < 20) throw new Error('GDD §3: banned-term list suspiciously short (' + terms.length + ')');
  const errorTerms = terms.filter((t) => warningTerms.indexOf(t) < 0);
  const warns = terms.filter((t) => warningTerms.indexOf(t) >= 0);
  return { errorTerms: errorTerms, warningTerms: warns, nameOnlyTerms: parseNameOnlyTerms(gddText) };
}

/**
 * Parse the GDD §3 "Name-only banned terms" list (§15.3 rule 9): the backticked words in the first
 * sentence of that paragraph, e.g. `Spark` and `Sparks`. Throws if the paragraph is missing, so the
 * check fails closed.
 */
export function parseNameOnlyTerms(gddText) {
  const start = gddText.indexOf('**Name-only banned terms');
  if (start < 0) throw new Error('GDD §3: "**Name-only banned terms" paragraph not found');
  const para = gddText.slice(start, start + 2000);
  const head = para.indexOf('**', 2);
  const end = para.indexOf('are banned', head);
  if (head < 0 || end < 0) throw new Error('GDD §3: name-only banned-term list could not be parsed');
  const quoted = para.slice(head + 2, end).match(/`([^`]+)`/g) || [];
  const terms = [];
  for (const q of quoted) {
    const t = q.replace(/`/g, '').trim().toLowerCase();
    if (t.length > 0 && terms.indexOf(t) < 0) terms.push(t);
  }
  if (terms.length === 0) throw new Error('GDD §3: name-only banned-term list is empty');
  return terms;
}

// GDD §15.3 rule 9: fields that are names (checked at any depth, in every data file).
export const NAME_FIELDS = ['name', 'name_override', 'epithet'];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a case-insensitive whole-word matcher. Underscores count as separators (IDs, asset keys). */
function termRegex(term) {
  const words = term.split(/\s+/).map(escapeRegex).join('[\\s_-]+');
  return new RegExp('(^|[^a-z0-9])(' + words + ')(?=$|[^a-z0-9])', 'i');
}

/** Visit every string value stored under a key in `keys` (any depth), calling fn(path, string). */
function walkNamedStrings(value, path, keys, fn) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) walkNamedStrings(value[i], path + '[' + i + ']', keys, fn);
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      const v = value[k];
      if (keys.indexOf(k) >= 0 && typeof v === 'string') fn(path + '.' + k, v);
      else walkNamedStrings(v, path + '.' + k, keys, fn);
    }
  }
}

/** Visit every string value in a JSON value, calling fn(path, string). */
function walkStrings(value, path, fn) {
  if (typeof value === 'string') {
    fn(path, value);
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) walkStrings(value[i], path + '[' + i + ']', fn);
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) walkStrings(value[k], path + '.' + k, fn);
  }
}

// ---------------------------------------------------------------- GDD §15.3 rules 10–12 (round 3)
// Balance limits. Ranges are inclusive and compared with tolerance 1e-9. They apply to data/ only, never to
// FX-GDD (GDD §15.4), which keeps its frozen round-2 values.

export const BALANCE_TOLERANCE = 1e-9;

// Rule 10: GDD §6 character bands by rarity.
export const CHARACTER_BANDS = {
  3: { hp: [16000, 18000], atk: [850, 950], def: [400, 480], crit_rate: [0.05, 0.05] },
  4: { hp: [18000, 20000], atk: [950, 1050], def: [450, 530], crit_rate: [0.05, 0.08] },
  5: { hp: [20000, 22000], atk: [1050, 1150], def: [500, 580], crit_rate: [0.05, 0.10] },
};

// Rule 11: GDD §6 Ignition limits (errors), plus warning bands for the two time/HP triggers.
export const IGNITION_LIMITS = {
  stat_mult_atk: [1.2, 1.4], stat_mult_def: [1.1, 1.3], duration_s: [20, 30], heal_pct: [0.05, 0.15],
  vigor_regen_bonus: [0, 0.3],
};
export const IGNITION_TRIGGER_WARN = { hp_below_pct: [40, 60], battle_time_s: [60, 100] };

// Rule 12: GDD §7 card budgets by type. power: [lo, hi] before the −0.3 per effect; signature uses × cost.
export const CARD_BUDGETS = {
  fist: { cost: [2, 2], power: [1.0, 1.3], hits: [1, 3], windup_s: [0.10, 0.20], recovery_s: [0.25, 0.35], hitstun_s: [0.55, 0.70], knockback: [2, 6] },
  bolt: { cost: [3, 3], power: [1.4, 1.7], hits: [1, 5], windup_s: [0.20, 0.35], windup_beam_s: [0.35, 0.50], recovery_s: [0.30, 0.40], hitstun_s: [0.50, 0.70], knockback: [6, 12] },
  signature: { cost: [4, 6], power_per_cost: [0.55, 0.65], hits: [1, 6], windup_s: [0.25, 0.50], recovery_s: [0.35, 0.50], hitstun_s: [0.70, 0.90], knockback: [6, 15] },
  climax: { cost: [7, 8], power: [5.0, 6.0], power_ignition: [6.5, 7.5], hits: [3, 10], windup_s: [0.60, 0.80], recovery_s: [0.50, 0.70], hitstun_s: [1.0, 1.0], knockback: [20, 30], cinematic_s: [1.5, 3.0] },
};
export const CARD_COMMON_LIMITS = { hit_interval_s: [0.05, 0.25], projectile_speed: [120, 200] };
export const EFFECT_POWER_STEP = 0.3;

/** Round a computed bound for display (2.4500000000000002 → 2.45). */
function shownNum(x) {
  return Math.round(x * 1e6) / 1e6;
}

/** True when v is a number inside [lo, hi] with the §15.3 tolerance. */
function inRange(v, lo, hi) {
  return typeof v === 'number' && v >= lo - BALANCE_TOLERANCE && v <= hi + BALANCE_TOLERANCE;
}

/**
 * GDD §15.3 rules 10–12 on the parsed data. err(rule, file, path, message) / warn(...) receive each finding.
 * Messages start with "<file> <record id>: <field> <value> outside [lo, hi]" (GDD §15.3 error text).
 */
export function validateBalance(data, err, warn) {
  const list = (file, key) => (data[file] && Array.isArray(data[file][key]) ? data[file][key] : []);
  const characters = list('characters.json', 'characters');
  const cards = list('cards.json', 'cards');

  // ---- Rule 10: character bands ----
  characters.forEach((ch, i) => {
    if (!ch || !ch.base_stats) return;
    const p = 'characters[' + i + '](' + ch.id + ')';
    const band = Object.prototype.hasOwnProperty.call(CHARACTER_BANDS, ch.rarity) ? CHARACTER_BANDS[ch.rarity] : null;
    if (!band) { err('10-character-bands', 'characters.json', p + '.rarity', 'characters.json ' + ch.id + ': rarity ' + ch.rarity + ' has no §6 band'); return; }
    for (const field of ['hp', 'atk', 'def', 'crit_rate']) {
      const v = ch.base_stats[field];
      const r = band[field];
      if (!inRange(v, r[0], r[1])) {
        err('10-character-bands', 'characters.json', p + '.base_stats.' + field,
          'characters.json ' + ch.id + ': ' + field + ' ' + v + ' outside [' + r[0] + ', ' + r[1] + '] (★' + ch.rarity + ')');
      }
    }
  });

  // ---- Rule 11: Ignition limits ----
  characters.forEach((ch, i) => {
    if (!ch || !ch.ignition) return;
    const ig = ch.ignition;
    const p = 'characters[' + i + '](' + ch.id + ').ignition';
    const L = IGNITION_LIMITS;
    const check = (field, v, r) => {
      if (!inRange(v, r[0], r[1])) {
        err('11-ignition', 'characters.json', p + '.' + field, 'characters.json ' + ch.id + ': ignition.' + field + ' ' + v + ' outside [' + r[0] + ', ' + r[1] + ']');
      }
    };
    const sm = ig.stat_mult || {};
    check('stat_mult.atk', sm.atk, L.stat_mult_atk);
    check('stat_mult.def', sm.def, L.stat_mult_def);
    check('duration_s', ig.duration_s, L.duration_s);
    check('heal_pct', ig.heal_pct, L.heal_pct);
    check('vigor_regen_bonus', ig.vigor_regen_bonus, L.vigor_regen_bonus);
    const triggers = Array.isArray(ig.triggers) ? ig.triggers : [];
    let hasTimeOrHp = false;
    triggers.forEach((t, j) => {
      if (!t) return;
      if (!Object.prototype.hasOwnProperty.call(IGNITION_TRIGGER_WARN, t.type)) return;
      hasTimeOrHp = true;
      const r = IGNITION_TRIGGER_WARN[t.type];
      if (!inRange(t.value, r[0], r[1])) {
        warn('11-ignition', 'characters.json', p + '.triggers[' + j + ']',
          'characters.json ' + ch.id + ': ignition trigger ' + t.type + ' ' + t.value + ' outside [' + r[0] + ', ' + r[1] + '] (warning)');
      }
    });
    if (!hasTimeOrHp) {
      err('11-ignition', 'characters.json', p + '.triggers', 'characters.json ' + ch.id + ': ignition needs a hp_below_pct or battle_time_s trigger');
    }
  });

  // ---- Rule 12: card budgets ----
  // Which climaxes are Ignition Climaxes: in at least one ignition.deck and in no base deck.
  const inBase = {};
  const inIgnition = {};
  for (const ch of characters) {
    if (!ch) continue;
    for (const e of Array.isArray(ch.deck) ? ch.deck : []) if (e) inBase[e.card_id] = true;
    if (ch.ignition && Array.isArray(ch.ignition.deck)) for (const e of ch.ignition.deck) if (e) inIgnition[e.card_id] = true;
  }
  const has = (map, id) => Object.prototype.hasOwnProperty.call(map, id);
  cards.forEach((c, i) => {
    if (!c) return;
    const p = 'cards[' + i + '](' + c.id + ')';
    const B = Object.prototype.hasOwnProperty.call(CARD_BUDGETS, c.type) ? CARD_BUDGETS[c.type] : null;
    if (!B) return; // unknown type is a schema error
    const fail = (field, v, lo, hi, ctx) => {
      err('12-card-budgets', 'cards.json', p + '.' + field,
        'cards.json ' + c.id + ': ' + field + ' ' + v + ' outside [' + shownNum(lo) + ', ' + shownNum(hi) + '] (' + ctx + ')');
    };
    const range = (field, r, ctx) => {
      if (!inRange(c[field], r[0], r[1])) fail(field, c[field], r[0], r[1], ctx || c.type);
    };
    const e = Array.isArray(c.effects) ? c.effects.length : 0;
    const effText = e + (e === 1 ? ' effect' : ' effects');
    range('cost', B.cost);
    let lo;
    let hi;
    let ctx;
    if (c.type === 'signature') {
      lo = B.power_per_cost[0] * c.cost; hi = B.power_per_cost[1] * c.cost; ctx = 'signature cost ' + c.cost + ', ' + effText;
    } else if (c.type === 'climax') {
      const ignitionClimax = has(inIgnition, c.id) && !has(inBase, c.id);
      if (has(inIgnition, c.id) && has(inBase, c.id)) {
        err('12-card-budgets', 'cards.json', p, 'cards.json ' + c.id + ': climax is in both a base deck and an ignition deck');
      }
      const r = ignitionClimax ? B.power_ignition : B.power;
      lo = r[0]; hi = r[1]; ctx = (ignitionClimax ? 'Ignition Climax' : 'climax') + ', ' + effText;
    } else {
      lo = B.power[0]; hi = B.power[1]; ctx = c.type + ', ' + effText;
    }
    lo -= EFFECT_POWER_STEP * e;
    hi -= EFFECT_POWER_STEP * e;
    if (!inRange(c.power, lo, hi)) fail('power', c.power, lo, hi, ctx);
    range('hits', B.hits);
    if (c.type === 'bolt' && c.delivery === 'beam') range('windup_s', B.windup_beam_s, 'bolt beam');
    else range('windup_s', B.windup_s, c.type === 'bolt' ? 'bolt ' + c.delivery : c.type);
    range('recovery_s', B.recovery_s);
    range('hitstun_s', B.hitstun_s);
    range('knockback', B.knockback);
    range('hit_interval_s', CARD_COMMON_LIMITS.hit_interval_s, 'all types');
    if (c.projectile_speed !== undefined) range('projectile_speed', CARD_COMMON_LIMITS.projectile_speed, 'all types');
    if (c.type === 'climax') range('cinematic_s', B.cinematic_s);
  });
}

// ---------------------------------------------------------------- GDD §15.3 rules 13–15 (round 4, ruling R4-6)

export const AUDIO_LICENSES = ['CC0', 'self-made'];
export const CINEMATIC_EVENTS = ['ignition', 'tri_burst', 'ko', 'climax_cinematic'];

/**
 * Parse the asset table(s) of assets/CREDITS.md: every table whose header has "File" and "License" columns.
 * Returns [{ file, license }] with backticks and spaces stripped; header, separator and "—" placeholder rows skipped.
 */
export function parseCreditsRows(text) {
  const rows = [];
  let fileCol = -1;
  let licCol = -1;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (line.indexOf('|') !== 0) { fileCol = -1; licCol = -1; continue; }
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim().replace(/`/g, '').trim());
    if (fileCol < 0) {
      const f = cells.indexOf('File');
      const l = cells.indexOf('License');
      if (f >= 0 && l >= 0) { fileCol = f; licCol = l; }
      continue;
    }
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    const file = cells[fileCol] || '';
    if (file === '' || file === '—' || file === '-') continue;
    rows.push({ file: file, license: cells[licCol] || '' });
  }
  return rows;
}

/**
 * Read `export const NAME = [ 'a', "b", ... ]` from JS source text (no import, so no DOM/Phaser side effects).
 * Returns the string list, or null if the export is not a literal string array.
 */
export function parseExportedStringList(src, name) {
  const re = new RegExp('export\\s+const\\s+' + name + '\\s*=\\s*(?:Object\\.freeze\\()?\\[([\\s\\S]*?)\\]');
  const m = String(src || '').match(re);
  if (!m) return null;
  const body = m[1].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const lit = /'([^'\\]*)'|"([^"\\]*)"/g;
  let x;
  while ((x = lit.exec(body)) !== null) out.push(x[1] !== undefined ? x[1] : x[2]);
  const rest = body.replace(lit, '').replace(/[\s,]/g, '');
  return rest === '' ? out : null;
}

/** '#rrggbb' → { r, g, b } or null. */
function hexRgb(h) {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(String(h));
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

/** §15.3 rule 14: saturated red = r ≥ 200, g ≤ 80, b ≤ 80. */
export function isSaturatedRed(h) {
  const c = hexRgb(h);
  return !!c && c.r >= 200 && c.g <= 80 && c.b <= 80;
}

/** Resolve a vfx color ref to [{ hex, label }] through vfx.json → colors (tokens may stand for several colors). */
function resolveColors(ref, colors) {
  const c = colors || {};
  const map = (obj, label) => Object.keys(obj || {}).map((k) => ({ hex: obj[k], label: label + '.' + k }));
  if (typeof ref !== 'string') return [];
  if (ref.charAt(0) === '#') return [{ hex: ref, label: ref }];
  if (ref === 'aura' || ref === 'member_aura' || ref === 'target_aura') return map(c.aura, 'aura');
  if (ref === 'card_type') return map(c.card_type, 'card_type');
  if (ref === 'rarity') return map(c.rarity, 'rarity');
  if (ref === 'white') return [{ hex: c.white, label: 'white' }];
  return [];
}

/**
 * Rules 13–15 on data['audio.json'] / data['vfx.json'] (each skipped when absent).
 * opts: credits (CREDITS.md text), fileExists(repoPath) → bool, listVfxFiles() → ['assets/vfx/…'],
 * sfxHooks / vfxEventKeys (the UI's exported lists, or null to skip those coverage warnings).
 */
export function validateMedia(data, err, warn, notice, opts) {
  const audio = data['audio.json'];
  const vfx = data['vfx.json'];
  if (!audio && !vfx) return;
  const R13 = '13-licensing';
  const R14 = '14-flash-safety';
  const R15 = '15-key-coverage';
  const own = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
  const credits = parseCreditsRows(opts.credits);
  const hasRow = (file, lics) => credits.some((r) => r.file === file && lics.indexOf(r.license) >= 0);
  const exists = typeof opts.fileExists === 'function' ? opts.fileExists : () => false;
  const list = (file, key) => (data[file] && Array.isArray(data[file][key]) ? data[file][key] : []);
  const cards = list('cards.json', 'cards');
  const characters = list('characters.json', 'characters');

  // ---- audio.json ----
  if (audio && audio.sounds && typeof audio.sounds === 'object') {
    const sounds = audio.sounds;
    let procedural = false;
    for (const k of Object.keys(sounds)) {
      const snd = sounds[k] || {};
      const p = '.sounds.' + k;
      if (snd.source === 'procedural') procedural = true;
      if (snd.source === 'file') {
        if (AUDIO_LICENSES.indexOf(snd.license) < 0) err(R13, 'audio.json', p + '.license', 'audio.json ' + k + ': license "' + snd.license + '" not allowed (CC0 or self-made only)');
        if (typeof snd.path !== 'string' || !exists(snd.path)) err(R13, 'audio.json', p + '.path', 'audio.json ' + k + ': path "' + snd.path + '" does not exist');
        if (!hasRow(snd.path, [snd.license])) err(R13, 'audio.json', p, 'audio.json ' + k + ': no assets/CREDITS.md row with File "' + snd.path + '" and License "' + snd.license + '"');
      }
      if (snd.pattern && Array.isArray(snd.pattern.tracks)) {
        snd.pattern.tracks.forEach((t, i) => {
          const n = t && Array.isArray(t.notes) ? t.notes.length : -1;
          if (n !== snd.pattern.steps) err(R13, 'audio.json', p + '.pattern.tracks[' + i + '].notes', 'audio.json ' + k + ': pattern track ' + i + ' notes has ' + n + ' entries, steps is ' + snd.pattern.steps);
        });
      }
    }
    if (procedural && !hasRow('data/audio.json', ['self-made'])) {
      err(R13, 'audio.json', '.sounds', 'audio.json: procedural sounds need an assets/CREDITS.md row with File "data/audio.json" and License "self-made"');
    }
    for (const ctx of Object.keys(audio.music || {})) {
      const v = audio.music[ctx];
      if (!own(sounds, v)) err(R13, 'audio.json', '.music.' + ctx, 'audio.json: music.' + ctx + ' names "' + v + '", which is not in sounds');
    }
    for (const h of Object.keys(audio.hooks || {})) {
      const v = audio.hooks[h];
      if (v !== null && !own(sounds, v)) err(R13, 'audio.json', '.hooks.' + h, 'audio.json: hooks.' + h + ' names "' + v + '", which is not in sounds');
    }
    // ---- rule 15 (audio side) ----
    list('stages.json', 'stages').forEach((st) => {
      if (st && st.bgm && !own(sounds, st.bgm)) warn(R15, 'stages.json', '.stages(' + st.id + ').bgm', 'stages.json ' + st.id + ': bgm "' + st.bgm + '" not in audio.json sounds (falls back to music.battle_default)');
    });
    list('story.json', 'scenes').forEach((sc) => {
      if (sc && sc.bgm && !own(sounds, sc.bgm)) warn(R15, 'story.json', '.scenes(' + sc.id + ').bgm', 'story.json ' + sc.id + ': bgm "' + sc.bgm + '" not in audio.json sounds');
    });
    cards.forEach((c) => {
      if (c && c.sfx && !own(sounds, c.sfx)) warn(R15, 'cards.json', '.cards(' + c.id + ').sfx', 'cards.json ' + c.id + ': sfx "' + c.sfx + '" not in audio.json sounds (falls back to the hook)');
    });
    if (Array.isArray(opts.sfxHooks)) {
      for (const h of Object.keys(audio.hooks || {})) {
        if (opts.sfxHooks.indexOf(h) < 0) warn(R15, 'audio.json', '.hooks.' + h, 'audio.json: hooks key "' + h + '" is not in SFX_HOOKS');
      }
    } else {
      notice('SFX_HOOKS list not found (src/ui/feedback.js): audio hook-key coverage warnings skipped');
    }
  }

  // ---- vfx.json ----
  if (vfx && vfx.effects && typeof vfx.effects === 'object') {
    const L = vfx.limits || {};
    const effects = vfx.effects;
    const vfxFiles = typeof opts.listVfxFiles === 'function' ? opts.listVfxFiles() : [];
    const battle = data['battle.json'] || {};
    const sec = (o, k) => (o && typeof o[k] === 'number' ? Math.round(o[k] * 1000) : null);
    // Cinematic limits per effect id: from the event mapping, card art.vfx (climax) and ignition.art.vfx.
    const limits = {};
    const addLimit = (id, ms, label) => {
      if (ms === null || !own(effects, id)) return;
      if (!own(limits, id) || ms < limits[id].ms) limits[id] = { ms: ms, label: label };
    };
    let minClimax = null;
    for (const c of cards) if (c && c.type === 'climax' && typeof c.cinematic_s === 'number') minClimax = minClimax === null ? Math.round(c.cinematic_s * 1000) : Math.min(minClimax, Math.round(c.cinematic_s * 1000));
    const eventLimit = {
      ignition: sec(battle.ignition, 'cinematic_s'), tri_burst: sec(battle.burst, 'cinematic_s'),
      ko: sec(battle.ko, 'anim_s'), climax_cinematic: minClimax,
    };
    for (const ev of Object.keys(vfx.events || {})) {
      const base = ev.split('.')[0];
      if (CINEMATIC_EVENTS.indexOf(base) < 0) continue;
      for (const id of vfx.events[ev] || []) addLimit(id, eventLimit[base], base + ' cinematic');
    }
    for (const c of cards) if (c && c.type === 'climax' && c.art && c.art.vfx) addLimit(c.art.vfx, sec(c, 'cinematic_s'), c.id + ' cinematic');
    for (const ch of characters) if (ch && ch.ignition && ch.ignition.art && ch.ignition.art.vfx) addLimit(ch.ignition.art.vfx, eventLimit.ignition, 'ignition cinematic');

    for (const id of Object.keys(effects)) {
      const ef = effects[id] || {};
      const p = '.effects.' + id;
      const layers = Array.isArray(ef.layers) ? ef.layers : [];
      const flashStarts = [];
      layers.forEach((ly, i) => {
        if (!ly) return;
        const lp = p + '.layers[' + i + ']';
        if (ly.kind === 'screen_flash') {
          flashStarts.push(ly.start_ms);
          if (typeof L.max_flash_alpha === 'number' && ly.alpha > L.max_flash_alpha) err(R14, 'vfx.json', lp + '.alpha', 'vfx.json ' + id + ': screen_flash alpha ' + ly.alpha + ' > max_flash_alpha ' + L.max_flash_alpha);
          for (const c of resolveColors(ly.color, vfx.colors)) {
            if (isSaturatedRed(c.hex)) err(R14, 'vfx.json', lp + '.color', 'vfx.json ' + id + ': screen_flash color is saturated red ' + c.hex + (c.label !== c.hex ? ' (' + c.label + ')' : ''));
          }
        }
        if (ly.kind === 'shake') {
          if (typeof L.max_shake_intensity === 'number' && ly.intensity > L.max_shake_intensity) err(R14, 'vfx.json', lp + '.intensity', 'vfx.json ' + id + ': shake intensity ' + ly.intensity + ' > max_shake_intensity ' + L.max_shake_intensity);
          if (typeof L.max_shake_ms === 'number' && ly.duration_ms > L.max_shake_ms) err(R14, 'vfx.json', lp + '.duration_ms', 'vfx.json ' + id + ': shake duration_ms ' + ly.duration_ms + ' > max_shake_ms ' + L.max_shake_ms);
        }
        if (ly.texture) {
          const file = vfxFiles.find((f) => f.replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '') === ly.texture);
          if (file && !hasRow(file, AUDIO_LICENSES)) err(R13, 'vfx.json', lp + '.texture', 'vfx.json ' + id + ': texture "' + ly.texture + '" maps to ' + file + ', which has no assets/CREDITS.md row with License CC0 or self-made');
        }
      });
      const maxF = typeof L.max_screen_flashes_per_s === 'number' ? L.max_screen_flashes_per_s : 3;
      flashStarts.sort((a, b) => a - b);
      for (let i = 0; i < flashStarts.length; i++) {
        let n = 0;
        for (let j = i; j < flashStarts.length && flashStarts[j] < flashStarts[i] + 1000; j++) n += 1;
        if (n > maxF) {
          err(R14, 'vfx.json', p + '.layers', 'vfx.json ' + id + ': ' + n + ' screen_flash layers start within 1000 ms (from ' + flashStarts[i] + ' ms; max ' + maxF + ')');
          break;
        }
      }
      if (own(limits, id) && typeof ef.duration_ms === 'number' && ef.duration_ms > limits[id].ms) {
        err(R14, 'vfx.json', p + '.duration_ms', 'vfx.json ' + id + ': duration_ms ' + ef.duration_ms + ' > ' + limits[id].ms + ' (' + limits[id].label + ')');
      }
    }
    // ---- rule 15 (vfx side) ----
    cards.forEach((c) => {
      if (c && c.art && c.art.vfx && !own(effects, c.art.vfx)) warn(R15, 'cards.json', '.cards(' + c.id + ').art.vfx', 'cards.json ' + c.id + ': art.vfx "' + c.art.vfx + '" not in vfx.json effects (default effect plays)');
    });
    characters.forEach((ch) => {
      const k = ch && ch.ignition && ch.ignition.art ? ch.ignition.art.vfx : null;
      if (k && !own(effects, k)) warn(R15, 'characters.json', '.characters(' + ch.id + ').ignition.art.vfx', 'characters.json ' + ch.id + ': ignition.art.vfx "' + k + '" not in vfx.json effects (default effect plays)');
    });
    if (Array.isArray(opts.vfxEventKeys)) {
      for (const ev of Object.keys(vfx.events || {})) {
        if (opts.vfxEventKeys.indexOf(ev) < 0) warn(R15, 'vfx.json', '.events.' + ev, 'vfx.json: events key "' + ev + '" is not in VFX_EVENT_KEYS');
      }
    } else {
      notice('VFX_EVENT_KEYS list not found (src/ui/vfx/): vfx event-key coverage warnings skipped');
    }
  }
}

/**
 * Validate the whole data set.
 * @param data    { 'cards.json': object, ... } parsed data files (missing file = error)
 * @param schemas { 'cards.schema.json': object, ... }
 * @param banned  result of parseBannedTerms
 * @param extraFiles names of data/*.json files not listed in GDD §15.1 (reported as errors)
 * @param options { balance: true } — false skips §15.3 rules 10–12 (FX-GDD, GDD §15.4); plus the rule 13–15 inputs
 *                (see validateMedia): credits, fileExists, listVfxFiles, sfxHooks, vfxEventKeys
 * @returns { errors: [{rule, file, path, message}], warnings: [...], notices: [string] }
 */
export function validateDataset(data, schemas, banned, extraFiles, options) {
  const balance = !(options && options.balance === false);
  const errors = [];
  const warnings = [];
  const err = (rule, file, path, message) => errors.push({ rule: rule, file: file, path: path, message: message });
  const warn = (rule, file, path, message) => warnings.push({ rule: rule, file: file, path: path, message: message });
  const notices = [];

  for (const f of extraFiles || []) err('files', f, '', 'data file not listed in GDD §15.1');

  // ---- Schema validation (Ajv, JSON Schema 2020-12) ----
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  let schemaOk = true;
  for (const entry of DATA_FILES) {
    const schema = schemas[entry.schema];
    const doc = data[entry.file];
    if (doc === undefined && entry.optional) { notices.push(entry.file + ' not present (optional until it is created); its checks are skipped'); continue; }
    if (!schema) { err('schema', entry.schema, '', 'schema file missing'); schemaOk = false; continue; }
    if (doc === undefined) { err('schema', entry.file, '', 'data file missing'); schemaOk = false; continue; }
    let validate;
    try {
      validate = ajv.compile(schema);
    } catch (e) {
      err('schema', entry.schema, '', 'schema does not compile: ' + e.message);
      schemaOk = false;
      continue;
    }
    if (!validate(doc)) {
      schemaOk = false;
      for (const e of validate.errors) {
        err('schema', entry.file, e.instancePath || '/', e.message + (e.params ? ' ' + JSON.stringify(e.params) : ''));
      }
    }
  }

  // Cross-file checks need the basic shapes; guard every access so broken data reports, never crashes.
  const arr = (file, key) => {
    const d = data[file];
    return d && Array.isArray(d[key]) ? d[key] : [];
  };
  const characters = arr('characters.json', 'characters');
  const cards = arr('cards.json', 'cards');
  const enemies = arr('enemies.json', 'enemies');
  const chapters = arr('stages.json', 'chapters');
  const stages = arr('stages.json', 'stages');
  const scenes = arr('story.json', 'scenes');
  const banners = arr('banners.json', 'banners');
  const currencies = arr('economy.json', 'currencies');
  const economy = data['economy.json'] || {};
  const battle = data['battle.json'] || {};

  // ---- Rule 1: unique IDs within each collection ----
  const indexById = (list, file, label) => {
    const map = {};
    list.forEach((item, i) => {
      const id = item && item.id;
      if (typeof id !== 'string') { err('1-unique-ids', file, label + '[' + i + ']', 'missing id'); return; }
      if (map[id]) err('1-unique-ids', file, label + '[' + i + ']', 'duplicate id ' + id);
      else map[id] = item;
    });
    return map;
  };
  const charById = indexById(characters, 'characters.json', 'characters');
  const cardById = indexById(cards, 'cards.json', 'cards');
  const enemyById = indexById(enemies, 'enemies.json', 'enemies');
  const chapterById = indexById(chapters, 'stages.json', 'chapters');
  const stageById = indexById(stages, 'stages.json', 'stages');
  const sceneById = indexById(scenes, 'story.json', 'scenes');
  indexById(banners, 'banners.json', 'banners');
  const currencyById = indexById(currencies, 'economy.json', 'currencies');
  const missions = [];
  stages.forEach((s) => { if (s && Array.isArray(s.missions)) for (const m of s.missions) missions.push(m); });
  indexById(missions, 'stages.json', 'missions');

  // ---- Rule 2: references exist ----
  const ref = (map, id, file, path, what) => {
    if (typeof id !== 'string' || !map[id]) err('2-references', file, path, what + ' "' + id + '" does not exist');
  };
  const checkReward = (r, path) => {
    if (!r) return;
    if (r.type === 'currency') ref(currencyById, r.currency_id, 'stages.json', path, 'currency');
    if (r.type === 'character') ref(charById, r.character_id, 'stages.json', path, 'character');
  };
  const aiTiers = battle.ai_tiers || {};

  // ---- Rule 3: deck rules ----
  const hand = battle.hand || {};
  const deckMin = typeof hand.deck_min === 'number' ? hand.deck_min : 6;
  const deckMax = typeof hand.deck_max === 'number' ? hand.deck_max : 10;
  const maxCopies = typeof hand.max_copies === 'number' ? hand.max_copies : 3;
  const maxClimax = typeof hand.max_climax === 'number' ? hand.max_climax : 1;
  const checkDeck = (ch, deck, path) => {
    if (!Array.isArray(deck)) { err('3-deck', 'characters.json', path, 'deck missing'); return; }
    let total = 0;
    let climax = 0;
    deck.forEach((entry, i) => {
      const p = path + '[' + i + ']';
      const count = entry && typeof entry.count === 'number' ? entry.count : 0;
      total += count;
      if (count > maxCopies) err('3-deck', 'characters.json', p, entry.card_id + ' has ' + count + ' copies (max ' + maxCopies + ')');
      const card = entry ? cardById[entry.card_id] : null;
      if (!card) { ref(cardById, entry && entry.card_id, 'characters.json', p, 'card'); return; }
      if (card.type === 'climax') climax += count;
      if (card.owner !== ch.id && card.owner !== 'common') {
        err('3-deck', 'characters.json', p, card.id + ' is owned by ' + card.owner + ', not ' + ch.id + ' or common');
      }
    });
    if (total < deckMin || total > deckMax) err('3-deck', 'characters.json', path, 'deck has ' + total + ' cards (allowed ' + deckMin + '–' + deckMax + ')');
    if (climax > maxClimax) err('3-deck', 'characters.json', path, 'deck has ' + climax + ' Climax cards (max ' + maxClimax + ')');
  };
  characters.forEach((ch, i) => {
    if (!ch) return;
    const p = 'characters[' + i + '](' + ch.id + ')';
    checkDeck(ch, ch.deck, p + '.deck');
    if (ch.ignition) checkDeck(ch, ch.ignition.deck, p + '.ignition.deck');
  });

  enemies.forEach((e, i) => {
    if (!e) return;
    const p = 'enemies[' + i + '](' + e.id + ')';
    ref(charById, e.character_id, 'enemies.json', p + '.character_id', 'character');
    if (!aiTiers[e.ai_tier]) err('2-references', 'enemies.json', p + '.ai_tier', 'ai tier "' + e.ai_tier + '" not in battle.json ai_tiers');
  });
  stages.forEach((s, i) => {
    if (!s) return;
    const p = 'stages[' + i + '](' + s.id + ')';
    ref(chapterById, s.chapter_id, 'stages.json', p + '.chapter_id', 'chapter');
    (s.enemy_team || []).forEach((id, j) => ref(enemyById, id, 'stages.json', p + '.enemy_team[' + j + ']', 'enemy'));
    if (s.unlock_requires !== null && s.unlock_requires !== undefined) ref(stageById, s.unlock_requires, 'stages.json', p + '.unlock_requires', 'stage');
    if (s.story) {
      if (s.story.pre !== null && s.story.pre !== undefined) ref(sceneById, s.story.pre, 'stages.json', p + '.story.pre', 'scene');
      if (s.story.post !== null && s.story.post !== undefined) ref(sceneById, s.story.post, 'stages.json', p + '.story.post', 'scene');
    }
    if (s.rewards) {
      (s.rewards.first_clear || []).forEach((r, j) => checkReward(r, p + '.rewards.first_clear[' + j + ']'));
      (s.rewards.repeat_clear || []).forEach((r, j) => checkReward(r, p + '.rewards.repeat_clear[' + j + ']'));
    }
    (s.missions || []).forEach((m, j) => checkReward(m && m.reward, p + '.missions[' + j + '].reward'));
  });
  scenes.forEach((sc, i) => {
    if (!sc) return;
    (sc.lines || []).forEach((line, j) => {
      if (!line) return;
      const sp = line.speaker;
      if (sp !== 'narrator' && sp !== 'npc') ref(charById, sp, 'story.json', 'scenes[' + i + '](' + sc.id + ').lines[' + j + '].speaker', 'speaker character');
    });
  });

  // ---- Rule 4: banners ----
  banners.forEach((b, i) => {
    if (!b) return;
    const p = 'banners[' + i + '](' + b.id + ')';
    ref(currencyById, b.currency_id, 'banners.json', p + '.currency_id', 'currency');
    const rates = b.rates_bp || {};
    let sum = 0;
    for (const k of Object.keys(rates)) sum += rates[k];
    if (sum !== 10000) err('4-banner', 'banners.json', p + '.rates_bp', 'rates sum to ' + sum + ', not 10000');
    const pool = Array.isArray(b.pool) ? b.pool : [];
    const featured = Array.isArray(b.featured) ? b.featured : [];
    pool.forEach((id, j) => {
      const ch = charById[id];
      if (!ch) ref(charById, id, 'banners.json', p + '.pool[' + j + ']', 'pool character');
      else if (ch.playable !== true) err('4-banner', 'banners.json', p + '.pool[' + j + ']', id + ' is not playable');
    });
    featured.forEach((f, j) => {
      const id = f && f.character_id;
      const ch = charById[id];
      if (!ch) ref(charById, id, 'banners.json', p + '.featured[' + j + ']', 'featured character');
      else if (ch.playable !== true) err('4-banner', 'banners.json', p + '.featured[' + j + ']', id + ' is not playable');
      if (pool.indexOf(id) < 0) err('4-banner', 'banners.json', p + '.featured[' + j + ']', id + ' is featured but not in pool');
    });
    // GDD §15.3 rule 4 (round 3): ★5 always counts as "a rarity with a rate > 0", because hard pity can force a ★5
    // even when rates_bp["5"] is 0. AC-11.14.
    const rarityKeys = Object.keys(rates);
    if (rarityKeys.indexOf('5') < 0) rarityKeys.push('5');
    for (const rarityKey of rarityKeys) {
      const rarity = Number(rarityKey);
      const inPool = pool.filter((id) => charById[id] && charById[id].rarity === rarity);
      const feat = featured.filter((f) => f && charById[f.character_id] && charById[f.character_id].rarity === rarity);
      let share = 0;
      for (const f of feat) share += f.share_bp;
      const nonFeatured = inPool.filter((id) => !feat.some((f) => f.character_id === id));
      if (share > 10000) err('4-banner', 'banners.json', p + '.featured', 'rarity ' + rarity + ' featured shares sum to ' + share + ' (> 10000)');
      if (rates[rarityKey] > 0 || rarity === 5) {
        if (inPool.length === 0) err('4-banner', 'banners.json', p + '.pool', 'rarity ' + rarity + (rarity === 5 ? ' (hard pity target)' : ' has rate > 0 but') + ' has no pool fighter');
        if (nonFeatured.length === 0 && feat.length > 0 && share !== 10000) {
          err('4-banner', 'banners.json', p + '.featured', 'rarity ' + rarity + ' has no non-featured fighters, so featured shares must sum to 10000 (got ' + share + ')');
        }
      }
    }
  });

  // ---- Rule 5: type chart has all 25 pairs ----
  const chart = battle.type_chart || {};
  for (const a of AURAS) {
    for (const d of AURAS) {
      if (!chart[a] || typeof chart[a][d] !== 'number') err('5-type-chart', 'battle.json', 'type_chart.' + a + '.' + d, 'missing pair');
    }
  }

  // ---- Rule 6: starting team ----
  const starting = economy.starting || {};
  const startChars = Array.isArray(starting.characters) ? starting.characters : [];
  const team = Array.isArray(starting.team) ? starting.team : [];
  startChars.forEach((id, j) => ref(charById, id, 'economy.json', 'starting.characters[' + j + ']', 'character'));
  if (starting.currencies) {
    for (const cid of Object.keys(starting.currencies)) ref(currencyById, cid, 'economy.json', 'starting.currencies.' + cid, 'currency');
  }
  if (team.length !== 3) err('6-starting-team', 'economy.json', 'starting.team', 'team must have 3 fighters, has ' + team.length);
  const families = [];
  team.forEach((id, j) => {
    if (startChars.indexOf(id) < 0) err('6-starting-team', 'economy.json', 'starting.team[' + j + ']', id + ' is not in starting.characters');
    const ch = charById[id];
    if (!ch) return;
    if (families.indexOf(ch.family) >= 0) err('6-starting-team', 'economy.json', 'starting.team[' + j + ']', 'family "' + ch.family + '" appears twice');
    families.push(ch.family);
  });
  const dup = economy.duplicates;
  if (dup && dup.overflow_currency_id) ref(currencyById, dup.overflow_currency_id, 'economy.json', 'duplicates.overflow_currency_id', 'currency');

  // ---- Rules 7 + 8: banned terms in every string (incl. art_brief and bio) ----
  if (banned) {
    const errRes = banned.errorTerms.map((t) => ({ term: t, re: termRegex(t) }));
    const warnRes = banned.warningTerms.map((t) => ({ term: t, re: termRegex(t) }));
    for (const entry of DATA_FILES) {
      const doc = data[entry.file];
      if (doc === undefined) continue;
      walkStrings(doc, '', (path, s) => {
        for (const r of errRes) {
          if (r.re.test(s)) err('7-banned-terms', entry.file, path, 'banned term "' + r.term + '" in: ' + s.slice(0, 80));
        }
        for (const r of warnRes) {
          if (r.re.test(s)) warn('7-banned-terms', entry.file, path, 'context-dependent term "' + r.term + '" (banned only as a power/form/mechanic name) — human review: ' + s.slice(0, 80));
        }
      });
    }
  }

  // ---- Rule 9: name-only banned terms (GDD §3 "Spark"/"Sparks") in name, name_override and epithet ----
  if (banned && Array.isArray(banned.nameOnlyTerms)) {
    const nameRes = banned.nameOnlyTerms.map((t) => ({ term: t, re: termRegex(t) }));
    for (const entry of DATA_FILES) {
      const doc = data[entry.file];
      if (doc === undefined) continue;
      walkNamedStrings(doc, '', NAME_FIELDS, (path, s) => {
        for (const r of nameRes) {
          if (r.re.test(s)) err('9-name-only-terms', entry.file, path, 'name-only banned term "' + r.term + '" in a name field: ' + s.slice(0, 80));
        }
      });
    }
  }

  // ---- Rules 10–12: balance limits (data/ only; GDD §15.3 round 3) ----
  if (balance) validateBalance(data, err, warn);

  // ---- Rules 13–15: audio / VFX data (GDD §15.3 ruling R4-6) ----
  validateMedia(data, err, warn, (n) => notices.push(n), options || {});

  return { errors: errors, warnings: warnings, notices: notices, schemaOk: schemaOk };
}
