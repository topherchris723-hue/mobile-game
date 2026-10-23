// Playwright test hooks (window.__TEST__) — only in dev (`vite`) or in a build made with VITE_TEST_HOOKS=1
// (playwright.config.js sets it for its own build). In a normal `npm run build` both checks are compile-time
// false, so the bundler drops every hook branch and the release bundle contains no "__TEST__" at all
// (proved by tests/ui/release-bundle.test.js). Never read window.__TEST__ directly: use testHooks().

const env = import.meta.env || {};

/** Compile-time constant: true only in dev or a test build. */
export const TEST_HOOKS = !!(env.DEV || env.VITE_TEST_HOOKS === '1');

/** Create the hook object (main.js, when the URL has ?test). Returns null in release builds. */
export function installTestHooks() {
  if (!TEST_HOOKS) return null;
  window.__TEST__ = { sceneKey: null, sfxLog: [], errors: [] };
  return window.__TEST__;
}

/** The hook object, or null (release build, or no ?test in the URL). */
export function testHooks() {
  if (!TEST_HOOKS) return null;
  return (typeof window !== 'undefined' && window.__TEST__) || null;
}

/** A numeric URL parameter that only test builds honour (fixed battle / summon seeds). Null otherwise. */
export function testSeedParam(name) {
  if (!TEST_HOOKS) return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('test') || !params.has(name)) return null;
  return Number(params.get(name)) >>> 0;
}
