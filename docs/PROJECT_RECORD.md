# Project Record — Belly Button Adventure
*Living document. Re-read before new work. Last updated: 2026-10-22 (Phase 1).*

## 1. Approved decisions (only things you said or clearly agreed to)
| # | Decision | Source |
|---|---|---|
| A1 | Two modes: 2.5D platformer and Exploration | Brief, 2026-10-21 |
| A2 | Main character: plush bear **Belly Button**, matching the photos | Brief, 2026-10-21 |
| A3 | His best friend: **Liev**, age 11, matching the photos | Brief, 2026-10-21 |
| A4 | Player chooses to play as Liev or Belly Button; more friends will be added later | Brief, 2026-10-21 |
| A5 | Liev outfits: soccer (red and white, number 12), camo army uniform, regular play clothes | Brief, 2026-10-21 |
| A6 | Second Liev hairstyle: combed up with product, skin fade, lightning bolt design in lighter brown (not skin color) | Message, 2026-10-21 |
| A7 | Story: Liev's adventure map comes to life (option B) | Answers, 2026-10-21 |
| A8 | Places: Moscow; Kratovo dacha neighborhood; West Cork, Ireland; Washington DC; Lewes, Delaware; Grand Canyon; Arizona desert; Antelope Canyon; Reading, PA; New York City; Old Quebec City; Miami; Belly Button's imaginary world | Answers, 2026-10-21 |
| A9 | A place where the friends go back in time to World War II France and fight the Nazis | Answers, 2026-10-21 |
| A10 | Platformer levels are doors found in Exploration; once found, they can be reached and returned to easily from a map | Answers, 2026-10-21 |
| A11 | Made mainly for Liev himself; single player | Answers, 2026-10-21 |
| A12 | Play clothes = camo-print zip jacket over blue (hoodie) | Answers, 2026-10-21 |
| A13 | Captain's army hat option, available with any outfit including play clothes | Answers, 2026-10-21 |
| A14 | Target: Mac with M4 chip; published with GitHub Pages | Answers, 2026-10-21 |
| A15 | No deadline; want to start playing and testing soon | Answers, 2026-10-21 |
| A16 | Work folder: `BellyButtonAdventure` on your Mac; you push to GitHub from there (repo jillelynx/BellyButtonAdventure) | Message, 2026-10-21 |
| A17 | First real place after home + Belly Button's World: **West Cork** | Answers, 2026-10-21 |
| A18 | WWII tone: **cartoon action** — soldiers get knocked dizzy and captured, no blood, no killing, no swastikas | Answers, 2026-10-21 |
| A19 | Lightning bolt on Liev's **left** side | Answers, 2026-10-21 |
| A20 | Belly Button is **chest-high** to Liev in the game | Answers, 2026-10-21 |
| A21 | A hidden admin password to reach any part of the game for checking | Message, 2026-10-21 |
| A22 | Milestone 2 characters are "okay for now"; **Liev's look needs more work later** | Message, 2026-10-21 |

| A23 | Liev's head: animated-movie kid style, matching your reference picture (oval face, chin, almond eyes, small nose, closed smile, spiky tousled hair with shorter sides) | Messages, 2026-10-22 |
| A24 | One or two platformer levels in **retro pixel-art style** (grassy dirt blocks, pixel trees, mountains, waterfall, pixel Liev) | Messages, 2026-10-22 |
| A25 | Phase 1 (dead-end fixes, optional timer, menu colors, cozy rest spots, 3D sandbox plan) comes **before** West Cork | Answers, 2026-10-22 |
| A26 | West Cork means the **Beara Peninsula** | Answers, 2026-10-22 |
| A27 | Rest-spot reward = treats (cookie, honey, cocoa), counted separately from buttons | Answers, 2026-10-22 |
| A28 | Main menu buttons: own colors + pictures (Play yellow ▶, Characters blue 🐻, Settings mint ⚙️, New adventure pink 🗺️); no extra Levels button for now | Answers, 2026-10-22 |
| A29 | Retro level uses **your pixel sprite sheets** for Liev (idle, walk, crouch/slide, kick, punch, run, jump) | Message, 2026-10-22 |
| A30 | Play clothes: **black shorts**, white socks, black shoes (from your character brief) | Brief, 2026-10-22 |
| A31 | 3D Liev route (c): Claude builds a rigged Liev in Blender now; swap in a Meshy/Tripo + Mixamo one later if it looks better | Message, 2026-10-22 |

