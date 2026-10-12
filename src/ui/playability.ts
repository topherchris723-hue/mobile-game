/**
 * Tracks whether the game may run: the tab must be visible and the phone in landscape.
 * The rotate prompt itself is pure CSS; this only pauses and resumes the loop (CLAUDE.md §6).
 */
export function watchPlayability(onChange: (playable: boolean) => void): () => void {
  const portrait = window.matchMedia('(orientation: portrait)');
  let last: boolean | null = null;

  const evaluate = (): void => {
    const playable = document.visibilityState === 'visible' && !portrait.matches;
    if (playable === last) return;
    last = playable;
    document.body.dataset['paused'] = String(!playable);
    onChange(playable);
  };

  document.addEventListener('visibilitychange', evaluate);
  portrait.addEventListener('change', evaluate);
  evaluate();
  return () => {
    document.removeEventListener('visibilitychange', evaluate);
    portrait.removeEventListener('change', evaluate);
  };
}
