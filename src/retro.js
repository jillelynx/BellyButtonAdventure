// RETRO PIXEL-ART PLATFORMER — a classic side-scroller drawn in crisp pixels.
// Liev is animated from the sprite sheet in assets/sprites/liev_retro.png
// (cut and aligned by tools/slice_sprites.py; frame list in liev_retro.json).
// Everything else (tiles, trees, mountains, water) is drawn here in code.
import { Input } from './input.js';
import { Records, RunTimer, RestTracker, formatTime } from './progress.js';
import { rng } from './util.js';

export const T = 16;                // one tile = 16 game pixels
const G = 1150, JUMP_V = 385, WALK = 96, RUN = 158, CRAWL = 60, SLIDE_V = 230;
export const STAND_H = 44, LOW_H = 22, HALF_W = 8;

// ---------- Load Liev's sprite sheet once (relative paths work on GitHub Pages) ----------
export const sprite = { img: null, man: null, ready: false, failed: false };
sprite.promise = Promise.all([
  new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/sprites/liev_retro.png'; }),
  fetch('assets/sprites/liev_retro.json').then(r => { if (!r.ok) throw new Error('manifest'); return r.json(); }),
]).then(([img, man]) => { sprite.img = img; sprite.man = man; sprite.ready = true; })
  .catch(() => { sprite.failed = true; });

// ---------- The level, built from simple pieces so it's easy to edit ----------
export const RETRO_LEVELS = {
  'bbw-door2': {
    name: 'Pixel Peaks', place: "Belly Button's World", collectName: 'Stars', width: 162, height: 15,
    build(L) {
      const GR = 11;                                   // ground surface row
      L.ground(0, 31, GR); L.ground(34, 60, GR); L.ground(71, 130, GR); L.ground(134, 162, GR);
      L.water(31, 34); L.water(60, 71); L.water(130, 134);
      L.player(3, GR);
      L.deco('tree', 1, GR); L.deco('fence', 6, GR, 4); L.deco('tree', 13, GR); L.deco('flower', 9, GR); L.deco('flower', 19, GR); L.deco('bush', 25, GR);
      L.stars(9, GR - 2, 4);
      L.plat(16, 8, 4); L.stars(16, 7, 4); L.plat(22, 6, 3); L.stars(22, 5, 3);
      L.qbox(27, 7); L.qbox(28, 7);
      L.rest(37, GR, 'picnic');
      // Fallen log + rocks: too tall to jump, so slide underneath (Shift + run, then ↓).
      L.sign(41, GR, 'slide');
      L.rock(44, 0, 6, 8); L.log(44, 8, 6);            // gap under the log is 2 tiles: too low to walk, fine to slide or crawl
      L.stars(45, GR - 1, 4);
      L.sign(51, GR, 'punch'); L.crate(53, GR - 1); L.crate(55, GR - 1); L.crate(55, GR - 2); L.crate(57, GR - 1);
      L.deco('tree', 58, GR);
      // Waterfall pond with stepping stones.
      L.plat(62, 9, 2); L.plat(66, 8, 2); L.stars(62, 8, 2); L.stars(66, 7, 2);
      // Soccer: kick the ball into the goal to open the gate.
      L.sign(73, GR, 'kick'); L.ball(77, GR); L.goal(85, GR); L.gate(90, 0, GR);
      L.deco('fence', 79, GR, 3); L.deco('flower', 75, GR);
      L.rest(94, GR, 'tent');
      L.plat(103, 9, 3); L.plat(108, 7, 3); L.plat(113, 5, 3); L.stars(103, 8, 3); L.stars(108, 6, 3); L.stars(113, 4, 3);
      L.qbox(119, 7); L.qbox(120, 7); L.qbox(121, 7);
      L.deco('tree', 100, GR); L.deco('bush', 124, GR); L.deco('tree', 127, GR);
      L.stars(131, 7, 3);
      L.deco('flower', 138, GR); L.deco('tree', 141, GR); L.deco('fence', 143, GR, 3);
      L.friend(148, GR); L.stamp(152, GR - 2);
      L.rock(160, 0, 2, GR);
    },
  },
};

// ---------- Small pixel-art drawing helpers ----------
export function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
export const px = (g, x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

function makeTiles() {
  const tiles = {};
  // Dirt with brick-like clumps (like the reference picture).
  const dirt = (seed) => { const [c, g] = cv(T, T); const r = rng(seed); px(g, 0, 0, '#B5651D', T, T);
    for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 12), y = Math.floor(r() * 12); px(g, x, y, '#D9883A', 4, 3); px(g, x, y + 3, '#8A4B16', 4, 1); px(g, x + 4, y, '#8A4B16', 1, 3); }
    for (let i = 0; i < 6; i++) px(g, Math.floor(r() * 16), Math.floor(r() * 16), '#7A3F12'); return c; };
  tiles.dirt = [dirt(1), dirt(2), dirt(3)];
  // Grass top: bright blades on dirt, with a jagged fringe hanging down.
  const grass = (seed) => { const [c, g] = cv(T, T); const r = rng(seed); g.drawImage(tiles.dirt[seed % 3], 0, 0);
    px(g, 0, 0, '#3FA535', T, 6); px(g, 0, 0, '#74D13B', T, 2);
    for (let x = 0; x < T; x++) { const d = 5 + Math.floor(r() * 4); px(g, x, 6, '#3FA535', 1, d - 5); px(g, x, d, '#2B7A2A'); if (r() < 0.3) px(g, x, 1, '#A8E85C'); }
    for (let x = 0; x < T; x += 3) px(g, x + Math.floor(r() * 2), 0, '#2B7A2A'); return c; };
  tiles.grass = [grass(4), grass(5), grass(6)];
  // Rock.
  const rock = (seed) => { const [c, g] = cv(T, T); const r = rng(seed); px(g, 0, 0, '#7D8CA3', T, T);
    for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 10), y = Math.floor(r() * 10); px(g, x, y, '#A9B6C8', 5, 4); px(g, x, y + 4, '#5B677A', 5, 1); px(g, x + 5, y, '#5B677A', 1, 4); }
    px(g, 0, 15, '#5B677A', 16, 1); px(g, 15, 0, '#5B677A', 1, 16); return c; };
  tiles.rock = [rock(7), rock(8)];
  // Log (side view).
  { const [c, g] = cv(T, T); px(g, 0, 0, '#8B5A2B', T, T); px(g, 0, 2, '#A9733C', T, 3); px(g, 0, 11, '#6B4220', T, 3); px(g, 0, 0, '#4A2C14', T, 1); px(g, 0, 15, '#4A2C14', T, 1);
    for (let x = 2; x < T; x += 6) px(g, x, 6, '#6B4220', 3, 1); tiles.log = c; }
  // Question box (bump from below or punch).
  const box = (used) => { const [c, g] = cv(T, T); px(g, 0, 0, '#5A3A10', T, T); px(g, 1, 1, used ? '#9C6B3A' : '#F2B530', 14, 14); px(g, 1, 1, used ? '#B88452' : '#FFD86B', 14, 2);
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(g, x, y, '#5A3A10');
    if (!used) { const q = ['.###.', '#...#', '...#.', '..#..', '.....', '..#..']; q.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') px(g, 5 + x, 4 + y, '#FFFFFF'); })); }
    return c; };
  tiles.qbox = box(false); tiles.qboxUsed = box(true);
  // Crate (punch it open).
  { const [c, g] = cv(T, T); px(g, 0, 0, '#5A3A10', T, T); px(g, 1, 1, '#B07A3E', 14, 14); px(g, 1, 5, '#8C5A2B', 14, 1); px(g, 1, 10, '#8C5A2B', 14, 1);
    for (let i = 0; i < 14; i++) { px(g, 1 + i, 1 + i, '#6B4220'); } tiles.crate = c; }
  // Gate (wooden planks with iron bands).
  { const [c, g] = cv(T, T); px(g, 0, 0, '#9C6B3A', T, T); for (let x = 0; x < T; x += 4) px(g, x, 0, '#6B4220', 1, T); px(g, 0, 3, '#555B66', T, 2); px(g, 0, 11, '#555B66', T, 2); px(g, 7, 3, '#C9CED6', 2, 2); tiles.gate = c; }
  return tiles;
}