## 2. My suggestions, not yet approved
| # | Suggestion |
|---|---|
| S1 | Working title "Belly Button Adventure" |
| S2 | Story details: glowing belly button, Doodle Doors, Treasure Stamps, scrapbook ending |
| S3 | Reading, PA is home: the game starts in Liev's bedroom |
| S4 | Abilities: Liev kicks a soccer ball and climbs chalk walls; Belly Button does a Belly Bounce and floats. Both can finish everything. |
| S5 | Swap characters any time in Exploration with **C** |
| S7 | Visual direction, palettes and soccer kit layout (VISUAL_DIRECTION.md) |
| S8 | Captain's hat = grey-tan digital-camo patrol cap (like the cap in the photo) with two silver captain's bars |
| S9 | Technical approach (FEASIBILITY.md): Three.js, no build step, `Play on my Mac.command` |
| S12 | Admin secret word is `bigbutton` (change it in `src/admin.js`) |
| S13 | Platformer collectibles are sewing buttons; falling = gentle return to the last rest spot (no lives) |
| S14 | First pixel-art level goes in West Cork |
| S15 | 3D sandbox first version: Lost Buttons, Ring Race, Felt Bunny, secrets (docs/PHASE1_3D_PLAN.md) |
| S16 | Picture signs instead of word signs in levels (done in the retro level) |
| S17 | First retro level "Pixel Peaks" behind a green **Pixel Door** in Belly Button's World (can move to West Cork later) |
| S18 | In retro levels Liev always plays (no Belly Button sprite sheet yet); Belly Button waits at the finish as a small pixel friend |
| S19 | Retro controls: Shift run, ↓ duck/crawl, run + ↓ slide, X kick, Z punch; ? boxes and crates give stars |
| S20 | (approved, see A31) |

## 3. Open questions
- **Q5.** What should change about Liev's look? (Accepted for now; to revisit.)
- **Q6.** Is the soccer kit right (red shirt with white trim, white shorts, red socks, big white 12 on the back)?
- **Q7.** Is the captain's hat the kind you meant?

## 4. Milestone plan and acceptance criteria

### Milestone 1 — Concept and feasibility ✅
### Milestone 2 — Core slice and visual checkpoint ✅ delivered for your review (2026-10-21)
- [x] Character screen: Liev (3 outfits, 2 hairstyles, hat on/off) and Belly Button — *automated screenshots; please compare with your photos*
- [x] Walk, run, jump (forgiving timing), camera orbit with mouse drag / trackpad swipe / Q R keys, zoom with pinch / + − — *code inspected, automated checks*
- [x] Camera never goes inside walls or under the ground — *automated check passed*
- [x] Can't walk through walls, furniture, trees, or the friend (several directions, fast, and at 12 fps) — *automated check passed*
- [x] Friend follows, steps aside, and walks around you instead of pushing — *automated check passed*
- [x] Bedroom → map magic → Belly Button's World — *automated check passed*
- [x] Door discovered → on the map → click it to travel back — *automated check passed*
- [x] Door → platformer → Treasure Stamp → back out in front of the door — *automated check passed*
- [x] Liev AND Belly Button can each finish the level with their own moves — *automated robot players passed*
- [x] Separate Exploration and Platformer saves survive a page reload — *automated check passed*
- [x] Speed meter (F key) — *needs your testing on your Mac for the real number*
- [x] Secret admin panel — *automated check passed*
- [x] `Play on my Mac.command` — *needs your testing (I can't run a Mac here)*

### Phase 1 — Fixes, quick wins, 3D plan ✅ delivered 2026-10-22
- [x] Dead-end audit: 5 found and fixed; Esc means "go back" on every screen — *automated checks passed*
- [x] Optional race timer (off by default; starts on first move; best time per level; confetti + "New record!") — *automated checks passed*
- [x] Main menu colors and pictures — *automated check + screenshot*
- [x] Cozy rest spots (pillow fort, blanket nook, picnic): checkpoints + one treat each per run — *automated checks passed*
- [x] 3D sandbox plan written (docs/PHASE1_3D_PLAN.md); shared progress code in src/progress.js

### Retro level — Pixel Peaks ✅ delivered 2026-10-22
- [x] Your sprite sheet cut into 56 aligned frames (feet on one ground line), crisp pixel scaling — *automated check + screenshots*
- [x] Animation follows what Liev is doing: idle, walk, run, jump rise/apex/fall, landing, duck/crawl, slide, kick, punch, resting — *automated checks passed*
- [x] Collisions: can't walk or jump past the log wall; slide or crawl under it; gate stays shut until a goal; water returns you to the last rest spot — *automated checks passed*
- [x] Same movement at 60 and 15 frames per second — *automated check passed*

### Milestone 3 — First complete loop: West Cork (Beara Peninsula)
One real place fully built with landmarks (green fields, mountains, rocky beach, soccer pitch), 2 platformer levels, Treasure Stamps, hints, ambient sounds, autosave, gentle world edges.

### Milestone 4 — Expansion (one place at a time, each tested before the next)
### Milestone 5 — Polish
### Milestone 6 — Release check

## 5. Known issues and verification
- **Liev's character model needs another pass** (you'll tell me what to change).
- Real speed on your M4 Mac: **not measured** (the test browser draws in slow software mode). Press **F** in the game to see it.
- Sounds and music: made in code; **not heard by me** — please check volume and feel.
- Exact fonts: on a Mac the game uses the "Chalkboard SE" handwriting font; my screenshots show a substitute font.
- Liev is a stylized storybook figure, not a photo likeness.
- Gamepad (game controller) support: not added yet.
