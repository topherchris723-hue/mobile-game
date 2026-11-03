# Compliance report — round 7b (full checklist, Fyrenza build)

Build checked: **6a4d7d034309320a79150c82acbc4715e1ec2f70** (HEAD of `claude/new-session-uo46wt` on 2026-11-03).
Checked on a clean `git archive 6a4d7d0` export in the scratchpad (`npm ci`, `npm run build` → `dist/assets/index-CIYCSK_g.js`).
This report is valid only for that commit. A later commit that changes anything shipped or tested makes it stale
(STATUS round-7 "exact commit" decision; L-cc-001). Not legal advice.

Read first: playbook (Hard rules L-cc-001, L-gd-004), `lessons/compliance-checker.md`, `lessons/_shared.md`,
`reports/compliance/round-7.md` (d09623e: 7 PASS, 1 FAIL title), `reports/compliance/round-7-title.md`, `docs/STATUS.md`
(owner feedback "I want an original name for our game"; the Fyrenza decision with the internal-testing scope), GDD §1 and §3
(banned list read fresh).

**Changes since d09623e (`git diff d09623e 6a4d7d0`):**
- Title strings: `strings.json` `game_title`, `index.html` `<title>`, `capacitor.config.json` `appName`, Android `strings.xml`,
  and comments.
- Licence notice: `vite.config.js` and `scripts/third-party-licenses.mjs` now take the notice name from `game_title`.
- Store texts.
- `src/scenes/BattleScene.js` and `src/ui/float-placer.js`: combo-pop clamp, shout fallback, `TEST_HOOKS`-gated switches.
- Tests.
- `docs/art-prompts/*` (new, docs only).
- Unchanged: `package.json`, `package-lock.json`, `data/`, `src/logic/`, `AndroidManifest.xml`, Gradle files and every
  asset binary.

**Policies checked on 2026-11-03** (web search; `support.google.com`, `asa.org.uk`, `trademark.justia.com` and the
trademark registries are not reachable from here):
- **Google Play loot-box odds rule:** no 2026 change found. Odds must be disclosed before a purchase of random items.
- **UK ASA/CAP enforcement notice "Disclosure of loot boxes in app stores"** (26 Feb 2026; monitoring since 26 May 2026).
  Store listings of games with loot boxes bought with real money **or paid virtual currency** must say so prominently (e.g.
  "Includes random-item purchases"); a generic "in-app purchases" label is not enough.
  - Fyrenza: Jade is earned only and cannot be bought, and there are no IAPs, so the notice does not apply.
  - Watch item: it applies the moment any paid currency or IAP is added.
- **Play title rules:** 30 characters max, no misleading use of another brand (Metadata and Impersonation policies). No
  change since round-7-title.

| # | Item | Result |
|---|---|---|
| 1 | IP (title, content, looks) | **PASS** (title scope: internal testing only, see conditions) |
| 2 | Licenses | PASS |
| 3 | Privacy | PASS |
| 4 | Age rating | PASS |
| 5 | Gacha | PASS |
| 6 | Permissions | PASS |
| 7 | Secrets | PASS |
| 8 | Release-build hygiene | PASS |

**Checklist: 8 PASS, 0 FAIL, 0 N/A.**

## 1. IP — PASS (title PASS for the internal-testing track only)

**Title "Fyrenza" / store title "Fyrenza: Card Duels"** (Hard rule L-gd-004: full phrase and every distinctive word).

Applied strings on 6a4d7d0:
- `game_title` = "Fyrenza";
- `<title>Fyrenza</title>`;
- `appName` "Fyrenza";
- Android `app_name` and `title_activity_main` = "Fyrenza";
- `store/listing.md` App name block "Fyrenza: Card Duels" (19/30; `grep -c '^Fyrenza: Card Duels$'` → 1).

Old title: `grep -rniE 'jade tempest'` over `store/ src/ data/ index.html capacitor.config.json android/app/src/main/res/values/`
→ 0 hits. It is also 0 in `dist/index.html`, the bundle and `THIRD_PARTY_LICENSES.txt`.

Searches on 2026-11-03, added to the round-7-title table:

