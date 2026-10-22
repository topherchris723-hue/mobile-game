# QA report: round 2, loop 1

Tester: qa-tester. Date: 2026-10-22. Build: working tree on top of `e01f893`. The Producer made a WIP commit `9b99b3c` during the run.

**Read first (L-shared-001):** `.claude/agents/qa-tester.md` (Hard rules: none yet), `lessons/_shared.md`, `lessons/qa-tester.md` (L-qa-001), `docs/GAME_BRIEF.md`, `docs/GDD.md` (§2, §3, §4, §5.0–5.15, §9, §13, §14, §15.3) and `src/logic/README.md`.
**Previous QA report:** none. Round 1 was design only, so there were no fixes to re-test.

## 1. Commands and results

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm test` | **150/150 passed** (7 files) |
| Data validator | `npm run validate-data` | PASS: 8 files, 0 errors, 0 warnings, 40 error terms + 2 warning terms read from GDD §3 |
| Validator can fail (L-shared-006) | `node scripts/validate-data.js --data-dir <broken copy>` × 3 | All 3 FAIL as expected (see §1.1) |
| Build | `npm run build` | OK (one 1.5 MB JS chunk) |
| E2E | `npx playwright test` | **14/18 executed passed, 4 failed** (10 skipped by design: the QA specs run once, in the 360 project). Every failure is a bug filed below |
| Bot playthrough | `node tests/sim/bot-playthrough.mjs --per-stage 50 --ai-per-stage 8 --seed 1000` and `--per-stage 30 --ai-per-stage 0 --seed 77777` | **560 battles, 0 failed** |
| Bot can fail (L-shared-006) | `QA_INJECT=nan / negvigor / neverend / throw / dup` | All 5 injected faults caught (see §1.2) |
| Engine edge probes | `node tests/sim/edge-cases.mjs` | 6 PASS, 1 INFO (see BUG-2-08) |
| Tutorial probes | `node tests/sim/tutorial-stuck.mjs` | Both stuck states reproduced (BUG-2-01, BUG-2-02) |
| Banned-term grep (L-qa-001) | `node tests/sim/banned-grep.mjs` | data/ + src/ + index.html: 42 terms, 40 files, **0 hard hits, 0 review hits**. No store text exists yet |
| Logic purity | `grep -rnE '^[^/]*(Math\.random\|\bdocument\b\|\bwindow\b\|from .phaser.\|Date\.now\|performance\.now)' src/logic --include=*.js` | **0 lines**. A copy with injected `Math.random()`/Phaser/`document` gives 1 hit (the grep can fail) |
| Console errors | all e2e specs | 0 in normal flows. 1 pageerror only in the unknown-ID save case (BUG-2-04) |

### 1.1 Validator negative runs
- Card with `id` deleted → `ERROR [schema] cards.json /cards/0: must have required property 'id'` + `[1-unique-ids] missing id` + broken deck reference.
- `stage_002.enemy_team[0] = "enemy_nope_001"` → `ERROR [2-references] ... enemy "enemy_nope_001" does not exist`, `validate-data: FAIL — 1 error(s)`.
- Bio `"He mastered the Kamehameha."` → `ERROR [7-banned-terms] ... banned term "kamehameha"`, `FAIL`.

### 1.2 Bot invariant self-test (fault injected at real tick 200)
- `nan` → `player[0] hp NaN/11270`.
- `negvigor` → `player vigor -833.3`.
- `neverend` → `timer increased` + `unfrozen tick 7201 beyond timer`.
- `throw` → `EXCEPTION TypeError ... battle.js:730` + `battle never ended`.
- `dup` → `hand has 4x card_pell_dawn_chant (copies 2)`.

### 1.3 Banned-term grep proof
I ran the grep first on a test file containing `KAMEHAMEHA`, `chakra`, `zenkai`, `Super  Saiyan`, `her Stand` and `Artsy`.
- Result: 6 HITs plus 1 REVIEW (`stand`), exit 1.
- `Artsy` was correctly not matched (whole-word match).

The real run gave `terms=42 files=40 hard_hits=0 review_hits=0`.

Note for game-designer (not a bug): `card_tavi_spark_jab` "Spark Jab" and stage_001 "Qualifier: First Spark" use "Spark". It is not on the §3 list. "Sparking" is on the list, and round 1 notes said "Spark" was avoided as a franchise echo. Consider adding a ruling to §3 (L-shared-008).

### 1.4 Bot playthrough coverage
- **All 5 stages.** Per stage: 50 battles with a human player sending seeded random inputs (6% or 25% per tick, including literal double taps in one tick, random 30-tick pauses, random teams from all playable fighters with distinct families, and Resonance 0–4), plus 8 AI-vs-AI battles for each tier (rookie, fighter, veteran, master).
- **Checked every tick:**
  - HP is a finite integer in [0, max].
  - KO ⇔ HP 0.
  - Vigor in [0, 10]; Burst in [0, 100]; x in [0, 100]; distance ≥ min_distance.
  - The timer never rises.
  - Exactly one active fighter per team, and the rest are Benched/KO.
  - States are valid.
  - The hand never holds more copies of a card than the deck has (AC-5.4.2).
  - The battle ends within timer_s × 60 unfrozen ticks.
  - The result matches the HP state.
  - A pause changes nothing.
  - The enemy AI never has an action rejected for Vigor (AC-5.15.2).
  - The save stays schema-valid after `applyBattleResult` twice.
  - Determinism: every 5th battle is replayed with its input log and gives the same digest.
- **Result:** 0 crashes, 0 never-ending battles, 0 NaN/negative HP, 0 softlocks, 0 non-determinism.
- **Tally (seed 1000):**

| Stage | Wins | Losses |
|---|---|---|
| s1 | 82 | 0 |
| s2 | 82 | 0 |
| s3 | 66 | 16 |
| s4 | 27 | 55 |
| s5 | 5 | 77 |

### 1.5 Acceptance criteria covered by my e2e (beyond smoke.spec.js)
- **Passing:**
  - AC-4.1: all screens reachable, back to Home with no restart.
  - AC-4.2: no shop or purchase text on any scanned screen (regex over every visible Text).
  - AC-12.1: fresh save has 1000 Jade and the 3 starters.
  - AC-13.1: win stage_001, then reload *during the 1.4 s result delay*. stage_001 is cleared and Jade = 1000 + 300 + missions. stage_002 is unlocked.
  - AC-13.2: garbage, version 99 and wrong-type saves each give a fresh save, a `game_save_corrupt_*` backup and the Home notice, with no error.
  - AC-5.2.3: a diagonal swipe gives a Slip; a swipe that starts on Pause is ignored.
  - AC-14.1: target sizes and 8 px gaps on every screen at 3 sizes.
  - AC-14.2: at 360×800 the logical H is 800, the arena bottom is 490, and the canvas is not stretched.
  - Taps during the intro and during the Ignition cinematic do nothing.
  - Backgrounding during a cinematic pauses it and freezes the timer.
  - Rotating to landscape and back keeps the battle (it is not restarted), the pause menu and the Dialogue line, and gestures still work afterwards.
  - Reloading mid-battle leaves the save byte-identical.
- **Failing:** see the bugs below.

### 1.6 Screens
Screenshots are in `reports/screenshots/round-2/qa/` (25 screens × 3 sizes + 360×800 + abuse shots). The machine findings are in `reports/screenshots/round-2/qa/layout-findings.json`.

I opened and checked these by eye:
- `360x640-23-story-all-cleared.png`
- `360x640-24-result-draw-double-ko.png`
- `360x640-19-battle-intro-005.png`
- `360x640-20-battle-fight-umbral-solenne.png` ("Umbral Solenne" fits, no overlap)
- `360x640-21-result-win-005.png`
- `360x640-10-battle-tooltip.png`
- `360x640-16-team-edit-4-roster.png`
- `430x932-09-battle-tutorial-prompt.png`
- `390x844-02-home.png`
- `abuse-save-unknown-team-id.png` (black screen)

Everything else is checked by the automated scan. The scan ignores intended modal overlays (pause menu, tooltip), the 1 s "FIGHT!" callout and a 3 px stroke margin on the timer, which I confirmed is fine on screen.

## 2. Bugs

### BUG-2-01: Tutorial gets stuck in 0.3× slow-mo when the player Tags during the "Tap a card now to Riposte!" prompt
Severity: MAJOR
Owner: ui-developer
Steps:
1. Fresh save, stage_001 (tutorial). Play a card at the first prompt.
2. Perfect-Slip the first enemy windup. The `perfect_slip` prompt appears and the Riposte window is held.
3. Instead of tapping a card, wait until Tag is ready and tap a bench portrait.

Expected (GDD §9.4): the `perfect_slip` step completes when a Riposte is played. The step must not block the tutorial ("If the player makes no Perfect Slip, the step never fires and does not block the tutorial"). The Riposte window must not be held once the prompt is gone.
Actual:
- The Tag sets `riposteTicks = 0`, so a Riposte is now impossible.
- The prompt stays active for the rest of the battle (3600/3600 ticks measured), so the game runs at 0.3× until the battle ends.
- No later tutorial step can fire.
- `battle.teams.player.riposteHeld` stays `true` for the whole battle, so any later Riposte window (from a later Perfect Slip) never counts down. That is a rules break (§5.6: 0.8 s window).

The same happens if the active fighter is KO'd while the prompt shows (KO also clears `riposteTicks`).
Evidence: `node tests/sim/tutorial-stuck.mjs` → `Scenario A ... {"seed":1,"stuckTicks":3600,"riposteWindow":0,"held":true,"active":"perfect_slip/riposte"}`. This uses the real `TutorialController` and the logic.
Root-cause guess: `TutorialController` (src/ui/tutorial.js) only completes a `riposte` step on a `riposte` event. It should also complete or cancel it (and call `holdRiposteWindow(false)`) when the window closes for any other reason: `tag`, `ko`, `riposte_window_end`, or `riposteWindowTicks === 0` in `handleState`.

### BUG-2-02: The "IGNITE is glowing! Tap it" prompt fires for a benched fighter, with no IGNITE button, and holds 0.3× slow-mo
Severity: MAJOR
Owner: ui-developer
Steps:
1. Fresh save, stage_001. At the `tag_ready` prompt ("Tap a bench portrait to Tag in a teammate!"), tag to Lark (who has no Ignition).
2. Keep fighting until Tavi's `battle_time_s: 60` trigger is met while Tavi is benched.

Expected (GDD §9.4, §5.9): `ignition_ready` means IGNITE is available for the player, and the IGNITE button only appears for the active fighter. A prompt must point at something the player can do.
Actual: at tick 3600 the logic emits `ignition_ready {side: player, slot: 0}` for benched Tavi. The tutorial's event trigger does not check that the slot is the active one, so it shows "IGNITE is glowing! Tap it to transform!" while Lark is active (`igniteReady: false`, no button). The game stays at 0.3× (1200/1200 ticks measured over the next 20 s) until the player happens to tag back to Tavi (8 s cooldown, about 27 s real time at 0.3×) and ignites. This is the normal path, because the tutorial itself tells the player to Tag at 5 s.
Evidence: `node tests/sim/tutorial-stuck.mjs` → `Scenario B2 ... {"tick":3600,"eventSlot":0,"activeSlot":1,"activeName":"Lark","activeHasIgnition":false,"igniteButtonShown":false,"tutorialPrompt":"ignition_ready/ignite","promptStillShownTicksOf1200":1200,"slowmoSpeed":0.3}`.
Root-cause guess: `EVENT_TRIGGERS.ignition_ready` in src/ui/tutorial.js should require `e.slot === activeSlot` (or rely only on the state trigger `igniteReady`). `burst_ready` should be checked the same way.

### BUG-2-03: A double tap on "Retreat" also confirms the retreat, so the confirmation dialog is skipped
Severity: MAJOR
Owner: ui-developer
Steps:
1. Any battle. Tap Pause.
2. Double tap "Retreat".

Expected (GDD §5.14): "Retreat = loss, confirmed with a dialog". The first tap should open the confirm dialog, and the second tap must not confirm it.
Actual: "Yes, retreat" (`menu_retreat_yes`) is drawn at exactly the same rectangle as "Retreat" (`panelTop + 176`). The second tap of a double tap lands on it, and the battle ends as a loss immediately (`result.reason = "retreat"`, confirm never visible). "Cancel" also sits where "Resume" was.
Evidence: `tests/e2e/qa-abuse.spec.js` › "abuse: double taps on every navigation button…" → log `after double tap on Retreat: result= "retreat" confirm shown= false`.
Root-cause guess: BattleScene.showMenu('confirm') puts the destructive button where the previous tap was, and new buttons accept input at once. Swap the order (Cancel at the bottom, Yes on top), or ignore taps on a newly shown menu for about 300 ms.

### BUG-2-04: A save whose team references a character ID missing from the data gives a black screen on Start
Severity: MAJOR. Trigger: any data change or rollback that removes a fighter. Not reachable by normal play in this build, but GDD §13 requires it to be handled. The result is an unrecoverable crash until the player clears app data, so the Producer may want BLOCKER.
Owner: gameplay-programmer (src/state/save.js load; ui-developer for HomeScene/TeamScene guards)
Steps:
1. Set `localStorage.game_save` to a valid save with `team: ["char_tavi_001","char_lark_001","char_removed_099"]`. The roster entry for it is optional.
2. Load, then tap Start.

Expected (GDD §13): "IDs in the save that no longer exist in the data are ignored on load (they are not deleted…)". The game must keep working, for example by using the remaining valid fighters or falling back to starters for the active team.
Actual: `pageerror: Cannot read properties of undefined (reading 'aura')` in HomeScene, and the screen is black. Nothing is reachable.
Evidence: `tests/e2e/qa-abuse.spec.js` › "GDD §13: save with a team id that no longer exists…" (fails). Screenshot `reports/screenshots/round-2/qa/abuse-save-unknown-team-id.png`.
Root-cause guess: `loadSave`/`checkTeamFamilies` skip unknown IDs, but nothing gives the UI a usable team. `data.teamEntries()`, `teamPower()` and HomeScene use `data.character(id)` without a guard. A non-mutating "effective team" helper in save.js would fix it.

### BUG-2-05: The save loader accepts a team holding fighters the player does not own
Severity: MINOR
Owner: gameplay-programmer
Steps:
1. Valid save with `team: ["char_corvane_001","char_lark_001","char_dunmore_001"]`, where Corvane (★5) is not in the roster.
2. Load the game.

Expected (GDD §13): team = "3 character ids, distinct families, all owned". save.schema.json says "3 owned fighters of distinct families (checked in code)".
Actual: the save loads unchanged and Corvane can be fielded. The code only checks families.
Evidence: `tests/e2e/qa-abuse.spec.js` › "GDD §13: save whose team holds a fighter that is not owned" → `unowned team member kept after load: true`.
Root-cause guess: `loadSave` needs an ownership check (treat the save as corrupt or repair the team).

### BUG-2-06: Stage list: "Missions x/y" is drawn on top of "Recommended power … · Your team …" on every cleared stage
Severity: MINOR
Owner: ui-developer
Steps:
1. Clear at least one stage (or load `clearedSave(4)` from tests/e2e/qa-helpers.js).
2. Open Story.

Expected (GDD §14 / AC-14.1): nothing overlaps and all text is readable.
Actual: at all 3 sizes the bottom-right "Missions 3/3" overlaps the end of the bottom-left power line by about 25×11 px. "Your team 5915" becomes unreadable.
Evidence: `tests/e2e/qa-screens.spec.js` (layout scan) and `reports/screenshots/round-2/qa/360x640-23-story-all-cleared.png`, `390x844-23-…`, `430x932-23-…`.
Root-cause guess: StoryListScene puts both 12 px texts on the same baseline (`cardH/2 − 20`). Shorten the power string, or move "Missions" up next to "CLEARED".

### BUG-2-07: The Result screen shows the raw key "[result_reason_double_ko]" after a double-KO Draw
Severity: MINOR
Owner: ui-developer
Steps:
1. Have a battle end with both teams wiped on the same tick. The engine returns `{outcome:"draw", reason:"double_ko"}`, which I proved headlessly by setting both teams' HP to 0 and stepping once.
2. Look at the Result screen.

Expected (GDD §5.14): a Draw is shown with a readable reason.
Actual: the subtitle reads `[result_reason_double_ko]`. strings.json has keys only for ko, timeout and retreat.
Evidence: `reports/screenshots/round-2/qa/360x640-24-result-draw-double-ko.png` (and the 390/430 versions). The scan reports `missing UI string key shown: "[result_reason_double_ko]"`. The Result scene was started directly through the Phaser scene manager with the engine's real result shape.
Root-cause guess: add `result_reason_double_ko` to src/ui/strings.json.

### BUG-2-08: GDD gap. Ignition cancels an enemy's Tri-Burst rush, and the full 100 gauge is lost with no refund and no "used" flag
Severity: MINOR
Owner: game-designer (rule), then gameplay-programmer
Steps:
1. Player Burst = 100. Enemy (Corvane, master, Ignition available) is active.
2. The player taps TRI-BURST.
3. During the 0.3 s rush, the enemy ignites.

Expected: the GDD does not define this. §5.9 cancels the enemy's "current card", and §5.10 defines only a whiff (50% refund).
Actual: the rush is cancelled (`card_cancelled`), the player's gauge stays at 0 (set at rush start), `burstUsed = false`, and nothing is refunded. Master AI (ignite_delay 0.5 s) can do this to the player.
Evidence: `node tests/sim/edge-cases.mjs` → `INFO ignite-vs-tri-burst-rush: cancelled=true playerBurstAfter=0 burstUsed=false`.
Root-cause guess: decide whether the rush is armored against Ignition's cancel (it is already armored and invulnerable against hits), or whether it refunds like a whiff. Then add an AC.

### BUG-2-09: The battle-intro shout overlaps the fighters' overhead name labels
Severity: POLISH
Owner: ui-developer
Steps: start any battle at 360×640 and look at the 2 s intro.
Expected: intro text is clean and readable.
Actual: the intro shout ("Ready or not, I'm ON FIRE!") at `arena.top + 128` sits on top of the "Tavi" / "Thessa" name labels above the fighters (overlap about 26–45 × 3–5 px). Only at 360×640; taller screens have room.
Evidence: `reports/screenshots/round-2/qa/360x640-19-battle-intro-005.png`, `360x640-08-battle-intro-001.png`. Scan line: `08-battle-intro-001: text overlap: "Tavi" × "Ready or not, I'm ON FIRE!"`.

## 3. Observations (not filed as bugs; for later phases)
- **Battle length is far below the GDD target.**
  - `npm run sim -- --player-tier fighter --count 100`: average timer 71 s (stage_003), 70 s (stage_004), 53 s (stage_005). GDD §5.14 expects 120–200 s for stage 3+.
  - stage_001 tutorial was cleared in 12.5 s by the smoke bot.
  - The fighter-tier starter team wins stage_004 3% and stage_005 0%. Random-tap bots win stage_001/002 100%.
  - This goes to the balance-analyst (Growth phase).
- **Team scene roster cutoff.** The roster grid stops drawing rows past `H − 88`, with no scroll (TeamScene comment). With 10 fighters at 360×640 the 3rd row will be hidden. That is not reachable this round (max roster 4 without Summon).
- **Running smoke.spec.js rewrites ui-developer screenshots.** Running the suite regenerated the ui-developer's screenshots in `reports/screenshots/round-2/*.png` (they show as modified in git). They are the same scenes re-captured. The Producer can keep them or `git checkout` them.

## 4. Re-tested fixes
None. This is the first QA round (round 1 had no build).

## 5. Counts

| Severity | Count | Bugs |
|---|---|---|
| BLOCKER | 0 | — |
| MAJOR | 4 | BUG-2-01, BUG-2-02, BUG-2-03, BUG-2-04 |
| MINOR | 4 | BUG-2-05, BUG-2-06, BUG-2-07, BUG-2-08 |
| POLISH | 1 | BUG-2-09 |

**By owner:**
- ui-developer: 01, 02, 03, 06, 07, 09.
- gameplay-programmer: 04, 05 (08 after design).
- game-designer: 08.

QA RESULT: FAIL
