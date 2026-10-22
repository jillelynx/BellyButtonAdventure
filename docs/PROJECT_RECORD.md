# Project Record — Belly Button Adventure
*Living document. Re-read before new work. Last updated: 2026-10-21 (Milestone 1).*

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
| A16 | Work folder: `BellyButtonAdventure` on your Mac; you push to GitHub from there | Message, 2026-10-21 |

## 2. My suggestions, not yet approved
| # | Suggestion |
|---|---|
| S1 | Working title "Belly Button Adventure" |
| S2 | Story details in CONCEPT.md: glowing belly button, Doodle Doors, Treasure Stamps, scrapbook ending |
| S3 | Reading, PA is home: the game starts in Liev's bedroom |
| S4 | Character abilities: Liev kicks a soccer ball and climbs; Belly Button bounces and floats. Both can finish everything. |
| S5 | Player can swap characters at any door or on the map |
| S6 | Belly Button is about chest-high to Liev in the map world |
| S7 | Visual direction, palettes and soccer kit layout in VISUAL_DIRECTION.md |
| S8 | Captain's hat = camo patrol cap with two silver captain's bars |
| S9 | Technical approach in FEASIBILITY.md (Three.js, no build step, `Play on my Mac.command`) |
| S10 | Build order: home + Belly Button's World first, then one real place in full, then one place at a time |
| S11 | WWII tone: cartoon action, no blood, defeated enemies get dizzy and are captured, no swastika imagery (see Q2) |

## 3. Open questions
- **Q1.** After home and Belly Button's World, which real place should be built first? (Suggested: West Cork.)
- **Q2.** WWII tone: (a) cartoon action as in S11, (b) mostly sneaking, rescuing and sabotage, or (c) your own idea?
- **Q3.** Lightning bolt: left side, right side or both?
- **Q4.** Should Belly Button be chest-high to Liev (S6), or small like the real toy?

## 4. Milestone plan and acceptance criteria

### Milestone 1 — Concept and feasibility ✅ (this delivery)
- [x] One-page concept · [x] feasibility note · [x] visual direction · [x] this plan · [x] project record started

### Milestone 2 — Core slice and visual checkpoint
Playable: start screen → character select → Liev's bedroom → the map comes alive → a small patch of Belly Button's World with one Doodle Door → a short test platformer level → back out → the door appears on the map.
- [ ] Character select shows Liev (3 outfits, 2 hairstyles, hat on/off) and Belly Button. Every detail on the VISUAL_DIRECTION checklists is checked against the photos.
- [ ] Walk, run, jump (with forgiving timing), camera orbit with mouse and trackpad, zoom with pinch or scroll.
- [ ] Camera never goes inside walls or the ground.
- [ ] Nothing can be walked through: walls, furniture, the friend character (tested from several directions and speeds).
- [ ] The friend follows without blocking or shoving.
- [ ] Door → platformer → back works both ways; the door shows on the map, and clicking it travels there.
- [ ] Separate saves for each mode survive a page reload.
- [ ] Speed meter (F key). Screenshots from fixed spots delivered for your approval of the look.
- [ ] `Play on my Mac.command` opens the game.

### Milestone 3 — First complete loop
One real place fully built (Q1) with landmarks, 2 platformer levels, Treasure Stamps, hints, sound and volume controls, autosave, gentle "turn back" world edges.

### Milestone 4 — Expansion
Add the remaining places one at a time, each with its own tests before the next starts. The Time Door to France 1944 comes after its tone is approved (Q2).

### Milestone 5 — Polish
Animation, lighting, sound, transitions, readability, speed.

### Milestone 6 — Release check
Full play-through, all regression checks, a test on your Mac, final CREDITS.md and how-to-play.

## 5. Known issues and verification
- Nothing is playable yet, so nothing gameplay-related is verified.
- Verified (automated check passed): Three.js 0.180 downloads and installs; the test browser can draw 3D in software mode.
- Not verifiable by me: real speed on your M4 Mac (needs your testing at Milestone 2).
