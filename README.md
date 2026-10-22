# Game Studio Starter Kit (Claude Code)

An automated, self-improving team of 17 Claude Code agents that design, build, test,
review and package an anime card-battle mobile game. You fill in the brief, start rounds,
and only check finished, reviewed builds.

## What's inside

```
CLAUDE.md                     The Producer: runs the whole pipeline
.claude/agents/               17 agent playbooks (16 roles + team-coach)
.claude/commands/round.md     /round  — run one full production round
.claude/commands/retro.md     /retro  — turn mistakes into lessons, upgrade agents
lessons/                      The team's memory (one file per agent + shared rules)
docs/GAME_BRIEF.md            ← YOU fill this in first
docs/STATUS.md                Current phase, round log, your feedback goes here
docs/METRICS.md               How well each agent is doing
docs/TEAM_CHANGELOG.md        Every playbook upgrade and whether it worked
assets/CREDITS.md             License log for every asset
.github/workflows/
  build-android.yml           Builds debug APK, or signed AAB + APK after a PASS review
  claude-round.yml            Runs a round unattended and opens a pull request
```

## The pipeline

Brief → Design → Build → QA loop → Balance → Compliance → **Release review** → Build → You

The **release-reviewer** judges each build cold, without seeing development history.
Only a `VERDICT: PASS` lets a signed release be built — the build workflow checks this
itself and refuses if any game file changed after the review.

## How the agents upgrade themselves

1. **Self-check** — every agent ends its report with "Lesson candidates".
2. **Lessons** — after each round, `/retro` has team-coach root-cause every bug, review
   finding and piece of your feedback, and write a rule into that agent's lessons file.
3. **Hard rules** — a lesson seen twice, or one that caused a blocker, is promoted into the
   agent's playbook itself. Your feedback is promoted immediately.
4. **Playbook upgrades** — every 3 rounds, team-coach measures each agent in
   `docs/METRICS.md`, rewrites the weakest playbooks, logs it in `docs/TEAM_CHANGELOG.md`,
   and checks next time whether the change actually reduced bugs.

Guardrail: upgrades can only make rules **stricter**. The reviewer, tests, and
safety/licensing/privacy rules can't be loosened without your written approval.

## Setup

1. **Create a GitHub repo** (private is fine) and add these files to it.
2. **Fill in `docs/GAME_BRIEF.md`** — replace every `TBD`.
3. **Open the repo in Claude Code** (web, phone app, or terminal) and type `/round`.
   Claude acts as the Producer and runs the team.

### Optional: fully automatic rounds
1. On a computer with Claude Code, run `claude setup-token` and copy the token.
2. In GitHub → Settings → Secrets and variables → Actions, add it as
   `CLAUDE_CODE_OAUTH_TOKEN`.
3. Start a round any time from the GitHub app: Actions → **Claude round** → Run workflow.
   Each round arrives as a pull request for you to merge.
4. For a daily round, uncomment the `schedule` lines in `claude-round.yml`.
   Rounds use your Claude plan's usage.

### Building the app
- **Test build (any time):** Actions → **Build Android** → Run workflow → `debug`.
  Download the APK from the run page and install it on your phone.
- **Release build:** only after a PASS review. Push a tag like `v0.1.0`, or run the
  workflow with `release`. You get `app-release.aab` (Google Play) and `app-release.apk`.

### Signing (once, before the first release)
Create a keystore (the release-engineer agent can walk you through it), then add these
GitHub secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
**Back up the keystore and passwords somewhere safe.** If you lose them you can't
update your app on Google Play.

## What only you can do
- Fill in the brief and give feedback in `docs/STATUS.md` → "Owner feedback".
- Create the keystore, the Google Play Console account, and upload the AAB.
- Approve anything that costs money.
- Play it once before release — agents can confirm it works, only you can confirm it's fun.
