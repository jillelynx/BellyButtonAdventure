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

## France, 1944 (behind the brown Time Door)
← → move · Space jump · X fire · Q (or 1 pistol, 2 rifle, 3 grenades) switch weapon · ↓ duck, or hide in a doorway / hay / barrel · Z punch · E open a cage · stand still at a safe house to heal.
Tips: duck under bullets, the machine-gun nest and the tank only stop for grenades, and red X marks show where bombs and shells will land.
The level layout is easy to edit at the top of `src/retro_war.js` (one line per thing).

## South Pacific, 1943 (behind the sea-blue Ocean Door)
Three parts in a row:
- **Island (on foot):** same controls as France 1944. E moves the logs to free a sailor. The gray bunker needs a grenade.
- **Submarine:** arrows steer · X fires a torpedo · stop inside seaweed to hide · rise near the top to hit ships · red buoys repair the sub.
- **Fighter plane:** ↑ nose up · ↓ nose down · → more power · ← less power · X fires · G puts the wheels up or down. Too slow and the plane stalls. To land on the carrier: stop 6 planes first, then wheels down, slow, and gentle.

## Liev's Cozy Cove (3D sandbox)
Step into the painting on the easel in Belly Button's World.
- Walk and run as usual · **T** changes the time of day · **E** uses things (toast a marshmallow, rest in the hammock, watch the sunset)
- In deep water you swim: **Space** swims up, **X** dives down to the reef
- Press **H** for a hint to the next special place (5 to find)
- Press **F** to see how smoothly it runs. If it's slow, Settings → Graphics → Fast

## Project files
- Story and design: `docs/CONCEPT.md` · Look: `docs/VISUAL_DIRECTION.md` · Tech plan: `docs/FEASIBILITY.md`
- Decisions, plan and checklists: `docs/PROJECT_RECORD.md`
- Character colors and options: `src/characters/looks.js`
- Automated tests (run by Claude): `tests/`
