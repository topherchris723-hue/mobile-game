#!/usr/bin/env node
// Jade Tempest app icon + splash generator (release-engineer, round 7).
//
// All art is drawn here as SVG (self-made, no fonts, no images, no third-party art) and rendered to
// PNG with the project's own Playwright Chromium. Run:  npm run android:icons
//
// Motif (docs/STYLE_GUIDE.md palette): a cut jade crystal (Gale greens) struck by a gold storm bolt
// (accent #FFC23D), with two wind swooshes, on the navy arena sky (#1A1F3D -> #0D1020). 2-unit outline
// in the character-art outline colour #14172B. No text, no stars, no orbs, no franchise shapes.
//
// Outputs (overwrites):
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher.png             legacy square icon (48dp)
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher_round.png       legacy round icon (48dp)
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher_foreground.png  adaptive foreground (108dp)
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher_background.png  adaptive background (108dp)
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher_monochrome.png  themed-icon layer (108dp)
//   assets/app-icon/play-store-icon-512.png                           Play Console hi-res icon
//   assets/app-icon/*.svg                                             the SVG sources
//
// The launch splash uses no PNG: android/app/src/main/res/drawable/splash.xml is a layer-list (navy
// #0D1020 + ic_launcher_foreground centred) for Android < 12, and Android 12+ uses the windowSplashScreen*
// theme items. Full-screen gradient PNGs cost ~1.9 MB of APK for no gain.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');

const C = {
  outline: '#14172B', skyTop: '#1A1F3D', sky: '#0D1020', streak: '#22304A',
  jadeHi: '#F2FFF8', jadeLight: '#8FF0C4', jade: '#3DDC97', jadeMid: '#2BAE78', jadeDark: '#137A5A',
  jadeDeep: '#0E5C44', gold: '#FFC23D', goldHi: '#FFF4D6',
};

// ---- shapes in the 108-unit adaptive-icon grid (safe zone: circle r=33 around 54,54) ----
const GEM = { T: [54, 25], UR: [70, 37], LR: [70, 69], B: [54, 83], LL: [38, 69], UL: [38, 37] };
const TAB = { t: [54, 35], ur: [62, 42], lr: [62, 62], b: [54, 71], ll: [46, 62], ul: [46, 42] };
const pts = (...p) => p.map(([x, y]) => `${x},${y}`).join(' ');
const BOLT = pts([56, 24], [67, 24], [57, 49], [66, 49], [44, 84], [50, 57], [41, 57]);
const SWOOSH_L = 'M30 66 C 22 52, 26 36, 40 28';
const SWOOSH_R = 'M78 42 C 86 56, 82 72, 68 80';

function foregroundShapes() {
  const { T, UR, LR, B, LL, UL } = GEM;
  const { t, ur, lr, b, ll, ul } = TAB;
  return `
  <g fill="none" stroke-linecap="round">
    <path d="${SWOOSH_L}" stroke="${C.outline}" stroke-width="6"/>
    <path d="${SWOOSH_L}" stroke="${C.jadeLight}" stroke-width="3"/>
    <path d="${SWOOSH_R}" stroke="${C.outline}" stroke-width="6"/>
    <path d="${SWOOSH_R}" stroke="${C.jadeLight}" stroke-width="3"/>
  </g>
  <g stroke="${C.outline}" stroke-width="0.6" stroke-linejoin="round">
    <polygon points="${pts(T, UL, ul, t)}" fill="${C.jadeLight}"/>
    <polygon points="${pts(T, UR, ur, t)}" fill="${C.jade}"/>
    <polygon points="${pts(UL, LL, ll, ul)}" fill="${C.jade}"/>
    <polygon points="${pts(UR, LR, lr, ur)}" fill="${C.jadeDark}"/>
    <polygon points="${pts(LL, B, b, ll)}" fill="${C.jadeMid}"/>
    <polygon points="${pts(LR, B, b, lr)}" fill="${C.jadeDeep}"/>
    <polygon points="${pts(t, ur, lr, b, ll, ul)}" fill="${C.jadeMid}"/>
  </g>
  <polygon points="${pts(t, ul, [46, 50], [54, 43])}" fill="${C.jadeHi}" opacity="0.55"/>
  <polygon points="${pts(T, UR, LR, B, LL, UL)}" fill="none" stroke="${C.outline}" stroke-width="2" stroke-linejoin="round"/>
  <polygon points="${BOLT}" fill="${C.gold}" stroke="${C.outline}" stroke-width="2.2" stroke-linejoin="round"/>
  <polygon points="${pts([58, 27], [63, 27], [54.5, 47.5], [52, 47.5])}" fill="${C.goldHi}" opacity="0.9"/>`;
}

