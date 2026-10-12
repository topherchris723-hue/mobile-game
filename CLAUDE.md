# CLAUDE.md — Development Standards

Permanent working rules for this repository. Read this before every task. When a rule here conflicts with a one-off request, point out the conflict and ask before breaking it.

## 1. Mission and constraints

We are building a polished, shippable **mobile game**, not a prototype. The owner develops and tests **entirely from an Android phone**: there is no desktop, no Android Studio, no USB debugging, no `chrome://inspect`. Every decision must keep that loop working:

> Claude edits code in the cloud → pushes a branch → CI builds and deploys it → the owner opens a URL in Chrome on Android and plays it.

Consequences that are not negotiable:

- **Platform: mobile web (HTML5).** The game runs in Android Chrome and is installable as a PWA (home-screen icon, fullscreen, offline). Native toolchains (Unity, Godot export, Android Studio, Roblox Studio) are out unless the owner explicitly changes this constraint — they cannot be built or tested from the phone. See `docs/decisions/0001-mobile-web-platform.md`.
- **Every change must be playable from a URL.** If a change can't be seen on the phone, it isn't done.
- **Diagnostics must live inside the game**, because the phone has no developer tools (see §8).

## 2. How we work

Follow the phases in order and say which phase a task belongs to. Don't jump ahead without explaining why.

1. **Design** — concept, core loop, audience, art direction, progression. Recorded in `docs/design/`.
2. **Technical plan** — architecture, systems, dependencies, roadmap. Recorded in `docs/architecture.md` and `docs/decisions/`.
3. **Core prototype** — smallest complete version of the core loop, playable on the phone.
4. **Production systems** — progression, saving, content, menus, settings.
5. **Presentation** — UI, animation, VFX, audio, juice.
6. **QA** — device testing, edge cases, regression checks.
7. **Optimization** — profile on a real phone, fix measured problems.

Rules for every task:

- **Understand before writing.** Read the relevant code and docs first. Ask targeted questions when a requirement is ambiguous rather than guessing at something major.
- **Small, complete milestones.** Each one leaves `main` buildable, deployable, and playable. No half-wired features on `main`.
- **Preserve working behavior.** Don't rewrite systems unrelated to the task. If a refactor is genuinely needed, say why and keep it in its own commit.
- **Challenge weak ideas.** If a request would hurt the game, performance, or maintainability, say so and propose a better option.
- **Never fabricate progress.** Don't claim something was tested unless it actually ran. Every delivery states: *verified*, *assumed*, and *needs testing on device*.
- **No placeholder code presented as finished.** No unexplained TODOs, no references to modules that don't exist, no fake functionality. Temporary art/audio is allowed only when labeled as placeholder in code and in `docs/assets.md`.

### Delivery format for a feature

1. Approach (2–5 sentences).
2. Files added/changed and why.
3. How to test it **on the phone** (URL, steps, what you should see).
4. Edge cases and known limitations.
5. Verified / assumed / needs device testing.

## 3. Architecture

- **Language: TypeScript, `strict: true`.** No `any` without a comment justifying it. No `// @ts-ignore`.
- **Separate simulation from presentation.** Game rules (state, physics, scoring, AI) are plain TypeScript with no DOM, canvas, or audio access, so they are deterministic and unit-testable. Rendering, input, audio, and UI read that state and send commands into it.
- **Fixed-timestep simulation** (e.g. 60 Hz) with an accumulator; rendering interpolates between steps. Clamp the frame delta (e.g. max 250 ms) so a backgrounded tab doesn't cause a spiral of death.
- **One responsibility per module.** Prefer plain functions and data over class hierarchies. Add an abstraction only when there's a second real use for it.
- **Data-driven content.** Tuning values, levels, enemy stats, and rewards live in typed config files under `src/config/`, not as magic numbers inside logic.
- **Explicit lifecycles.** Anything that subscribes (event listeners, timers, tweens, audio nodes) has a matching dispose path. Scenes clean up everything they create.
- **No hidden globals.** Shared services (input, audio, save, assets) are created once at boot and passed in.

Directory layout (create folders only when they get their first real file):

```
src/
  main.ts          boot: create services, load assets, start first scene
  core/            loop, time, events, math, RNG, object pools
  game/            simulation: entities, systems, rules (no DOM)
  render/          drawing, cameras, particles, effects
  input/           touch/pointer handling, gestures, virtual controls
  ui/              menus, HUD, overlays
  audio/           sound/music playback and mixing
  save/            persistence, schema versions, migrations
  config/          tuning and content data
  debug/           on-device debug overlay, logging
public/            static assets, icons, PWA manifest
tests/
  unit/            simulation and logic tests
  e2e/             mobile-emulated browser smoke tests
docs/
  architecture.md  current system map (kept up to date)
  design/          game design notes
  decisions/       numbered architecture decision records
```

