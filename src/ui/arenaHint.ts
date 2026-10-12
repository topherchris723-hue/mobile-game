const HINT_VISIBLE_MS = 7000;

/** One-line control reminder for the battlefield test, faded out after a few seconds. */
export function showArenaHint(): void {
  const hint = document.getElementById('arena-hint');
  if (!hint) return;
  hint.hidden = false;
  window.setTimeout(() => {
    hint.classList.add('is-leaving');
    window.setTimeout(() => (hint.hidden = true), 400);
  }, HINT_VISIBLE_MS);
}
