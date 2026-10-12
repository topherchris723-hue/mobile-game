# 0006 — One illustration per fighter, animated in code

- **Status:** Accepted
- **Date:** 2026-10-12
- **Replaces:** the frame-by-frame battle sprite spec in art-style.md §10.2 and the sprite-sheet part of `0003-2d-rendering-pixijs.md`.

## Context

The owner asked why the game doesn't yet look like the locked art style. Painterly HD anime art cannot be produced in code; it needs real illustrations. The original spec asked for 56 hand-drawn animation frames per fighter, which makes every new Sovereign expensive. The owner chose: hire an artist later, improve the placeholders now, and animate **one illustration per fighter** in code.

## Decision

- Each Sovereign's battle art is a single 1024² transparent PNG (art-style.md §10.2).
- All battle motion is code: idle breathing, lunges, projectiles, hit recoil and tint flashes, guard shields, auras, knockouts, cut-ins.
- Placeholders are drawn in code once per fighter, **baked into a texture**, and animated through exactly the same path — so real art is a drop-in replacement.

## Consequences

- About 56× less character art per Sovereign; a roster of 15 needs 15 illustrations (+ splash art).
- Much lower texture memory (one 1024² texture per fighter).
- Limb-level animation (e.g. arms raising to guard) is replaced by whole-figure motion plus effects. A layered (PSD) variant can be added later if needed.
