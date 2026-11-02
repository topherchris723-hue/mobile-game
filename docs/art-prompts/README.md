# Fyrenza: ChatGPT art prompts (for the owner)

Owner: art-director. Version: round 8 prep (written during round 7).
Source: `docs/STYLE_GUIDE.md` and `docs/art-briefs/char_*.md`. If a brief changes, this pack changes too.
Owner approval for ChatGPT art: `docs/STATUS.md`, "Owner feedback", round 7.

You make the pictures in ChatGPT. We (the team) do the rest: resize, cut out, put them in the game,
log them in `assets/CREDITS.md`, and check them for copying (compliance-checker).

This round: **one portrait and one battle pose per fighter**, plus the Ignition versions.
The game still moves the fighters with code. You do not need to draw any animation.

---

## 1. What you need

- ChatGPT on your phone (any plan that can make images).
- This repo open in your phone browser (github.com), to upload the files.
- About 5 minutes per picture.

---

## 2. The steps (one picture)

1. Open the fighter's file (list in section 6). Find the prompt you need, for example "A. Portrait".
2. Tap the **copy** button on the grey box. Copy the **whole** box.
3. In ChatGPT, start a **new chat** for each fighter. Paste the prompt. Send.
4. **From the 2nd picture on:** also attach the **style picture** (section 4) to the same message.
   For pictures B, C and D, attach the fighter's own approved portrait A as a **second** picture.
5. Check the picture with the checklist (section 5). If something is wrong, write a short fix in the
   same chat, for example: `Same character, same style. Fix: she must face the right side.`
   Use the "Fix lines" at the end of each fighter file.
6. When it is good: open the picture, tap **Download** (or press and hold, then **Save image**).
7. Rename the file to the name written above the prompt (for example `por_tavi_base_v1.png`).
8. Upload it (section 7).

Do not delete your ChatGPT chats. They show where each picture came from (we need this for the licence log).

---

## 3. Settings and sizes

Each prompt already says the size and the background. You do not need to change any setting.

| Picture | Ask ChatGPT for | Why | What we do after (round 8) |
|---|---|---|---|
| Portrait (head and shoulders) | **Square, 1024 x 1024** | Game portrait master is 512 x 512 (STYLE_GUIDE §4.4) | We shrink to 512, then make the 288 and 156 versions |
| Battle pose (full body) | **Tall / portrait, 1024 x 1536** | Game battle frame is 576 x 858; the shape of 1024 x 1536 is almost the same | We cut out the fighter, shrink it to its game height (for example Tavi 288 px, Dunmore 336 px) and place the feet at point (288, 810) of the 576 x 858 frame |

**Background:** each prompt asks for a **transparent background**. ChatGPT cannot always do this.
If you get a background, it must be **one flat plain light grey colour**, with no floor, no shadow and no
scenery. That is fine; we remove it. If you get a room, a sky or a floor, ask again:
`Same picture, but the background must be one flat plain light grey colour, nothing else.`

**Colours:** the prompts give colour codes like `#FF6A3D`. ChatGPT gets them close, not exact.
Close is OK. We can fix small colour differences. Only ask again if a colour is clearly wrong
(for example a red jacket when the prompt says dark grey).

**File type:** PNG is best. If your phone saves `.webp` or `.jpg`, upload it anyway. We convert it.

Not in this pack (later rounds): full-screen summon art (1080 x 1920) and Ignition cut-in busts.

---

## 4. Keeping the same style for all fighters

Three things keep all 8 fighters looking like one game:

1. **The style block.** Every prompt starts with the same paragraph (it begins with `STYLE:`).
   It is section 8 below. Never change it and never leave it out.
2. **The style picture.** Make **Tavi's portrait first** (`docs/art-prompts/char_tavi_001.md`, prompt A).
   When you like it, that picture is the **style picture**. Upload it like the others, and keep it on your phone.
   For **every other picture**, attach the style picture to the same message as the prompt (as the
   **first** picture). Every prompt ends with a line telling ChatGPT to copy only the **drawing style** of the
   first picture, not the character.
3. **The fighter's own portrait.** For pictures B, C and D of a fighter, also attach that fighter's approved
   portrait A as the **second** picture. The prompt tells ChatGPT to keep the same face, hair and colours.
   (For Tavi, the style picture and portrait A are the same file. Attach it once.)

If later pictures start to look different (thinner lines, soft painting, 3D look), start a new chat,
attach the style picture again, and paste the prompt again.

