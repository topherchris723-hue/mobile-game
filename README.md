# Shattered Sovereigns

A mobile-first web game, developed and play-tested entirely from an Android phone.

## How it works

1. Changes are written and pushed to a branch.
2. CI typechecks, tests, builds, and deploys the branch.
3. Open the deployed URL in Chrome on Android to play it — or install it to the home screen as an app.

## Project status

A turn-based anime team battler with character collection (**Rift Timeline** battles), set in an original multiverse and played in portrait with one hand. Milestone 1 (foundation + arena test) is built; see `docs/roadmap.md`.

## Play it

- Latest `main`: https://topherchris723-hue.github.io/mobile-game/
- Branch previews: `https://topherchris723-hue.github.io/mobile-game/preview/<branch>/`
- Add `?debug=1` for the FPS overlay, `?debug=1&bench=1` for the stress benchmark.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — development standards (architecture, graphics, animation, touch controls, performance, debugging, testing).
- [`docs/design/game-design.md`](docs/design/game-design.md) — game design document.
- [`docs/roadmap.md`](docs/roadmap.md) — milestone plan.
- [`docs/architecture.md`](docs/architecture.md) — current system map.
- [`docs/decisions/`](docs/decisions/) — architecture decision records.
- [`docs/assets.md`](docs/assets.md) — asset sources and licenses.
