# Asset Credits & Licenses

Every asset in the game must be listed here before it is merged. No entry, no merge.

| File | Type | Source / author | License | Commercial use OK? | Added round |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Allowed licenses without owner approval: CC0, CC-BY (with credit shown in-game), assets
made by the team, assets the owner has bought with a commercial license.
Anything else needs owner approval logged in `docs/STATUS.md`.

## Review log

- **Round 4 (art-director):** consistent. The repo ships **no** image, audio or font files
  (search of `src/`, `*.html`, `public/`, build configs for image/audio/font extensions,
  `@font-face`, Google Fonts URLs and Phaser `load.*` calls: 0 hits). All art is drawn in code
  (team-made, no entry needed per file). The table above stays empty.

## Fonts

- **In use:** system font stack only (`src/ui/theme.js`: Trebuchet MS, Segoe UI, Roboto, Arial).
  These are the device's own fonts and are not shipped, so no entry is needed.
- **Recommended, NOT approved, NOT bundled:** Lilita One (display) and Nunito (body), both
  SIL Open Font License 1.1 from the Google Fonts repository (`docs/STYLE_GUIDE.md` §10).
  OFL 1.1 is not on the allowed list above, so **do not add either font until the owner's
  approval is logged in `docs/STATUS.md`**. If approved, add one row per font file here with
  the copyright line, "SIL OFL 1.1", and ship the unmodified TTF with its `OFL.txt`.
