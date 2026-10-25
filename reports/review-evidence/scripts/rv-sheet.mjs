import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 })).newPage();
await p.goto('http://127.0.0.1:4302/?test&renderer=canvas'); await p.waitForTimeout(1500);
for (const m of ['color', 'umbral']) { await p.evaluate((m) => window.__TEST__.silhouetteSheet(m), m); await p.waitForTimeout(400); await p.screenshot({ path: process.argv[2] + '/sheet-' + m + '.png' }); }
await b.close();
