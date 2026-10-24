// FRANCE, 1944 — a retro pixel action level (Time Door).
// Liev helps the French Resistance: free three captured villagers and reach the
// radio to call for help. Cartoon action for a middle schooler: no blood, no hate
// symbols. Defeated soldiers see stars, then sit down with their hands up.
//
// Built on the retro engine (retro.js), adding: weapons (pistol / rifle /
// grenades, switchable), enemy soldiers, a machine-gun nest, a tank, bombing
// planes, crumbling floors, falling debris, hiding spots and hearts.
import { Input } from './input.js';
import { Retro, RETRO_LEVELS, T, STAND_H, LOW_H, HALF_W, sprite, cv, px } from './retro.js';
import { Records } from './progress.js';
import { rng } from './util.js';

const WEAPONS = ['pistol', 'rifle', 'grenade'];
const WEAPON_INFO = {
  pistol: { label: 'Pistol', icon: '🔫', cool: 0.32, speed: 340, dmg: 1 },
  rifle: { label: 'Rifle', icon: '🎯', cool: 0.6, speed: 520, dmg: 2 },
  grenade: { label: 'Grenades', icon: '💣', cool: 0.7 },
};

// ---------------------------------------------------------------------------
// THE LEVEL. Easy to edit: each line places one thing (x and rows are in tiles).
// ---------------------------------------------------------------------------
RETRO_LEVELS['bbw-door3'] = {
  name: 'France, 1944', place: "Belly Button's World", collectName: 'Medals', war: true, width: 200, height: 15,
  build(L) {
    const GR = 11;
    // A — Countryside: hedgerows, first soldier, crawl under the fallen beam.
    L.ground(0, 96, GR); L.ground(106, 200, GR);
    L.player(3, GR); L.safe(6, GR);
    L.deco('hedge', 0, GR, 2); L.deco('tree', 9, GR); L.deco('hedge', 17, GR, 3);
    L.medals(9, GR - 3, 3); L.hide(13, 'hay'); L.item(15, GR, 'grenades');
    L.soldier(22, GR, 18, 27); L.item(26, GR, 'croissant');
    L.sign(28, GR, 'duck');
    L.wall(30, 0, 4, 8, 'stone'); L.beam(30, 8, 4);                 // 2-tile gap: crawl or slide through
    L.soldier(37, GR, 35, 39);
    // B — The village street: doorways to hide in, a machine-gun nest, crumbling upper floors.
    L.safe(41, GR); L.facade(42, 79);
    L.hide(47, 'door'); L.hide(55, 'door'); L.hide(63, 'door'); L.hide(70, 'door');
    L.item(45, GR, 'ammo'); L.debris(43, 59, 2);
    L.wall(48, 10, 1, 1, 'brick'); L.crumble(49, 7, 4); L.medals(49, 6, 4); L.plat(53, 7, 2, 'wood');   // hop up the rubble
    L.cage(58, GR); L.soldier(60, GR, 57, 66);
    L.sign(64, GR, 'grenade'); L.item(66, GR, 'grenades', true);
    L.sandbags(74, 10, 2, 1); L.mg(77, GR, -1);                  // duck behind the sandbags!
    L.medals(72, GR - 4, 2);
    // C — Bombing raid over the river: keep moving, hide in cellars, don't stand on the old bridge.
    L.safe(83, GR); L.bombZone(84, 122);
    L.hide(87, 'barrel'); L.hide(92, 'door'); L.facade(90, 95);
    L.water(96, 106); L.crumble(96, GR, 10);                        // the old bridge crumbles under your feet
    L.medals(98, GR - 3, 6);
    L.hide(110, 'barrel'); L.hide(117, 'door'); L.facade(115, 121);
    L.soldier(112, GR, 108, 120); L.cage(119, GR); L.item(108, GR, 'croissant');
    // D — The ruined church: platforms, a falling bell tower, soldiers up high.
    L.safe(124, GR); L.debris(127, 143, 1);
    L.wall(127, 9, 1, 2, 'stone'); L.plat(128, 7, 5, 'stone'); L.crumble(134, 5, 4); L.plat(139, 7, 4, 'stone');
    L.medals(134, 4, 4); L.soldier(140, 7, 139, 142); L.item(130, 7, 'ammo');
    L.deco('church', 126, GR); L.hide(146, 'hay');
    L.soldier(150, GR, 147, 156); L.cage(153, GR); L.item(157, GR, 'croissant');
    // E — The tank! Three or four grenades will stop it. Then the barricade opens to the radio.
    L.safe(160, GR); L.item(163, GR, 'grenades', true);
    L.sandbags(169, 10, 2, 1); L.hide(171, 'barrel'); L.sandbags(181, 10, 2, 1); L.hide(183, 'barrel');
    L.tank(178, GR, 165, 187);
    L.barricade(190, 0, GR); L.radio(195, GR);
    L.wall(199, 0, 1, GR, 'stone');
  },
};

// ---------------------------------------------------------------------------
// Pixel art (all drawn in code)
// ---------------------------------------------------------------------------
function hard(g, w, h) { const id = g.getImageData(0, 0, w, h); for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 100 ? 255 : 0; g.putImageData(id, 0, 0); }
function circle(g, x, y, r, col) { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) px(g, x + xx, y + yy, col); }

function makeWarTiles() {
  const t = {};
  const brickish = (seed, base, dark, light, mortar) => { const [c, g] = cv(T, T); const r = rng(seed); px(g, 0, 0, mortar, T, T);
    for (let row = 0; row < 4; row++) { const off = row % 2 ? 4 : 0; for (let x = -off; x < T; x += 8) { px(g, x + 1, row * 4 + 1, base, 7, 3); px(g, x + 1, row * 4 + 1, light, 7, 1); if (r() < 0.3) px(g, x + 2 + Math.floor(r() * 4), row * 4 + 2, dark, 2, 1); } } return c; };
  t.brick = [brickish(1, '#9C5B48', '#6E3B2E', '#B8735E', '#5A4A42'), brickish(2, '#93543F', '#6E3B2E', '#B06C57', '#5A4A42')];
  t.stone = [brickish(3, '#B9AE9C', '#8C8270', '#D3C9B8', '#6F6758'), brickish(4, '#B2A794', '#8C8270', '#CEC3B1', '#6F6758')];
  { const [c, g] = cv(T, T); const r = rng(5); px(g, 0, 0, '#5C5F66', T, T);   // cobblestone street top
    for (let i = 0; i < 7; i++) { const x = Math.floor(r() * 12), y = 1 + Math.floor(r() * 5); px(g, x, y, '#8A8E96', 4, 3); px(g, x, y, '#A4A8B0', 4, 1); }
    px(g, 0, 7, '#6E5640', T, 9); for (let i = 0; i < 8; i++) px(g, Math.floor(r() * 16), 8 + Math.floor(r() * 8), '#54402E', 2, 1); t.cobble = c; }
  { const [c, g] = cv(T, T); const r = rng(6); px(g, 0, 0, '#6E5640', T, T); for (let i = 0; i < 10; i++) px(g, Math.floor(r() * 16), Math.floor(r() * 16), r() < 0.5 ? '#54402E' : '#806650', 2, 1); t.earth = c; }
  { const [c, g] = cv(T, T); px(g, 0, 0, '#8B5A2B', T, T); px(g, 0, 0, '#A9733C', T, 2); px(g, 0, 14, '#5A3A1A', T, 2); for (let x = 3; x < T; x += 7) px(g, x, 4, '#6B4220', 1, 8); t.wood = c; }
  { const [c, g] = cv(T, T); px(g, 0, 0, '#6B4423', T, T); px(g, 0, 2, '#8B5A2B', T, 4); px(g, 0, 10, '#4A2C14', T, 3); px(g, 0, 0, '#3A2210', T, 1); px(g, 0, 15, '#3A2210', T, 1); t.beam = c; }
  { const [c, g] = cv(T, T); const r = rng(7); g.drawImage(t.brick[0], 0, 0);    // crumbling bricks: cracks and gaps
    for (let i = 0; i < 4; i++) { let x = Math.floor(r() * 16), y = 0; for (let k = 0; k < 8; k++) { px(g, x, y, '#2A211C', 1, 2); x += Math.floor(r() * 3) - 1; y += 2; } }
    px(g, 3, 12, 'rgba(0,0,0,0)', 4, 4); g.clearRect(3, 13, 4, 3); g.clearRect(11, 0, 3, 2); t.crumble = c; }
  { const [c, g] = cv(T, T); px(g, 0, 0, '#4A4030', T, T); // sandbags
    for (let row = 0; row < 2; row++) for (let i = 0; i < 2; i++) { const x = i * 8 + (row ? 4 : 0) - (row ? 8 : 0); for (const xx of [x, x + 16]) { px(g, xx + 1, row * 8 + 1, '#C2A878', 7, 6); px(g, xx + 1, row * 8 + 1, '#D8C190', 7, 2); px(g, xx + 1, row * 8 + 6, '#9C8458', 7, 1); } } t.sandbag = c; }
  { const [c, g] = cv(T, T); px(g, 0, 0, '#7A4A22', T, T); for (let x = 0; x < T; x += 5) px(g, x, 0, '#5A3418', 2, T); px(g, 0, 2, '#3A3A3A', T, 2); px(g, 0, 11, '#3A3A3A', T, 2); // barricade planks + wire
    for (let x = 0; x < T; x += 4) px(g, x, 6, '#9AA0A8', 2, 1); t.gate = c; }
  return t;
}

