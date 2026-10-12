# 0001 — Mobile web (HTML5 + TypeScript) as the target platform

- **Status:** Accepted (engine/rendering library still to be chosen per game — see "Open questions")
- **Date:** 2026-10-12

## Context

The owner develops and tests the game **entirely from an Android phone**. There is no desktop machine available, so the workflow must not depend on any desktop-only tool. Code is written by Claude in a cloud environment and pushed to GitHub.

## Options considered

| Option | Can be built from the phone? | Can be tested on the phone? | Verdict |
| --- | --- | --- | --- |
| Native Android (Kotlin, Android Studio) | No — needs a desktop IDE, or CI-built APKs side-loaded for every change | Only via repeated APK installs | Rejected: slow loop, no on-device debugging |
| Unity / Godot | Only via CI export; editor is desktop-only | Via exported web/APK builds | Rejected: editor-centric workflows can't be used, scene files are hard to edit as text |
| Roblox | No — Roblox Studio is Windows/macOS only | Can play, can't publish changes | Rejected under the phone-only constraint |
| **Mobile web (TypeScript, built in CI, hosted on GitHub Pages)** | **Yes** — all source is text, built in the cloud | **Yes** — open a URL in Chrome; installable as a PWA | **Chosen** |

## Decision

Build the game as a mobile-first web game in TypeScript, built and deployed by GitHub Actions to a URL the owner opens in Android Chrome. Ship it as an installable PWA so it runs fullscreen from the home screen and works offline.

## Consequences

- Every branch can be played from a URL — the fastest possible test loop from a phone.
- No access to browser devtools on the device, so in-game diagnostics (debug overlay, on-screen error capture) are mandatory. See `CLAUDE.md` §8.
- Performance must be managed carefully on mid-range phones (canvas/WebGL budgets, garbage collection). See `CLAUDE.md` §7.
- A Play Store release later remains possible by wrapping the PWA (Trusted Web Activity), without rewriting the game.

## Open questions

- ~~Rendering approach~~ — resolved in `0003-2d-rendering-pixijs.md` (2D with PixiJS).
