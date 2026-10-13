import { PASSIVES } from '../../config/passives';
import { DEBUG_COIN_GRANT, LIMIT_BREAK, MAX_COINS } from '../../config/progression';
import { ROSTER, getSovereign, type SovereignSpec } from '../../config/sovereigns';
import { describeLeaderSkill } from '../../game/leader';
import {
  costToReach,
  levelCap,
  levelledSovereign,
  levelUp,
  limitBreakBlockedReason,
  NEW_PROGRESS,
  type SovereignProgress,
} from '../../game/progression';
import { assignToSlot } from '../../game/team';
import type { PortraitCache } from '../../render/portraits';
import type { SaveStore } from '../../save/saveStore';
import { kindIcon, KIND_LABEL, techniqueText } from '../cardText';
import { button, coinsLabel, element, ROLE_LABEL, stars, typeChip, WORLD_LABEL } from '../dom';
import type { Feedback } from '../feedback';
import type { Screen } from './homeScreen';

/*
 * Sovereigns: the collection, a detail sheet, and the team editor (game-design.md §5, §8).
 * Team editing: tap a slot, then tap a Sovereign to place them there (an existing member swaps).
 * Every change is saved immediately.
 */

export interface SovereignsScreenDeps {
  readonly save: SaveStore;
  readonly portraits: PortraitCache;
  readonly feedback: Feedback;
  readonly debug: boolean;
  readonly onBack: () => void;
  readonly toast: (message: string) => void;
}

type Slot = 0 | 1 | 2;
const SLOT_LABEL = ['Leader', 'Slot 2', 'Slot 3'] as const;

/** Highest level-1 value of each stat in the roster, so detail bars compare base potential. */
const STAT_MAX = {
  hp: Math.max(...ROSTER.map((s) => s.hp)),
  atk: Math.max(...ROSTER.map((s) => s.atk)),
  def: Math.max(...ROSTER.map((s) => s.def)),
  spd: Math.max(...ROSTER.map((s) => s.spd)),
};

