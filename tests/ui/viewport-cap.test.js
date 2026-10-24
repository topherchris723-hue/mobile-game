// ui-developer round 7 (reviewer R-2, AC-17.7): the Canvas 2D renderer draws at most 1.5 device px per logical px;
// WebGL keeps the round-6 resolution (up to 2×).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computeViewport, CANVAS_MAX_ZOOM } from '../../src/ui/layout.js';
import { ROOT } from '../helpers/load-data.js';

describe('render resolution cap', () => {
  it('360×640 at dpr 2: Canvas 540×960 (zoom 1.5), WebGL 720×1280 (zoom 2)', () => {
    const c = computeViewport(360, 640, 2, CANVAS_MAX_ZOOM);
    expect([c.zoom, c.canvasW, c.canvasH]).toEqual([1.5, 540, 960]);
    const w = computeViewport(360, 640, 2);
    expect([w.zoom, w.canvasW, w.canvasH]).toEqual([2, 720, 1280]);
  });
  it('the cap never raises the zoom (dpr 1 stays 1) and the logical size is unchanged', () => {
    expect(computeViewport(360, 640, 1, CANVAS_MAX_ZOOM).zoom).toBe(1);
    expect(computeViewport(430, 932, 3, CANVAS_MAX_ZOOM).H).toBe(computeViewport(430, 932, 3).H);
  });
  it('main.js passes the cap for the Canvas renderer (forced or no WebGL)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
    expect(src).toMatch(/computeViewport\([^)]*useCanvas \? CANVAS_MAX_ZOOM : undefined\)/);
    expect(src).toMatch(/type: useCanvas \? Phaser\.CANVAS : Phaser\.AUTO/);
  });
  it('must-FAIL: without the cap Canvas would render at 2×', () => {
    expect(computeViewport(360, 640, 2).zoom).toBeGreaterThan(CANVAS_MAX_ZOOM);
  });
});
