# Compliance report — round 7

Build checked: **d09623e4c2aced72a8658308e3463194daf08a4e** (HEAD on 2026-11-02). Checked on a clean
`git archive d09623e` export in the scratchpad, plus CI run 41498073115 (Build Android, debug, `headSha` d09623e,
conclusion success). Any later commit that changes the build makes this report stale. Not legal advice.

Read first: playbook (incl. Hard rules L-cc-001, L-gd-004), `lessons/_shared.md`, `lessons/compliance-checker.md`,
`docs/STATUS.md` (standing rules and decisions, incl. the round-7 internal-testing scope), `assets/CREDITS.md`, the
changed art briefs.

Policies checked on 2026-11-02 (web search; `support.google.com` and the trademark registries are not reachable from
here):
- Google Play loot-box odds rule: unchanged; it covers random items obtained from a purchase.
- Google Play internal testing: up to 100 named testers, not visible to the public.
- PEGI June 2026 rules for paid random items: unchanged since round 6.

| # | Item | Result |
|---|---|---|
| 1 | IP | **FAIL**: title only. Game content, character looks and icon PASS |
| 2 | Licenses | PASS |
| 3 | Privacy | PASS |
| 4 | Age rating | PASS |
| 5 | Gacha | PASS |
| 6 | Permissions | PASS |
| 7 | Secrets | PASS |
| 8 | Release-build hygiene | PASS |

Checklist: 7 PASS, 1 FAIL, 0 N/A.

## 1. IP — FAIL (title "Jade Tempest")

**Content: PASS.**
- `node tests/sim/banned-grep.mjs data src index.html android/app/src/main/res/values capacitor.config.json` →
  `hard_hits=0 review_hits=0`, `name_hits=0`.
- `npm run validate-data` → PASS.
- The 97-term franchise sweep (round-6 list, proven to catch planted terms) found 0 hits in `data`, `strings.json`,
  art briefs, STYLE_GUIDE, `store/`, `index.html`, Android `values/` and `capacitor.config.json`.

**Character looks: PASS** (L-ad-001).
- Rook: every check pattern, the hoodie and the dark hair are removed. Hair is now mulberry `#5E2A48`
  (`src/ui/fighter-shapes.js:88-89`).
- Pell: hair is now chestnut `#7A4A2A` (`:62`); silver hair with white robes is gone.
- Tavi: the crimson top with a single braid is gone (charcoal jacket tied at the waist, brief §colours).
- QA screenshot `reports/screenshots/round-7/360x640-60-silhouettes-color.png` shows no franchise-lead combination.

**App icon: PASS.** `assets/app-icon/*` shows a green crystal, a gold bolt and mint arcs. It has no external refs,
`<image>` or `<text>`. There is no Capacitor branding (`check-identity`: "template vector launcher foreground removed").

**Title: FAIL.** Searched word by word (Hard rule L-gd-004), 2026-11-02:
| Query | Result |
|---|---|
| "Jade Tempest" (phrase, game/app/2026) | No game, app or filing. Exact match: a Light Bowgun in Capcom's *Monster Hunter Freedom 2/Unite*. |
| TEMPEST (word) | **Live US Reg. 3426691, Atari Interactive, Class 9, video game software**, renewed. |
| JADE (word) | **Live US Class 9 marks**: Reg. 3019064 and Reg. 2241683 (Jade Software Corp / Aoraki), business software; Serial 98188534 pending (Classes 9/42). |

These come from aggregator search results. The USPTO could not be reached, so they are NOT VERIFIED there. Both
distinctive words carry live Class 9 marks, and TEMPEST covers the same goods.

**Scope (Producer decision, round 7: internal testing only).** Real-world risk on a private track of at most 100
testers is low. But Hard rule L-gd-004 says "a live mark on a distinctive word is a FAIL" with no track exception.
CLAUDE.md §6 says IP rules may not be loosened without the owner's written approval. The scoping is a Producer
default made after the owner did not answer, so it is not that approval. I therefore cannot score this item PASS.

Any **one** of these clears it (owner → Producer):
1. The owner writes in `docs/STATUS.md` → "Owner feedback" that "Jade Tempest" may be used for the Google Play
   internal-testing track only, accepting the risk above. Item 1 then becomes PASS (internal testing only), with the
   condition that clearance or a title switch happens before any closed, open or production track. No rebuild is
   needed.