| Query | Result |
|---|---|
| `"Fyrenza"` | No exact hit. All results are the Firenza pizza chain (restaurant). |
| `Fyrenza trademark OR game OR app OR "Card Duels"` | No Fyrenza product, game or mark. Only unrelated card-duel games (Yu-Gi-Oh! Duel Links, Order & Chaos Duels, Card Queen: Duel). |
| `"CARD DUELS" trademark class 9/28/41` | No CARD DUELS mark found. Nearest: GORGE DUEL (UK application, June 2026, classes 9/28), a different mark. "Card Duels" is a generic descriptor of the genre. |
| `FYRENZA OR FYRENZ OR FIRENZA trademark class 9` | No FYRENZA or FYRENZ record. **New near-mark: FIRENZE, US serial 77326075, class 9, gaming machines and wager software (Player Based Gaming LLC). Abandoned 2011-02-07 (status 606, no Statement of Use). Dead, so not a conflict.** |
| `FIRENZA trademark …` | FIRENZA, US Reg. 2464472 (serial 75759556), registered and renewed, **dry baking mixes**. Unrelated goods. A second FIRENZA serial, 78257175, appears in a result list, but its status and goods could not be resolved (NOT VERIFIED). Put it on the human clearance list. |
| `"Entretenimiento Firenze"` (entertainment owner seen in results) | Its US mark is PLAY DO IT (class 42), not a FIRENZE mark. Not relevant. |
| Subtitle `"Jade Throne"` (title screen, unchanged since round 3) | No game, anime or mark of that name. Nearest are *Jade Empire* (EA) and *Jade Dynasty*, which are different phrases. No conflict. |

Verdict on the title:
- I found no live mark on the distinctive word FYRENZA, inside it or sounding like it, in 9/28/41. That is round-7-title §3.2
  plus the new rows above.
- The Jade Tempest FAIL came from live marks on its distinctive words (TEMPEST, JADE). The rule's own cure, a title change,
  has been applied, and it answers the owner's written request for an original name. **No scope exception is needed** for
  PASS this time: the Hard rule does not fire, because no live mark exists on the word.
