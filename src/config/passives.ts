/*
 * Sovereign Passives (docs/design/characters.md): one always-on trait per Sovereign. The numbers
 * are tuning knobs; the descriptions are built from them so the text can never drift from the rule.
 */

export const PASSIVE_TUNING = {
  risingEmber: { perTurn: 0.06, max: 0.24 },
  firstLight: { heal: 0.05 },
  basaltSkin: { reduction: 0.1 },
  ashenPride: { bonus: 0.15 },
  arcCore: { energy: 1 },
  readTheCurrent: { reduction: 0.25 },
  captainsWill: {},
  stickyFingers: { every: 2, steal: 1 },
  beacon: { reduction: 0.08 },
  sirensHold: { heal: 0.05 },
  deepRoots: { heal: 0.03 },
  galeStep: { bonus: 0.2 },
  unbrokenBody: {},
  fieldMedic: { healBonus: 0.3 },
  inkVeil: { reduction: 0.3 },
} as const;

export type PassiveId = keyof typeof PASSIVE_TUNING;

const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;
const T = PASSIVE_TUNING;
const ORDINAL: Readonly<Record<number, string>> = { 2: 'second', 3: 'third', 4: 'fourth' };

export const PASSIVES: Readonly<
  Record<PassiveId, { readonly name: string; readonly text: string }>
> = {
  risingEmber: {
    name: 'Rising Ember',
    text: `+${pct(T.risingEmber.perTurn)} ATK at the start of each of his turns on the field (max +${pct(T.risingEmber.max)}); resets when he leaves`,
  },
  firstLight: {
    name: 'First Light',
    text: `While she is on the bench, allies who switch in recover ${pct(T.firstLight.heal)} HP`,
  },
  basaltSkin: {
    name: 'Basalt Skin',
    text: `Takes ${pct(T.basaltSkin.reduction)} less damage from Blasts`,
  },
  ashenPride: {
    name: 'Ashen Pride',
    text: `+${pct(T.ashenPride.bonus)} damage against enemies with lowered Defence`,
  },
  arcCore: {
    name: 'Arc Core',
    text: `The first time he switches in each battle, +${T.arcCore.energy} Rift Energy`,
  },
  readTheCurrent: {
    name: 'Read the Current',
    text: `Takes ${pct(T.readTheCurrent.reduction)} less damage from Signatures`,
  },
  captainsWill: {
    name: "Captain's Will",
    text: 'Once per battle, survives a knockout blow with 1 HP',
  },
  stickyFingers: {
    name: 'Sticky Fingers',
    text: `Every ${ORDINAL[T.stickyFingers.every]} Strike she lands steals ${T.stickyFingers.steal} Rift Energy`,
  },
  beacon: {
    name: 'Beacon',
    text: `While he is on the bench, the active ally takes ${pct(T.beacon.reduction)} less damage`,
  },
  sirensHold: {
    name: "Siren's Hold",
    text: `When she Drains, she recovers ${pct(T.sirensHold.heal)} HP`,
  },
  deepRoots: {
    name: 'Deep Roots',
    text: `Recovers ${pct(T.deepRoots.heal)} HP at the start of each of his turns on the field`,
  },
  galeStep: {
    name: 'Gale Step',
    text: `Her first attack after entering deals +${pct(T.galeStep.bonus)} damage and pierces Guard`,
  },
  unbrokenBody: {
    name: 'Unbroken Body',
    text: "His Defence can't be lowered",
  },
  fieldMedic: {
    name: 'Field Medic',
    text: `Her heals restore ${pct(T.fieldMedic.healBonus)} more`,
  },
  inkVeil: {
    name: 'Ink Veil',
    text: `The first hit he takes after entering is reduced by ${pct(T.inkVeil.reduction)}`,
  },
};
