# Compliance report — round 6

Agent: compliance-checker. Date: 2026-10-24. Build checked: commit `bf48920` (HEAD, clean tree), clean
`npm run build` reproduced in the scratchpad (`env -i PATH HOME`, no `VITE_TEST_HOOKS`). The scratch bundle
`index-CPn8STYN.js` is byte-identical to the shared `dist/assets/index-CPn8STYN.js` (`cmp`: identical).
Not legal advice. Items a lawyer should look at are listed at the end.

Read first (L-shared-001): `.claude/agents/compliance-checker.md` (Hard rules: none yet), `lessons/_shared.md`,
`lessons/compliance-checker.md` (empty), `docs/GAME_BRIEF.md`, CLAUDE.md §9, `assets/CREDITS.md`,
`docs/ECONOMY.md` §4, §6 and §8, GDD §1, §3, §11, §13, §18.1. Banned-term list read fresh from GDD §3 by
`tests/sim/banned-grep.mjs` (L-shared-008).

Policies and sources checked on 2026-10-24 (web search; `support.google.com` and registry sites were not reachable
from this container, so wording comes from search excerpts and must be confirmed in Play Console):
- Google Play Developer Program Policy, Payments section (effective 30 Sep 2026 per the search excerpt): apps that
  offer "mechanisms to receive randomized virtual items from a purchase including, but not limited to, loot boxes must
  clearly disclose the odds of receiving those items in advance of, and in close and timely proximity to, that purchase."
- Google Play Data safety FAQ: apps that collect no data must still fill in the form and link a privacy policy.
- IARC / PEGI: PEGI's new criteria (announced 12 Mar 2026, in force June 2026) give paid random items PEGI 16 by
  default. They apply to paid random items only.

## Summary

| # | Item | Result |
|---|---|---|
| 1 | IP (names, text, art, title) | **FAIL**: game content PASS; title "Jade Tempest" not cleared |
| 2 | Licenses | **FAIL**: assets PASS; bundled code libraries ship with no licence notice |
| 3 | Privacy | PASS (policy draft + Data safety answers drafted) |
| 4 | Age rating | PASS (IARC answers drafted) |
| 5 | Gacha | PASS |
| 6 | Permissions | N/A (no Android project yet; requirements listed) |
| 7 | Secrets | PASS |
| 8 | Release-build hygiene | PASS |

Checklist: 5 PASS, 2 FAIL, 1 N/A.

---

## 1. IP — FAIL (title only)

**Game content: PASS.**
- `node tests/sim/banned-grep.mjs data src index.html` → `terms=44 files=69 hard_hits=0 review_hits=0`,
  `name_hits=0` (Spark/Sparks name rule). `npm run validate-data` → `PASS — 10 files, 0 errors`.
- The default run (which also scans `store/`) gives 48 hard hits. All are in `store/listing.md` lines 125–133 and
  `store/screenshot-plan.md:56`, where the store-writer quotes the banned list to show what it checked. They are not
  in player-facing text. I read the app name, short description and full description in `store/listing.md`: no
  franchise term. "martial-arts" is the genre word and is allowed by §3.
- Extra franchise sweep (`franchise.txt`, 97 terms beyond §3: Goku, Vegeta, Frieza, Cell, Buu, Kaio-ken, Instant
  Transmission, Ultra Instinct, Luffy, Gear Second–Fifth, Straw Hat, Naruto, Sharingan, Hokage, Ichigo, Getsuga,
  Domain Expansion, One For All, Plus Ultra, Hashira, Hadoken, Shoryuken, Fatality, Pikachu, Kenshiro, Spirit Gun,
  "over 9000", "World Martial Arts Tournament", and more) over `data/`, `src/ui/strings.json`, `docs/art-briefs/`,
  `docs/STYLE_GUIDE.md`, `store/`, `index.html` → 1 hit: `docs/art-briefs/char_rook_001.md:57` "street fighter"
  used as an ordinary lower-case phrase in an internal brief (not shipped). Negative control: the same grep on a
  planted file ("KAIO-KEN", "Instant Transmission", "straw hat") → 2 of 2 lines caught.
