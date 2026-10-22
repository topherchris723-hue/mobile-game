// Loads the shipped data, builds the logic content once, and owns the runtime save for the UI.
// No game rules here: progression rules come from src/state/save.js and src/logic.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import battle from '../../data/battle.json';
import characters from '../../data/characters.json';
import cards from '../../data/cards.json';
import enemies from '../../data/enemies.json';
import stages from '../../data/stages.json';
import economy from '../../data/economy.json';
import story from '../../data/story.json';
import saveSchema from '../../data/schemas/save.schema.json';

import { createContent, playerFighterDef, formulas } from '../logic/index.js';
import { loadSave, writeSave, applyBattleResult, checkTeamFamilies, isStageUnlocked } from '../state/save.js';

const content = createContent({ battle, characters, cards, enemies, stages, economy });

const scenesById = {};
for (const s of story.scenes) scenesById[s.id] = s;

const currenciesById = {};
for (const c of economy.currencies) currenciesById[c.id] = c;

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

function pickStorage() {
  try {
    const s = window.localStorage;
    const probe = '__probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch (e) {
    return memoryStorage();
  }
}

export const data = {
  raw: { battle, characters, cards, enemies, stages, economy, story },
  content,
  scenesById,
  currenciesById,
  storage: null,
  save: null,
  saveDamaged: false,

  init() {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(saveSchema);
    this.storage = pickStorage();
    const res = loadSave(this.storage, { validate, economy, characters: content.characters, nowMs: Date.now() });
    this.save = res.save;
    this.saveDamaged = res.damaged;
    if (res.repaired && res.warnings && res.warnings.length) console.warn('[save] team repaired on load', res.warnings);
  },

  persist() {
    writeSave(this.storage, this.save, Date.now());
  },

  jade() {
    return this.save.currencies.cur_jade || 0;
  },

  character(id) {
    return content.characters[id];
  },

  card(id) {
    return content.cards[id] || null;
  },

  stage(id) {
    return content.stages[id];
  },

  /** Stages sorted by chapter then order. */
  stageList() {
    return stages.stages.slice().sort((a, b) => (a.chapter_id < b.chapter_id ? -1 : a.chapter_id > b.chapter_id ? 1 : a.order - b.order));
  },

  chapter(id) {
    return stages.chapters.find((c) => c.id === id) || null;
  },

  stageRecord(id) {
    return this.save.stages[id] || null;
  },

  /** GDD §9.1 (rule lives in src/state/save.js). */
  isUnlocked(stage) {
    return isStageUnlocked(this.save, stage.id, content.stages);
  },

  rosterEntry(charId) {
    return this.save.roster.find((r) => r.character_id === charId) || null;
  },

  /**
   * The team the UI shows and fields. loadSave already repairs the team (BUG-2-04/05); this is a second,
   * read-only guard so no screen can crash on an id the data does not know: if any slot is unknown,
   * fall back to the starter team and log a warning. Never writes the save.
   */
  team() {
    const t = this.save && this.save.team;
    if (Array.isArray(t) && t.length === 3 && t.every((id) => !!content.characters[id])) return t;
    if (!this.warnedTeam) {
      this.warnedTeam = true;
      console.warn('[team] save team has unknown character ids; using the starter team', t);
    }
    return economy.starting.team.filter((id) => !!content.characters[id]);
  },

  /** Team as logic entries ({ characterId, resonance }). */
  teamEntries() {
    return this.team().map((id) => {
      const r = this.rosterEntry(id);
      return { characterId: id, resonance: r ? r.resonance : 0 };
    });
  },

  fighterDef(charId) {
    const r = this.rosterEntry(charId);
    return playerFighterDef(content, { characterId: charId, resonance: r ? r.resonance : 0 });
  },

  fighterPower(charId) {
    const d = this.fighterDef(charId);
    return formulas.fighterPower(d.maxHp, d.atk, d.def, economy.power_formula);
  },

  teamPower(team) {
    let p = 0;
    for (const id of team || this.team()) if (content.characters[id]) p += this.fighterPower(id);
    return p;
  },

  /** Try a new team order/selection. Returns false (and changes nothing) if families clash. */
  setTeam(team) {
    const candidate = Object.assign({}, this.save, { team: team });
    if (!checkTeamFamilies(candidate, content.characters)) return false;
    this.save.team = team.slice();
    this.persist();
    return true;
  },

  tutorialActive(stage) {
    return !this.save.tutorial.completed && Array.isArray(stage.tutorial_steps) && stage.tutorial_steps.length > 0;
  },

  /** Apply a finished battle to the save and write it. Returns { rewards, missions }. */
  applyResult(stage, result) {
    const out = applyBattleResult(this.save, stage, result, economy, content.characters, new Date().toISOString());
    this.persist();
    return out;
  },

  hapticsOn() {
    return !!(this.save && this.save.settings && this.save.settings.haptics);
  },
};
