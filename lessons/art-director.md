# Lessons — art-director

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

(no lessons yet)

### L-ad-001: Check every look for franchise echoes by its colour, pattern and hair combination, not only silhouette
Seen: 2 (round 6: reviewer R-7; round 7: the round-8 prompt pack's wider compare found Solenne's
  red-and-blonde hair and Tavi's wrench echoing known side characters and fighting-game leads, which
  the round-6 check had not compared; both changed by Producer decision in 4b6bf55)
Severity of what it caused: MINOR (reviewer finding; IP risk)
What happened: R-7 — Rook's placeholder look (green body, black-and-white checkered band, spiky black
  hair) may echo a famous anime protagonist's signature pattern.
Root cause: The originality check covered names and silhouettes. The combination of signature colours,
  pattern and hair was not compared against well-known designs.
Rule: For every character look (brief or placeholder), list its signature combination (main colours,
  pattern, hair, accessory) and compare it with the top anime battle franchises' leads and rivals.
  If two or more signature elements match one known character, change one. Record the check in the
  report.
  Round 7 widening: compare with side characters as well as leads and rivals, and with the leads of
  major fighting-game series. Count props and held items as signature elements (a wrench, a cord).
Status: PROMOTED (round 6; IP rules only get stricter); re-promoted with the wider comparison set
  (round 7)

### L-ad-002: A CREDITS row is complete only when its notice exists and is shown in-game
Seen: 1 (round 6)
Severity of what it caused: MINOR (part of the compliance licence FAIL)
What happened: Round 6 — CREDITS gained a code-libraries section. The art-director's candidate was to
  verify that the notice each row points to really exists.
Root cause: CREDITS was reviewed as a list, without checking the files it references.
Rule: For every CREDITS row, check that the referenced licence/notice file exists in the build and is
  reachable from Settings → Licenses. Paste the check output.
Status: ACTIVE

### L-ad-003: Image prompts are an IP surface: no franchise phrases, no game title, no on-screen words
Seen: 1 (round 7: compliance 7b found "street fighter" in `docs/art-prompts/char_rook_001.md`; the
  Producer changed it to "street brawler")
Severity of what it caused: OWNER FEEDBACK (breaks a condition of the owner's ChatGPT approval,
  L-shared-025)
What happened: A descriptive phrase that is fine in an internal brief is also a franchise name. In an
  image prompt it can steer the model toward that franchise's designs. art-director's own lesson
  candidate adds that prompts must never contain the game title or any on-screen words.
Root cause: Prompts were written as prose briefs and were not run through the franchise sweep before
  hand-off.
Rule: See L-shared-025. Before handing prompts to the owner, run the committed franchise list
  (L-shared-008) over `docs/art-prompts/` case-insensitive (franchise names in any letter case count) and
  paste the hit count (must be 0). Prompts never contain the game title or any text to be drawn.
Status: PROMOTED (round 7, owner feedback)
