// QA round 2 helpers (owned by qa-tester). Layout scanning, save injection, multi-size contexts.
import fs from 'node:fs';
import path from 'node:path';

// Round 3: screenshots only with QA_SHOTS=1 (or UI_SHOTS=1), so normal test runs never rewrite evidence.
export const QA_SHOTS = 'reports/screenshots/round-3/qa';
export const WRITE_QA_SHOTS = process.env.QA_SHOTS === '1' || process.env.UI_SHOTS === '1';
if (WRITE_QA_SHOTS) fs.mkdirSync(QA_SHOTS, { recursive: true });

export const SIZES = [
  { name: '360x640', w: 360, h: 640, dpr: 2 },
  { name: '390x844', w: 390, h: 844, dpr: 3 },
  { name: '430x932', w: 430, h: 932, dpr: 3 },
];

const read = (f) => JSON.parse(fs.readFileSync(path.join(process.cwd(), f), 'utf8'));
export const DATA = {
  economy: read('data/economy.json'),
  stages: read('data/stages.json'),
  characters: read('data/characters.json'),
};

export function freshSave() {
  const now = '2026-10-22T00:00:00.000Z';
  const e = DATA.economy;
  return {
    version: 1,
    created_at: now,
    updated_at: now,
    currencies: { ...e.starting.currencies },
    roster: e.starting.characters.map((id) => ({ character_id: id, resonance: 0, obtained_at: now })),
    team: e.starting.team.slice(),
    stages: {},
    summon: { pity: {}, first_multi_done: {}, total_pulls: 0 },
    settings: { bgm_volume: 1, sfx_volume: 1, haptics: true },
    tutorial: { completed: false },
  };
}

/** A save where stages up to `upTo` (inclusive, 1-based) are cleared with every mission. */
export function clearedSave(upTo) {
  const s = freshSave();
  for (const st of DATA.stages.stages) {
    if (st.order <= upTo) s.stages[st.id] = { cleared: true, clears: 1, best_time_s: 42.5, missions_completed: (st.missions || []).map((m) => m.id) };
  }
  s.tutorial.completed = upTo >= 1;
  s.currencies.cur_jade = 3850;
  return s;
}

export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}

export async function newPhone(browser, size) {
  const ctx = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    screen: { width: size.w, height: size.h },
    deviceScaleFactor: size.dpr,
    isMobile: true,
    hasTouch: true,
    baseURL: 'http://127.0.0.1:4173',
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

export async function boot(page, save, query = '&renderer=canvas&seed=4242') {
  await page.goto('/?test=1' + query);
  await waitScene(page, 'Title');
  if (save !== undefined) {
    await page.evaluate((s) => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
      if (s !== null) localStorage.setItem('game_save', typeof s === 'string' ? s : JSON.stringify(s));
    }, save);
    await page.reload();
    await waitScene(page, 'Title');
  }
}

export async function waitScene(page, key, timeout = 15000) {
  await page.waitForFunction((k) => window.__TEST__ && window.__TEST__.sceneKey === k && window.__TEST__.activeScene() && window.__TEST__.activeScene().scene.key === k, key, { timeout });
  await page.waitForTimeout(300);
}

export async function targets(page) {
  return page.evaluate(() => window.__TEST__.targets());
}

export async function target(page, id) {
  const all = await targets(page);
  const tg = all.find((x) => x.id === id);
  if (!tg) throw new Error('No target ' + id + ' in ' + all.map((x) => x.id).join(','));
  return tg;
}

export async function tap(page, id) {
  const tg = await target(page, id);
  await page.touchscreen.tap(tg.x + tg.w / 2, tg.y + tg.h / 2);
}

export async function shot(page, name) {
  await page.waitForTimeout(400);
  if (!WRITE_QA_SHOTS) return null;
  await page.screenshot({ path: `${QA_SHOTS}/${name}.png` });
  return `${QA_SHOTS}/${name}.png`;
}

/** Raw screenshot (busy-frame evidence), gated like shot(). */
export async function rawShot(page, file) {
  if (!WRITE_QA_SHOTS) return null;
  await page.screenshot({ path: `${QA_SHOTS}/${file}` });
  return `${QA_SHOTS}/${file}`;
}

/**
 * Scan the active scene: every visible Text (effective alpha > 0.05) with its bounds in logical units,
 * font size, and depth; plus the scene's logical W/H. Bounds include container transforms.
 */
export async function scanTexts(page) {
  return page.evaluate(() => {
    const s = window.__TEST__.activeScene();
    const out = [];
    const walk = (list, alpha, visible) => {
      for (const o of list) {
        const a = alpha * (o.alpha === undefined ? 1 : o.alpha);
        const v = visible && o.visible !== false;
        if (!v || a < 0.05) continue;
        if (o.type === 'Text' && o.text && o.text.trim()) {
          const b = o.getBounds();
          out.push({ text: o.text.replace(/\n/g, ' ').slice(0, 60), x: b.x, y: b.y, w: b.width, h: b.height, size: parseFloat(o.style.fontSize), depth: (o.parentContainer ? o.parentContainer.depth : 0) + o.depth, inContainer: !!o.parentContainer });
        }
        if (o.list) walk(o.list, a, v);
      }
    };
    walk(s.children.list, 1, true);
    return { W: s.W, H: s.H, texts: out };
  });
}

/** Problems on the current screen: text clipped off-screen, font < 12, text/text overlaps, target size/gap. */
export function layoutProblems(scan, tgs, opts = {}) {
  const probs = [];
  const { W, H, texts } = scan;
  for (const t of texts) {
    if (t.size < 12) probs.push(`font ${t.size}px < 12: "${t.text}"`);
    if (t.x < -3 || t.y < -3 || t.x + t.w > W + 3 || t.y + t.h > H + 3) /* 3 px tolerance: stroke padding */ probs.push(`text clipped off-screen: "${t.text}" [${t.x.toFixed(0)},${t.y.toFixed(0)} ${t.w.toFixed(0)}x${t.h.toFixed(0)}] screen ${W}x${H}`);
  }
  const shrink = 2; // ignore glyph-padding touches; stroke adds a few px
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      if (opts.ignore && (opts.ignore(a) || opts.ignore(b))) continue;
      if (opts.overlayDepth !== undefined && (a.depth < opts.overlayDepth || b.depth < opts.overlayDepth)) continue; // under a modal overlay
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) - shrink * 2;
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) - shrink * 2;
      if (ox > 0 && oy > 0) probs.push(`text overlap: "${a.text}" × "${b.text}" (${ox.toFixed(0)}x${oy.toFixed(0)} px)`);
    }
  }
  const active = tgs.filter((t) => (opts.targetFilter ? opts.targetFilter(t) : true));
  for (const t of active) {
    if (t.logical.w < 44 || t.logical.h < 44) probs.push(`target ${t.id} ${t.logical.w}x${t.logical.h} < 44`);
    if (t.logical.x < 0 || t.logical.y < 0 || t.logical.x + t.logical.w > W + 0.5 || t.logical.y + t.logical.h > H + 0.5) probs.push(`target ${t.id} off-screen`);
  }
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i].logical;
      const b = active[j].logical;
      const gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
      const gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
      const gap = Math.max(gx, gy);
      if (gap < 8 - 0.01) probs.push(`targets ${active[i].id} / ${active[j].id} gap ${gap.toFixed(1)} px < 8`);
    }
  }
  return probs;
}

export async function battle(page) {
  return page.evaluate(() => window.__TEST__.battleState());
}
