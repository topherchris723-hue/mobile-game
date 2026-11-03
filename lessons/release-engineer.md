# Lessons — release-engineer

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

(no lessons yet)

### L-re-001: The identity check covers every app-name string, not only `app_name`
Seen: 1 (round 7)
Severity of what it caused: MINOR (coverage gap; caught by `tests/data/app-name.test.js`)
What happened: Round 7 rename — `android/tools/check-identity.mjs` checked `app_name` and the Capacitor
  `appName`, but not `title_activity_main` in `res/values/strings.xml`. QA 7b showed a copy with
  `title_activity_main` = "Jade Tempest" still passed `check-identity`.
Root cause: The check listed the strings its author knew about instead of every string that shows the
  app's name.
Rule: `check-identity` reads every `res/values*/strings.xml` entry whose value equals the app name in
  any past or present form (and every `label`/`title` string), and requires each to equal
  `capacitor.config.json` `appName` and `strings.json` `game_title`. A must-FAIL copy changes each one
  in turn.
Status: ACTIVE
