// Colours and fonts for placeholder art. Colour is never the only cue: auras and card types also have shapes.

export const FONT = '"Trebuchet MS", "Segoe UI", Roboto, Arial, sans-serif';

export const COLORS = {
  bg: 0x0d1020,
  bgTop: 0x1a1f3d,
  panel: 0x1c2240,
  panelLight: 0x2a3260,
  stroke: 0x4a5490,
  text: '#f4f6ff',
  textDim: '#a9b0d6',
  textDark: '#14172b',
  accent: 0xffc23d,
  accentText: '#ffc23d',
  good: '#4be08a',
  bad: '#ff5d5d',
  hpPlayer: 0x4be08a,
  hpEnemy: 0xff5d5d,
  hpLag: 0xffe08a,
  hpBack: 0x2b1e2e,
  vigor: 0x3dc8ff,
  vigorEmpty: 0x22304a,
  burst: 0xffa53d,
  ignite: 0xff4d2e,
  disabled: 0x3a3f5c,
  overlay: 0x05060d,
};

export const AURA_COLORS = {
  blaze: 0xff6a3d,
  gale: 0x3ddc97,
  stone: 0xc9a36b,
  radiant: 0xffd84a,
  void: 0x9b6bff,
};

export const CARD_COLORS = {
  fist: 0xd9483b,
  bolt: 0x3a7fd9,
  signature: 0x9a52d9,
  climax: 0xe8a21f,
};

export function auraColor(aura) {
  return AURA_COLORS[aura] !== undefined ? AURA_COLORS[aura] : 0x888888;
}

export function hex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}
