# 0002 — Real-time 3D with Three.js

- **Status:** Superseded by `0003-2d-rendering-pixijs.md` — the owner chose 2D before any 3D work began
- **Date:** 2026-10-12

## Context

The owner chose a real-time 3D duel game (Rift Duel, see `../design/game-design.md`) played in landscape. It must run smoothly in Android Chrome on mid-range phones, be built entirely from code in the cloud (no desktop editor), and be testable from a URL.

## Options considered

| Option | Notes | Verdict |
| --- | --- | --- |
| **Three.js** | Code-only, widely used, strong glTF support, `AnimationMixer` for skeletal animation and blending, toon materials built in, works cleanly with Vite. We build our own game structure on top. | **Chosen** |
| Babylon.js | Full engine with more built-in features (GUI, physics), but a heavier bundle and more engine conventions than this game needs. | Not chosen; reasonable fallback |
| PlayCanvas | Strong mobile performance, but its workflow centres on a web editor that isn't practical on a phone. | Rejected |
| Unity/Godot web export | Desktop editors; large web builds. | Rejected (see 0001) |

## Decision

Use **Three.js** (version pinned in M1) with:

- **glTF/GLB** models with skinned meshes and named animation clips.
- **Toon shading** (`MeshToonMaterial` or a small custom shader) with **inverted-hull outlines** — cheaper on phones than a post-processing outline pass.
- **Blob shadows** under fighters instead of real-time shadow maps by default.
- **KTX2/Basis** compressed textures once real art arrives.
- **Quality tiers** (low/medium/high) that change render scale, effects density, and optional bloom; chosen automatically from measured frame time and adjustable in Settings.
- Game rules stay in the pure TypeScript simulation; Three.js is only the presentation layer.

## Consequences

- Character art becomes the largest production cost (see design doc §9). Placeholder models keep development unblocked.
- 3D performance on the owner's phone is the biggest technical risk, so **M1 ships a benchmark scene** (arena + two animated fighters + effects) and records real FPS numbers here before we commit further.
- Download size grows with models; assets for later chapters are lazy-loaded.
