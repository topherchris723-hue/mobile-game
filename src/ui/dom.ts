import type { TypeId, WorldId } from '../config/fighters';
import type { Rarity, Role } from '../config/sovereigns';

/** Creates an element with a class, optionally appended to a parent. */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

export function button(className: string, label: string, parent?: HTMLElement): HTMLButtonElement {
  const node = element('button', className, parent);
  node.type = 'button';
  node.textContent = label;
  return node;
}

export const TYPE_LABEL: Readonly<Record<TypeId, string>> = {
  fury: 'Fury',
  swift: 'Swift',
  guile: 'Guile',
  radiant: 'Radiant',
  void: 'Void',
};

export const WORLD_LABEL: Readonly<Record<WorldId, string>> = {
  energy: 'Energy realm',
  ocean: 'Ocean crews',
  clans: 'Warrior clans',
  rift: 'The Rift',
};

export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  striker: 'Striker',
  breaker: 'Breaker',
  guardian: 'Guardian',
  support: 'Support',
};

/** Type shown by colour and label (never colour alone). */
export function typeChip(type: TypeId): string {
  return `<span class="type-chip" data-type="${type}">${TYPE_LABEL[type]}</span>`;
}

export function stars(rarity: Rarity): string {
  return `<span class="stars" aria-label="${rarity} stars" data-rarity="${rarity}">${'★'.repeat(rarity)}</span>`;
}

/** Gem amount with the Rift-crystal icon (the icon is decorative; the number carries the meaning). */
export function gemsLabel(gems: number): string {
  return `<i class="gem-icon" aria-hidden="true"></i><span>${gems.toLocaleString('en-US')}</span>`;
}
