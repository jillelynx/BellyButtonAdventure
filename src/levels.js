// PLATFORMER LEVELS. Each level is a list of blocks (x0..x1 wide, y0..y1 tall).
// Both Liev and Belly Button can always finish every level, using their own moves.
export const LEVELS = {
  'bbw-door1': {
    name: 'Button Hill Hop',
    place: "Belly Button's World",
    start: [0.5, 2],
    deathY: -4,
    blocks: [
      { x0: -4, x1: -2, y0: -6, y1: 12, kind: 'wall' },
      { x0: -2, x1: 18, y0: -6, y1: 2 },
      { x0: 18, x1: 22, y0: -6, y1: 3 },
      { x0: 22, x1: 26, y0: -6, y1: 4 },
      { x0: 29, x1: 40, y0: -6, y1: 4 },
      { x0: 40, x1: 50, y0: -6, y1: 9, chalk: true },   // tall cliff; left face has chalk climbing marks
      { x0: 50, x1: 56, y0: -6, y1: 5 },
      { x0: 63, x1: 82, y0: -6, y1: 5 },
      { x0: 82, x1: 84, y0: -6, y1: 14, kind: 'wall' },
    ],
    cushion: { x0: 35.6, x1: 38.2, y: 4, h: 0.45 },
    target: { x: 64.6, y: 5.75, r: 0.6 },
    bridge: { x0: 56, x1: 63, y0: 4.7, y1: 5 },
    checkpoints: [[0.5, 2], [30, 4], [51.5, 5], [65.5, 5]],
    stamp: [78, 6.4],
    buttons: [[4, 2.7], [6, 3.3], [8, 2.7], [12, 4.2], [20, 4.4], [24, 5.8], [27.5, 6.1], [32, 4.8], [34, 4.8], [45, 9.8], [47, 9.8], [53, 5.8], [59.5, 7.0], [67, 5.8], [70, 5.8], [74, 5.8]],
    signs: [
      { x: 1.8, y: 2, lines: ['Arrows or A / D to move', 'Space to jump'] },
      { x: 33, y: 4, lines: ['LIEV: push into the chalk wall to climb!', 'BELLY BUTTON: jump, press DOWN,', 'and Belly Bounce on the pink cushion!'] },
      { x: 53.3, y: 5, lines: ['LIEV: press X to kick the ball at the target!', 'BELLY BUTTON: jump and HOLD Space to float!'] },
    ],
  },
};
