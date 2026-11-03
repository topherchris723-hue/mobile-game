// Reviewer probe: with Pause / Retreat confirm / Summon rates open, taps on the controls underneath do nothing.
import { chromium } from '@playwright/test';
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const p = await (await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://127.0.0.1:4302/?test&renderer=canvas'); await p.waitForTimeout(1500);
const T = () => p.evaluate(() => window.__TEST__.targets());
const tap = async (id, w = 600) => { const t = (await T()).find((x) => x.id === id); if (!t) throw new Error('no ' + id); await p.touchscreen.tap(t.x + t.w / 2, t.y + t.h / 2); await p.waitForTimeout(w); };
await tap('start'); await tap('home_story'); await tap('stage_stage_001', 900); await tap('dialogue_skip', 900); await tap('team_fight', 3000);
const snap = () => p.evaluate(() => { const s = window.__TEST__.battleState(); const t = s.teams.player; return JSON.stringify({ tick: s.tick, vigor: t.vigor, active: t.active, hand: t.hand || null, log: (window.__TEST__.inputLog || []).length }); });
const out = {};
await tap('battle_pause', 800);
const under = (await T()).filter((x) => /^(card_|bench_|ignite|tri_burst)/.test(x.id));
let s0 = await snap();
const menus = (await T()).filter((x) => /^menu_/.test(x.id));
const inMenu = (x, y) => menus.some((m) => x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h);
out.tapped = [];
for (const u of under) for (const [x, y] of [[u.x + 3, u.y + u.h - 3], [u.x + u.w / 2, u.y + u.h / 2]]) { if (inMenu(x, y)) continue; await p.touchscreen.tap(x, y); await p.waitForTimeout(200); const open = (await T()).some((q) => q.id === 'menu_resume'); out.tapped.push(u.id + '@' + Math.round(x) + ',' + Math.round(y) + (open ? '' : ' CLOSED-MENU')); if (!open) break; }
let s1 = await snap();
out.pauseStateUnchanged = s0 === s1; out.stillPaused = (await T()).some((x) => x.id === 'menu_resume');
await tap('menu_retreat', 800);
s0 = await snap();
{ const ms = (await T()).filter((x) => /^menu_/.test(x.id)); for (const u of under) { const x = u.x + 3, y = u.y + u.h - 3; if (ms.some((m) => x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h)) continue; await p.touchscreen.tap(x, y); await p.waitForTimeout(150); } }
s1 = await snap();
out.retreatConfirmUnchanged = s0 === s1; out.confirmStillOpen = (await T()).some((x) => x.id === 'menu_retreat_yes');
out.errors = errs;
console.log(JSON.stringify(out)); await b.close();