## 4. Graphics and art direction

- **One cohesive art direction**, defined in `docs/design/` before production art begins: palette (with hex values), outline/shading rules, scale of characters vs. world, font choices. Everything new must fit it.
- **Readability first on a small screen.** Gameplay-critical objects must be identifiable at a glance at arm's length: strong silhouettes, value contrast against the background, no meaning conveyed by color alone.
- **Resolution handling.** Size the renderer to the CSS viewport × `devicePixelRatio`, capped (usually at 2) and multiplied by the active quality tier's render scale. Handle resize and orientation change.
- **2D rendering (PixiJS, see `docs/decisions/0003-2d-rendering-pixijs.md`).** All sprites come from texture atlases; fighters animate frame-by-frame from sprite sheets that follow the sprite spec (anchor at the feet, facing right, named clips). Destroy textures and display objects when a scene unloads.
- **Asset pipeline.** Atlas pages ≤ 2048², at most one page per fighter. Images as WebP/PNG; SVG only for UI icons. Audio as OGG/M4A at sensible bitrates. Track every asset's source and license in `docs/assets.md`. Never use assets we don't have rights to.
- **No generic "AI look".** Avoid random gradients, glow on everything, oversized rounded buttons, inconsistent spacing. UI follows a defined system: spacing scale, type scale, button states (idle, pressed, disabled, loading), panel styles.

## 5. Animation and game feel

- **Every player action gets immediate feedback** (within the same frame where possible): visual response, sound, and where appropriate a short haptic via `navigator.vibrate` (respect the settings toggle).
- **Use easing, never linear motion for UI.** Standard durations: 120–180 ms for presses and small UI changes, 200–350 ms for panels and transitions. Define them once as constants.
- **Juice in moderation.** Screen shake, hit-stop, particles, and flashes are tuned and capped; a "Reduce motion" setting disables shake and flashing. Never flash more than 3 times per second.
- **Animation is driven by game time**, not wall-clock time, so pausing and slow-motion work consistently.

## 6. Touch controls

- **Designed for two thumbs in landscape.** Movement and guard on the left half, cards and actions on the right half, all within comfortable thumb reach of the lower corners. Touch targets are at least **48 × 48 CSS px** with at least 8 px between them.
- **Use Pointer Events** (`pointerdown/move/up/cancel`) with `setPointerCapture`, and support multi-touch by tracking `pointerId`. Always handle `pointercancel`.
- **Kill browser interference on the game surface:** `touch-action: none`, `user-select: none`, `-webkit-tap-highlight-color: transparent`, prevent the context menu on long press, no pull-to-refresh / overscroll (`overscroll-behavior: none`).
- **Respect safe areas.** `viewport-fit=cover` plus `env(safe-area-inset-*)` padding for HUD and controls so nothing is hidden behind notches, rounded corners, or the gesture bar.
- **Gestures** (swipes, holds) have tuned distance/time thresholds defined once in config, a visible response the moment they're recognised, and must never conflict with each other (a short swipe must not also count as a hold).
- **Buttons and cards** have a visible pressed state and a forgiving hit radius.
- **Input is buffered and sampled into the simulation step**, never applied directly from event handlers into game state.
- **Pause automatically** on `visibilitychange` (app switch, notification shade, screen lock) and on orientation change if the layout needs it.
- The game is **landscape-only**: request landscape lock where the browser allows it (installed PWA / fullscreen) and show a "rotate your phone" screen in portrait, pausing the game.

## 7. Performance

Baseline device: a **mid-range Android phone** (≈4 GB RAM, mid-tier GPU) in Chrome. If it's smooth there, it's smooth everywhere we care about.

Budgets:

| Metric | Target |
| --- | --- |
| Frame rate | 60 fps sustained; never below 30 |
| Frame time (JS) | ≤ 8 ms per frame for update + render calls |
| Initial download | ≤ 5 MB (gzipped) before the first interactive screen; battle assets streamed after |
| Draw calls (duel) | ≤ 100 per frame |
| Texture memory (duel) | ≤ 128 MB, measured on device |
| Time to interactive | ≤ 3 s on 4G |
| Memory | No growth over a 10-minute session |

Practices:

