// SOUTH PACIFIC, 1943 — a retro pixel level in three parts (Time Door #2).
//  1. On foot across a jungle island (gun nests, dive bombers, falling coconuts, rope bridges).
//  2. In a submarine (mines, depth charges, an enemy sub, an underwater cave).
//  3. In a fighter plane (stop 6 enemy planes, dodge flak, then LAND ON THE CARRIER).
// Battles are vehicle against vehicle: no soldiers on screen. Stopped ships put up a white
// flag and the crew rows away; pilots of stopped planes float down by parachute. No blood.
import { Input } from './input.js';
import { RETRO_LEVELS, T, cv, px } from './retro.js';
import { RetroWar } from './retro_war.js';
import { rng } from './util.js';

// ---------------------------------------------------------------------------
// PART 1 — the island (one line per thing; x and rows are in tiles)
// ---------------------------------------------------------------------------
RETRO_LEVELS['bbw-door4'] = {
  name: 'South Pacific, 1943', place: "Belly Button's World", collectName: 'Medals', war: true, pacific: true, width: 150, height: 15,
  introText: 'South Pacific, 1943. Rescue 3 stranded sailors, then take the submarine and the plane back to the carrier!',
  doneText: (r) => `🛬 Perfect landing on the carrier! Sailors rescued: ${r.rescued}/3`,
  build(L) {
    const GR = 11;
    L.ground(0, 30, GR); L.ground(36, 70, GR); L.ground(78, 140, GR);
    // A — The beach
    L.player(3, GR); L.safe(6, GR);
    L.deco('palm', 1, GR); L.deco('palm', 10, GR); L.deco('bush', 14, GR); L.deco('palm', 20, GR);
    L.medals(8, GR - 3, 3); L.hide(12, 'hut'); L.item(16, GR, 'grenades');
    L.debris(17, 25, 3);                                              // coconuts falling from the palms
    L.sandbags(23, 10, 1, 1); L.mg(26, GR, -1, 'aa');                 // an anti-aircraft gun (bullets work on this one)
    L.water(30, 36); L.crumble(30, GR, 6); L.medals(31, GR - 3, 4);  // rope bridge: keep moving!
    // B — The jungle: dive bombers overhead, hide in huts and bushes
    L.safe(38, GR); L.bombZone(40, 66); L.deco('palm', 41, GR);
    L.item(42, GR, 'ammo'); L.hide(45, 'hut'); L.cage(49, GR); L.hide(53, 'bush'); L.deco('palm', 55, GR);
    L.mg(58, GR, -1, 'aa'); L.hide(61, 'hut'); L.medals(57, GR - 4, 3);
    L.wall(63, 0, 3, 8, 'stone'); L.beam(63, 8, 3); L.sign(62, GR, 'duck');   // crawl under the fallen palm trunk
    L.item(67, GR, 'croissant');
    L.water(70, 78); L.crumble(70, GR, 8); L.medals(72, GR - 3, 4);
    // C — The lagoon side: a concrete bunker (grenades only), more coconuts and bombers
    L.safe(80, GR); L.cage(85, GR); L.item(88, GR, 'grenades', true); L.sign(90, GR, 'grenade');
    L.sandbags(92, 10, 2, 1); L.mg(96, GR, -1, 'mg'); L.medals(93, GR - 4, 2);
    L.debris(99, 112, 3); L.deco('palm', 100, GR); L.deco('palm', 106, GR); L.deco('bush', 109, GR);
    L.bombZone(104, 128); L.hide(107, 'bush'); L.hide(116, 'hut'); L.cage(120, GR); L.mg(124, GR, -1, 'aa'); L.item(112, GR, 'croissant');
    L.safe(130, GR); L.item(132, GR, 'croissant'); L.deco('palm', 134, GR);
    L.water(140, 150); L.radio(138, GR);                              // the submarine is waiting at the dock
    L.wall(149, 0, 1, GR, 'stone');
  },
};

// ---------------------------------------------------------------------------
// PART 2 — underwater (pixels). Edit these lists to move things around.
// ---------------------------------------------------------------------------
const SW = 3600, SH = 320, SURF = 56;
const SUB = {
  rocks: [{ x0: 690, x1: 740, y0: 200 }, { x0: 2380, x1: 2430, y0: 170 }, { x0: 2540, x1: 2580, y0: 215 }, { x0: 2700, x1: 2750, y0: 165 }],
  cave: { x0: 1500, x1: 1950, ceil: 140 },                  // rock roof: the sub has to go through the cave below
  kelp: [[300, 420], [820, 900], [1230, 1290], [2120, 2200], [3050, 3120]],
  ships: [[600, 1050], [2050, 2300], [2950, 3200], [3150, 3400]],
  subs: [[1150, 1450, 175], [2450, 2850, 230]],
  mines: [[520, 190], [640, 150], [790, 175], [980, 170], [1600, 200], [1720, 225], [1850, 185], [2250, 200], [2620, 140], [2900, 220], [3250, 160]],
  buoys: [80, 1100, 2000, 2900],
  medals: [[360, 240], [380, 240], [400, 240], [760, 150], [1320, 260], [1700, 170], [1780, 170], [2300, 260], [2650, 250], [3000, 120], [3080, 250], [3300, 200]],
  end: 3450,
};
function subFloor(x) {
  let y = 272 + 20 * Math.sin(x / 170) + 9 * Math.sin(x / 53);
  if (x > SUB.cave.x0 && x < SUB.cave.x1) y = Math.min(y, 252);
  return y;
}
// ---------------------------------------------------------------------------
// PART 3 — the sky (pixels)
// ---------------------------------------------------------------------------
const PW = 5200, SEA = 600, CARRIER = { x0: 4650, x1: 4970 }, DECK = SEA - 26, TOWER = { x0: 4900, x1: 4932, y0: DECK - 42 };
const FLAK_SHIP = 2700, KILLS_NEEDED = 6;
const THRUST = 200, GRAV = 220, DRAG = 0.0035, STALL = 100;