function makeDecor() {
  const d = {};
  { const [c, g] = cv(48, 64); // tree
    px(g, 21, 34, '#7A4A22', 7, 30); px(g, 21, 34, '#9C6232', 2, 30);
    const blob = (x, y, r, col) => { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) px(g, x + xx, y + yy, col); };
    blob(24, 22, 15, '#2B7A2A'); blob(14, 28, 10, '#2B7A2A'); blob(34, 28, 10, '#2B7A2A');
    blob(23, 19, 12, '#3FA535'); blob(14, 25, 7, '#3FA535'); blob(33, 25, 7, '#3FA535');
    blob(19, 14, 5, '#74D13B'); blob(29, 18, 3, '#74D13B'); d.tree = c; }
  { const [c, g] = cv(16, 18); px(g, 1, 4, '#7A4A22', 3, 14); px(g, 12, 4, '#7A4A22', 3, 14); px(g, 0, 6, '#9C6232', 16, 3); px(g, 0, 12, '#9C6232', 16, 3); px(g, 1, 3, '#B07A3E', 3, 1); px(g, 12, 3, '#B07A3E', 3, 1); d.fence = c; }
  { const [c, g] = cv(9, 10); px(g, 4, 5, '#2B7A2A', 1, 5); for (const [x, y] of [[4, 1], [2, 3], [6, 3], [3, 5], [5, 5]]) px(g, x - 1, y - 1, '#FFFFFF', 3, 2); px(g, 3, 3, '#F2C230', 3, 2); d.flower = c; }
  { const [c, g] = cv(28, 16); const blob = (x, y, r, col) => { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) px(g, x + xx, y + yy, col); };
    blob(8, 10, 6, '#2B7A2A'); blob(18, 9, 8, '#2B7A2A'); blob(8, 9, 5, '#3FA535'); blob(18, 8, 7, '#3FA535'); blob(16, 5, 2, '#74D13B'); d.bush = c; }
  { const [c, g] = cv(13, 13); // star collectible
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.6 : 6.2; pts.push([6.5 + Math.cos(a) * r, 6.8 + Math.sin(a) * r]); }
    g.fillStyle = '#B5651D'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.fill();
    const [c2, g2] = cv(13, 13); g2.fillStyle = '#FFD34D'; g2.beginPath(); pts.forEach(([x, y], i) => { const xx = 6.5 + (x - 6.5) * 0.78, yy = 6.8 + (y - 6.8) * 0.78; i ? g2.lineTo(xx, yy) : g2.moveTo(xx, yy); }); g2.fill();
    g.drawImage(c2, 0, 0); px(g, 5, 4, '#FFF6C4', 2, 2);
    // hard edges
    const id = g.getImageData(0, 0, 13, 13); for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 100 ? 255 : 0; g.putImageData(id, 0, 0); d.star = c; }
  { const [c, g] = cv(40, 48); // soccer goal (posts + net)
    px(g, 0, 0, '#FFFFFF', 40, 3); px(g, 0, 0, '#FFFFFF', 3, 48); px(g, 37, 0, '#FFFFFF', 3, 48);
    for (let x = 4; x < 37; x += 4) px(g, x, 3, 'rgba(255,255,255,0.45)', 1, 45); for (let y = 6; y < 48; y += 4) px(g, 3, y, 'rgba(255,255,255,0.45)', 34, 1); d.goal = c; }
  { const [c, g] = cv(12, 12); // soccer ball
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const dx = x - 5.5, dy = y - 5.5; if (dx * dx + dy * dy <= 33) px(g, x, y, '#FFFFFF'); if (dx * dx + dy * dy > 26 && dx * dx + dy * dy <= 33) px(g, x, y, '#2A2A35'); }
    for (const [x, y] of [[5, 2], [6, 2], [2, 6], [9, 6], [5, 9], [6, 9], [5, 5], [6, 5], [5, 6], [6, 6]]) px(g, x, y, '#2347C4'); d.ball = c; }
  { const [c, g] = cv(28, 14); // picnic blanket + basket
    for (let y = 8; y < 14; y++) for (let x = 0; x < 28; x++) px(g, x, y, ((x >> 2) + (y >> 1)) % 2 ? '#C8473D' : '#FFF8EC');
    px(g, 4, 2, '#8C5A2B', 9, 7); px(g, 5, 3, '#B07A3E', 7, 5); px(g, 6, 0, '#6B4220', 5, 1); px(g, 5, 1, '#6B4220', 1, 2); px(g, 11, 1, '#6B4220', 1, 2); px(g, 18, 6, '#FFFFFF', 6, 2); d.picnic = c; }
  { const [c, g] = cv(32, 24); // tent
    for (let y = 0; y < 22; y++) { const half = Math.floor(y * 0.72); px(g, 16 - half, y + 2, y % 4 < 2 ? '#F2A7B5' : '#E38FA0', half * 2, 1); }
    for (let y = 8; y < 24; y++) { const half = Math.floor((y - 8) * 0.3); px(g, 16 - half, y, '#5A2F3A', half * 2, 1); } px(g, 15, 0, '#6B4220', 2, 3); d.tent = c; }
  { const [c, g] = cv(24, 16); // treat (cookie)
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const dx = x - 5.5, dy = y - 5.5; if (dx * dx + dy * dy <= 30) px(g, x + 6, y + 2, dx * dx + dy * dy > 22 ? '#9C6232' : '#D9A35B'); }
    for (const [x, y] of [[9, 5], [13, 6], [10, 9], [14, 10], [11, 12]]) px(g, x, y, '#5A3A22', 2, 2); d.cookie = c; }
  { const [c, g] = cv(16, 18); // zzz bubble
    px(g, 2, 2, '#FFF8EC', 12, 12); px(g, 1, 3, '#FFF8EC', 14, 10); px(g, 5, 14, '#FFF8EC', 3, 2); g.fillStyle = '#3A3D45'; g.font = 'bold 9px monospace'; g.fillText('z', 4, 11); g.font = 'bold 7px monospace'; g.fillText('z', 9, 7);
    const id = g.getImageData(0, 0, 16, 18); for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 100 ? 255 : 0; g.putImageData(id, 0, 0); d.zzz = c; }
  { const [c, g] = cv(28, 30); // the Treasure Stamp: a big gold star on a little pedestal
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5 : 12; pts.push([14 + Math.cos(a) * r, 13 + Math.sin(a) * r]); }
    g.fillStyle = '#8A4B16'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.fill();
    g.fillStyle = '#FFD34D'; g.beginPath(); pts.forEach(([x, y], i) => { const xx = 14 + (x - 14) * 0.82, yy = 13 + (y - 13) * 0.82; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }); g.fill();
    px(g, 11, 8, '#FFF6C4', 3, 3);
    const id = g.getImageData(0, 0, 28, 30); for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 100 ? 255 : 0; g.putImageData(id, 0, 0); d.stamp = c; }
  // Signs with pictures, not words (Liev may not read long instructions).
  const sign = (draw) => { const [c, g] = cv(26, 30); px(g, 11, 14, '#7A4A22', 4, 16); px(g, 0, 0, '#5A3A10', 26, 16); px(g, 1, 1, '#E9C98F', 24, 14); draw(g); return c; };
  const key = (g, x, y, ch) => { px(g, x, y, '#3A3D45', 8, 8); g.fillStyle = '#FFFFFF'; g.font = 'bold 7px monospace'; g.fillText(ch, x + 2, y + 7); };
  d.sign_slide = sign((g) => { key(g, 3, 4, '↓'); px(g, 13, 10, '#3A3D45', 9, 2); px(g, 19, 7, '#3A3D45', 3, 3); px(g, 13, 4, '#7A4A22', 10, 3); });
  d.sign_punch = sign((g) => { key(g, 3, 4, 'Z'); px(g, 13, 7, '#F3C9A6', 4, 3); px(g, 17, 5, '#B07A3E', 6, 7); px(g, 17, 5, '#5A3A10', 6, 1); });
  d.sign_kick = sign((g) => { key(g, 3, 4, 'X'); g.drawImage(d.ball, 13, 3, 9, 9); px(g, 22, 2, '#FFFFFF', 2, 11); });
  return d;
}

