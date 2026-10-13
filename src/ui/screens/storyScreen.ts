import { STAGES } from '../../config/story';
import type { SaveStore } from '../../save/saveStore';
import { button, element, typeChip } from '../dom';
import type { Screen } from './homeScreen';

export interface StoryScreenDeps {
  readonly save: SaveStore;
  readonly onBattle: (stageId: string) => void;
  readonly onBack: () => void;
}

/** Story stage list. The Prologue is playable now; Chapter 1 and its map arrive in M7. */
export function createStoryScreen(host: HTMLElement, deps: StoryScreenDeps): Screen {
  const root = element('section', 'screen story-screen', host);
  root.setAttribute('aria-label', 'Story');
  const header = element('header', 'screen-header', root);
  button('back-button', '‹ Home', header).addEventListener('click', deps.onBack);
  element('h1', 'screen-title', header).textContent = 'Story';

  const list = element('div', 'stage-list', root);
  for (const stage of STAGES) {
    const cleared = deps.save.data.story.clearedStages.includes(stage.id);
    const card = element('article', 'stage-card panel-light', list);
    card.innerHTML = `
      <p class="stage-kicker">${stage.title}${cleared ? ' · <b class="cleared">Cleared ✓</b>' : ''}</p>
      <h2>${stage.subtitle}</h2>
      <p>${stage.description}</p>
      <p class="stage-enemies">Enemies: ${stage.enemies.map((enemy) => `${enemy.name} ${typeChip(enemy.type)}`).join(' · ')}</p>`;
    const start = button('button-primary', cleared ? 'Battle again' : 'Battle', card);
    start.dataset['stage'] = stage.id;
    start.addEventListener('click', () => {
      deps.onBattle(stage.id);
    });
  }
  const locked = element('article', 'stage-card is-locked panel-ink', list);
  locked.innerHTML = `
    <p class="stage-kicker"><i class="lock" aria-hidden="true"></i>Chapter 1</p>
    <h2>The Three Shores</h2>
    <p>A full chapter with a story map, dialogue, and a boss arrives with step 7.</p>`;

  return {
    dispose() {
      root.remove();
    },
  };
}
