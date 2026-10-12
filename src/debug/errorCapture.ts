import { describeError, type Logger } from './log';
import { buildReport, copyText } from './report';

/**
 * Catches every uncaught error and rejected promise, logs it, and shows it on screen with a copy
 * button — the phone has no devtools, so this is how errors reach Claude (CLAUDE.md §8).
 */
export function installErrorCapture(log: Logger): void {
  const panel = document.getElementById('error-panel');
  const message = document.getElementById('error-message');
  const copyButton = document.getElementById('error-copy');
  const dismissButton = document.getElementById('error-dismiss');

  const show = (summary: string): void => {
    if (!panel || !message) return;
    message.textContent = summary;
    panel.hidden = false;
  };

  window.addEventListener('error', (event) => {
    const detail = describeError(event.error ?? event.message);
    log.error(`Uncaught error at ${event.filename}:${event.lineno}`, detail);
    show(detail);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const detail = describeError(event.reason);
    log.error('Unhandled promise rejection', detail);
    show(detail);
  });

  copyButton?.addEventListener('click', () => {
    void copyText(buildReport('error report', log.entries())).then((ok) => {
      copyButton.textContent = ok ? 'Copied' : 'Copy failed';
    });
  });
  dismissButton?.addEventListener('click', () => {
    if (panel) panel.hidden = true;
  });
}