export function createSovereignsScreen(host: HTMLElement, deps: SovereignsScreenDeps): Screen {
  const root = element('section', 'screen sovereigns-screen', host);
  root.setAttribute('aria-label', 'Sovereigns');
  const header = element('header', 'screen-header', root);
  button('back-button', '‹ Home', header).addEventListener('click', deps.onBack);
  const title = element('h1', 'screen-title', header);

  const teamPanel = element('section', 'team-editor panel-ink', root);
  teamPanel.setAttribute('aria-label', 'Team');
  const slotRow = element('div', 'team-slots', teamPanel);
  const teamHint = element('p', 'team-hint', teamPanel);

  const grid = element('div', 'sovereign-grid', root);
  const sheet = element('div', 'detail-sheet', root);
  sheet.hidden = true;

  let selectedSlot: Slot | null = null;

  const owned = (id: string): boolean => deps.save.data.ownedSovereigns.includes(id);
  const progressOf = (id: string): SovereignProgress => deps.save.data.progress[id] ?? NEW_PROGRESS;

  const portraitImg = (spec: SovereignSpec, parent: HTMLElement, className: string): void => {
    const img = element('img', className, parent);
    img.alt = '';
    void deps.portraits.get(spec).then((url) => (img.src = url));
  };

  const place = (slot: Slot, spec: SovereignSpec): void => {
    deps.save.update((data) => {
      data.team = [...assignToSlot(data.team, slot, spec.id)];
    });
    deps.toast(
      slot === 0 ? `${spec.name} now leads the team` : `${spec.name} joins ${SLOT_LABEL[slot]}`,
    );
    selectedSlot = null;
    render();
  };

  const renderTeam = (): void => {
    slotRow.replaceChildren();
    const team = deps.save.data.team.map(getSovereign);
    team.forEach((member, index) => {
      const slot = index as Slot;
      const node = element('button', 'team-slot', slotRow);
      node.type = 'button';
      node.dataset['slot'] = String(slot);
      node.classList.toggle('is-selected', selectedSlot === slot);
      node.setAttribute('aria-pressed', String(selectedSlot === slot));
      portraitImg(member, node, 'team-slot-portrait');
      element('span', 'team-slot-label', node).textContent = SLOT_LABEL[slot];
      element('span', 'team-slot-name', node).textContent = member.name;
      element('span', 'level-tag', node).textContent = `Lv ${progressOf(member.id).level}`;
      node.addEventListener('click', () => {
        selectedSlot = selectedSlot === slot ? null : slot;
        render();
      });
    });
    const leader = team[0];
    teamHint.textContent =
      selectedSlot !== null
        ? `Choose a Sovereign for ${SLOT_LABEL[selectedSlot]}`
        : leader
          ? `Leader Skill: ${describeLeaderSkill(leader.leaderSkill)}`
          : '';
    teamHint.classList.toggle('is-choosing', selectedSlot !== null);
  };

  const renderGrid = (): void => {
    grid.replaceChildren();
    const team = deps.save.data.team;
    // Recruited first, then by rarity (highest first), keeping roster order within ties.
    const ordered = [...ROSTER].sort(
      (a, b) => Number(owned(b.id)) - Number(owned(a.id)) || b.rarity - a.rarity,
    );
    for (const spec of ordered) {
      const isOwned = owned(spec.id);
      const card = element('button', 'sovereign-card', grid);
      card.type = 'button';
      card.dataset['sovereign'] = spec.id;
      card.classList.toggle('is-locked', !isOwned);
      card.classList.toggle('in-team', team.includes(spec.id));
      card.dataset['world'] = spec.world;
      portraitImg(spec, card, 'sovereign-card-portrait');
      const info = element('span', 'sovereign-card-info', card);
      info.innerHTML = isOwned
        ? `<span class="sovereign-card-name">${spec.name}</span>${stars(spec.rarity)}${typeChip(spec.type)}<span class="level-tag">Lv ${progressOf(spec.id).level}</span>`
        : `<span class="sovereign-card-name">???</span><span class="sovereign-card-locked">Recruit with Summons</span>`;
      card.addEventListener('click', () => {
        if (!isOwned) {
          deps.toast(`Recruit ${spec.name} from the Summon menu.`);
          return;
        }
        if (selectedSlot !== null) place(selectedSlot, spec);
        else openDetail(spec);
      });
    }
  };

  /** Bar: level-1 potential against the roster; number: the value at the current level. */
  const statRow = (label: string, base: number, max: number, current: number): string =>
    `<div class="stat-row"><span>${label}</span><span class="stat-bar"><i style="transform:scaleX(${base / max})"></i></span><b>${current}</b></div>`;

  const saveProgress = (
    id: string,
    next: SovereignProgress,
    coinCost: number,
    shardCost: number,
  ) => {
    deps.save.update((data) => {
      data.progress[id] = { ...next };
      data.coins -= coinCost;
      if (shardCost > 0) {
        // A zero count is dropped the next time the save loads.
        data.shards[id] = Math.max(0, (data.shards[id] ?? 0) - shardCost);
      }
    });
  };

  /** Level and Limit Break controls in the detail sheet (game-design.md §5). */
  const renderLevelPanel = (spec: SovereignSpec, parent: HTMLElement): void => {
    const progress = progressOf(spec.id);
    const cap = levelCap(spec.rarity, progress.limitBreaks);
    const coins = deps.save.data.coins;
    const shards = deps.save.data.shards[spec.id] ?? 0;
    const panel = element('section', 'level-panel', parent);
    panel.setAttribute('aria-label', 'Level');
    const head = element('div', 'level-head', panel);
    head.innerHTML = `<b class="level-value">Lv ${progress.level}</b><span class="level-cap">/ ${cap}</span>`;
    const pips = element('span', 'lb-pips', head);
    pips.setAttribute('aria-label', `Limit Break ${progress.limitBreaks} of ${LIMIT_BREAK.max}`);
    for (let i = 0; i < LIMIT_BREAK.max; i++) {
      element('i', i < progress.limitBreaks ? 'is-on' : '', pips);
    }

    const actions = element('div', 'level-actions', panel);
    const action = (label: string, reason: string | null, run: () => void): void => {
      const node = button('level-button', '', actions);
      node.innerHTML = label;
      node.setAttribute('aria-disabled', String(reason !== null));
      node.dataset['reason'] = reason ?? '';
      node.addEventListener('click', () => {
        if (reason) {
          deps.toast(reason);
          deps.feedback.cue('deny');
          return;
        }
        run();
      });
    };

    if (progress.level < cap) {
      for (const steps of [1, 10]) {
        const target = Math.min(cap, progress.level + steps);
        const cost = costToReach(progress.level, target);
        const outcome = levelUp(progress, spec.rarity, coins, steps);
        action(
          `<span>${steps === 1 ? 'Level up' : `+${target - progress.level} levels`}</span><small>${coinsLabel(cost)}</small>`,
          outcome.ok ? null : outcome.reason,
          () => {
            if (!outcome.ok) return;
            saveProgress(spec.id, outcome.progress, outcome.cost, 0);
            deps.feedback.cue('levelUp');
            deps.toast(`${spec.name} reached Lv ${outcome.progress.level}`);
            openDetail(spec);
            render();
          },
        );
      }
    } else if (progress.limitBreaks < LIMIT_BREAK.max) {
      const cost = LIMIT_BREAK.shardCost[spec.rarity];
      action(
        `<span>Limit Break</span><small>${cost} shards · cap ${cap} → ${cap + LIMIT_BREAK.levelsPerBreak}</small>`,
        limitBreakBlockedReason(progress, spec.rarity, shards),
        () => {
          saveProgress(spec.id, { ...progress, limitBreaks: progress.limitBreaks + 1 }, 0, cost);
          deps.feedback.cue('limitBreak');
          deps.toast(`${spec.name} Limit Broken: level cap ${cap + LIMIT_BREAK.levelsPerBreak}`);
          openDetail(spec);
          render();
        },
      );
    } else {
      element('p', 'level-max', actions).textContent = 'Max level · fully Limit Broken';
    }

    const wallet = element('p', 'level-wallet', panel);
    wallet.innerHTML = `<span class="level-coins">${coinsLabel(coins)}</span><span class="level-shards"><b>${shards}</b> shards${
      progress.limitBreaks < LIMIT_BREAK.max
        ? ` · Limit Break needs ${LIMIT_BREAK.shardCost[spec.rarity]}`
        : ''
    }</span>`;
  };

  const openDetail = (spec: SovereignSpec): void => {
    sheet.replaceChildren();
    sheet.hidden = false;
    const panel = element('div', 'detail-panel panel-light', sheet);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `${spec.name} details`);
    const levelled = levelledSovereign(spec, progressOf(spec.id));
    const top = element('div', 'detail-top', panel);
    portraitImg(spec, top, 'detail-portrait');
    const heading = element('div', 'detail-heading', top);
    heading.innerHTML = `
      <p class="detail-title">${spec.title}</p>
      <h2>${spec.name}</h2>
      <p>${stars(spec.rarity)} ${typeChip(spec.type)}</p>
      <p class="detail-meta">${WORLD_LABEL[spec.world]} · ${ROLE_LABEL[spec.role]}</p>
      ${statRow('HP', spec.hp, STAT_MAX.hp, levelled.hp)}
      ${statRow('ATK', spec.atk, STAT_MAX.atk, levelled.atk)}
      ${statRow('DEF', spec.def, STAT_MAX.def, levelled.def)}
      ${statRow('SPD', spec.spd, STAT_MAX.spd, levelled.spd)}`;
    renderLevelPanel(spec, panel);
    const leader = element('p', 'detail-leader', panel);
    leader.innerHTML = `<b>Leader Skill</b> ${describeLeaderSkill(spec.leaderSkill)}`;
    const passive = element('p', 'detail-leader detail-passive', panel);
    passive.innerHTML = `<b>Passive · ${PASSIVES[spec.passive].name}</b> ${PASSIVES[spec.passive].text}`;
    const deck = element('ul', 'detail-deck', panel);
    for (const card of spec.deck) {
      const item = element('li', '', deck);
      item.dataset['kind'] = card.kind;
      const effect = card.power > 0 ? `Power ×${card.power}` : techniqueText(card);
      item.innerHTML = `<span class="detail-card-kind">${kindIcon(card.kind)}${KIND_LABEL[card.kind]}</span><span class="detail-card-name">${card.name}</span><span class="detail-card-effect">${effect}</span><span class="detail-card-cost">${card.cost}</span>`;
    }
    const actions = element('div', 'detail-actions', panel);
    const team = deps.save.data.team;
    ([0, 1, 2] as const).forEach((slot) => {
      const inSlot = team[slot] === spec.id;
      const action = button(
        inSlot ? 'button-quiet is-current' : 'button-primary',
        inSlot
          ? `In ${SLOT_LABEL[slot]}`
          : slot === 0
            ? 'Make Leader'
            : `Put in ${SLOT_LABEL[slot]}`,
        actions,
      );
      action.disabled = inSlot;
      action.addEventListener('click', () => {
        sheet.hidden = true;
        place(slot, spec);
      });
    });
    button('button-quiet detail-close', 'Close', panel).addEventListener('click', () => {
      sheet.hidden = true;
    });
  };
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.hidden = true;
  });

  if (deps.debug) {
    button('button-quiet debug-gems', `Debug: +${DEBUG_COIN_GRANT} Coins`, root).addEventListener(
      'click',
      () => {
        deps.save.update((data) => {
          data.coins = Math.min(MAX_COINS, data.coins + DEBUG_COIN_GRANT);
        });
        deps.toast(`+${DEBUG_COIN_GRANT} Coins (debug)`);
      },
    );
  }

  const render = (): void => {
    title.textContent = `Sovereigns · ${deps.save.data.ownedSovereigns.length}/${ROSTER.length}`;
    renderTeam();
    renderGrid();
  };
  render();

  return {
    dispose() {
      root.remove();
    },
  };
}
