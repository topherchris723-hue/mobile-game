import type { FighterSpec, TypeId } from '../config/fighters';
import { BATTLE_RULES, COMBO, CROSSOVER, CROSSOVER_PARTNER_EFFECT } from '../config/battle';
import { KIND_LABEL, kindIcon, techniqueText } from './cardText';
import { element, TYPE_LABEL } from './dom';
import {
  activeFighter,
  cardContinuesCombo,
  crossoverBlockedReason,
  crossoverPartners,
  playBlockedReason,
  previewCardDamage,
  previewCrossover,
  signatureThreat,
  switchBlockedReason,
} from '../game/duel/rules';
import type { DuelEvent, DuelState, Side } from '../game/duel/types';
import type { PortraitCache } from '../render/portraits';
import type { BattleSpeed } from '../save/saveData';

/*
 * HTML battle HUD (game-design.md §4.9). It shows a *displayed* copy of HP, energy, and the active
 * fighter that advances as events are played back, so numbers change in sync with the animations
 * rather than jumping ahead to the final state.
 */

export interface DuelHudCallbacks {
  onPlayCard(handIndex: number): void;
  onSwitch(fighterIndex: number): void;
  onCharge(): void;
  onCrossover(partnerIndex: number): void;
  onRestart(): void;
  onExit(): void;
  onToggleSpeed(): void;
}

/** What a battle paid out, shown on the result panel. */
export interface BattleReward {
  readonly currency: 'gems' | 'coins';
  readonly amount: number;
  readonly reason: string;
}

/** A Signature or Crossover title card shown before the attack lands. */
export interface CutInInfo {
  readonly side: Side;
  /** "Signature" or "Crossover Burst". */
  readonly kicker: string;
  readonly title: string;
  /** The fighters performing it (one, or lead + partner). */
  readonly fighters: readonly FighterSpec[];
}

export interface DuelHud {
  /** Measured height of the player panel in CSS pixels (for laying out the battlefield). */
  readonly panelHeight: number;
  /** Called whenever the panel's height changes, so the battlefield can re-lay itself out. */
  onPanelResize(listener: (heightCss: number) => void): void;
  reset(state: DuelState): void;
  applyEvent(event: DuelEvent): void;
  /** Renders the player's options; `enabled` is false while animations or the enemy are running. */
  showControls(state: DuelState, enabled: boolean): void;
  toast(message: string): void;
  /** Shows a cut-in; it stays until endCutIn(), so its length follows game time. */
  cutIn(info: CutInInfo): void;
  endCutIn(): void;
  setSpeed(speed: BattleSpeed): void;
  showResult(winner: Side, rewards: readonly BattleReward[]): void;
  dispose(): void;
}

interface DisplayFighter {
  readonly name: string;
  readonly type: TypeId;
  readonly maxHp: number;
  hp: number;
}

interface DisplaySide {
  fighters: DisplayFighter[];
  active: number;
  energy: number;
}

