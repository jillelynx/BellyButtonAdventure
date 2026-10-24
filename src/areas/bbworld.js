// Belly Button's World — a soft, stitched-together land of felt hills and button flowers.
import * as THREE from 'three';
import { felt, plushDash, gradient, buttonFace, paperSign, makeCanvas, toTexture } from '../textures.js';
import { rng } from '../util.js';

export const DOOR1 = { id: 'bbw-door1', level: 'bbw-door1', name: 'Button Hill Door', x: 0, z: -20 };
export const DOOR2 = { id: 'bbw-door2', level: 'bbw-door2', name: 'Pixel Door', x: -14, z: 16, retro: true };
export const DOOR3 = { id: 'bbw-door3', level: 'bbw-door3', name: 'Time Door: France 1944', x: 20, z: -10, retro: true };
const EDGE = 39;          // you can't go past this (the pillow hills rise up here)
const EDGE_WARN = 36.5;   // gentle message starts here

export function terrain(x, z) {
  let h = 0.55 * Math.sin(x * 0.15) * Math.cos(z * 0.12) + 0.35 * Math.sin((x + z) * 0.08) + 0.2 * Math.cos(x * 0.31 + z * 0.17);
  const dd = (x - DOOR1.x) ** 2 + (z - DOOR1.z) ** 2; h += 1.6 * Math.exp(-dd / 70);       // Button Hill
  const dy = (x - 14) ** 2 + (z - 6) ** 2; h -= 0.3 * Math.exp(-dy / 30);
  const r = Math.hypot(x, z);
  if (r > 35) h += (r - 35) ** 2 * 0.28;                                               // pillow hills at the edge
  return h;
}
export const pathX = (z) => Math.sin(z * 0.22) * 1.8;

