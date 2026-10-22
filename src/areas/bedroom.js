// Liev's bedroom in Reading, PA — where the adventure starts.
import * as THREE from 'three';
import { woodPlanks, makeCanvas, toTexture, felt, soccerBall } from '../textures.js';
import { drawAdventureMap } from '../mapdraw.js';

const ROOM = { minX: -3, maxX: 3, minZ: -3, maxZ: 3, h: 2.9 };

function pillowPrint(kind) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#F4EEDF'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = kind === 'planes' ? '#3D4C66' : '#B9A27A'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const x = 30 + (i % 3) * 80, y = 50 + Math.floor(i / 3) * 110;
    if (kind === 'planes') { g.beginPath(); g.moveTo(x - 25, y); g.lineTo(x + 25, y); g.moveTo(x, y - 18); g.lineTo(x + 5, y + 18); g.moveTo(x - 22, y - 8); g.lineTo(x - 22, y + 8); g.stroke(); }
    else { g.beginPath(); g.arc(x, y, 18, 0, 7); g.stroke(); g.beginPath(); g.arc(x - 10, y - 16, 6, 0, 7); g.arc(x + 10, y - 16, 6, 0, 7); g.stroke(); }
  }
  return toTexture(c);
}

export function buildBedroom() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2B2A33');
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const add = (mesh, { cast = true, recv = true } = {}) => { mesh.castShadow = cast; mesh.receiveShadow = recv; scene.add(mesh); return mesh; };
  const box = (w, h, d, mat, x, y, z) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); return m; };

  // Lights: soft room fill, warm lamp, evening light from the window.
  scene.add(new THREE.HemisphereLight('#FFF1DC', '#6E5A48', 0.7));
  const sun = new THREE.DirectionalLight('#FFD9A8', 1.7);
  sun.position.set(6, 4.5, -1.2); sun.target.position.set(-1, 0, 0.5); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 16 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; scene.add(sun);
  const lamp = new THREE.PointLight('#FFC77A', 4, 7, 1.6); lamp.position.set(2.6, 1.05, 0.05); scene.add(lamp);

  // Floor, walls, ceiling.
  const floorTex = woodPlanks('#B07A4A'); floorTex.repeat.set(2.2, 2.2);
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(6, 6), std('#ffffff', { map: floorTex, roughness: 0.7 })), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  const wallMat = std('#B9C3CF', { roughness: 0.95 });
  const walls = [
    [6, 0, -3, 0], [6, 0, 3, Math.PI], [6, -3, 0, Math.PI / 2], [6, 3, 0, -Math.PI / 2],
  ];
  for (const [w, x, z, ry] of walls) {
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), wallMat), { cast: false });
    m.position.set(x, ROOM.h / 2, z); m.rotation.y = ry;
  }
  const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(6, 6), std('#ECE8E0')), { cast: false });
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h;
  // Wood wainscot along the bottom of the walls (like the house in the photos).
  const wains = std('#A9713F', { roughness: 0.6 });
  box(6, 0.85, 0.04, wains, 0, 0.425, -2.98); box(6, 0.85, 0.04, wains, 0, 0.425, 2.98);
  box(0.04, 0.85, 6, wains, -2.98, 0.425, 0); box(0.04, 0.85, 6, wains, 2.98, 0.425, 0);
  const rail = std('#8C5A30', { roughness: 0.5 });
  box(6, 0.05, 0.07, rail, 0, 0.86, -2.96); box(6, 0.05, 0.07, rail, 0, 0.86, 2.96);
  box(0.07, 0.05, 6, rail, -2.96, 0.86, 0); box(0.07, 0.05, 6, rail, 2.96, 0.86, 0);

  // Window with evening sky and cream curtains (east wall).
  const [sc, sg] = makeCanvas(64, 128); const grd = sg.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#7FA9D8'); grd.addColorStop(0.6, '#F6C99A'); grd.addColorStop(1, '#F29F7A'); sg.fillStyle = grd; sg.fillRect(0, 0, 64, 128);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), new THREE.MeshBasicMaterial({ map: toTexture(sc, { wrap: false }) }));
  win.position.set(2.975, 1.75, -1.4); win.rotation.y = -Math.PI / 2; scene.add(win);
  const frame = std('#F2EFE8');
  box(0.06, 0.07, 1.32, frame, 2.95, 2.28, -1.4); box(0.06, 0.07, 1.32, frame, 2.95, 1.22, -1.4);
  box(0.06, 1.1, 0.06, frame, 2.95, 1.75, -2.05); box(0.06, 1.1, 0.06, frame, 2.95, 1.75, -0.75); box(0.05, 1.0, 0.04, frame, 2.95, 1.75, -1.4);
  const curtain = std('#EEE6D6', { roughness: 1 });
  for (const z of [-2.2, -0.6]) { const c = box(0.08, 1.7, 0.35, curtain, 2.88, 1.6, z); c.scale.x = 1; }
  box(0.04, 0.04, 2.2, std('#777'), 2.9, 2.5, -1.4);

  // Black metal bed with mint sheets and printed pillows (like Liev's room).
  const metal = std('#232327', { roughness: 0.4, metalness: 0.5 });
  box(1.2, 0.25, 2.3, metal, 2.35, 0.18, 1.75);
  const sheet = std('#CFE3D6', { map: felt('#CFE3D6', 31, 0.05), roughness: 1 });
  const mattress = box(1.16, 0.25, 2.26, sheet, 2.35, 0.43, 1.75);
  mattress.geometry.dispose(); mattress.geometry = new THREE.BoxGeometry(1.16, 0.25, 2.26, 4, 1, 4);
  box(1.24, 0.04, 0.04, metal, 2.35, 0.95, 2.9); box(1.24, 0.04, 0.04, metal, 2.35, 0.6, 2.9);
  for (let i = 0; i < 6; i++) box(0.03, 0.4, 0.03, metal, 1.78 + i * 0.23, 0.78, 2.9);
  for (const x of [1.75, 2.95]) for (const z of [0.6, 2.9]) box(0.06, z > 2 ? 1.0 : 0.5, 0.06, metal, x, z > 2 ? 0.5 : 0.25, z);
  const pillowA = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 16), std('#fff', { map: pillowPrint('planes'), roughness: 1 }));
  pillowA.scale.set(1.0, 0.28, 0.5); pillowA.position.set(2.35, 0.7, 2.6); add(pillowA);
  const pillowB = new THREE.Mesh(new THREE.SphereGeometry(0.45, 28, 16), std('#fff', { map: pillowPrint('lions'), roughness: 1 }));
  pillowB.scale.set(0.95, 0.3, 0.55); pillowB.position.set(2.35, 0.77, 2.25); pillowB.rotation.x = -0.4; add(pillowB);
  const blanket = box(1.18, 0.08, 0.6, std('#F2B8C6', { roughness: 1 }), 2.35, 0.6, 1.0);
  blanket.rotation.z = 0.02;

  // Nightstand + lamp.
  const wood = std('#9A6A40', { roughness: 0.6 });
  box(0.65, 0.6, 0.6, wood, 2.62, 0.3, 0.05);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.32, 16), std('#E8E1D3')); lampBase.position.set(2.62, 0.76, 0.05); add(lampBase);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.22, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#FFE2B0', emissive: '#FFB765', emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  shade.position.set(2.62, 1.0, 0.05); scene.add(shade);

  // Desk with crayons on the west wall.
  box(0.7, 0.05, 1.6, wood, -2.6, 0.75, -0.3);
  for (const z of [-1.05, 0.45]) for (const x of [-2.9, -2.3]) box(0.05, 0.75, 0.05, wood, x, 0.375, z);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14), std('#7FB3E0')); cup.position.set(-2.6, 0.84, -0.8); add(cup);
  ['#C8473D', '#F2C230', '#4E9A5E', '#2347C4'].forEach((c, i) => { const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6), std(c)); cr.position.set(-2.62 + (i % 2) * 0.03, 0.92, -0.81 + Math.floor(i / 2) * 0.03); cr.rotation.z = (i - 1.5) * 0.12; add(cr); });
  const paper = box(0.3, 0.005, 0.4, std('#FFFDF5'), -2.55, 0.78, -0.1); paper.rotation.y = 0.2;

  // Toy box in the corner.
  box(0.7, 0.5, 0.9, std('#5E8C6A'), -2.6, 0.25, 2.4);
  // Round rug.
  const [rc, rg] = makeCanvas(256, 256);
  for (let i = 8; i > 0; i--) { rg.fillStyle = i % 2 ? '#A8D8B9' : '#F3EAD8'; rg.beginPath(); rg.arc(128, 128, i * 16, 0, 7); rg.fill(); }
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), std('#fff', { map: toTexture(rc, { wrap: false }), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.4); add(rug, { cast: false });

  // THE MAP on the north wall.
  const [mc, mg] = makeCanvas(1024, 680); drawAdventureMap(mg, 1024, 680, { mode: 'wall' });
  const mapMat = new THREE.MeshStandardMaterial({ map: toTexture(mc, { wrap: false }), roughness: 0.9, emissive: '#FFE7B0', emissiveIntensity: 0 });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.26), mapMat);
  map.position.set(-0.2, 1.62, -2.955); scene.add(map);
  const tape = new THREE.MeshStandardMaterial({ color: '#EAD9A6', transparent: true, opacity: 0.85 });
  for (const [x, y] of [[-1.1, 2.22], [0.7, 2.22], [-1.1, 1.02], [0.7, 1.02]]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), tape); t.position.set(x, y, -2.95); t.rotation.z = x < 0 ? 0.5 : -0.5; scene.add(t); }

  // A soccer ball you can push around.
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), std('#fff', { map: soccerBall(), roughness: 0.5 }));
  ball.position.set(-1.0, 0.12, 0.9); add(ball);
  const ballState = { vx: 0, vz: 0 };

  // Things you bump into. "top" means you can jump onto it.
  const boxes = [
    { minX: 1.73, maxX: 2.97, minZ: 0.58, maxZ: 2.97, top: 0.56 },   // bed
    { minX: 2.28, maxX: 2.97, minZ: -0.27, maxZ: 0.37, top: 0.6 },   // nightstand
    { minX: -2.97, maxX: -2.24, minZ: -1.12, maxZ: 0.52, top: 0.78 }, // desk
    { minX: -2.97, maxX: -2.24, minZ: 1.94, maxZ: 2.86, top: 0.5 },   // toy box
  ];
  const mapSpot = new THREE.Vector3(-0.2, 0, -2.35);

  return {
    name: 'bedroom', title: "Liev's Room", scene, sun, music: 'home', ambience: 'room',
    spawn: { pos: new THREE.Vector3(0, 0, 1.1), yaw: Math.PI, camYaw: 0 },
    circles: [], boxes, camSpheres: [], indoor: true, maxCamDist: 3.4,
    terrain: () => 0,
    limit(pos, r) {
      pos.x = Math.max(ROOM.minX + r + 0.03, Math.min(ROOM.maxX - r - 0.03, pos.x));
      pos.z = Math.max(ROOM.minZ + r + 0.03, Math.min(ROOM.maxZ - r - 0.03, pos.z));
      return null;
    },
    // How far the camera may go before hitting a wall/ceiling/floor.
    camLimit(target, dir, dist) {
      const lo = [-2.88, 0.18, -2.88], hi = [2.88, 2.75, 2.88], o = [target.x, target.y, target.z], d = [dir.x, dir.y, dir.z];
      let t = dist;
      for (let i = 0; i < 3; i++) {
        if (d[i] > 1e-6) t = Math.min(t, (hi[i] - o[i]) / d[i]);
        else if (d[i] < -1e-6) t = Math.min(t, (lo[i] - o[i]) / d[i]);
      }
      return Math.max(0.3, t);
    },
    interact: [
      { id: 'map', pos: mapSpot, r: 1.45, prompt: () => 'Look at the adventure map', action: 'mapMagic' },
    ],
    goals: () => [{ pos: mapSpot, text: 'Walk up to the big map on the wall and press E!' }],
    mapLook: { target: new THREE.Vector3(-0.2, 1.6, -2.95), cam: new THREE.Vector3(-0.2, 1.55, -0.9) },
    update(dt, ctx) {
      const near = ctx.player.pos.distanceTo(mapSpot) < 2.2;
      mapMat.emissiveIntensity += ((near ? 0.25 + Math.sin(ctx.time * 4) * 0.1 : 0) - mapMat.emissiveIntensity) * Math.min(1, dt * 6);
      // Push the ball when anyone walks into it.
      for (const c of [ctx.player, ctx.friend]) {
        const dx = ball.position.x - c.pos.x, dz = ball.position.z - c.pos.z, d = Math.hypot(dx, dz), min = c.radius + 0.12;
        if (d < min && d > 1e-4 && c.pos.y < 0.3) {
          const push = Math.max(2.5, c.speed * 1.4);
          ballState.vx = dx / d * push; ballState.vz = dz / d * push;
          ball.position.x = c.pos.x + dx / d * min; ball.position.z = c.pos.z + dz / d * min;
        }
      }
      ball.position.x += ballState.vx * dt; ball.position.z += ballState.vz * dt;
      const f = Math.exp(-1.6 * dt); ballState.vx *= f; ballState.vz *= f;
      const lim = 2.85;
      if (Math.abs(ball.position.x) > lim) { ball.position.x = Math.sign(ball.position.x) * lim; ballState.vx *= -0.6; }
      if (Math.abs(ball.position.z) > lim) { ball.position.z = Math.sign(ball.position.z) * lim; ballState.vz *= -0.6; }
      for (const b of boxes) {
        if (ball.position.x > b.minX - 0.12 && ball.position.x < b.maxX + 0.12 && ball.position.z > b.minZ - 0.12 && ball.position.z < b.maxZ + 0.12) {
          const pen = [ball.position.x - (b.minX - 0.12), (b.maxX + 0.12) - ball.position.x, ball.position.z - (b.minZ - 0.12), (b.maxZ + 0.12) - ball.position.z];
          const i = pen.indexOf(Math.min(...pen));
          if (i === 0) { ball.position.x = b.minX - 0.12; ballState.vx = -Math.abs(ballState.vx) * 0.6; }
          if (i === 1) { ball.position.x = b.maxX + 0.12; ballState.vx = Math.abs(ballState.vx) * 0.6; }
          if (i === 2) { ball.position.z = b.minZ - 0.12; ballState.vz = -Math.abs(ballState.vz) * 0.6; }
          if (i === 3) { ball.position.z = b.maxZ + 0.12; ballState.vz = Math.abs(ballState.vz) * 0.6; }
        }
      }
      const sp = Math.hypot(ballState.vx, ballState.vz);
      if (sp > 0.01) { ball.rotation.x += ballState.vz * dt / 0.12; ball.rotation.z -= ballState.vx * dt / 0.12; }
    },
  };
}
