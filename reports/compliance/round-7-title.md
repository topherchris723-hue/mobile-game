# Compliance — round 7: title IP check (item 1, title only)

Build checked: **8ebcded391361b6ef0ad690a5e8110ad73707973** (repo HEAD on 2026-11-02, "round 7: wip title candidates").
This report covers the **title candidates only**. It is not a full-checklist report, and it does not clear any build.
The full checklist runs later on the build commit that carries the chosen title. That run will make this report part of
a new item-1 result. Not legal advice.

Read first: `.claude/agents/compliance-checker.md` (Hard rules L-cc-001, L-gd-004), `lessons/compliance-checker.md`,
`lessons/_shared.md`, `reports/round-7-title-candidates.md`, `reports/compliance/round-7.md` §1 (the Jade Tempest FAIL).

Policies checked on 2026-11-02:
- Google Play Metadata and Impersonation policies. A title must not use another entity's brand, title or name in a way
  that could mislead. Title limit is 30 characters. I found no 2026 change. `support.google.com` is not reachable from
  here, so this comes from the search-result summary.

## 0. How I judged (Hard rule L-gd-004)

- The **distinctive word** of each title is the coined word. "Card Duels" and "Arena" are generic descriptors.
- **FAIL:** a live mark on the coined word itself, in or related to classes 9/28/41.
- **RISK:** no live mark on the coined word, but one of these applies:
  - a live mark in 9/28/41 sits inside the word;
  - a live mark sounds the same;
  - a syllable part echoes a known franchise.
  A RISK name needs a lawyer's view before any public track.
- **CLEAR:** none of the above found.

## 1. Limitations (record, not a pass or fail)

- **Official registries not reachable.** These failed from this container: `tmsearch.uspto.gov`, `tsdr.uspto.gov`,
  `euipo.europa.eu` (proxy 403 on CONNECT, per `$HTTPS_PROXY/__agentproxy/status`), `branddb.wipo.int` and
  `trademarks.ipo.gov.uk` (Producer check).
- **Aggregators and stores not fetchable either.** WebFetch returned `ENOTFOUND` for `trademark.justia.com`,
  `www.registerkaro.in`, `uspto.report`, `www.trademarkia.com` and `play.google.com`. curl got no connection to
  `gleanmark.com`, `trademarkdir.com`, `apps.apple.com`, `igdb.com`, Steam, itch.io, `fandom.com`, IP Australia or CIPO.
- So **every trademark row below comes from WebSearch summaries of aggregator pages**: Justia, gleanmark, trademarkdir,
  registerkaro, IP Australia. I could not open the record itself. Treat every row as NOT VERIFIED against the registry.
- Store and app coverage is web-indexed only. Google Play and App Store internal search were not run.
- Not checked: domains, social handles, EUIPO/WIPO/UK/JP/KR/CN registers, and common-law (unregistered) use.

## 2. Follow-ups on the designer's two near-marks

| Mark | Query | Finding | Relevance |
|---|---|---|---|
| FHYENZ | `FHYENZ trademark 6535381`, `FHYENZ trademark goods class registered 2021` | US Reg. 6535381, serial 90388751, filed 2020-12-17, registered 2021-10-26, live (status 700). **Class 25 only**: shirts, dresses, sandals, mountaineering shoes, tank tops, stockings, swimming trunks. Owner hidden behind a Justia login. | Unrelated goods (clothing). It is also visually and aurally far from FYRENZA. **Not a conflict.** |
| AUREN | `AUREN trademark India class 9` | India application no. 8015607, word mark, **filed 2026-09-23**, Ahmedabad, "Ready for Examination". **Class 9: loudspeakers, wireless/Bluetooth/smart speakers, home audio.** Applicant not shown. | Pending, not examined. The goods are audio hardware, not software or games, but it is the same class 9 and AUREN sits whole inside AURENKO. **Contributes to RISK.** |

## 3. Per-name results

### 3.1 Kovanta — **RISK**

