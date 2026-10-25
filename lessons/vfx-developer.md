# Lessons — vfx-developer

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

(no lessons yet)

### L-vfx-001: Effects stay inside the absolute frame budget on the low-end proxy
Seen: 1 (round 6: reviewer R-2 MAJOR)
Severity of what it caused: MAJOR (reviewer FAIL)
What happened: R-2 — with the round-4 VFX layer and round-5 art, AC-17.7 failed at 4× CPU throttle
  (p95 36.5–50.1 ms vs 33.3). The playbook budget ("60 fps on a mid-range phone, < 300 particles") was
  never measured on the GDD's low-end proxy.
Root cause: The VFX budget was stated for a different device than the AC, and it was measured
  unthrottled.
Rule: Before finishing any effect change, run the AC-17.7 check: median p95 of ≥ 5 runs at 4× CPU,
  Canvas, busiest battle. Report it. Over 33.3 ms = not finished (reduce particles, pool, bake, or
  degrade under load).
Status: PROMOTED (round 6)
