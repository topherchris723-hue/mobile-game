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

/**
 * Validate the whole data set.
 * @param data    { 'cards.json': object, ... } parsed data files (missing file = error)
 * @param schemas { 'cards.schema.json': object, ... }
 * @param banned  result of parseBannedTerms
 * @param extraFiles names of data/*.json files not listed in GDD §15.1 (reported as errors)
 * @returns { errors: [{rule, file, path, message}], warnings: [...] }
 */
export function validateDataset(data, schemas, banned, extraFiles) {
  const errors = [];
  const warnings = [];
  const err = (rule, file, path, message) => errors.push({ rule: rule, file: file, path: path, message: message });
  const warn = (rule, file, path, message) => warnings.push({ rule: rule, file: file, path: path, message: message });

  for (const f of extraFiles || []) err('files', f, '', 'data file not listed in GDD §15.1');

  // ---- Schema validation (Ajv, JSON Schema 2020-12) ----
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  let schemaOk = true;
  for (const entry of DATA_FILES) {
    const schema = schemas[entry.schema];
    const doc = data[entry.file];
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
    for (const rarityKey of Object.keys(rates)) {
      const rarity = Number(rarityKey);
      const inPool = pool.filter((id) => charById[id] && charById[id].rarity === rarity);
      const feat = featured.filter((f) => f && charById[f.character_id] && charById[f.character_id].rarity === rarity);
      let share = 0;
      for (const f of feat) share += f.share_bp;
      const nonFeatured = inPool.filter((id) => !feat.some((f) => f.character_id === id));
      if (share > 10000) err('4-banner', 'banners.json', p + '.featured', 'rarity ' + rarity + ' featured shares sum to ' + share + ' (> 10000)');
      if (rates[rarityKey] > 0) {
        if (inPool.length === 0) err('4-banner', 'banners.json', p + '.pool', 'rarity ' + rarity + ' has rate > 0 but no pool fighter');
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

  return { errors: errors, warnings: warnings, schemaOk: schemaOk };
}