// ---------------------------------------------------------------------------
// Pixel art
// ---------------------------------------------------------------------------
function hard(g, w, h) { const id = g.getImageData(0, 0, w, h); for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 100 ? 255 : 0; g.putImageData(id, 0, 0); }
function circle(g, x, y, r, col) { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) px(g, x + xx, y + yy, col); }
function lievHead(g, x, y) { // a tiny Liev in the cockpit: brown hair, goggles
  px(g, x, y + 2, '#E8B796', 5, 4); px(g, x - 1, y, '#6B3A1E', 7, 3); px(g, x, y - 1, '#7E4824', 2, 1); px(g, x + 3, y - 1, '#7E4824', 2, 1);
  px(g, x + 2, y + 3, '#3A3D45', 4, 1); px(g, x + 4, y + 3, '#9FD3F0', 1, 1);
}
function makeIslandTiles() {
  const t = {};
  { const [c, g] = cv(T, T); const r = rng(41); px(g, 0, 0, '#E9D49B', T, T); px(g, 0, 0, '#F4E3B2', T, 2); for (let i = 0; i < 9; i++) px(g, Math.floor(r() * 15), 2 + Math.floor(r() * 13), r() < 0.5 ? '#D6BC7E' : '#FFF0C8', 1, 1);
    for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 13); px(g, x, 0, '#5FA845', 1, 2); px(g, x + 2, 0, '#4E9A3A', 1, 1); } t.cobble = c; }
  { const [c, g] = cv(T, T); const r = rng(42); px(g, 0, 0, '#C9A86A', T, T); for (let i = 0; i < 10; i++) px(g, Math.floor(r() * 15), Math.floor(r() * 15), r() < 0.5 ? '#B08F55' : '#D9BC80', 2, 1); t.earth = c; }
  { const [c, g] = cv(T, T); px(g, 0, 0, '#A9733C', T, T); px(g, 0, 0, '#C48A4C', T, 2); px(g, 0, 14, '#6B4423', T, 2); for (let x = 3; x < T; x += 7) px(g, x, 4, '#8B5A2B', 1, 8); t.wood = c; }
  const rock = (seed) => { const [c, g] = cv(T, T); const r = rng(seed); px(g, 0, 0, '#6E6A64', T, T); for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 12), y = Math.floor(r() * 12); px(g, x, y, '#86817A', 4, 3); px(g, x, y + 3, '#57534E', 4, 1); } return c; };
  t.stone = [rock(43), rock(44)]; t.brick = t.stone;
  { const [c, g] = cv(T, T); px(g, 0, 2, '#7A5530', T, 12); px(g, 0, 3, '#94683C', T, 3); px(g, 0, 11, '#5A3C20', T, 2); for (let x = 2; x < T; x += 6) px(g, x, 5, '#6B4423', 3, 1); t.beam = c; }  // palm trunk
  { const [c, g] = cv(T, T); px(g, 0, 0, '#C9A86A', 0, 0); for (let i = 0; i < 3; i++) { px(g, i * 5 + 1, 2, '#A9733C', 4, 5); px(g, i * 5 + 1, 2, '#C48A4C', 4, 1); } px(g, 0, 1, '#D9C08A', T, 1); px(g, 0, 7, '#D9C08A', T, 1); t.crumble = c; } // rope bridge planks
  { const [c, g] = cv(T, T); px(g, 0, 0, '#4A4030', T, T); for (const [x, y] of [[1, 1], [9, 1], [-3, 9], [5, 9], [13, 9]]) { px(g, x, y, '#C2A878', 7, 6); px(g, x, y, '#D8C190', 7, 2); } t.sandbag = c; }
  t.gate = t.wood;
  return t;
}
function makeIslandBackground() {
  const Wd = 512, H = 270, L = {};
  { const [c, g] = cv(4, H); ['#5BB4E8', '#6CBDEB', '#7EC6EE', '#90CFF0', '#A3D8F2', '#B7E1F4', '#CBE9F5', '#DDF0F5'].forEach((col, i) => px(g, 0, i * 24, col, 4, 24)); px(g, 0, 192, '#E3F2F4', 4, H); L.sky = c; }
  { const [c, g] = cv(Wd, H); px(g, 0, 200, '#2E8FB8', Wd, H - 200); px(g, 0, 200, '#5AB0D3', Wd, 2); // ocean horizon with islands and a volcano
    for (let x = 60; x < 200; x++) { const h = Math.max(0, 46 - Math.abs(x - 130) * 0.65); px(g, x, 200 - h, '#3F7A58', 1, h); } px(g, 122, 152, '#6E6A64', 16, 4); px(g, 126, 150, '#8C8270', 8, 2);
    for (let x = 300; x < 420; x++) { const h = Math.max(0, 18 - Math.abs(x - 360) * 0.3); px(g, x, 200 - h, '#4E8A62', 1, h); }
    for (let i = 0; i < 6; i++) px(g, 230 + i * 40, 160 + (i % 3) * 8, '#FFFFFF', 18, 4); L.far = c; }
  { const [c, g] = cv(Wd, H); const r = rng(52); px(g, 0, 222, '#2F7A3A', Wd, H - 222); // jungle canopy
    for (let x = 0; x < Wd; x += 9) { const h = 10 + Math.floor(r() * 16); circle(g, x + 4, 222 - h / 2, Math.floor(h / 2) + 4, r() < 0.5 ? '#2F7A3A' : '#3E8E46'); } L.hedge = c; }
  return L;
}
function makePacificArt(base) {
  const a = Object.assign({}, base);
  // Palm, bush, bamboo hut.
  { const [c, g] = cv(48, 80); for (let y = 24; y < 80; y++) px(g, 22 + Math.round(Math.sin(y / 14) * 3), y, y % 6 ? '#8B6A3E' : '#6E5230', 5, 1);
    for (const [dx, dy] of [[-18, 6], [18, 6], [-14, -2], [14, -2], [0, -6]]) for (let i = 0; i < 16; i++) px(g, 24 + Math.round(dx * i / 16), 24 + Math.round(dy * i / 16 + (i * i) / 30), i % 3 ? '#3E9A46' : '#2F7A3A', 3, 2);
    circle(g, 22, 26, 2, '#6B4423'); circle(g, 27, 26, 2, '#6B4423'); hard(g, 48, 80); a.palm = c; }
  { const [c, g] = cv(40, 26); for (let i = 0; i < 6; i++) circle(g, 5 + i * 6, 16 - (i % 2) * 3, 9, i % 2 ? '#3E8E46' : '#2F7A3A'); for (let i = 0; i < 14; i++) px(g, (i * 7) % 38, 8 + (i * 5) % 14, '#5FA845', 2, 2); hard(g, 40, 26); a.bush = c; }
  { const [c, g] = cv(40, 40); px(g, 4, 14, '#C9A86A', 32, 26); for (let x = 4; x < 36; x += 4) px(g, x, 14, '#A9874E', 1, 26);
    for (let y = 0; y < 16; y++) px(g, 20 - y * 1.3 - 2, y, '#B89A4E', Math.round(y * 2.6) + 4, 1); px(g, 0, 14, '#8C7438', 40, 2);
    px(g, 14, 22, '#2A2118', 12, 18); a.hut = c; }
  // First-aid tent (heart sign) — the level's safe house.
  { const [c, g] = cv(40, 34); for (let y = 0; y < 30; y++) px(g, 20 - Math.floor(y * 0.65), 4 + y, y % 5 ? '#8A9A6A' : '#76865A', Math.floor(y * 1.3) + 1, 1); px(g, 18, 20, '#3A3A2A', 4, 14);
    px(g, 13, 14, '#F4F4F0', 14, 9); px(g, 16, 16, '#D8463C', 3, 3); px(g, 21, 16, '#D8463C', 3, 3); px(g, 16, 18, '#D8463C', 8, 2); px(g, 18, 20, '#D8463C', 4, 1); a.safe = c; }
  // Stranded sailor behind fallen logs.
  const sailor = (happy) => { const [c, g] = cv(22, 44); const S = '#E8B796';
    px(g, 7, 6, S, 8, 9); px(g, 6, 2, '#F4F4F0', 10, 4); px(g, 5, 5, '#F4F4F0', 12, 1); px(g, 12, 9, '#2A1C14', 1, 1); if (happy) px(g, 10, 12, '#A9544F', 4, 1);
    px(g, 5, 15, '#F4F4F0', 12, 14); px(g, 5, 15, '#2347C4', 12, 3); px(g, 10, 18, '#2347C4', 2, 3); px(g, 5, 29, '#F4F4F0', 12, 9); px(g, 5, 38, '#2A2A2A', 5, 6); px(g, 12, 38, '#2A2A2A', 5, 6);
    if (happy) { px(g, 1, 4, S, 3, 3); px(g, 18, 4, S, 3, 3); px(g, 2, 7, '#F4F4F0', 3, 9); px(g, 17, 7, '#F4F4F0', 3, 9); } else { px(g, 3, 17, '#F4F4F0', 3, 9); px(g, 16, 17, '#F4F4F0', 3, 9); }
    hard(g, 22, 44); return c; };
  a.villager = sailor(false); a.villagerHappy = sailor(true);
  { const [c, g] = cv(32, 50); for (const [y, x0] of [[30, 0], [38, 2], [22, 4]]) { px(g, x0, y, '#7A5530', 30, 8); px(g, x0, y, '#94683C', 30, 2); circle(g, x0 + 2, y + 4, 3, '#C9A86A'); circle(g, x0 + 2, y + 4, 1, '#7A5530'); } hard(g, 32, 50); a.cage = c; }
  { const [c, g] = cv(32, 50); px(g, 0, 44, '#7A5530', 32, 6); px(g, 0, 44, '#94683C', 32, 2); a.cageOpen = c; }
  // Pineapple (heal), coconut (falling hazard), dock sign.
  { const [c, g] = cv(16, 12); for (let i = 0; i < 4; i++) px(g, 5 + i * 2 - 2, 0, '#3E9A46', 2, 4 - (i % 2)); px(g, 4, 4, '#E0A83A', 8, 8); for (let y = 5; y < 12; y += 2) for (let x = 5; x < 12; x += 3) px(g, x + (y % 4 ? 1 : 0), y, '#B07A22', 1, 1); a.croissant = c; }
  { const [c, g] = cv(10, 10); circle(g, 5, 5, 4, '#6B4423'); circle(g, 4, 4, 2, '#8B5A2B'); px(g, 3, 6, '#3A2210', 1, 1); px(g, 6, 6, '#3A2210', 1, 1); a.rock = c; }
  { const [c, g] = cv(34, 44); px(g, 15, 14, '#6B4423', 4, 30); px(g, 2, 0, '#5A3A10', 30, 16); px(g, 3, 1, '#E9C98F', 28, 14); g.fillStyle = '#2A2A35'; g.font = 'bold 7px monospace'; g.fillText('SUB', 6, 8); g.fillText('DOCK', 4, 14); px(g, 24, 4, '#2347C4', 5, 6); a.radio = c; }
  // Enemy plane (side view, red circle) — used for the dive bombers.
  { const [c, g] = cv(64, 20); px(g, 6, 8, '#9DA08A', 48, 6); px(g, 6, 8, '#B5B8A0', 48, 2); px(g, 52, 9, '#7E816E', 8, 4); px(g, 0, 3, '#7E816E', 8, 7); px(g, 18, 13, '#80836E', 26, 3); px(g, 34, 6, '#5A6A70', 8, 3); circle(g, 28, 11, 3, '#C8302C'); px(g, 60, 3, '#9AA0A8', 2, 14); a.plane = c; }
  // Gun nests: an open anti-aircraft gun and a concrete bunker (no people shown).
  { const [c, g] = cv(36, 30); px(g, 2, 22, '#C2A878', 32, 8); px(g, 2, 22, '#D8C190', 32, 2); px(g, 14, 10, '#4E5848', 10, 12); px(g, 12, 8, '#5E6858', 14, 4); px(g, 22, 6, '#3A3A3A', 14, 3); px(g, 30, 2, '#3A3A3A', 3, 4); a.aaGun = c; }
  { const [c, g] = cv(36, 30); px(g, 2, 22, '#C2A878', 32, 8); px(g, 14, 12, '#4E5848', 10, 10); px(g, 22, 18, '#3A3A3A', 12, 3); px(g, 6, 2, '#E9E4D8', 1, 20); px(g, 7, 2, '#F4F4F0', 9, 6); a.aaOut = c; }
  { const [c, g] = cv(44, 32); px(g, 2, 8, '#9A958A', 40, 24); px(g, 6, 4, '#9A958A', 32, 4); px(g, 2, 8, '#B5B0A4', 40, 2); px(g, 26, 14, '#2A2622', 16, 4); px(g, 34, 15, '#3A3A3A', 10, 2); for (let i = 0; i < 8; i++) px(g, 4 + i * 5, 24 + (i % 2) * 3, '#86817A', 3, 2); a.bunker = c; }
  { const [c, g] = cv(44, 32); px(g, 2, 8, '#9A958A', 40, 24); px(g, 6, 4, '#9A958A', 32, 4); px(g, 26, 14, '#2A2622', 16, 4); px(g, 36, 2, '#E9E4D8', 1, 14); px(g, 37, 2, '#F4F4F0', 7, 5); a.bunkerOut = c; }
  // --- Submarine part ---
  { const [c, g] = cv(60, 26); px(g, 4, 12, '#556B78', 50, 10); px(g, 2, 14, '#556B78', 56, 6); px(g, 4, 12, '#6E8794', 50, 2); px(g, 0, 15, '#455863', 4, 4); px(g, 56, 15, '#455863', 4, 4);
    px(g, 22, 4, '#556B78', 14, 9); px(g, 22, 4, '#6E8794', 14, 1); px(g, 30, 0, '#3A4650', 2, 5); px(g, 30, 0, '#3A4650', 5, 1);
    circle(g, 29, 9, 2, '#9FD3F0'); lievHead(g, 26, 5); px(g, 44, 15, '#9FD3F0', 2, 2); px(g, 14, 15, '#9FD3F0', 2, 2); px(g, 0, 10, '#C9A227', 2, 12); a.sub = c; }
  { const [c, g] = cv(60, 26); px(g, 4, 12, '#5E5E54', 50, 10); px(g, 2, 14, '#5E5E54', 56, 6); px(g, 4, 12, '#76766A', 50, 2); px(g, 22, 4, '#5E5E54', 14, 9); px(g, 30, 0, '#3A3A35', 2, 5); circle(g, 14, 17, 3, '#C8302C'); a.enemySub = c; }
  { const [c, g] = cv(100, 30); px(g, 6, 16, '#6E7378', 88, 10); for (let x = 6; x < 94; x++) if (x < 14 || x > 86) px(g, x, 16 + Math.max(0, Math.abs(x - 50) - 36), '#00000000', 1, 1);
    px(g, 4, 14, '#7E8388', 92, 3); px(g, 36, 4, '#6E7378', 22, 11); px(g, 40, 0, '#5E6368', 6, 5); px(g, 62, 10, '#5E6368', 18, 4); px(g, 76, 11, '#3A3A3A', 12, 2); px(g, 16, 10, '#5E6368', 12, 4); px(g, 8, 11, '#3A3A3A', 10, 2);
    circle(g, 70, 21, 3, '#C8302C'); for (let x = 20; x < 80; x += 10) px(g, x, 19, '#2A2A2A', 2, 2); a.ship = c; }
  { const [c, g] = cv(24, 22); px(g, 0, 14, '#8B5A2B', 24, 6); px(g, 2, 20, '#6B4423', 20, 2); px(g, 11, 0, '#E9E4D8', 1, 14); px(g, 12, 0, '#F4F4F0', 9, 6); for (let i = 0; i < 3; i++) { px(g, 4 + i * 6, 9, '#E8B796', 3, 3); px(g, 4 + i * 6, 12, '#8A9A6A', 3, 2); } a.lifeboat = c; }
  { const [c, g] = cv(12, 12); circle(g, 6, 6, 4, '#3A3A3A'); for (const [x, y] of [[6, 0], [6, 11], [0, 6], [11, 6], [2, 2], [10, 2], [2, 10], [10, 10]]) px(g, x - 1 + (x > 6 ? 0 : 1), y - (y > 6 ? 1 : 0), '#5A5A5A', 2, 2); circle(g, 5, 5, 1, '#7A7A7A'); a.mine = c; }
  { const [c, g] = cv(8, 10); px(g, 1, 1, '#3A3A3A', 6, 8); px(g, 0, 2, '#5A5A5A', 8, 1); px(g, 0, 7, '#5A5A5A', 8, 1); a.dcharge = c; }
  { const [c, g] = cv(14, 40); px(g, 4, 10, '#D84A3C', 6, 18); px(g, 4, 14, '#F4F4F0', 6, 4); px(g, 6, 2, '#5A5A5A', 2, 8); px(g, 4, 0, '#FFD34D', 6, 3); px(g, 2, 28, '#D84A3C', 10, 4); a.buoy = c; }
  // --- Plane part ---
  const plane = (enemy) => { const [c, g] = cv(40, 18);
    const B = enemy ? '#9DA08A' : '#3E5C8A', Bl = enemy ? '#B5B8A0' : '#5878A8', Bd = enemy ? '#7E816E' : '#2C4468';
    px(g, 4, 7, B, 30, 6); px(g, 4, 7, Bl, 30, 2); px(g, 2, 8, Bd, 3, 4); px(g, 0, 2, Bd, 6, 7); px(g, 34, 8, Bd, 3, 4);
    px(g, 12, 11, Bd, 16, 3); px(g, 16, 3, '#9FD3F0', 9, 4); px(g, 16, 3, '#C8E8F8', 9, 1);
    if (!enemy) { lievHead(g, 18, 1); circle(g, 9, 10, 2, '#2347C4'); px(g, 8, 10, '#F4F4F0', 3, 1); px(g, 9, 9, '#F4F4F0', 1, 3); }
    else { px(g, 18, 3, '#5A3A2A', 4, 3); circle(g, 9, 10, 2, '#C8302C'); }
    return c; };
  a.myPlane = plane(false); a.enemyPlane = plane(true);
  { const [c, g] = cv(16, 22); for (let x = 0; x < 16; x++) { const h = Math.round(Math.sqrt(Math.max(0, 64 - (x - 7.5) ** 2)) * 0.7); px(g, x, 6 - h, x % 4 < 2 ? '#F4F4F0' : '#E07A3F', 1, h + 1); }
    for (const x of [1, 7, 14]) for (let y = 7; y < 15; y++) px(g, Math.round(x + (7.5 - x) * (y - 7) / 8), y, '#9A958A', 1, 1);
    px(g, 6, 15, '#6B3A1E', 4, 2); px(g, 6, 16, '#E8B796', 4, 2); px(g, 6, 18, '#8A9A6A', 4, 4); a.parachute = c; }
  { const [c, g] = cv(340, 46); // the aircraft carrier (deck is the top edge)
    px(g, 0, 20, '#5E6670', 340, 26); for (let x = 0; x < 30; x++) px(g, x, 20 + Math.round((30 - x) * 0.6), '#00000000', 1, 1);
    px(g, 0, 18, '#8A7A5A', 340, 4); for (let x = 6; x < 330; x += 22) px(g, x, 19, '#F4F4F0', 10, 1); px(g, 0, 22, '#4E5660', 340, 2);
    px(g, 250, 0, '#6E7680', 32, 18); px(g, 254, 3, '#9FD3F0', 24, 3); px(g, 264, -4, '#5E6670', 3, 6); for (let x = 20; x < 330; x += 16) px(g, x, 30, '#3A424C', 4, 3);
    g.clearRect(0, 22, 30, 24); for (let x = 0; x < 30; x++) px(g, x, 22 + Math.round((30 - x) * 0.7), '#5E6670', 1, 24 - Math.round((30 - x) * 0.7)); a.carrier = c; }
  return a;
}

