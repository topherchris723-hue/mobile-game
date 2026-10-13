/**
 * Tracks whether the game may run: the tab must be visible and the phone upright (portrait).
 * The rotate prompt itself is pure CSS; this only pauses and resumes the loop (CLAUDE.md §6).
 */
export function watchPlayability(onChange: (playable: boolean) => void): () => void {
  const landscape = window.matchMedia('(orientation: landscape)');
  let last: boolean | null = null;

  const evaluate = (): void => {
    const playable = document.visibilityState === 'visible' && !landscape.matches;
    if (playable === last) return;
    last = playable;
    document.body.dataset['paused'] = String(!playable);
    onChange(playable);
  };

  document.addEventListener('visibilitychange', evaluate);
  landscape.addEventListener('change', evaluate);
  evaluate();
  return () => {
    document.removeEventListener('visibilitychange', evaluate);
    landscape.removeEventListener('change', evaluate);
  };
}
