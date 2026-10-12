# Roadmap

Each milestone is playable from a URL on the phone and leaves `main` in a working state. Order may change only with a written reason.

| # | Milestone | Playable result on the phone | Phase |
| --- | --- | --- | --- |
| M1 | **Foundation** — Vite + TypeScript + rendering library, CI (typecheck, lint, tests, build), GitHub Pages deploy, PWA manifest, debug overlay, on-screen error capture, build id | Open the link → branded boot screen; `?debug=1` shows FPS and build id; installable to home screen | Technical setup |
| M2 | **Battle core** — 6-fighter team vs. waves, tap-timing ring, types, chain multiplier, world links, enemy countdowns, win/lose | Play a full stage with placeholder fighters | Core prototype |
| M3 | **Battle feel** — Burst gauge, hold-to-Super with cut-in, damage numbers, hit effects, screen feedback, sounds, haptics | Battles feel punchy and readable | Core prototype |
| M4 | **Fighters and saving** — 15-fighter data set, roster screen, fighter detail, team editor, leader skills, versioned save system | Build a team, close the app, come back to it | Production |
| M5 | **Summons** — Gems, Standard banner, published rates, pity counter, summon animation, duplicates → shards | Spend earned gems and pull fighters | Production |
| M6 | **Story chapter 1** — story map, 8–10 stages, dialogue scenes, rewards, levelling and limit break with Coins/shards | A complete first chapter loop | Production |
| M7 | **Onboarding and polish** — guided first battle, settings (audio, haptics, reduce motion, auto-timing), UI polish pass, performance pass on device | **Playable alpha** to share | Presentation / QA |
| M8+ | **Online and monetization** — backend choice, accounts, server-side economy and summons, real-money gems, compliance | Gems purchasable; saves backed up online | Production (online) |

## Proposed technology for M1 (to be confirmed in a decision record)

- **Vite + TypeScript (strict)** for build tooling.
- **PixiJS (WebGL)** for battle, effects, and summon animations: fast sprite/particle rendering on mid-range phones.
- **HTML/CSS for menus and text-heavy screens** (crisp text, native scrolling, accessibility), sharing one design-token system with the canvas UI.
- **Vitest** for unit tests, **Playwright** (Android phone emulation) for smoke tests.

## Owner action needed in M1

Enable GitHub Pages for this repository with **Source: GitHub Actions** (repository Settings → Pages). This can be done from the phone's browser; Claude will give exact steps when M1 is ready.