export function buildBBWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#D8ECF5', 50, 140);
  const R = rng(2026);
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
  const plush = (color, map = null) => new THREE.MeshPhysicalMaterial({ color, map, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.55 });
  const cast = (m, c = true, r = true) => { m.castShadow = c; m.receiveShadow = r; return m; };

  // Sky dome.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({
    map: gradient([[0, '#8EC3EA'], [0.45, '#BFE0F3'], [0.52, '#FCE9CF'], [1, '#FCE9CF']]), side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(sky);

  // Lights.
  scene.add(new THREE.HemisphereLight('#EAF6FF', '#7FA36E', 0.85));
  const sun = new THREE.DirectionalLight('#FFE7B8', 2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  sun.userData.offset = new THREE.Vector3(26, 44, 18);
  scene.add(sun, sun.target);

  // Ground: felt with soft color patches, quilted pillow hills at the edge.
  const N = 220, SIZE = 150;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
  const cMint = new THREE.Color('#86C99A'), cCream = new THREE.Color('#E9DDBE'), cGreen = new THREE.Color('#5FAE78');
  const quilt = ['#F2C9D2', '#CFE0F5', '#F6E3B4', '#D8CCEF'].map(c => new THREE.Color(c));
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, terrain(x, z));
    const n = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2) * Math.cos(z * 0.19);
    tmp.copy(cMint).lerp(cCream, Math.max(0, n - 0.62) * 1.5).lerp(cGreen, Math.min(1, Math.max(0, 0.45 - n) * 1.6));
    const r = Math.hypot(x, z);
    if (r > 34) { const sector = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12); tmp.lerp(quilt[sector % 4], Math.min(1, (r - 34) / 4)); }
    if (Math.abs(x - pathX(z)) < 0.9 && z < 10 && z > DOOR1.z + 1) tmp.lerp(cCream, 0.75); // soft path
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const groundTex = felt('#F2F2F2', 8, 0.14, 256); groundTex.repeat.set(40, 40);
  const ground = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: groundTex, vertexColors: true, roughness: 1, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.8 }));
  ground.receiveShadow = true; scene.add(ground);

  const circles = [], camSpheres = [], swayers = [];

  // Stitched path from the arrival spot to the Doodle Door.
  const stitchMat = std('#FFFFFF', { roughness: 0.7 });
  const stitchGeo = new THREE.CapsuleGeometry(0.035, 0.28, 3, 6); stitchGeo.rotateX(Math.PI / 2);
  for (let z = 9; z > DOOR1.z + 1.5; z -= 0.75) {
    for (const side of [-1, 1]) {
      const x = pathX(z) + side * 0.95, x2 = pathX(z - 0.3) + side * 0.95;
      const s = new THREE.Mesh(stitchGeo, stitchMat);
      s.position.set(x, terrain(x, z) + 0.03, z); s.lookAt(x2, terrain(x2, z - 0.3) + 0.03, z - 0.3); scene.add(s);
    }
  }

  // Felt lollipop trees.
  const canopyColors = ['#F2A7B5', '#A8D8B9', '#FFD98A', '#B9C8F2', '#7FC79A', '#F6B98A'];
  const trunkMat = plush('#B07A4A', felt('#B07A4A', 12, 0.08));
  const seamMat = std('#FFF8EC');
  const avoid = [[DOOR1.x, DOOR1.z, 6], [DOOR2.x, DOOR2.z, 6], [DOOR3.x, DOOR3.z, 6], [14, 6, 4], [-17, -7, 4], [9, 13, 3.5], [0, 9, 4], [10, -8, 3], [-9, 5, 3], [-4, -12, 3]];
  const okSpot = (x, z) => Math.abs(x - pathX(z)) > 3 && avoid.every(([ax, az, ar]) => Math.hypot(x - ax, z - az) > ar);
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 22; tries++) {
    const a = R() * Math.PI * 2, rr = 7 + R() * 26, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (!okSpot(x, z) || circles.some(c => Math.hypot(c.x - x, c.z - z) < 4.5)) continue;
    const y = terrain(x, z), th = 1.5 + R() * 0.8, cr = 1.0 + R() * 0.55;
    const tree = new THREE.Group(); tree.position.set(x, y, z);
    const trunk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, th, 12), trunkMat)); trunk.position.y = th / 2; tree.add(trunk);
    const canopy = cast(new THREE.Mesh(new THREE.SphereGeometry(cr, 28, 18), plush(canopyColors[placed % canopyColors.length])));
    canopy.scale.y = 0.85; canopy.position.y = th + cr * 0.65; tree.add(canopy);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(cr * 1.0, 0.025, 6, 40), seamMat); seam.rotation.x = Math.PI / 2; seam.position.y = canopy.position.y; tree.add(seam);
    scene.add(tree);
    circles.push({ x, z, r: 0.3 });
    camSpheres.push({ c: new THREE.Vector3(x, y + canopy.position.y, z), r: cr * 0.9 });
    swayers.push({ obj: canopy, base: canopy.position.y, ph: R() * 6, amp: 0.02 });
    placed++;
  }

  // Button flowers (you can walk through them — they wiggle).
  const flowerCols = ['#F2A7B5', '#7FB3E0', '#FFD98A', '#F6B98A', '#C9B3EF', '#FFFFFF'];
  const faces = flowerCols.map(c => new THREE.MeshStandardMaterial({ map: buttonFace(c), roughness: 0.5 }));
  const stemMat = std('#5E9E62');
  const flowers = [];
  for (let i = 0; i < 90; i++) {
    const a = R() * Math.PI * 2, rr = 3 + R() * 31, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.abs(x - pathX(z)) < 1.2 && z < 10 && z > DOOR1.z) continue;
    const f = new THREE.Group(); f.position.set(x, terrain(x, z), z);
    const h = 0.3 + R() * 0.35, s = 0.08 + R() * 0.07;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, h, 5), stemMat); stem.position.y = h / 2; f.add(stem);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(s, s, 0.03, 18), faces[i % faces.length]);
    head.position.y = h; head.rotation.x = 1.2; head.rotation.z = R() * 6; f.add(head); cast(head, true, false);
    f.rotation.y = R() * 6.28; scene.add(f);
    flowers.push({ obj: f, ph: R() * 6, bump: 0 });
  }

  // Giant buttons you can hop onto.
  const giant = [[10, -8, 1.6, '#7FB3E0'], [-9, 5, 1.3, '#F2A7B5'], [-4, -12, 1.1, '#FFD98A'], [6, 2, 0.9, '#C9B3EF']];
  for (const [x, z, r, c] of giant) {
    const y = Math.min(terrain(x, z), terrain(x + r, z), terrain(x - r, z), terrain(x, z + r), terrain(x, z - r));
    const top = Math.max(terrain(x, z), terrain(x + r * 0.7, z), terrain(x - r * 0.7, z), terrain(x, z + r * 0.7), terrain(x, z - r * 0.7)) + 0.32;
    const b = cast(new THREE.Mesh(new THREE.CylinderGeometry(r, r, top - y + 0.05, 40), [std(c, { roughness: 0.45 }), new THREE.MeshStandardMaterial({ map: buttonFace(c), roughness: 0.45 }), std(c)]));
    b.position.set(x, (top + y) / 2 - 0.02, z); scene.add(b);
    circles.push({ x, z, r, top });
  }

  // Big yarn ball landmark with a loose strand.
  const [yc, yg] = makeCanvas(512, 256); yg.fillStyle = '#7FB3E0'; yg.fillRect(0, 0, 512, 256);
  yg.strokeStyle = 'rgba(40,70,120,0.35)'; yg.lineWidth = 3;
  for (let i = 0; i < 60; i++) { yg.beginPath(); yg.moveTo(0, i * 7); yg.bezierCurveTo(170, i * 7 - 40, 340, i * 7 + 40, 512, i * 7); yg.stroke(); }
  const yarnY = terrain(14, 6) + 1.25;
  const yarn = cast(new THREE.Mesh(new THREE.SphereGeometry(1.7, 40, 28), plush('#ffffff', toTexture(yc))));
  yarn.position.set(14, yarnY, 6); yarn.rotation.set(0.4, 0.3, 0.7); scene.add(yarn);
  const strandPts = [new THREE.Vector3(14 - 1.2, yarnY - 1.0, 6 + 0.8), new THREE.Vector3(11.5, terrain(11.5, 8) + 0.06, 8), new THREE.Vector3(9, terrain(9, 7) + 0.06, 9.5), new THREE.Vector3(7, terrain(7, 11) + 0.06, 11)];
  scene.add(cast(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strandPts), 40, 0.06, 6), plush('#7FB3E0')), true, false));
  circles.push({ x: 14, z: 6, r: 1.65 });
  camSpheres.push({ c: yarn.position.clone(), r: 1.7 });

  // ---- Doodle Doors (each leads to a platformer level) ----
  const makeDoor = (D, C) => {
    const door = new THREE.Group();
    const dy = terrain(D.x, D.z);
    door.position.set(D.x, dy - 0.05, D.z);
    const outline = new THREE.MeshBasicMaterial({ color: '#2A2C33', side: THREE.BackSide });
    const crayon = (w, h, d, color, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = cast(new THREE.Mesh(g, std(color, { roughness: 0.7 }))); m.position.set(x, y, z);
      const o = new THREE.Mesh(g, outline); o.scale.set(1 + 0.08 / w, 1 + 0.08 / h, 1 + 0.08 / d); m.add(o);
      door.add(m); return m;
    };
    crayon(0.26, 2.7, 0.3, C.frame, -0.8, 1.35, 0); crayon(0.26, 2.7, 0.3, C.frame, 0.8, 1.35, 0);
    crayon(1.86, 0.3, 0.32, C.lintel, 0, 2.8, 0);
    crayon(1.9, 0.12, 0.6, C.frame, 0, 0.06, 0.05);
    const glowMat = new THREE.MeshBasicMaterial({ map: gradient([[0, '#FFF6D6'], [0.6, '#FFD98A'], [1, '#FFB765']]), transparent: true, opacity: 0.95, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 2.55), glowMat); glow.position.set(0, 1.4, -0.05); door.add(glow);
    const hinge = new THREE.Group(); hinge.position.set(-0.67, 0, 0.05); door.add(hinge);
    const panel = new THREE.Group(); hinge.add(panel);
    const pmesh = cast(new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.5, 0.08), std(C.panel, { roughness: 0.6 }))); pmesh.position.set(0.65, 1.37, 0); panel.add(pmesh);
    const po = new THREE.Mesh(pmesh.geometry, outline); po.scale.set(1.05, 1.03, 1.6); pmesh.add(po);
    const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.12 : 0.28; i ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const starM = new THREE.Mesh(new THREE.ShapeGeometry(star), new THREE.MeshStandardMaterial({ color: C.star, side: THREE.DoubleSide })); starM.position.set(0.65, 1.85, 0.045); panel.add(starM);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), std('#F2C230', { roughness: 0.3, metalness: 0.4 })); knob.position.set(1.12, 1.25, 0.08); panel.add(knob);
    hinge.rotation.y = -1.75;
    const doorLight = new THREE.PointLight('#FFC870', 4, 7, 1.8); doorLight.position.set(0, 1.4, 0.6); door.add(doorLight);
    // Sparkles.
    const spN = 40, spGeo = new THREE.BufferGeometry(), spPos = new Float32Array(spN * 3), spSeed = [];
    for (let i = 0; i < spN; i++) spSeed.push([R() * 6.28, 0.6 + R() * 1.1, R() * 2.8, 0.5 + R()]);
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    const sparkles = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: '#FFF1B0', size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
    door.add(sparkles);
    scene.add(door);
    circles.push({ x: D.x - 0.8, z: D.z, r: 0.22 }, { x: D.x + 0.8, z: D.z, r: 0.22 });
    // The open door panel sticks out in front-left: block it with two small circles.
    const pa = -1.75; for (const t of [0.4, 0.95]) circles.push({ x: D.x - 0.67 + Math.cos(pa) * 1.3 * t, z: D.z + 0.05 - Math.sin(pa) * 1.3 * t, r: 0.12 });
    // The back of the door frame: you can walk behind it, but not through the glow.
    circles.push({ x: D.x - 0.3, z: D.z - 0.05, r: 0.28 }, { x: D.x + 0.3, z: D.z - 0.05, r: 0.28 });
    return { front: new THREE.Vector3(D.x, 0, D.z + 1.7), glowMat, doorLight, spGeo, spPos, spSeed, spN };
  };
  const doorObjs = [makeDoor(DOOR1, { frame: '#F2C230', lintel: '#F29A3A', panel: '#4A90D9', star: '#C8473D' }),
    makeDoor(DOOR2, { frame: '#7FD14B', lintel: '#2347C4', panel: '#F2B530', star: '#FFFFFF' }),   // the retro Pixel Door
    makeDoor(DOOR3, { frame: '#9C7A52', lintel: '#4E5F3A', panel: '#2347C4', star: '#F4F4F0' })];  // the Time Door (old-photo brown)
  const doorFront = doorObjs[0].front, door2Front = doorObjs[1].front, door3Front = doorObjs[2].front;

  // ---- Map pages pinned in the world ----
  const page = (x, z, rotY, lines, title, color) => {
    const g = new THREE.Group(); const y = terrain(x, z); g.position.set(x, y, z); g.rotation.y = rotY;
    const stickMat = std('#B07A4A');
    for (const sx of [-0.95, 0.95]) { const s = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.1, 8), stickMat)); s.position.set(sx, 1.05, -0.02); g.add(s); }
    const sheet = cast(new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), new THREE.MeshStandardMaterial({ map: paperSign(lines, { title, w: 640, h: 448, size: 38, bg: '#FBF5E6' }), roughness: 0.95, side: THREE.DoubleSide })));
    sheet.position.set(0, 1.35, 0.02); sheet.rotation.x = -0.05; g.add(sheet);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), std(color, { roughness: 0.3 })); pin.position.set(0, 2.03, 0.08); g.add(pin);
    scene.add(g); circles.push({ x, z, r: 0.7 }); return g;
  };
  page(-17, -7, 0.9, ['Rolling green fields,', 'big mountains, a rocky beach.', '(still being colored in!)'], 'West Cork, Ireland', '#4E9A5E');
  page(9, 13, -0.6, ['Press E to go home', 'to your bedroom.'], "Liev's Room", '#7FB3E0');

  // ---- Pillow mountains around the edge ----
  const pillowTex = plushDash('#E9DCEC', '#FFFFFF', 77, 256, 300); pillowTex.repeat.set(3, 2);
  const pillowCols = ['#F2C9D2', '#CFE0F5', '#F6E3B4', '#D8CCEF', '#CDEBD8'];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + R() * 0.2, rr = 47 + R() * 5;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), plush(pillowCols[i % pillowCols.length], pillowTex));
    m.scale.set(9 + R() * 4, 5 + R() * 3, 7 + R() * 3); m.position.set(Math.cos(a) * rr, terrain(Math.cos(a) * rr, Math.sin(a) * rr) - 1, Math.sin(a) * rr);
    m.rotation.y = -a; scene.add(m);
  }
  // Cotton clouds.
  const cloudMat = plush('#FFFFFF'); const clouds = [];
  for (let i = 0; i < 11; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(2 + R() * 1.5, 20, 14), cloudMat); s.position.set(k * 2.2 - 3, R() * 0.8, R() * 1.5); s.scale.y = 0.7; c.add(s); }
    c.position.set((R() - 0.5) * 140, 24 + R() * 10, (R() - 0.5) * 140); scene.add(c); clouds.push(c);
  }

  const goals = (ctx) => {
    const done = ctx.stamps.includes(DOOR1.id);
    if (!done) return [{ pos: doorFront, text: ctx.doorsFound.includes(DOOR1.id) ? 'Go through the glowing Doodle Door on Button Hill!' : 'Follow the stitched path to find something glowing on the hill!' }];
    if (!ctx.stamps.includes(DOOR2.id)) return [{ pos: door2Front, text: 'Look behind you! A green Pixel Door leads to a retro level.' }];
    if (!ctx.stamps.includes(DOOR3.id)) return [{ pos: door3Front, text: 'A brown Time Door has appeared by the far hills. It goes back to France, 1944!' }];
    return [{ pos: new THREE.Vector3(-17, 0, -6), text: 'You got all three Treasure Stamps! The West Cork page is being colored in for next time.' }];
  };

  const tv = new THREE.Vector3();
  return {
    name: 'bbworld', title: "Belly Button's World", scene, sun, music: 'bbworld', ambience: 'outdoor',
    spawn: { pos: new THREE.Vector3(0, 0, 9), yaw: Math.PI, camYaw: 0 },
    circles, boxes: [], camSpheres, maxCamDist: 7,
    terrain,
    doors: [{ ...DOOR1, front: doorFront, yaw: 0 }, { ...DOOR2, front: door2Front, yaw: 0 }, { ...DOOR3, front: door3Front, yaw: 0 }],
    limit(p) {
      const r = Math.hypot(p.x, p.z);
      if (r > EDGE) { p.x *= EDGE / r; p.z *= EDGE / r; }
      return r > EDGE_WARN ? "Those pillow hills are too squishy to climb. Let's explore back this way!" : null;
    },
    camLimit(target, dir, dist) {
      let t = dist;
      for (let i = 1; i <= 16; i++) { // stay above the ground
        const s = dist * i / 16; tv.copy(target).addScaledVector(dir, s);
        if (tv.y < terrain(tv.x, tv.z) + 0.35) { t = Math.min(t, Math.max(0.6, s - dist / 16)); break; }
      }
      for (const sp of camSpheres) { // don't look through tree tops or the yarn ball
        const oc = tv.copy(target).sub(sp.c); const b = oc.dot(dir), c = oc.lengthSq() - sp.r * sp.r;
        const disc = b * b - c; if (c < 0 || disc < 0) continue;
        const hit = -b - Math.sqrt(disc); if (hit > 0 && hit < t) t = Math.max(0.6, hit - 0.25);
      }
      return t;
    },
    interact: [
      { id: 'door1', pos: doorFront, r: 1.6, prompt: () => 'Go through the Doodle Door', action: 'door', door: DOOR1.id },
      { id: 'door2', pos: door2Front, r: 1.6, prompt: () => 'Go through the Pixel Door', action: 'door', door: DOOR2.id },
      { id: 'door3', pos: door3Front, r: 1.6, prompt: () => 'Go through the Time Door (France, 1944)', action: 'door', door: DOOR3.id },
      { id: 'westcork', pos: new THREE.Vector3(-17, 0, -7), r: 2.4, prompt: () => 'Look at the West Cork page', action: 'westcork' },
      { id: 'home', pos: new THREE.Vector3(9, 0, 13), r: 2.4, prompt: () => "Go home to Liev's room", action: 'home' },
    ],
    goals,
    update(dt, ctx) {
      const t = ctx.time;
      sun.position.copy(ctx.player.pos).add(sun.userData.offset); sun.target.position.copy(ctx.player.pos);
      for (const s of swayers) s.obj.position.y = s.base + Math.sin(t * 1.3 + s.ph) * s.amp;
      for (const f of flowers) {
        for (const c of [ctx.player, ctx.friend]) { const d = Math.hypot(f.obj.position.x - c.pos.x, f.obj.position.z - c.pos.z); if (d < 0.5) f.bump = 1; }
        f.bump = Math.max(0, f.bump - dt * 1.5);
        f.obj.rotation.z = Math.sin(t * 1.6 + f.ph) * 0.07 + Math.sin(t * 14 + f.ph) * 0.35 * f.bump;
      }
      for (const c of clouds) { c.position.x += dt * 0.6; if (c.position.x > 80) c.position.x = -80; }
      for (const { glowMat, doorLight, spN, spSeed, spPos, spGeo } of doorObjs) {
        glowMat.opacity = 0.85 + Math.sin(t * 3) * 0.1; doorLight.intensity = 3.5 + Math.sin(t * 3) * 0.8;
        for (let i = 0; i < spN; i++) {
          const [a, r, h, sp] = spSeed[i]; const aa = a + t * sp * 0.6;
          spPos[i * 3] = Math.cos(aa) * r; spPos[i * 3 + 1] = 0.2 + ((h + t * sp * 0.4) % 2.8); spPos[i * 3 + 2] = Math.sin(aa) * r * 0.5 + 0.3;
        }
        spGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}
