# Feasibility Note
*Milestone 1 · 2026-10-21*

## What I checked (for real, today)
| Check | Result |
|---|---|
| 3D library **Three.js** (free, open-source; draws 3D in a web browser) | Downloaded current version 0.180. Works. |
| Can I run and test the game myself? | Yes. I have a test browser that can draw 3D in "software mode" (the computer's main chip pretends to be a graphics chip). It works for screenshots and scripted test players, but it is slow, so **its speed tells us nothing about speed on your Mac**. |
| Can I reach your game folder? | Yes: `BellyButtonAdventure` in your home folder. It was empty. |
| Can I run git (the save-to-GitHub tool) in your folder from here? | Not safely. My connection to your Mac can't delete git's temporary "lock" files, which would jam it. **You'll run the git commands yourself** in Terminal; I'll always give them to you. |

## Recommended approach
**A browser game built with Three.js, as plain files with no "build step."**
A "build step" is a tool that repackages code before it can run. We skip it, so the files in your folder *are* the game.

- **To publish:** you push the folder to GitHub; GitHub Pages turns it into a web link: `https://jillelynx.github.io/BellyButtonAdventure/`
- **To play on your Mac without the internet:** double-click `Play on my Mac.command` in the folder (arrives in Milestone 2). It starts a tiny local web server (a little program that hands the game files to your browser) and opens the game. Browsers won't run this kind of game straight from a double-clicked .html file, so this helper is needed.
- **Trade-off:** this is simpler than using a game engine app (like Unity or Godot), and nothing needs installing on your Mac. The cost is that very fancy graphics, like movie-quality lighting, are out of reach. The cozy diorama look in VISUAL_DIRECTION.md fits well within what this can do.

## Performance on your Mac (M4)
An M4 Mac should easily run this style at a smooth 60 frames per second. **This is an expectation, not a measurement.** Every milestone will include a speed meter (press **F** in the game) so you can check the real number on your Mac.

## Saving progress
Progress saves automatically in the browser. Every save uses the label prefix `bba.` and Exploration and Platformer keep separate save slots, so this game can never mix its saves with any other game you host at the same GitHub address.

## Privacy note
GitHub Pages on a free account requires a **public** repository, so anyone with the link can see the files. **I will not put Liev's photos in the folder.** The characters are built from written descriptions. Please don't add the photos to this folder either.

## Assets and licensing
Everything is made from scratch in code (shapes, textures, sounds) unless noted in `CREDITS.md`. Any outside asset must be free-to-use (for example CC0) and listed there.