// ---------------------------------------------------------------------------
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class RetroPacific extends RetroWar {
  constructor(game) {
    super(game);
    this.canvas.id = 'pixel-pacific';
    this.wtiles = makeIslandTiles(); this.wbg = makeIslandBackground(); this.art = makePacificArt(this.art);
    this.smoke = false; this.waterCols = ['#2E9AC0', '#6CC8E0', '#B8ECF5'];
    this.notLievText = 'Liev takes this mission. Belly Button is waiting safely back home!';
    this.healText = '🍍 Fresh pineapple! +1 heart'; this.restText = '🍍 First-aid tent: a pineapple and all hearts back!';
    this.cagePrompt = 'Move the logs'; this.rescueLabel = 'Sailors rescued'; this.rescueText = (n) => `"Thanks, Liev!" Sailor rescued (${n}/3)`;
    this.mgTip = "That concrete bunker is too strong for bullets. Throw a grenade (press 3)!";
    this.footHint = 'X fires · Q (or 1 2 3) switches weapon · ↓ ducks and hides you in huts and bushes · E moves logs to free sailors · the gray bunker needs a grenade!';
  }

  enter(opts) {
    this.phase = 'foot'; this.hintText = this.footHint;
    super.enter(opts);
    this.g.audio.music('pacific');
    this.footMedals = this.stars.length;
    this.subMedals = SUB.medals.map(([x, y]) => ({ x, y }));
    this.totalStars = this.footMedals + this.subMedals.length;
    if (opts.phase === 'sub') this.startSub();
    else if (opts.phase === 'plane') this.startPlane();
    this.updateHud();
  }
  exit() { super.exit(); this.g.ui.prompt(null); }

  // Part 1 ends at the dock → into the submarine. The last part ends with a landing.
  complete() {
    if (this.phase === 'foot') { this.startSub(); return; }
    super.complete();
  }

  // Coconuts and gun nests look different here.
  drawMg(g, e) {
    const a = this.art, out = e.state === 'out' || e.state === 'dizzy';
    const img = e.kind === 'aa' ? (out ? a.aaOut : a.aaGun) : (out ? a.bunkerOut : a.bunker);
    g.save(); g.translate(Math.round(e.x), e.y); if (e.face < 0) g.scale(-1, 1);
    if (e.hurtT > 0 && Math.floor(this.time * 30) % 2) g.globalAlpha = 0.5;
    g.drawImage(img, -img.width / 2 | 0, -img.height);
    if (!out && e.state === 'burst' && e.t < 0.08) { g.fillStyle = '#FFF3A0'; g.fillRect(img.width / 2 - 2, -img.height + (e.kind === 'aa' ? 5 : 13), 5, 5); }
    g.restore();
    if (e.state === 'dizzy') this.drawStars(g, e.x, e.y - 36);
  }

  // =====================================================================
  // Shared: update loop for the sub and plane parts
  // =====================================================================
  update(dt) {
    if (this.phase === 'foot') return super.update(dt);
    this.time += dt;
    const paused = this.g.paused || this.done;
    if (!paused) {
      const n = Math.max(1, Math.ceil(dt / (1 / 120))), sdt = dt / n;
      for (let i = 0; i < n; i++) { if (this.phase === 'sub') this.subStep(sdt, i === 0); else if (this.phase === 'plane') this.planeStep(sdt, i === 0); }
      if (Input.hit('KeyH')) this.g.ui.toast(this.phase === 'sub' ? 'Arrows steer the sub · X fires a torpedo · stop inside seaweed to hide · rise near the top to hit ships · red buoys heal you' : '↑ nose up · ↓ nose down · → more power · ← less power · X fires · G wheels up/down. Too slow and the plane STALLS (nose drops). To land: wheels down, slow, gentle, onto the carrier deck.', 7);
    }
    if (!this.g.simulating) { if (this.phase === 'sub') this.drawSub(); else this.drawPlane(); }
    this.g.ui.update(this.g.paused ? 0 : dt);
    if (Math.floor(this.time * 4) !== this._hud4) { this._hud4 = Math.floor(this.time * 4); this.updateHud(); }
    if (this.timer.started && Math.floor(this.time * 10) !== this._tt) { this._tt = Math.floor(this.time * 10); this.showTimer(); }
  }
  updateHud() {
    if (!this.def) return;
    if (this.phase !== 'sub' && this.phase !== 'plane') return super.updateHud();
    const hearts = '❤️'.repeat(Math.max(0, this.hearts)) + '🤍'.repeat(Math.max(0, 3 - this.hearts));
    const medals = `🎖️ ${this.collected.size}/${this.totalStars}`;
    if (this.phase === 'sub') {
      const s = this.sub;
      this.g.ui.hud(true, `${this.def.name} · Submarine · ${hearts}${this.hidden ? ' &nbsp;🙈 hidden in seaweed' : ''}<br><span style="font-size:18px">Ships stopped ${this.shipsStopped}/${SUB.ships.length} · depth ${Math.max(0, Math.round((s.y - SURF) / 3))} m · ${medals}</span>`,
        `<span class="key">← → ↑ ↓</span> steer · <span class="key">X</span> torpedo · stop in <b>seaweed</b> to hide · <span class="key">H</span> help`);
    } else {
      const P = this.pl, spd = Math.round(Math.hypot(P.vx, P.vy) * 1.6);
      const goal = this.kills >= KILLS_NEEDED ? '✅ Now land on the carrier!' : `Enemy planes stopped ${this.kills}/${KILLS_NEEDED}`;
      this.g.ui.hud(true, `${this.def.name} · Fighter plane · ${hearts}${this.hidden ? ' &nbsp;☁️ hidden' : ''}<br><span style="font-size:18px">${goal} · speed ${spd} · height ${Math.max(0, Math.round((SEA - P.y) * 4))} ft · power ${Math.round(P.th * 100)}% · wheels ${P.gear ? 'DOWN' : 'up'}</span>`,
        `<span class="key">↑ ↓</span> nose · <span class="key">← →</span> power · <span class="key">X</span> fire · <span class="key">G</span> wheels · <span class="key">H</span> help`);
    }
    if (this.timer) { this.timer.enabled = !!this.g.settings.timer; this.showTimer(); }
  }
  boom(x, y, r) { this.booms.push({ x, y, r, t: 0 }); this.g.audio.sfx('boom'); }
  stepFx(dt) { for (const bm of this.booms) bm.t += dt; this.booms = this.booms.filter(b => b.t < 0.7); this.invuln = Math.max(0, this.invuln - dt); }

  // =====================================================================
  // PART 2 — Submarine
  // =====================================================================
  startSub(checkpoint = 0) {
    this.phase = 'sub'; this.hidden = false; this.g.ui.prompt(null);
    this.sub = { x: SUB.buoys[checkpoint] + 30, y: 120, vx: 0, vy: 0, face: 1, still: 0 };
    this.subCheck = checkpoint; this.hearts = 3; this.invuln = 1;
    this.ships = SUB.ships.map(([x0, x1]) => ({ x: (x0 + x1) / 2, x0, x1, dir: 1, hp: 2, state: 'patrol', cool: 1.5, t: 0 }));
    this.esubs = SUB.subs.map(([x0, x1, y]) => ({ x: (x0 + x1) / 2, y, x0, x1, face: -1, hp: 2, state: 'patrol', t: 0 }));
    this.mines = SUB.mines.map(([x, y]) => ({ x, y, base: subFloor(x), alive: true, ph: x }));
    this.torps = []; this.etorps = []; this.charges = []; this.caveRocks = []; this.booms = []; this.bubbles = [];
    this.shipsStopped = 0; this.caveT = 1; this.subCam = { x: 0, y: 0 };
    this.buoyDone = SUB.buoys.map((b, i) => i <= checkpoint);
    this.g.audio.sfx('sonar');
    this.g.ui.toast(checkpoint ? 'Back at the last buoy. Full repairs!' : '🌊 Into the submarine! Sneak past the enemy ships to reach our aircraft carrier.', 4);
    this.updateHud();
  }
  subSolid(x, y) {
    if (x < 0 || x > SW) return true;
    if (y >= subFloor(x)) return true;
    const c = SUB.cave; if (x > c.x0 && x < c.x1 && y < c.ceil) return true;
    for (const r of SUB.rocks) if (x > r.x0 && x < r.x1 && y > r.y0) return true;
    return false;
  }
  subHits(x, y) { return [[-26, 0], [26, 0], [0, -9], [0, 8], [-16, 6], [16, 6], [-16, -5], [16, -5]].some(([dx, dy]) => this.subSolid(x + dx, y + dy)); }
  subHurt(dir) {
    if (this.invuln > 0 || this.done) return;
    this.hearts--; this.invuln = 1.5; this.sub.vx = dir * 90; this.g.audio.sfx('hurt'); this.updateHud();
    if (this.hearts <= 0) { this.g.ui.toast('Ouch! The sub goes back to the last buoy for repairs.', 2.5); this.startSub(this.subCheck); }
  }
  subStep(dt, first) {
    const s = this.sub, a = this.g.audio;
    if (first && (Input.axis().x || Input.axis().y)) this.timer.start();
    this.timer.tick(dt);
    const ax = (Input.key('ArrowRight', 'KeyD') ? 1 : 0) - (Input.key('ArrowLeft', 'KeyA') ? 1 : 0);
    const ay = (Input.key('ArrowDown', 'KeyS') ? 1 : 0) - (Input.key('ArrowUp', 'KeyW') ? 1 : 0);
    s.vx += (ax * 115 - s.vx) * Math.min(1, 2.2 * dt); s.vy += (ay * 75 - s.vy) * Math.min(1, 2.6 * dt);
    if (ax) s.face = ax;
    const nx = s.x + s.vx * dt; if (this.subHits(nx, s.y)) { if (Math.abs(s.vx) > 40) a.sfx('bonk'); s.vx *= -0.3; } else s.x = nx;
    let ny = clamp(s.y + s.vy * dt, SURF + 12, SH); if (this.subHits(s.x, ny)) { s.vy *= -0.3; } else s.y = ny;
    // Hide: sit still inside seaweed.
    const inKelp = SUB.kelp.some(([x0, x1]) => s.x > x0 + 6 && s.x < x1 - 6 && s.y > subFloor(s.x) - 110);
    s.still = Math.hypot(s.vx, s.vy) < 22 && inKelp ? s.still + dt : 0;
    const wasHidden = this.hidden; this.hidden = s.still > 0.3; if (wasHidden !== this.hidden) this.updateHud();
    // Torpedoes.
    this.cool -= dt;
    if (first && Input.hit('KeyX', 'KeyK', 'Space') && this.cool <= 0) { this.cool = 0.7; this.torps.push({ x: s.x + s.face * 30, y: s.y + 4, vx: s.face * 230, life: 2.6 }); a.sfx('torpedo'); }
    for (const t of this.torps) {
      t.x += t.vx * dt; t.life -= dt; if (Math.random() < dt * 30) this.bubbles.push({ x: t.x - Math.sign(t.vx) * 6, y: t.y, t: 0 });
      if (this.subSolid(t.x, t.y)) { t.life = 0; this.boom(t.x, t.y, 18); continue; }
      for (const m of this.mines) if (m.alive && Math.hypot(m.x - t.x, m.y - t.y) < 10) { m.alive = false; t.life = 0; this.boom(m.x, m.y, 26); }
      for (const e of this.esubs) if (e.state !== 'surrender' && Math.abs(e.x - t.x) < 28 && Math.abs(e.y - t.y) < 10) { t.life = 0; e.hp--; this.boom(t.x, t.y, 16); if (e.hp <= 0) { e.state = 'surrender'; this.g.ui.toast('The enemy sub gives up and floats to the top!', 2.5); } }
      for (const sh of this.ships) if (sh.state === 'patrol' && t.y < SURF + 20 && Math.abs(sh.x - t.x) < 46) { t.life = 0; sh.hp--; this.boom(t.x, SURF + 10, 22); if (sh.hp <= 0) { sh.state = 'stopped'; this.shipsStopped++; this.g.ui.toast('Ship stopped! The crew rows away under a white flag.', 2.5); this.updateHud(); } }
    }
    this.torps = this.torps.filter(t => t.life > 0);
    // Ships drop depth charges when the sub is below them.
    for (const sh of this.ships) {
      if (sh.state !== 'patrol') { sh.t += dt; continue; }
      sh.x += sh.dir * 30 * dt; if (sh.x < sh.x0) sh.dir = 1; if (sh.x > sh.x1) sh.dir = -1;
      sh.cool -= dt;
      if (!this.hidden && Math.abs(s.x - sh.x) < 90 && sh.cool <= 0) { sh.cool = 1.6; a.sfx('splash'); this.charges.push({ x: sh.x + (Math.random() - 0.5) * 40, y: SURF + 4, ty: clamp(s.y, SURF + 30, SH - 30), warned: false }); }
    }
    for (const c of this.charges) {
      c.y += 62 * dt;
      if (!c.warned && c.ty - c.y < 50) { c.warned = true; a.sfx('warn'); }
      if (c.y >= c.ty || this.subSolid(c.x, c.y)) { c.dead = true; this.boom(c.x, c.y, 30); if (!this.hidden && Math.hypot(s.x - c.x, s.y - c.y) < 40) this.subHurt(Math.sign(s.x - c.x) || 1); }
    }
    this.charges = this.charges.filter(c => !c.dead);
    // Enemy subs.
    for (const e of this.esubs) {
      e.t -= dt;
      if (e.state === 'surrender') { e.y = Math.max(SURF + 2, e.y - 30 * dt); continue; }
      const sees = !this.hidden && Math.abs(s.x - e.x) < 230 && Math.abs(s.y - e.y) < 26;
      if (e.state === 'patrol') { e.x += e.face * 35 * dt; if (e.x < e.x0) e.face = 1; if (e.x > e.x1) e.face = -1; if (sees) { e.state = 'alert'; e.t = 0.7; e.face = Math.sign(s.x - e.x) || 1; a.sfx('sonar'); } }
      else if (e.state === 'alert' && e.t <= 0) { e.state = 'cool'; e.t = 2.2; this.etorps.push({ x: e.x + e.face * 30, y: e.y + 4, vx: e.face * 120, life: 3.5 }); a.sfx('torpedo'); }
      else if (e.state === 'cool' && e.t <= 0) e.state = 'patrol';
      if (Math.abs(e.x - s.x) < 50 && Math.abs(e.y - s.y) < 18) this.subHurt(Math.sign(s.x - e.x) || 1);
    }
    for (const t of this.etorps) {
      t.x += t.vx * dt; t.life -= dt;
      if (this.subSolid(t.x, t.y)) { t.life = 0; this.boom(t.x, t.y, 16); continue; }
      if (!this.hidden && Math.abs(t.x - s.x) < 28 && Math.abs(t.y - s.y) < 10) { t.life = 0; this.boom(t.x, t.y, 18); this.subHurt(Math.sign(t.vx)); }
    }
    this.etorps = this.etorps.filter(t => t.life > 0);
    // Mines.
    for (const m of this.mines) if (m.alive) { const my = m.y + Math.sin(this.time * 1.5 + m.ph) * 3; if (Math.hypot(m.x - s.x, my - s.y) < 22) { m.alive = false; this.boom(m.x, my, 26); this.subHurt(Math.sign(s.x - m.x) || 1); } }
    // Falling rocks in the cave.
    const c = SUB.cave;
    if (s.x > c.x0 && s.x < c.x1) { this.caveT -= dt; if (this.caveT <= 0) { this.caveT = 1.7; this.caveRocks.push({ x: clamp(s.x + s.vx * 0.8 + (Math.random() - 0.5) * 40, c.x0 + 10, c.x1 - 10), y: c.ceil, vy: 0, warn: 0.8 }); a.sfx('crumble'); } }
    for (const r of this.caveRocks) {
      if (r.warn > 0) { r.warn -= dt; continue; }
      r.vy += 220 * dt; r.y += r.vy * dt;
      if (Math.abs(r.x - s.x) < 26 && Math.abs(r.y - s.y) < 12) { r.dead = true; this.subHurt(0); }
      if (r.y > subFloor(r.x)) r.dead = true;
    }
    this.caveRocks = this.caveRocks.filter(r => !r.dead);
    // Medals, buoys, the finish.
    this.subMedals.forEach((m, i) => { if (!this.collected.has('s' + i) && Math.hypot(m.x - s.x, m.y - s.y) < 20) { this.collected.add('s' + i); this.g.audio.sfx('collect'); this.updateHud(); } });
    SUB.buoys.forEach((bx, i) => { if (!this.buoyDone[i] && s.x > bx) { this.buoyDone[i] = true; this.subCheck = i; this.hearts = 3; a.sfx('found'); this.g.ui.toast('Buoy reached: repairs done, and your place is saved.', 2); this.updateHud(); } });
    this.stepFx(dt);
    for (const b of this.bubbles) { b.t += dt; b.y -= 25 * dt; } this.bubbles = this.bubbles.filter(b => b.t < 1);
    if (Math.random() < dt * 4) this.bubbles.push({ x: s.x - s.face * 28, y: s.y + 6, t: 0 });
    if (s.x > SUB.end) { this.g.audio.sfx('found'); this.startPlane(); }
  }
  drawSub() {
    const g = this.ctx, vw = this.vw, vh = this.vh, s = this.sub, a = this.art;
    const cam = this.subCam; cam.x += (clamp(s.x - vw * 0.4, 0, SW - vw) - cam.x) * 0.15; cam.y += (clamp(s.y - vh * 0.5, 0, SH - vh) - cam.y) * 0.15;
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    // Water gets darker as you go deeper.
    const sky = SURF - cy; g.fillStyle = '#9ED8F0'; g.fillRect(0, 0, vw, Math.max(0, sky));
    for (let y = Math.max(0, sky); y < vh; y += 4) { const d = clamp((y + cy - SURF) / (SH - SURF), 0, 1); g.fillStyle = `rgb(${Math.round(40 - d * 30)},${Math.round(150 - d * 95)},${Math.round(190 - d * 90)})`; g.fillRect(0, y, vw, 4); }
    for (let i = 0; i < 6; i++) { const x = ((i * 90 - cx * 0.3) % (vw + 60) + vw + 60) % (vw + 60) - 30; g.fillStyle = 'rgba(200,240,255,0.08)'; g.fillRect(x, sky, 14, vh); }   // light rays
    g.save(); g.translate(-cx, -cy);
    g.fillStyle = '#B8ECF5'; for (let x = cx - (cx % 8); x < cx + vw; x += 8) g.fillRect(x + Math.floor((this.time * 8 + x / 8) % 8), SURF, 3, 1);
    // Sea floor, rocks, cave roof.
    for (let x = cx - (cx % 4); x < cx + vw + 4; x += 4) { const fy = Math.round(subFloor(x)); g.fillStyle = '#C9B27A'; g.fillRect(x, fy, 4, SH - fy + 40); g.fillStyle = '#B09A62'; g.fillRect(x, fy + 6 + (x / 4 % 3), 4, 2); }
    g.fillStyle = '#5E6A6A'; for (const r of SUB.rocks) { g.fillRect(r.x0, r.y0, r.x1 - r.x0, SH - r.y0); g.fillStyle = '#76837F'; g.fillRect(r.x0, r.y0, r.x1 - r.x0, 3); g.fillStyle = '#5E6A6A'; }
    const c = SUB.cave; g.fillStyle = '#4E5A5A'; g.fillRect(c.x0, -40, c.x1 - c.x0, c.ceil + 40); g.fillStyle = '#3E4848'; for (let x = c.x0; x < c.x1; x += 14) g.fillRect(x, c.ceil - 2, 8, 6 + (x % 3) * 2);
    // Seaweed (hiding spots).
    for (const [x0, x1] of SUB.kelp) for (let x = x0; x < x1; x += 7) { const fy = subFloor(x); for (let k = 0; k < 22; k++) { const y = fy - k * 5; g.fillStyle = k % 2 ? '#2F8A3A' : '#3E9A46'; g.fillRect(Math.round(x + Math.sin(this.time * 2 + x + k * 0.4) * (k * 0.25)), y - 5, 3, 5); } }
    // Coral bits.
    for (let x = cx - (cx % 37); x < cx + vw; x += 37) { const fy = subFloor(x); g.fillStyle = x % 2 ? '#F28A7A' : '#F2C230'; g.fillRect(x, fy - 6, 3, 6); g.fillRect(x - 2, fy - 4, 7, 2); }
    // Buoys, medals, mines, ships, subs.
    SUB.buoys.forEach((bx, i) => { g.drawImage(a.buoy, bx - 7, SURF - 30 + Math.round(Math.sin(this.time * 2 + i) * 1.5)); if (!this.buoyDone[i] && Math.floor(this.time * 3) % 2) { g.fillStyle = '#FFD34D'; g.fillRect(bx - 1, SURF - 34, 3, 3); } });
    this.subMedals.forEach((m, i) => { if (!this.collected.has('s' + i)) g.drawImage(a.medal, m.x - 5, m.y - 7 + Math.round(Math.sin(this.time * 3 + i) * 1.5)); });
    for (const m of this.mines) if (m.alive) { const my = Math.round(m.y + Math.sin(this.time * 1.5 + m.ph) * 3); g.fillStyle = '#4A4A40'; g.fillRect(m.x, my + 5, 1, m.base - my - 5); g.drawImage(a.mine, m.x - 6, my - 6); }
    for (const sh of this.ships) {
      g.save(); g.translate(Math.round(sh.x), SURF - 18 + Math.round(Math.sin(this.time * 1.4 + sh.x) * 1)); if (sh.dir < 0) g.scale(-1, 1); g.drawImage(a.ship, -50, -8); g.restore();
      if (sh.state === 'stopped') { for (let i = 0; i < 5; i++) { const yy = SURF - 30 - ((this.time * 18 + i * 10) % 50); g.fillStyle = 'rgba(80,80,85,0.5)'; g.fillRect(sh.x + Math.round(Math.sin(i + this.time) * 4), Math.round(yy), 5 + i, 5 + i); }
        if (sh.t < 40) g.drawImage(a.lifeboat, Math.round(sh.x - 70 - sh.t * 6), SURF - 20); }
    }
    for (const e of this.esubs) { g.save(); g.translate(Math.round(e.x), Math.round(e.y)); if (e.face < 0) g.scale(-1, 1); g.drawImage(a.enemySub, -30, -13); g.restore();
      if (e.state === 'alert') { g.fillStyle = '#FFD34D'; g.fillRect(e.x - 1, e.y - 26, 3, 7); g.fillRect(e.x - 1, e.y - 17, 3, 2); }
      if (e.state === 'surrender' && e.y < SURF + 8) { g.fillStyle = '#E9E4D8'; g.fillRect(e.x, e.y - 30, 1, 18); g.fillStyle = '#F4F4F0'; g.fillRect(e.x + 1, e.y - 30, 9, 6); } }
    // The player's submarine.
    if (!(this.invuln > 0 && Math.floor(this.time * 20) % 2)) { g.save(); g.translate(Math.round(s.x), Math.round(s.y)); if (s.face < 0) g.scale(-1, 1); if (this.hidden) g.globalAlpha = 0.5; g.drawImage(a.sub, -30, -13); g.fillStyle = '#C9A227'; const prop = Math.floor(this.time * 20) % 2; g.fillRect(-32, -3 + prop * 2, 2, 6 - prop * 4); g.restore(); }
    // Torpedoes, depth charges, cave rocks, bubbles, booms.
    for (const t of this.torps) { g.fillStyle = '#3A4650'; g.fillRect(Math.round(t.x) - 6, Math.round(t.y) - 1, 12, 3); g.fillStyle = '#C9A227'; g.fillRect(Math.round(t.x) + Math.sign(t.vx) * 5, Math.round(t.y) - 1, 2, 3); }
    for (const t of this.etorps) { g.fillStyle = '#2A2A2A'; g.fillRect(Math.round(t.x) - 6, Math.round(t.y) - 1, 12, 3); g.fillStyle = '#C8302C'; g.fillRect(Math.round(t.x) + Math.sign(t.vx) * 5, Math.round(t.y) - 1, 2, 3); }
    for (const ch of this.charges) { g.drawImage(a.dcharge, Math.round(ch.x) - 4, Math.round(ch.y) - 5); if (Math.floor(this.time * 8) % 2) { g.strokeStyle = '#FF6B5A'; g.lineWidth = 1; g.strokeRect(Math.round(ch.x) - 10, Math.round(ch.ty) - 4, 20, 8); } }
    for (const r of this.caveRocks) { if (r.warn > 0) { g.fillStyle = '#C9D8D8'; for (let i = 0; i < 4; i++) g.fillRect(Math.round(r.x + (i - 2) * 4), Math.round(r.y + ((this.time * 30 + i * 7) % 16)), 2, 2); } else { g.fillStyle = '#5E6A6A'; g.fillRect(Math.round(r.x) - 6, Math.round(r.y) - 5, 12, 10); g.fillStyle = '#76837F'; g.fillRect(Math.round(r.x) - 6, Math.round(r.y) - 5, 12, 2); } }
    g.fillStyle = 'rgba(220,245,255,0.7)'; for (const b of this.bubbles) g.fillRect(Math.round(b.x + Math.sin(b.t * 9) * 2), Math.round(b.y), 2, 2);
    for (const bm of this.booms) this.drawBoom(g, bm);
    // Our carrier waiting at the end.
    g.drawImage(a.carrier, SUB.end + 40, SURF - 40);
    g.restore();
  }

  // =====================================================================
  // PART 3 — Fighter plane
  // =====================================================================
  startPlane() {
    this.phase = 'plane'; this.hidden = false; this.g.ui.prompt(null);
    this.pl = { x: 220, y: 300, vx: 190, vy: 0, a: 0, th: 0.7, gear: false, state: 'fly', landT: 0 };
    this.hearts = 3; this.invuln = 1.5; this.kills = 0; this.spawned = 0; this.cool = 0;
    this.eplanes = []; this.pbullets = []; this.ebull = []; this.flak = []; this.chutes = []; this.booms = []; this.smokes = []; this.flakT = 1;
    this.planeCam = { x: 0, y: 140 }; this.stallWarn = 0;
    const r = rng(77); this.clouds = []; for (let i = 0; i < 26; i++) this.clouds.push({ x: 300 + r() * (PW - 600), y: 60 + r() * 340, w: 70 + r() * 90, h: 26 + r() * 22 });
    this.spawnWave(2);
    this.g.audio.sfx('plane');
    this.g.ui.toast('✈️ Take to the sky! Stop 6 enemy planes, then land on the carrier. Press H for flying help.', 5);
    this.updateHud();
  }
  spawnWave(n) {
    const P = this.pl;
    for (let i = 0; i < n && this.spawned < KILLS_NEEDED; i++) {
      this.spawned++;
      const side = i % 2 ? -1 : 1, x = clamp(P.x + side * (this.vw * 0.7 + 60 + i * 40), 60, PW - 60);
      this.eplanes.push({ x, y: 120 + Math.random() * 220, a: side > 0 ? Math.PI : 0, v: 165, hp: 3, state: 'fly', cool: 1.5 + i * 0.5, off: { x: -60, y: -30 }, offT: 0, hurtT: 0 });
    }
  }
  planeHurt() {
    if (this.invuln > 0 || this.done) return;
    this.hearts--; this.invuln = 1.6; this.g.audio.sfx('hurt'); this.updateHud();
    if (this.hearts <= 0) { this.hearts = 3; this.g.ui.toast('Your plane is patched up and back in the air!', 2.5); this.respawnPlane(); }
  }
  respawnPlane() { const P = this.pl; P.y = 260; P.vx = 190 * (Math.cos(P.a) < 0 ? -1 : 1); P.vy = 0; P.a = P.vx < 0 ? Math.PI : 0; P.th = 0.7; P.state = 'fly'; this.invuln = 2; this.ebull = []; this.flak = []; }
  planeStep(dt, first) {
    const P = this.pl, a = this.g.audio;
    this.timer.tick(dt);
    if (P.state === 'landed') { P.landT += dt; P.vx *= Math.exp(-3 * dt); P.x += P.vx * dt; if (P.landT > 1.6 && !this.done) this.complete(); this.stepFx(dt); return; }
    const up = Input.key('ArrowUp', 'KeyW'), dn = Input.key('ArrowDown', 'KeyS'), more = Input.key('ArrowRight', 'KeyD'), less = Input.key('ArrowLeft', 'KeyA');
    if (first && (up || dn || more || less)) this.timer.start();
    if (first && Input.hit('KeyG')) { P.gear = !P.gear; a.sfx('switch'); this.updateHud(); }
    let sp = Math.hypot(P.vx, P.vy);
    const auth = clamp(sp / 130, 0.25, 1);
    // ↑ always lifts the nose toward the sky, whichever way you're flying.
    const dirSign = Math.cos(P.a) >= 0 ? 1 : -1;
    P.a = wrap(P.a + ((up ? 1 : 0) - (dn ? 1 : 0)) * dirSign * 2.3 * auth * dt);
    P.th = clamp(P.th + ((more ? 1 : 0) - (less ? 1 : 0)) * 0.8 * dt, 0, 1);
    // Forces: engine pulls along the nose, gravity pulls down, air slows you (more with wheels down).
    const nx = Math.cos(P.a), ny = -Math.sin(P.a), drag = DRAG * (P.gear ? 1.6 : 1);
    P.vx += (nx * THRUST * P.th - drag * sp * P.vx) * dt;
    P.vy += (ny * THRUST * P.th - drag * sp * P.vy + GRAV) * dt;
    // Wings: at good speed the path follows the nose. Too slow and they stop working (stall).
    sp = Math.hypot(P.vx, P.vy); const va = Math.atan2(-P.vy, P.vx);
    const rate = sp > 60 ? Math.min(4, (sp / 120) ** 2 * 2.5) : 0, d = wrap(P.a - va), st = clamp(d, -rate * dt, rate * dt);
    const na = va + st; sp *= 1 - Math.abs(st) * 0.15; P.vx = sp * Math.cos(na); P.vy = -sp * Math.sin(na);
    const wv = 1.8 * (1 - Math.min(1, sp / 140)); P.a = wrap(P.a + clamp(wrap(va - P.a), -wv * dt, wv * dt));   // a slow plane's nose drops
    const stalled = sp < STALL;
    if (stalled && first) { this.stallWarn -= dt * 8; if (this.stallWarn <= 0) { this.stallWarn = 1; a.sfx('warn'); this.tipOnce('stall', 'STALL! Too slow: push the nose down (↓) and add power (→) to get speed back.'); } }
    P.stalled = stalled;
    P.x += P.vx * dt; P.y += P.vy * dt;
    if (P.y < 16) { P.y = 16; P.vy = Math.max(0, P.vy); }
    if ((P.x < 30 && P.vx < 0) || (P.x > PW - 30 && P.vx > 0)) { P.vx = -P.vx; P.a = wrap(Math.PI - P.a); this.tipOnce('edge', 'That is the edge of the battle area, so your plane turned around.'); }
    // The carrier deck: landing (or bouncing back up if it wasn't right).
    const overDeck = P.x > CARRIER.x0 && P.x < CARRIER.x1;
    if (overDeck && P.y + 6 >= DECK && P.vy >= 0) this.tryLanding(sp);
    else if (P.x > TOWER.x0 && P.x < TOWER.x1 && P.y > TOWER.y0) { P.vx = -P.vx * 0.5; P.a = wrap(Math.PI - P.a); P.x += P.vx > 0 ? 6 : -6; a.sfx('bonk'); this.planeHurt(); }
    else if (P.y > SEA - 4) { a.sfx('splash'); this.g.ui.toast('Splash! You touched the water. Back up into the sky.', 2); this.planeHurt(); this.respawnPlane(); }
    this.hidden = this.clouds.some(c => P.x > c.x + 10 && P.x < c.x + c.w - 10 && P.y > c.y + 4 && P.y < c.y + c.h - 4);
    // Guns.
    this.cool -= dt;
    if (Input.key('KeyX', 'KeyK', 'Space') && this.cool <= 0) { this.cool = 0.13; this.pbullets.push({ x: P.x + nx * 20, y: P.y + ny * 20, vx: P.vx + nx * 420, vy: P.vy + ny * 420, life: 0.9 }); a.sfx('gun'); }
    for (const b of this.pbullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      for (const e of this.eplanes) if (e.state === 'fly' && Math.abs(e.x - b.x) < 16 && Math.abs(e.y - b.y) < 8) { b.life = 0; e.hp--; e.hurtT = 0.2; a.sfx('ping');
        if (e.hp <= 0) { e.state = 'down'; this.kills++; this.chutes.push({ x: e.x, y: e.y - 10, t: 0 }); a.sfx('poof'); this.g.ui.toast(this.kills >= KILLS_NEEDED ? 'All 6 enemy planes stopped! Now land on the carrier (follow the arrow).' : `Got one! The pilot parachutes safely down. (${this.kills}/${KILLS_NEEDED})`, 2.5); this.updateHud(); if (this.kills < KILLS_NEEDED) setTimeout(() => this.phase === 'plane' && this.spawnWave(1), 1500); } break; }
    }
    this.pbullets = this.pbullets.filter(b => b.life > 0);
    // Enemy planes.
    for (const e of this.eplanes) {
      e.hurtT = Math.max(0, e.hurtT - dt);
      if (e.state === 'down') { e.a = wrap(e.a + (Math.cos(e.a) > 0 ? -1 : 1) * 1.2 * dt); e.x += Math.cos(e.a) * 110 * dt; e.y += 90 * dt; if (Math.random() < dt * 25) this.smokes.push({ x: e.x, y: e.y, t: 0 }); if (e.y > SEA) { e.gone = true; this.boom(e.x, SEA - 4, 20); a.sfx('splash'); } continue; }
      e.offT -= dt; if (e.offT <= 0) { e.offT = 2.5 + Math.random() * 2; e.off = { x: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80), y: -40 + Math.random() * 80 }; }
      let tx = P.x + e.off.x, ty = P.y + e.off.y; if (this.hidden) { tx = e.x + Math.cos(e.a) * 200; ty = 200; }
      let want = Math.atan2(-(ty - e.y), tx - e.x); if (e.y > SEA - 80) want = Math.cos(e.a) > 0 ? 0.6 : Math.PI - 0.6;
      e.a = wrap(e.a + clamp(wrap(want - e.a), -1.7 * dt, 1.7 * dt));
      e.x = clamp(e.x + Math.cos(e.a) * e.v * dt, 10, PW - 10); e.y = clamp(e.y - Math.sin(e.a) * e.v * dt, 20, SEA - 30);
      e.cool -= dt;
      const toP = Math.atan2(-(P.y - e.y), P.x - e.x), dist = Math.hypot(P.x - e.x, P.y - e.y);
      if (!this.hidden && e.cool <= 0 && dist < 280 && Math.abs(wrap(toP - e.a)) < 0.14) { e.cool = 1.1; this.ebull.push({ x: e.x + Math.cos(e.a) * 18, y: e.y - Math.sin(e.a) * 18, vx: Math.cos(e.a) * 330, vy: -Math.sin(e.a) * 330, life: 1.2 }); a.sfx('enemyshot'); }
      if (dist < 18) { this.planeHurt(); }
    }
    this.eplanes = this.eplanes.filter(e => !e.gone);
    for (const b of this.ebull) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (Math.abs(b.x - P.x) < 14 && Math.abs(b.y - P.y) < 7) { b.life = 0; this.planeHurt(); } }
    this.ebull = this.ebull.filter(b => b.life > 0);
    // Flak from the enemy cruiser: a red ring shows where it will pop.
    if (Math.abs(P.x - FLAK_SHIP) < 420 && P.y < SEA - 40) { this.flakT -= dt; if (this.flakT <= 0) { this.flakT = 1.3; this.flak.push({ x: P.x + P.vx * 0.9, y: P.y + P.vy * 0.9, t: 0.9 }); } }
    for (const f of this.flak) { f.t -= dt; if (f.t <= 0) { f.dead = true; this.boom(f.x, f.y, 24); if (!this.hidden && Math.hypot(P.x - f.x, P.y - f.y) < 28) this.planeHurt(); } }
    this.flak = this.flak.filter(f => !f.dead);
    for (const c of this.chutes) { c.t += dt; c.y = Math.min(SEA - 10, c.y + 22 * dt); c.x += Math.sin(c.t) * 8 * dt; }
    for (const s of this.smokes) s.t += dt; this.smokes = this.smokes.filter(s => s.t < 1.2);
    this.stepFx(dt);
  }
  tryLanding(sp) {
    const P = this.pl, a = this.g.audio;
    const pitch = Math.cos(P.a) >= 0 ? P.a : wrap(Math.PI - P.a);
    let why = null;
    if (this.kills < KILLS_NEEDED) why = `Not yet: enemy planes are still attacking (${this.kills}/${KILLS_NEEDED}). Pull up!`;
    else if (!P.gear) why = 'Wheels up! Press G to put the wheels down, then try again.';
    else if (sp > 150) why = 'Too fast! Use less power (←) and come in slower.';
    else if (pitch > 0.16 || pitch < -0.26) why = 'Too steep! Come down gently with the nose almost level.';
    else if (P.vy > 100) why = 'Dropping too fast! Come down more gently.';
    if (why) { P.y = DECK - 8; P.vy = -Math.max(70, Math.abs(P.vy) * 0.5); P.a = Math.cos(P.a) >= 0 ? 0.25 : Math.PI - 0.25; P.th = Math.max(P.th, 0.8); a.sfx('bonk'); this.g.ui.toast(why, 2.5); return; }
    P.state = 'landed'; P.y = DECK - 6; P.vy = 0; P.a = Math.cos(P.a) >= 0 ? 0 : Math.PI; P.landT = 0; a.sfx('land'); this.g.ui.toast('Touchdown! The hook catches the wire...', 2);
  }
  drawPlane() {
    const g = this.ctx, vw = this.vw, vh = this.vh, P = this.pl, a = this.art;
    const cam = this.planeCam, lead = Math.sign(P.vx) * vw * 0.12;
    cam.x += (clamp(P.x - vw * 0.5 + lead, 0, PW - vw) - cam.x) * 0.12; cam.y += (clamp(P.y - vh * 0.5, 0, SEA + 40 - vh) - cam.y) * 0.12;
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    // Sky gets deeper blue higher up.
    for (let y = 0; y < vh; y += 6) { const h = clamp((y + cy) / SEA, 0, 1); g.fillStyle = `rgb(${Math.round(70 + h * 120)},${Math.round(140 + h * 85)},${Math.round(215 + h * 30)})`; g.fillRect(0, y, vw, 6); }
    // Faraway islands on the horizon.
    const hz = SEA - cy - 2; for (let i = 0; i < 5; i++) { const x = ((i * 260 - cx * 0.1) % (vw + 260) + vw + 260) % (vw + 260) - 130; g.fillStyle = '#5E9A78'; for (let k = 0; k < 60; k++) g.fillRect(Math.round(x + k), Math.round(hz - Math.max(0, 14 - Math.abs(k - 30) * 0.5)), 1, 14); }
    g.save(); g.translate(-cx, -cy);
    // Sea.
    g.fillStyle = '#2E8FB8'; g.fillRect(cx, SEA, vw, 80); g.fillStyle = '#5AB0D3'; g.fillRect(cx, SEA, vw, 2);
    g.fillStyle = '#B8ECF5'; for (let x = cx - (cx % 10); x < cx + vw; x += 10) g.fillRect(x + Math.floor((this.time * 6 + x / 10) % 10), SEA + 5 + (x / 10 % 3) * 4, 4, 1);
    // Ships: the enemy cruiser (flak) and our carrier.
    g.drawImage(a.ship, FLAK_SHIP - 50, SEA - 24);
    g.drawImage(a.carrier, CARRIER.x0 - 20, DECK - 18);
    if (this.kills >= KILLS_NEEDED && P.state !== 'landed') { g.fillStyle = Math.floor(this.time * 3) % 2 ? '#FFD34D' : '#F4F4F0'; for (let x = CARRIER.x0 + 10; x < CARRIER.x0 + 120; x += 18) g.fillRect(x, DECK - 1, 8, 2); }
    // Parachutes, smoke, enemy planes.
    for (const c of this.chutes) g.drawImage(a.parachute, Math.round(c.x) - 8, Math.round(c.y) - 18);
    for (const s of this.smokes) { g.fillStyle = `rgba(90,90,95,${0.5 - s.t * 0.4})`; const r = 3 + s.t * 6; g.fillRect(Math.round(s.x - r), Math.round(s.y - r - s.t * 8), Math.round(r * 2), Math.round(r * 2)); }
    for (const e of this.eplanes) this.drawRotated(g, a.enemyPlane, e.x, e.y, e.a, e.hurtT > 0 && Math.floor(this.time * 30) % 2 ? 0.4 : 1);
    // Liev's plane.
    if (!(this.invuln > 0 && Math.floor(this.time * 20) % 2)) {
      this.drawRotated(g, a.myPlane, P.x, P.y, P.a, 1, (gg) => { gg.fillStyle = '#C9A227'; const pr = Math.floor(this.time * 30) % 2; gg.fillRect(18, -6 + pr * 3, 2, 12 - pr * 6); if (P.gear) { gg.fillStyle = '#2A2A2A'; gg.fillRect(-4, 6, 3, 3); gg.fillRect(4, 6, 3, 3); gg.fillStyle = '#5A5A5A'; gg.fillRect(-3, 4, 1, 2); gg.fillRect(5, 4, 1, 2); } });
    }
    // Bullets, flak warnings, booms.
    g.fillStyle = '#FFE680'; for (const b of this.pbullets) g.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 2);
    g.fillStyle = '#FF9A6B'; for (const b of this.ebull) g.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 1, 4, 3);
    for (const f of this.flak) if (Math.floor(this.time * 10) % 2) { g.strokeStyle = '#E8473D'; g.lineWidth = 1; g.beginPath(); g.arc(Math.round(f.x), Math.round(f.y), 12, 0, Math.PI * 2); g.stroke(); }
    for (const bm of this.booms) this.drawBoom(g, bm);
    // Clouds in front (fly into one to hide).
    for (const c of this.clouds) { if (c.x + c.w < cx || c.x > cx + vw) continue; g.fillStyle = 'rgba(255,255,255,0.88)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.round(c.x + c.w * (0.15 + i * 0.18)), Math.round(c.y + c.h * 0.55 - (i % 2) * c.h * 0.2), Math.round(c.h * 0.55), 0, Math.PI * 2); g.fill(); } }
    g.restore();
    // Instruments: stall warning and the arrow to the carrier.
    if (P.stalled && P.state === 'fly' && Math.floor(this.time * 4) % 2) { g.fillStyle = '#C8302C'; g.fillRect(vw / 2 - 30, 24, 60, 14); g.fillStyle = '#FFFFFF'; g.font = 'bold 10px monospace'; g.fillText('STALL!', vw / 2 - 18, 35); }
    if (this.kills >= KILLS_NEEDED && P.state === 'fly') {
      const tx = (CARRIER.x0 + CARRIER.x1) / 2 - cx, ty = DECK - cy;
      if (tx < 0 || tx > vw || ty > vh) { const ang = Math.atan2(ty - vh / 2, tx - vw / 2), ex = vw / 2 + Math.cos(ang) * (vw / 2 - 20), ey = vh / 2 + Math.sin(ang) * (vh / 2 - 20);
        g.save(); g.translate(ex, ey); g.rotate(ang); g.fillStyle = '#FFD34D'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -7); g.lineTo(-6, 7); g.closePath(); g.fill(); g.restore(); }
    }
    this.drawGauges(g, P);
  }
  drawGauges(g, P) { // a little dashboard: power, speed (red zone = stall), height
    const x = this.vw - 92, y = this.vh - 40, sp = Math.hypot(P.vx, P.vy);
    g.fillStyle = 'rgba(30,34,40,0.75)'; g.fillRect(x, y, 86, 34);
    g.fillStyle = '#FFFFFF'; g.font = '7px monospace'; g.fillText('POWER', x + 4, y + 9); g.fillText('SPEED', x + 4, y + 19); g.fillText(P.gear ? 'WHEELS DN' : 'wheels up', x + 4, y + 30);
    g.fillStyle = '#3A3D45'; g.fillRect(x + 32, y + 4, 50, 6); g.fillRect(x + 32, y + 14, 50, 6);
    g.fillStyle = '#9BE0B5'; g.fillRect(x + 32, y + 4, Math.round(50 * P.th), 6);
    g.fillStyle = 'rgba(200,48,44,0.6)'; g.fillRect(x + 32, y + 14, Math.round(50 * STALL / 260), 6);
    g.fillStyle = sp < STALL ? '#FF6B5A' : '#FFD34D'; g.fillRect(x + 32, y + 14, Math.round(50 * Math.min(1, sp / 260)), 6);
    g.fillStyle = P.gear ? '#9BE0B5' : '#9AA0A8'; g.fillRect(x + 62, y + 25, 20, 6);
  }
  drawRotated(g, img, x, y, ang, alpha = 1, extra) {
    const q = Math.round(ang / (Math.PI / 16)) * (Math.PI / 16);   // 32 directions keeps it looking retro
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(-q); if (Math.cos(q) < 0) g.scale(1, -1); g.globalAlpha = alpha;
    g.drawImage(img, -img.width / 2 | 0, -img.height / 2 | 0); if (extra) extra(g); g.restore();
  }
}
