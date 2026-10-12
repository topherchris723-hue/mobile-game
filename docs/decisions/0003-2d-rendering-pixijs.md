# 0003 — 2D side-view rendering with PixiJS

- **Status:** Accepted (version pinned in M1; budgets confirmed by the M1 on-device test)
- **Date:** 2026-10-12
- **Supersedes:** `0002-3d-rendering-threejs.md`

## Context

The owner switched Rift Duel from a 3D arena to **2D**. The game is a real-time landscape duel with lots of effects (blasts, auras, hit sparks, slow-motion) that must hold 60 fps on mid-range Android phones in Chrome, be built entirely from code in the cloud, and accept art the owner or a hired artist can produce without specialised tools.

## Options considered

| Option             | Notes                                                                                                                                                                        | Verdict    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **PixiJS (WebGL)** | Fast batched sprite rendering, particle containers, filters, texture atlases, small API. A renderer, not a framework, so game structure stays ours (matches `CLAUDE.md` §3). | **Chosen** |
| Phaser             | Full framework (scenes, physics, tweens, input). Its scene/game-object model would fight our separate simulation layer, and we'd use little of the rest.                     | Not chosen |
| Plain Canvas 2D    | No dependency, but no GPU batching; effect-heavy scenes struggle on mid-range phones.                                                                                        | Rejected   |

### Character animation format

| Format                                            | Notes                                                                                                                                                    | Verdict                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Frame-by-frame sprite sheets**                  | The standard for anime fighters; any drawing app works (including on a phone); artists widely available. Costs texture memory, managed by atlas budgets. | **Chosen** for final art       |
| Skeletal (e.g. Spine)                             | Smooth and memory-light, but the editor is a paid desktop tool — breaks the phone-only workflow.                                                         | Rejected                       |
| Code-driven cut-out (layered parts posed in code) | No external assets needed. Looks stiffer than drawn frames.                                                                                              | Used for **placeholders** only |

## Decision

- PixiJS renders the arena, fighters, effects, and summon scenes.
- Fighters animate from sprite sheets following a written sprite spec (canvas size, foot anchor, facing right, frames per clip, clip names). Placeholders are code-drawn cut-out figures using the same clip names, so real art drops in without code changes.
- Three lanes are drawn as depth rows with slight scale and vertical offset; draw order is sorted by lane.
- HTML/CSS overlays handle text-heavy UI and menus.

## Consequences

- Much lighter than 3D: smaller downloads, lower GPU load, less heat and battery drain.
- Art is far more achievable; the owner can draw fighters on the phone.
- Texture memory is the main budget to watch (about two 2048² atlas pages per fighter for the 74-frame sprite spec, so battle atlases use GPU-compressed KTX2/Basis textures to stay ≤ 128 MB in a duel); the M1 test confirms it on the owner's phone.
- A move to 3D later would mean rewriting the presentation layer only — the simulation is renderer-independent.
