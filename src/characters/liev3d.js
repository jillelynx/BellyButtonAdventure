// Liev, the rigged 3D model built in Blender (tools/blender/build_liev.py → assets/models/liev.glb).
// The model holds every outfit, both hairstyles and the hat as separate pieces; this file shows the
// ones Liev is wearing, colors them from looks.js, and moves his bones (walking, running, jumping,
// climbing, kicking, cheering, swimming). If the model can't load, the game uses the old Liev (liev.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { LIEV as L } from './looks.js';
import { camo } from '../textures.js';
import { shirtTexture } from './liev.js';
import { damp } from '../util.js';

const MODEL_URL = new URL('../../assets/models/liev.glb', import.meta.url).href;
let gltf = null, failed = false;
export const lievModelReady = () => !!gltf;
export function preloadLievModel() {
  return new Promise((resolve) => {
    new GLTFLoader().load(MODEL_URL, (g) => { gltf = g; resolve(true); }, undefined, (e) => { console.warn('Liev model did not load, using the classic Liev.', e); failed = true; resolve(false); });
  });
}

const ALWAYS = ['body', 'headskin', 'ear', 'ear_in', 'eye_white', 'iris', 'pupil', 'glint', 'lid_L', 'lid_R', 'lash', 'brow', 'smile', 'freckle'];
const OUTFIT_PARTS = {
  play: ['play_jacket', 'play_hood', 'play_collar', 'play_hem', 'play_cuff', 'play_zip', 'shorts', 'socks_low', 'shoes', 'shoes_sole'],
  soccer: ['soccer_shirt', 'soccer_collar', 'shorts', 'socks_soccer', 'shoes', 'shoes_sole'],
  army: ['army_shirt', 'army_belt', 'army_trousers', 'boots', 'boots_sole'],
};
const baseName = (n) => n.split('__')[0].replace(/_\d+$/, '').replace(/\.\d+$/, '');
const texCache = new Map();
const cachedTex = (key, fn) => { if (!texCache.has(key)) texCache.set(key, fn()); return texCache.get(key); };
const qTmp = new THREE.Quaternion(), eTmp = new THREE.Euler(), vTmp = new THREE.Vector3();