- **No allocations in the hot loop.** Reuse vectors, arrays, and objects; pool entities, particles, and projectiles.
- **Batch draws** and minimize state and material changes; use particle containers for effects; avoid per-frame resizes, filters on large areas, and texture uploads mid-battle (preload everything a duel needs before it starts).
- **Quality tiers** (low/medium/high) adjust render scale, effect density, and bloom; picked automatically from measured frame time, overridable in Settings.
- **Cull** off-screen objects from update and render where it's safe.
- **Lazy-load** non-essential assets after the first playable screen.
- **Battery and heat matter.** Stop the loop when paused or hidden; don't render static menus at 60 fps.
- **Measure, don't guess.** Optimize what the on-device debug overlay (§8) shows is slow, and report before/after numbers.

## 8. Debugging (phone-only)

Because there are no devtools on the phone, the game ships with built-in diagnostics:

- **Debug overlay**, enabled with `?debug=1` in the URL (never visible to normal players): FPS, frame-time graph, entity/particle counts, current scene, and a scrollable log of recent messages.
- **Error capture.** `window.onerror` and `unhandledrejection` are caught and shown on screen in debug builds (message, stack, build id), with a "copy" button so the owner can paste errors back to Claude.
- **Build id** (commit SHA) is shown in the settings screen and the debug overlay, so every bug report maps to an exact commit.
- **Structured logging** through one logger (`debug/log.ts`) with levels; no stray `console.log` left in committed code.
- **Reproducibility.** Use a seeded RNG for gameplay so bugs can be replayed from a seed.

## 9. Testing and verification

Before any push, Claude runs everything that can run in the cloud:

1. **Typecheck** — no errors.
2. **Lint/format** — clean.
3. **Unit tests** (Vitest) — simulation, rules, scoring, save migrations. Every bug fix in game logic gets a regression test.
4. **Build** — production build succeeds and stays within the size budget.
5. **Mobile smoke test** (Playwright with Chromium in an Android phone emulation profile) — the game boots without console errors, reaches the first playable screen, and responds to simulated taps. Screenshots are saved as CI artifacts.

Then the **owner** verifies on the real phone using the deployed preview URL. Claude provides a short checklist per change covering: the feature itself, rotating to portrait and back, app switch and return, audio after resume, and frame rate in the debug overlay.

Emulated tests are not proof that it works on a real device. Report them as "passed in emulation", never as "works on Android".

## 10. Persistence

- Save data lives in `localStorage` (or IndexedDB if it outgrows that) under a single versioned key.
- Every save has a `schemaVersion`; loading runs migrations in order. Never break existing saves — add a migration and a test for it.
- Validate loaded data; a corrupted save falls back to defaults with a logged warning, never a crash.
- Save on meaningful events and on `visibilitychange` → hidden (mobile browsers may kill the tab without warning).
- Any future online features must be server-authoritative; the client is never trusted with currency, rewards, or leaderboard scores.

## 11. Gameplay systems

- **The core loop comes first.** No meta systems (shops, currencies, daily rewards) until the core loop is fun on the phone.
- Every mechanic needs a clear purpose, readable feedback, and a reason to make decisions. More features ≠ better game.
- **Onboarding by play**, not walls of text: teach one idea at a time in the first minute.
- Tuning values are centralized in `src/config/` so balance changes are one-line edits.
- Session length fits mobile play: a meaningful run or level in 1–5 minutes, safe to quit at any point.
- **Accessibility:** settings for sound, music, haptics, and reduced motion; colorblind-safe palettes for critical information; text readable at ≥ 14 CSS px.
- Never copy another game's distinctive assets, branding, or levels.

## 12. Git and repository hygiene

- Develop on the designated feature branch; never push directly to `main` unless asked.
- Commits are focused, with imperative-mood messages explaining *why* (e.g. "Clamp frame delta to prevent catch-up stutter after resume").
- Don't commit build output, `node_modules`, secrets, or large binaries that aren't game assets.
- Keep `docs/architecture.md` current whenever a system is added or changed. Record significant technical decisions as a new file in `docs/decisions/`.
- Dependencies: add only when they clearly earn their weight; pin versions; note why in the PR.

## 13. Project commands

The toolchain is set up in the first implementation milestone, once the game concept is agreed. When it is, this section lists the exact commands for install, dev, typecheck, lint, test, e2e, and build, and the URL where each branch is deployed for phone testing.

Current state: **no game code yet** — the repository contains standards and documentation only. Design: `docs/design/game-design.md`; plan: `docs/roadmap.md`.