// Belly Button as a little pixel friend (cheers at the finish).
function makeBB() {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const [c, g] = cv(24, 36); const squash = f ? 1 : 0;
    const top = 2 + squash, h = 34 - squash;
    for (let y = top; y < top + h - 3; y++) { const t = (y - top) / (h - 3); const half = Math.round(8 + 2.2 * Math.sin(Math.min(1, t * 1.25) * Math.PI / 2) - (t < 0.12 ? (0.12 - t) * 22 : 0)); px(g, 12 - half, y, '#3A3D45', half * 2, 1); }
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { const x = 5 + Math.floor(r() * 14), y = top + 3 + Math.floor(r() * (h - 8)); px(g, x, y, '#D6D6DC', 1, 2); }
    for (const sx of [5, 16]) { px(g, sx, top - 1, '#3A3D45', 4, 4); px(g, sx + 1, top, '#D9824A', 2, 2); }       // ears
    px(g, 8, top + 7, '#F1ECE3', 8, 6); px(g, 11, top + 7, '#17171B', 2, 2); px(g, 10, top + 11, '#17171B', 4, 1);   // muzzle, nose, smile
    px(g, 6, top + 5, '#F4F4F0', 2, 2); px(g, 16, top + 5, '#F4F4F0', 2, 2);                                       // eyes
    px(g, 7, top + 15, '#F1ECE3', 10, 12); px(g, 6, top + 17, '#F1ECE3', 12, 8); px(g, 11, top + 24, '#B98B67', 2, 1); // belly + belly button
    const arm = f ? -3 : 0; px(g, 2, top + 14 + arm, '#3A3D45', 3, 5); px(g, 19, top + 14 + arm, '#3A3D45', 3, 5);    // arms (wave)
    px(g, 6, 33, '#3A3D45', 5, 3); px(g, 13, 33, '#3A3D45', 5, 3);                                                  // feet
    frames.push(c);
  }
  return frames;
}

// Parallax background layers (wide strips that repeat).
function makeBackground() {
  const W = 512, H = 270, layers = {};
  { const [c, g] = cv(4, H); const bands = ['#3B7FE0', '#4A8BE8', '#5A98EE', '#6CA6F2', '#80B4F5', '#96C3F7', '#ADD2F9']; bands.forEach((col, i) => px(g, 0, i * 24, col, 4, 24)); px(g, 0, bands.length * 24, '#C4E0FB', 4, H); layers.sky = c; }
  { const [c, g] = cv(W, 120); const r = rng(11); // clouds
    for (let k = 0; k < 6; k++) { const x = Math.floor(r() * (W - 60)), y = 10 + Math.floor(r() * 60), w = 28 + Math.floor(r() * 30);
      for (let i = 0; i < 4; i++) { const bx = x + i * (w / 4), by = y - Math.floor(r() * 6), bw = 14 + Math.floor(r() * 10); px(g, bx, by, '#FFFFFF', bw, 9); px(g, bx + 2, by - 3, '#FFFFFF', bw - 4, 3); }
      px(g, x, y + 8, '#D6E6F7', w + 10, 2); } layers.clouds = c; }
  const ridge = (seed, base, amp, col, snow, shade) => { const [c, g] = cv(W, H); const r = rng(seed); let pts = [];
    for (let x = 0; x <= W; x += 32) pts.push([x, base - amp * (0.4 + r() * 0.6)]); pts[pts.length - 1][1] = pts[0][1];
    for (let x = 0; x < W; x++) { const i = Math.floor(x / 32), t = (x % 32) / 32; const y = Math.round(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t);
      px(g, x, y, col, 1, H - y); if (shade && (x % 32) > 16) px(g, x, y, shade, 1, H - y);
      if (snow && y < base - amp * 0.62) px(g, x, y, snow, 1, Math.max(2, Math.round((base - amp * 0.62 - y) * 0.9))); }
    return c; };
  layers.far = ridge(21, 190, 120, '#6C7FD1', '#E8EEF8', '#5E70C2');
  layers.mid = ridge(22, 205, 80, '#4E62B0', '#C9D5EE', '#45579E');
  { const [c, g] = cv(W, H); const r = rng(23); // forest line
    px(g, 0, 214, '#2F6B3A', W, H - 214);
    for (let x = 0; x < W; x += 6) { const h = 14 + Math.floor(r() * 18); for (let y = 0; y < h; y++) { const half = Math.floor(y * 0.28); px(g, x + 3 - half, 214 - h + y, y % 5 === 0 ? '#3F8A45' : '#2F6B3A', half * 2 + 1, 1); } }
    layers.forest = c; }
  return layers;
}