function makeWarArt() {
  const a = {};
  // --- Enemy soldier (side view, facing right; plain grey uniform, no symbols) ---
  const W = 36, H = 50, OX = 14;
  const soldier = (pose) => {
    const [c, g] = cv(W, H);
    const U = '#6E7559', Ud = '#575D46', Ul = '#848B6E', S = '#E8B796', Sd = '#C9946F', HL = '#55604B', HLl = '#6E7A62', HLd = '#3E4637', B = '#1F1D1A', BLT = '#2A2620';
    const sit = pose === 'surrender';
    const dy = sit ? 12 : 0;
    // legs
    const legs = { walk0: [[-3, 0], [3, 0]], walk1: [[-1, 0], [1, 0]], walk2: [[3, 0], [-3, 0]], walk3: [[1, 0], [-1, 0]] }[pose] || [[-2, 0], [2, 0]];
    if (!sit) {
      legs.forEach(([o], i) => { const col = i ? Ud : U; px(g, OX - 3 + o, 33, col, 6, 12); px(g, OX - 3 + o, 44, B, 7, 6); px(g, OX - 3 + o + 5, 46, B, 3, 4); });
    } else { px(g, OX - 4, 40, U, 16, 6); px(g, OX + 10, 40, B, 5, 8); }
    // torso
    px(g, OX - 5, 18 + dy, U, 12, 15); px(g, OX - 5, 18 + dy, Ul, 12, 2); px(g, OX - 5, 30 + dy, BLT, 12, 2); px(g, OX + 2, 31 + dy, '#8C8270', 2, 1);
    px(g, OX - 4, 22 + dy, Ud, 3, 4); px(g, OX + 3, 22 + dy, Ud, 3, 4); // pockets
    // head + helmet (rounded, plain)
    px(g, OX - 2, 9 + dy, S, 8, 9); px(g, OX + 5, 12 + dy, Sd, 1, 3); px(g, OX + 3, 12 + dy, '#2A1C14', 1, 1); px(g, OX - 1, 12 + dy, Sd, 2, 3);
    px(g, OX - 4, 3 + dy, HL, 12, 6); px(g, OX - 3, 1 + dy, HL, 10, 2); px(g, OX - 1, 0 + dy, HL, 6, 1); px(g, OX - 2, 2 + dy, HLl, 6, 1); px(g, OX - 5, 8 + dy, HLd, 14, 2);
    // arms + rifle
    if (sit) { px(g, OX - 7, 6 + dy - 4, S, 3, 3); px(g, OX + 8, 6 + dy - 4, S, 3, 3); px(g, OX - 7, 9 + dy - 4, U, 3, 12); px(g, OX + 8, 9 + dy - 4, U, 3, 12); }
    else if (pose === 'aim' || pose === 'fire') {
      px(g, OX - 1, 21, U, 13, 4); px(g, OX + 11, 21, S, 3, 3);                                   // arms forward
      px(g, OX - 6, 21, '#6B4423', 9, 3); px(g, OX + 2, 21, '#2A2A2A', 18, 2); px(g, OX + 3, 23, '#6B4423', 6, 1);
      if (pose === 'fire') { px(g, OX + 20, 19, '#FFF3A0', 4, 5); px(g, OX + 24, 21, '#FFD34D', 3, 2); }
    } else {
      px(g, OX - 1, 19, U, 4, 11); px(g, OX - 1, 29, S, 3, 3);                                    // arm down
      for (let i = 0; i < 14; i++) px(g, OX - 6 + i, 31 - i, i < 6 ? '#6B4423' : '#2A2A2A', 2, 2); // rifle carried across
    }
    hard(g, W, H); return c;
  };
  a.soldier = { walk: ['walk0', 'walk1', 'walk2', 'walk3'].map(soldier), stand: soldier('stand'), aim: soldier('aim'), fire: soldier('fire'), surrender: soldier('surrender'), ox: OX, w: W, h: H };
  // Machine gun on a little stand.
  { const [c, g] = cv(26, 10); px(g, 0, 2, '#2A2A2A', 22, 3); px(g, 6, 0, '#3A3A3A', 8, 6); px(g, 20, 1, '#2A2A2A', 6, 2); px(g, 8, 6, '#3A3A3A', 1, 4); px(g, 13, 6, '#3A3A3A', 1, 4); a.mg = c; }
  // Tank (plain olive-grey, no markings).
  const tank = (broken) => { const [c, g] = cv(108, 54);
    const Hc = broken ? '#4A4E44' : '#59654C', Hd = broken ? '#383B33' : '#46503C', Hl = broken ? '#5A5E54' : '#6E7A60';
    px(g, 6, 36, '#2B2B28', 96, 16); for (let x = 10; x < 100; x += 13) { circle(g, x + 5, 44, 5, '#6B6B60'); circle(g, x + 5, 44, 2, '#3A3A35'); }
    px(g, 4, 26, Hc, 100, 11); px(g, 4, 26, Hl, 100, 2); px(g, 0, 30, Hd, 6, 7); px(g, 102, 30, Hd, 6, 7);
    px(g, 30, 12, Hc, 44, 15); px(g, 32, 10, Hc, 40, 3); px(g, 30, 12, Hl, 44, 2); px(g, 44, 6, Hd, 14, 5); // turret + hatch
    if (!broken) { px(g, 74, 17, '#3E4637', 34, 4); px(g, 104, 16, '#2A2A2A', 4, 6); } else { px(g, 74, 20, '#3E4637', 26, 4); px(g, 98, 23, '#3E4637', 4, 4); }
    return c; };
  a.tank = tank(false); a.tankBroken = tank(true);
  // Plane (grey, side view).
  { const [c, g] = cv(64, 20); px(g, 4, 8, '#7B8088', 50, 6); px(g, 52, 9, '#666B72', 8, 4); px(g, 0, 4, '#666B72', 8, 6); px(g, 20, 13, '#5E636B', 24, 3); px(g, 24, 5, '#5E636B', 16, 3); px(g, 46, 9, '#B9C3CF', 4, 2); px(g, 60, 4, '#9AA0A8', 2, 13); a.plane = c; }
  { const [c, g] = cv(6, 11); px(g, 1, 0, '#2A2A2A', 4, 3); px(g, 0, 1, '#3A3A3A', 6, 1); px(g, 1, 3, '#4A4A4A', 4, 7); px(g, 2, 9, '#2A2A2A', 2, 2); a.bomb = c; }
  { const [c, g] = cv(7, 8); circle(g, 3, 4, 3, '#4E5F3A'); px(g, 2, 0, '#8C8270', 3, 2); px(g, 1, 3, '#6E7F52', 2, 2); a.grenade = c; }
  // Liev's weapons (drawn in his hand when he fires).
  { const [c, g] = cv(12, 7); px(g, 0, 0, '#2A2A2A', 11, 3); px(g, 0, 3, '#5A3A22', 4, 4); px(g, 10, 0, '#4A4A4A', 2, 2); a.pistol = c; }
  { const [c, g] = cv(30, 7); px(g, 0, 2, '#6B4423', 12, 4); px(g, 10, 2, '#5A3A22', 6, 2); px(g, 12, 1, '#2A2A2A', 18, 2); px(g, 14, 3, '#2A2A2A', 4, 2); a.rifle = c; }
  // Villager (beret + striped shirt) and cage.
  const villager = (happy) => { const [c, g] = cv(22, 44); const S = '#E8B796';
    px(g, 7, 6, S, 8, 9); px(g, 6, 3, '#2A2A35', 10, 4); px(g, 13, 2, '#2A2A35', 2, 2); px(g, 12, 9, '#2A1C14', 1, 1); if (happy) px(g, 10, 12, '#A9544F', 4, 1);
    for (let y = 15; y < 29; y++) px(g, 5, y, y % 3 ? '#F4F4F0' : '#2347C4', 12, 1); px(g, 5, 29, '#3A3D45', 12, 9); px(g, 5, 38, '#3A2A20', 5, 6); px(g, 12, 38, '#3A2A20', 5, 6);
    if (happy) { px(g, 1, 6, S, 3, 3); px(g, 18, 6, S, 3, 3); px(g, 2, 9, '#F4F4F0', 3, 8); px(g, 17, 9, '#F4F4F0', 3, 8); } else { px(g, 3, 17, '#F4F4F0', 3, 9); px(g, 16, 17, '#F4F4F0', 3, 9); }
    hard(g, 22, 44); return c; };
  a.villager = villager(false); a.villagerHappy = villager(true);
  { const [c, g] = cv(32, 50); px(g, 0, 0, '#5A3A1A', 32, 4); px(g, 0, 46, '#5A3A1A', 32, 4); for (let x = 1; x < 32; x += 6) px(g, x, 4, '#7A4A22', 3, 42); px(g, 20, 22, '#C9A227', 6, 6); px(g, 22, 24, '#5A3A1A', 2, 2); a.cage = c; }
  { const [c, g] = cv(32, 50); px(g, 0, 46, '#5A3A1A', 32, 4); for (let x = 1; x < 8; x += 6) px(g, x, 10, '#7A4A22', 3, 36); px(g, 26, 14, '#7A4A22', 3, 32); a.cageOpen = c; }
  // Safe house: a cellar door with a lantern.
  { const [c, g] = cv(36, 40); px(g, 0, 8, '#8C8270', 36, 32); px(g, 0, 8, '#A39A88', 36, 2); px(g, 4, 0, '#6B4423', 28, 9); px(g, 2, 6, '#5A3A1A', 32, 3);
    px(g, 10, 16, '#5A3A1A', 16, 24); px(g, 11, 17, '#8B5A2B', 14, 23); px(g, 18, 17, '#5A3A1A', 1, 23); px(g, 22, 28, '#C9A227', 2, 2); px(g, 29, 14, '#3A3A3A', 4, 6); px(g, 30, 15, '#FFD98A', 2, 4); a.safe = c; }
  // Radio station.
  { const [c, g] = cv(34, 44); px(g, 2, 26, '#8B5A2B', 30, 3); px(g, 4, 29, '#6B4423', 3, 15); px(g, 27, 29, '#6B4423', 3, 15);
    px(g, 6, 12, '#4E5F3A', 22, 14); px(g, 6, 12, '#6E7F52', 22, 2); circle(g, 12, 19, 3, '#2A2A2A'); circle(g, 22, 19, 3, '#2A2A2A'); px(g, 15, 23, '#FFD34D', 4, 2); px(g, 25, 0, '#9AA0A8', 1, 12); px(g, 23, 0, '#C8473D', 5, 2); a.radio = c; }
  // Medal with a blue-white-red ribbon.
  { const [c, g] = cv(10, 15); px(g, 2, 0, '#2347C4', 2, 6); px(g, 4, 0, '#F4F4F0', 2, 6); px(g, 6, 0, '#C8473D', 2, 6); circle(g, 5, 10, 4, '#B5651D'); circle(g, 5, 10, 3, '#FFD34D'); px(g, 4, 9, '#FFF6C4', 2, 1); a.medal = c; }
  { const [c, g] = cv(16, 10); for (let i = 0; i < 5; i++) { const w = 4 + (i === 2 ? 4 : i % 2 ? 2 : 0); px(g, 1 + i * 3, 5 - (i === 2 ? 3 : i % 2 ? 2 : 0), '#D9A35B', 3, w); } px(g, 2, 7, '#B5651D', 12, 2); a.croissant = c; }
  { const [c, g] = cv(16, 11); px(g, 0, 2, '#4E5F3A', 16, 9); px(g, 0, 2, '#6E7F52', 16, 2); px(g, 3, 4, '#C9A227', 2, 5); px(g, 7, 4, '#C9A227', 2, 5); px(g, 11, 4, '#C9A227', 2, 5); a.ammo = c; }
  { const [c, g] = cv(16, 11); px(g, 0, 2, '#6B4423', 16, 9); px(g, 0, 2, '#8B5A2B', 16, 2); g.drawImage(a.grenade, 4, 3); a.grenades = c; }
  // Hiding spots.
  { const [c, g] = cv(34, 26); for (let y = 0; y < 26; y++) { const half = Math.min(16, 6 + y); px(g, 17 - half, y, y % 4 ? '#D9B85C' : '#C49E45', half * 2, 1); } for (let i = 0; i < 20; i++) px(g, (i * 7) % 32, (i * 5) % 24, '#F2D27A', 2, 1); a.hay = c; }
  { const [c, g] = cv(18, 22); px(g, 1, 0, '#7A4A22', 16, 22); px(g, 0, 3, '#5A3418', 18, 2); px(g, 0, 16, '#5A3418', 18, 2); px(g, 3, 0, '#9C6232', 2, 22); a.barrel = c; }
  { const [c, g] = cv(22, 36); px(g, 0, 0, '#8C8270', 22, 36); px(g, 3, 4, '#1E1A18', 16, 32); px(g, 4, 3, '#1E1A18', 14, 1); px(g, 6, 2, '#1E1A18', 10, 1); a.door = c; }
  // Signs with pictures.
  const sign = (draw) => { const [c, g] = cv(26, 30); px(g, 11, 14, '#7A4A22', 4, 16); px(g, 0, 0, '#5A3A10', 26, 16); px(g, 1, 1, '#E9C98F', 24, 14); draw(g); return c; };
  const key = (g, x, y, ch) => { px(g, x, y, '#3A3D45', 8, 8); g.fillStyle = '#FFFFFF'; g.font = 'bold 7px monospace'; g.fillText(ch, x + 2, y + 7); };
  a.sign_duck = sign((g) => { key(g, 3, 4, '↓'); px(g, 13, 5, '#6B4423', 10, 2); px(g, 14, 10, '#3A3D45', 8, 3); });
  a.sign_grenade = sign((g) => { key(g, 3, 4, '3'); g.drawImage(a.grenade, 14, 4); px(g, 13, 12, '#C8473D', 9, 1); });
  // Decorations.
  { const [c, g] = cv(32, 22); for (let i = 0; i < 5; i++) circle(g, 4 + i * 6, 12 + (i % 2) * 2, 7, i % 2 ? '#3F5A3A' : '#4A6A42'); for (let i = 0; i < 12; i++) px(g, (i * 9) % 30, 6 + (i * 5) % 12, '#5E7E54', 2, 2); hard(g, 32, 22); a.hedge = c; }
  { const [c, g] = cv(48, 64); px(g, 21, 34, '#5A3A1A', 7, 30); circle(g, 24, 22, 15, '#3F5A3A'); circle(g, 14, 28, 10, '#3F5A3A'); circle(g, 34, 28, 10, '#3F5A3A'); circle(g, 22, 18, 10, '#4A6A42'); a.tree = c; }
  { const [c, g] = cv(80, 130); // ruined church with a broken bell tower
    px(g, 10, 50, '#B2A794', 60, 80); px(g, 26, 10, '#B2A794', 22, 50); px(g, 30, 0, '#B2A794', 8, 12); px(g, 33, -2, '#8C8270', 2, 4);
    px(g, 31, 20, '#2A2622', 12, 16); circle(g, 37, 20, 6, '#2A2622'); px(g, 20, 70, '#2A2622', 10, 20); circle(g, 25, 70, 5, '#2A2622'); px(g, 50, 70, '#2A2622', 10, 20); circle(g, 55, 70, 5, '#2A2622');
    g.clearRect(62, 50, 8, 18); g.clearRect(56, 50, 6, 8); g.clearRect(44, 10, 4, 8); for (let i = 0; i < 30; i++) px(g, 10 + (i * 13) % 60, 50 + (i * 7) % 80, '#9C9282', 3, 1); a.church = c; }
  return a;
}