2. A lawyer's clearance search (USPTO/EUIPO/UK, classes 9/28/41) clears the name. Paid, so it is an owner decision.
3. A title-neutral app name for the internal build, made only of generic words (for example "Anime Card Battler
   (test)", matching appId `com.animecardbattler.game`). This needs ui-developer (`strings.json` `game_title`,
   `index.html` `<title>`) and release-engineer (`capacitor.config.json` `appName`, `res/values/strings.xml`). It is
   a new build commit, so the full checklist must be re-run.

## 2. Licenses — PASS

- **Bundle module list**, independent Rollup `generateBundle` on the export: `ajv, ajv-formats, fast-deep-equal,
  fast-uri, json-schema-traverse, phaser`.
- **`npm ls --omit=dev`** adds `@capacitor/android` 8.5.3, `@capacitor/core` 8.5.3 (not imported by `src/`, so not
  bundled), `tslib`, `require-from-string` and `eventemitter3`. The last three are not bundled; Phaser carries its own
  eventemitter3 copy under its own licence.
- The clean build writes `THIRD_PARTY_LICENSES.txt` (24,989 bytes). It has sections for all 6 web packages:
  7 MIT permission texts and the BSD-3 text for fast-uri. It also covers @capacitor/android, the Cordova bridge,
  7 AndroidX libraries, `org.apache.cordova:framework` 14.0.1 with the ASF NOTICE, the AndroidX/Kotlin/kotlinx/
  JSpecify/Guava transitive groups, and the full Apache-2.0 text.
- **Native coverage:** CI step "Native licence notices cover the runtime classpath" →
  `Runtime classpath: 50 modules, 2 projects`, `check-native-licenses: PASS`.
- **CREDITS.md** has a row for every web and native library and for the app icon (self-made).
- **Files on disk:** `assets/` holds 6 SVGs and 1 PNG; `android/` holds 25 mipmap PNGs plus `gradle-wrapper.jar`,
  which is a build tool and is not shipped. All shipped files are covered by the icon row. No audio or font files.
- **In-game:** Settings → Licenses (`src/scenes/LicensesScene.js:68` fetches the bundled file;
  `reports/screenshots/round-7/360x640-70-licenses-top.png`).
- Vitest on the export: `release-bundle` and `third-party-native` tests are included in the 72/72 PASS run (item 5);
  CI ran 602/602 tests.

## 3. Privacy — PASS

- **Source grep:** network-type calls are limited to `navigator.vibrate` (2) and the same-origin
  `fetch('./THIRD_PARTY_LICENSES.txt')`. There is no XHR, WebSocket, beacon, analytics, cookie or `@capacitor` import.
- **Native side:** MainActivity is a plain `BridgeActivity`. There are no plugins (`capacitor.build.gradle`
  dependencies are empty). There is no `google-services.json`. `CapacitorHttp` and `CapacitorCookies` are disabled.
- **Runtime probe** on the d09623e release build: 3 requests, all same-origin; 0 external; 0 cookies; local storage
  holds only `game_save`. **Positive control:** a planted fetch to `example.invalid` was caught.
- **New finding, handled:** `android:allowBackup="true"`, so Android Auto Backup may copy the save to the player's own
  Google Drive. The developer never receives it. I updated `store/privacy-policy.md` §2 to say so (draft now names
  d09623e). The Data safety answer stays "No data collected". If the owner prefers, release-engineer can set
  `allowBackup="false"`, but players would then lose progress when they change phones.

## 4. Age rating — PASS

Content is unchanged in kind. The text scan of `data` and `strings.json` for blood, death, profanity, alcohol,
drugs and gambling words gives the same benign hits as round 6. The round-6 IARC answers stand: fantasy violence;
no real-money or simulated casino gambling; no purchases; no user interaction or location. Recommended Play target
audience: 13+.

## 5. Gacha — PASS

- `data/banners.json`, `src/logic/summon.js` and the summon UI have not changed since round 6 (`git diff bf48920
  d09623e` on those paths is empty).
