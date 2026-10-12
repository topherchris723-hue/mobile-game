import { Application, Container } from 'pixi.js';
import { LOGICAL_WIDTH, MAX_RENDER_RESOLUTION } from '../config/display';
import { SKY } from '../config/palette';

export interface StageMetrics {
  /** Visible height in logical units (width is always LOGICAL_WIDTH). */
  readonly logicalHeight: number;
  /** CSS pixels per logical unit, for converting taps. */
  readonly cssPerUnit: number;
  /** Device pixels per logical unit, used to paint static layers at full sharpness. */
  readonly pixelsPerUnit: number;
}

export interface Stage {
  readonly app: Application;
  /** Scaled so its children work in logical units. */
  readonly world: Container;
  readonly resolution: number;
  /** Fits the renderer to the host element; returns the new metrics. */
  fit(): StageMetrics;
  render(): void;
}

export async function createStage(host: HTMLElement): Promise<Stage> {
  const resolution = Math.min(window.devicePixelRatio || 1, MAX_RENDER_RESOLUTION);
  const app = new Application();
  await app.init({
    preference: 'webgl',
    powerPreference: 'high-performance',
    background: SKY.foregroundInk,
    antialias: true,
    resolution,
    autoDensity: true,
    // The game loop drives rendering; Pixi's own ticker never runs.
    autoStart: false,
    sharedTicker: false,
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
  });
  host.appendChild(app.canvas);
  const world = new Container();
  app.stage.addChild(world);

  return {
    app,
    world,
    resolution,
    fit() {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      app.renderer.resize(width, height);
      const cssPerUnit = width / LOGICAL_WIDTH;
      world.scale.set(cssPerUnit);
      return {
        logicalHeight: height / cssPerUnit,
        cssPerUnit,
        pixelsPerUnit: cssPerUnit * resolution,
      };
    },
    render() {
      app.render();
    },
  };
}

/** Counts display objects in a subtree for the debug overlay. */
export function countDisplayObjects(node: Container): number {
  let total = 1;
  for (const child of node.children) total += countDisplayObjects(child);
  return total;
}