export function buildLiev3D(choice) {
  const o = L.outfits[choice.outfit] || L.outfits.play;
  const okey = L.outfits[choice.outfit] ? choice.outfit : 'play';
  const styled = choice.hair === 'styled', hat = !!choice.hat;
  const disposables = [];
  const own = (m) => { disposables.push(m); return m; };

  const root = new THREE.Group(); root.name = 'Liev';
  const rig = new THREE.Group(); root.add(rig);
  const model = cloneSkinned(gltf.scene); rig.add(model);

  // ---- Which pieces to show ----
  const show = new Set([...ALWAYS, ...OUTFIT_PARTS[okey]]);
  if (styled) { show.add('hair_styled_cap'); show.add('hair_styled_fade'); show.add('hair_styled_bolt'); if (!hat) show.add('hair_styled'); }
  else { show.add('hair_everyday_cap'); if (!hat) show.add('hair_everyday'); }
  if (hat) { show.add('hat'); show.add('hat_bar'); }
  const meshes = {};
  model.traverse((m) => {
    if (!m.isMesh) return;
    const b = baseName(m.name); m.visible = show.has(b); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    (meshes[b] = meshes[b] || []).push(m);
  });

  // ---- Colors and pictures from looks.js ----
  const recolor = (name, color, extra = {}) => (meshes[name] || []).forEach((m) => { m.material = own(m.material.clone()); m.material.color.set(color); Object.assign(m.material, extra); });
  const retex = (name, tex) => (meshes[name] || []).forEach((m) => { m.material = own(m.material.clone()); m.material.color.set('#ffffff'); m.material.map = tex; m.material.needsUpdate = true; });
  recolor('body', L.skin); recolor('headskin', L.skin); recolor('ear', L.skin); recolor('lid_L', L.skin); recolor('lid_R', L.skin);
  recolor('iris', L.eyes);
  const glbTex = (key, make) => cachedTex(key, () => { const t = make().clone(); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; return t; });
  if (okey === 'play') {
    retex('play_jacket', glbTex('shirt-play', () => shirtTexture('play', o)));
    recolor('play_hood', o.hoodie); recolor('play_collar', o.hoodie); recolor('play_hem', o.hoodie); recolor('play_cuff', o.hoodie); recolor('play_zip', o.zipper);
    recolor('shorts', o.shorts); recolor('socks_low', o.socks); recolor('shoes', o.shoes); recolor('shoes_sole', o.sole);
  } else if (okey === 'soccer') {
    retex('soccer_shirt', glbTex('shirt-soccer', () => shirtTexture('soccer', o)));
    recolor('soccer_collar', o.trim); recolor('shorts', o.shorts); recolor('socks_soccer', o.socks); recolor('shoes', o.shoes); recolor('shoes_sole', o.sole);
  } else {
    retex('army_shirt', glbTex('shirt-army', () => shirtTexture('army', o)));
    retex('army_trousers', cachedTex('camo-army-glb', () => { const t = camo(o.camo, 22, 512, 40); t.repeat.set(2, 2); return t; }));
    recolor('army_belt', o.belt); recolor('boots', o.boots); recolor('boots_sole', o.sole);
  }
  if (hat) retex('hat', cachedTex('hat-camo-glb', () => { const t = camo(L.hat.camo, 41, 256, 40); t.repeat.set(3, 3); return t; }));

  // ---- Bones ----
  const bones = {};
  model.traverse((b) => { if (b.isBone) bones[b.name.replace(/_\d+$/, '')] = b; });
  model.updateMatrixWorld(true);
  const order = []; (function walk(n) { if (n.isBone) order.push(n); n.children.forEach(walk); })(model);
  const rest = new Map();
  const modelInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  for (const b of order) {
    const m = new THREE.Matrix4().multiplyMatrices(modelInv, b.matrixWorld); const q = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    rest.set(b, { Rw: q, local: b.quaternion.clone(), M: m });
  }
  const restParent = (b) => { if (b.parent && rest.has(b.parent)) return null; const m = new THREE.Matrix4().multiplyMatrices(modelInv, b.parent.matrixWorld); const q = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q; };
  const parentRestQ = new Map(order.map((b) => [b, restParent(b)]));
  const D = new Map(order.map((b) => [b, new THREE.Euler(0, 0, 0, 'XYZ')]));   // extra turn for each bone, in Liev's own directions (x = pitch forward/back, z = out to the side)
  const Dq = new Map(), Oq = new Map();
  const poseBones = () => {
    for (const b of order) {
      const dq = qTmp.setFromEuler(D.get(b)).clone();
      const pD = Dq.get(b.parent); const cum = pD ? pD.clone().multiply(dq) : dq;
      Dq.set(b, cum);
      const O = cum.clone().multiply(rest.get(b).Rw); Oq.set(b, O);
      const pO = Oq.get(b.parent) || parentRestQ.get(b);
      b.quaternion.copy(pO.clone().invert().multiply(O));
    }
  };
  const bone = (n) => bones['b_' + n];
  const legs = [bone('thigh_R'), bone('thigh_L')], knees = [bone('shin_R'), bone('shin_L')], arms = [bone('upperarm_R'), bone('upperarm_L')], elbows = [bone('forearm_R'), bone('forearm_L')];
  const attach = (obj, b, modelPos, modelQuat = new THREE.Quaternion()) => {   // put an object on a bone at a spot given in Liev's model space
    const inv = new THREE.Matrix4().copy(rest.get(b).M).invert();
    const m = new THREE.Matrix4().compose(modelPos, modelQuat, new THREE.Vector3(1, 1, 1)); m.premultiply(inv);
    m.decompose(obj.position, obj.quaternion, obj.scale); b.add(obj); return obj;
  };
  const centerOf = (name, side) => { const box = new THREE.Box3(); (meshes[name] || []).forEach((m) => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { vTmp.fromBufferAttribute(p, i); if (side === undefined || Math.sign(vTmp.x) === side) box.expandByPoint(vTmp); } }); return box; };

  // ---- Blinking: skin-colored covers over each eye, shown for a moment ----
  const lidMat = own(new THREE.MeshStandardMaterial({ color: L.skin, roughness: 0.7 }));
  const blinkers = [1, -1].map((s) => {
    const box = centerOf('eye_white', s), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), lidMat); lid.scale.set(sz.x * 0.62, sz.y * 0.62, sz.z * 0.7);
    attach(lid, bone('head'), c.add(new THREE.Vector3(0, 0, 0.003))); lid.visible = false; return lid;
  });

  // ---- Swim gear (snorkel at the surface, scuba when diving) ----
  const gear = { mode: null, both: [], snorkel: [], scuba: [] };
  {
    const frameM = own(new THREE.MeshStandardMaterial({ color: '#1E6F86', roughness: 0.4 })), glassM = own(new THREE.MeshStandardMaterial({ color: '#BFEFFF', roughness: 0.05, transparent: true, opacity: 0.35 }));
    const strapM = own(new THREE.MeshStandardMaterial({ color: '#203038', roughness: 0.6 })), yellow = own(new THREE.MeshStandardMaterial({ color: '#F2C230', roughness: 0.35, metalness: 0.2 })), hoseM = own(new THREE.MeshStandardMaterial({ color: '#2A2A2E', roughness: 0.6 }));
    const eyesBox = centerOf('eye_white'), ec = eyesBox.getCenter(new THREE.Vector3()), es = eyesBox.getSize(new THREE.Vector3());
    const head = bone('head');
    const mask = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 32), frameM); ring.scale.set(es.x * 0.62, es.y * 1.25, 0.012); mask.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(1, 32), glassM); lens.scale.set(es.x * 0.62, es.y * 1.25, 1); mask.add(lens);
    attach(mask, head, ec.clone().add(new THREE.Vector3(0, -0.004, 0.016))); gear.both.push(mask);
    const hb = centerOf('headskin'), hc = hb.getCenter(new THREE.Vector3()), hs = hb.getSize(new THREE.Vector3());
    const strap = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 40), strapM); strap.scale.set(hs.x * 0.53, hs.z * 0.55, 0.25); strap.rotation.x = Math.PI / 2;
    attach(strap, head, new THREE.Vector3(hc.x, ec.y + 0.004, hc.z - 0.004)); strap.rotation.x = Math.PI / 2; gear.both.push(strap);
    const mouth = centerOf('smile').getCenter(new THREE.Vector3());
    const tubeCurve = new THREE.CatmullRomCurve3([mouth.clone().add(new THREE.Vector3(0, 0, 0.01)), mouth.clone().add(new THREE.Vector3(0.05, -0.005, 0)), new THREE.Vector3(hs.x * 0.55, ec.y - 0.02, hc.z + 0.01), new THREE.Vector3(hs.x * 0.58, ec.y + 0.07, hc.z - 0.01), new THREE.Vector3(hs.x * 0.5, hb.max.y + 0.06, hc.z - 0.04)]);
    const tubeGeo = new THREE.TubeGeometry(tubeCurve, 30, 0.011, 8); const tube = new THREE.Mesh(tubeGeo, yellow);
    attach(tube, head, new THREE.Vector3()); gear.snorkel.push(tube);
    const chest = bone('chest');
    const tank = new THREE.Group(); const cyl = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.34, 6, 18), yellow); tank.add(cyl);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.07, 12), own(new THREE.MeshStandardMaterial({ color: '#C8CCD2', metalness: 0.85, roughness: 0.3 }))); valve.position.y = 0.25; tank.add(valve);
    for (const y of [-0.1, 0.12]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 24), strapM); band.rotation.x = Math.PI / 2; band.position.y = y; tank.add(band); }
    attach(tank, chest, new THREE.Vector3(0, 0.95, -0.2)); gear.scuba.push(tank);
    const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(0.02, 1.22, -0.2), new THREE.Vector3(0.15, 1.24, -0.06), new THREE.Vector3(0.12, 1.2, 0.1), mouth.clone().add(new THREE.Vector3(0.02, -0.005, 0.01))]);
    const hoseMesh = new THREE.Mesh(new THREE.TubeGeometry(hose, 24, 0.012, 8), hoseM); attach(hoseMesh, chest, new THREE.Vector3()); gear.scuba.push(hoseMesh);
    for (const n of ['foot_L', 'foot_R']) {
      const f = bone(n), r = rest.get(f), p = new THREE.Vector3().setFromMatrixPosition(r.M);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.28), frameM); attach(fin, f, new THREE.Vector3(p.x, 0.012, p.z + 0.17)); gear.both.push(fin);
    }
    [...gear.both, ...gear.snorkel, ...gear.scuba].forEach((g) => { g.visible = false; g.traverse((x) => { if (x.isMesh) x.castShadow = true; }); });
  }
  const setGear = (mode) => {
    if (mode === gear.mode) return; gear.mode = mode;
    gear.both.forEach((g) => { g.visible = !!mode; }); gear.snorkel.forEach((g) => { g.visible = mode === 'snorkel'; }); gear.scuba.forEach((g) => { g.visible = mode === 'scuba'; });
  };

  // ---- Movement (same feel as before, now moving real bones) ----
  const st = { phase: 0, blink: 2 + Math.random() * 2, squash: 0, kick: 0, glow: 0, legX: [0, 0], knee: [0, 0], armX: [0, 0], armZ: [0, 0], elbow: [0, 0] };
  poseBones();
  return {
    kind: 'liev', name: L.name, root, height: L.height, radius: 0.24, halfWidth: 0.27, model: '3d', setGear, get gear() { return gear.mode; },
    parts: { bones, meshes },
    set glow(v) { st.glow = v; }, get glow() { return st.glow; },
    land(strength = 1) { st.squash = Math.min(1, 0.4 + strength * 0.4); },
    kick() { st.kick = 1; },
    animate(dt, a = {}) {
      const speed = a.speed || 0, s = Math.min(1, speed / 3.2);
      const A = speed > 0.05 ? Math.min(0.85, 0.32 + speed * 0.085) : 0;
      const cycle = Math.max(0.6, 4 * 0.62 * Math.sin(Math.max(A, 0.2)) * (speed > 4.5 ? 1.25 : 1));
      st.phase += dt * (speed > 0.05 ? (Math.PI * 2 * speed / cycle) : 0) + dt * (a.climbing ? 7 : 0);
      const air = a.onGround === false && !a.climbing && !a.swimming;
      const swim = a.swimming;
      const swing = Math.sin(st.phase);
      st.kick = Math.max(0, st.kick - dt * 3.5);
      const t = performance.now() / 1000;
      for (let i = 0; i < 2; i++) {
        const ph = st.phase + i * Math.PI;
        let tx = Math.sin(ph) * A, kn = A * 1.6 * Math.max(0, -Math.cos(ph)) + (speed > 4.5 ? 0.25 : 0.05) * (A > 0 ? 1 : 0);
        if (air) { tx = i === 0 ? -0.7 : 0.3; kn = i === 0 ? 0.9 : 0.5; }
        if (a.climbing) { tx = Math.sin(ph) * 0.6 - 0.4; kn = 0.6 + Math.max(0, Math.cos(ph)) * 0.6; }
        if (swim) { tx = Math.sin(t * 5 + i * Math.PI) * 0.35; kn = 0.15 + Math.max(0, Math.sin(t * 5 + i * Math.PI)) * 0.25; }   // flutter kick
        if (i === 0 && st.kick > 0) { tx = -Math.sin(st.kick * Math.PI) * 1.4; kn = 0.1; }
        st.legX[i] = damp(st.legX[i], tx, 20, dt); st.knee[i] = damp(st.knee[i], kn, 20, dt);
        D.get(legs[i]).set(st.legX[i], 0, 0); D.get(knees[i]).set(st.knee[i], 0, 0);
        const sg = i === 0 ? -1 : 1;
        let ax = swing * A * 0.9 * sg, az = -sg * (0.1 - A * 0.1), el = -0.15 - A * 0.35;
        if (air) { ax = -0.4; az = sg * 0.6; el = -0.3; }
        if (a.climbing) { ax = -2.6 + Math.sin(st.phase + i * Math.PI) * 0.4; az = 0; el = -0.3; }
        if (a.cheer) { ax = -2.8 + Math.sin(st.phase * 6 + i) * 0.3; az = sg * 0.3; el = -0.2; }
        if (swim) { ax = -1.2 + Math.sin(t * 2.5 + i * Math.PI) * 0.9; az = sg * 0.45; el = -0.4; }                         // breaststroke-ish
        st.armX[i] = damp(st.armX[i], ax, 14, dt); st.armZ[i] = damp(st.armZ[i], az, 14, dt); st.elbow[i] = damp(st.elbow[i], el, 14, dt);
        D.get(arms[i]).set(st.armX[i], 0, st.armZ[i]); D.get(elbows[i]).set(st.elbow[i], 0, 0);
      }
      D.get(bone('head')).set(Math.sin(t * 0.7) * 0.03 * (1 - s), Math.sin(t * 0.45) * 0.06 * (1 - s), 0);   // little idle head movements
      D.get(bone('chest')).set(0, swing * A * 0.12, 0);
      poseBones();
      rig.position.y = Math.abs(Math.cos(st.phase)) * 0.03 * s - (speed > 4.5 ? 0.02 : 0);
      rig.rotation.x = damp(rig.rotation.x, s * 0.08, 6, dt);
      st.squash = damp(st.squash, 0, 8, dt);
      rig.scale.set(1 + st.squash * 0.05, 1 - st.squash * 0.08, 1 + st.squash * 0.05);
      st.blink -= dt; const closed = st.blink < 0.11; blinkers.forEach((l) => { l.visible = closed; });
      if (st.blink < 0) st.blink = 2.5 + Math.random() * 2.5;
    },
    dispose() {
      disposables.forEach((m) => m.dispose());
      root.traverse((x) => { if (x.geometry && !x.isSkinnedMesh) x.geometry.dispose(); });
    },
  };
}
