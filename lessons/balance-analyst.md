# Lessons — balance-analyst

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

(no lessons yet)

### L-ba-001: Before changing a value, find every test and AC that pins it
Seen: 1 (round 3)
Severity of what it caused: MINOR (1 failing test after a legal change)
What happened: Balance report pass 2 — `burst.power_per_member` 3.0 → 3.3 broke the AC-5.10.2 test
  (it read the live value). Earlier, Tavi's Ignition could not be tuned because the GDD examples and
  two test files pinned his live values.
Root cause: Values were changed without first searching where tests and the GDD use them.
Rule: Before changing any field, run `grep -rn "<field or value>" tests/ docs/GDD.md`, list the tests
  and ACs that use it, and say for each whether it reads FX-GDD (safe) or live data (route it to its
  owner before you change the value).
Status: ACTIVE
