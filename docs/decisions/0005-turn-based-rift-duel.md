# 0005 — Turn-based Rift Duel replaces Rift Timeline

- **Status:** Accepted
- **Date:** 2026-10-12
- **Supersedes:** the Rift Timeline battle design in `0004-portrait-turn-based.md` (portrait and turn-based remain).

## Context

Before any Rift Timeline code was written, the owner specified the combat they want: turn-based, **teams of 3**, **1 v 1 on the field**, **switching**, **automatic switch when a fighter is knocked out**, and **3 attack cards to choose from** (in the spirit of Dragon Ball Legends). They then chose: alternating turns, free switching once per turn, and cards drawn from the active fighter's own deck.

## Decision

Battles follow `../design/game-design.md` §4 (turn-based Rift Duel): shared Rift Energy per team, hands of 3 from each fighter's 6-card deck (Strike ×2, Blast ×2, Technique, Signature), Charge, Tag Link energy for cross-world switches, deterministic damage with on-card previews, and an enemy that plays by the same rules.

## Consequences

- The simulation is a pure, event-producing rules module: each action returns a list of events (damage, switch, KO, energy…) that the presentation layer plays back in order. This keeps rules unit-testable and makes AI-controlled PvP (Rift Arena) straightforward later.
- Text-heavy battle UI (cards, HP, energy, bench) is HTML/CSS for crisp text and accessibility; fighters and effects stay in PixiJS.
- The M1 tap-to-select battlefield test is replaced by the M2 battle; its code is removed.
- Sprite clips from art-style.md §10.2 still fit (strike, skill → technique, super → signature, hit, guard, ko, victory).
