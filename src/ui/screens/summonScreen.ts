import { getSovereign } from '../../config/sovereigns';
import {
  DEBUG_GEM_GRANT,
  DUPLICATE_SHARDS,
  MAX_GEMS,
  MULTI_GUARANTEE_RARITY,
  PITY_LIMIT,
  STANDARD_BANNER,
  SUMMON_COST,
  SUMMON_COUNT,
  type SummonKind,
} from '../../config/summons';
import type { Logger } from '../../debug/log';
import {
  bannerRates,
  performSummon,
  pullsUntilPity,
  summonBlockedReason,
} from '../../game/economy/summon';
import type { PortraitCache } from '../../render/portraits';
import type { SaveStore } from '../../save/saveStore';
import { button, element, gemsLabel, stars } from '../dom';
import type { Feedback } from '../feedback';
import { showSummonReveal } from '../summonReveal';
import type { Screen } from './homeScreen';

/*
 * Summon screen (game-design.md §6, §8): the Standard banner with its Gem cost, pity counter, and
 * published rates. A summon is rolled and saved in one write before the reveal plays.
 */

export interface SummonScreenDeps {
  readonly save: SaveStore;
  readonly portraits: PortraitCache;
  readonly feedback: Feedback;
  readonly log: Logger;
  readonly debug: boolean;
  readonly onBack: () => void;
  readonly toast: (message: string) => void;
}

const banner = STANDARD_BANNER;

/** Exact published rate: up to two decimals, no padding (4%, 3.5%, 1.33%). */
const percent = (rate: number): string => `${Number((rate * 100).toFixed(2))}%`;

