import { BUILD_ID } from '../core/buildInfo';
import type { LogEntry, Logger } from './log';
import { buildReport, copyText } from './report';

export interface DebugStats {
  readonly renderer: string;
  readonly resolution: number;
  readonly logicalWidth: number;
  readonly displayObjects: number;
  readonly fighters: number;
  readonly scene: string;
}

export interface DebugOverlay {
  /** Record one frame: wall time since the previous frame and time spent in update + render. */
  recordFrame(frameDeltaMs: number, workMs: number): void;
  /** Supplier is called a few times per second, never every frame. */
  setStatsSource(source: () => DebugStats): void;
}

const REFRESH_MS = 500;
const GRAPH_SAMPLES = 120;
const GRAPH_MAX_MS = 50;

/** `?debug=1` overlay: FPS, frame-time graph, scene stats, build id, and recent log lines. */
export function createDebugOverlay(log: Logger): DebugOverlay {
  const panel = document.createElement('aside');
  panel.className = 'debug-overlay';
  panel.innerHTML = `
    <div class="debug-row"><strong class="debug-fps">-- fps</strong><span class="debug-work"></span></div>
    <canvas class="debug-graph" width="${GRAPH_SAMPLES}" height="40"></canvas>
    <pre class="debug-stats"></pre>
    <ol class="debug-log"></ol>
    <button type="button" class="debug-copy">Copy report</button>`;
  panel.title = 'work = update + render time per frame (avg / max)';
  document.body.appendChild(panel);

  const query = <T extends Element>(selector: string, type: abstract new () => T): T => {
    const element = panel.querySelector(selector);
    if (!(element instanceof type)) throw new Error(`Debug overlay is missing ${selector}`);
    return element;
  };
  const fpsLabel = query('.debug-fps', HTMLElement);
  const workLabel = query('.debug-work', HTMLElement);
  const statsLabel = query('.debug-stats', HTMLElement);
  const logList = query('.debug-log', HTMLOListElement);
  const copyButton = query('.debug-copy', HTMLButtonElement);
  const graph = query('.debug-graph', HTMLCanvasElement).getContext('2d');

  const frameTimes = new Float32Array(GRAPH_SAMPLES);
  let cursor = 0;
  let frames = 0;
  let workTotal = 0;
  let workMax = 0;
  let windowStart = performance.now();
  let statsSource: (() => DebugStats) | null = null;

  const appendLog = (entry: LogEntry): void => {
    const item = document.createElement('li');
    item.className = `debug-log-${entry.level}`;
    item.textContent = entry.message.split('\n')[0] ?? '';
    logList.appendChild(item);
    while (logList.childElementCount > 30) logList.firstElementChild?.remove();
    logList.scrollTop = logList.scrollHeight;
  };
  log.entries().forEach(appendLog);
  log.subscribe(appendLog);

  copyButton.addEventListener('click', () => {
    void copyText(buildReport('debug report', log.entries())).then((ok) => {
      copyButton.textContent = ok ? 'Copied' : 'Copy failed';
      window.setTimeout(() => (copyButton.textContent = 'Copy report'), 1500);
    });
  });

  const drawGraph = (): void => {
    if (!graph) return;
    graph.clearRect(0, 0, GRAPH_SAMPLES, 40);
    // 16.7 ms (60 fps) and 33.3 ms (30 fps) guide lines.
    graph.fillStyle = 'rgb(254 243 223 / 0.25)';
    for (const ms of [1000 / 60, 1000 / 30])
      graph.fillRect(0, 40 - (ms / GRAPH_MAX_MS) * 40, GRAPH_SAMPLES, 1);
    for (let i = 0; i < GRAPH_SAMPLES; i++) {
      const ms = frameTimes[(cursor + i) % GRAPH_SAMPLES] ?? 0;
      const h = Math.min(40, (ms / GRAPH_MAX_MS) * 40);
      graph.fillStyle = ms > 1000 / 30 ? '#f34f58' : ms > 1000 / 55 ? '#f5c542' : '#5dbb46';
      graph.fillRect(i, 40 - h, 1, h);
    }
  };

  return {
    recordFrame(frameDeltaMs, workMs) {
      frameTimes[cursor] = frameDeltaMs;
      cursor = (cursor + 1) % GRAPH_SAMPLES;
      frames++;
      workTotal += workMs;
      workMax = Math.max(workMax, workMs);

      const now = performance.now();
      const elapsed = now - windowStart;
      if (elapsed < REFRESH_MS) return;
      fpsLabel.textContent = `${Math.round((frames * 1000) / elapsed)} fps`;
      workLabel.textContent = `${(workTotal / frames).toFixed(1)} / ${workMax.toFixed(1)} ms`;
      if (statsSource) {
        const s = statsSource();
        statsLabel.textContent = [
          `${s.scene} · ${s.fighters} fighters · ${s.displayObjects} obj`,
          `${s.renderer} ${s.resolution}x · ${window.innerWidth}×${window.innerHeight} · ${BUILD_ID}`,
        ].join('\n');
      }
      drawGraph();
      frames = 0;
      workTotal = 0;
      workMax = 0;
      windowStart = now;
    },
    setStatsSource(source) {
      statsSource = source;
    },
  };
}
