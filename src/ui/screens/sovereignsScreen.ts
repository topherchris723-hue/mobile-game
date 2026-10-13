import { ROSTER, getSovereign, type SovereignSpec } from '../../config/sovereigns';
import { describeLeaderSkill } from '../../game/leader';
import { assignToSlot } from '../../game/team';
import type { PortraitCache } from '../../render/portraits';
import type { SaveStore } from '../../save/saveStore';
import { kindIcon, KIND_LABEL, techniqueText } from '../cardText';
import { button, element, ROLE_LABEL, stars, typeChip, WORLD_LABEL } from '../dom';
import type { Screen } from './homeScreen';

/*
 * Sovereigns: the collection, a detail sheet, and the team editor (game-design.md §5, §8).
 * Team editing: tap a slot, then tap a Sovereign to place them there (an existing member swaps).
 * Every change is saved immediately.
 */

export interface SovereignsScreenDeps {
  readonly save: SaveStore;
  readonly portraits: PortraitCache;
  readonly onBack: () => void;
  readonly toast: (message: string) => void;
}

type Slot = 0 | 1 | 2;
const SLOT_LABEL = ['Leader', 'Slot 2', 'Slot 3'] as const;

/** Highest value of each stat in the roster, so detail bars compare fairly. */
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
        ? `<span class="sovereign-card-name">${spec.name}</span>${stars(spec.rarity)}${typeChip(spec.type)}`
        : `<span class="sovereign-card-name">???</span><span class="sovereign-card-locked">Recruit with Summons</span>`;
      card.addEventListener('click', () => {
        if (!isOwned) {
          deps.toast(`${spec.name} can be recruited once Summons arrive (step 6).`);
          return;
        }
        if (selectedSlot !== null) place(selectedSlot, spec);
        else openDetail(spec);
      });
    }
  };

  const statRow = (label: string, value: number, max: number): string =>
    `<div class="stat-row"><span>${label}</span><span class="stat-bar"><i style="transform:scaleX(${value / max})"></i></span><b>${value}</b></div>`;

  const openDetail = (spec: SovereignSpec): void => {
    sheet.replaceChildren();
    sheet.hidden = false;
    const panel = element('div', 'detail-panel panel-light', sheet);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `${spec.name} details`);
    const top = element('div', 'detail-top', panel);
    portraitImg(spec, top, 'detail-portrait');
    const heading = element('div', 'detail-heading', top);
    heading.innerHTML = `
      <p class="detail-title">${spec.title}</p>
      <h2>${spec.name}</h2>
      <p>${stars(spec.rarity)} ${typeChip(spec.type)}</p>
      <p class="detail-meta">${WORLD_LABEL[spec.world]} · ${ROLE_LABEL[spec.role]}</p>
      ${statRow('HP', spec.hp, STAT_MAX.hp)}
      ${statRow('ATK', spec.atk, STAT_MAX.atk)}
      ${statRow('DEF', spec.def, STAT_MAX.def)}
      ${statRow('SPD', spec.spd, STAT_MAX.spd)}`;
    const leader = element('p', 'detail-leader', panel);
    leader.innerHTML = `<b>Leader Skill</b> ${describeLeaderSkill(spec.leaderSkill)}`;
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
