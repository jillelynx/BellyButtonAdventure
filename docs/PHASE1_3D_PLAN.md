# Exploration Mode: 3D Sandbox and Challenges — Plan (not built yet)
*Phase 1, item 5 · written 2026-10-22 · for your approval before any building*

## Can the game do this now?
**Yes.** Exploration mode is already a 3D world built with Three.js (a free tool that draws 3D in a web browser). No new engine or library is needed. It runs on your M4 Mac, and the same files work on GitHub Pages.

## How big is it?
About **3 to 4 times** all the other Phase 1 items put together. Picking up, moving and stacking objects ("sandbox building") is the hardest part, so it should come last.

## Smaller first version to try with Liev
All of it happens in Belly Button's World, so nothing new has to be built from scratch:
1. **Lost Buttons (hidden items):** 5 big buttons hidden around the world: behind the yarn ball, on top of a giant button, under a tree. A sparkle shows when you're close.
2. **Ring Race (simple race):** float through 8 felt rings before the timer runs out, racing Belly Button (or Liev, whoever isn't playing). It uses the same timer and best-time records as the platformer.
3. **Help the Felt Bunny (helping a character):** a little felt bunny lost its scarf. You find the scarf and bring it back.
4. **Secret surprises:** a hidden picnic, a "button rain" if you jump on all four giant buttons, and a secret door that only opens after all three challenges.

**Rewards:** stickers that appear on Liev's adventure map, and small cosmetics: a bowtie for Belly Button, badges for the captain's hat.

**Later:** building (stack felt blocks to reach a high button), then challenges in each new place (a dacha garden in Kratovo, a beach treasure hunt in Lewes, and so on).

## What Phase 1 already does to make this easy later
- **`src/progress.js`** holds the timer, best times, treats and "use once" rest-spot memory. It has no drawing code in it, so the 3D sandbox can reuse it unchanged.
- **Separate save slot** (`bba.records`) for records and rewards, so they never mix with the Exploration or Platformer saves.
- **Challenges will be data**, like levels already are (a list in one file), so adding a new challenge doesn't mean new code each time.

## Suggested order (after West Cork, or whenever you choose)
1. Lost Buttons + map stickers
2. Ring Race (reuses the timer)
3. Felt Bunny helper quest
4. Secrets
5. Building with blocks (only if Liev loves the first four)
