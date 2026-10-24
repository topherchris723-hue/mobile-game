// Entry point: Phaser boot, portrait scaling inside the safe area, scene list, test hooks.
import Phaser from 'phaser';
import { computeViewport, CANVAS_MAX_ZOOM } from './ui/layout.js';
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
import { LicensesScene } from './scenes/LicensesScene.js';
import audioData from '../data/audio.json';
import { initAudio, audioDebug } from './audio/index.js';
import { drawFighter } from './ui/fighter-view.js';
import { FIGHTER_SHAPES } from './ui/fighter-shapes.js';

const params = new URLSearchParams(window.location.search);
// Read-only hooks for Playwright (scene key, touch targets, battle snapshot, sound-hook log).
// Dev / test builds only (src/ui/test-hooks.js): a release bundle has no hook code at all.
const T = TEST_HOOKS && params.has('test') ? installTestHooks() : null;

data.init();
// Audio once, before any scene (GDD §18.1: the AudioContext is created on the first gesture, not here).
initAudio(audioData, data.save.settings);

const parent = document.getElementById('game');

// Canvas 2D when asked for (?renderer=canvas) or when the device has no WebGL (Phaser.AUTO would fall back to it).
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'));
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext(); // free the probe context at once
    return !!gl;
  } catch (e) {
    return false;
  }
}
const useCanvas = params.get('renderer') === 'canvas' || !hasWebGL();

function measure() {
  const r = parent.getBoundingClientRect();
  return computeViewport(r.width, r.height, window.devicePixelRatio || 1, useCanvas ? CANVAS_MAX_ZOOM : undefined);
}

let vp = measure();

const game = new Phaser.Game({
  // ?renderer=canvas forces Canvas 2D (fallback for devices with broken WebGL; also used by headless tests).
  type: useCanvas ? Phaser.CANVAS : Phaser.AUTO,
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
  scene: [TitleScene, HomeScene, StoryListScene, DialogueScene, TeamScene, BattleScene, ResultScene, SummonScene, SummonRevealScene, SettingsScene, LicensesScene],
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
  // STYLE_GUIDE §11 item 1 proof: all fighters as black fills side by side on a white sheet (mode 'black'),
  // or in colour / Umbral ('color' | 'umbral'). Draws over the active scene; returns the ids in order.
  T.silhouetteSheet = (mode) => {
    const sc = T.activeScene();
    const ids = Object.keys(FIGHTER_SHAPES);
    const c = sc.add.container(0, 0).setDepth(5000);
    const bg = sc.add.graphics();
    bg.fillStyle(mode === 'black' ? 0xffffff : 0x141a33, 1);
    bg.fillRect(0, 0, sc.W, sc.H);
    c.add(bg);
    ids.forEach((id, i) => {
      const g = sc.add.graphics();
      const ch = data.character(id);
      drawFighter(g, FIGHTER_SHAPES[id], { aura: ch ? ch.aura : 'blaze', facing: 1, scale: 1, silhouette: mode === 'black', umbral: mode === 'umbral', side: 'player' });
      g.setPosition(45 + (i % 4) * 90, 170 + Math.floor(i / 4) * 200);
      c.add(g);
      c.add(sc.text(45 + (i % 4) * 90, 190 + Math.floor(i / 4) * 200, ch ? ch.name : id, 12, mode === 'black' ? '#000000' : '#ffffff').setOrigin(0.5, 0));
    });
    return ids;
  };
}