function makeWarBackground() {
  const Wd = 512, H = 270, L = {};
  { const [c, g] = cv(4, H); ['#5C6478', '#69708A', '#7A7F95', '#8E8E9C', '#A39A98', '#B9A593', '#CBA98A', '#D9AE86'].forEach((col, i) => px(g, 0, i * 24, col, 4, 24)); px(g, 0, 192, '#DDB38A', 4, H); L.sky = c; }
  { const [c, g] = cv(Wd, H); const r = rng(31); // ruined rooftops far away
    let x = 0; while (x < Wd) { const w = 20 + Math.floor(r() * 40), h = 30 + Math.floor(r() * 50); px(g, x, 214 - h, '#4E5266', w, h + 60);
      if (r() < 0.5) { for (let i = 0; i < w; i++) px(g, x + i, 214 - h - Math.max(0, 10 - Math.abs(i - w / 2)), '#4E5266', 1, 10); }   // pointed roof
      if (r() < 0.4) g.clearRect(x + Math.floor(w * 0.6), 214 - h, Math.floor(w * 0.4), Math.floor(h * 0.4));                          // broken corner
      for (let k = 0; k < 4; k++) if (r() < 0.6) px(g, x + 4 + Math.floor(r() * (w - 8)), 214 - h + 8 + Math.floor(r() * (h - 16)), '#2E3140', 3, 4);
      x += w + Math.floor(r() * 10); }
    px(g, 300, 120, '#4E5266', 10, 100); for (let i = 0; i < 12; i++) px(g, 305 - Math.floor(i * 0.5), 108 + i, '#4E5266', i + 1, 1); L.far = c; }
  { const [c, g] = cv(Wd, H); const r = rng(32); px(g, 0, 222, '#3F4A3A', Wd, H - 222);   // hedgerows
    for (let x = 0; x < Wd; x += 10) { const h = 8 + Math.floor(r() * 14); circle(g, x + 5, 222 - h / 2, Math.floor(h / 2) + 3, r() < 0.5 ? '#3F4A3A' : '#46553F'); } L.hedge = c; }
  return L;
}