export class Retro {
  constructor(game) {
    this.g = game; this.is2d = true;
    this.canvas = document.createElement('canvas'); this.canvas.id = 'pixel';
    this.canvas.style.cssText = 'position:fixed;left:0;top:0;image-rendering:pixelated;display:none;';
    document.body.insertBefore(this.canvas, document.getElementById('ui'));
    this.ctx = this.canvas.getContext('2d');
    this.tiles = makeTiles(); this.decor = makeDecor(); this.bb = makeBB(); this.bg = makeBackground();
    this.camera = { aspect: 1, updateProjectionMatrix() {} }; // the main loop expects one
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const W = innerWidth, H = innerHeight;
    this.scale = Math.max(2, Math.round(H / 240));                 // whole-number scaling keeps pixels crisp
    this.vw = Math.ceil(W / this.scale); this.vh = Math.ceil(H / this.scale);
    this.canvas.width = this.vw; this.canvas.height = this.vh;
    this.canvas.style.width = this.vw * this.scale + 'px'; this.canvas.style.height = this.vh * this.scale + 'px';
    this.ctx.imageSmoothingEnabled = false;
  }

  enter(opts) {
    this.levelId = opts.level; this.def = RETRO_LEVELS[opts.level]; this.returnTo = opts.returnTo;
    this.resize(); this.canvas.style.display = 'block';
    this.buildLevel();
    const s = this.start;
    this.p = { x: s.x, y: s.y, vx: 0, vy: 0, face: 1, onGround: true, coyote: 0, buffer: 0, h: STAND_H, ducking: false, sliding: 0, action: null, actT: 0, landT: 0, airT: 0, jumpT: 0 };
    this.checkpoint = { x: s.x, y: s.y }; this.time = 0; this.done = false; this.collected = new Set();
    this.timer = new RunTimer(!!this.g.settings.timer); this.rests = new RestTracker(); this.resting = null; this.restHold = 0;
    this.fx = []; this.camX = Math.max(0, s.x - this.vw * 0.35); this.anim = { name: 'idle', t: 0 };
    if (opts.checkpoint) { const r = this.restSpots[opts.checkpoint - 1]; if (r) { this.p.x = r.x; this.p.y = r.y; this.checkpoint = { x: r.x, y: r.y }; } }
    this.g.audio.music('platformer'); this.g.audio.ambience('outdoor');
    if (this.g.choice.player !== 'liev') this.g.ui.toast(this.notLievText || 'In pixel levels, Liev leads the way. Belly Button waits at the finish to cheer!', 4);
    if (sprite.failed) this.g.ui.toast("Oops, Liev's pixel picture didn't load. Try reloading the page.", 6);
    this.updateHud();
  }
  exit() { this.canvas.style.display = 'none'; this.g.ui.timer(null); this.g.ui.prompt(null); }

