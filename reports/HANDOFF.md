# Handoff: Fyrenza 0.1.0 (round 7)

**Release review: VERDICT: PASS** on build commit `6a4d7d0` (`reports/release-review.md`).
QA PASS (`reports/qa/round-7d.md`) and compliance 8 PASS / 0 FAIL (`reports/compliance/round-7b.md`) are on the same commit.

## What's new
- New original name **Fyrenza**. On Google Play it shows as "Fyrenza: Card Duels".
- Milestone complete: 8 fighters, 52 cards, 5 story stages, tag teams, transformations, the team finisher,
  summon screen with in-game rates, settings and saving.
- Fixes since the last review:
  - smoother on slow phones
  - redrawn fighters (no look-alikes)
  - an app icon, plus Android name, version and portrait mode
  - every shout now shows on small phones
  - no testing code in the release build

## How to install on your phone (test build)
1. On your phone, open GitHub → mobile-game → **Actions** → "Build Android" → the latest green run on branch
   `claude/new-session-uo46wt` → **Artifacts** → download `app-debug-…`.
2. Unzip it and open the `.apk`. Allow "install unknown apps" for your browser or files app if asked.
3. Play stage 1 to 5, a summon, and Settings.

## Known minor issues (do not block release)
- R-1: in the first (tutorial) battle, the enemy "COMBO" counter can sit partly behind the tutorial box.
- On a 360-wide phone, a long shout can show nearer the other fighter.
- Small text spacing: "Not enough Vigor" and "QUEUED" labels; the Licenses screen has ragged lines.
- Speed was measured only without a GPU. **Your playtest on a real (ideally low-end) phone is the real check.**

## What only you can do (CLAUDE.md §8)
1. **Playtest** the APK above and say if it's fun. Write anything you like or dislike in `docs/STATUS.md` → Owner feedback.
2. **Signing key:** create the keystore and add the 4 GitHub secrets (README → Signing). Then the release build
   makes the Google Play file (AAB).
3. **Google Play Console** account, then upload the AAB to the **internal testing** track only.
4. Fill in `[DEVELOPER NAME]`, `[CONTACT EMAIL]` and the date in `store/privacy-policy.md`, then host it.
5. **Before any public release:** a lawyer's trademark search for "Fyrenza" (paid, your choice).
6. **Art (round 8):** make the ChatGPT images with `docs/art-prompts/README.md` and upload them with the link in
   that README. The release review is done, so uploading now is fine.
