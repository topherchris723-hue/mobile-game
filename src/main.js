// Entry point: Phaser boot, portrait scaling inside the safe area, scene list, test hooks.
import Phaser from 'phaser';
import { computeViewport } from './ui/layout.js';
import { data } from './ui/game-data.js';
import { TEST_HOOKS, installTestHooks } from './ui/test-hooks.js';
import { TitleScene } from './scenes/TitleScene.js';
import { HomeScene } from './scenes/HomeScene.js';
import { StoryListScene } from './scenes/StoryListScene.js';
import { DialogueScene } from './scenes/DialogueScene.js';
import { TeamScene } from './scenes/TeamScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { SummonScene } from './scenes/SummonScene.js';
import { SummonRevealScene } from './scenes/SummonRevealScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import audioData from '../data/audio.json';
import { initAudio, audioDebug } from './audio/index.js';

const params = new URLSearchParams(window.location.search);
// Read-only hooks for Playwright (scene key, touch targets, battle snapshot, sound-hook log).
// Dev / test builds only (src/ui/test-hooks.js): a release bundle has no hook code at all.
const T = TEST_HOOKS && params.has('test') ? installTestHooks() : null;

data.init();
// Audio once, before any scene (GDD §18.1: the AudioContext is created on the first gesture, not here).
initAudio(audioData, data.save.settings);

const parent = document.getElementById('game');

function measure() {
  const r = parent.getBoundingClientRect();
  return computeViewport(r.width, r.height, window.devicePixelRatio || 1);
}

let vp = measure();

const game = new Phaser.Game({
  // ?renderer=canvas forces Canvas 2D (fallback for devices with broken WebGL; also used by headless tests).
  type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  parent: parent,
  backgroundColor: '#0d1020',
  width: vp.canvasW,
  height: vp.canvasH,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  disableContextMenu: true,
  render: { antialias: true, roundPixels: false },
  fps: { target: 60 },
  callbacks: {
    preBoot: (g) => g.registry.set('viewport', vp),
  },
  scene: [TitleScene, HomeScene, StoryListScene, DialogueScene, TeamScene, BattleScene, ResultScene, SummonScene, SummonRevealScene, SettingsScene],
});

let resizeTimer = null;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const next = measure();
    if (next.H === vp.H && Math.abs(next.zoom - vp.zoom) < 0.01) {
      game.scale.refresh();
      return;
    }
    vp = next;
    game.registry.set('viewport', vp);
    game.scale.setGameSize(vp.canvasW, vp.canvasH);
    game.events.emit('viewport-changed', vp);
  }, 120);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

if (T) {
  T.game = game;
  T.viewport = () => game.registry.get('viewport');
  T.activeScene = () => {
    const s = game.scene.getScenes(true);
    return s.length ? s[s.length - 1] : null;
  };
  T.targets = () => {
    const s = T.activeScene();
    return s && s.targetsInCss ? s.targetsInCss() : [];
  };
  T.battleState = () => {
    const s = game.scene.getScene('Battle');
    return s && s.battle ? s.battle.getState() : null;
  };
  T.tutorialStep = () => {
    const s = game.scene.getScene('Battle');
    return s && s.scene.isActive() && s.tutorial && s.tutorial.active ? s.tutorial.active.step : null;
  };
  T.save = () => JSON.parse(JSON.stringify(data.save));
  T.data = data;
  T.audioDebug = () => audioDebug();
  // ?vfxQuality=low forces the VFX quality (AC-17.6); read by the scenes that create a VFX layer.
  T.vfxQuality = params.get('vfxQuality') === 'low' ? 'low' : null;
}
