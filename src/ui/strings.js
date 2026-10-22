// UI strings (for future translation). Content names (fighters, cards, stages, story) come from data/*.json.
import table from './strings.json';

/** t('key', { var: value }) → string with {var} placeholders filled. Missing keys show as [key]. */
export function t(key, vars) {
  let s = table.strings[key];
  if (s === undefined) return '[' + key + ']';
  if (vars) {
    for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  }
  return s;
}

/** True if the strings table has this key (use before showing a key built from a logic enum). */
export function hasString(key) {
  return table.strings[key] !== undefined;
}