// ---------------------------------------------------------------------------
export class RetroWar extends Retro {
  constructor(game) {
    super(game);
    this.combat = true; this.canvas.id = 'pixel-war';
    this.notLievText = 'Liev takes this mission. Belly Button is waiting safely back home!';
    this.wtiles = makeWarTiles(); this.art = makeWarArt(); this.wbg = makeWarBackground();
    this.hintText = 'X fires · Q (or 1 2 3) switches weapon · ↓ ducks, and hides you in doorways, hay and barrels · E opens cages · stop on a safe house to heal!';
  }
  enter(opts) {
    this.warReady = false;
    super.enter(opts);
    this.hearts = 3; this.invuln = 0; this.weapon = 'pistol'; this.ammo = { pistol: Infinity, rifle: 12, grenade: 3 }; this.cool = 0;
    this.bullets = []; this.ebullets = []; this.grenadesLive = []; this.booms = []; this.bombs = []; this.shells = []; this.rocks = []; this.plane = null; this.planeT = 1.5;
    this.rescued = 0; this.captured = 0; this.hidden = false; this.damageTaken = 0;
    this.warReady = true;
    this.g.audio.music('war');
    // An old photo coming to life: start in sepia, warm up to color.
    this.canvas.style.transition = 'none'; this.canvas.style.filter = 'sepia(1)';
    setTimeout(() => { this.canvas.style.transition = 'filter 3s ease'; this.canvas.style.filter = 'sepia(0.18)'; }, 60);
    this.g.ui.toast('France, 1944. Help the Resistance: free 3 villagers and reach the radio!', 5);
    this.updateHud();
  }
  exit() { super.exit(); this.canvas.style.filter = ''; this.canvas.style.transition = ''; }