| Query | Result |
|---|---|
| `"Kovanta" trademark` | No record. Near: KOVRENA, KOVEA, KOVASTRIX (none in 9/28/41, per the designer's log). |
| `"Kovanta" game OR app OR anime` | No game, app or anime. |
| `"Kovanta: Card Duels" OR "Kovanta Arena" OR …` | No hits. Only generic Yu-Gi-Oh! "Duel Arena" pages. |
| `"Kovanta" … Steam OR itch.io OR "Google Play"` | No hits. |
| 1-letter / sound-alike: `"Kovanto" OR "Koventa" OR "Kavanta" OR "Kovanda"` | No exact match. Near: **KOVENTHOS** (US serial 99157833, filed 2025-04-27, **Class 28 toys and games**, awaiting examination), KAVANA (live, goods not shown). |
| Sound-alike: `COVANTA trademark registration classes` | **COVANTA, live US Reg. 3451902 (Class 42, renewed 2018).** It is pronounced the same as "Kovanta". The owner rebranded to Reworld in April 2024 (`Covanta rebrand Reworld 2024`), but the registration was still live at the last update. Its goods are waste-to-energy and engineering, not games. |
| Syllable split: `"Kovan" OR "Vanta" character anime OR game wiki fandom` | No franchise character. *Vanta* is a small itch.io action game (Optigear Studios). The nearest franchise name is "Kovats" (*Sword Art Online*), a different word. |
| Syllable split: `VANTA trademark registration class 9 software` | **VANTA, live US Reg. 6907702 (Vanta Inc., Classes 9, 41, 42 and one more), registered 2022-11-22.** Also VANTA AI, Reg. 8087995 (9/41/42, 2025). A separate pending VANTA, serial 99451910 (Class 9, visual/audio-effects software). The Australian VANTA 2306803 covers 9/41/42/45. |

**Verdict: RISK.** There is no live mark on KOVANTA itself, so it is not a FAIL under L-gd-004. But two things push it
toward RISK:
- it sounds the same as COVANTA (live, though in an unrelated class);
- the live VANTA mark, which covers **Class 9 and 41**, makes up five of its seven letters and the stressed syllable
  (ko-**VAHN**-tah).

An examiner or a rights holder could read KO + VANTA as containing the registered mark. KOVENTHOS (Class 28, pending) is
a distant third near-mark.

### 3.2 Fyrenza — **CLEAR**

| Query | Result |
|---|---|
| `"Fyrenza"` | No exact hit. All results are **Firenza**, a US fast-casual pizza chain (restaurant services, not checked by class). |
| `"Fyrenza" trademark OR game OR app` | No hits. Only unrelated "Frenzy" game marks. |
| `"Fyrenza Arena" OR "Fyrenza: Card Duels" OR …` | No hits. |
| `"Fyrenza" … Steam OR itch.io OR "Google Play"` | No hits. |
| 1-letter: `"Fyrenze" OR "Fyrenzo" OR "Firenza" game OR character OR app` | No exact game, character or app. The results are for the city name **Firenze**: *Firenze* board game (Pegasus/Quined), "Firenze Game" city app, "Ezio Auditore da Firenze" (*Assassin's Creed*, where it is a place epithet, not a name). |
| 1-letter: `FIRENZA trademark class 9 OR class 28 OR class 41` | **No FIRENZA mark found in 9/28/41.** Near: FIRENZE (live, class not shown), FIORENZA (Class 25), BLAZER FIRENZE and GABBANINI FIRENZE (Class 25), FIRENZE ROMA (cancelled). |
| Designer's FHYENZ follow-up | Class 25 clothing. Not a conflict (§2). |
| Sound-alike: `FRENZZA trademark class goods` | FRENZZA, US Class 9 filing, **abandoned 2023**. Not live. |
| Syllable split: `"Renza" OR "Fyren" character anime OR game fandom wiki` | No franchise character. Nearest: Rena Ryūgū (*Higurashi*), Ren (*Yu-Gi-Oh! ARC-V*), Fren (*Ousama Ranking*). These are different names. |
| Syllable split: `"RENZA" OR "FYREN" trademark class 9 OR class 41 OR class 28` | No RENZA or FYREN record in 9/28/41. |

**Verdict: CLEAR.** I found no live mark on FYRENZA. No live 9/28/41 mark sits inside it or sounds the same, and no
franchise echo turned up. Two minor notes, neither a risk under the rule:
- if read "fee-REN-za", it sounds like **Firenza**, a pizza chain name with unrelated goods;
- it is close to the place name *Firenze*.

The designer's pronunciation guidance ("fye") lowers both.

### 3.3 Tenvaro — **RISK (low)**

| Query | Result |
|---|---|
| `"Tenvaro"` | No hit. Results are tenofovir drug brands (Tenvir, Tenivar), the Tenveo camera brand and the Varvaro surname. |
| `"Tenvaro" trademark OR game OR app` | No record. Near: **TENVOONL** (serials 90762770 and 98329720, video-game hardware and toys, Class 28 by goods; the first's status was not shown, the second is a new application). |
| `TENVOONL trademark class 28 video game` | Confirms the goods: hand-held game units, consoles and joysticks. The name differs a lot visually and aurally (TEN-VOONL). |
| `"Kovanta: Card Duels" OR … "Tenvaro Arena" OR "Tenvaro: Card Duels"` | No hits. |
| `"Tenvaro" … Steam OR itch.io OR "Google Play"` | No hits. |
| 1-letter: `"Tenvara" OR "Tenaro" OR "Tevaro" OR "Zenvaro" game OR trademark OR character` | No hits. |
| Syllable split: `"Varo" OR "Tenva" character game wiki fandom anime` | No franchise character. Nearest: Varuf, Varuna (*Granblue*), Varzia (*Warframe*). These are different names. |
| Syllable split: `VARO trademark registration class 9 Varo Bank` | **VARO, live US Reg. 5177566 (Varo Money, Inc., Classes 9 and 36, registered 2017-04-04).** Mobile-banking software. Other VARO filings are abandoned or cancelled. |

**Verdict: RISK (low).** There is no live mark on TENVARO, so it is not a FAIL. The live VARO mark (Class 9, a banking
app) sits whole inside it, so by the same test I used for Kovanta it is a RISK. It is lower than Kovanta's:
- the goods are financial, not entertainment, and VARO has no Class 41;
- "Ten" is a common word, so TEN-VARO is less of a pure add-on prefix than KO-VANTA;
- there is no sound-alike twin like COVANTA.

TENVOONL (Class 28) is too far off to matter.

### 3.4 Aurenko — **RISK (reject recommended)**

| Query | Result |
|---|---|
| `"Aurenko"` | No hit. Results: the Ukrainian surname Hurenko/Gurenko, the Auren professional-services firm and the Aurus car brand. |
| `"Aurenko" trademark OR game OR app` | No hits. |
| `"Fyrenza Arena" OR … "Aurenko Arena" OR "Aurenko: Card Duels"` | No hits. |
| `"Aurenko" … Steam OR itch.io OR "Google Play"` | No hits. |
| 1-letter: `"Aurenco" OR "Aurenka" OR "Aureko" game OR trademark OR character` | No hits. Near: AUREN (India Class 9), AURUNZE, AURELO KIDS, AUURA, AUHORA. |
| Designer's AUREN follow-up | Pending India Class 9 application (speakers), filed 2026-09-23 (§2). It sits whole inside the word. |
| Syllable split: `"Auren" character game OR anime wiki` | No "Auren" character. Nearest: Aura the Guillotine (*Frieren*), Auron (*Final Fantasy*). |
| Syllable split: `Aurene Guild Wars 2 dragon` | **Aurene: a central character of *Guild Wars 2* (ArenaNet)**, the Elder Dragon of Crystal and Light, with a line of "Aurene's …" legendary weapons. AUREN- is AURENE minus one letter. |
| Syllable split: `Renko Usami Touhou character` | **Renko Usami: a lead of the *Touhou Project* (Team Shanghai Alice) music-CD stories and the web animation *The Sealed Esoteric History*.** "-renko" is the tail of AURENKO. |

**Verdict: RISK, reject recommended.** There is no live mark on AURENKO, so it is not a FAIL under L-gd-004. But:
- a Class 9 application (AUREN) sits whole inside it;
- it splits into two franchise echoes: *Guild Wars 2*'s Aurene and *Touhou*'s Renko.

The team dropped Tenzora for exactly that two-echo pattern (`reports/round-7-title-candidates.md` §3), and CLAUDE.md §9
asks for clearly original names.

## 4. Ranked recommendation

| Rank | Name | Verdict | Why |
|---|---|---|---|
| 1 | **Fyrenza** | **CLEAR** | No live 9/28/41 mark on it, inside it or sounding like it. FHYENZ is clothing. FRENZZA is abandoned. No franchise echo. |
| 2 | Tenvaro | RISK (low) | VARO (live, Classes 9/36, banking) is contained in it. No franchise echo. |
| 3 | Kovanta | RISK | Same sound as COVANTA (live, Class 42). VANTA (live, **Classes 9/41**) is contained in it and carries the stress. |
| 4 | Aurenko | RISK, reject | AUREN (Class 9 application) is contained in it, plus two franchise echoes (Aurene, Renko). |

This reverses the designer's default (Kovanta). The designer's searches found nothing on the exact words. The
containment and sound-alike searches I added found the VANTA, COVANTA and VARO marks.

**Single name I accept as PASS for IP item 1 (title): Fyrenza**. Store titles "Fyrenza: Card Duels" (19 characters) or
"Fyrenza Arena" (13 characters).

Conditions:
1. **Scope: internal testing only** (round-7 Producer decision, ≤ 100 named testers).
2. **Standing condition:** before any public track (closed, open or production), a human must run registry clearance
   and record the result in STATUS. That means the owner's lawyer or a paid clearance search (a CLAUDE.md §8 paid item).
   It covers USPTO, EUIPO, WIPO Global Brand Database and UK IPO in classes 9/28/41, plus common-law and store use.
   Until then, item 1 for the title is PASS (internal) only.
3. When the title is applied, the full checklist re-runs on that build commit. The banned-term and franchise sweep must
   cover the new strings, and the old title "Jade Tempest" must no longer appear in player-visible text.

Fallback if Fyrenza fails human clearance: **Tenvaro**, but only after a lawyer has looked at VARO. Kovanta needs a
lawyer's view on VANTA and COVANTA first. Aurenko: do not use.

## Sources (from WebSearch result summaries; pages themselves not fetchable here)

- FHYENZ: https://trademark.justia.com/903/88/fhyenz-90388751.html
- AUREN India: https://www.registerkaro.in/trademark-search/auren-8015607
- COVANTA: https://trademarks.justia.com/770/54/covanta-77054918.html; rebrand: https://www.reworldwaste.com/reworld-blog/covanta-announces-name-brand-transformation
- VANTA: https://gleanmark.com/owner/vantainc, https://trademarkdir.com/owner/vanta-inc, https://search.ipaustralia.gov.au/trademarks/search/view/2306803/details
- VARO: https://trademarks.justia.com/868/70/varo-86870042.html, https://gleanmark.com/owner/varomoneyinc
- KOVENTHOS: https://trademarks.justia.com/991/57/koventhos-99157833.html
- TENVOONL: https://trademark.justia.com/907/62/tenvoonl-90762770.html, https://trademarks.justia.com/983/29/tenvoonl-98329720.html
- FRENZZA: https://trademarkdir.com/owner/frenzza
- FIRENZE/FIORENZA: https://trademarks.justia.com/735/76/firenze-73576844.html, https://trademark.justia.com/754/81/fiorenza-75481019.html
- Aurene (*Guild Wars 2*): https://wiki.guildwars2.com/wiki/Aurene
- Renko Usami (*Touhou*): https://en-dic.pixiv.net/a/Renko+Usami, https://myanimelist.net/character/156843/Renko_Usami
- Firenze board game: https://meeplescorner.co.uk/sv/blogs/shop-news/quined-games-announces-2nd-edition-of-firenze
- Vanta (itch.io): https://optigear-studios.itch.io
- Play Metadata / Impersonation: https://support.google.com/googleplay/android-developer/answer/9898842, https://www.xda-developers.com/google-play-is-cracking-down-on-misleading-app-names-and-icons/

```
DONE: compliance round 7 (title IP check only)
Build checked: 8ebcded391361b6ef0ad690a5e8110ad73707973 (title candidates; not a build clearance)
Checklist: item 1 (title) only. Fyrenza CLEAR; Tenvaro RISK (low); Kovanta RISK; Aurenko RISK (reject)
FAIL items: none for the 4 candidates under L-gd-004 (no live mark on any coined word found)
Needs a human lawyer: registry clearance of the chosen title (USPTO/EUIPO/WIPO/UK IPO, cl. 9/28/41) before any public track
Policies checked on: 2026-11-02
Lesson candidates: see the hand-off report
```