function backgroundShapes() {
  return `
  <defs>
    <radialGradient id="sky" cx="0.5" cy="0.42" r="0.7">
      <stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.sky}"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="108" height="108" fill="url(#sky)"/>
  <g fill="none" stroke="${C.streak}" stroke-width="2.5" stroke-linecap="round" opacity="0.9">
    <path d="M6 30 C 30 20, 50 22, 72 12"/>
    <path d="M20 96 C 44 88, 70 92, 102 78"/>
    <path d="M84 30 C 94 28, 100 24, 106 18"/>
  </g>`;
}

function monochromeShapes() {
  // Alpha-only layer for Android 13+ themed icons: gem + swooshes, bolt cut out with a gap.
  const g = GEM;
  return `
  <defs><mask id="m">
    <rect width="108" height="108" fill="black"/>
    <polygon points="${pts(g.T, g.UR, g.LR, g.B, g.LL, g.UL)}" fill="white"/>
    <path d="${SWOOSH_L}" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="${SWOOSH_R}" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <polygon points="${BOLT}" fill="black" stroke="black" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="${BOLT}" fill="white"/>
  </mask></defs>
  <rect width="108" height="108" fill="#FFFFFF" mask="url(#m)"/>`;
}

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${body}</svg>`;

const SVG = {
  foreground: svg('0 0 108 108', foregroundShapes()),
  background: svg('0 0 108 108', backgroundShapes()),
  monochrome: svg('0 0 108 108', monochromeShapes()),
  // Full composed icon (Play Store 512 + legacy icons): crop toward the visible adaptive area.
  full: svg('12 12 84 84', backgroundShapes() + foregroundShapes()),
  legacy: svg('9 9 90 90', `<defs><clipPath id="c"><rect x="13" y="13" width="82" height="82" rx="16"/></clipPath></defs>
    <g clip-path="url(#c)">${backgroundShapes()}${foregroundShapes()}</g>`),
  round: svg('13 13 82 82', `<defs><clipPath id="c"><circle cx="54" cy="54" r="40"/></clipPath></defs>
    <g clip-path="url(#c)">${backgroundShapes()}${foregroundShapes()}</g>`),
};

const DPI = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function render(page, markup, w, h, out, transparent) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}
    body>svg{display:block;width:${w}px;height:${h}px}</style></head><body>${markup}</body></html>`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const written = [];
const out = async (markup, w, h, file, transparent = true) => {
  await render(page, markup, w, h, file, transparent);
  written.push(path.relative(root, file));
};

for (const [name, body] of Object.entries(SVG)) fs.writeFileSync(path.join(here, `${name}.svg`), body + '\n');

for (const [dpi, k] of Object.entries(DPI)) {
  const dir = path.join(res, `mipmap-${dpi}`);
  await out(SVG.legacy, 48 * k, 48 * k, path.join(dir, 'ic_launcher.png'));
  await out(SVG.round, 48 * k, 48 * k, path.join(dir, 'ic_launcher_round.png'));
  await out(SVG.foreground, 108 * k, 108 * k, path.join(dir, 'ic_launcher_foreground.png'));
  await out(SVG.background, 108 * k, 108 * k, path.join(dir, 'ic_launcher_background.png'), false);
  await out(SVG.monochrome, 108 * k, 108 * k, path.join(dir, 'ic_launcher_monochrome.png'));
}
await out(SVG.full, 512, 512, path.join(here, 'play-store-icon-512.png')); // 32-bit RGBA, as Play requires

await browser.close();
// Play Console asks for a 32-bit PNG; Chromium writes opaque shots as 24-bit RGB. Re-encode with ImageMagick.
const playIcon = path.join(here, 'play-store-icon-512.png');
const im = spawnSync('convert', [playIcon, '-strip', '-define', 'png:exclude-chunks=date,time', `PNG32:${playIcon}`], { stdio: 'inherit' });
if (im.status !== 0) console.warn('android:icons — WARNING: ImageMagick `convert` missing; play-store-icon-512.png is 24-bit, re-encode to PNG32 before upload.');
console.log(`android:icons — wrote ${written.length} PNGs:\n  ${written.join('\n  ')}`);