export function createSummonScreen(host: HTMLElement, deps: SummonScreenDeps): Screen {
  const { save } = deps;
  const root = element('section', 'screen summon-screen', host);
  root.setAttribute('aria-label', 'Summon');
  const header = element('header', 'screen-header', root);
  button('back-button', '‹ Home', header).addEventListener('click', deps.onBack);
  element('h1', 'screen-title', header).textContent = 'Summon';
  const balance = element('span', 'gem-balance', header);
  balance.setAttribute('aria-label', 'Gems');

  // Banner: the three 5★ Sovereigns are the headline.
  const bannerPanel = element('section', 'summon-banner panel-ink', root);
  const hero = element('div', 'summon-hero', bannerPanel);
  const featured = bannerRates(banner).find((group) => group.rarity === 5)?.ids ?? [];
  for (const id of featured) {
    const img = element('img', 'summon-hero-figure', hero);
    img.alt = '';
    void deps.portraits.get(getSovereign(id)).then((url) => (img.src = url));
  }
  const bannerText = element('div', 'summon-banner-text', bannerPanel);
  element('h2', 'summon-banner-name', bannerText).textContent = banner.name;
  element('p', 'summon-banner-desc', bannerText).textContent = banner.description;
  const pityRow = element('div', 'pity', bannerPanel);
  const pityText = element('p', 'pity-text', pityRow);
  const pityBar = element('div', 'pity-bar', pityRow);
  const pityFill = element('i', '', pityBar);
  const ratesButton = button('button-quiet rates-button', 'Rates & rules', bannerPanel);

  const actions = element('div', 'summon-actions', root);
  const summonButtons = (['single', 'multi'] as const).map((kind) => {
    const node = element('button', `summon-button is-${kind}`, actions);
    node.type = 'button';
    node.dataset['kind'] = kind;
    node.innerHTML = `
      <span class="summon-button-label">${kind === 'multi' ? `Summon ×${SUMMON_COUNT.multi}` : 'Summon ×1'}</span>
      <span class="summon-button-cost">${gemsLabel(SUMMON_COST[kind])}</span>
      ${kind === 'multi' ? `<small>${MULTI_GUARANTEE_RARITY}★ or higher guaranteed</small>` : '<small>&nbsp;</small>'}`;
    node.addEventListener('click', () => {
      requestSummon(kind);
    });
    return { kind, node };
  });

  if (deps.debug) {
    button('button-quiet debug-gems', `Debug: +${DEBUG_GEM_GRANT} Gems`, root).addEventListener(
      'click',
      () => {
        save.update((data) => {
          data.gems = Math.min(MAX_GEMS, data.gems + DEBUG_GEM_GRANT);
        });
        deps.log.info(`Debug grant: +${DEBUG_GEM_GRANT} Gems`);
        render();
      },
    );
  }

  const sheet = element('div', 'detail-sheet', root);
  sheet.hidden = true;
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.hidden = true;
  });
  let reveal: Screen | null = null;

  const pity = (): number => save.data.summons.pity[banner.id] ?? 0;

  const render = (): void => {
    const gems = save.data.gems;
    balance.innerHTML = gemsLabel(gems);
    const left = pullsUntilPity(pity());
    pityText.innerHTML =
      left === 1
        ? '<b>Next summon: 5★ guaranteed</b>'
        : `5★ guaranteed within <b>${left}</b> summons`;
    pityFill.style.transform = `scaleX(${pity() / PITY_LIMIT})`;
    for (const { kind, node } of summonButtons) {
      const reason = summonBlockedReason(gems, kind);
      node.setAttribute('aria-disabled', String(reason !== null));
      node.dataset['reason'] = reason ?? '';
    }
  };

  const openSheet = (build: (panel: HTMLElement) => void, label: string): void => {
    sheet.replaceChildren();
    sheet.hidden = false;
    const panel = element('div', 'detail-panel panel-light', sheet);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', label);
    build(panel);
  };

  const runSummon = (kind: SummonKind): void => {
    const data = save.data;
    const outcome = performSummon(
      {
        gems: data.gems,
        seed: data.summons.seed,
        pulls: data.summons.pulls,
        pity: pity(),
        owned: data.ownedSovereigns,
        shards: data.shards,
      },
      banner,
      kind,
    );
    if (!outcome.ok) {
      deps.toast(outcome.reason);
      deps.feedback.cue('deny');
      return;
    }
    const next = outcome.state;
    // One write: Gems spent, Sovereigns recruited, shards, pity, and RNG position together.
    save.update((draft) => {
      draft.gems = next.gems;
      draft.summons.pulls = next.pulls;
      draft.summons.pity[banner.id] = next.pity;
      draft.ownedSovereigns = [...next.owned];
      draft.shards = { ...next.shards };
    });
    deps.log.info(
      `Summon ${kind}: ${outcome.pulls.map((p) => `${p.id}(${p.rarity}★${p.isNew ? ' new' : ''})`).join(', ')}`,
    );
    render();
    reveal = showSummonReveal(host, outcome.pulls, {
      portraits: deps.portraits,
      feedback: deps.feedback,
      reduceMotion: () => save.data.settings.reduceMotion,
      onDone: () => {
        reveal?.dispose();
        reveal = null;
      },
    });
  };

  const requestSummon = (kind: SummonKind): void => {
    const reason = summonBlockedReason(save.data.gems, kind);
    if (reason) {
      deps.toast(reason);
      deps.feedback.cue('deny');
      return;
    }
    deps.feedback.cue('tap');
    // Gems are scarce: always confirm before spending them.
    openSheet((panel) => {
      panel.classList.add('summon-confirm');
      const cost = SUMMON_COST[kind];
      element('h2', 'settings-title', panel).textContent =
        kind === 'multi' ? `Summon ×${SUMMON_COUNT.multi}` : 'Summon ×1';
      const text = element('p', 'summon-confirm-text', panel);
      text.innerHTML = `Spend ${gemsLabel(cost)} Gems? You have ${gemsLabel(save.data.gems)}.`;
      const row = element('div', 'summon-confirm-actions', panel);
      button('button-quiet', 'Cancel', row).addEventListener('click', () => {
        sheet.hidden = true;
      });
      button('button-primary summon-confirm-go', 'Summon', row).addEventListener('click', () => {
        sheet.hidden = true;
        runSummon(kind);
      });
    }, 'Confirm summon');
  };

  ratesButton.addEventListener('click', () => {
    openSheet((panel) => {
      panel.classList.add('rates-sheet');
      element('h2', 'settings-title', panel).textContent = 'Rates & rules';
      const list = element('div', 'rates-list', panel);
      for (const group of bannerRates(banner)) {
        const block = element('section', 'rates-group', list);
        const head = element('h3', 'rates-head', block);
        head.innerHTML = `${stars(group.rarity)}<b>${percent(group.rate)}</b>`;
        const names = element('ul', 'rates-names', block);
        for (const id of group.ids) {
          const item = element('li', '', names);
          item.innerHTML = `<span>${getSovereign(id).name}</span><span>${percent(group.perSovereign)}</span>`;
        }
      }
      const rules = element('ul', 'rates-rules', panel);
      rules.innerHTML = `
        <li>A multi summon is ${SUMMON_COUNT.multi} Sovereigns (10 + 1 bonus) for ${SUMMON_COST.multi} Gems and always includes at least one ${MULTI_GUARANTEE_RARITY}★ or higher.</li>
        <li>Pity: if ${PITY_LIMIT - 1} summons in a row on this banner bring no 5★, the ${PITY_LIMIT}th is a guaranteed 5★. The counter resets on any 5★.</li>
        <li>Duplicates become shards for Limit Breaks: ${DUPLICATE_SHARDS[3]} (3★), ${DUPLICATE_SHARDS[4]} (4★), ${DUPLICATE_SHARDS[5]} (5★).</li>
        <li>Gems are earned by playing. There are no real-money purchases in this version.</li>`;
      button('button-primary settings-close', 'Close', panel).addEventListener('click', () => {
        sheet.hidden = true;
      });
    }, 'Rates and rules');
  });

  render();

  return {
    dispose() {
      reveal?.dispose();
      root.remove();
    },
  };
}
