// Liev, age 11 — built from his look settings (looks.js) and the player's choices.
import * as THREE from 'three';
import { LIEV as L } from './looks.js';
import { makeCanvas, toTexture, camo, digitalCamo } from '../textures.js';
import { damp } from '../util.js';

const FONT = (s) => `bold ${s}px "Arial Black","Helvetica Neue",Arial,sans-serif`;
const texCache = new Map();
function cached(key, fn) { if (!texCache.has(key)) texCache.set(key, fn()); return texCache.get(key); }

// ---- Head texture: skin, freckles, blush, and the hair on the sides. ----
// Sphere texture layout: x=0 his right side, x=0.25 front (face), x=0.5 his LEFT side, x=0.75 back.
function headTexture(hair) {
  return cached('head-' + hair, () => {
    const W = 1024, H = 512; const [c, g] = makeCanvas(W, H);
    g.fillStyle = L.skin; g.fillRect(0, 0, W, H);
    const faceC = 0.25 * W, faceHalf = 0.115 * W, feather = 0.05 * W;
    const faceDist = (x) => { let d = Math.abs(x - faceC); return Math.min(d, W - d); };
    const backness = (x) => { let d = Math.abs(x - 0.75 * W); d = Math.min(d, W - d); return 1 - Math.min(1, d / (0.5 * W)); };
    for (let x = 0; x < W; x++) {
      const fd = faceDist(x);
      const side = Math.max(0, Math.min(1, (fd - faceHalf) / feather)); // 0 on face, 1 elsewhere
      if (side <= 0) continue;
      const b = backness(x);
      if (hair === 'everyday') {
        const yEnd = (0.48 + 0.24 * b) * H; // down to the ear tops at the sides, the nape at the back
        const gr = g.createLinearGradient(0, 0, 0, yEnd);
        gr.addColorStop(0, L.hair); gr.addColorStop(0.88, L.hair); gr.addColorStop(1, 'rgba(59,42,32,0)');
        g.globalAlpha = side; g.fillStyle = gr; g.fillRect(x, 0, 1, yEnd);
      } else {
        // Skin fade: dark at the top of the sides, fading to skin lower down.
        // (the shiny top hair covers down to about 0.32 of the height)
        const yEnd = (0.6 + 0.12 * b) * H;
        const gr = g.createLinearGradient(0, 0, 0, yEnd);
        gr.addColorStop(0, 'rgba(59,42,32,1)'); gr.addColorStop(0.62, 'rgba(59,42,32,0.92)'); gr.addColorStop(0.82, 'rgba(59,42,32,0.45)'); gr.addColorStop(1, 'rgba(59,42,32,0)');
        g.globalAlpha = side; g.fillStyle = gr; g.fillRect(x, 0, 1, yEnd);
      }
    }
    g.globalAlpha = 1;
    if (hair === 'styled') {
      // Lightning bolt cut into the fade, lighter brown (on his LEFT side).
      const cx = (L.boltSide === 'right' ? 0.0 : 0.5) * W, cy = 0.48 * H, s = 0.9;
      const bolt = [[-14, -46], [22, -46], [6, -10], [26, -10], [-16, 50], [-4, 6], [-24, 6]];
      g.fillStyle = L.boltColor; g.strokeStyle = 'rgba(80,55,38,0.6)'; g.lineWidth = 3;
      g.beginPath(); bolt.forEach(([x, y], i) => { const px = cx + x * s * 1.25, py = cy + y * s; i ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.closePath(); g.fill(); g.stroke();
    }
    // Rosy cheeks + freckles across nose and cheeks.
    for (const sx of [-1, 1]) {
      const gr = g.createRadialGradient(faceC + sx * 0.072 * W, 0.585 * H, 2, faceC + sx * 0.072 * W, 0.585 * H, 36);
      gr.addColorStop(0, 'rgba(240,167,158,0.4)'); gr.addColorStop(1, 'rgba(240,167,158,0)');
      g.fillStyle = gr; g.fillRect(faceC + sx * 0.072 * W - 40, 0.585 * H - 40, 80, 80);
    }
    let seed = 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.fillStyle = L.freckles;
    for (let i = 0; i < 60; i++) {
      const sx = rnd() < 0.5 ? -1 : 1, across = rnd();
      const x = faceC + sx * (0.012 + across * 0.085) * W, y = (0.535 + rnd() * 0.07 - across * 0.015) * H;
      g.globalAlpha = 0.45 + rnd() * 0.35; g.beginPath(); g.arc(x, y, 1.6 + rnd() * 1.6, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    const t = toTexture(c, { wrap: false }); t.wrapS = THREE.RepeatWrapping; return t;
  });
}

// ---- Shirt texture for each outfit. Layout: x=0.25 front, x=0.75 back. ----
function shirtTexture(key, o) {
  return cached('shirt-' + key, () => {
    const W = 1024, H = 512; const [c, g] = makeCanvas(W, H);
    if (key === 'soccer') {
      g.fillStyle = o.shirt; g.fillRect(0, 0, W, H);
      g.fillStyle = o.trim;
      g.fillRect(0, H * 0.94, W, H * 0.06);                  // hem
      for (const x of [0, 0.5 * W, W]) g.fillRect(x - 10, H * 0.08, 20, H * 0.86); // side stripes
      g.beginPath(); g.moveTo(0.25 * W - 70, 0); g.lineTo(0.25 * W, 85); g.lineTo(0.25 * W + 70, 0); g.lineTo(0.25 * W + 48, 0); g.lineTo(0.25 * W, 58); g.lineTo(0.25 * W - 48, 0); g.fill(); // V collar
      g.fillRect(0.25 * W + 70, 0, 0.5 * W - 140, 22); // back collar band
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = o.numberColor;
      g.font = FONT(230); g.fillText(o.number, 0.75 * W, H * 0.47);      // big 12 on the back
      g.font = FONT(64); g.fillText(o.number, 0.25 * W - 75, H * 0.32);  // small 12 on the chest
    } else if (key === 'army') {
      const cam = camo(o.camo, 21, 512, 40).image; g.drawImage(cam, 0, 0, W / 2, H); g.drawImage(cam, W / 2, 0, W / 2, H);
      g.strokeStyle = 'rgba(30,32,22,0.7)'; g.lineWidth = 5;
      for (const sx of [-1, 1]) g.strokeRect(0.25 * W + sx * 70 - 40, H * 0.22, 80, 70); // chest pockets
      g.beginPath(); g.moveTo(0.25 * W, 0); g.lineTo(0.25 * W, H); g.stroke(); // front seam
      g.fillStyle = o.belt; g.fillRect(0, H * 0.9, W, H * 0.1);
      g.fillStyle = o.buckle; g.fillRect(0.25 * W - 22, H * 0.9, 44, H * 0.1);
    } else {
      const cam = camo(o.jacketCamo, 33, 512, 50, 0.9).image; g.drawImage(cam, 0, 0, W / 2, H); g.drawImage(cam, W / 2, 0, W / 2, H);
      g.fillStyle = o.zipper; g.fillRect(0.25 * W - 5, 0, 10, H);   // olive zipper
      g.fillStyle = o.collarInside;                                  // lime-yellow inside the collar
      g.beginPath(); g.moveTo(0.25 * W - 60, 0); g.lineTo(0.25 * W - 8, 70); g.lineTo(0.25 * W - 8, 0); g.fill();
      g.beginPath(); g.moveTo(0.25 * W + 60, 0); g.lineTo(0.25 * W + 8, 70); g.lineTo(0.25 * W + 8, 0); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, H * 0.93, W, H * 0.07); // jacket hem band
    }
    return toTexture(c, { wrap: false });
  });
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

export function buildLiev(choice) {
  const o = L.outfits[choice.outfit] || L.outfits.play;
  const okey = L.outfits[choice.outfit] ? choice.outfit : 'play';
  const hairStyle = choice.hair === 'styled' ? 'styled' : 'everyday';
  const hat = !!choice.hat;
  const disposables = [];
  const mat = (m) => { disposables.push(m); return m; };

  const skin = mat(std(L.skin, { roughness: 0.7 }));
  const hairMat = mat(std(L.hair, { roughness: 0.8 }));
  const root = new THREE.Group(); root.name = 'Liev';
  const rig = new THREE.Group(); root.add(rig);
  const shadow = (o3) => { o3.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } }); return o3; };

  // Clothing materials per outfit.
  let shirtMat, sleeveMat, legMat, sockMat, shoeMat, soleMat;
  const camoArmy = okey === 'army' ? (() => { const t = camo(o.camo, 22, 512, 40); t.repeat.set(1, 1); return t; })() : null;
  const camoPlay = okey === 'play' ? (() => { const t = camo(o.jacketCamo, 34, 512, 50, 0.9); return t; })() : null;
  shirtMat = mat(std('#ffffff', { map: shirtTexture(okey, o), roughness: 0.9 }));
  if (okey === 'soccer') {
    sleeveMat = mat(std(o.shirt, { roughness: 0.8 })); legMat = mat(std(o.shorts)); sockMat = mat(std(o.socks)); shoeMat = mat(std(o.shoes, { roughness: 0.5 })); soleMat = mat(std(o.sole));
  } else if (okey === 'army') {
    sleeveMat = mat(std('#fff', { map: camoArmy })); legMat = mat(std('#fff', { map: camoArmy })); sockMat = mat(std(o.boots)); shoeMat = mat(std(o.boots, { roughness: 0.7 })); soleMat = mat(std(o.sole));
  } else {
    sleeveMat = mat(std('#fff', { map: camoPlay })); legMat = mat(std(o.shorts)); sockMat = mat(std(o.socks)); shoeMat = mat(std(o.shoes, { roughness: 0.5 })); soleMat = mat(std(o.sole));
  }

  // ---- Legs ----
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.075, 0.665, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.5, 6, 14), skin); leg.position.y = -0.3; pivot.add(leg);
    if (o.legs === 'shorts') {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.076, 0.3, 18), legMat); sh.position.y = -0.13; pivot.add(sh);
    } else {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.062, 0.56, 18), legMat); tr.position.y = -0.27; pivot.add(tr);
    }
    const sockTop = okey === 'soccer' ? -0.33 : okey === 'army' ? -0.47 : -0.5;
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.061, -0.6 - sockTop + 0.02, 16), sockMat);
    sock.position.y = (sockTop + -0.58) / 2; pivot.add(sock);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shoeMat); shoe.scale.set(0.064, 0.048, 0.11); shoe.position.set(0, -0.612, 0.035); pivot.add(shoe);
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20), soleMat); sole.scale.set(0.066, 0.016, 0.112); sole.position.set(0, -0.648, 0.035); pivot.add(sole);
    rig.add(shadow(pivot)); legs.push(pivot);
  }
  // Hips (shorts/trousers top).
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.13, 0.13, 24), okey === 'soccer' ? legMat : legMat);
  hips.scale.z = 0.72; hips.position.y = 0.68; rig.add(shadow(hips));

  // ---- Torso (shirt / jacket) ----
  const bulk = o.sleeves === 'long' ? 0.012 : 0;
  const tp = [[0.001, 0], [0.128, 0], [0.142, 0.03], [0.147, 0.12], [0.152, 0.24], [0.162, 0.36], [0.16, 0.42], [0.122, 0.462], [0.055, 0.48]]
    .map(([r, y]) => new THREE.Vector2(r + (r > 0.01 ? bulk : 0), y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(tp, 48, -Math.PI / 2), shirtMat);
  torso.scale.z = 0.74; torso.position.y = 0.655; rig.add(shadow(torso));

  // Neck + collar pieces.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.05, 0.11, 16), skin); neck.position.y = 1.16; rig.add(neck);
  if (okey === 'play') {
    const hoodMat = mat(std(o.hoodie, { roughness: 0.9 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.032, 12, 28), hoodMat); ring.rotation.x = Math.PI / 2; ring.scale.y = 0.85; ring.position.y = 1.125; rig.add(shadow(ring));
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), hoodMat); hood.scale.set(1.05, 0.6, 0.55); hood.position.set(0, 1.15, -0.085); rig.add(shadow(hood));
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 28), sleeveMat); collar.rotation.x = Math.PI / 2; collar.scale.y = 0.8; collar.position.y = 1.105; rig.add(collar);
  } else if (okey === 'army') {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 10, 28), sleeveMat); collar.rotation.x = Math.PI / 2; collar.scale.y = 0.85; collar.position.y = 1.12; rig.add(collar);
  }

  // ---- Arms ----
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.188, 1.06, 0);
    pivot.rotation.z = s * 0.08;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.047, 0.36, 6, 12), skin); arm.position.y = -0.22; pivot.add(arm);
    const sleeveLen = o.sleeves === 'short' ? 0.17 : 0.42;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.056, sleeveLen, 14), sleeveMat); sleeve.position.y = -sleeveLen / 2 + 0.02; pivot.add(sleeve);
    if (okey === 'soccer') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.051, 0.008, 6, 16), mat(std(o.trim))); band.rotation.x = Math.PI / 2; band.position.y = -sleeveLen + 0.03; pivot.add(band); }
    if (okey === 'play') { const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 14), mat(std(o.hoodie))); cuff.position.y = -0.42; pivot.add(cuff); }
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 12), skin); hand.scale.set(0.9, 1.1, 0.8); hand.position.y = -0.47; pivot.add(hand);
    rig.add(shadow(pivot)); arms.push(pivot);
  }

  // ---- Head ----
  const HR = 0.148;
  const head = new THREE.Group(); head.position.set(0, 1.31, 0.005); head.scale.setScalar(1.18); rig.add(head);
  const headMat = mat(std('#fff', { map: headTexture(hairStyle), roughness: 0.72 }));
  const skull = new THREE.Mesh(new THREE.SphereGeometry(HR, 48, 32), headMat); head.add(shadow(skull));
  const surf = (theta, lat, out = 0) => new THREE.Vector3(Math.sin(lat) * Math.sin(theta), Math.cos(theta), Math.cos(lat) * Math.sin(theta)).multiplyScalar(HR + out);
  const place = (obj, theta, lat, out = 0) => { const p = surf(theta, lat, out); obj.position.copy(p); obj.lookAt(p.clone().multiplyScalar(2)); head.add(obj); return obj; };

  // Eyes (brown) with blink.
  const eyes = [];
  const white = mat(std('#FBFAF7', { roughness: 0.4 }));
  const iris = mat(new THREE.MeshStandardMaterial({ color: L.eyes, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const pupil = mat(new THREE.MeshBasicMaterial({ color: '#1A120C', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  const glint = mat(new THREE.MeshBasicMaterial({ color: '#FFFFFF', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.027, 18, 12), white); ball.scale.z = 0.45; e.add(ball);
    const ir = new THREE.Mesh(new THREE.CircleGeometry(0.0175, 20), iris); ir.position.z = 0.0122; e.add(ir);
    const pu = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 16), pupil); pu.position.z = 0.0124; e.add(pu);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(0.0042, 10), glint); gl.position.set(0.005, 0.006, 0.0126); e.add(gl);
    place(e, 1.47, s * 0.36, -0.006); eyes.push(e);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.011, 0.01), hairMat);
    place(brow, 1.24, s * 0.35, 0.002); brow.rotateZ(s * -0.1);
  }
  // Nose.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 10), skin); nose.scale.set(0.95, 0.8, 0.9); place(nose, 1.62, 0, -0.006);
  // Big grin: teeth with a lip outline, bent to follow the face.
  const grin = new THREE.Group();
  const shape = (w, h) => { const sh = new THREE.Shape(); sh.moveTo(-w, 0); sh.quadraticCurveTo(0, 0.25 * h, w, 0); sh.quadraticCurveTo(w * 0.85, -h, 0, -h); sh.quadraticCurveTo(-w * 0.85, -h, -w, 0); return sh; };
  const bend = (geo) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -(x * x + y * y * 0.6) / (2 * HR)); } geo.computeVertexNormals(); return geo; };
  const lip = new THREE.Mesh(bend(new THREE.ShapeGeometry(shape(0.05, 0.034), 16)), mat(std(L.lips, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  const teeth = new THREE.Mesh(bend(new THREE.ShapeGeometry(shape(0.043, 0.024), 16)), mat(std('#FFFFFF', { roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
  teeth.position.set(0, -0.002, 0.0008);
  const tongue = new THREE.Mesh(bend(new THREE.CircleGeometry(0.014, 12)), mat(std('#D9726E', { polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })));
  tongue.position.set(0, -0.024, 0.0012); tongue.scale.y = 0.45;
  grin.add(lip, teeth, tongue); place(grin, 1.84, 0, 0.0025);
  // Ears that stick out a little.
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), skin);
    ear.scale.set(0.42, 1, 0.75); ear.position.set(s * 0.145, -0.01, -0.005); ear.rotation.y = s * -0.45; head.add(shadow(ear));
  }

  // ---- Hair ----
  const hairParts = { top: [], fringe: [] };
  if (hairStyle === 'everyday') {
    // Hair is built from many soft clumps that flow out from the crown, so the
    // top looks tousled and layered instead of one smooth "bowl".
    const clumpGeo = new THREE.SphereGeometry(1, 18, 12);
    let hs = 91; const rnd = () => (hs = (hs * 16807) % 2147483647) / 2147483647;
    const crown = surf(0.4, Math.PI, 0).normalize();
    const addClump = (theta, lat, w, thick, len, out, lift = 0, list = hairParts.top) => {
      const n = surf(theta, lat, 0).normalize();
      const t = n.clone().sub(crown); t.sub(n.clone().multiplyScalar(t.dot(n)));
      if (t.lengthSq() < 1e-6) t.set(0, 0, 1); t.normalize();
      t.addScaledVector(n, lift).normalize();                 // lift > 0 makes the tip stick up
      const x = new THREE.Vector3().crossVectors(n, t).normalize();
      const y = new THREE.Vector3().crossVectors(t, x).normalize();
      const m = new THREE.Mesh(clumpGeo, hairMat);
      m.matrix.makeBasis(x, y, t).scale(new THREE.Vector3(w, thick, len));
      m.matrix.setPosition(surf(theta, lat, out).addScaledVector(t, len * 0.45));
      m.matrixAutoUpdate = false; m.castShadow = true; head.add(m); list.push(m); return m;
    };
    if (!hat) {
      // Thin base layer so no scalp shows between clumps.
      const cap = new THREE.Mesh(new THREE.SphereGeometry(HR + 0.006, 40, 20, 0, Math.PI * 2, 0, 1.32), hairMat);
      cap.position.z = -0.004; head.add(shadow(cap)); hairParts.top.push(cap);
      // Layered clumps over the whole top, back and sides.
      for (let ring = 0; ring < 5; ring++) {
        const theta = 0.25 + ring * 0.21, count = 7 + ring * 3;
        for (let k = 0; k < count; k++) {
          const lat = (k + rnd() * 0.6) / count * Math.PI * 2;
          if (Math.cos(lat) > 0.55 && theta > 0.9) continue;   // the fringe covers the forehead
          addClump(theta + (rnd() - 0.5) * 0.06, lat, 0.036 + rnd() * 0.01, 0.009 + rnd() * 0.003, 0.065 + rnd() * 0.02, 0.006 + ring * 0.001, (rnd() - 0.4) * 0.12);
        }
      }
      // A few pieces sticking up at the crown and back (like in the photos).
      for (let i = 0; i < 3; i++) addClump(0.38 + rnd() * 0.15, Math.PI + (i - 1) * 0.45, 0.018, 0.008, 0.035 + rnd() * 0.012, 0.012, 0.55 + rnd() * 0.25);
    }
    // Full fringe of bangs down to the eyebrows.
    const th0 = hat ? 1.22 : 0.55, th1 = 1.3;
    const fr = new THREE.Mesh(new THREE.SphereGeometry(HR + 0.017, 40, 10, Math.PI / 2 - 1.0, 2.0, th0, th1 - th0), hairMat);
    head.add(shadow(fr)); hairParts.fringe.push(fr);
    for (let i = 0; i < 14; i++) { // choppy, uneven strands at the bottom of the bangs
      const lat = -0.95 + i * 0.146 + (rnd() - 0.5) * 0.05;
      const len = 0.03 + rnd() * 0.025;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.017 + rnd() * 0.006, len, 6), hairMat);
      const p = surf(1.27, lat, 0.014); tip.position.copy(p);
      tip.lookAt(p.clone().multiplyScalar(2)); tip.rotateX(-Math.PI / 2 - 0.12); tip.rotateZ((rnd() - 0.5) * 0.35);
      tip.position.y -= len * 0.3; head.add(tip); hairParts.fringe.push(tip);
    }
    // Strands on top of the bangs so they look like hair, not a sheet.
    if (!hat) for (let i = 0; i < 8; i++) addClump(0.72 + rnd() * 0.12, -0.7 + i * 0.2, 0.03, 0.008, 0.06, 0.016, -0.1, hairParts.fringe);
  } else if (!hat) {
    // Combed up with product: shiny volume on top, swept back.
    const shine = mat(new THREE.MeshPhysicalMaterial({ color: L.hair, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.35 }));
    const top = new THREE.Mesh(new THREE.SphereGeometry(HR + 0.012, 40, 16, 0, Math.PI * 2, 0, 1.15), shine);
    top.scale.set(1.0, 1.28, 1.05); top.position.set(0, 0.004, -0.004); top.rotation.x = -0.2; head.add(shadow(top)); hairParts.top.push(top);
  }

  // ---- Captain's hat (patrol cap, two silver bars) ----
  if (hat) {
    const ht = cached('hatcamo', () => digitalCamo(L.hat.camo, 41, 256, 6));
    const hatMat = mat(std('#fff', { map: ht, roughness: 0.9 }));
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.16, 0.1, 32), hatMat);
    crown.position.y = 0.098; crown.scale.z = 1.05; head.add(shadow(crown));
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.014, 24, 1, false, -Math.PI / 2, Math.PI), hatMat);
    brim.scale.set(1.22, 1, 0.9); brim.position.set(0, 0.052, 0.125); brim.rotation.x = 0.16; head.add(shadow(brim));
    const silver = mat(new THREE.MeshStandardMaterial({ color: L.hat.bars, metalness: 0.9, roughness: 0.3 }));
    for (const sx of [-1, 1]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.038, 0.006), silver); bar.position.set(sx * 0.014, 0.102, 0.163); bar.rotation.x = -0.1; head.add(bar); }
  }

  const st = { phase: 0, blink: 2 + Math.random() * 2, squash: 0, kick: 0, climb: 0, glow: 0 };
  return {
    kind: 'liev', name: L.name, root, height: L.height, radius: 0.24, halfWidth: 0.27,
    parts: { arms, legs, head, eyes, hairParts },
    set glow(v) { st.glow = v; }, get glow() { return st.glow; },
    land(strength = 1) { st.squash = Math.min(1, 0.4 + strength * 0.4); },
    kick() { st.kick = 1; },
    animate(dt, a = {}) {
      const speed = a.speed || 0, s = Math.min(1, speed / 3.2);
      st.phase += dt * (speed * 2.7 + (a.climbing ? 7 : 0));
      const air = a.onGround === false && !a.climbing;
      const swing = Math.sin(st.phase);
      st.kick = Math.max(0, st.kick - dt * 3.5);
      legs.forEach((p, i) => {
        const sg = i === 0 ? 1 : -1;
        let tx = swing * 0.75 * s * sg;
        if (air) tx = i === 0 ? -0.6 : 0.35;
        if (a.climbing) tx = Math.sin(st.phase + i * Math.PI) * 0.6 - 0.3;
        if (i === 0 && st.kick > 0) tx = -Math.sin(st.kick * Math.PI) * 1.4;
        p.rotation.x = damp(p.rotation.x, tx, 18, dt);
      });
      arms.forEach((p, i) => {
        const sg = i === 0 ? -1 : 1;
        let tx = swing * 0.6 * s * sg, tz = (i === 0 ? -1 : 1) * 0.08;
        if (air) { tx = -0.4; tz = (i === 0 ? -1 : 1) * 0.6; }
        if (a.climbing) { tx = -2.6 + Math.sin(st.phase + i * Math.PI) * 0.4; tz = 0; }
        if (a.cheer) { tx = -2.8 + Math.sin(st.phase * 6 + i) * 0.3; tz = (i === 0 ? -1 : 1) * 0.3; }
        p.rotation.x = damp(p.rotation.x, tx, 14, dt); p.rotation.z = damp(p.rotation.z, tz, 14, dt);
      });
      rig.position.y = Math.abs(Math.sin(st.phase)) * 0.035 * s;
      rig.rotation.x = damp(rig.rotation.x, s * 0.08, 6, dt);
      st.squash = damp(st.squash, 0, 8, dt);
      rig.scale.set(1 + st.squash * 0.05, 1 - st.squash * 0.08, 1 + st.squash * 0.05);
      // Blink.
      st.blink -= dt;
      const closed = st.blink < 0.11 ? 0.1 : 1;
      eyes.forEach(e => { e.scale.y = closed; });
      if (st.blink < 0) st.blink = 2.5 + Math.random() * 2.5;
    },
    dispose() { root.traverse(x => { if (x.geometry) x.geometry.dispose(); }); disposables.forEach(m => m.dispose()); if (camoArmy) camoArmy.dispose(); if (camoPlay) camoPlay.dispose(); },
  };
}