  // ---------- Building the level ----------
  buildLevel() {
    const d = this.def, W = d.width, H = d.height; this.W = W; this.H = H;
    const grid = this.grid = Array.from({ length: H }, () => new Array(W).fill(null));
    const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = v; };
    Object.assign(this, { stars: [], decos: [], waters: [], qboxes: [], crates: [], restSpots: [], signs: [], gateCells: [], ballStart: null, goalRect: null, friend: null, stampPos: null, gateOpen: false });
    this.enemies = []; this.hides = []; this.items = []; this.cages = []; this.facades = []; this.bombZones = []; this.debrisZones = []; this.crumbles = new Map(); this.tankDef = null;
    const L = {
      ground: (x0, x1, row) => { for (let x = x0; x < x1; x++) for (let y = row; y < H; y++) set(x, y, y === row ? 'cobble' : 'earth'); },
      wall: (x, row, w, h, kind) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, row + j, kind); },
      plat: (x, row, len, kind) => { for (let i = 0; i < len; i++) set(x + i, row, kind); },
      beam: (x, row, len) => { for (let i = 0; i < len; i++) set(x + i, row, 'beam'); },
      crumble: (x, row, len) => { for (let i = 0; i < len; i++) { set(x + i, row, 'crumble'); this.crumbles.set((x + i) + ',' + row, { x: x + i, y: row, state: 'solid', t: 0 }); } },
      sandbags: (x, row, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, row + j, 'sandbag'); },
      water: (x0, x1) => { this.waters.push([x0, x1]); for (let x = x0; x < x1; x++) for (let y = 11; y < H; y++) set(x, y, null); },
      medals: (x, row, n) => { for (let i = 0; i < n; i++) this.stars.push({ x: (x + i) * T + 8, y: row * T + 8 }); },
      deco: (kind, x, row, n = 1) => { for (let i = 0; i < n; i++) this.decos.push({ kind, x: (x + i) * T, y: row * T }); },
      sign: (x, row, kind) => this.signs.push({ kind, x: x * T, y: row * T }),
      hide: (x, kind) => this.hides.push({ kind, x: x * T + 8, y: 11 * T }),
      facade: (x0, x1) => this.facades.push([x0, x1]),
      item: (x, row, kind, respawn = false) => this.items.push({ kind, x: x * T + 8, y: row * T, taken: false, respawn, t: 0 }),
      soldier: (x, row, x0, x1) => this.enemies.push({ type: 'soldier', x: x * T + 8, y: row * T, x0: x0 * T + 8, x1: x1 * T + 8, face: -1, state: 'patrol', t: 0, hp: 2, hurtT: 0, walkT: 0 }),
      mg: (x, row, face) => this.enemies.push({ type: 'mg', x: x * T + 8, y: row * T, face, state: 'watch', t: 0, hp: 1, hurtT: 0, burst: 0 }),
      tank: (x, row, x0, x1) => { this.tankDef = { x: x * T, y: row * T, x0: x0 * T, x1: x1 * T }; },
      bombZone: (x0, x1) => this.bombZones.push([x0 * T, x1 * T]),
      debris: (x0, x1, ceilRow) => this.debrisZones.push({ x0: x0 * T, x1: x1 * T, y: ceilRow * T, t: 1 }),
      cage: (x, row) => this.cages.push({ x: x * T + 8, y: row * T, open: false, runT: 0 }),
      safe: (x, row) => this.restSpots.push({ x: x * T + 8, y: row * T, kind: 'safe' }),
      barricade: (x, row0, row1) => { for (let y = row0; y < row1; y++) { set(x, y, 'gate'); this.gateCells.push([x, y]); } },
      radio: (x, row) => { this.stampPos = { x: x * T + 8, y: row * T }; },
      player: (x, row) => { this.start = { x: x * T + 8, y: row * T }; },
    };
    d.build(L);
    this.ball = null; this.gateY = 0;
    this.totalStars = this.stars.length;
    const td = this.tankDef;
    this.tank = td ? { x: td.x, y: td.y, x0: td.x0, x1: td.x1, face: -1, hp: 4, maxHp: 4, t: 1.5, state: 'drive', hurtT: 0, crewT: 0 } : null;
  }

  // ---------- Controls that only this level has ----------
  preStep(dt, first, ax, down) {
    const p = this.p, a = this.g.audio;
    if (first) {
      if (Input.hit('KeyQ')) { this.weapon = WEAPONS[(WEAPONS.indexOf(this.weapon) + 1) % 3]; a.sfx('switch'); this.updateHud(); }
      ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (Input.hit(k)) { this.weapon = WEAPONS[i]; a.sfx('switch'); this.updateHud(); } });
    }
    // Hiding: stand still in a doorway / behind hay / behind a barrel and press ↓.
    const spot = this.hides.find(h => Math.abs(h.x - p.x) < 11 && Math.abs(h.y - p.y) < 2);
    if (this.hidden && (ax.x || Input.hit('Space', 'ArrowUp', 'KeyW', 'KeyX') || !spot)) { this.hidden = false; this.updateHud(); }
    if (!this.hidden && spot && down && p.onGround && Math.abs(p.vx) < 30 && !p.sliding && first && Input.hit('ArrowDown', 'KeyS')) { this.hidden = true; p.vx = 0; a.sfx('ui'); this.updateHud(); }
    if (this.hidden) { p.vx = 0; p.ducking = false; p.h = STAND_H; this.combatStep(dt, first, ax, down); return true; }
    // Attacks.
    this.cool -= dt;
    if (first && Input.hit('KeyX', 'KeyK') && this.cool <= 0 && !p.sliding && !p.ducking && !p.action) this.attack();
    if (first && Input.hit('KeyZ', 'KeyJ') && !p.action && p.onGround && !p.sliding) { p.action = 'punch'; p.actT = 0; p.hitDone = false; p.punchHit = false; }
    if (p.action === 'fire' || p.action === 'throw') { p.actT += dt; if (p.actT > (p.action === 'fire' ? 0.2 : 0.35)) p.action = null; }
    return false;
  }
  attack() {
    const p = this.p, a = this.g.audio, w = this.weapon;
    if (w !== 'pistol' && this.ammo[w] <= 0) { this.g.ui.toast(w === 'rifle' ? 'Out of rifle bullets! Find an ammo box, or switch to the pistol (1).' : 'No grenades left! Look for a grenade box.', 2.2); a.sfx('bonk'); this.cool = 0.3; return; }
    if (w !== 'pistol') this.ammo[w]--;
    this.cool = WEAPON_INFO[w].cool;
    const hx = p.x + p.face * 21, hy = p.y - 30;
    if (w === 'grenade') {
      p.action = 'throw'; p.actT = 0;
      this.grenadesLive.push({ x: hx, y: hy - 4, vx: p.face * 150 + p.vx * 0.4, vy: -200, fuse: 1.1, spin: 0 });
      a.sfx('jump');
    } else {
      p.action = 'fire'; p.actT = 0;
      const info = WEAPON_INFO[w];
      this.bullets.push({ x: hx + p.face * (w === 'rifle' ? 14 : 6), y: hy + 1, vx: p.face * info.speed, dmg: info.dmg, life: 1.2 });
      this.fx.push({ kind: 'flash', x: hx + p.face * (w === 'rifle' ? 22 : 10), y: hy + 1, t: 0, face: p.face });
      a.sfx(w === 'rifle' ? 'rifle' : 'shot');
    }
    this.updateHud();
  }

  // ---------- Everything that moves or fights ----------
  combatStep(dt, first, ax) {
    const p = this.p, a = this.g.audio;
    if (!this.warReady) return;
    this.invuln = Math.max(0, this.invuln - dt);
    // Punch: also bonks soldiers right in front of you.
    if (p.action === 'punch' && !p.punchHit && p.actT > 3 / 16) {
      p.punchHit = true;
      for (const e of this.enemies) if (e.type === 'soldier' && e.state !== 'out' && e.state !== 'dizzy' && Math.abs(e.y - p.y) < 20 && (e.x - p.x) * p.face > 0 && Math.abs(e.x - p.x) < 28) this.damageEnemy(e, 1);
    }
    // Liev's bullets.
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.life -= dt;
      if (this.solidAt(b.x, b.y)) { b.life = 0; this.fx.push({ kind: 'spark', x: b.x, y: b.y, t: 0 }); continue; }
      for (const e of this.enemies) {
        if (e.state === 'out' || e.state === 'dizzy') continue;
        if (e.type === 'soldier' && Math.abs(b.x - e.x) < 9 && b.y > e.y - 46 && b.y < e.y) { this.damageEnemy(e, b.dmg); b.life = 0; break; }
        if (e.type === 'mg' && Math.abs(b.x - e.x) < 12 && b.y > e.y - 46 && b.y < e.y) { b.life = 0; this.fx.push({ kind: 'spark', x: b.x, y: b.y, t: 0 }); a.sfx('ping'); this.tipOnce('mg', 'The sandbags protect him. Try a grenade (press 3)!'); break; }
      }
      const tk = this.tank;
      if (b.life > 0 && tk && tk.state === 'drive' && b.x > tk.x && b.x < tk.x + 108 && b.y > tk.y - 50 && b.y < tk.y) { b.life = 0; this.fx.push({ kind: 'spark', x: b.x, y: b.y, t: 0 }); a.sfx('ping'); this.tipOnce('tank', 'Bullets just bounce off the tank. Grenades will stop it!'); }
    }
    this.bullets = this.bullets.filter(b => b.life > 0);
    // Grenades: arc, bounce, then go BOOM.
    for (const gr of this.grenadesLive) {
      gr.vy += 900 * dt; gr.spin += dt * 12;
      const nx = gr.x + gr.vx * dt; if (this.solidAt(nx, gr.y)) gr.vx *= -0.4; else gr.x = nx;
      const ny = gr.y + gr.vy * dt; if (this.solidAt(gr.x, ny + 3)) { gr.vy *= -0.3; gr.vx *= 0.5; gr.rolling = true; } else gr.y = ny;
      if (gr.rolling) gr.vx *= Math.exp(-5 * dt);
      // Hitting a soldier, the gunner or the tank sets it off right away.
      if (this.enemies.some(e => e.state !== 'out' && e.state !== 'dizzy' && Math.abs(gr.x - e.x) < 14 && gr.y > e.y - 56 && gr.y < e.y + 2)) gr.fuse = 0;
      const tk = this.tank; if (tk && tk.state === 'drive' && gr.x > tk.x && gr.x < tk.x + 108 && gr.y > tk.y - 54) gr.fuse = 0;
      gr.fuse -= dt; if (gr.fuse <= 0) { this.explode(gr.x, gr.y, 38, 'grenade'); gr.dead = true; }
      if (gr.y > this.H * T + 20) gr.dead = true;
    }
    this.grenadesLive = this.grenadesLive.filter(g => !g.dead);
    // Enemy bullets (slow enough to see and duck under).
    for (const b of this.ebullets) {
      b.x += b.vx * dt; b.life -= dt;
      if (this.solidAt(b.x, b.y)) { b.life = 0; this.fx.push({ kind: 'spark', x: b.x, y: b.y, t: 0 }); continue; }
      if (!this.hidden && Math.abs(b.x - p.x) < HALF_W + 2 && b.y > p.y - p.h && b.y < p.y) { b.life = 0; this.hurt(Math.sign(b.vx)); }
    }
    this.ebullets = this.ebullets.filter(b => b.life > 0);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    if (this.tank) this.updateTank(dt);
    this.updateShells(dt);
    this.updateBombing(dt);
    this.updateDebris(dt);
    this.updateCrumbles(dt);
    for (const bm of this.booms) bm.t += dt; this.booms = this.booms.filter(b => b.t < 0.7);
    // Pickups.
    for (const it of this.items) {
      if (it.taken) { if (it.respawn) { it.t -= dt; if (it.t <= 0 && this.ammo.grenade < 3) it.taken = false; } continue; }
      if (Math.abs(it.x - p.x) < 14 && Math.abs(it.y - p.y) < 20) {
        it.taken = true; it.t = 6; a.sfx('pickup');
        if (it.kind === 'croissant') { this.hearts = Math.min(3, this.hearts + 1); this.g.ui.toast('🥐 A warm croissant! +1 heart', 1.6); }
        if (it.kind === 'ammo') { this.ammo.rifle += 8; this.g.ui.toast('🎯 +8 rifle bullets', 1.6); }
        if (it.kind === 'grenades') { this.ammo.grenade = Math.min(9, this.ammo.grenade + 3); this.g.ui.toast('💣 +3 grenades', 1.6); }
        this.updateHud();
      }
    }
    // Cages: press E to set a villager free.
    let near = null;
    for (const c of this.cages) { if (c.open) { c.runT += dt; continue; } if (Math.abs(c.x - p.x) < 22 && Math.abs(c.y - p.y) < 4) near = c; }
    this.g.ui.prompt(near ? 'Open the cage' : null);
    if (near && first && Input.hit('KeyE')) { near.open = true; this.rescued++; a.sfx('cage'); this.g.ui.toast(`"Merci, Liev!" Villager freed (${this.rescued}/3)`, 2.5); this.updateHud(); }
    // Barricade opens when the tank is stopped.
    if (this.tank && this.tank.state === 'broken' && !this.gateOpen) { this.gateOpen = true; a.sfx('hit'); this.g.ui.toast('The barricade is open. Run to the radio!', 3); }
    if (Math.floor(this.time * 4) !== this._hudTick) { this._hudTick = Math.floor(this.time * 4); }
  }

  tipOnce(key, text) { this._tips = this._tips || {}; if (!this._tips[key]) { this._tips[key] = true; this.g.ui.toast(text, 3); } }
  canSee(e) {
    const p = this.p;
    if (this.hidden) return false;
    const dx = p.x - e.x, dy = p.y - e.y;
    if (Math.abs(dx) > 190 || Math.abs(dy) > 26) return false;
    const y = e.y - 30;
    for (let s = 8; s < Math.abs(dx); s += 6) if (this.solidAt(e.x + Math.sign(dx) * s, y)) return false;
    return true;
  }
  updateEnemy(e, dt) {
    const p = this.p, a = this.g.audio;
    e.t -= dt; e.hurtT = Math.max(0, e.hurtT - dt);
    if (e.state === 'out') return;
    if (e.state === 'dizzy') { if (e.t <= 0) { e.state = 'out'; this.captured++; this.updateHud(); } return; }
    if (e.type === 'mg') {
      if (e.state === 'watch' && this.canSee(e) && (p.x - e.x) * e.face > 0) { e.state = 'burst'; e.burst = 3; e.t = 0.5; }
      if (e.state === 'burst' && e.t <= 0) {
        if (e.burst > 0) { this.ebullets.push({ x: e.x + e.face * 18, y: e.y - 30, vx: e.face * 170, life: 2.5 }); a.sfx('enemyshot'); e.burst--; e.t = 0.18; }
        else { e.state = 'cool'; e.t = 1.8; }
      }
      if (e.state === 'cool' && e.t <= 0) e.state = 'watch';
      return;
    }
    // Soldier
    const sees = this.canSee(e);
    if (sees) e.face = Math.sign(p.x - e.x) || e.face;
    if (e.state === 'patrol') {
      e.walkT += dt; e.x += e.face * 28 * dt;
      if (e.x < e.x0) { e.x = e.x0; e.face = 1; } if (e.x > e.x1) { e.x = e.x1; e.face = -1; }
      if (sees) { e.state = 'alert'; e.t = 0.55; }
    } else if (e.state === 'alert') {
      if (e.t <= 0) { if (sees) { e.state = 'fire'; e.t = 0.15; this.ebullets.push({ x: e.x + e.face * 22, y: e.y - 30, vx: e.face * 150, life: 2.5 }); a.sfx('enemyshot'); } else e.state = 'patrol'; }
    } else if (e.state === 'fire') { if (e.t <= 0) { e.state = 'cool'; e.t = 1.5; } }
    else if (e.state === 'cool') { if (e.t <= 0) e.state = sees ? 'alert' : 'patrol', e.t = 0.45; }
    // Walking into a soldier hurts a little (and bumps you back).
    if (Math.abs(e.x - p.x) < 14 && Math.abs(e.y - p.y) < 30) this.hurt(Math.sign(p.x - e.x) || 1);
  }
  damageEnemy(e, n) {
    if (e.state === 'out' || e.state === 'dizzy') return;
    e.hp -= n; e.hurtT = 0.2; this.g.audio.sfx('bonk');
    if (e.hp <= 0) { e.state = 'dizzy'; e.t = 1.1; this.g.audio.sfx('poof'); this.fx.push({ kind: 'stars', x: e.x, y: e.y - 50, t: 0 }); }
  }
  updateTank(dt) {
    const tk = this.tank, p = this.p, a = this.g.audio;
    tk.hurtT = Math.max(0, tk.hurtT - dt);
    if (tk.state === 'broken') { tk.crewT += dt; return; }
    const active = Math.abs(p.x - (tk.x + 54)) < 300;
    if (!active) return;
    tk.face = p.x < tk.x + 54 ? -1 : 1;
    tk.x += Math.sin(this.time * 0.6) * 22 * dt; tk.x = Math.max(tk.x0, Math.min(tk.x1 - 108, tk.x));
    tk.t -= dt;
    if (tk.t <= 0) { // fire a shell that lands near Liev (with a warning marker)
      tk.t = 3.2;
      const sx = tk.x + (tk.face < 0 ? 0 : 108), sy = tk.y - 34, tx = p.x + (Math.random() - 0.5) * 30, ty = this.groundYAt(tx), time = 1.25;
      this.shells.push({ x: sx, y: sy, vx: (tx - sx) / time, vy: (ty - sy - 0.5 * 420 * time * time) / time, tx, ty, t: 0 });
      a.sfx('boom'); this.fx.push({ kind: 'flash', x: sx, y: sy, t: 0, face: tk.face });
    }
    // Touching the tank pushes you back.
    if (p.x > tk.x - 4 && p.x < tk.x + 112 && p.y > tk.y - 48) this.hurt(p.x < tk.x + 54 ? -1 : 1);
  }
  updateShells(dt) {
    for (const s of this.shells) {
      s.t += dt; s.vy += 420 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y >= s.ty - 2 || this.solidAt(s.x, s.y)) { this.explode(s.x, Math.min(s.y, s.ty), 30, 'enemy'); s.dead = true; }
    }
    this.shells = this.shells.filter(s => !s.dead);
  }
  groundYAt(x) { const tx = Math.floor(x / T); for (let y = 0; y < this.H; y++) { const v = this.grid[y] && this.grid[y][tx]; if (v && v !== 'gate') return y * T; } return this.H * T; }
  updateBombing(dt) {
    const p = this.p, a = this.g.audio;
    const inZone = this.bombZones.some(([x0, x1]) => p.x > x0 && p.x < x1);
    if (this.plane) { this.plane.x += 150 * dt; if (this.plane.x > this.camX + this.vw + 80) this.plane = null; }
    this.planeT -= dt;
    if (inZone && !this.plane && this.planeT <= 0) {
      this.plane = { x: this.camX - 70, y: 18 }; this.planeT = 5.0; a.sfx('plane');
      [-34, 26, 86].forEach((off, i) => { const tx = p.x + off; this.bombs.push({ tx, ty: this.groundYAt(tx), t: 1.5 + i * 0.4, whistled: false }); });
    }
    for (const b of this.bombs) {
      b.t -= dt;
      if (b.t < 0.8 && !b.whistled) { b.whistled = true; a.sfx('whistle'); }
      if (b.t <= 0) { this.explode(b.tx, b.ty, 30, 'enemy'); b.dead = true; }
    }
    this.bombs = this.bombs.filter(b => !b.dead);
  }
  updateDebris(dt) {
    const p = this.p;
    for (const z of this.debrisZones) {
      if (p.x < z.x0 || p.x > z.x1) continue;
      z.t -= dt;
      if (z.t <= 0) { z.t = 1.9; const x = Math.max(z.x0, Math.min(z.x1, p.x + p.vx * 0.6 + (Math.random() - 0.5) * 40)); this.rocks.push({ x, y: z.y, vy: 0, warn: 0.7 }); }
    }
    for (const r of this.rocks) {
      if (r.warn > 0) { r.warn -= dt; continue; }
      r.vy += 700 * dt; r.y += r.vy * dt;
      if (!this.hidden && Math.abs(r.x - p.x) < 11 && r.y > p.y - p.h && r.y < p.y + 2) { this.hurt(0); r.dead = true; this.fx.push({ kind: 'dust', x: r.x, y: r.y, t: 0 }); }
      else if (this.solidAt(r.x, r.y + 5) && r.y > 40) { r.dead = true; this.fx.push({ kind: 'dust', x: r.x, y: r.y, t: 0 }); this.g.audio.sfx('crumble'); }
      if (r.y > this.H * T) r.dead = true;
    }
    this.rocks = this.rocks.filter(r => !r.dead);
  }
  updateCrumbles(dt) {
    const p = this.p;
    if (p.onGround) for (const xx of [p.x - HALF_W + 1, p.x, p.x + HALF_W - 1]) {
      const c = this.crumbles.get(Math.floor(xx / T) + ',' + Math.floor((p.y + 1) / T));
      if (c && c.state === 'solid') { c.state = 'shaking'; c.t = 0.45; this.g.audio.sfx('crumble'); }
    }
    for (const c of this.crumbles.values()) {
      if (c.state === 'shaking') { c.t -= dt; if (c.t <= 0) { c.state = 'gone'; c.t = 6; this.grid[c.y][c.x] = null; this.fx.push({ kind: 'fallbrick', x: c.x * T + 8, y: c.y * T + 8, t: 0 }); } }
      else if (c.state === 'gone') { c.t -= dt; if (c.t <= 0 && !(Math.abs(p.x - (c.x * T + 8)) < 16 && p.y > c.y * T && p.y - p.h < (c.y + 1) * T)) { c.state = 'solid'; this.grid[c.y][c.x] = 'crumble'; } }
    }
  }
  explode(x, y, r, by) {
    const p = this.p, a = this.g.audio;
    this.booms.push({ x, y, r, t: 0 }); a.sfx('boom');
    if (by === 'grenade') {
      for (const e of this.enemies) { if (e.state === 'out' || e.state === 'dizzy') continue; if (Math.hypot(e.x - x, (e.y - 24) - y) < r + 16) this.damageEnemy(e, 3); }
      const tk = this.tank;
      if (tk && tk.state === 'drive' && x > tk.x - r && x < tk.x + 108 + r && y > tk.y - 56 - r && y < tk.y + r) {
        tk.hp--; tk.hurtT = 0.4; this.g.ui.toast(tk.hp > 0 ? `Direct hit! The tank has ${tk.hp} left.` : 'The tank stopped! The crew gives up.', 2);
        if (tk.hp <= 0) { tk.state = 'broken'; this.captured++; this.updateHud(); }
      }
    } else if (!this.hidden && Math.hypot(p.x - x, (p.y - 20) - y) < r + 10) this.hurt(Math.sign(p.x - x) || 1);
    // Explosions knock out crumbly bricks nearby.
    for (const c of this.crumbles.values()) if (c.state === 'solid' && Math.hypot(c.x * T + 8 - x, c.y * T + 8 - y) < r) { c.state = 'shaking'; c.t = 0.1; }
  }
  hurt(dir) {
    if (this.invuln > 0 || this.hidden || this.done) return;
    const p = this.p;
    this.hearts--; this.invuln = 1.5; this.damageTaken++;
    p.vx = (dir || -p.face) * 150; p.vy = -170; p.onGround = false;
    this.g.audio.sfx('hurt'); this.updateHud();
    if (this.hearts <= 0) {
      this.g.ui.toast('Oof! Back to the last safe house to try again.', 2.5);
      this.hearts = 3; this.invuln = 2;
      p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.vx = 0; p.vy = 0; p.sliding = 0; p.action = null; p.h = STAND_H;
      this.ebullets = []; this.bombs = []; this.shells = []; this.rocks = [];
      this.updateHud();
    }
  }
  respawn() { // fell in the river
    super.respawn(); this.hearts = Math.max(1, this.hearts); this.invuln = 1.5;
  }
  updateRest(dt) { // safe houses heal you and give a croissant
    const r = this.resting, spot = this.restSpots[r.i]; r.t += dt; this.p.vx = 0;
    if (r.t > 1.0 && !r.given) { r.given = true; this.hearts = 3; if (this.rests.rest(r.i)) { this.fx.push({ kind: 'croissant', x: spot.x, y: spot.y - 30, t: 0 }); this.g.audio.sfx('collect'); this.g.ui.toast('🥐 Safe house: a croissant and all hearts back!', 2); } else this.g.ui.toast('All hearts back!', 1.4); this.updateHud(); }
    if (r.t > 1.6) this.resting = null;
  }
  checkThings(dt, ax) {
    super.checkThings(dt, ax);
    // Safe houses heal you even if you've already had your croissant there.
    const p = this.p;
    let on = false;
    this.restSpots.forEach((r, i) => { if (!this.rests.canRest(i) && Math.abs(p.x - r.x) < 14 && Math.abs(p.y - r.y) < 2 && p.onGround && !ax.x && this.hearts < 3 && !p.action) { on = true; this.healHold = (this.healHold || 0) + dt; if (this.healHold > 0.6) { this.resting = { i, t: 0, given: false }; this.healHold = 0; } } });
    if (!on) this.healHold = 0;
  }

  // ---------- HUD ----------
  updateHud() {
    if (!this.def) return;
    const hearts = this.hearts == null ? '' : '❤️'.repeat(Math.max(0, this.hearts)) + '🤍'.repeat(Math.max(0, 3 - this.hearts));
    const w = (k) => { const i = WEAPON_INFO[k]; const n = k === 'pistol' ? '∞' : (this.ammo ? this.ammo[k === 'grenade' ? 'grenade' : k] : 0); return this.weapon === k ? `<b style="background:#FFD34D;padding:0 6px;border-radius:6px">${i.icon} ${i.label} ${n}</b>` : `${i.icon} ${n}`; };
    const left = `${this.def.name} · ${hearts} &nbsp; ${this.ammo ? WEAPONS.map(w).join(' ') : ''}${this.hidden ? ' &nbsp;🙈 hidden' : ''}<br><span style="font-size:18px">Villagers freed ${this.rescued || 0}/3 · 🎖️ ${this.collected ? this.collected.size : 0}/${this.totalStars || 0}</span>`;
    this.g.ui.hud(true, left, `<span class="key">← →</span> move · <span class="key">Space</span> jump · <span class="key">X</span> fire · <span class="key">Q</span> or <span class="key">1</span><span class="key">2</span><span class="key">3</span> weapon · <span class="key">↓</span> duck / hide · <span class="key">Z</span> punch · <span class="key">E</span> open cage`);
    if (this.timer) { this.timer.enabled = !!this.g.settings.timer; this.showTimer(); }
  }
  complete() {
    if (this.done) return;
    this.done = true; this.anim.t = 0;
    const ps = this.g.saves.platformer, prev = ps.levels[this.levelId] || {};
    ps.levels[this.levelId] = { done: true, buttons: Math.max(prev.buttons || 0, this.collected.size), total: this.totalStars, treats: Math.max(prev.treats || 0, this.rests.treats), rescued: Math.max(prev.rescued || 0, this.rescued) };
    if (!ps.stamps.includes(this.levelId)) ps.stamps.push(this.levelId);
    this.g.writeSave('platformer');
    Records.submitTreats(this.levelId, this.rests.treats);
    let time = null;
    if (this.timer.enabled && this.timer.started) { const old = Records.bestTime(this.levelId), t = this.timer.stop(); time = { t, old, record: Records.submitTime(this.levelId, t) }; this.showTimer(); }
    this.g.audio.sfx('stamp');
    this.g.ui.toast(`📻 "Calling the Allies... help is on the way!" Villagers freed: ${this.rescued}/3`, 4);
    this.g.showComplete({ ...this.def, collectName: 'Medals' }, this.collected.size, this.totalStars, { treats: this.rests.treats, treatsTotal: this.restSpots.length, time });
  }

  // ---------- Drawing ----------
  draw() {
    const g = this.ctx, vw = this.vw, vh = this.vh, cx = Math.round(this.camX);
    const levelH = this.H * T, cy = levelH - vh, groundY = 11 * T - cy, bg = this.wbg, art = this.art;
    g.drawImage(bg.sky, 0, 0, vw, vh);
    const layer = (img, f, yOff) => { const w = img.width; let x = -Math.round(cx * f) % w; if (x > 0) x -= w; for (; x < vw; x += w) g.drawImage(img, x, yOff); };
    layer(bg.far, 0.2, groundY - 214); layer(bg.hedge, 0.45, groundY - 222);
    // Smoke columns rising from far away.
    for (let k = 0; k < 4; k++) { const sx = ((k * 260 + 120) - cx * 0.3) % (vw + 200); const x = sx < -60 ? sx + vw + 200 : sx;
      for (let i = 0; i < 9; i++) { const yy = groundY - 40 - ((this.time * 14 + i * 16) % 140); const r = 4 + i * 1.3 + ((this.time * 14 + i * 16) % 140) / 18; g.fillStyle = `rgba(90,90,100,${0.35 - i * 0.03})`; g.fillRect(Math.round(x + Math.sin(i + this.time) * 4 - r), Math.round(yy - r), Math.round(r * 2), Math.round(r * 2)); } }
    g.save(); g.translate(-cx, -cy);
    // Ruined building fronts behind the street.
    for (const [a0, a1] of this.facades) { const x0 = a0 * T, w = (a1 - a0) * T; g.fillStyle = '#8C8270'; g.fillRect(x0, 3 * T, w, 8 * T); g.fillStyle = '#A39A88'; g.fillRect(x0, 3 * T, w, 3);
      for (let x = x0 + 10; x < x0 + w - 10; x += 34) { g.fillStyle = '#2E2A26'; g.fillRect(x, 5 * T, 14, 18); g.fillRect(x, 8 * T - 6, 14, 18); g.fillStyle = '#6B4423'; g.fillRect(x - 2, 5 * T + 18, 18, 2); }
      for (let x = x0; x < x0 + w; x += 24) { g.fillStyle = '#6F6758'; g.fillRect(x, 3 * T - ((x / 24) % 3) * 6, 12, ((x / 24) % 3) * 6); } }
    // Water.
    for (const [a0, b0] of this.waters) { const x0 = a0 * T, x1 = b0 * T, y0 = 11 * T + 8; g.fillStyle = '#4A6E8A'; g.fillRect(x0, y0, x1 - x0, levelH - y0); g.fillStyle = '#6E93AE'; g.fillRect(x0, y0, x1 - x0, 2); for (let x = x0; x < x1; x += 8) { const o = Math.floor((this.time * 8 + x / 8) % 8); g.fillStyle = '#9DBBD0'; g.fillRect(x + o, y0 + 5 + (x / 8 % 2) * 4, 3, 1); } }
    // Decorations, signs, safe houses, hiding spots (behind Liev).
    for (const dd of this.decos) { const img = art[dd.kind]; if (!img || dd.x + img.width < cx - 40 || dd.x > cx + vw + 40) continue; g.drawImage(img, dd.x + (16 - img.width) / 2 | 0, dd.y - img.height); }
    for (const s of this.signs) g.drawImage(art['sign_' + s.kind], s.x - 5, s.y - 30);
    this.restSpots.forEach((r, i) => { g.drawImage(art.safe, r.x - 18, r.y - 40); if (this.rests.canRest(i)) g.drawImage(this.decor.zzz, r.x - 8, r.y - 60 + Math.round(Math.sin(this.time * 3) * 2)); });
    for (const h of this.hides) { const img = art[h.kind]; g.drawImage(img, h.x - img.width / 2 | 0, h.y - img.height); }
    // Tiles.
    const t0 = Math.max(0, Math.floor(cx / T) - 1), t1 = Math.min(this.W, Math.ceil((cx + vw) / T) + 1), wt = this.wtiles;
    for (let y = 0; y < this.H; y++) for (let x = t0; x < t1; x++) {
      const v = this.grid[y][x]; if (!v) continue;
      let img = v === 'cobble' ? wt.cobble : v === 'earth' ? wt.earth : v === 'brick' ? wt.brick[(x + y) % 2] : v === 'stone' ? wt.stone[(x + y) % 2] : wt[v];
      if (v === 'gate') { if (this.gateOpen) continue; img = wt.gate; }
      let ox = 0; const c = v === 'crumble' && this.crumbles.get(x + ',' + y); if (c && c.state === 'shaking') ox = Math.round(Math.sin(this.time * 60) * 1.5);
      if (img) g.drawImage(img, x * T + ox, y * T);
    }
    if (this.gateOpen && this.gateY < this.gateCells.length * T) { this.gateY += 3; for (const [x, y] of this.gateCells) { const yy = y * T - this.gateY; if (yy + T > 0) g.drawImage(wt.gate, x * T, yy); } }
    // Items, medals, cages, radio.
    for (const it of this.items) if (!it.taken) g.drawImage(art[it.kind], it.x - 8, it.y - 11 + Math.round(Math.sin(this.time * 3 + it.x) * 1));
    for (let i = 0; i < this.stars.length; i++) { if (this.collected.has(i)) continue; const s = this.stars[i]; g.drawImage(art.medal, s.x - 5, s.y - 7 + Math.round(Math.sin(this.time * 4 + i) * 1.5)); }
    for (const c of this.cages) {
      if (!c.open) { g.drawImage(art.villager, c.x - 11, c.y - 46); g.drawImage(art.cage, c.x - 16, c.y - 50); }
      else { g.drawImage(art.cageOpen, c.x - 16, c.y - 50); if (c.runT < 3) { g.drawImage(art.villagerHappy, Math.round(c.x - 11 - c.runT * 50), c.y - 44 - Math.round(Math.abs(Math.sin(c.runT * 10)) * 3)); } }
    }
    if (this.stampPos) g.drawImage(art.radio, this.stampPos.x - 17, this.stampPos.y - 44);
    // Enemies.
    const S = art.soldier;
    for (const e of this.enemies) {
      if (e.x < cx - 60 || e.x > cx + vw + 60) continue;
      if (e.type === 'mg') {
        if (e.state === 'out' || e.state === 'dizzy') { g.save(); g.translate(e.x, e.y); if (e.face < 0) g.scale(-1, 1); g.drawImage(S.surrender, -S.ox, -S.h); g.restore(); if (e.state === 'dizzy') this.drawStars(g, e.x, e.y - 52); continue; }
        g.save(); g.translate(e.x, e.y); if (e.face < 0) g.scale(-1, 1); g.drawImage(S.aim, -S.ox, -S.h); g.drawImage(art.mg, 4, -36); if (e.state === 'burst' && e.t < 0.08) { g.fillStyle = '#FFF3A0'; g.fillRect(28, -37, 5, 5); } g.restore();
        continue;
      }
      let img = S.stand;
      if (e.state === 'patrol') img = S.walk[Math.floor(e.walkT * 6) % 4];
      else if (e.state === 'alert') img = S.aim; else if (e.state === 'fire') img = S.fire; else if (e.state === 'cool') img = S.aim;
      else if (e.state === 'dizzy' || e.state === 'out') img = S.surrender;
      g.save(); g.translate(Math.round(e.x), e.y); if (e.face < 0) g.scale(-1, 1);
      if (e.hurtT > 0 && Math.floor(this.time * 30) % 2) g.globalAlpha = 0.4;
      if (e.state === 'dizzy') g.rotate(Math.sin(this.time * 12) * 0.08);
      g.drawImage(img, -S.ox, -S.h); g.restore();
      if (e.state === 'alert') { g.fillStyle = '#C8473D'; g.fillRect(e.x - 1, e.y - 62, 3, 7); g.fillRect(e.x - 1, e.y - 53, 3, 2); }
      if (e.state === 'dizzy') this.drawStars(g, e.x, e.y - 54);
    }
    // Tank.
    const tk = this.tank;
    if (tk) {
      g.save(); g.translate(Math.round(tk.x + 54), tk.y); if (tk.face > 0) g.scale(-1, 1);
      if (tk.hurtT > 0 && Math.floor(this.time * 30) % 2) g.globalAlpha = 0.5;
      g.scale(-1, 1); g.drawImage(tk.state === 'broken' ? this.art.tankBroken : this.art.tank, -54, -54); g.restore();
      if (tk.state === 'broken') { for (let i = 0; i < 6; i++) { const yy = tk.y - 60 - ((this.time * 20 + i * 12) % 60); g.fillStyle = 'rgba(70,70,75,0.5)'; g.fillRect(tk.x + 50 + Math.round(Math.sin(i + this.time) * 5), Math.round(yy), 6 + i, 6 + i); }
        if (tk.crewT < 60) { g.save(); g.translate(tk.x + 30, tk.y); g.drawImage(S.surrender, -S.ox, -S.h); g.restore(); } }
      else if (Math.abs(this.p.x - (tk.x + 54)) < 300) { g.fillStyle = '#3A3D45'; g.fillRect(tk.x + 28, tk.y - 64, 52, 6); g.fillStyle = '#C8473D'; g.fillRect(tk.x + 29, tk.y - 63, Math.round(50 * tk.hp / tk.maxHp), 4); }
    }
    // Liev (dimmed when hiding), with his weapon when firing.
    const p = this.p;
    if (!(this.invuln > 0 && Math.floor(this.time * 20) % 2 && !this.hidden)) {
      if (this.hidden) g.globalAlpha = 0.45;
      this.drawLiev(g);
      g.globalAlpha = 1;
      if (p.action === 'fire') { const img = this.weapon === 'rifle' ? art.rifle : art.pistol; g.save(); g.translate(Math.round(p.x), Math.round(p.y)); if (p.face < 0) g.scale(-1, 1); g.drawImage(img, this.weapon === 'rifle' ? 6 : 16, -33); g.restore(); }
    }
    if (this.hidden) { const h = this.hides.find(hh => Math.abs(hh.x - p.x) < 11); if (h && h.kind !== 'door') { const img = art[h.kind]; g.globalAlpha = 0.85; g.drawImage(img, h.x - img.width / 2 | 0, h.y - img.height); g.globalAlpha = 1; } }
    // Projectiles and hazards.
    g.fillStyle = '#FFE680'; for (const b of this.bullets) g.fillRect(Math.round(b.x) - 2, Math.round(b.y), 5, 2);
    g.fillStyle = '#FF9A6B'; for (const b of this.ebullets) { g.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 1, 5, 3); g.fillStyle = '#FFE0C0'; g.fillRect(Math.round(b.x) - 1, Math.round(b.y), 2, 1); g.fillStyle = '#FF9A6B'; }
    for (const gr of this.grenadesLive) { g.save(); g.translate(Math.round(gr.x), Math.round(gr.y)); g.rotate(Math.round(gr.spin * 2) / 2); g.drawImage(art.grenade, -3, -4); g.restore(); }
    for (const s of this.shells) { g.fillStyle = '#2A2A2A'; g.fillRect(Math.round(s.x) - 3, Math.round(s.y) - 2, 6, 5); const blink = Math.floor(this.time * 10) % 2; if (blink) this.drawMarker(g, s.tx, s.ty); }
    for (const b of this.bombs) { if (Math.floor(this.time * 8) % 2 || b.t < 0.5) this.drawMarker(g, b.tx, b.ty); if (b.t < 0.8) g.drawImage(art.bomb, Math.round(b.tx - 3), Math.round(b.ty - 10 - (b.t / 0.8) * (b.ty - 30))); }
    for (const r of this.rocks) { if (r.warn > 0) { g.fillStyle = '#B9AE9C'; for (let i = 0; i < 4; i++) g.fillRect(Math.round(r.x + (i - 2) * 4 + Math.sin(this.time * 30 + i) * 2), Math.round(r.y + ((this.time * 40 + i * 7) % 18)), 2, 2); }
      else { g.fillStyle = '#8C8270'; g.fillRect(Math.round(r.x) - 5, Math.round(r.y) - 5, 10, 9); g.fillStyle = '#B2A794'; g.fillRect(Math.round(r.x) - 5, Math.round(r.y) - 5, 10, 2); } }
    for (const bm of this.booms) this.drawBoom(g, bm);
    this.fx = this.fx.filter(f => { f.t += 1 / 60; return this.drawWarFx(g, f) ?? this.drawFx(g, f); });
    g.restore();
    if (this.plane) g.drawImage(art.plane, Math.round(this.plane.x - cx), 40 + Math.round(Math.sin(this.time * 3) * 2));   // planes fly across the top of the screen
  }
  drawMarker(g, x, y) { g.fillStyle = '#C8473D'; for (let i = -5; i <= 5; i++) { g.fillRect(Math.round(x + i), Math.round(y - 3 + i * 0.5), 2, 1); g.fillRect(Math.round(x + i), Math.round(y - 3 - i * 0.5), 2, 1); } }
  drawStars(g, x, y) { for (let i = 0; i < 3; i++) { const a = this.time * 6 + i * 2.1; g.fillStyle = '#FFD34D'; g.fillRect(Math.round(x + Math.cos(a) * 9) - 1, Math.round(y + Math.sin(a) * 3), 3, 3); } }
  drawBoom(g, bm) { // cartoon explosion: flash, puff, smoke
    const k = bm.t / 0.7, r = Math.round(bm.r * (0.4 + k * 0.8));
    const cols = k < 0.2 ? ['#FFFFFF', '#FFF3A0'] : k < 0.5 ? ['#FFD34D', '#F29A3A'] : ['#9A9690', '#6E6A66'];
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + bm.x, rr = Math.round(r * (0.45 + (i % 3) * 0.15)); const xx = Math.round(bm.x + Math.cos(a) * r * 0.45), yy = Math.round(bm.y - r * 0.3 + Math.sin(a) * r * 0.35 - k * 10);
      g.fillStyle = cols[i % 2]; g.beginPath(); g.arc(xx, yy, rr, 0, Math.PI * 2); g.fill(); }
  }
  drawWarFx(g, f) {
    if (f.kind === 'flash') { g.fillStyle = '#FFF3A0'; g.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 5, 5); return f.t < 0.06; }
    if (f.kind === 'spark') { g.fillStyle = '#FFE680'; for (let i = 0; i < 4; i++) g.fillRect(Math.round(f.x + (i - 2) * f.t * 60), Math.round(f.y + Math.sin(i) * f.t * 40), 1, 1); return f.t < 0.15; }
    if (f.kind === 'stars') return false;
    if (f.kind === 'dust') { g.fillStyle = '#B9AE9C'; for (let i = 0; i < 6; i++) g.fillRect(Math.round(f.x + (i - 3) * (2 + f.t * 30)), Math.round(f.y - f.t * 20 - (i % 2) * 3), 3, 3); return f.t < 0.4; }
    if (f.kind === 'fallbrick') { g.drawImage(this.wtiles.crumble, Math.round(f.x - 8), Math.round(f.y - 8 + f.t * f.t * 300)); return f.t < 0.6; }
    if (f.kind === 'croissant') { g.drawImage(this.art.croissant, f.x - 8, Math.round(f.y - f.t * 30)); return f.t < 0.8; }
    return undefined;
  }
}
