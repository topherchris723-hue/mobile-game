# Round 1 — Producer notes (input for /retro)

Phase 1 (Design) only. No code, so no QA, compliance or release review this round.

## Problems found inside the round (caught before commit of final data)
1. **Schema missing descriptive fields** (game-designer). characters.schema.json had
   `additionalProperties: false` and no `role` / `art_brief`, so content-designer could not
   store roles or art briefs. Fixed by game-designer in a follow-up.
2. **GDD prose vs schema enum mismatch** (game-designer). GDD §2 described a Perfect Slip →
   Riposte tutorial prompt, but the tutorial trigger enum had no `perfect_slip` / `riposte`.
3. **Undefined initial value** (game-designer). Tag cooldown at battle start was undefined
   (`tag_ready` at tick 0?). Fixed: `tag.initial_cooldown_s` = 5, AC-5.8.0.
4. **Incomplete banned-terms list** (game-designer). GDD §3 lacked several franchise terms
   (Spirit Bomb, Solar Flare, Chakra, Jutsu, Rasengan, Bankai, Hollow, Quirk, Stand).
   Content-designer's own scan caught "Stand" in two shouts. Ordinary words (stand, hollow)
   now warn instead of error.
5. **Schemas not validated by their author** (game-designer has no shell). Producer
   validated them with jsonschema Draft 2020-12: all 9 valid.
6. **Stale ownership list** (content-designer playbook). "You own" names
   `data/skills.json` and `data/story/*.json`; the real files per GDD §15 are
   `data/cards.json` and `data/story.json`, and banners/economy/battle were assigned to
   content-designer this round. Producer's task prompt also said `data/story/*.json`.
7. Near misses reported by game-designer: proposed title "Overpeak" was already in use
   (dropped); "Ascension" and "Spark" echoed franchise terms (dropped).

## Agent lesson candidates (verbatim summary)
- game-designer: web-search and banned-list-check every proposed name/term before writing it;
  pair every schema change with a validation run; check every GDD-scripted prompt/event
  against schema enums; give every cooldown/timer an explicit start value; ask what
  descriptive fields consumers need before `additionalProperties: false`; mark
  common-word banned terms as context-dependent.
- content-designer: never reuse short constant names in generators (crash);
  run validators against deliberately broken data before claiming PASS (validator crashed
  on missing ID, only negative test showed it); when task/playbook paths disagree with
  GDD §15, follow GDD and report; build banned-term list from GDD §3 each round, not memory.

## Verification evidence
- `jsonschema.Draft202012Validator.check_schema` on all 9 schemas: valid (Producer).
- Content validator (scratch, not committed): all 8 data files schema PASS, GDD §15.3
  rules 1–8 PASS, negative tests produce expected FAILs (Producer re-ran: ALL PASS).
- No `npm run validate-data` exists yet → gameplay-programmer should add one in round 2.

## Owner feedback
- none this round (owner asked about Unity version and cost only).