- The PASS stands with these conditions:
  1. **Internal testing track only.** That is the Producer decision in STATUS, and every `store/` file carries a "do not
     upload to a public track" note.
  2. **Before any closed, open or production track, a human must run registry clearance and record it in
     `docs/STATUS.md`** (owner's lawyer or a paid search, a CLAUDE.md §8 item). It covers USPTO, EUIPO, WIPO Global Brand
     Database and UK IPO, classes 9/28/41, plus common-law and store use. Include FIRENZA serial 78257175 and FIRENZE.
     All my trademark rows come from search summaries of aggregator pages, because the registries cannot be reached from
     this container. Treat them as NOT VERIFIED against the registry.

**Content: PASS.**
- `node tests/sim/banned-grep.mjs data src index.html android/app/src/main/res/values capacitor.config.json` →
  `terms=44 files=72 hard_hits=0 review_hits=0`, `name_hits=0`.
- `npm run validate-data` → PASS (10 files, 0 errors). Data is unchanged since d09623e.
- `banned-grep` over `store docs/art-prompts`:
  - store: 0 hits;
  - art-prompts: 8 hard and 7 review hits, all ordinary English in AVOID lists ("no martial-arts uniform", "stand-up
    collar", "does not stand up", "rock-bodied hero"). GDD §3 allows these: none is used as a mechanic, rarity or power name.
- **Franchise sweep.** The round-6 `franchise.txt` was lost with its scratchpad, so I rebuilt it: 115 patterns (DB, OP,
  Naruto, Bleach, JJK, MHA, Demon Slayer, JoJo, Street Fighter/MK/Tekken, Pokémon/Digimon/Yu-Gi-Oh!, HxH, Yu Yu Hakusho,
  Fist of the North Star, Saint Seiya, Gundam, Genshin and others, plus "tempest" and "monster hunter").
  - Negative control: a planted file with "KAIO-KEN / Instant Transmission / straw hat" → 2 of 2 lines caught, clean line not.
  - Run over `data/ strings.json index.html android values capacitor.config.json store/ docs/art-prompts/ docs/art-briefs/
    STYLE_GUIDE`:
    - `store/` (new copy): 0 hits.
    - `data/`: "Skyrail Tempest" (Lark's Climax card). It is unchanged since round 3 and was reviewed in rounds 6 and 7. It is
      a descriptive card name, not a product name, so it is low risk under the mark rule. Kept as a note for the human
      clearance.
    - `STYLE_GUIDE`: "no straw hat" (an avoid list).
    - `docs/art-prompts/char_rook_001.md:36,72`: "a lanky young street fighter" (see the advisory below).
- **New store texts read by hand** (short and full description, release notes, captions): no franchise names, moves or
  slogans, and no ranking or price claims. "Fighters ablaze with inner fire" and "Ignite a new form mid-fight" use the
  game's own IGNITE wording.

**Character looks: PASS.** `src/ui/fighter-shapes.js`, `theme.js`, `docs/art-briefs/` and `assets/` are unchanged since
d09623e, so the round-7 L-ad-001 result stands.

**`docs/art-prompts/` is docs only: confirmed.**
- `git ls-files docs/art-prompts` lists 9 `.md` files only.
- No file in `src/ scripts/ vite.config.js index.html android/` references them.
- No asset binary changed: the 32 image files in `assets/` and `android/` are the same set as round 7. Only the comment
  line in `generate-icons.mjs` and `ic_launcher_background.xml` changed.
- The prompt README forbids "in the style of …".

**Advisory (not a FAIL, nothing shipped). Owner: art-director, before the owner generates round-8 images.** Change "a lanky
young street fighter" in `char_rook_001.md` (lines 36 and 72) to e.g. "street brawler". In a prompt sent to an image
model, the capitalisable phrase can pull Capcom *Street Fighter* designs. Every generated image still gets the look-echo
check before it ships (owner approval conditions, STATUS).

## 2. Licenses — PASS (re-run in full: `vite.config.js` and `scripts/third-party-licenses.mjs` changed)

- **Bundle module list.** An independent Rollup `generateBundle` plugin on the export (my own config wrapping the repo
  config) gives `ajv, ajv-formats, fast-deep-equal, fast-uri, json-schema-traverse, phaser`. That matches the build's own
  `third-party-packages.json` and is the same as round 7.
- **`npm ls --omit=dev --all`** gives the same tree as round 7:
  - the 6 above;
  - `@capacitor/android` 8.5.3 and `@capacitor/core` 8.5.3 (core is not imported by `src/`);
  - `tslib`, `require-from-string` and `eventemitter3`, which are not bundled separately.
  - `package.json` and the lock file are unchanged since d09623e.
- **Shipped notice.** The clean build writes `dist/THIRD_PARTY_LICENSES.txt` (24,984 bytes).
  - Line 1: **"Fyrenza includes the following third-party software."**
  - 23 sections: the 6 web packages, the Capacitor Android runtime and bridge, 7 AndroidX libraries, Cordova framework
    14.0.1, the transitive groups and the Apache-2.0 text.
  - Must-FAIL, on my export copy only:
    - `game_title` set back to "Jade Tempest" → the notice header reads "Jade Tempest includes …";
    - `game_title` removed → the build stops with `Error: No non-empty strings.game_title`.
    - Restored afterwards (`grep` confirms "Fyrenza").
- **CREDITS.md:** a row for every web package (ajv, ajv-formats, fast-deep-equal, fast-uri, json-schema-traverse, phaser),
  for @capacitor/android, AndroidX and Cordova, and the self-made icon row. Unchanged since d09623e, and still complete.
- **In-game:** Settings → Licenses still fetches the bundled file (`src/scenes/LicensesScene.js:68`), and the scene is
  unchanged.
- **Tests:** Vitest `tests/ui/release-bundle.test.js`, `tests/data/third-party-native.test.js` and
  `tests/data/app-name.test.js` pass in the 95/95 run (item 5).
- **Native classpath:** there is no CI Android run on 6a4d7d0 (`gh run list` shows the latest on d09623e, run
  41498073115). The native inputs (Gradle files, `package.json`, lock file) are unchanged, so the round-7 result
  `check-native-licenses: PASS (50 modules)` still covers this build.

## 3. Privacy — PASS

- **Source grep** for `fetch(`, XHR, WebSocket, sendBeacon, EventSource, cookies, indexedDB, geolocation, media,
  clipboard, analytics, firebase and `@capacitor` imports: the only hit is the same-origin
  `fetch('./THIRD_PARTY_LICENSES.txt')`. The new `src/` diff adds no network, storage or navigator calls (only
  `TEST_HOOKS && this.<switch>` reads).
- **Runtime probe** on the 6a4d7d0 release build (`vite preview`, Chromium headless, 360×640, 40 taps over about 20 s):
  - `total 3`, all same-origin (`/`, `index-CIYCSK_g.js`, `index-TY74gA2S.css`);
  - `external []`, `cookies 0`, `localStorage ["game_save"]`.
  - **Positive control:** a planted `fetch('https://example.invalid/x')` gives `external ["https://example.invalid/x"]`.
- **Native:** manifest unchanged (VIBRATE only, INTERNET removed, `allowBackup="true"`, which the policy discloses). No
  plugins, no Google services.
- **Privacy policy draft** (`store/privacy-policy.md`): the store-writer's round-7 edit changed only the game name (diff
  read). I updated the header to name 6a4d7d0, and every fact still matches. **Data safety:** "No data collected, no data
  shared" stands.

## 4. Age rating — PASS

- Data and gameplay content are unchanged since d09623e. The new store copy adds no violence, gambling, drugs or language
  terms ("blow the arena apart" appears only in the GDD pitch, not in the store).
- IARC answers stand: fantasy violence; no real-money or simulated gambling; no purchases; no user interaction, sharing or
  location. Recommended target audience: 13+.

## 5. Gacha — PASS

- `data/`, `src/logic/` and the summon scene/view are unchanged since d09623e (`git diff --stat` is empty).
- Banner data: rates 3★ 80.00 / 4★ 17.00 / 5★ 3.00 (bp 8000/1700/300), hard pity 40, featured 50/50. The store copy matches:
  3.00/17.00/80.00, pity 40, a 5★ guarantee on the first ×10, 1,000 starting Jade, no real money.
- Vitest on the export: `summon-rates-shown-vs-drawn`, `summon`, `summon-view`, `release-bundle`, `third-party-native`,
  `app-name` → **6 files, 95/95 PASS**.
- `node tests/sim/summon-rate.mjs 100000` → `PASS … 0 out of ±0.5 pp`. **Negative:** `QA_BREAK=skew` → `FAIL … 7 out of ±0.5 pp`.
- The rates screen and pity counter are in-game (code unchanged). The Play odds rule is met. The UK CAP notice does not
  apply (earned-only currency, see Policies).

## 6. Permissions — PASS

- The source manifest is unchanged since d09623e: `VIBRATE` only, `INTERNET tools:node="remove"`, portrait, FileProvider
  not exported.
- `node android/tools/check-identity.mjs` → `PASS (46 checks, source only)`, incl. `appName is "Fyrenza"`.
- Negative runs on my export copy, each restored afterwards:
  - adding `ACCESS_FINE_LOCATION` → `FAIL (1 problem(s))`;
  - Android `app_name` set back to "Jade Tempest" → `FAIL res/values/strings.xml app_name matches appName`.
- **Merged manifest: NOT VERIFIED on 6a4d7d0.** No CI APK build exists for this commit, and there is no Android SDK here.
  The inputs that make up the merged manifest (manifest, Gradle, dependencies) are byte-identical to d09623e, where CI
  showed `VIBRATE` plus the app-private `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` only. The release-engineer's
  pre-review/APK run on this commit should print it again.

## 7. Secrets — PASS

- **History since d09623e** (`git log -p d09623e..6a4d7d0`) and the tree incl. `.github/`, `android/` and `dist/`: the
  only hits are dummy plants quoted in my round-6 and round-7 reports, workflow secret names
  (`${{ secrets.ANDROID_KEYSTORE_PASSWORD }}` etc.) and a word in a playbook. No real value. No key, keystore, `.env`,
  `google-services` or `*.properties` file has ever been committed (`git log --all` on those paths → 0).
- **Negative control, one plant per syntax used in the repo:**
  - `.properties`, `.json`, `.yml`, `.gradle`, `.js`.
  - The round-7 pattern **missed 2 of 5**: JSON `"apiKey": "…"` (it matched case-sensitively) and YAML `token: "…"`.
  - I widened it: case-insensitive, `=`, `:` or a space as the separator, more key names. The widened pattern caught
    **5 of 5**, and that is the one used above.

## 8. Release-build hygiene — PASS

- Clean `npm run build` against the `VITE_TEST_HOOKS=1` build. 14 names: the 10 hook names from `release-bundle.test.js`
  plus the 4 new scene switches `disableComboZones`, `disablePopClamp`, `disableShoutFit` and `cinFadeMs` (BUG-7c-02).
  - Clean build: **every count 0**.
  - Hook build: every count ≥ 1 (`__TEST__ 3`, `vfxQuality 6`, `disablePopClamp 1` …).
- L-shared-023 sweep (`prototype|placeholder|working title|TBD|TODO|lorem|test|debug|dummy`):
  - `strings.json`, `data/*.json`, `index.html`: 0.
  - Bundle: 0 TODO, TBD, FIXME, lorem or "working title".
  - Store copy blocks: 0 (App name 19, short 77, full 3,060 characters, release notes 387).
  - The store "do not upload" notes are internal notes outside the copy blocks.
- `?renderer=canvas` remains, as in round 7. It is a renderer fallback, not a hook.
- Minor doc note for the store-writer (not a FAIL): `store/listing.md` "Banned-term check" says the hyphenated genre phrase
  is still in the full description (1 line), but it is no longer there.

## Needs a human lawyer

- **Title registry clearance** for "Fyrenza" / "Fyrenza: Card Duels": USPTO, EUIPO, WIPO Global Brand Database and UK IPO,
  classes 9/28/41, plus common-law and store use.
  - Include FIRENZA serial 78257175 (status not resolved here) and the Firenza restaurant chain.
  - This is required **before any closed, open or production track**. Owner action (paid search or lawyer, CLAUDE.md §8).
    It does not block the internal-testing track.

## Note on this report's own change

I edited `store/privacy-policy.md` (header only: it now names 6a4d7d0) after 6a4d7d0, uncommitted.
- Under the STATUS round-7 "exact commit" rule, `store/` and `reports/` are not shipped or tested paths, so committing them
  does not make this report stale.
- If the Producer reads my playbook's stricter "anything committed after it" literally, that commit would need a re-run.
  Flagged for the Producer.

## Sources

- [ASA enforcement notice: disclosure of loot boxes in app stores](https://www.asa.org.uk/resource/enforcement-notice-disclosure-of-loot-boxes-in-app-stores.html)
- [Lewis Silkin: new ASA measures on loot boxes (Feb 2026)](https://www.lewissilkin.com/insights/2026/02/27/new-tough-measures-brought-in-by-the-asa-on-advertising-loot-boxes-in-the-uk-102mknq)
- [RPC: "In-app purchases" is not enough (summer 2026)](https://www.rpclegal.com/snapshots/advertising-and-marketing/summer-2026/in-app-purchases-is-not-enough-loot-box-disclosure-and-advertising-expectations/)
- [Fenwick: Google Play requires disclosure of loot box odds](https://www.fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds)
- [FIRENZE serial 77326075 (Justia)](https://trademark.justia.com/773/26/firenze-77326075.html)
- [FIRENZA serial 75759556 (Justia)](https://trademarks.justia.com/757/59/firenza-75759556.html)
- [PLAY DO IT serial 97100108 (Trademark Elite)](https://www.trademarkelite.com/trademark/trademark-detail/97100108/PLAY-DO-IT)
- [Firenza pizza (QSR Magazine)](https://www.qsrmagazine.com/news/firenza-moves-louisville/)
- [Jade Empire trademark (TweakTown)](https://www.tweaktown.com/news/64733/ea-files-jade-empire-trademark-remaster-way/index.html)
- [Round-7-title sources](reports/compliance/round-7-title.md)

```
DONE: compliance round 7b
Build checked: 6a4d7d034309320a79150c82acbc4715e1ec2f70
Checklist: 8 PASS, 0 FAIL, 0 N/A
FAIL items: none
Needs a human lawyer: title registry clearance (USPTO/EUIPO/WIPO/UK IPO, cl. 9/28/41, incl. FIRENZA 78257175) before any public track
Policies checked on: 2026-11-03
Lesson candidates: see below
```

## Lesson candidates

1. **The secret pattern missed JSON `"apiKey"` and YAML `token:`** (2 of 5 plants), even after round 7 widened it for
   Gradle. Rule: keep the secret regex in a versioned repo file, case-insensitive, with a fixture of one plant per syntax
   (properties, JSON, YAML, Gradle, JS), and require 5 of 5 caught before the scan counts.
2. **The 97-term franchise list was lost with its session scratchpad**, so I rebuilt it (115 patterns) from memory, which
   L-shared-008 warns against. Rule: commit the extended franchise list (e.g. `tests/sim/franchise-terms.txt`, owned by
   game-designer next to GDD §3) so every round uses the same list.
3. **Image-generation prompts are a new IP surface.** A descriptive phrase that is fine in an internal brief ("street
   fighter") can steer an image model toward a franchise design. Rule for art-director: run the franchise sweep over
   `docs/art-prompts/` before handing prompts to the owner, and avoid phrases that match a franchise name in any letter
   case.
4. **Playwright build mismatch:** `playwright-core` 1.56.1 expects headless shell 1194, but 1243 is installed. Probes need
   `executablePath`. QA and ui-developer may hit the same thing; the Producer could pin it or document it.
