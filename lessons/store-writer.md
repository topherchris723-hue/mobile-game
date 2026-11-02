# Lessons — store-writer

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

(no lessons yet)

### L-sw-001: Store screenshots come from the release build at store size, never from QA evidence
Seen: 1 (round 6)
Severity of what it caused: MINOR (existing screenshots unusable)
What happened: Round 6 — the existing screenshots showed test-hook values, and 430×932 breaks Play's 2:1
  aspect limit.
Root cause: QA evidence was assumed reusable as marketing images.
Rule: The screenshot plan specifies 9:16 at 1080×1920 from a release build with no hooks and real play
  values. Never reuse `reports/screenshots/`.
Status: ACTIVE

### L-sw-002: Character counts without a shell are NOT VERIFIED
Seen: 1 (round 6)
Severity of what it caused: MINOR (the Producer had to count)
What happened: Round 6 — the store-writer has no shell, so it could not count characters. The Producer
  counted (short 78/80, full ~3,074/4,000).
Root cause: A limit check was required, but the agent had no tool to run it.
Rule: Report counts as "NOT VERIFIED (no shell)" and give the exact command for the Producer, e.g.
  `node -e "…length"` per field, as in L-gd-005.
Status: ACTIVE
