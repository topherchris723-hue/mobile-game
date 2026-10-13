# Characters — the Sovereign bible

**Status:** designed 2026-10-13 for the 15 launch Sovereigns. Approved by the owner (open to later changes). Everything here is **in the game**: roster data in `src/config/sovereigns.ts`, Passives in `src/config/passives.ts` (numbers below are the tuned values; the config is the source of truth). Passive balance is checked with `npm run balance`.

## Originality rules

The owner's brief: three worlds that _feel_ like the three series that inspired them (an energy-martial-arts epic, a pirate adventure, a ninja saga) without copying them.

**We borrow genre tropes**, which no one owns: inner energy and aura transformations, tournaments, rivals, alien conquerors; crews, bounties, a navy, treasure maps, island-hopping; hidden villages, clans and bloodline arts, hand seals, sealed spirits, squads of three with a mentor.

**We never borrow a specific character's identity.** That means no combination of a famous character's signature look, power, and role. For example, never:

- a spiky-haired martial artist in an orange gi with a monkey tail and a two-hand energy wave;
- a straw-hatted captain with a rubber body;
- an orange-jumpsuited, whisker-marked ninja carrying a nine-tailed fox;
- recognisable names, catchphrases, techniques, symbols, logos, or outfits.

Every entry below ends with a **Distance** line: what the character shares with the genre, and what makes them their own. New characters must pass the same check before they're added.

## The worlds

### The Emberreach (Energy realm)

A volcanic continent of terraced dojos built into living mountains. Every person carries an inner fire, **Ember**. Fighters train to draw it out as aura, beams, and impossible speed. Masters can **Ascend**, a temporary state in which their Ember shows on their body: hair flares, the aura turns to flame, eyes glow. Ascension has three known stages (_Kindled_, _Blazing_, _Sunforged_), and each one burns stamina faster.

The Emberreach settles everything at the **Caldera Games**, a tournament held inside a dormant volcano. Its old enemies are the **Starborn Tyrants**, conquerors from beyond the sky whose last invasion is still carved into the mountains.

- Look: martial wraps, sashes, bandaged forearms, sleeveless tunics, short capes, and angular rock motifs. Palette: ember orange, basalt indigo, lava red.
- Battle feel: direct and explosive, the heaviest single hits in the game.

### The Thousand Tides (Ocean crews)

A sunlit sea of a thousand islands, each with its own law. Crews sail under **bounty flags** chasing the **Crown Current**, a legendary current said to carry its rider to the throne at the edge of the world. The **Tidewatch** navy keeps order, sometimes justly and sometimes not.

Some sailors carry **Tide Relics**, ancient objects that grant one power each: a storm in a bottle, a net that never breaks, a song that pulls on the sea. A relic chooses its bearer and binds them, so a bearer can never use a second relic.

- Look: long coats, sashes, rope, brass fittings, rolled sleeves, sea-worn boots, and foam-ring motifs. Palette: sea blue, sandstone, terracotta.
- Battle feel: flexible and tricky. Crews support each other, and much of their strength is in energy and healing.

### The Five Provinces (Warrior clans)

Mountain and forest provinces whose villages hide behind cliffs and mist. Clans pass down **Inheritances**, bloodline arts woven from **Kei** (spirit energy) and shaped with **seal-signs** made by hand. Children train in **squads of three** under a mentor.

Ancient storm, river, and mountain spirits were once bound into people called **Wardens**. A Warden is protected by the spirit and feared for it.

- Look: layered wraps, tabi, shin guards, scarves, armoured sleeves, headbands with clan crests (original designs only), and ink-brush and leaf motifs. Palette: canopy green, pagoda crimson, sunlit leaf.
- Battle feel: patient and resilient. The best guardians and sustain are here, and their attacks hit sharply when they land.

### The Rift and the Nexus

