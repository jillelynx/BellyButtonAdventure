// PLATFORMER MODE — side-view running and jumping (2.5D: 3D world, side camera).
import * as THREE from 'three';
import { Input } from './input.js';
import { LEVELS } from './levels.js';
import { buildCharacter, friendOf } from './characters/index.js';
import { felt, stitchStrip, gradient, buttonFace, paperSign, soccerBall, plushDash, makeCanvas, toTexture } from './textures.js';
import { clamp, damp, dampAngle, rng } from './util.js';
import { Records, RunTimer, RestTracker, formatTime } from './progress.js';

const G = 30, JUMP_V = 11, RUN = 6.5, SPRINT = 8.5, FLOAT_FALL = 2.2, DIVE_V = 16, CUSHION_BOUNCE = 12, BELLY_BOUNCE = 18.5;
const DEPTH = 3; // how deep the felt blocks are (toward / away from camera)

export class Platformer {
  constructor(game) {
    this.g = game;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    this.scene = null;
  }
  enter(opts) {
    this.levelId = opts.level; this.def = LEVELS[opts.level]; this.returnTo = opts.returnTo;
    this.build();
    const ch = this.g.choice;
    this.pc = buildCharacter(ch.player, ch); this.fc = buildCharacter(friendOf(ch.player), ch);
    this.scene.add(this.pc.root, this.fc.root);
    const d = this.def;
    this.p = { x: d.start[0], y: d.start[1], vx: 0, vy: 0, onGround: true, face: 1, coyote: 0, buffer: 0, diving: false, floating: false, climbing: false, kickCd: 0, hw: this.pc.kind === 'liev' ? 0.24 : 0.22, h: this.pc.height * 0.97, inv: 0 };
    this.checkpoint = 0; this.collected = new Set(); this.bridgeOn = false; this.done = false; this.ball = null; this.time = 0;
    this.timer = new RunTimer(!!this.g.settings.timer); this.rests = new RestTracker(); this.resting = null; this.restHold = 0; this.treatFx = [];
    this.friendCp = 0; this.placeFriend(0);
    if (opts.checkpoint) { const cp = d.checkpoints[opts.checkpoint]; this.checkpoint = opts.checkpoint; this.p.x = cp[0]; this.p.y = cp[1]; this.placeFriend(opts.checkpoint); }
    this.camPos = new THREE.Vector3(this.p.x + 2, this.p.y + 2.9, 10.5); this.camLook = new THREE.Vector3(this.p.x + 2, this.p.y + 1.4, 0);
    this.g.audio.music('platformer'); this.g.audio.ambience('outdoor');
    this.updateHud();
  }
  exit() { if (this.scene) this.dispose(); this.g.ui.prompt(null); this.g.ui.timer(null); }
  dispose() {
    for (const c of [this.pc, this.fc]) if (c) c.dispose();
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.scene = null;
  }
  showTimer() {
    if (!this.timer.enabled) { this.g.ui.timer(null); return; }
    const best = Records.bestTime(this.levelId);
    this.g.ui.timer(`⏱ ${formatTime(this.timer.t)}${best != null ? ` &nbsp;<small>best ${formatTime(best)}</small>` : ''}`);
  }
  helpText() {
    const liev = this.pc.kind === 'liev';
    const moves = liev ? '<span class="key">X</span> kick ball · push into chalk wall to climb' : '<span class="key">↓</span> in the air: Belly Bounce · hold <span class="key">Space</span>: float';
    return `<span class="key">← →</span> move · <span class="key">Space</span> jump · <span class="key">Shift</span> run · ${moves}`;
  }
  updateHud() {
    const n = this.def.buttons.length, nr = this.def.checkpoints.length - 1;
    this.g.ui.hud(true, `${this.def.name} &nbsp;·&nbsp; 🔘 ${this.collected.size} / ${n} &nbsp;·&nbsp; 🍪 ${this.rests.treats} / ${nr}`, this.helpText());
    if (this.timer) { this.timer.enabled = !!this.g.settings.timer; this.showTimer(); }
  }

