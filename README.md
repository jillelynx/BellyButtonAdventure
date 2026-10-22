# Belly Button Adventure
An original adventure game starring Belly Button the plush bear and his best friend Liev.

## How to play
- **On this Mac:** double-click **`Play on my Mac.command`**. Your browser opens with the game. Keep the little Terminal window open while you play.
- **On the web:** https://jillelynx.github.io/BellyButtonAdventure/ (after GitHub Pages is turned on).

## Controls
| | Exploration | Platformer |
|---|---|---|
| Move | W A S D or arrow keys | ← → or A D |
| Run | Shift | Shift |
| Jump | Space (Belly Button: hold to float) | Space |
| Use / talk / open | E | — |
| Special moves | — | Liev: **X** kick, push into chalk walls to climb · Belly Button: **↓** in the air = Belly Bounce, hold **Space** = float |
| Swap to your friend | C | — |
| Look around | drag with the mouse, two-finger swipe, or Q / R | — |
| Zoom | pinch, or + / − | — |
| Map / Hint / Menu | M / H / Esc | M / H / Esc |
| Speed meter | F | F |
| Rest at a cozy spot | — | stand still on it (once per spot, gives a treat) |
| Race timer | — | turn on in Settings (off by default) |
| Go back / pause | Esc | Esc |

## Retro pixel level (Pixel Peaks, behind the green Pixel Door)
← → move · Shift run · Space jump · ↓ duck/crawl · run + ↓ slide · X kick the ball · Z punch crates · jump into ? boxes from below.

To change Liev's pixel animations: replace `tools/liev_retro_source_A.png` with a new sheet (8 frames × 7 rows in the same order), then ask Claude to run `tools/slice_sprites.py`. It re-cuts and lines up the frames into `assets/sprites/`.

## Project files
- Story and design: `docs/CONCEPT.md` · Look: `docs/VISUAL_DIRECTION.md` · Tech plan: `docs/FEASIBILITY.md`
- Decisions, plan and checklists: `docs/PROJECT_RECORD.md`
- Character colors and options: `src/characters/looks.js`
- Automated tests (run by Claude): `tests/`