- Vitest on the export (shown-vs-drawn, summon, summon-view, release-bundle, third-party-native): 5 files, 72/72 PASS.
- `summon-rate.mjs 100000` → `0 out of ±0.5 pp`. **Negative run:** `QA_BREAK=skew` → `FAIL … 7 out of ±0.5 pp`.
- Rates and pity are shown in-game (round-5 rate-screen screenshot; same code and data). No real money.

## 6. Permissions — PASS

- **Source manifest:** `android/app/src/main/AndroidManifest.xml` declares only `VIBRATE` and uses
  `INTERNET tools:node="remove"`. The launcher activity is portrait. The FileProvider is not exported.
- **`node android/tools/check-identity.mjs`** → `PASS (46 checks, source only)`. Negative runs on a scratch copy, each
  gives `FAIL`:
  - adding `ACCESS_FINE_LOCATION`;
  - dropping `tools:node="remove"` (2 problems);
  - deleting VIBRATE.
- **Merged manifest** (CI run 41498073115, debug APK built from d09623e): `merged manifest permissions ⊆ allowed (got
  ["android.permission.VIBRATE","com.animecardbattler.game.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"])`,
  `check-identity: PASS (52 checks, incl. APK)`. The second permission is AndroidX core's app-private signature
  permission. It grants nothing and is never shown to the user.
- I could not download the APK artifact itself (blob storage returned 403 through the proxy), so the merged-manifest
  evidence is the CI log.

## 7. Secrets — PASS

- **History:** all 123 commits / all refs (`git log --all -p`) with the round-6 patterns plus a new Gradle-syntax
  pattern. Hits are only the `CLAUDE_CODE_OAUTH_TOKEN` comment in the workflow and my own round-6 report text
  describing dummy plants. No `.jks`, `.keystore`, `.p12`, `.pem`, `.key`, `.env`, `google-services`,
  `local.properties` or `keystore.properties` file was ever committed.
- **Tree:** the export (incl. `android/`), the bundle and `THIRD_PARTY_LICENSES.txt` → 0 real hits.
  `build.gradle` has no `signingConfigs`. Signing values come only from `secrets.ANDROID_*` in CI.
- **Negative control** (fresh clone at d09623e): a planted `AKIA…` key in `android/keystore.properties` was caught.
  A planted Gradle `storePassword "Hunter2Dummy99"` was **missed by the round-6 pattern**. I added
  `(storePassword|keyPassword|password|…)\s+"…"`, and the widened scan caught both. That widened pattern is the one
  used above.

## 8. Release-build hygiene — PASS

- **Hook names** (all 10 from `tests/ui/release-bundle.test.js`, now incl. `licensesScreen`):
  - clean build: every count 0;
  - `VITE_TEST_HOOKS=1` build: every count ≥ 1 (`__TEST__:3 … licensesScreen:1`).
- `strings.json` and `data/*.json` placeholder sweep (`TODO|TBD|FIXME|lorem|placeholder|[key]|debug|dummy`): 0. The
  bundle contains no TODO, TBD, FIXME or lorem.
- `?renderer=canvas` (`src/main.js:45`) remains in release. It is a renderer fallback, not a test hook, and cannot be
  reached in the Android app (no URL bar).

## Needs a human lawyer
The store title: clearance for "Jade Tempest" (or whatever replaces it) in USPTO, EUIPO and UK IPO, classes 9, 28
and 41, before any closed, open or production track. For internal testing, see options 1–3 under item 1.

## Lesson candidates
1. My round-6 secret pattern required `=` or `:` and missed Gradle's `storePassword "…"` syntax. It only showed up
   because the planted plant used that syntax this time. Rule: plant secrets in **each syntax the repo uses**
   (properties, JSON, YAML, Gradle/Groovy, JS) for the negative control, not just one.
2. A Producer scope decision ("judge the title against internal testing") conflicted with an unconditional Hard rule.
   Rule proposal for team-coach: Hard rules that gate on IP state whether any scope exception exists. If none does,
   the scope needs the owner's written approval in "Owner feedback" before a checker may apply it.
3. CI artifacts cannot be downloaded through this container's proxy. Have the debug workflow print the merged
   permissions and `debuggable` flag to the log (it already prints permissions), so compliance never needs the APK.