  buildLevel() {
    const d = this.def, W = d.width, H = d.height;
    this.W = W; this.H = H;
    const grid = this.grid = Array.from({ length: H }, () => new Array(W).fill(null));
    const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = v; };
    this.stars = []; this.decos = []; this.waters = []; this.qboxes = []; this.crates = []; this.restSpots = []; this.signs = [];
    this.gateCells = []; this.ballStart = null; this.goalRect = null; this.friend = null; this.stampPos = null; this.gateOpen = false;
    const L = {
      ground: (x0, x1, row) => { for (let x = x0; x < x1; x++) for (let y = row; y < H; y++) set(x, y, y === row ? 'grass' : 'dirt'); },
      plat: (x, row, len) => { for (let i = 0; i < len; i++) { set(x + i, row, 'grass'); } },
      water: (x0, x1) => this.waters.push([x0, x1]),
      rock: (x, row, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, row + j, 'rock'); },
      log: (x, row, len) => { for (let i = 0; i < len; i++) set(x + i, row, 'log'); },
      stars: (x, row, n) => { for (let i = 0; i < n; i++) this.stars.push({ x: (x + i) * T + 8, y: row * T + 8 }); },
      qbox: (x, row) => { set(x, row, 'qbox'); this.qboxes.push({ x, row, used: false, bump: 0 }); },
      crate: (x, row) => { set(x, row, 'crate'); this.crates.push({ x, row }); },
      deco: (kind, x, row, n = 1) => { for (let i = 0; i < n; i++) this.decos.push({ kind, x: (x + i) * T, y: row * T }); },
      sign: (x, row, kind) => this.signs.push({ kind, x: x * T, y: row * T }),
      rest: (x, row, kind) => this.restSpots.push({ x: x * T + 8, y: row * T, kind }),
      ball: (x, row) => { this.ballStart = { x: x * T + 8, y: row * T - 6 }; },
      goal: (x, row) => { this.goalRect = { x0: x * T, x1: x * T + 40, y0: row * T - 48, y1: row * T }; },
      gate: (x, row0, row1) => { for (let y = row0; y < row1; y++) { set(x, y, 'gate'); this.gateCells.push([x, y]); } },
      friend: (x, row) => { this.friend = { x: x * T + 8, y: row * T }; },
      stamp: (x, row) => { this.stampPos = { x: x * T + 8, y: row * T }; },
      player: (x, row) => { this.start = { x: x * T + 8, y: row * T }; },
    };
    d.build(L);
    this.ball = this.ballStart ? { x: this.ballStart.x, y: this.ballStart.y, vx: 0, vy: 0, spin: 0 } : null;
    this.gateY = 0; this.totalStars = this.stars.length + this.qboxes.length + this.crates.length;
  }

  // ---------- Collision ----------
  solidAt(px_, py_) {
    const tx = Math.floor(px_ / T), ty = Math.floor(py_ / T);
    if (tx < 0 || tx >= this.W) return true;            // world edges are walls
    if (ty < 0 || ty >= this.H) return false;
    const v = this.grid[ty][tx];
    if (!v) return false;
    if (v === 'gate') return !this.gateOpen;
    return true;
  }
  boxHits(x, y, h) { // is the player's box (feet at y) inside anything solid?
    const x0 = x - HALF_W + 0.01, x1 = x + HALF_W - 0.01, y0 = y - h + 0.01, y1 = y - 0.01;
    for (let yy = Math.floor(y0 / T); yy <= Math.floor(y1 / T); yy++) for (let xx = Math.floor(x0 / T); xx <= Math.floor(x1 / T); xx++) if (this.solidAt(xx * T + 1, yy * T + 1)) return { tx: xx, ty: yy };
    return null;
  }
  moveX(p, dx) {
    const steps = Math.ceil(Math.abs(dx) / 4) || 1;
    for (let i = 0; i < steps; i++) {
      const nx = p.x + dx / steps;
      if (this.boxHits(nx, p.y, p.h)) { p.vx = 0; return true; }
      p.x = nx;
    }
    return false;
  }
  moveY(p, dy) {
    const steps = Math.ceil(Math.abs(dy) / 4) || 1;
    for (let i = 0; i < steps; i++) {
      const ny = p.y + dy / steps; const hit = this.boxHits(p.x, ny, p.h);
      if (hit) {
        if (dy > 0) { p.y = hit.ty * T; p.vy = 0; return 'floor'; }
        p.y = (hit.ty + 1) * T + p.h; p.vy = 0; this.bumpFromBelow(hit.tx, hit.ty); return 'ceiling';
      }
      p.y = ny;
    }
    return null;
  }
  canStand(p) { return !this.boxHits(p.x, p.y, STAND_H); }

  // ---------- Things you can hit ----------
  popStar(x, y) { this.fx.push({ kind: 'popstar', x, y, t: 0 }); this.addStar(); }
  addStar() { this.collected.add('extra' + this.collected.size); this.g.audio.sfx('collect'); this.updateHud(); }
  bumpFromBelow(tx, ty) {
    const q = this.qboxes.find(b => b.x === tx && b.row === ty);
    if (q && !q.used) { q.used = true; q.bump = 1; this.grid[ty][tx] = 'qboxUsed'; this.popStar(tx * T + 8, ty * T - 6); }
    else this.g.audio.sfx('bonk');
  }
  hitAt(x0, y0, x1, y1, kind) { // punch hits boxes/crates in this area
    for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++) for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) {
      const v = this.grid[ty] && this.grid[ty][tx];
      if (v === 'crate') { this.grid[ty][tx] = null; this.fx.push({ kind: 'splinter', x: tx * T + 8, y: ty * T + 8, t: 0 }); this.popStar(tx * T + 8, ty * T); this.g.audio.sfx('kick'); return true; }
      if (v === 'qbox') { this.bumpFromBelow(tx, ty); return true; }
    }
    return false;
  }

  // ---------- Update ----------
  update(dt) {
    this.time += dt;
    const paused = this.g.paused || this.done;
    if (!paused) {
      const n = Math.max(1, Math.ceil(dt / (1 / 120))), sdt = dt / n;   // fixed small steps: same feel at any frame rate
      for (let i = 0; i < n; i++) this.step(sdt, i === 0);
    }
    this.updateAnim(paused ? 0 : dt);
    const p = this.p;
    const target = Math.max(0, Math.min(this.W * T - this.vw, p.x - this.vw * 0.38 + p.face * 24));
    this.camX += (target - this.camX) * Math.min(1, dt * 5);
    if (!this.g.simulating) this.draw();
    this.g.ui.update(this.g.paused ? 0 : dt);
    if (this.timer.started && Math.floor(this.time * 10) !== this._tt) { this._tt = Math.floor(this.time * 10); this.showTimer(); }
  }

  step(dt, first) {
    const p = this.p, a = this.g.audio;
    if (this.resting) { this.updateRest(dt); this.timer.tick(dt); return; }
    const ax = Input.axis(), down = Input.key('ArrowDown', 'KeyS');
    if (first && (ax.x || ax.y || Input.hit('Space', 'KeyX', 'KeyK', 'KeyZ', 'KeyJ'))) this.timer.start();
    this.timer.tick(dt);
    if (this.combat && this.preStep(dt, first, ax, down)) return;   // combat levels add their own controls
    // Actions (kick / punch) play once; you can still move a little.
    if (!this.combat && first && !p.action && p.onGround && !p.sliding) {
      if (Input.hit('KeyX', 'KeyK')) { p.action = 'kick'; p.actT = 0; p.hitDone = false; }
      else if (Input.hit('KeyZ', 'KeyJ')) { p.action = 'punch'; p.actT = 0; p.hitDone = false; }
    }
    const running = Input.key('ShiftLeft', 'ShiftRight');
    // Slide: press ↓ while running fast.
    if (first && down && Input.hit('ArrowDown', 'KeyS') && p.onGround && Math.abs(p.vx) > 120 && !p.sliding) { p.sliding = 0.65; p.h = LOW_H; p.vx = Math.sign(p.vx) * SLIDE_V; a.sfx('squish'); }
    if (p.sliding) {
      p.sliding -= dt; p.vx *= Math.exp(-0.9 * dt);
      if (p.sliding <= 0) { p.sliding = 0; if (this.canStand(p)) p.h = STAND_H; else { p.ducking = true; p.autoCrawl = p.face; } } // still under the log: keep scooting out
    } else {
      p.ducking = p.onGround && (down || !this.canStand({ x: p.x, y: p.y }));
      p.h = p.ducking ? LOW_H : STAND_H;
      let max = p.ducking ? CRAWL : running ? RUN : WALK;
      if (p.action) max *= 0.25;
      if (this.canStand(p)) p.autoCrawl = 0;
      const want = (ax.x || (p.ducking ? p.autoCrawl || 0 : 0)) * max * (!ax.x && p.autoCrawl ? 1.6 : 1);
      const accel = p.onGround ? 14 : 7;
      p.vx += (want - p.vx) * Math.min(1, accel * dt);
      if (ax.x) p.face = ax.x > 0 ? 1 : -1;
    }
    // Jump with forgiving timing (a moment after leaving a ledge, and a slightly early press still counts).
    if (first) p.buffer = Input.hit('Space', 'ArrowUp', 'KeyW') ? 0.13 : p.buffer;
    p.buffer -= dt; p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    if (p.buffer > 0 && p.coyote > 0 && !p.ducking && !p.sliding && this.canStand(p)) { p.vy = -JUMP_V; p.onGround = false; p.buffer = 0; p.coyote = 0; p.jumpT = 0.09; a.sfx('jump'); p.action = null; }
    if (!Input.key('Space', 'ArrowUp', 'KeyW') && p.vy < 0) p.vy += G * 1.2 * dt;  // short hop if released early
    p.vy = Math.min(p.vy + G * dt, 520);
    this.moveX(p, p.vx * dt);
    const wasGround = p.onGround, vyBefore = p.vy;
    const res = this.moveY(p, p.vy * dt);
    p.onGround = res === 'floor' || (p.vy >= 0 && !!this.boxHits(p.x, p.y + 1, p.h));
    if (p.onGround && !wasGround && vyBefore > 60) { p.landT = 0.1; a.sfx('land'); }
    p.airT = p.onGround ? 0 : p.airT + dt;
    // Kick / punch contact moments.
    if (p.action && (p.action === 'kick' || p.action === 'punch')) {
      p.actT += dt; const man = sprite.man && sprite.man.animations[p.action]; const fps = man ? man.fps : 14;
      const frame = Math.floor(p.actT * fps);
      if (!p.hitDone && frame >= 3) {
        p.hitDone = true;
        if (p.action === 'kick') this.tryKick(); else { const x0 = p.x + p.face * 6, x1 = p.x + p.face * 22; if (this.hitAt(Math.min(x0, x1), p.y - 34, Math.max(x0, x1), p.y - 4)) a.sfx('kick'); else a.sfx('jump'); }
      }
      if (frame >= 8) p.action = null;
    }
    if (first && Input.hit('KeyH')) this.g.ui.toast(this.hintText || 'Hold Shift to run, press ↓ to slide under logs, X to kick the ball into the goal, Z to punch crates!', 5);
    if (this.combat) this.combatStep(dt, first, ax, down);
    this.updateBall(dt);
    this.checkThings(dt, ax);
    // Fell in the water or off the world: back to the last rest spot (no lives lost).
    if (p.y > this.H * T + 30 || this.inWater(p.x, p.y - 4)) this.respawn();
  }
  inWater(x, y) { const tx = x / T; return y > 11 * T + 6 && this.waters.some(([a, b]) => tx > a && tx < b); }
  respawn() {
    const p = this.p; this.fx.push({ kind: 'splash', x: p.x, y: 11 * T + 4, t: 0 }); this.g.audio.sfx('poof');
    p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.vx = 0; p.vy = 0; p.sliding = 0; p.action = null; p.h = STAND_H;
    this.g.ui.toast('Splash! Back to the last rest spot.', 2);
  }
  tryKick() {
    const p = this.p, b = this.ball;
    if (Math.abs(b.y - (p.y - 6)) < 18 && (b.x - p.x) * p.face > -4 && (b.x - p.x) * p.face < 26) {
      b.vx = p.face * 330; b.vy = -170; this.g.audio.sfx('kick');
    } else this.g.audio.sfx('jump');
  }
  updateBall(dt) {
    const b = this.ball, p = this.p; if (!b) return;
    b.vy += G * 0.8 * dt;
    const R = 6;
    // walking into the ball nudges it
    if (Math.abs(b.y - (p.y - 6)) < 14 && Math.abs(b.x - p.x) < HALF_W + R) { b.vx = Math.sign(b.x - p.x || p.face) * Math.max(Math.abs(b.vx), Math.abs(p.vx) + 30); }
    let nx = b.x + b.vx * dt;
    if (this.solidAt(nx + Math.sign(b.vx) * R, b.y)) { b.vx *= -0.45; nx = b.x; }
    b.x = nx;
    let ny = b.y + b.vy * dt;
    if (b.vy > 0 && this.solidAt(b.x, ny + R)) { ny = Math.floor((ny + R) / T) * T - R; b.vy = Math.abs(b.vy) > 80 ? -b.vy * 0.45 : 0; b.vx *= 0.96; }
    if (b.vy < 0 && this.solidAt(b.x, ny - R)) { b.vy = 0; }
    b.y = ny; b.vx *= Math.exp(-0.6 * dt); b.spin += b.vx * dt / R;
    const gr = this.goalRect;
    if (!this.gateOpen && b.x > gr.x0 + 4 && b.x < gr.x1 - 2 && b.y > gr.y0 + 4) { this.gateOpen = true; this.g.audio.sfx('hit'); this.g.ui.toast('⚽ <b>GOAL!</b> The gate is opening!', 2.5); this.fx.push({ kind: 'confetti', x: (gr.x0 + gr.x1) / 2, y: gr.y0, t: 0 }); }
    if (b.y > this.H * T + 20 || this.inWater(b.x, b.y)) { b.x = this.ballStart.x; b.y = this.ballStart.y; b.vx = b.vy = 0; }
  }
  checkThings(dt, ax) {
    const p = this.p;
    // Stars.
    for (let i = 0; i < this.stars.length; i++) {
      if (this.collected.has(i)) continue; const s = this.stars[i];
      if (Math.abs(s.x - p.x) < HALF_W + 6 && s.y > p.y - p.h - 6 && s.y < p.y + 4) { this.collected.add(i); this.fx.push({ kind: 'sparkle', x: s.x, y: s.y, t: 0 }); this.g.audio.sfx('collect'); this.updateHud(); }
    }
    // Rest spots: passing one saves your place; standing still on it gives a rest + a treat (once).
    this.restSpots.forEach((r, i) => {
      if (Math.abs(p.x - r.x) < 14 && Math.abs(p.y - r.y) < 2) {
        if (this.checkpoint.x !== r.x) { this.checkpoint = { x: r.x, y: r.y }; this.g.audio.sfx('found'); }
        if (this.rests.canRest(i) && p.onGround && !ax.x && Math.abs(p.vx) < 10 && !p.action) { this.restHold += dt; if (this.restHold > 0.6) { this.resting = { i, t: 0, given: false }; this.restHold = 0; } }
        else this.restHold = 0;
      }
    });
    // Treasure Stamp.
    if (this.stampPos && Math.abs(this.stampPos.x - p.x) < 16 && Math.abs(this.stampPos.y - 6 - (p.y - 20)) < 30) this.complete();
  }
  updateRest(dt) {
    const r = this.resting, spot = this.restSpots[r.i]; r.t += dt; this.p.vx = 0;
    if (r.t > 1.0 && !r.given) { r.given = true; if (this.rests.rest(r.i)) { this.fx.push({ kind: 'cookie', x: spot.x, y: spot.y - 30, t: 0 }); this.g.audio.sfx('collect'); this.g.ui.toast('🍪 Yum, a cookie!', 1.8); this.updateHud(); } }
    if (r.t > 1.6) this.resting = null;
  }

  // ---------- Animation (driven by what Liev is actually doing) ----------
  updateAnim(dt) {
    const p = this.p, A = this.anim; A.t += dt;
    p.landT = Math.max(0, p.landT - dt); p.jumpT = Math.max(0, p.jumpT - dt);
    let name, col;
    if (this.resting) { name = 'rest'; col = [2, 1]; }
    else if (this.done) { name = 'jumpcheer'; col = [6, Math.floor(A.t * 8) % 2 ? 4 : 3]; }
    else if (p.action === 'fire') { name = 'fire'; col = [4, p.actT < 0.06 ? 3 : 4]; }
    else if (p.action === 'throw') { name = 'throw'; col = [4, Math.min(7, 2 + Math.floor(p.actT * 16))]; }
    else if (p.action) { const fr = Math.min(7, Math.floor(p.actT * (p.action === 'kick' ? 14 : 16))); name = p.action; col = [p.action === 'kick' ? 3 : 4, fr]; }
    else if (p.sliding) { const t = 0.65 - p.sliding; const f = t < 0.08 ? 2 : 3 + Math.floor(t * 10) % 3; name = 'slide'; col = [2, f]; }
    else if (p.ducking) { name = 'duck'; col = [2, 1]; }
    else if (!p.onGround) {
      name = 'air';
      if (p.jumpT > 0) col = [6, 1];
      else if (p.vy < -120) col = [6, p.vy < -260 ? 2 : 3];
      else if (p.vy < 80) col = [6, 4];
      else col = [6, 5];
    }
    else if (p.landT > 0) { name = 'land'; col = [6, p.landT > 0.05 ? 6 : 7]; }
    else if (Math.abs(p.vx) > 125) { name = 'run'; col = [5, Math.floor(A.t * 14 * (Math.abs(p.vx) / RUN)) % 8]; }
    else if (Math.abs(p.vx) > 8) { name = 'walk'; col = [1, Math.floor(A.t * 10 * Math.max(0.6, Math.abs(p.vx) / WALK)) % 8]; }
    else { name = 'idle'; col = [0, Math.floor(A.t * 6) % 8]; }
    if (name !== A.name) { A.name = name; if (!['run', 'walk', 'idle'].includes(name) || !['run', 'walk', 'idle'].includes(A.prev)) A.t = 0; }
    A.prev = name; A.row = col[0]; A.col = col[1];
  }

  // ---------- Drawing ----------
  draw() {
    const g = this.ctx, vw = this.vw, vh = this.vh, cx = Math.round(this.camX);
    const levelH = this.H * T, cy = levelH - vh;                    // camera shows the bottom of the level
    const bg = this.bg;
    g.drawImage(bg.sky, 0, 0, vw, vh);
    const layer = (img, f, yOff) => { const w = img.width; let x = -Math.round(cx * f) % w; if (x > 0) x -= w; for (; x < vw; x += w) g.drawImage(img, x, yOff); };
    const groundY = 11 * T - cy;                                      // where the ground is on screen
    layer(bg.clouds, 0.08, 4); layer(bg.far, 0.15, groundY - 196); layer(bg.mid, 0.3, groundY - 200);
    layer(bg.forest, 0.5, groundY - 212);
    g.save(); g.translate(-cx, -cy);
    // Waterfall pouring from a rocky ledge into the pond.
    { const wx = 64 * T + 4, top = 3 * T, bot = 11 * T + 8;
      g.drawImage(this.tiles.rock[0], wx - 6, top - 12); g.drawImage(this.tiles.rock[1], wx + 10, top - 12); g.drawImage(this.tiles.rock[0], wx + 26, top - 14);
      g.fillStyle = '#7CC4F2'; g.fillRect(wx, top + 2, 24, bot - top);
      g.fillStyle = '#A9DCFA'; g.fillRect(wx + 3, top + 2, 4, bot - top); g.fillRect(wx + 15, top + 2, 3, bot - top);
      for (let k = 0; k < 10; k++) { const y = top + ((this.time * 90 + k * 23) % (bot - top)); g.fillStyle = '#E8F6FF'; g.fillRect(wx + 2 + (k % 4) * 5, Math.round(y), 2, 7); }
      for (let k = 0; k < 6; k++) { g.fillStyle = '#FFFFFF'; g.fillRect(wx - 4 + k * 6, bot - 4 - Math.round(Math.abs(Math.sin(this.time * 6 + k)) * 4), 3, 3); } }
    // Water (animated).
    for (const [a, b] of this.waters) { const x0 = a * T, x1 = b * T, y0 = 11 * T + 6; g.fillStyle = '#2E86DE'; g.fillRect(x0, y0, x1 - x0, levelH - y0); g.fillStyle = '#5DADF0'; g.fillRect(x0, y0, x1 - x0, 2);
      for (let x = x0; x < x1; x += 8) { const o = Math.floor((this.time * 8 + x / 8) % 8); g.fillStyle = '#A9D8FA'; g.fillRect(x + o, y0 + 5 + (x / 8 % 2) * 4, 3, 1); } }
    // Decorations behind.
    for (const dd of this.decos) { const img = this.decor[dd.kind]; if (dd.x + img.width < cx || dd.x > cx + vw) continue; g.drawImage(img, dd.x + (16 - img.width) / 2 | 0, dd.y - img.height); }
    for (const s of this.signs) g.drawImage(this.decor['sign_' + s.kind], s.x - 5, s.y - 30);
    for (const r of this.restSpots) { const img = this.decor[r.kind === 'tent' ? 'tent' : 'picnic']; g.drawImage(img, r.x - img.width / 2 | 0, r.y - img.height); if (this.rests.canRest(this.restSpots.indexOf(r))) g.drawImage(this.decor.zzz, r.x - 8, r.y - img.height - 20 + Math.round(Math.sin(this.time * 3) * 2)); }
    // Goal.
    if (this.goalRect) g.drawImage(this.decor.goal, this.goalRect.x0, this.goalRect.y0);
    // Tiles.
    const t0 = Math.max(0, Math.floor(cx / T)), t1 = Math.min(this.W, Math.ceil((cx + vw) / T) + 1);
    for (let y = 0; y < this.H; y++) for (let x = t0; x < t1; x++) {
      const v = this.grid[y][x]; if (!v) continue;
      let img;
      if (v === 'grass') img = this.tiles.grass[(x * 3 + y) % 3];
      else if (v === 'dirt') img = this.tiles.dirt[(x * 7 + y * 3) % 3];
      else if (v === 'rock') img = this.tiles.rock[(x + y) % 2];
      else if (v === 'gate') { if (this.gateOpen) continue; img = this.tiles.gate; }
      else img = this.tiles[v];
      let oy = 0; const q = v.startsWith('qbox') && this.qboxes.find(b => b.x === x && b.row === y); if (q && q.bump > 0) { oy = -Math.round(q.bump * 4); q.bump = Math.max(0, q.bump - 0.08); }
      g.drawImage(img, x * T, y * T + oy);
    }
    // Opening gate slides up.
    if (this.gateOpen && this.gateY < this.gateCells.length * T) { this.gateY += 3; for (const [x, y] of this.gateCells) { const yy = y * T - this.gateY; if (yy + T > 0) g.drawImage(this.tiles.gate, x * T, yy); } }
    // Stars.
    for (let i = 0; i < this.stars.length; i++) { if (this.collected.has(i)) continue; const s = this.stars[i]; g.drawImage(this.decor.star, s.x - 6, s.y - 6 + Math.round(Math.sin(this.time * 4 + i) * 1.5)); }
    // Treasure Stamp + Belly Button.
    if (this.stampPos && !this.done) g.drawImage(this.decor.stamp, this.stampPos.x - 14, this.stampPos.y - 28 + Math.round(Math.sin(this.time * 3) * 2));
    if (this.friend) { const near = Math.abs(this.p.x - this.friend.x) < 120 || this.done; const f = near ? Math.floor(this.time * 6) % 2 : 0; g.drawImage(this.bb[f], this.friend.x - 12, this.friend.y - 36 - (near && f ? 2 : 0)); }
    // Ball.
    { const b = this.ball; g.save(); g.translate(Math.round(b.x), Math.round(b.y)); g.rotate(Math.round(b.spin * 4) / 4); g.drawImage(this.decor.ball, -6, -6); g.restore(); }
    // Liev.
    this.drawLiev(g);
    // Effects.
    this.fx = this.fx.filter(f => { f.t += 1 / 60; return this.drawFx(g, f); });
    g.restore();
  }
  drawLiev(g) {
    const p = this.p, A = this.anim;
    if (!sprite.ready) { g.fillStyle = '#2347C4'; g.fillRect(Math.round(p.x) - HALF_W, Math.round(p.y) - p.h, HALF_W * 2, p.h); return; }
    const [cw, ch] = sprite.man.cell, [ox, oy] = sprite.man.origin;
    const x = Math.round(p.x), y = Math.round(p.y);
    g.save(); g.translate(x, y); if (p.face < 0) g.scale(-1, 1);
    g.drawImage(sprite.img, A.col * cw, A.row * ch, cw, ch, -ox, -oy, cw, ch);
    g.restore();
    if (this.resting) g.drawImage(this.decor.zzz, x + 4, y - 64 + Math.round(Math.sin(this.time * 4) * 2));
  }
  drawFx(g, f) {
    if (f.kind === 'sparkle') { const r = 3 + f.t * 30; g.fillStyle = '#FFF6C4'; for (let i = 0; i < 6; i++) { const a = i * 1.05; g.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r), 2, 2); } return f.t < 0.3; }
    if (f.kind === 'popstar') { g.drawImage(this.decor.star, f.x - 6, Math.round(f.y - 6 - f.t * 60)); return f.t < 0.4; }
    if (f.kind === 'cookie') { g.drawImage(this.decor.cookie, f.x - 12, Math.round(f.y - f.t * 30)); return f.t < 0.8; }
    if (f.kind === 'splinter') { g.fillStyle = '#B07A3E'; for (let i = 0; i < 6; i++) g.fillRect(Math.round(f.x + (i - 3) * f.t * 60), Math.round(f.y - f.t * 40 + f.t * f.t * 200 + i), 3, 2); return f.t < 0.5; }
    if (f.kind === 'splash') { g.fillStyle = '#A9D8FA'; for (let i = 0; i < 8; i++) g.fillRect(Math.round(f.x + (i - 4) * 4), Math.round(f.y - Math.sin(f.t * 8) * (6 + i % 3 * 3)), 2, 3); return f.t < 0.5; }
    if (f.kind === 'confetti') { const cols = ['#F2A7B5', '#FFD34D', '#7FB3E0', '#9BE0B5']; for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 4]; g.fillRect(Math.round(f.x + Math.cos(i) * f.t * 70), Math.round(f.y - Math.sin(i * 1.7) * 30 + f.t * f.t * 120), 2, 2); } return f.t < 1.2; }
    return false;
  }

  // ---------- HUD, timer, finishing ----------
  updateHud() {
    const nr = this.restSpots ? this.restSpots.length : 0;
    this.g.ui.hud(true, `${this.def.name} &nbsp;·&nbsp; ⭐ ${this.collected.size} / ${this.totalStars} &nbsp;·&nbsp; 🍪 ${this.rests ? this.rests.treats : 0} / ${nr}`,
      `<span class="key">← →</span> move · <span class="key">Shift</span> run · <span class="key">Space</span> jump · <span class="key">↓</span> duck / slide · <span class="key">X</span> kick · <span class="key">Z</span> punch`);
    if (this.timer) { this.timer.enabled = !!this.g.settings.timer; this.showTimer(); }
  }
  showTimer() {
    if (!this.timer.enabled) { this.g.ui.timer(null); return; }
    const best = Records.bestTime(this.levelId);
    this.g.ui.timer(`⏱ ${formatTime(this.timer.t)}${best != null ? ` &nbsp;<small>best ${formatTime(best)}</small>` : ''}`);
  }
  complete() {
    if (this.done) return;
    this.done = true; this.anim.t = 0;
    const ps = this.g.saves.platformer, prev = ps.levels[this.levelId] || {};
    ps.levels[this.levelId] = { done: true, buttons: Math.max(prev.buttons || 0, this.collected.size), total: this.totalStars, treats: Math.max(prev.treats || 0, this.rests.treats) };
    if (!ps.stamps.includes(this.levelId)) ps.stamps.push(this.levelId);
    this.g.writeSave('platformer');
    Records.submitTreats(this.levelId, this.rests.treats);
    let time = null;
    if (this.timer.enabled && this.timer.started) { const old = Records.bestTime(this.levelId), t = this.timer.stop(); time = { t, old, record: Records.submitTime(this.levelId, t) }; this.showTimer(); }
    this.g.audio.sfx('stamp');
    this.g.showComplete({ ...this.def, collectName: 'Stars' }, this.collected.size, this.totalStars, { treats: this.rests.treats, treatsTotal: this.restSpots.length, time });
  }
}
export const retroSpriteStatus = sprite;
window.__bbaSprite = sprite; // lets the automated tests check the picture loaded
