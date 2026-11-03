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

### L-sw-003: Store files contain only player-facing copy; refer to banned or placeholder words by GDD section
Seen: 2 (round 7: BUG-7-02 — internal notes in `store/listing.md` used "working title" and "placeholder";
  round 7b: "martial-arts" in the listing hit the banned-term grep, and the Producer reworded it)
Severity of what it caused: MINOR
What happened: The listing file mixed internal notes with store copy, and its wording tripped both the
  placeholder sweep (L-shared-023) and the GDD §3 banned-term grep.
Root cause: Store-writer has no shell, so it could not run the sweeps on its own text. Notes about banned
  or placeholder words quoted the words themselves.
Rule: `store/*.md` files hold only text meant for the store, plus a clearly marked "Notes for the
  Producer" block that never quotes a banned, placeholder or old-title word (write "the GDD §3 term" or
  "the old title" instead). Before hand-off, check the copy against GDD §3 read fresh, and give the
  Producer the exact sweep commands to run (banned-term grep and
  `grep -niE 'prototype|placeholder|working title|TBD|TODO|lorem|test' store/`) as "NOT VERIFIED (no
  shell)" (L-sw-002).
Status: PROMOTED (round 7)
