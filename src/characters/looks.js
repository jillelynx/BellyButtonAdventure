// =====================================================================
//  CHARACTER LOOK SETTINGS
//  Every color and option for Belly Button and Liev lives here.
//  Each line is checked against the reference photos — see the
//  checklists in docs/VISUAL_DIRECTION.md. Ask for changes by name,
//  for example "make Liev's hoodie a darker blue".
// =====================================================================

export const BELLY_BUTTON = {
  name: 'Belly Button',
  height: 1.0,               // world meters; chest-high to Liev (approved)
  fabric: '#3A3D45',         // charcoal-grey plush
  dashes: '#D6D6DC',         // short light dash marks all over
  cream: '#F1ECE3',          // muzzle and belly patch
  nose: '#17171B',
  thread: '#17171B',         // stitched smile
  eyeRing: '#F4F4F0',        // embroidered white eye ring
  eyeCenter: '#8C9BB0',      // grey-blue eye center
  eyeOutline: '#55575F',
  earInner: '#D9824A',       // orange-tan inside the ears
  bellyButton: '#B98B67',    // the tiny tan belly button
  bellyButtonGlow: '#FFC46B',
  tag: '#C8473D', showTag: true,
};

export const LIEV = {
  name: 'Liev', age: 11,
  height: 1.45,
  skin: '#F3D2BC', freckles: '#C38A69', blush: '#F0A79E',
  eyes: '#5B3A23',           // brown
  hair: '#3B2A20',           // dark brown
  boltColor: '#9A7356',      // lighter brown lightning bolt (approved)
  boltSide: 'left',          // approved 2026-10-21
  lips: '#A9544F',
  outfits: {
    soccer: { label: 'Soccer #12', shirt: '#D2232A', trim: '#FFFFFF', number: '12', numberColor: '#FFFFFF',
      shorts: '#FFFFFF', socks: '#D2232A', shoes: '#1D1D20', sole: '#1D1D20', sleeves: 'short', legs: 'shorts' },
    army: { label: 'Army camo', camo: ['#6B7A4A', '#3F4B2D', '#8B7B55', '#2A2E22'], belt: '#2A2620', buckle: '#C9C3AE',
      boots: '#A88B5E', sole: '#5A4A35', sleeves: 'long', legs: 'trousers' },
    play: { label: 'Play clothes', jacketCamo: ['#6FA06B', '#9CCB94', '#3F6C45', '#2C4A32'], zipper: '#7A7430',
      collarInside: '#C9DA45', hoodie: '#2347C4', shorts: '#4A3426', socks: '#F4F4F4', shoes: '#1D1D20', sole: '#F0F0F0',
      sleeves: 'long', legs: 'shorts' },
  },
  hairstyles: { everyday: 'Everyday bangs', styled: 'Styled up + bolt' },
  hat: { label: "Captain's hat", camo: ['#A39F8E', '#C2BDA9', '#827E70', '#5F5D54', '#D3CDB8'], bars: '#DDE1E6' },
};

// What the player picks on the character screen (saved automatically).
export const DEFAULT_CHOICE = { player: 'liev', outfit: 'play', hair: 'everyday', hat: false };