export function createDuelHud(
  host: HTMLElement,
  callbacks: DuelHudCallbacks,
  portraits: PortraitCache,
): DuelHud {
  const root = element('div', 'duel-hud', host);

  // Enemy panel.
  const enemyPanel = element('section', 'enemy-hud panel-ink', root);
  enemyPanel.setAttribute('aria-label', 'Enemy');
  const enemyHead = element('div', 'hud-row', enemyPanel);
  const enemyName = element('span', 'hud-name', enemyHead);
  const enemyType = element('span', 'type-chip', enemyHead);
  const enemyBench = element('span', 'bench-pips', enemyHead);
  const enemyHpBar = element('div', 'hp-bar', enemyPanel);
  const enemyHpFill = element('div', 'hp-fill', enemyHpBar);
  const enemyHpText = element('span', 'hp-text', enemyHpBar);
  const enemyEnergy = element('div', 'energy-mini', enemyPanel);
  const enemyThreat = element('div', 'threat', enemyPanel);
  enemyThreat.hidden = true;

  const speedButton = element('button', 'speed-button', root);
  speedButton.type = 'button';
  speedButton.addEventListener('click', () => {
    callbacks.onToggleSpeed();
  });

  const banner = element('div', 'turn-banner', root);

  const cutInNode = element('div', 'cut-in', root);
  cutInNode.setAttribute('aria-live', 'polite');
  const cutInBand = element('div', 'cut-in-band', cutInNode);
  const cutInFigures = element('div', 'cut-in-figures', cutInBand);
  const cutInImages = [0, 1].map(() => {
    const img = element('img', 'cut-in-figure', cutInFigures);
    img.alt = '';
    return img;
  });
  const cutInText = element('div', 'cut-in-text', cutInBand);
  const cutInKicker = element('span', 'cut-in-kicker', cutInText);
  const cutInTitle = element('span', 'cut-in-title', cutInText);
  const cutInNames = element('span', 'cut-in-names', cutInText);
  let cutInToken = 0;
  const toastNode = element('div', 'toast', root);
  toastNode.setAttribute('role', 'status');

  // Player panel.
  const panel = element('section', 'player-panel panel-ink', root);
  panel.setAttribute('aria-label', 'Your team');
  const head = element('div', 'hud-row', panel);
  const name = element('span', 'hud-name', head);
  const type = element('span', 'type-chip', head);
  // HP numbers sit in the header row so the bar can stay slim (keeps the panel compact).
  const hpText = element('span', 'hp-text-inline', head);
  const hpBar = element('div', 'hp-bar is-slim', panel);
  const hpFill = element('div', 'hp-fill', hpBar);
  const energyRow = element('div', 'energy', panel);
  element('span', 'energy-label', energyRow).textContent = 'Rift Energy';
  const pips = element('div', 'pips', energyRow);
  for (let i = 0; i < BATTLE_RULES.maxEnergy; i++) element('i', '', pips);
  const energyCount = element('b', 'energy-count', energyRow);
  const crossoverRow = element('div', 'crossover', panel);
  element('span', 'crossover-label', crossoverRow).textContent = 'Crossover';
  const crossoverButtons = [0, 1].map(() => {
    const button = element('button', 'crossover-button', crossoverRow);
    button.type = 'button';
    return button;
  });
  let crossoverTargets: number[] = [];
  crossoverButtons.forEach((button, slot) => {
    button.addEventListener('click', () => {
      const partner = crossoverTargets[slot];
      if (partner !== undefined) callbacks.onCrossover(partner);
    });
  });
  const hand = element('div', 'hand', panel);
  const cardButtons = Array.from({ length: BATTLE_RULES.handSize }, (_, index) => {
    const button = element('button', 'card', hand);
    button.type = 'button';
    button.addEventListener('click', () => {
      callbacks.onPlayCard(index);
    });
    return button;
  });
  const actions = element('div', 'actions', panel);
  const benchButtons = [0, 1].map(() => {
    const button = element('button', 'bench-button', actions);
    button.type = 'button';
    return button;
  });
  const chargeButton = element('button', 'charge-button', actions);
  chargeButton.type = 'button';
  chargeButton.innerHTML = `<span>Charge</span><small>+${BATTLE_RULES.chargeEnergy} energy</small>`;
  chargeButton.addEventListener('click', () => {
    callbacks.onCharge();
  });

  const result = element('section', 'result panel-light', root);
  result.hidden = true;
  const resultTitle = element('h2', '', result);
  const resultText = element('p', '', result);
  const resultRewards = element('div', 'result-rewards', result);
  const restart = element('button', 'button-primary', result);
  restart.type = 'button';
  restart.textContent = 'Play again';
  restart.addEventListener('click', () => {
    callbacks.onRestart();
  });
  const exit = element('button', 'button-quiet result-home', result);
  exit.type = 'button';
  exit.textContent = 'Home';
  exit.addEventListener('click', () => {
    callbacks.onExit();
  });

  const display: Record<Side, DisplaySide> = {
    player: { fighters: [], active: 0, energy: 0 },
    enemy: { fighters: [], active: 0, energy: 0 },
  };
  let benchTargets: number[] = [];
  const disposers: (() => void)[] = [];
  let toastTimer = 0;
  let bannerTimer = 0;

  benchButtons.forEach((button, slot) => {
    button.addEventListener('click', () => {
      const target = benchTargets[slot];
      if (target !== undefined) callbacks.onSwitch(target);
    });
  });

  const activeOf = (side: Side): DisplayFighter => {
    const fighter = display[side].fighters[display[side].active];
    if (!fighter) throw new Error(`No displayed fighter for ${side}`);
    return fighter;
  };

  const setHp = (fill: HTMLElement, text: HTMLElement, fighter: DisplayFighter): void => {
    const fraction = fighter.hp / fighter.maxHp;
    fill.style.transform = `scaleX(${fraction})`;
    fill.classList.toggle('is-low', fraction < 0.3);
    text.textContent = `${fighter.hp} / ${fighter.maxHp}`;
  };

  const setType = (chip: HTMLElement, typeId: TypeId): void => {
    chip.dataset['type'] = typeId;
    chip.textContent = TYPE_LABEL[typeId];
  };

  const renderSides = (): void => {
    const enemy = activeOf('enemy');
    enemyName.textContent = enemy.name;
    setType(enemyType, enemy.type);
    setHp(enemyHpFill, enemyHpText, enemy);
    enemyEnergy.textContent = `Rift Energy ${display.enemy.energy}/${BATTLE_RULES.maxEnergy}`;
    enemyBench.innerHTML = display.enemy.fighters
      .map(
        (f, i) =>
          `<i class="${f.hp <= 0 ? 'is-ko' : i === display.enemy.active ? 'is-active' : ''}"></i>`,
      )
      .join('');
    enemyBench.setAttribute(
      'aria-label',
      `${display.enemy.fighters.filter((f) => f.hp > 0).length} enemies left`,
    );

    const me = activeOf('player');
    name.textContent = me.name;
    setType(type, me.type);
    setHp(hpFill, hpText, me);
    energyCount.textContent = `${display.player.energy}/${BATTLE_RULES.maxEnergy}`;
    Array.from(pips.children).forEach((pip, i) => {
      pip.classList.toggle('is-full', i < display.player.energy);
    });
  };

  const renderBench = (state: DuelState | null, enabled: boolean): void => {
    benchTargets = display.player.fighters
      .map((_, i) => i)
      .filter((i) => i !== display.player.active);
    benchButtons.forEach((button, slot) => {
      const index = benchTargets[slot];
      const fighter = index === undefined ? undefined : display.player.fighters[index];
      if (index === undefined || !fighter) {
        button.hidden = true;
        return;
      }
      button.hidden = false;
      const reason =
        state && enabled ? switchBlockedReason(state, 'player', index) : 'Wait for your turn';
      button.classList.toggle('is-blocked', reason !== null);
      button.classList.toggle('is-ko', fighter.hp <= 0);
      button.dataset['reason'] = reason ?? '';
      button.setAttribute('aria-disabled', String(reason !== null));
      const fraction = Math.max(0, fighter.hp / fighter.maxHp);
      button.innerHTML = `<span class="bench-swap" aria-hidden="true">⇄</span><span class="bench-name">${fighter.name}</span><span class="type-chip" data-type="${fighter.type}">${TYPE_LABEL[fighter.type]}</span><span class="mini-hp"><i style="transform:scaleX(${fraction})"></i></span>`;
    });
  };

  return {
    get panelHeight() {
      return panel.getBoundingClientRect().height;
    },

    onPanelResize(listener) {
      let last = panel.getBoundingClientRect().height;
      const observer = new ResizeObserver(() => {
        const height = panel.getBoundingClientRect().height;
        if (Math.abs(height - last) < 1) return;
        last = height;
        listener(height);
      });
      observer.observe(panel);
      disposers.push(() => {
        observer.disconnect();
      });
    },

    reset(state) {
      for (const side of ['player', 'enemy'] as const) {
        const team = state.teams[side];
        display[side] = {
          fighters: team.fighters.map((f) => ({
            name: f.spec.name,
            type: f.spec.type,
            maxHp: f.spec.hp,
            hp: f.hp,
          })),
          active: team.activeIndex,
          energy: team.energy,
        };
      }
      result.hidden = true;
      cutInNode.classList.remove('is-visible');
      renderSides();
      renderBench(null, false);
    },

    applyEvent(event) {
      switch (event.kind) {
        case 'turnStart':
          display[event.side].energy = event.energy;
          window.clearTimeout(bannerTimer);
          banner.textContent = event.side === 'player' ? 'Your turn' : 'Enemy turn';
          banner.dataset['side'] = event.side;
          banner.classList.add('is-visible');
          bannerTimer = window.setTimeout(() => {
            banner.classList.remove('is-visible');
          }, 800);
          break;
        case 'cardPlayed':
        case 'charge':
        case 'crossover':
        case 'energy':
          display[event.side].energy = event.energy;
          break;
        case 'drain':
          display[event.side].energy = event.energy;
          display[event.side === 'player' ? 'enemy' : 'player'].energy = event.gainerEnergy;
          break;
        case 'switch':
          display[event.side].active = event.to;
          display[event.side].energy = event.energy;
          break;
        case 'damage':
        case 'heal': {
          const fighter = display[event.side].fighters[event.fighterIndex];
          if (fighter) fighter.hp = event.hp;
          break;
        }
        case 'status':
        case 'ko':
        case 'passive':
        case 'battleEnd':
          break;
      }
      renderSides();
    },

    showControls(state, enabled) {
      panel.classList.toggle('is-waiting', !enabled);
      const fighter = activeFighter(state.teams.player);
      cardButtons.forEach((button, index) => {
        const card = fighter.hand[index];
        if (!card) {
          button.hidden = true;
          return;
        }
        button.hidden = false;
        const spec = card.spec;
        const reason = enabled ? playBlockedReason(state, 'player', index) : 'Wait for your turn';
        button.dataset['kind'] = spec.kind;
        button.dataset['reason'] = reason ?? '';
        button.setAttribute('aria-disabled', String(reason !== null));
        button.classList.toggle('is-unaffordable', spec.cost > state.teams.player.energy);
        const combo = enabled && cardContinuesCombo(state, 'player', index);
        button.classList.toggle('is-combo', combo);
        let value: string;
        if (spec.power > 0) {
          const preview = previewCardDamage(state, 'player', index);
          const marker =
            preview.effectiveness === 'advantage'
              ? '<em class="is-up">▲ Strong</em>'
              : preview.effectiveness === 'disadvantage'
                ? '<em class="is-down">▼ Weak</em>'
                : '';
          const comboMarker = combo
            ? `<em class="is-combo">+${Math.round(COMBO.bonus * 100)}% Combo</em>`
            : '';
          value = `<strong>${preview.amount}</strong> dmg ${marker}${comboMarker}`;
        } else {
          value = techniqueText(spec);
        }
        button.innerHTML = `
          <span class="card-cost" aria-label="Cost ${spec.cost}">${spec.cost}</span>
          <span class="card-kind">${kindIcon(spec.kind)}${KIND_LABEL[spec.kind]}</span>
          <span class="card-name">${spec.name}</span>
          <span class="card-value">${value}</span>`;
      });
      // Crossover bar: always shown while a partner exists, so players learn what to save for.
      crossoverTargets = crossoverPartners(state, 'player');
      crossoverRow.classList.toggle('is-empty', crossoverTargets.length === 0);
      crossoverRow.classList.toggle(
        'is-ready',
        enabled && state.teams.player.energy >= CROSSOVER.cost,
      );
      crossoverButtons.forEach((button, slot) => {
        const partnerIndex = crossoverTargets[slot];
        const partner =
          partnerIndex === undefined ? undefined : state.teams.player.fighters[partnerIndex];
        if (partnerIndex === undefined || !partner) {
          button.hidden = true;
          return;
        }
        button.hidden = false;
        const reason = enabled
          ? crossoverBlockedReason(state, 'player', partnerIndex)
          : 'Wait for your turn';
        button.dataset['reason'] = reason ?? '';
        button.setAttribute('aria-disabled', String(reason !== null));
        const effect = CROSSOVER_PARTNER_EFFECT[partner.spec.type];
        button.innerHTML = `<span>with ${partner.spec.name}</span><small>${previewCrossover(state, 'player', partnerIndex)} dmg · ${effect.text}</small>`;
      });

      // Telegraph: the enemy's Signature is coming next turn.
      const threat = signatureThreat(state, 'enemy');
      enemyThreat.hidden = threat === null;
      enemyEnergy.hidden = threat !== null;
      if (threat) {
        enemyThreat.innerHTML = `<b>⚠ Next turn:</b> ${threat.card.name} · ${threat.damage} dmg to ${fighter.spec.name}`;
      }

      chargeButton.dataset['reason'] = enabled ? '' : 'Wait for your turn';
      chargeButton.setAttribute('aria-disabled', String(!enabled));
      renderBench(state, enabled);
    },

    cutIn(info) {
      const token = ++cutInToken;
      window.clearTimeout(bannerTimer);
      banner.classList.remove('is-visible');
      cutInNode.dataset['side'] = info.side;
      cutInNode.dataset['count'] = String(info.fighters.length);
      cutInKicker.textContent = info.kicker;
      cutInTitle.textContent = info.title;
      cutInNames.textContent = info.fighters.map((f) => f.name).join(' × ');
      cutInImages.forEach((img, index) => {
        const fighter = info.fighters[index];
        img.hidden = !fighter;
        img.removeAttribute('src');
        if (!fighter) return;
        // Portraits are prefetched when the battle starts, so this normally resolves at once.
        void portraits.get(fighter).then((url) => {
          if (token === cutInToken) img.src = url;
        });
      });
      cutInNode.classList.add('is-visible');
    },

    endCutIn() {
      cutInNode.classList.remove('is-visible');
    },

    setSpeed(speed) {
      speedButton.textContent = `${speed}×`;
      speedButton.setAttribute('aria-pressed', String(speed === 2));
      speedButton.setAttribute('aria-label', `Battle speed ${speed}×, tap to change`);
    },

    toast(message) {
      window.clearTimeout(toastTimer);
      toastNode.textContent = message;
      toastNode.classList.add('is-visible');
      toastTimer = window.setTimeout(() => {
        toastNode.classList.remove('is-visible');
      }, 1400);
    },

    showResult(winner, rewards) {
      result.hidden = false;
      result.dataset['winner'] = winner;
      resultTitle.textContent = winner === 'player' ? 'Victory' : 'Defeat';
      resultText.textContent =
        winner === 'player' ? 'All three Rift enemies defeated.' : 'Your team was defeated.';
      resultRewards.replaceChildren();
      for (const reward of rewards) {
        const line = element('p', 'result-reward', resultRewards);
        line.dataset['currency'] = reward.currency;
        const label = reward.currency === 'gems' ? 'Gems' : 'Coins';
        line.innerHTML = `<i class="${reward.currency === 'gems' ? 'gem-icon' : 'coin-icon'}" aria-hidden="true"></i><b>+${reward.amount.toLocaleString('en-US')}</b> ${label} · ${reward.reason}`;
      }
      restart.focus();
    },

    dispose() {
      for (const dispose of disposers) dispose();
      window.clearTimeout(toastTimer);
      window.clearTimeout(bannerTimer);
      root.remove();
    },
  };
}
