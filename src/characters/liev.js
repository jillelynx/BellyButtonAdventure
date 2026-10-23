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
      const nearFace = Math.max(0, Math.min(1, 1 - (fd - faceHalf) / (0.13 * W))); // 1 right beside the face
      if (hair === 'everyday') {
        const yEnd = (0.48 + 0.24 * b - 0.15 * nearFace) * H; // ear tops at the sides, nape at the back, no sideburns by the face
        const gr = g.createLinearGradient(0, 0, 0, yEnd);
        gr.addColorStop(0, L.hair); gr.addColorStop(0.88, L.hair); gr.addColorStop(1, 'rgba(59,42,32,0)');
        g.globalAlpha = side; g.fillStyle = gr; g.fillRect(x, 0, 1, yEnd);
      } else {
        // Skin fade: dark at the top of the sides, fading to skin lower down.
        // (the shiny top hair covers down to about 0.32 of the height)
        const yEnd = (0.6 + 0.12 * b - 0.17 * nearFace) * H;
        const gr = g.createLinearGradient(0, 0, 0, yEnd);
        gr.addColorStop(0, 'rgba(59,42,32,1)'); gr.addColorStop(0.62, 'rgba(59,42,32,0.92)'); gr.addColorStop(0.82, 'rgba(59,42,32,0.45)'); gr.addColorStop(1, 'rgba(59,42,32,0)');
        g.globalAlpha = side; g.fillStyle = gr; g.fillRect(x, 0, 1, yEnd);
      }
    }
    g.globalAlpha = 1;
    if (hair === 'styled') {
      // Lightning bolt cut into the fade, lighter brown (on his LEFT side).
      const cx = (L.boltSide === 'right' ? 0.96 : 0.54) * W, cy = 0.42 * H, s = 0.9;
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

  // ---- Legs (hip and knee joints, so the legs can really step) ----
  const legs = [], knees = [];
  const THIGH = 0.31, SHIN = 0.31;
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.075, 0.665, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, THIGH - 0.06, 6, 14), skin); thigh.position.y = -THIGH / 2; pivot.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -THIGH; pivot.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, SHIN - 0.06, 6, 14), skin); shin.position.y = -SHIN / 2; knee.add(shin);
    if (o.legs === 'shorts') {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.076, 0.3, 18), legMat); sh.position.y = -0.13; pivot.add(sh);
    } else {
      const tr1 = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.066, THIGH + 0.02, 18), legMat); tr1.position.y = -THIGH / 2; pivot.add(tr1);
      const tr2 = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.062, SHIN - 0.04, 18), legMat); tr2.position.y = -SHIN / 2 + 0.01; knee.add(tr2);
    }
    // Socks and shoes ride on the knee joint (heights measured from the hip).
    const sockTop = okey === 'soccer' ? -0.33 : okey === 'army' ? -0.47 : -0.5;
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.061, -0.6 - sockTop + 0.02, 16), sockMat);
    sock.position.y = (sockTop + -0.58) / 2 + THIGH; knee.add(sock);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shoeMat); shoe.scale.set(0.064, 0.048, 0.11); shoe.position.set(0, -0.612 + THIGH, 0.035); knee.add(shoe);
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20), soleMat); sole.scale.set(0.066, 0.016, 0.112); sole.position.set(0, -0.648 + THIGH, 0.035); knee.add(sole);
    rig.add(shadow(pivot)); legs.push(pivot); knees.push(knee);
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
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.12, 16), skin); neck.position.y = 1.17; rig.add(neck);
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
  // An animated-film kid's head: oval, narrower at the jaw, a soft chin and
  // cheekbones (not a ball). Everything on the face is placed on this shape.
  const HR = 0.148;
  const head = new THREE.Group(); head.position.set(0, 1.32, 0.005); head.scale.setScalar(0.84); rig.add(head);
  const shapeHead = (dx, dy, dz) => {
    let x = dx * 0.88, y = dy, z = dz * 0.98;
    if (dy < 0) { const t = Math.pow(-dy, 1.4); x *= 1 - 0.22 * t; z *= 1 - (dz < 0 ? 0.18 : 0.06) * t; y *= 1.04; } // jaw narrows to a chin
    if (dz < 0 && dy > -0.3) z *= 1.07;                            // round back of the skull
    if (z > 0.55) z -= (z - 0.55) * 0.35;                          // flatter face
    const cx = Math.abs(dx) - 0.5, cy = dy + 0.12, cz = dz - 0.62;  // cheekbones
    const cb = Math.exp(-(cx * cx + cy * cy + cz * cz) / 0.035);
    x += Math.sign(dx) * cb * 0.025; z += cb * 0.02;
    return new THREE.Vector3(x, y, z);
  };
  const shapeGeo = (geo, r) => {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const s = shapeHead(v.x, v.y, v.z).multiplyScalar(r); p.setXYZ(i, s.x, s.y, s.z); }
    geo.computeVertexNormals(); return geo;
  };
  const headMat = mat(std('#fff', { map: headTexture(hairStyle), roughness: 0.72 }));
  const skull = new THREE.Mesh(shapeGeo(new THREE.SphereGeometry(1, 64, 48), HR), headMat); head.add(shadow(skull));
  const dirOf = (theta, lat) => [Math.sin(lat) * Math.sin(theta), Math.cos(theta), Math.cos(lat) * Math.sin(theta)];
  const surfN = (theta, lat) => {
    const e = 0.01, P = (t, l) => shapeHead(...dirOf(t, l)).multiplyScalar(HR);
    const p = P(theta, lat), a = P(theta + e, lat).sub(P(theta - e, lat)), b = P(theta, lat + e).sub(P(theta, lat - e));
    let n = new THREE.Vector3().crossVectors(b, a).normalize();
    if (n.dot(p) < 0) n.negate();
    if (!isFinite(n.x)) n = p.clone().normalize();
    return { p, n };
  };
  const surf = (theta, lat, out = 0) => { const { p, n } = surfN(theta, lat); return p.addScaledVector(n, out); };
  const place = (obj, theta, lat, out = 0) => { const { p, n } = surfN(theta, lat); p.addScaledVector(n, out); obj.position.copy(p); obj.lookAt(p.clone().add(n)); head.add(obj); return obj; };

  // Almond-shaped brown eyes with eyelids (they blink).
  const eyes = [];
  const white = mat(std('#FBFAF7', { roughness: 0.35 }));
  const iris = mat(new THREE.MeshStandardMaterial({ color: L.eyes, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const pupil = mat(new THREE.MeshBasicMaterial({ color: '#160E09', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  const glint = mat(new THREE.MeshBasicMaterial({ color: '#FFFFFF', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  const lidMat = mat(std(L.skin, { roughness: 0.7 }));
  const lashMat = mat(std('#2A1C14', { roughness: 0.8 }));
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.025, 20, 14), white); ball.scale.set(1.1, 0.86, 0.5); e.add(ball);
    const ir = new THREE.Mesh(new THREE.CircleGeometry(0.0148, 22), iris); ir.position.set(s * -0.002, -0.0015, 0.0122); e.add(ir);
    const pu = new THREE.Mesh(new THREE.CircleGeometry(0.0072, 16), pupil); pu.position.set(s * -0.002, -0.0015, 0.0124); e.add(pu);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(0.0032, 10), glint); gl.position.set(s * -0.002 + 0.0045, 0.0035, 0.0126); e.add(gl);
    // Upper eyelid (skin) with a dark lash line: gives the eye its almond shape.
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0262, 20, 10, 0, Math.PI * 2, 0, 0.82), lidMat);
    lid.scale.set(1.12, 0.88, 0.56); lid.rotation.x = 0.12; e.add(lid);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.0255, 0.0022, 6, 20, Math.PI * 0.9), lashMat);
    lash.scale.set(1.1, 0.75, 1); lash.rotation.z = Math.PI * 0.05; lash.position.set(0, 0.006, 0.006); e.add(lash);
    place(e, 1.6, s * 0.37, -0.007); eyes.push({ group: e, lid });
    // Eyebrows: thin, slightly arched.
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0068, 6, 14, 1.3), hairMat);
    brow.rotation.z = Math.PI / 2 - 0.65; brow.scale.set(1, 0.55, 1);
    place(brow, 1.41, s * 0.36, 0.0); brow.rotateZ(s * 0.08); brow.position.y -= 0.022;
  }
  // Small nose with soft nostrils.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), skin); nose.scale.set(1.0, 0.8, 1.0); place(nose, 1.84, 0, -0.002);
  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), skin); place(bridge, 1.72, 0, -0.004); bridge.rotateX(Math.PI / 2 + 0.25);
  // Closed-mouth, slightly lopsided smile with a soft lower lip.
  // Smile: a curved crescent "drawn" onto the face, a little higher on one side.
  const smileShape = new THREE.Shape(); const W2 = 0.044, D = 0.017;
  for (let i = 0; i <= 20; i++) { const u = -1 + i / 10; const y = D * (u * u - 1) + u * 0.003; i ? smileShape.lineTo(u * W2, y) : smileShape.moveTo(u * W2, y); }
  for (let i = 20; i >= 0; i--) { const u = -1 + i / 10; const th = 0.0055 * (1 - u * u * 0.7); const y = D * (u * u - 1) + u * 0.003 + th; smileShape.lineTo(u * W2, y); }
  const smileGeo = new THREE.ShapeGeometry(smileShape, 4);
  { const p2 = smileGeo.attributes.position; for (let i = 0; i < p2.count; i++) { const x = p2.getX(i); p2.setZ(i, -(x * x) / (2 * HR * 0.8)); } }
  const smile = new THREE.Mesh(smileGeo, mat(std('#8E4038', { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));
  place(smile, 1.9, 0, 0.0015);
  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), mat(std('#E3A493', { roughness: 0.6 })));
  lowerLip.scale.set(1.6, 0.42, 0.45); place(lowerLip, 2.1, 0, -0.005);
  // Ears that stick out a little.
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), skin);
    const { p } = surfN(1.66, s * Math.PI / 2);
    ear.scale.set(0.42, 1, 0.72); ear.position.copy(p).add(new THREE.Vector3(s * 0.004, 0, -0.01)); ear.rotation.y = s * -0.5; head.add(shadow(ear));
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), mat(std('#E9B9A2'))); inner.scale.set(0.3, 0.8, 0.5); inner.position.set(s * 0.008, 0, 0.004); ear.add(inner);
  }

  // ---- Hair ----
  const hairParts = { top: [], fringe: [] };
  if (hairStyle === 'everyday') {
    // Tousled, spiky top with shorter sides, built from soft clumps that
    // flow forward from the crown (like the reference picture).
    const clumpGeo = new THREE.SphereGeometry(1, 16, 12);
    let hs = 91; const rnd = () => (hs = (hs * 16807) % 2147483647) / 2147483647;
    const crown = surf(0.45, Math.PI, 0).normalize();
    const addClump = (theta, lat, w, thick, len, out, lift = 0, list = hairParts.top) => {
      const { n } = surfN(theta, lat);
      const t = surf(theta, lat).normalize().sub(crown); t.sub(n.clone().multiplyScalar(t.dot(n)));
      if (t.lengthSq() < 1e-6) t.set(0, 0, 1); t.normalize();
      t.addScaledVector(n, lift).normalize();                 // lift > 0 makes the tip stick up
      const x = new THREE.Vector3().crossVectors(n, t).normalize();
      const y = new THREE.Vector3().crossVectors(t, x).normalize();
      const m = new THREE.Mesh(clumpGeo, hairMat);
      m.matrix.makeBasis(x, y, t).scale(new THREE.Vector3(w, thick, len));
      m.matrix.setPosition(surf(theta, lat, out).addScaledVector(t, len * 0.5));
      m.matrixAutoUpdate = false; m.castShadow = true; head.add(m); list.push(m); return m;
    };
    if (!hat) {
      // Close-fitting base so no scalp shows (sides are short, shown by the texture).
      const cap = new THREE.Mesh(shapeGeo(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, 1.08), HR + 0.005), hairMat);
      head.add(shadow(cap)); hairParts.top.push(cap);
      // Messy, layered top: pieces lifted up and pointing forward.
      for (let ring = 0; ring < 4; ring++) {
        const theta = 0.12 + ring * 0.22, count = 5 + ring * 4;
        for (let k = 0; k < count; k++) {
          const lat = (k + rnd() * 0.7) / count * Math.PI * 2;
          if (Math.cos(lat) > 0.2 && theta > 0.7) continue;   // front is the fringe
          addClump(theta + (rnd() - 0.5) * 0.08, lat, 0.03 + rnd() * 0.01, 0.011 + rnd() * 0.004, 0.055 + rnd() * 0.025, 0.008 + ring * 0.002, 0.2 + rnd() * 0.3 - ring * 0.08);
        }
      }
      // Spiky tufts sticking up on top.
      for (let i = 0; i < 6; i++) addClump(0.25 + rnd() * 0.3, (rnd() - 0.5) * 4.0, 0.016 + rnd() * 0.006, 0.009, 0.035 + rnd() * 0.02, 0.016, 0.7 + rnd() * 0.5);
    }
    // Fringe: separate pieces sweeping forward and down onto the forehead.
    const fr0 = hat ? 1.15 : 0.72;
    for (let i = 0; i < (hat ? 9 : 13); i++) {
      const lat = -0.95 + i * (1.9 / (hat ? 8 : 12)) + (rnd() - 0.5) * 0.1;
      addClump(fr0 + rnd() * 0.1, lat, 0.026 + rnd() * 0.008, 0.009, (hat ? 0.03 : 0.05) + rnd() * 0.02, 0.01, 0.12 + rnd() * 0.15, hairParts.fringe); // short, swept up off the eyes
    }
  } else if (!hat) {
    // Combed up with product: shiny volume on top, swept back.
    const combTex = cached('comb', () => { const [c, g] = makeCanvas(512, 64); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 64);
      for (let x = 0; x < 512; x += 6) { g.fillStyle = `rgba(0,0,0,${0.18 + ((x * 7) % 11) / 40})`; g.fillRect(x, 0, 2.5, 64); } return toTexture(c); });
    const shine = mat(new THREE.MeshPhysicalMaterial({ color: L.hair, map: combTex, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.4 }));
    const base = new THREE.Mesh(shapeGeo(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, 1.0), HR + 0.004), shine);
    head.add(shadow(base)); hairParts.top.push(base);
    const vol = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), shine);
    vol.scale.set(0.11, 0.1, 0.14); vol.position.set(0, 0.075, 0.01); vol.rotation.x = -0.3; head.add(shadow(vol)); hairParts.top.push(vol);
  }

  // ---- Captain's hat (patrol cap, two silver bars) ----
  if (hat) {
    const ht = cached('hatcamo', () => digitalCamo(L.hat.camo, 41, 256, 6));
    const hatMat = mat(std('#fff', { map: ht, roughness: 0.9 }));
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.146, 0.1, 32), hatMat);
    crown.position.set(0, 0.098, -0.004); crown.scale.set(0.92, 1, 1.06); head.add(shadow(crown));
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.014, 24, 1, false, -Math.PI / 2, Math.PI), hatMat);
    brim.scale.set(1.15, 1, 0.9); brim.position.set(0, 0.052, 0.118); brim.rotation.x = 0.16; head.add(shadow(brim));
    const silver = mat(new THREE.MeshStandardMaterial({ color: L.hat.bars, metalness: 0.9, roughness: 0.3 }));
    for (const sx of [-1, 1]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.038, 0.006), silver); bar.position.set(sx * 0.014, 0.102, 0.152); bar.rotation.x = -0.1; head.add(bar); }
  }

  const st = { phase: 0, blink: 2 + Math.random() * 2, squash: 0, kick: 0, climb: 0, glow: 0 };
  return {
    kind: 'liev', name: L.name, root, height: L.height, radius: 0.24, halfWidth: 0.27,
    parts: { arms, legs, knees, head, eyes, hairParts },
    set glow(v) { st.glow = v; }, get glow() { return st.glow; },
    land(strength = 1) { st.squash = Math.min(1, 0.4 + strength * 0.4); },
    kick() { st.kick = 1; },
    animate(dt, a = {}) {
      const speed = a.speed || 0, s = Math.min(1, speed / 3.2);
      // Stride: bigger steps when faster, and the step rate matches the ground speed so feet don't slide.
      const A = speed > 0.05 ? Math.min(0.85, 0.32 + speed * 0.085) : 0;
      const cycle = Math.max(0.6, 4 * 0.62 * Math.sin(Math.max(A, 0.2)) * (speed > 4.5 ? 1.25 : 1));
      st.phase += dt * (speed > 0.05 ? (Math.PI * 2 * speed / cycle) : 0) + dt * (a.climbing ? 7 : 0);
      const air = a.onGround === false && !a.climbing;
      const swing = Math.sin(st.phase);
      st.kick = Math.max(0, st.kick - dt * 3.5);
      legs.forEach((p, i) => {
        const ph = st.phase + i * Math.PI;          // the two legs are half a step apart: they alternate
        let tx = Math.sin(ph) * A;                   // + = leg back, - = leg forward
        let kn = A * 1.6 * Math.max(0, -Math.cos(ph)) + (speed > 4.5 ? 0.25 : 0.05) * (A > 0 ? 1 : 0); // knee bends as the leg swings forward
        if (air) { tx = i === 0 ? -0.7 : 0.3; kn = i === 0 ? 0.9 : 0.5; }
        if (a.climbing) { tx = Math.sin(ph) * 0.6 - 0.4; kn = 0.6 + Math.max(0, Math.cos(ph)) * 0.6; }
        if (i === 0 && st.kick > 0) { tx = -Math.sin(st.kick * Math.PI) * 1.4; kn = 0.1; }
        p.rotation.x = damp(p.rotation.x, tx, 20, dt);
        knees[i].rotation.x = damp(knees[i].rotation.x, kn, 20, dt);
      });
      arms.forEach((p, i) => {
        const sg = i === 0 ? -1 : 1;
        let tx = swing * A * 0.9 * sg, tz = (i === 0 ? -1 : 1) * 0.08;
        if (air) { tx = -0.4; tz = (i === 0 ? -1 : 1) * 0.6; }
        if (a.climbing) { tx = -2.6 + Math.sin(st.phase + i * Math.PI) * 0.4; tz = 0; }
        if (a.cheer) { tx = -2.8 + Math.sin(st.phase * 6 + i) * 0.3; tz = (i === 0 ? -1 : 1) * 0.3; }
        p.rotation.x = damp(p.rotation.x, tx, 14, dt); p.rotation.z = damp(p.rotation.z, tz, 14, dt);
      });
      rig.position.y = Math.abs(Math.cos(st.phase)) * 0.03 * s - (speed > 4.5 ? 0.02 : 0); // a little bounce on each step
      rig.rotation.x = damp(rig.rotation.x, s * 0.08, 6, dt);
      st.squash = damp(st.squash, 0, 8, dt);
      rig.scale.set(1 + st.squash * 0.05, 1 - st.squash * 0.08, 1 + st.squash * 0.05);
      // Blink.
      st.blink -= dt;
      const closed = st.blink < 0.11 ? 0.1 : 1;
      eyes.forEach(e => { e.group.scale.y = closed; });
      if (st.blink < 0) st.blink = 2.5 + Math.random() * 2.5;
    },
    dispose() { root.traverse(x => { if (x.geometry) x.geometry.dispose(); }); disposables.forEach(m => m.dispose()); if (camoArmy) camoArmy.dispose(); if (camoPlay) camoPlay.dispose(); },
  };
}
