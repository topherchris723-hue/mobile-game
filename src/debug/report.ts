import { BUILD_ID, BUILD_TIME } from '../core/buildInfo';
import type { LogEntry } from './log';

/** Plain-text report the owner can copy from the phone and paste back into a bug report. */
export function buildReport(title: string, entries: readonly LogEntry[]): string {
  const lines = [
    `Shattered Sovereigns — ${title}`,
    `Build: ${BUILD_ID} (${BUILD_TIME})`,
    `URL: ${location.href}`,
    `Device: ${navigator.userAgent}`,
    `Screen: ${window.innerWidth}×${window.innerHeight} CSS px @ ${window.devicePixelRatio}x`,
    '',
    ...entries.map((e) => `[${(e.time / 1000).toFixed(2)}s] ${e.level.toUpperCase()} ${e.message}`),
  ];
  return lines.join('\n');
}

/**
 * Copies text to the clipboard. The game is always served over HTTPS and this runs from a tap,
 * which is what Android Chrome requires; on failure the caller says so and the error panel's
 * text stays selectable for a manual copy.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
