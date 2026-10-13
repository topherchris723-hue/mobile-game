import { getSovereign, type Rarity } from '../config/sovereigns';
import { REVEAL_TIMING } from '../config/summons';
import type { SummonPull } from '../game/economy/summon';
import type { PortraitCache } from '../render/portraits';
import { button, element, stars, typeChip } from './dom';
import type { Feedback } from './feedback';
import type { Screen } from './screens/homeScreen';

/*
 * Summon reveal (game-design.md §6). The result is already decided and saved before this opens;
 * this only presents it, so quitting mid-animation never loses or rerolls a summon.
 *
 *   crystal (tap) → spotlight for each 5★ (tap) → results grid → Done
 *
 * The crystal's colour hints at the best rarity inside (a deliberate, honest tell).
 */

export interface SummonRevealDeps {
  readonly portraits: PortraitCache;
  readonly feedback: Feedback;
  readonly reduceMotion: () => boolean;
  readonly onDone: () => void;
}

export function showSummonReveal(
  host: HTMLElement,
  pulls: readonly SummonPull[],
  deps: SummonRevealDeps,
): Screen {
  const root = element('div', 'summon-reveal', host);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Summon results');
  const best = pulls.reduce<Rarity>((max, pull) => (pull.rarity > max ? pull.rarity : max), 3);
  root.dataset['best'] = String(best);
  const timers: number[] = [];
  const later = (ms: number, run: () => void): void => {
    timers.push(window.setTimeout(run, deps.reduceMotion() ? 0 : ms));
  };

  const stage = element('div', 'summon-stage', root);
  const skip = button('summon-skip', 'Skip', root);
  const spotlights = pulls.filter((pull) => pull.rarity === 5);

  const portrait = (id: string, parent: HTMLElement, className: string): void => {
    const img = element('img', className, parent);
    img.alt = '';
    void deps.portraits.get(getSovereign(id)).then((url) => (img.src = url));
  };

  const outcomeLabel = (pull: SummonPull): string =>
    pull.isNew
      ? '<span class="summon-new">New</span>'
      : `<span class="summon-shards">+${pull.shards} shards</span>`;

  const showGrid = (): void => {
    skip.hidden = true;
    stage.replaceChildren();
    root.dataset['phase'] = 'grid';
    const grid = element('div', pulls.length > 1 ? 'summon-grid' : 'summon-grid is-single', stage);
    pulls.forEach((pull, index) => {
      const spec = getSovereign(pull.id);
      const card = element('div', 'summon-card', grid);
      card.dataset['rarity'] = String(pull.rarity);
      card.dataset['sovereign'] = pull.id;
      card.style.setProperty(
        '--delay',
        `${deps.reduceMotion() ? 0 : index * REVEAL_TIMING.staggerMs}ms`,
      );
      portrait(pull.id, card, 'summon-card-portrait');
      const info = element('div', 'summon-card-info', card);
      info.innerHTML = `${stars(pull.rarity)}<span class="summon-card-name">${spec.name}</span>${outcomeLabel(pull)}`;
    });
    const summary = element('p', 'summon-summary', stage);
    const recruited = pulls.filter((pull) => pull.isNew).length;
    const shards = pulls.reduce((sum, pull) => sum + pull.shards, 0);
    summary.textContent = [
      recruited > 0 ? `${recruited} recruited` : null,
      shards > 0 ? `${shards} shards from duplicates` : null,
    ]
      .filter((part) => part !== null)
      .join(' · ');
    const done = button('button-primary summon-done', 'Done', stage);
    done.addEventListener('click', deps.onDone);
    done.focus();
  };

  const showSpotlight = (index: number): void => {
    const pull = spotlights[index];
    if (!pull) {
      showGrid();
      return;
    }
    const spec = getSovereign(pull.id);
    stage.replaceChildren();
    root.dataset['phase'] = 'spotlight';
    const card = element('button', 'summon-spotlight', stage);
    card.type = 'button';
    card.dataset['sovereign'] = pull.id;
    portrait(pull.id, card, 'summon-spotlight-portrait');
    const info = element('span', 'summon-spotlight-info', card);
    info.innerHTML = `
      ${stars(pull.rarity)}
      <span class="summon-spotlight-title">${spec.title}</span>
      <span class="summon-spotlight-name">${spec.name}</span>
      <span>${typeChip(spec.type)} ${outcomeLabel(pull)}</span>
      <span class="summon-hint">Tap to continue</span>`;
    deps.feedback.cue('summonRare');
    card.addEventListener('click', () => {
      showSpotlight(index + 1);
    });
  };

  const open = (): void => {
    root.dataset['phase'] = 'opening';
    deps.feedback.cue('summonOpen');
    later(REVEAL_TIMING.crackMs, () => {
      showSpotlight(0);
    });
  };

  // Phase 1: the crystal.
  root.dataset['phase'] = 'crystal';
  const crystal = element('button', 'summon-crystal', stage);
  crystal.type = 'button';
  crystal.setAttribute('aria-label', 'Open the Rift crystal');
  element('span', 'summon-crystal-shape', crystal);
  element('span', 'summon-hint', crystal).textContent = 'Tap to open';
  crystal.addEventListener('click', open, { once: true });
  deps.feedback.cue('summonCharge');

  skip.addEventListener('click', () => {
    for (const timer of timers) window.clearTimeout(timer);
    showGrid();
  });

  return {
    dispose() {
      for (const timer of timers) window.clearTimeout(timer);
      root.remove();
    },
  };
}