- All 144 distinct player-visible names, epithets and shouts in `data/` (fields name, name_override, epithet, shout) were read by hand (fighters, Ignition forms, cards,
  stages, banner, enemies). None copies a franchise name or a signature move. Low-risk notes only (no action):
  "Dawnbreaker" (Solenne's epithet) is also a Dota 2 hero and a Skyrim item, as a common English word. "Requiem" in
  "Black Sun Requiem" is a common word.
- Art: all 8 briefs in `docs/art-briefs/` have a "Must not resemble / avoid" list that rules out the famous looks
  (spiky golden hair, golden flame outline, orange/blue gi, straw hat, scar under the eye, pale horned emperor,
  skull masks, ninja headband, and others). The shipped art is drawn in code (`reports/screenshots/round-5/`).

**Title "Jade Tempest": NOT CLEARED. This is the FAIL.** Web searches on 2026-10-24:
1. `"Jade Tempest" game`: no video game or app with this name. **Exact match:** "Jade Tempest" is a Light Bowgun
   weapon in Capcom's *Monster Hunter Freedom 2 / Freedom Unite* (monsterhunter.fandom.com/wiki/Jade_Tempest). It is
   a franchise item name, so it falls under the playbook's "similar names count". Risk is low on its own because it
   is an old in-game item, not a known title.
2. `Atari TEMPEST trademark`: per trademark aggregator sites, **TEMPEST, US Reg. No. 3426691 (serial 77296693),
   owner Atari Interactive, Inc., Class 9, video game software, registered 2008-05-13, renewed (status 800)**. That is
   a live mark for the same goods. "Jade Tempest" contains it whole. **NOT VERIFIED at USPTO**: the registry and
   aggregator pages returned proxy 403 / DNS errors. Other games use "Tempest" (for example the HeroCraft pirate RPG
   *Tempest* on Google Play), so coexistence happens, but whether "Jade Tempest" is confusingly similar is a legal
   question.
3. `"Jade Tempest" trademark` and `"Jade Tempest" app Google Play OR Steam OR itch.io`: no filing or store listing
   with this exact name found.

Fallback titles from GDD §1, screened the same way on 2026-10-24 (web search only, not a trademark clearance):
| Title | Finding |
|---|---|
| Meridian Burst (fallback 1) | No game, app or mark found. Nearest: an abandoned MERIDIAN mark (classes 9/28/41, abandoned 2004) and BURST marks for online games (Burst Online Entertainment). Lowest risk of the five. |
| Ironroar | Nothing found. |
| Thunderclap Trio | Nothing found. |
| Heavenbreak | Close to Square Enix's registered HEAVENSTRIKE RIVALS (Reg. 2016-08-09). Avoid. |

**Fix (owner: Producer decides; game-designer updates GDD §1; ui-developer changes `src/ui/strings.json`
`game_title` and `index.html` `<title>`; store-writer updates `store/listing.md`; compliance-checker updates
`store/privacy-policy.md`):**
- Recommended default: keep "Jade Tempest" only as a working title for private builds. Before the first Play
  Console upload, the owner either (a) has a lawyer run a clearance search for "Jade Tempest" in the US (USPTO),
  EU (EUIPO) and UK, classes 9, 28 and 41, or (b) the Producer switches to **Meridian Burst** and that name gets the
  same clearance. Either way, the store name needs a registry-level check that this container cannot do.
- Re-check: the item turns PASS when a registry search (lawyer or the owner with USPTO/EUIPO access) is logged in
  `docs/STATUS.md` for the final store name.

## 2. Licenses — FAIL (code libraries)

**Assets: PASS.**
- `assets/` contains only `CREDITS.md`. `find` over the repo (excluding node_modules, .git, reports,
  test-results) for png/jpg/webp/gif/svg/ico/mp3/ogg/wav/m4a/ttf/otf/woff → 0 files.
- `dist/` contains only `index.html`, one JS and one CSS file. No image, audio or font files.
- Audio: `data/audio.json` has 1 distinct `source` value, `"procedural"`, and 0 URLs. It is logged in CREDITS.md as
  self-made (GDD §18.1 rule 3).
- Fonts: bundle grep for `@font-face|fonts.googleapis|.woff|.ttf|.otf` → 0. The 2 `FontFace(` hits are inside
  Phaser's unused web-font loader. The game uses the system font stack only (CREDITS.md "Fonts").
- External URLs in the bundle: only JSON-Schema `$id` identifiers (json-schema.org, ajv's data.json ref), the SVG
  and XHTML namespaces, and `https://phaser.io` in Phaser's console banner. None are fetched (item 3 runtime probe).
- `data:image/png` and `data:image/svg+xml` URIs in the bundle are Phaser's built-in default, missing and white
  textures, covered by Phaser's MIT licence.
- No CC-BY assets, so no in-game credit is needed for assets.

**Code libraries: FAIL.** A module list from the release build (Rollup `generateBundle`, scratch config
`vite.modlist.config.mjs`) gives `BUNDLED_PACKAGES ajv,ajv-formats,fast-deep-equal,fast-uri,json-schema-traverse,phaser`.
| Package | Version | Licence | Copyright line |
|---|---|---|---|
| phaser | 3.90.0 | MIT | (c) 2024 Richard Davey, Phaser Studio Inc. (includes its own eventemitter3 copy, MIT, (c) 2014 Arnout Kazemier) |
| ajv | 8.20.0 | MIT | (c) 2015-2021 Evgeny Poberezkin |
| ajv-formats | 3.0.1 | MIT | (c) 2020 Evgeny Poberezkin |
| fast-deep-equal | 3.1.3 | MIT | (c) 2017 Evgeny Poberezkin |
| json-schema-traverse | 1.0.0 | MIT | (c) 2017 Evgeny Poberezkin |
| fast-uri | 3.1.9 | BSD-3-Clause | (c) 2011-2021 Gary Court; (c) 2021-present The Fastify team |

MIT and BSD-3-Clause both require the copyright notice and licence text to go with every copy. The minified bundle
has none: `grep -E "@license|Copyright|MIT License|Permission is hereby granted"` → 0 hits. There is no
licence file in `dist/`, no "Licenses" entry in `src/ui/strings.json` (grep `credit|licen|about` → 0), and CREDITS.md
lists no code libraries. Also, `ajv` and `ajv-formats` are in `devDependencies` but ship in the app
(`src/ui/game-data.js:3-4`), so any licence tool that skips dev dependencies would miss them.

**Fix:**
- ui-developer: (1) move `ajv` and `ajv-formats` to `dependencies` in `package.json`. (2) Make the release build
  emit `THIRD_PARTY_LICENSES.txt` into `dist/`, with the full licence text and copyright lines of every bundled
  package. Generate it from the bundle's module list, not a hand list. (3) Add a "Licenses" button to Settings that
  shows that text (scrollable, ≥44×44 touch target, strings from `strings.json`). (4) Extend
  `tests/ui/release-bundle.test.js`: for every package in the bundle's module list, its licence text is in the
  notices file. Negative run: drop one package from the notices and show the test FAIL (L-shared-006).
- art-director (CREDITS.md owner per its review log): add a "Code libraries (shipped in the app)" table with the six
  rows above (package, version, licence, "Commercial use OK? Yes", "notice shipped in THIRD_PARTY_LICENSES.txt and
  Settings → Licenses"). MIT and BSD-3-Clause are permissive. If the Producer reads the "allowed licenses" list as
  covering code too, log the approval in `docs/STATUS.md`, since MIT and BSD are not on that list by name.

## 3. Privacy — PASS

- Source grep (`src/`, `index.html`) for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`,
  `navigator.`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, geolocation, `getUserMedia`,
  analytics, gtag, firebase, sentry, dynamic `import(`, Phaser `load.*` → only: `navigator.vibrate`
  (`src/ui/feedback.js:43`, `src/scenes/SettingsScene.js:202`), `window.localStorage` (`src/ui/game-data.js:37`),
  `crypto.getRandomValues` (`src/state/summon-save.js:14-16`, `src/scenes/BattleScene.js:32`), `Math.random`
  (cosmetic and fallback), `matchMedia('(prefers-reduced-motion: reduce)')` (`src/ui/game-data.js:50`).
- Shipped npm packages: phaser, ajv, ajv-formats and their helpers. No SDKs (ads, analytics, crash reporting).
- **Runtime probe** (`netprobe.mjs` in the scratchpad, Chromium, Pixel 7 at 360×640, release build on a local server,
  3 s load, 40 taps over the screen, 3 s wait): `totalRequests 3`, all same-origin (`/`, the JS, the CSS),
  `external []`, cookies 0, local storage `game_save (676 chars)` only. **Positive control:** the same probe with a
  planted `fetch('https://example.invalid/collect?x=1')` → `external: ["https://example.invalid/collect?x=1"]`.
  So the probe can see an outgoing request.
- Save contents (GDD §13): version, timestamps, Jade, roster, team, stage progress, summon counters, settings,
  tutorial flag. No identifiers, names, emails or device IDs.
- Privacy policy draft: `store/privacy-policy.md` (matches the above; owner fills in developer name, contact email
  and date, and hosts it at a public URL).

**Draft Data safety answers (Play Console → App content → Data safety):**
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| (All data-type, encryption-in-transit and deletion-request questions) | Skipped: not shown when the answer above is No |
| Privacy policy URL | Required: the owner's hosted copy of `store/privacy-policy.md` |
Conditions: true only while the Android build adds no network SDK, ads, analytics, crash reporting or Capacitor plugin
that sends data. Release-engineer must re-run the item-3 grep and the probe on the AAB's web assets.

## 4. Age rating — PASS (IARC content summary drafted)

Evidence: GAME_BRIEF (martial-arts fights, no real money), GDD §11 (Jade only), text scan of `data/*.json` and
`src/ui/strings.json` for blood, gore, kill, death, profanity, sexual, alcohol, drug, weapon and gambling words →
only "bet" in two friendly lines (`data/characters.json:303,306`, `data/story.json:90`: "I bet Rook a week of
dishes"), "wind blades" (a wind attack, `data/cards.json:247,297`) and "slot" (team slot UI). The battle shows
code-drawn stylised fighters, hit numbers and KO falls (round-5 screenshots).

Draft answers for the IARC questionnaire:
| Topic | Answer |
|---|---|
| Category | Game |
| Violence | Yes: fantasy/cartoon violence. Stylised, non-realistic characters punch, kick and fire energy blasts at each other. No blood, gore or dismemberment. Defeated fighters fall down (KO); no death is shown. Not aimed at realistic humans or animals. |
| Fear / horror | No |
| Sexuality / nudity | No |
| Language (crude, profanity) | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling: real-money gambling | No |
| Gambling: simulated gambling (casino, card or slot games) | No. The summon screen gives random fighters for earned in-game currency only. It is not a casino game, has no real money and no cash-out. |
| Random items / loot boxes bought with real money | No (no purchases of any kind) |
| Digital purchases / in-app purchases | No |
| Users can interact or exchange content | No (offline, no chat, no UGC) |
| Shares user location | No |
| Unrestricted internet / web browser | No |
Expected outcome: a low rating for fantasy violence (about ESRB E10+, PEGI 7–12). IARC decides this. PEGI's 2026
paid-random-items rule (PEGI 16) does not apply while no real money is involved. Play Console target audience:
recommend **13+** to stay outside the Families program. The owner sets this.

## 5. Gacha — PASS

- Shown in-game: `reports/screenshots/round-5/360x640-31-summon-rates.png` shows the "Rates & rules" table: ★5 3.00%
  (Solenne 1.50%, Corvane 1.50%, both featured), ★4 17.00% (Pell, Thessa, Rook 5.67% each), ★3 80.00% (Tavi, Lark,
  Dunmore 26.67% each), the rounding note, base-rate note, pity (★5 within 40), ×10 ★4+ guarantee, first ×10 ★5
  guarantee and duplicate rules. The pity counter is on the Summon screen (GDD §11.1). These equal
  `data/banners.json` and GDD §11.2.
- Code matches display: `npx vitest run tests/logic/summon-rates-shown-vs-drawn.test.js tests/logic/summon.test.js
  tests/ui/summon-view.test.js tests/ui/release-bundle.test.js` → `Test Files 4 passed (4), Tests 54 passed (54)`. The
  shown-vs-drawn test draws 2,000,000 times through the real `drawPull` and includes must-FAIL variants.
- Independent sim: `node tests/sim/summon-rate.mjs 100000` → every rarity and fighter PASS within ±0.5 pp
  (★5 2.92% vs 3.00%, ★4 17.14% vs 17.00%, ★3 79.94% vs 80.00%), `0 out of ±0.5 pp`, exit 0. **Negative run:**
  `QA_BREAK=skew` (★5 600 bp in the logic copy) → `FAIL ★5 measured 5.88% data 3.00%`, `7 out of ±0.5 pp`, exit 1.
- Policy: Google Play requires odds disclosure for random items obtained "from a purchase". There are no purchases,
  so the rule does not strictly apply. We meet it anyway: odds are one tap away on the same screen as the Summon
  buttons, before the confirm. No real money (CLAUDE.md §9 and GAME_BRIEF). No time-limited offers and no daily-login
  pressure (PEGI 2026 criteria). If real money is ever added, redo this item, item 4, `docs/ECONOMY.md` §8
  (Belgium/Netherlands), and the PEGI 16 paid-random-items rule.

## 6. Permissions — N/A (no Android project yet)

`android/` and `capacitor.config.*` do not exist. `.github/workflows/build-android.yml:92` runs `npx cap add android`
at build time. Requirements for release-engineer when the manifest exists:
- **VIBRATE**: needed. `navigator.vibrate` in an Android WebView only works if the app declares
  `android.permission.VIBRATE` (normal permission, no prompt). Without it, haptics silently do nothing.
- **INTERNET**: the Capacitor template adds it by default. The game does not need it, because Capacitor serves the
  bundled files locally. Recommend removing it and checking that the app still boots. If it stays, write the reason in
  the release report. Either way, Data safety stays "no data collected" only if nothing sends data.
- Nothing else: no storage, location, camera, microphone, contacts, notifications, AD_ID or billing permissions.
  Also check the merged manifest (`aapt dump permissions` on the built APK), because plugins can add permissions.
- Related findings for release-engineer (not items of this checklist): `@capacitor/cli`, `@capacitor/core` and
  `@capacitor/android` are not in `package.json`, so `npx cap` would fetch an unpinned version at build time. Pin
  them. Replace Capacitor's default launcher icon and splash (Capacitor branding) with original art before release.

## 7. Secrets — PASS

Patterns (`secret-patterns.txt`): AWS `AKIA…`, Google `AIza…`, GitHub `gh[pousr]_…` and `github_pat_…`, `sk-…` and
`sk-ant-…`, Slack `xox…`, PEM private-key headers, and `api_key|secret|token|password|storePassword|keyPassword|
keystore_pass` followed by `=` or `:` and a value of 8+ characters.
- Full history, all 95 commits, all refs (`git log --all -p`): 1 hit, `# Required secret: CLAUDE_CODE_OAUTH_TOKEN`
  (a comment in `.github/workflows/claude-round.yml:4` that names the secret; the value comes from
  `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`). No real secret.
- Files ever committed with `.jks/.keystore/.p12/.pem/.key/.env` names or `google-services`: 0. `.gitignore` covers
  `.env*`, `*.jks`, `*.keystore`, `*.p12`, `signed/`.
- Working tree (excluding node_modules): the same single comment line. `dist/` and the clean scratch build: 0 hits.
- Workflows read signing values only from `secrets.ANDROID_*` (`build-android.yml:115-118`).
- **Negative control** (scratch clone `neg/`, never the shared tree): committed `src/planted.js` with a dummy
  `AIza…` key and `android.properties` with `storePassword=DummyPass1234` → history scan caught both (lines 13 and
  20). A bundle copy with `ghp_AAAA…` appended → `bundle hits: 1`. A force-added `key.jks` → caught by the filename scan.

## 8. Release-build hygiene — PASS

Clean scratch build vs a `VITE_TEST_HOOKS=1` scratch build, counting the 9 names from
`tests/ui/release-bundle.test.js` (`__TEST__, summonSeed, summonLog, tutorialStep, audioDebug, vfxQuality,
settingsScreen, particlesNow, silhouetteSheet`):
- release: all 0.
- hooks build (negative): `__TEST__:3 summonSeed:1 summonLog:4 tutorialStep:1 audioDebug:1 vfxQuality:6
  settingsScreen:1 particlesNow:2 silhouetteSheet:1`.
- `tests/ui/release-bundle.test.js` itself passed in the item-5 Vitest run (both cases).
- `dist/` in the shared tree is identical to the clean build (`cmp`).
- Note: the test's description string still lists 8 names, but the check uses all 9. This is cosmetic
  (ui-developer, optional).

---

## Needs a human lawyer

1. **The store title.** "Jade Tempest" contains the live Atari TEMPEST Class 9 registration (video game software)
   and exactly matches a Capcom *Monster Hunter* weapon name. A clearance search (USPTO, EUIPO, UK IPO; classes
   9, 28, 41) for whichever title goes to the store is needed before the first public upload.
2. Optional: a quick review of `store/privacy-policy.md` once the developer name and contact are filled in.

## Evidence files (scratchpad, not part of the repo)
`/tmp/claude-0/-home-user-mobile-game/c91c703e-9593-59a7-a1fc-77f59d87b919/scratchpad/`: `rel/` (clean build),
`hooks/` (test-hook build), `probe/netprobe.mjs`, `secret-patterns.txt`, `neg/` (planted-secret clone), `negdist/`,
`franchise.txt`, `planted-ip.txt`, `vite.modlist.config.mjs`.

## Lesson candidates
1. **Code libraries were outside every licence check.** CREDITS.md and the playbooks say "assets", so six bundled
   npm packages shipped for 5 rounds with no licence notice. Proposed rule (compliance-checker, ui-developer,
   release-engineer): every round that changes `package.json` or the build, list the packages in the release bundle
   from the bundler's module list and check each has a notice in the shipped licence file. Also: a package imported
   by `src/` must be in `dependencies`, not `devDependencies`.
2. **A title search for the exact phrase is not a trademark check.** The round-1 search ("no game with this name")
   missed a live registered mark for one of the title's words in Class 9 and an exact franchise item name. Proposed
   rule (game-designer, compliance-checker): for every proposed name, search each distinctive word separately with
   "trademark video game" and the full phrase with franchise wikis. Any live Class 9/41 mark that contains a word of
   the name means "needs clearance". This container cannot reach trademark registries, so final title clearance is
   always a human step. Plan it early, not at Launch.
3. **banned-grep default scope picks up meta lists.** `tests/sim/banned-grep.mjs` scans `store/` by default, where
   the store-writer's "banned-term check" paragraph lists every term, giving 48 false hard hits that can hide a real
   one. Proposed fix (qa-tester owns the script): skip lines inside a marked `<!-- banned-list-quote -->` block, or
   have writers name the list by reference ("GDD §3 list") instead of quoting it.
