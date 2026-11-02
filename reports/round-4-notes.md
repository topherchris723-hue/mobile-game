# Round 4 — Producer notes (input for /retro; not a step-C round)

Growth polish: style guide + art briefs, economy review, VFX/audio/settings specs, procedural
audio, VFX layer, wiring + Settings screen, stage repeat rewards. QA loops: 1 → PASS
(0 B / 0 M / 2 minor). BUG-3-03 verified fixed.

## Bugs
- BUG-4-01 (MINOR, ui-developer): Tri-Burst overlay visible 167 ms after freeze_end (limit 160);
  fade started one frame late.
- BUG-4-02 (MINOR, game-designer + economy-designer; Producer for STATUS): data repeat-clear Jade
  changed (10/20/45/50/75) but GDD §9.2, ECONOMY.md §2.2 and STATUS not all updated (stale-doc
  class). Producer fixed STATUS.

## Process findings
- Path drift: Producer put VFX/audio in src/vfx and src/audio (playbook lanes) while GDD said
  src/ui/vfx|audio; the validator hardcoded the GDD path and had to be fixed mid-round.
- Producer prompt said licence "team-made"; GDD rule 13 requires "self-made" (audio-designer
  followed GDD and flagged it).
- Prompt asked for "OFL Google Fonts" but CREDITS.md doesn't allow OFL without owner approval
  (art-director flagged; Producer kept system fonts).
- GDD §17 froze an R3 baseline (camera flash alpha 1.0) that violated §17's own 0.9 cap.
- Screenshot helpers (ui-developer and QA) still pointed at the previous round's folder; QA
  overwrote round-3 evidence (restored).
- ui-developer's round-3 hook gate still allowed hooks in development mode; caught by re-reading
  the upgraded playbook (good: playbook upgrade worked).
- Producer WIP commits again picked up agents' files mid-mutation-test (audio-designer verified
  no broken version was committed).
- Usage limit hit once this round (vfx-developer); safety-net check-in delivered ~3 h late.
- Owner asked about duration ("4 resets"); Producer trimmed scope (placeholder art → round 5)
  and republished the playtest before QA so the owner could hear audio sooner.
- Perf margin AC-17.7 < 1 ms at 4× throttle; WebGL unmeasurable without GPU.

## Agent lesson candidates (summary)
- art-director: check licences against CREDITS allowed list before recommending; check size
  targets against approved layout; silhouette test on placeholders too; prove asset searches
  can fail.
- audio-designer: check "unchanged" values during the effect window; confirm mutations applied;
  mutate on a scratch copy; real-browser render with peak/RMS per sound.
- vfx-developer: event-log hashes include the tick; check frozen baselines against limits.
- economy-designer: Jade/min table whenever rewards change; scratch checks handed to the test
  owner; flag proxy limits.
- content-designer: no automatic check that harder stages pay ≥ per minute.
- ui-developer: start "within N ms" transitions in the event frame with one frame margin; pin
  the exact security gate expression in a test; screenshot folder from one round constant;
  positive control before every "0 events" test.
- qa-tester: round constant for screenshot output; reset persistent hooks per scenario; writable
  spies; ≥7,000 decisions per tier on fresh seeds.
- Producer: quote GDD values exactly in prompts; when changing a GDD path, list scripts/tests that
  read it; data change ⇒ GDD/ECONOMY/STATUS in the same hand-off.

## Owner feedback
- "How long is this step its been going for 4 resets now" — concern about speed; no rule
  requested. Producer offered options (trim scope, lighter rounds, bigger plan); owner chose none.