**Order** (easiest first, so the style is fixed early):
Tavi, Rook, Lark, Dunmore, Pell, Thessa, Corvane, Solenne.
For each fighter: A, then B, then C and D (if the fighter has an Ignition form).

---

## 5. Checklist before you save a picture

Say "yes" to all of these:

- [ ] Only **one** character. No second person, no animal.
- [ ] The character **faces the right side** of the picture.
- [ ] **Battle pose:** the whole body is inside the picture (hair, hands, feet, staff). Feet near the bottom.
- [ ] **Portrait:** head and shoulders, face fully inside the picture.
- [ ] **No text** anywhere: no letters, numbers, signature, logo, symbol or watermark. (Also none on clothes.)
- [ ] Hands look normal (5 fingers).
- [ ] Clean dark outlines and flat colours (it looks like a cartoon, not a photo and not a 3D model).
- [ ] Colours are close to the prompt.
- [ ] Nothing from the fighter's **"Avoid"** list.
- [ ] It does **not** remind you of a famous anime, game or cartoon character. If it does, do not use it.
      Ask again and tell us in your upload message which character it reminded you of.

The compliance-checker checks every picture again before it goes into the game.

---

## 6. Files (one per fighter)

| Fighter | File | Pictures |
|---|---|---|
| Tavi | `docs/art-prompts/char_tavi_001.md` | A, B, C, D |
| Rook | `docs/art-prompts/char_rook_001.md` | A, B, C, D |
| Lark | `docs/art-prompts/char_lark_001.md` | A, B (no Ignition) |
| Dunmore | `docs/art-prompts/char_dunmore_001.md` | A, B (no Ignition) |
| Pell | `docs/art-prompts/char_pell_001.md` | A, B, C, D |
| Thessa | `docs/art-prompts/char_thessa_001.md` | A, B, C, D |
| Corvane | `docs/art-prompts/char_corvane_001.md` | A, B, C, D |
| Solenne | `docs/art-prompts/char_solenne_001.md` | A, B, C, D |

A = portrait, B = battle pose, C = Ignition portrait, D = Ignition battle pose. 28 pictures in total.

---

## 7. File names and upload

**File name** = the name written above each prompt. Small letters, underscores, no spaces:

- `por_<fighter>_base_v1.png` (portrait)
- `spr_<fighter>_base_v1.png` (battle pose)
- `por_<fighter>_ignition_v1.png` (Ignition portrait)
- `spr_<fighter>_ignition_v1.png` (Ignition battle pose)

If you make a better one later, use `_v2`, `_v3`. Do not overwrite an old file.

**Upload** (phone browser):

1. Open this link (it opens the upload page for the right folder, and makes the folder if it is not there):
   `https://github.com/topherchris723-hue/mobile-game/upload/claude/new-session-uo46wt/assets/art/incoming`
2. Tap **choose your files**, pick the pictures.
3. In the message box write, for example: `art: tavi A+B, ChatGPT, 2026-11-05`.
4. Tap **Commit changes**.

Only upload to `assets/art/incoming/`. Do not put pictures anywhere else. The team moves them into the game
in round 8, after the checks.

---

## 8. The style block (already inside every prompt)

```
STYLE: Original 2D character art for a mobile fighting card game with a fire and power theme. Hype and energetic, anime-inspired but a fully original design. Clean, confident outlines in very dark navy (#14172B): a thick closed outline around the whole character and thinner inner lines. Flat cel shading: each area has one base colour and one darker shadow colour, at most one small highlight. No gradients, no soft airbrush, no painterly texture, no 3D render look, not a photo. Big simple shapes, slightly oversized hands and fists, big expressive eyes and one clear eyebrow shape, so the character is easy to read when it is very small on a dark navy night arena (#0D1020). Bright, saturated costume colours. Light comes from the upper front. One character only. No text, letters, numbers, logos, symbols, emblems, signatures or watermarks anywhere, also not on clothes.
```

---

## 9. What NOT to do

- **Never write a franchise, anime, game, character or artist name** in ChatGPT. Not even to say
  "not like X". (Our "Avoid" lines describe shapes and colours instead. That is on purpose.)
- **Never write "in the style of ..."** (no artist, studio, anime or game).
- **No text in the picture.** If ChatGPT adds letters, a name or a logo, ask again.
- Do not upload a picture from Google, Pinterest or any other site as the "style picture". Only use our own
  Tavi portrait made with these prompts.
- Do not upload photos of real people.
- Do not change the style block or the colour codes. If you want a change, write it in the upload message
  and we will update the prompt.
- Do not pay for any extra tool or service for this (CLAUDE.md §8: paid things need your separate OK).