  // ---------- Building the level ----------
  build() {
    const d = this.def, scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#D8ECF5', 30, 110);
    const R = rng(77);
    const plush = (color, map = null) => new THREE.MeshPhysicalMaterial({ color, map, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.55 });
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
    const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    // Sky and soft background hills.
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(600, 160), new THREE.MeshBasicMaterial({ map: gradient([[0, '#8EC3EA'], [0.6, '#C9E6F5'], [1, '#FCE9CF']]), fog: false }));
    sky.position.set(40, 20, -90); scene.add(sky);
    const hillLayer = (z, color, amp, base, seed) => {
      const sh = new THREE.Shape(); sh.moveTo(-60, -20);
      const r = rng(seed); for (let x = -60; x <= 150; x += 6) sh.lineTo(x, base + Math.sin(x * 0.07 + seed) * amp + r() * amp * 0.4);
      sh.lineTo(150, -20); sh.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 4), plush(color)); m.position.z = z; scene.add(m);
    };
    hillLayer(-55, '#C9D9F0', 7, 8, 1); hillLayer(-38, '#BFE3CC', 5, 4, 2); hillLayer(-24, '#A8D8B9', 3, 1, 3);
    for (let i = 0; i < 9; i++) { // clouds
      const c = new THREE.Group(); const cm = plush('#ffffff');
      for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.4 + R(), 16, 12), cm); s.position.set(k * 1.6, R() * 0.5, 0); s.scale.y = 0.7; c.add(s); }
      c.position.set(-10 + i * 12 + R() * 6, 14 + R() * 5, -30 - R() * 10); scene.add(c);
    }
    // Fluffy cloud sea in the pits (falling in is gentle).
    const fluffMat = plush('#FFFFFF');
    for (let x = -4; x < 86; x += 2.2) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.6 + R() * 0.6, 16, 12), fluffMat); s.position.set(x, -3.6 + R() * 0.4, (R() - 0.5) * 2); s.scale.y = 0.6; scene.add(s); }

    // Lights.
    scene.add(new THREE.HemisphereLight('#EAF6FF', '#A8C59A', 1.05));
    const sun = this.sun = new THREE.DirectionalLight('#FFE7B8', 2.0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -10, near: 1, far: 80 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);

    // Felt blocks with a stitched mint top.
    const side = plush('#F3EAD8', (() => { const t = felt('#F3EAD8', 5, 0.08); t.repeat.set(0.5, 0.5); return t; })());
    const wallMat = plush('#E2D4F0', (() => { const t = felt('#E2D4F0', 6, 0.08); t.repeat.set(0.5, 0.5); return t; })());
    const topTex = stitchStrip('#A8D8B9'); topTex.repeat.set(0.5, 1);
    const topMat = plush('#ffffff', topTex);
    const chalkTex = plushDash('#4A4D57', '#FFFFFF', 31, 256, 120); chalkTex.repeat.set(0.4, 0.4);
    const chalkMat = plush('#ffffff', chalkTex);
    const stitchGeo = new THREE.CapsuleGeometry(0.04, 0.26, 3, 6); stitchGeo.rotateZ(Math.PI / 2);
    const stitchMat = std('#FFFFFF', { roughness: 0.7 });
    const roundBox = (x0, x1, y0, y1, mat) => {
      const w = x1 - x0, h = y1 - y0, r = Math.min(0.22, w / 4, h / 4);
      const s = new THREE.Shape();
      s.moveTo(r, 0); s.lineTo(w - r, 0); s.quadraticCurveTo(w, 0, w, r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
      s.lineTo(r, h); s.quadraticCurveTo(0, h, 0, h - r); s.lineTo(0, r); s.quadraticCurveTo(0, 0, r, 0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: DEPTH - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 6 });
      const m = shadowy(new THREE.Mesh(geo, mat)); m.position.set(x0, y0, -DEPTH / 2 + 0.08); scene.add(m); return m;
    };
    this.solids = [];
    for (const b of d.blocks) {
      this.solids.push({ ...b });
      if (b.kind === 'wall') { roundBox(b.x0, b.x1, b.y0, b.y1, wallMat); continue; }
      roundBox(b.x0, b.x1, b.y0, b.y1, side);
      const top = shadowy(new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0 + 0.08, 0.42, DEPTH + 0.1), topMat));
      top.position.set((b.x0 + b.x1) / 2, b.y1 - 0.2, 0); scene.add(top);
      // A row of big stitches along the front, so each block reads clearly.
      for (let x = b.x0 + 0.35; x < b.x1 - 0.3; x += 0.7) { const st = new THREE.Mesh(stitchGeo, stitchMat); st.position.set(x, b.y1 - 0.62, DEPTH / 2 + 0.02); scene.add(st); }
      if (b.chalk) { // chalk-marked climbing face
        const face = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH - 0.2, b.y1 - 2.2), chalkMat);
        face.position.set(b.x0 - 0.075, (b.y1 + 2.2) / 2 - 0.1, 0); face.rotation.y = -Math.PI / 2; scene.add(face);
        // Chalk strip on the FRONT too, so you can see from the camera that it is climbable.
        const front = new THREE.Mesh(new THREE.PlaneGeometry(1.1, b.y1 - 2.4), chalkMat);
        front.position.set(b.x0 + 0.55, (b.y1 + 2.0) / 2 - 0.3, DEPTH / 2 + 0.03); scene.add(front);
        const holdMat = std('#FFFFFF', { roughness: 0.6 });
        for (let y = 2.4; y < b.y1 - 0.5; y += 0.55) { const hold = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), holdMat); hold.scale.z = 0.4; hold.position.set(b.x0 + 0.3 + ((y * 10) % 2 > 1 ? 0.45 : 0), y, DEPTH / 2 + 0.05); scene.add(hold); }
        for (let y = 2.6; y < b.y1 - 0.3; y += 0.6) for (const z of [-0.6, 0.6]) {
          const hold = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), holdMat); hold.scale.x = 0.5;
          hold.position.set(b.x0 - 0.1, y + (z > 0 ? 0.3 : 0), z * 0.9); scene.add(hold);
        }
      }
    }
    // Cushion for the Belly Bounce.
    const c = d.cushion;
    const cush = shadowy(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), plush('#F2A7B5', (() => { const t = felt('#F2A7B5', 44, 0.08); return t; })())));
    cush.scale.set((c.x1 - c.x0) / 2, c.h, DEPTH / 2 - 0.15); cush.position.set((c.x0 + c.x1) / 2, c.y + 0.02, 0); scene.add(cush);
    this.cushionMesh = cush;
    this.solids.push({ x0: c.x0, x1: c.x1, y0: c.y, y1: c.y + c.h, kind: 'cushion' });
    // Kick target on a post.
    const t = d.target;
    const [tc, tg] = makeCanvas(256, 256);
    ['#C8473D', '#FFFFFF', '#C8473D', '#FFFFFF', '#C8473D'].forEach((col, i) => { tg.fillStyle = col; tg.beginPath(); tg.arc(128, 128, 124 - i * 25, 0, 7); tg.fill(); });
    this.targetMesh = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, 0.12, 32), [std('#C8473D'), new THREE.MeshStandardMaterial({ map: toTexture(tc, { wrap: false }) }), std('#C8473D')]);
    this.targetMesh.rotation.z = Math.PI / 2; this.targetMesh.rotation.y = 0; this.targetMesh.position.set(t.x, t.y, 0.3); scene.add(shadowy(this.targetMesh));
    this.targetMesh.rotation.set(0, 0, Math.PI / 2);
    const post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, t.y - 5, 8), std('#B07A4A'))); post.position.set(t.x + 0.1, 5 + (t.y - 5) / 2 - t.r / 2, 0.3); scene.add(post);
    // Hidden bridge (pops out when the target is hit).
    const br = d.bridge; this.bridge = new THREE.Group();
    const plank = plush('#F2C230', felt('#F2C230', 51, 0.08));
    for (let x = br.x0; x < br.x1 - 0.01; x += 1) { const pl = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.92, br.y1 - br.y0, DEPTH * 0.7), plank)); pl.position.set(x + 0.5, (br.y0 + br.y1) / 2, 0); this.bridge.add(pl); }
    this.bridge.visible = false; this.bridge.scale.y = 0.01; scene.add(this.bridge);
    // Collectible buttons.
    const cols = ['#F2A7B5', '#7FB3E0', '#FFD98A', '#C9B3EF', '#F6B98A'];
    this.buttonMeshes = d.buttons.map(([x, y], i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 24), [std(cols[i % 5]), new THREE.MeshStandardMaterial({ map: buttonFace(cols[i % 5]), roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: buttonFace(cols[i % 5]), roughness: 0.4 })]);
      m.rotation.x = Math.PI / 2; m.position.set(x, y, 0); m.castShadow = true; scene.add(m); return m;
    });
    // Cozy rest spots (they are also the checkpoints). Unused ones show a floating "zzz" and sparkles.
    const REST_KINDS = ['pillowfort', 'blanket', 'picnic'];
    const zTex = (() => { const [c, g] = makeCanvas(128, 128); g.fillStyle = '#FFF8EC'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = '#3A3D45'; g.stroke();
      g.fillStyle = '#7FB3E0'; g.font = 'bold 54px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 44, 74); g.font = 'bold 38px "Arial Black", Arial'; g.fillText('z', 76, 52); g.font = 'bold 26px "Arial Black", Arial'; g.fillText('z', 98, 34); return toTexture(c, { wrap: false }); })();
    const checker = (() => { const [c, g] = makeCanvas(128, 128); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#C8473D' : '#FFF8EC'; g.fillRect(x * 16, y * 16, 16, 16); } return toTexture(c); })();
    this.restSpots = d.checkpoints.map(([x, y], i) => {
      if (i === 0) return null;
      const kind = REST_KINDS[(i - 1) % 3];
      const g = new THREE.Group(); g.position.set(x, y, -0.75);
      if (kind === 'pillowfort') {
        for (const [px, c] of [[-0.45, '#CFE0F5'], [0.45, '#F2C9D2']]) { const pl = shadowy(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), plush(c))); pl.scale.set(0.42, 0.55, 0.3); pl.position.set(px, 0.5, 0); pl.rotation.z = px > 0 ? -0.35 : 0.35; g.add(pl); }
        const roof = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.1, 24, 1, true, -Math.PI / 2, Math.PI), plush('#F6E3B4'))); roof.material.side = THREE.DoubleSide; roof.rotation.x = Math.PI / 2; roof.position.y = 0.55; roof.scale.set(1, 1, 0.9); g.add(roof);
      } else if (kind === 'blanket') {
        const arch = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 24, Math.PI), std('#B07A4A'))); arch.position.y = 0.05; g.add(arch);
        const cloth = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.9, 24, 1, true, -Math.PI / 2, Math.PI), plush('#FFD98A'))); cloth.material.side = THREE.DoubleSide; cloth.rotation.x = Math.PI / 2; cloth.position.set(0, 0.05, -0.1); g.add(cloth);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: '#FFE7B0', emissive: '#FFC46B', emissiveIntensity: 1.4 })); lamp.position.set(0.5, 0.12, 0.35); g.add(lamp);
      } else {
        const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ map: checker, roughness: 1 })); mat2.rotation.x = -Math.PI / 2; mat2.position.y = 0.02; mat2.receiveShadow = true; g.add(mat2);
        const basket = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.3, 14), std('#B07A4A'))); basket.position.set(-0.35, 0.17, -0.1); g.add(basket);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16, Math.PI), std('#8C5A30')); handle.position.set(-0.35, 0.32, -0.1); g.add(handle);
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 18), std('#FFFFFF')); plate.position.set(0.35, 0.04, 0.1); g.add(plate);
      }
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false })); bubble.scale.set(0.7, 0.7, 1); bubble.position.set(0, 1.75, 0.3); g.add(bubble);
      const glow = new THREE.PointLight('#FFD98A', 2.5, 3.5, 1.6); glow.position.set(0, 0.8, 0.6); g.add(glow);
      scene.add(g); return { g, kind, bubble, glow, x, y };
    });
    this.flags = this.restSpots; // older code refers to checkpoints as "flags"
    // Signs.
    for (const s of d.signs) {
      const g = new THREE.Group(); g.position.set(s.x, s.y, -1.05);
      const post2 = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 8), std('#B07A4A'))); post2.position.y = 0.8; g.add(post2);
      const tall = s.lines.length > 2;
      const board = shadowy(new THREE.Mesh(new THREE.BoxGeometry(3.6, tall ? 1.55 : 1.1, 0.06), [std('#B07A4A'), std('#B07A4A'), std('#B07A4A'), std('#B07A4A'), new THREE.MeshStandardMaterial({ map: paperSign(s.lines, { w: 900, h: tall ? 390 : 275, size: 44 }) }), std('#B07A4A')]));
      board.position.y = tall ? 2.05 : 1.85; g.add(board); scene.add(g);
    }
    // Treasure Stamp: a big golden star.
    const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.28 : 0.62; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    this.stamp = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(st, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: '#F2C230', metalness: 0.5, roughness: 0.3, emissive: '#B07A10', emissiveIntensity: 0.4 })));
    this.stamp.position.set(d.stamp[0], d.stamp[1], 0); scene.add(this.stamp);
    const sl = new THREE.PointLight('#FFD98A', 6, 6, 1.5); sl.position.set(d.stamp[0], d.stamp[1], 1.2); scene.add(sl);
    // Kickable ball.
    this.ballMesh = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), std('#ffffff', { map: soccerBall(), roughness: 0.5 })));
    this.ballMesh.visible = false; scene.add(this.ballMesh);
    // Poof particles.
    this.poofs = [];
  }

  placeFriend(i) {
    const cp = this.def.checkpoints[i]; this.friendCp = i;
    this.fc.root.position.set(cp[0] + (i === 0 ? -1.2 : 1.35), cp[1], -0.9);
    this.fcBase = this.fc.root.position.clone();
  }
  poof(x, y, z = 0) {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m); const a = i / 8 * Math.PI * 2; s.userData.v = new THREE.Vector3(Math.cos(a) * 2, Math.sin(a) * 2, 0); g.add(s); }
    g.position.set(x, y, z); this.scene.add(g); this.poofs.push({ g, t: 0, m });
  }

  // ---------- Collision ----------
  activeSolids() { return this.bridgeOn ? [...this.solids, { ...this.def.bridge, kind: 'bridge' }] : this.solids; }
  overlaps(p, s) { return p.x + p.hw > s.x0 && p.x - p.hw < s.x1 && p.y + p.h > s.y0 && p.y < s.y1; }

  step(p, dt) {
    const solids = this.activeSolids();
    const n = Math.max(1, Math.ceil(Math.abs(p.vx * dt) / 0.08), Math.ceil(Math.abs(p.vy * dt) / 0.08));
    const sdt = dt / n; let landedOn = null; p.wallTouch = null;
    for (let i = 0; i < n; i++) {
      p.x += p.vx * sdt;
      for (const s of solids) if (this.overlaps(p, s)) {
        // Low ledges (like the cushion) are stepped onto instead of blocking you.
        const lift = s.y1 - p.y;
        if (lift > 0 && lift <= 0.5 && p.vy <= 0.5) {
          const oy = p.y; p.y = s.y1 + 1e-4;
          if (!solids.some(o => o !== s && this.overlaps(p, o))) continue;
          p.y = oy;
        }
        if (p.vx > 0 || (p.vx === 0 && p.x < (s.x0 + s.x1) / 2)) { p.x = s.x0 - p.hw - 1e-4; p.wallTouch = { s, side: 1 }; }
        else { p.x = s.x1 + p.hw + 1e-4; p.wallTouch = { s, side: -1 }; }
        p.vx = 0;
      }
      p.y += p.vy * sdt;
      for (const s of solids) if (this.overlaps(p, s)) {
        if (p.vy <= 0) { p.y = s.y1; landedOn = s; } else { p.y = s.y0 - p.h - 1e-4; this.g.audio.sfx('bonk'); }
        p.vy = 0;
      }
    }
    // Standing on something?
    const wasGround = p.onGround; p.onGround = false; p.standing = null;
    for (const s of solids) if (p.x + p.hw > s.x0 && p.x - p.hw < s.x1 && Math.abs(p.y - s.y1) < 0.02 && p.vy <= 0) { p.onGround = true; p.standing = s; }
    // Still touching a wall to the side (for climbing)?
    if (!p.wallTouch) for (const s of solids) if (p.y + p.h > s.y0 && p.y < s.y1 - 0.01) {
      if (Math.abs(p.x + p.hw - s.x0) < 0.02) p.wallTouch = { s, side: 1 };
      if (Math.abs(p.x - p.hw - s.x1) < 0.02) p.wallTouch = { s, side: -1 };
    }
    return { landedOn, wasGround };
  }

  // ---------- Update ----------
  update(dt) {
    if (!this.scene) return;
    this.time += dt;
    const p = this.p, ui = this.g.ui, paused = this.g.paused || this.done;
    if (!paused) this.updatePlayer(dt);
    else if (this.done) { p.vx = 0; }
    this.updateWorld(dt, paused);
    // Characters.
    this.pc.root.position.set(p.x, p.y, 0);
    this.pc.root.rotation.y = dampAngle(this.pc.root.rotation.y, p.climbing ? Math.PI / 2 + 0.6 : p.face > 0 ? Math.PI / 2 - 0.45 : -Math.PI / 2 + 0.45, 14, dt);
    if (!this.g.paused) this.pc.animate(dt, { speed: Math.abs(p.vx), onGround: p.onGround, floating: p.floating, climbing: p.climbing, cheer: this.done });
    const fp = this.fc.root.position; const dx = p.x - fp.x;
    this.fc.root.rotation.y = dampAngle(this.fc.root.rotation.y, Math.abs(dx) < 0.3 ? 0 : Math.atan2(dx, 1.5), 5, dt);
    const near = Math.abs(dx) < 4;
    fp.y = this.fcBase.y + (this.done || near ? Math.max(0, Math.sin(this.time * 7)) * 0.2 : 0);
    if (!this.g.paused) this.fc.animate(dt, { speed: 0, onGround: true, cheer: this.done || near });
    // Camera follows, looks ahead, and looks down when falling.
    const ahead = p.face * 2.2;
    const fall = p.vy < -7 ? -2.2 : 0;
    const tp = new THREE.Vector3(p.x + ahead, p.y + 2.9 + fall * 0.4, 10.5), tl = new THREE.Vector3(p.x + ahead, p.y + 1.4 + fall, 0);
    this.camPos.x = damp(this.camPos.x, tp.x, 4, dt); this.camPos.y = damp(this.camPos.y, tp.y, 3.5, dt); this.camPos.z = tp.z;
    this.camLook.x = damp(this.camLook.x, tl.x, 4, dt); this.camLook.y = damp(this.camLook.y, tl.y, 3.5, dt);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    this.sun.position.set(p.x + 10, p.y + 18, 14); this.sun.target.position.set(p.x, p.y, 0);
    ui.update(this.g.paused ? 0 : dt);
  }

  updatePlayer(dt) {
    const p = this.p, d = this.def, liev = this.pc.kind === 'liev', a = this.g.audio;
    // Resting at a cozy spot: a short, cute pause, then a treat.
    if (this.resting) { this.updateRest(dt); return; }
    const ax = Input.axis();
    // The race timer starts on the first move, not when the level loads.
    if (ax.x || ax.y || Input.hit('Space', 'KeyX', 'KeyK', 'ArrowDown', 'KeyS')) this.timer.start();
    this.timer.tick(dt);
    const max = Input.key('ShiftLeft', 'ShiftRight') ? SPRINT : RUN;
    const target = ax.x * max;
    p.vx = damp(p.vx, target, p.onGround ? 16 : 7, dt);
    if (Math.abs(ax.x) > 0) p.face = ax.x > 0 ? 1 : -1;
    // Liev climbs chalk walls (push into the wall, or hold up).
    const tw = p.wallTouch;
    const canClimb = liev && tw && tw.s.chalk && tw.side === 1 && (ax.x > 0 || ax.y > 0);
    if (canClimb) {
      p.climbing = true; p.vy = 3.6; p.diving = false;
      if (p.y + 0.2 >= tw.s.y1 - 0.05) { p.y = tw.s.y1 + 0.01; p.x = tw.s.x0 + p.hw + 0.06; p.vy = 0; p.climbing = false; }
    } else p.climbing = false;
    // Jumping (forgiving timing).
    p.buffer = Input.hit('Space', 'KeyW', 'ArrowUp') && !canClimb ? 0.14 : p.buffer - dt;
    if (Input.hit('Space')) p.buffer = 0.14;
    p.coyote = p.onGround ? 0.12 : p.coyote - dt;
    if (p.buffer > 0 && p.coyote > 0 && !p.climbing) { p.vy = JUMP_V; p.onGround = false; p.buffer = 0; p.coyote = 0; a.sfx('jump'); }
    if (!Input.key('Space', 'KeyW', 'ArrowUp') && p.vy > 0 && !p.climbing && !p.bounced) p.vy -= G * 1.1 * dt;
    // Belly Button: dive (Belly Bounce) and float.
    if (!liev && !p.onGround && Input.hit('ArrowDown', 'KeyS') && !p.diving) { p.diving = true; p.vy = Math.min(p.vy, -DIVE_V); a.sfx('jump'); }
    p.floating = !liev && !p.onGround && !p.diving && p.vy < 0 && Input.key('Space');
    if (!p.climbing) p.vy -= G * dt;
    if (p.floating) p.vy = Math.max(p.vy, -FLOAT_FALL);
    // Liev: kick the ball.
    p.kickCd -= dt;
    if (liev && Input.hit('KeyX', 'KeyK') && p.kickCd <= 0 && !this.ball) {
      p.kickCd = 0.5; this.pc.kick(); a.sfx('kick');
      this.ball = { x: p.x + p.face * 0.45, y: p.y + 0.3, vx: p.face * 14, vy: 4, t: 0 };
      this.ballMesh.visible = true;
    }
    const { landedOn, wasGround } = this.step(p, dt);
    if (landedOn && !wasGround) {
      const fallSpeed = p.lastVy || 0;
      if (landedOn.kind === 'cushion') {
        p.vy = p.diving ? BELLY_BOUNCE : CUSHION_BOUNCE; p.onGround = false; p.bounced = true;
        a.sfx('boing'); this.cushionSquish = 1; this.pc.land(1);
        if (p.diving) this.g.ui.toast('<b>BELLY BOUNCE!</b>', 1.6);
      } else {
        this.pc.land(clamp(-fallSpeed / 15, 0.2, 1));
        a.sfx(p.diving ? 'squish' : 'land');
        p.bounced = false;
      }
      p.diving = false;
    }
    if (p.onGround) p.bounced = false;
    p.lastVy = p.vy;
    // Fell into the clouds: gentle respawn at the last flag.
    if (p.y < d.deathY) {
      const cp = d.checkpoints[this.checkpoint];
      this.poof(cp[0], cp[1] + 0.6); a.sfx('poof');
      p.x = cp[0]; p.y = cp[1]; p.vx = 0; p.vy = 0; p.diving = false; p.floating = false;
      this.g.ui.toast('Whoops! Back to the last flag.', 2);
    }
    // Checkpoints.
    d.checkpoints.forEach(([cx, cy], i) => {
      if (i > this.checkpoint && p.x >= cx - 0.3 && p.y >= cy - 0.5) {
        this.checkpoint = i; a.sfx('found');
        
        this.poof(this.fc.root.position.x, this.fc.root.position.y + 0.6, -0.9); this.placeFriend(i); this.poof(this.fc.root.position.x, this.fc.root.position.y + 0.6, -0.9);
      }
    });
    // Standing still on a rest spot starts a rest (once per spot per run).
    const spot = this.restSpots.findIndex(r => r && this.rests.canRest(this.restSpots.indexOf(r)) && Math.abs(p.x - r.x) < 0.85 && Math.abs(p.y - r.y) < 0.1);
    if (spot > 0 && p.onGround && Math.abs(p.vx) < 0.4 && !ax.x) { this.restHold += dt; if (this.restHold > 0.6) { this.resting = { i: spot, t: 0, given: false }; this.restHold = 0; p.vx = 0; a.sfx('ui'); } }
    else this.restHold = 0;
    // Buttons.
    const cy = p.y + p.h / 2;
    d.buttons.forEach(([bx, by], i) => {
      if (this.collected.has(i)) return;
      if (Math.abs(bx - p.x) < 0.25 + p.hw + 0.05 && Math.abs(by - cy) < p.h / 2 + 0.25) { this.collected.add(i); this.buttonMeshes[i].visible = false; a.sfx('collect'); this.updateHud(); }
    });
    // Treasure Stamp!
    if (Math.abs(d.stamp[0] - p.x) < 0.9 && Math.abs(d.stamp[1] - cy) < 1.2) this.complete();
    if (Input.hit('KeyH')) this.g.ui.toast(this.pc.kind === 'liev' ? 'Liev: climb chalk walls by pushing into them, and kick (X) the red target to make a bridge!' : 'Belly Button: press DOWN in the air to Belly Bounce on cushions, and HOLD Space to float across gaps!', 5);
  }

  updateWorld(dt, paused) {
    const t = this.time;
    this.buttonMeshes.forEach((m, i) => { m.rotation.z = t * 2 + i; m.position.y = this.def.buttons[i][1] + Math.sin(t * 2.5 + i) * 0.08; });
    this.stamp.rotation.y = t * 1.6; this.stamp.position.y = this.def.stamp[1] + Math.sin(t * 2) * 0.12;
    this.cushionSquish = damp(this.cushionSquish || 0, 0, 6, dt);
    this.cushionMesh.scale.y = this.def.cushion.h * (1 - this.cushionSquish * 0.45);
    for (const [i, r] of this.restSpots.entries()) if (r) {
      const unused = this.rests.canRest(i);
      r.bubble.visible = unused; r.bubble.position.y = 1.75 + Math.sin(t * 2 + i) * 0.1;
      r.glow.intensity = unused ? 2 + Math.sin(t * 3 + i) : 0;
    }
    for (let i = this.treatFx.length - 1; i >= 0; i--) { const f = this.treatFx[i]; f.t += dt; f.m.position.y = f.y0 + Math.sin(Math.min(1, f.t) * Math.PI) * 1.2 + f.t * 0.3; f.m.rotation.y += dt * 5; if (f.t > 1.1) { this.scene.remove(f.m); this.treatFx.splice(i, 1); } }
    if (this.timer && this.timer.started && Math.floor(t * 10) !== this._lastTimerTick) { this._lastTimerTick = Math.floor(t * 10); this.showTimer(); }
    if (this.bridgeOn && this.bridge.scale.y < 1) this.bridge.scale.y = Math.min(1, this.bridge.scale.y + dt * 3);
    // Ball physics.
    const b = this.ball;
    if (b && !paused) {
      b.t += dt; b.vy -= 7 * dt;
      const ox = b.x, oy = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
      for (const s of this.activeSolids()) if (b.x + 0.17 > s.x0 && b.x - 0.17 < s.x1 && b.y - 0.17 < s.y1 && b.y + 0.17 > s.y0) {
        if (oy - 0.17 >= s.y1 - 0.02) { b.y = s.y1 + 0.17; b.vy = Math.abs(b.vy) * 0.55; } else { b.x = ox; b.vx *= -0.35; }
      }
      const tg = this.def.target;
      if (!this.bridgeOn && Math.hypot(b.x - tg.x, b.y - tg.y) < tg.r + 0.2) {
        this.bridgeOn = true; this.bridge.visible = true; this.g.audio.sfx('hit');
        this.g.ui.toast('<b>GOAL!</b> A bridge popped out!', 2.5); b.vx *= -0.3;
      }
      this.ballMesh.position.set(b.x, b.y, 0.3); this.ballMesh.rotation.z -= b.vx * dt / 0.17;
      if (b.t > 2.6 || b.y < -5) { this.ball = null; this.ballMesh.visible = false; }
    }
    for (let i = this.poofs.length - 1; i >= 0; i--) {
      const pf = this.poofs[i]; pf.t += dt;
      pf.g.children.forEach(s => { s.position.addScaledVector(s.userData.v, dt); s.scale.setScalar(1 + pf.t * 2); });
      pf.m.opacity = Math.max(0, 0.9 - pf.t * 1.8);
      if (pf.t > 0.5) { this.scene.remove(pf.g); pf.g.children[0].geometry.dispose(); pf.m.dispose(); this.poofs.splice(i, 1); }
    }
  }

  updateRest(dt) {
    const r = this.resting, p = this.p, spot = this.restSpots[r.i];
    r.t += dt; p.vx = 0;
    if (Math.floor(r.t / 0.45) !== Math.floor((r.t - dt) / 0.45)) this.pc.land(0.5); // sleepy breathing
    this.timer.tick(dt);
    if (r.t > 1.0 && !r.given) {
      r.given = true;
      if (this.rests.rest(r.i)) {
        const kind = spot.kind, m = this.makeTreat(kind);
        m.position.set(spot.x, spot.y + 0.6, 0.4); this.scene.add(m); this.treatFx.push({ m, t: 0, y0: spot.y + 0.6 });
        this.g.audio.sfx('collect'); this.g.ui.toast(kind === 'picnic' ? '🍪 Yum, a cookie!' : kind === 'blanket' ? '🍯 Yum, honey!' : '☕ Yum, cocoa!', 1.8);
        this.updateHud();
      }
    }
    if (r.t > 1.6) this.resting = null;
  }
  makeTreat(kind) {
    const g = new THREE.Group();
    const m = (c, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...e });
    if (kind === 'picnic') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 20), m('#D9A35B')); c.rotation.x = Math.PI / 2; g.add(c); for (let i = 0; i < 5; i++) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), m('#5A3A22')); ch.position.set(Math.cos(i * 1.3) * 0.12, Math.sin(i * 1.3) * 0.12, 0.04); g.add(ch); } }
    else if (kind === 'blanket') { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 16), m('#F2B830', { emissive: '#7A5000', emissiveIntensity: 0.3 })); g.add(jar); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 16), m('#C8473D')); lid.position.y = 0.17; g.add(lid); }
    else { const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.28, 16), m('#FFFFFF')); g.add(mug); const top = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), m('#7A4A2A')); top.rotation.x = -Math.PI / 2; top.position.y = 0.141; g.add(top); const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), m('#FFFFFF')); h.position.x = 0.19; g.add(h); }
    return g;
  }

  complete() {
    if (this.done) return;
    this.done = true; this.stamp.visible = false;
    const ps = this.g.saves.platformer;
    const prev = ps.levels[this.levelId] || {};
    ps.levels[this.levelId] = { done: true, buttons: Math.max(prev.buttons || 0, this.collected.size), total: this.def.buttons.length, treats: Math.max(prev.treats || 0, this.rests.treats) };
    Records.submitTreats(this.levelId, this.rests.treats);
    let timeInfo = null;
    if (this.timer.enabled && this.timer.started) {
      const old = Records.bestTime(this.levelId), t = this.timer.stop();
      timeInfo = { t, old, record: Records.submitTime(this.levelId, t) };
      this.showTimer();
    }
    if (!ps.stamps.includes(this.levelId)) ps.stamps.push(this.levelId);
    this.g.writeSave('platformer');
    this.g.audio.sfx('stamp');
    this.g.ui.prompt(null);
    this.g.showComplete(this.def, this.collected.size, this.def.buttons.length, { treats: this.rests.treats, treatsTotal: this.def.checkpoints.length - 1, time: timeInfo });
  }
}
