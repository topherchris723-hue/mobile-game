import { ROSTER, getSovereign } from '../../config/sovereigns';
import { STAGES } from '../../config/story';
import { BUILD_ID } from '../../core/buildInfo';
import { describeLeaderSkill } from '../../game/leader';
import type { PortraitCache } from '../../render/portraits';
import { pullsUntilPity } from '../../game/economy/summon';
import { STANDARD_BANNER } from '../../config/summons';
import type { SaveStore } from '../../save/saveStore';
import { element, gemsLabel } from '../dom';

/*
 * Home menu (game-design.md §8, owner request): the hub after boot and after every battle.
 * Large one-thumb tiles; locked features say exactly why and when they unlock, and do nothing
 * else (no fake functionality).
 */

export interface HomeScreenDeps {
  readonly save: SaveStore;
  readonly portraits: PortraitCache;
  readonly onStory: () => void;
  readonly onSovereigns: () => void;
  readonly onSummon: () => void;
  readonly onSettings: () => void;
  readonly toast: (message: string) => void;
}

export interface Screen {
  dispose(): void;
}

interface TileSpec {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly locked: string | null;
  readonly onOpen: () => void;
}

export function createHomeScreen(host: HTMLElement, deps: HomeScreenDeps): Screen {
  const root = element('section', 'screen home-screen', host);
  root.setAttribute('aria-label', 'Home');

  const settings = element('button', 'icon-button settings-button', root);
  settings.type = 'button';
  settings.setAttribute('aria-label', 'Settings');
  // Gear icon (inline SVG: UI icons may be SVG, CLAUDE.md §4).
  settings.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><g fill="currentColor"><rect x="10.4" y="1.6" width="3.2" height="5" rx="0.6" transform="rotate(0 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="5" rx="0.6" transform="rotate(45 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="5" rx="0.6" transform="rotate(90 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="5" rx="0.6" transform="rotate(135 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="5" rx="0.6" transform="rotate(180 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="5" rx="0.6" transform="rotate(225 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="5" rx="0.6" transform="rotate(270 12 12)"/><rect x="10.4" y="1.6" width="3.2" height="5" rx="0.6" transform="rotate(315 12 12)"/></g><circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" stroke-width="3.6"/></svg>`;
  settings.addEventListener('click', deps.onSettings);

  const balance = element('span', 'gem-balance home-gems', root);
  balance.setAttribute('aria-label', `${deps.save.data.gems} Gems`);
  balance.innerHTML = gemsLabel(deps.save.data.gems);

  const header = element('header', 'home-header', root);
  element('p', 'kicker', header).textContent = 'Rift Duel';
  element('h1', 'home-title', header).textContent = 'Shattered Sovereigns';

  // Team card: tap to edit the team.
  const team = deps.save.data.team.map(getSovereign);
  const leader = team[0];
  const teamCard = element('button', 'team-card panel-light', root);
  teamCard.type = 'button';
  teamCard.setAttribute('aria-label', 'Your team: edit in Sovereigns');
  const portraits = element('div', 'team-card-portraits', teamCard);
  team.forEach((member, slot) => {
    const figure = element(
      'figure',
      slot === 0 ? 'team-portrait is-leader' : 'team-portrait',
      portraits,
    );
    const img = element('img', '', figure);
    img.alt = '';
    void deps.portraits.get(member).then((url) => (img.src = url));
    element('figcaption', '', figure).textContent = member.name;
  });
  const teamText = element('div', 'team-card-text', teamCard);
  element('span', 'team-card-label', teamText).textContent = 'Your team';
  element('span', 'team-card-skill', teamText).textContent = leader
    ? `Leader ${leader.name}: ${describeLeaderSkill(leader.leaderSkill)}`
    : '';
  teamCard.addEventListener('click', deps.onSovereigns);

  const cleared = deps.save.data.story.clearedStages.length;
  const tiles: TileSpec[] = [
    {
      id: 'story',
      title: 'Story',
      detail: cleared >= STAGES.length ? 'Prologue cleared ✓' : 'Prologue · The Shattering',
      locked: null,
      onOpen: deps.onStory,
    },
    {
      id: 'sovereigns',
      title: 'Sovereigns',
      detail: `${deps.save.data.ownedSovereigns.length} / ${ROSTER.length} recruited · Team`,
      locked: null,
      onOpen: deps.onSovereigns,
    },
    {
      id: 'summon',
      title: 'Summon',
      detail: `Standard · 5★ within ${pullsUntilPity(deps.save.data.summons.pity[STANDARD_BANNER.id] ?? 0)}`,
      locked: null,
      onOpen: deps.onSummon,
    },
    {
      id: 'guilds',
      title: 'Guilds',
      detail: 'Online — coming later',
      locked: 'Guilds need online accounts, which arrive in the online phase.',
      onOpen: () => undefined,
    },
  ];

  const grid = element('nav', 'home-tiles', root);
  grid.setAttribute('aria-label', 'Main menu');
  for (const tile of tiles) {
    const node = element('button', 'home-tile', grid);
    node.type = 'button';
    node.dataset['tile'] = tile.id;
    node.classList.toggle('is-locked', tile.locked !== null);
    node.setAttribute('aria-disabled', String(tile.locked !== null));
    node.innerHTML = `<span class="home-tile-title">${tile.locked ? '<i class="lock" aria-hidden="true"></i>' : ''}${tile.title}</span><span class="home-tile-detail">${tile.detail}</span>`;
    node.addEventListener('click', () => {
      if (tile.locked) deps.toast(tile.locked);
      else tile.onOpen();
    });
  }

  element('p', 'build-tag', root).textContent = `Build ${BUILD_ID}`;

  return {
    dispose() {
      root.remove();
    },
  };
}