When the three worlds cracked (**the Shattering**), a crystal citadel, the **Nexus**, rose where they touch. Each world's strongest champions felt a shard of it lodge in their chest and became **Sovereigns**, pulled across the Rift to fight side by side. The **Riftborn** (the current Stalker, Shade, and Brute enemies) are what the Rift makes of people it swallows: echoes of fighters from a single world, which is why they can never Crossover. Because they echo the fighters the Rift swallowed, each Riftborn carries a Sovereign's Passive (Stalker: Siren's Hold, Shade: Ashen Pride, Brute: Rising Ember).

## Roster

Format: rarity · type · role. "Leader" is the in-game Leader Skill; "Passive" is always on in battle.

### Emberreach

#### Kaien — _Ember Fist_ · 4★ Fury Striker · starter

- **Concept:** a mountain courier who ran Ember-fuelled deliveries between dojos until he started beating the masters he delivered to. Now he enters every fight he can find, because each opponent shows him something new.
- **Personality:** warm, impatient, and honest to a fault. He forgives losses instantly, his own included. _"Again! That one didn't count, I was still learning it."_
- **Look:** lean. Sleeveless lava-red wrap tunic with basalt-indigo trousers, bandaged forearms, a short tattered courier's cape, and a satchel strap across the chest. Spiky black hair with **one ember-red streak**. Ascended (Kindled): the streak spreads, hair tips burn orange, and the cape becomes flame.
- **Fighting style:** compact jabs that build into a single overwhelming strike. **Sunbreak Fist** is one punch that releases all his stored Ember as a sunrise-coloured shockwave.
- **Kit:** Ember Jab · Flare Shot · Ember Focus (Focus) · Sunbreak Fist.
- **Leader:** Energy realm allies +15% ATK.
- **Passive — Rising Ember:** +6% ATK at the start of each of his turns on the field (max +24%). The bonus resets when he leaves.
- **Bonds:** rival _Vey_; sparring partner _Brakka_; friends _Maris_ and _Dravo_.
- **Distance:** shares the cheerful, battle-hungry hero trope. His own: courier backstory, cape and satchel, red-and-indigo palette, single-punch finisher (no two-hand beam), no tail, no gi.

#### Solenne — _Dawnbringer_ · 5★ Radiant Support

- **Concept:** keeper of the summit shrine where the first Ember was lit. She has trained every grandmaster of the last century and looks twenty-five. She came to the Nexus to see what the Shattering will make of her students.
- **Personality:** serene, teasing, and quietly frightening. She never raises her voice. _"You're strong. Now be useful."_
- **Look:** tall. Layered ivory robes with gold trim, ember-orange sash, a floating halo ring behind her shoulders, and long pale-gold hair in a high ponytail tied with a sun clasp. Always barefoot; her feet never quite touch the ground.
- **Fighting style:** open-palm strikes and light that mends allies. **Zenith Nova** turns the battlefield to noon for one blinding moment.
- **Kit:** Dawn Palm · Halo Burst · Sunlit Grace (Heal) · Zenith Nova.
- **Leader:** all allies +15% HP.
- **Passive — First Light:** allies who switch in while she is on the bench recover 5% HP.
- **Bonds:** mentor to _Kaien_ and _Vey_ (neither admits it); old friend of _Mei_ (healers' correspondence across worlds).
- **Distance:** shares the divine-mentor trope. Hers: shrine keeper, halo and sun motif, a healer rather than a fighter, no staff, no attendant role.

#### Brakka — _Basalt Wall_ · 3★ Fury Guardian · starter

- **Concept:** a lava-skinned warrior of the Hearthborn, a mountain people who grow harder the hotter they burn. He lost the Caldera Games final to Kaien and has trained beside him ever since.
- **Personality:** loud, loyal, generous, and bad at strategy. _"Plan? I'm the plan. Stand behind me."_
- **Look:** huge and broad. Cracked basalt-grey skin with glowing orange seams at the joints, an ember-orange vest, a heavy belt of volcanic glass, a short rust-coloured mohawk of spikes, and bare forearms like boulders.
- **Fighting style:** soaks hits and erupts. **Caldera Crash** slams the ground so magma bursts up under the enemy.
- **Kit:** Magma Knuckle · Cinder Spray · Basalt Wall (Guard) · Caldera Crash.
- **Leader:** Fury allies +20% DEF.
- **Passive — Basalt Skin:** takes 10% less damage from Blasts.
- **Bonds:** best friend _Kaien_; arm-wrestling rival _Goro_.
- **Distance:** shares the gentle-giant warrior-race trope. His own: living-stone skin, Hearthborn people, a defender rather than a berserker.

#### Vey — _Ashen Hex_ · 4★ Void Breaker

- **Concept:** heir of the Ashen Throne, a dynasty that once bargained with the Starborn Tyrants for black flame. She was exiled for refusing the bargain but kept the flame. She insists Kaien is her rival; Kaien thinks they're friends.
- **Personality:** proud, precise, sarcastic, and secretly kind. She hates being thanked. _"I didn't save you. You were in my way."_
- **Look:** slender and sharp. Basalt-indigo high-collared coat cut short at the waist, ash-grey wrapped legs, black gloves, silver-white hair in a severe low ponytail, and a cracked obsidian circlet. Black flame licks from her hands.
- **Fighting style:** curses first, then breaks. **Black Sun** gathers her flame into a small dark star that implodes.
- **Kit:** Ash Talon · Ember Hex · Smolder Curse (Sap) · Black Sun.
- **Leader:** Void allies +20% ATK.
- **Passive — Ashen Pride:** +15% damage against enemies whose Defence is lowered (Sapped).
- **Bonds:** rival _Kaien_; wary respect for _Akari_ (two exiles); dislikes _Isla_'s songs, which remind her of the throne room.
- **Distance:** shares the proud-rival-heir trope. Hers: a woman, an exiled heir who refused power, black-flame curses, an indigo-and-silver palette, no armour or royal crest.

#### Rhen — _Arc Runner_ · 3★ Swift Striker

- **Concept:** a construct built by a dead dojo master to carry on her style. Lightning runs where blood would be. Rhen is three years old, very fast, and still learning what feelings are for.
- **Personality:** cocky, curious, literal, and keen to be called a person. _"I am 97% sure that was a joke. Laughing now."_
- **Look:** small and wiry. Orange-and-indigo running wraps, one forearm of seamless pale metal with blue seams, spiky navy hair that crackles at the tips, and long scarf tails that flutter even indoors.
- **Fighting style:** strikes faster than the eye. **Thunderline** is a single dash that leaves a trail of lightning behind him.
- **Kit:** Spark Kick · Arc Bolt · Overcharge (Focus) · Thunderline.
- **Leader:** start each battle with +1 Rift Energy.
- **Passive — Arc Core:** the first time he switches in each battle, +1 Rift Energy.
- **Bonds:** adopted little brother to _Brakka_; fascinated by _Nerys_'s tricks.
- **Distance:** shares the artificial-fighter trope. His own: built by a teacher to preserve a style, a child-like personality, speed lightning, a single metal arm.

### The Thousand Tides

#### Maris — _Tidecaller_ · 4★ Swift Support · starter

- **Concept:** cartographer and navigator of the _Gull's Wager_, mapping the Crown Current one island at a time. She reads currents and weather like text and can bend sea spray into rings that heal.
- **Personality:** sharp, practical, and the only adult on any ship she's on. _"We're not lost. The map is wrong. I'll fix it."_
- **Look:** sea-blue sleeveless coat with sandstone trousers, a terracotta sash, a brass compass on a chain, and a rolled chart in her belt. Coral-red hair in a long ponytail with a navigator's bandana.
- **Fighting style:** keeps the crew alive and the enemy off balance. **Riptide Spiral** spins the sea into a vortex beneath the enemy.
- **Kit:** Undertow Kick · Spray Lance · Tidal Mend (Heal) · Riptide Spiral.
- **Leader:** Ocean allies +20% HP.
- **Passive — Read the Current:** takes 25% less damage from Signatures.
- **Bonds:** first mate to _Dravo_; pen pal of _Torvan_ (they trade maps and seeds); friend of _Kaien_.
- **Distance:** shares the navigator trope. Hers: a cartographer with water-ring healing, coral hair and a bandana, no weather staff, no orange hair.

#### Dravo — _Storm Captain_ · 5★ Fury Striker

- **Concept:** captain of the _Gull's Wager_ and bearer of the **Bottled Storm**, a Tide Relic fused to his right arm as a cannon of living weather. His dream is to ride the Crown Current to its end and break the chains the Tidewatch puts on free islands.
- **Personality:** big-hearted, reckless, and a terrible singer. He picks up strays and calls them crew. _"Everyone's crew until they say otherwise. Even then, maybe."_
- **Look:** tall and broad. Deep-sea long coat with brass buttons and rolled sleeves, a bare chest with a lightning-shaped scar, and a glass-and-brass storm cannon on his right forearm crackling with cloud. Black windswept hair with a short beard, a red sash, and sea boots. No hat.
- **Fighting style:** charges straight in. **Broadside Tempest** empties the storm in one cannon blast.
- **Kit:** Cutlass Rush · Cannon Volley · Rally Cry (Focus) · Broadside Tempest.
- **Leader:** all allies +12% ATK.
- **Passive — Captain's Will:** once per battle, survives a knockout blow with 1 HP.
- **Bonds:** captain to _Maris_ and _Nerys_; old enemy turned grudging friend _Corrin_; drinking contests with _Kaien_ (he loses).
- **Distance:** shares the free-spirited pirate captain trope. His own: an older bearded captain, a storm-cannon relic arm, no hat, no stretching body, a navy-defiance motive.

#### Nerys — _Net Weaver_ · 3★ Guile Breaker

- **Concept:** a con artist who bears the **Neverbreak Net**, a relic net that lengthens, tightens, and returns to her hand. She joined Dravo's crew to rob him and stayed because he kept forgetting to be robbed.
- **Personality:** smug, quick-tongued, greedy in theory, and generous in practice. _"Everything's for sale. You, for instance, are on discount."_
- **Look:** terracotta cropped jacket over a striped top, deep-sea pirate trousers, fishhook earrings, and an auburn braid. The Neverbreak Net is wound around her waist like a skirt of knotted rope.
- **Fighting style:** snares, feints, and weakens. **Maelstrom Trap** casts the net wide and drags the enemy into a whirlpool.
- **Kit:** Hook Feint · Net Cast · Riptide Snare (Sap) · Maelstrom Trap.
- **Leader:** Guile allies +15% ATK.
- **Passive — Sticky Fingers:** every second Strike she lands steals 1 Rift Energy.
- **Bonds:** crew with _Dravo_ and _Maris_; keeps "teaching" _Rhen_ to pickpocket.
- **Distance:** shares the thief-in-the-crew trope. Hers: a net relic, a con-artist backstory, no staff, no weather powers.

#### Corrin — _Lighthouse Keeper_ · 3★ Radiant Guardian · starter

- **Concept:** a former Tidewatch commodore who resigned when ordered to burn a free island. Now he keeps the lighthouse on that same island, and his anchor-shield lantern turns ships, and cannon fire, aside.
- **Personality:** steady, dry-humoured, and stubbornly decent. _"Orders are suggestions from people far away."_
- **Look:** stocky and weathered. A sandstone greatcoat over a deep-sea uniform with the insignia torn off, an anchor-shaped shield with a lantern set in its crown, a grey-brown beard, and a knitted cap.
- **Fighting style:** shields first. **Lighthouse Beam** turns the lantern into a column of light.
- **Kit:** Anchor Bash · Lantern Flare · Hull Brace (Guard) · Lighthouse Beam.
- **Leader:** all allies +12% DEF.
- **Passive — Beacon:** while he's on the bench, the active ally takes 8% less damage.
- **Bonds:** old enemy of _Dravo_ (they fought for ten years and now share a table); kindred spirit _Torvan_.
- **Distance:** shares the principled-navy-defector trope. His own: lighthouse keeper, anchor-lantern shield, a protector who never captains a ship.

#### Isla — _Abyss Singer_ · 4★ Void Support

- **Concept:** a singer of the Trench People, who live where sunlight ends. Her song pulls on everything: tides, ships, and the energy inside a fighter. She surfaced to find out why the deep has started singing back.
- **Personality:** soft-spoken, eerie, curious about surface customs, and quietly funny. _"Up here you clap for songs? Down there, we run."_
- **Look:** a deep-blue layered dress that moves like water, sea-blue gloves, pale aqua hair floating as if underwater, faint fin-like frills at the ears and wrists, and a pearl choker that glows when she sings.
- **Fighting style:** drains and disrupts. **Leviathan Call** sings up the shadow of something enormous from below.
- **Kit:** Undertow Grasp · Abyss Shot · Deep Siphon (Drain) · Leviathan Call.
- **Leader:** start each battle with +2 Rift Energy.
- **Passive — Siren's Hold:** when she Drains, she also recovers 5% HP.
- **Bonds:** fascinated by _Shiro_'s silence; _Vey_ avoids her.
- **Distance:** shares the deep-sea-people and siren tropes. Hers: an energy-draining song, an abyssal (not fish-bodied) design, a curious outsider rather than a queen.

### The Five Provinces

#### Torvan — _Rootwarden_ · 4★ Guile Guardian · starter

- **Concept:** heir of the Root clan of the Grove village. His Inheritance grows living wood from his Kei. Torvan would rather garden than fight, which is why the village trusts him to defend it.
- **Personality:** gentle, patient, dryly funny, and immovable when it matters. _"Trees don't hurry. They also don't fall over."_
- **Look:** tall and calm. A canopy-green layered wrap with crimson trousers, a woven-bark armguard, and dark green spiky hair with a leaf crest pin. Small branches sometimes sprout from his shoulders mid-fight.
- **Fighting style:** walls and slow pressure. **Thousand-Leaf Cut** turns a canopy of leaves to blades.
- **Kit:** Thorn Palm · Leafstorm · Root Guard (Guard) · Thousand-Leaf Cut.
- **Leader:** Warrior clan allies +20% DEF.
- **Passive — Deep Roots:** recovers 3% HP at the start of each of his turns on the field.
- **Bonds:** squadmates _Mei_ and _Shiro_ (mentor: _Goro_); map pen pal _Maris_; kindred spirit _Corrin_.
- **Distance:** shares the wood-bloodline and gentle-protector tropes. His own: a gardener heir, bark armour, a defender role.

#### Akari — _Gale Blade_ · 5★ Swift Striker

- **Concept:** the last swordswoman of the Kaze clan, whose village was erased by a storm spirit that she now carries sealed in her blade. She is a Warden who chose her own prison. She hunts whoever unsealed the spirit in the first place.
- **Personality:** calm, terse, and perfectionist, with a dry kindness for children. _"Breathe out. The blade does the rest."_
- **Look:** slim. A pagoda-crimson short haori over dark wraps, a canopy-green obi, a long black ponytail tied with a white cord, and a slender sword whose scabbard is wrapped in seal paper that flutters in a wind no one else feels.
- **Fighting style:** a single decisive cut. **Hundred Petal Storm** releases the spirit for one heartbeat, a hundred cuts in a gust of petals.
- **Kit:** Wind Step · Gale Shuriken · Still Mind (Focus) · Hundred Petal Storm.
- **Leader:** Swift allies +25% ATK.
- **Passive — Gale Step:** her first attack after entering deals +20% damage and pierces Guard.
- **Bonds:** two exiles with _Vey_; protective of _Shiro_; once studied under _Goro_.
- **Distance:** shares the last-of-her-clan and sealed-spirit tropes. Hers: a female swordswoman, a spirit sealed in her blade (not her body), no eye techniques, no lightning.

#### Goro — _Iron Mountain_ · 3★ Fury Guardian · starter

- **Concept:** a monk born without the gift to shape Kei, who spent forty years hardening his body instead. He now teaches the squads no one else wants.
- **Personality:** booming, cheerful, endlessly encouraging, and fond of terrible proverbs. _"A mountain is just a hill that refused to quit!"_
- **Look:** massive and older. An olive-green monk's wrap off one shoulder, iron prayer beads the size of fists, a shaved head with a grey topknot, a thick grey beard, and iron bracers.
- **Fighting style:** pure body, no arts. **Earthsplitter** is a downward palm that cracks the ground.
- **Kit:** Iron Palm · Stone Fist Wave · Mountain Stance (Guard) · Earthsplitter.
- **Leader:** Warrior clan allies +15% HP.
- **Passive — Unbroken Body:** can't have his Defence lowered (immune to Sap).
- **Bonds:** mentor of _Torvan_, _Mei_, and _Shiro_; arm-wrestling rival _Brakka_.
- **Distance:** shares the no-talent-hard-worker and monk tropes. His own: an old mentor rather than a student, a giant, prayer beads, no jumpsuit or bowl cut.

#### Mei — _Lotus Sage_ · 4★ Radiant Support

- **Concept:** a medic of the Lotus Hall who folds paper cranes that carry healing Kei. She is calm in every crisis and has broken the arm of every patient who refused treatment.
- **Personality:** brisk, warm, and terrifying to the reckless. _"Sit. Down. Now."_
- **Look:** a blush-pink medic's coat with canopy-green trim and a lotus crest, dark hair in a neat bun-ponytail with brush hairpins, a pouch of folded paper on each hip, and cranes circling her.
- **Fighting style:** heals and lights. **Thousand Cranes** sends a flock of paper cranes that turn to light on impact.
- **Kit:** Lotus Strike · Spirit Lantern · Healing Incense (Heal) · Thousand Cranes.
- **Leader:** Radiant allies +25% HP.
- **Passive — Field Medic:** her heals restore 30% more.
- **Bonds:** squadmate of _Torvan_ and _Shiro_; healer's correspondence with _Solenne_.
- **Distance:** shares the medic-ninja trope. Hers: paper-crane healing, dark hair, a lotus hall, and a support role without super-strength punches.

#### Shiro — _Ink Shadow_ · 3★ Void Breaker

- **Concept:** a clanless orphan raised by an assassin order that writes its seals in ink drawn from shadow. He left when they ordered him to kill his squad. He speaks rarely and writes notes instead.
- **Personality:** silent, dry, loyal, and secretly sentimental. He keeps every note his squad ever wrote him. _(writes)_ "Behind you."
- **Look:** slight. A charcoal hooded wrap with forest-ink trousers, white spiky hair, ink-stained fingers, a brush and seal scrolls on his back, and a mask pulled down at the neck.
- **Fighting style:** seals that weaken, then strikes from the shadows. **Moonless Night** writes one seal across the sky and puts out the light.
- **Kit:** Shadow Cut · Ink Kunai · Ink Seal (Sap) · Moonless Night.
- **Leader:** Warrior clan allies +10% ATK.
- **Passive — Ink Veil:** the first hit he takes after switching in is reduced by 30%.
- **Bonds:** squadmate of _Torvan_ and _Mei_; _Akari_ watches over him; _Isla_ keeps trying to make him talk.
- **Distance:** shares the defector-from-an-assassin-order trope. His own: ink-from-shadow seals, mute note-writing, white hair, no drawn beasts, no sealed spirit.

## Named Crossovers

Every cross-world pair can Crossover. These pairs have their own names because of their bonds (`src/config/crossovers.ts`):

| Pair            | Crossover           | Why                           |
| --------------- | ------------------- | ----------------------------- |
| Kaien × Maris   | Sunbreak Riptide    | starters                      |
| Kaien × Torvan  | Ember Thornstorm    | starters                      |
| Maris × Torvan  | Tidal Bloom         | starters, map pen pals        |
| Kaien × Dravo   | Stormfire Broadside | drinking rivals, fast friends |
| Brakka × Goro   | Mountain Breaker    | arm-wrestling rivals          |
| Vey × Akari     | Black Gale          | two exiles                    |
| Solenne × Mei   | Lotus Dawn          | healers' correspondence       |
| Corrin × Torvan | Lantern Grove       | kindred protectors            |
| Isla × Shiro    | Moonless Tide       | the singer and the silent one |
| Nerys × Rhen    | Livewire Snare      | the pickpocketing lessons     |

## For the artist

Each Sovereign needs a splash illustration and one battle illustration (art-style.md §10). Hard requirements per character:

- The **silhouette hook** named in their Look (Kaien's satchel and courier cape, Dravo's storm-cannon arm, Akari's seal-wrapped scabbard, Goro's giant beads) must read at thumbnail size.
- World palette for clothing, **type colour as the accent** (art-style.md §6.2–6.3).
- Nothing that recalls a specific existing character more than the genre; when in doubt, push the design further from it.
