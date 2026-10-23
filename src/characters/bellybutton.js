// Belly Button, the plush bear — built from his look settings (looks.js).
import * as THREE from 'three';
import { BELLY_BUTTON as L } from './looks.js';
import { plushDash, felt } from '../textures.js';
import { damp } from '../util.js';

let shared = null;
function materials() {
  if (shared) return shared;
  const fabTex = plushDash(L.fabric, L.dashes, 11, 512, 520); fabTex.repeat.set(2, 1.5);
  const fabSmall = plushDash(L.fabric, L.dashes, 12, 512, 520); fabSmall.repeat.set(0.6, 0.6);
  const plush = (map) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#9A9CA8'), sheenRoughness: 0.5 });
  const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra });
  shared = {
    fabric: plush(fabTex),
    fabricSmall: plush(fabSmall),
    cream: new THREE.MeshPhysicalMaterial({ map: felt(L.cream, 3, 0.05), roughness: 1, sheen: 1, sheenColor: new THREE.Color('#FFFFFF'), sheenRoughness: 0.6 }),
    nose: new THREE.MeshPhysicalMaterial({ color: L.nose, roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color('#555') }),
    thread: new THREE.MeshStandardMaterial({ color: L.thread, roughness: 0.8 }),
    eyeRing: flat(L.eyeRing), eyeCenter: flat(L.eyeCenter, { polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    eyeOutline: flat(L.eyeOutline, { polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    earInner: new THREE.MeshPhysicalMaterial({ color: L.earInner, roughness: 1, sheen: 1, sheenColor: new THREE.Color('#FFD0A8') }),
    tag: new THREE.MeshStandardMaterial({ color: L.tag, roughness: 0.7 }),
  };
  return shared;
}

export function buildBellyButton() {
  const m = materials();
  const H = L.height;
  const root = new THREE.Group(); root.name = 'BellyButton';
  const body = new THREE.Group(); root.add(body);

  // Tall rounded pillow-like body (one piece, head slightly narrower).
  const prof = [[0, 0], [0.15, 0.008], [0.205, 0.05], [0.218, 0.15], [0.22, 0.35], [0.215, 0.55], [0.205, 0.68], [0.198, 0.78], [0.19, 0.86], [0.17, 0.93], [0.12, 0.978], [0.0, 1.0]];
  const curve = new THREE.CatmullRomCurve3(prof.map(p => new THREE.Vector3(p[0] * H, p[1] * H, 0)), false, 'centripetal');
  const pts = curve.getPoints(64).map(v => new THREE.Vector2(Math.max(0, v.x), v.y));
  pts[0].set(0, 0); pts[pts.length - 1].set(0, H);
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), m.fabric);
  shell.castShadow = true; shell.receiveShadow = true; body.add(shell);
  const rAt = (y) => {
    for (let i = 1; i < pts.length; i++) if (pts[i].y >= y) {
      const a = pts[i - 1], b = pts[i], t = (y - a.y) / Math.max(1e-6, b.y - a.y); return a.x + (b.x - a.x) * t;
    }
    return 0;
  };
  const onSurface = (y, ang, out = 0) => { const r = rAt(y) + out; return new THREE.Vector3(Math.sin(ang) * r, y, Math.cos(ang) * r); };
  const sphere = (r, a = 32, b = 20) => new THREE.SphereGeometry(r, a, b);

  // Big cream belly patch.
  const patch = new THREE.Mesh(sphere(1, 48, 32), m.cream);
  patch.scale.set(0.135 * H, 0.2 * H, 0.06 * H);
  patch.position.set(0, 0.38 * H, rAt(0.38 * H) - 0.035 * H);
  patch.castShadow = true; body.add(patch);

  // The belly button! (tiny tan dot low on the patch — glows when magic happens)
  const bbMat = new THREE.MeshStandardMaterial({ color: L.bellyButton, roughness: 0.8, emissive: new THREE.Color(L.bellyButtonGlow), emissiveIntensity: 0 });
  const bellyButton = new THREE.Mesh(sphere(0.012 * H, 16, 10), bbMat);
  bellyButton.scale.z = 0.5;
  bellyButton.position.set(0, 0.22 * H, patch.position.z + 0.06 * H * Math.sqrt(1 - 0.64) + 0.002);
  body.add(bellyButton);
  const glowLight = new THREE.PointLight(L.bellyButtonGlow, 0, 3, 2);
  glowLight.position.copy(bellyButton.position).add(new THREE.Vector3(0, 0, 0.15));
  body.add(glowLight);

  // Cream muzzle, black nose, stitched smile.
  const muzzle = new THREE.Mesh(sphere(1, 40, 28), m.cream);
  muzzle.scale.set(0.105 * H, 0.092 * H, 0.07 * H);
  const mz = rAt(0.8 * H) - 0.03 * H;
  muzzle.position.set(0, 0.8 * H, mz); body.add(muzzle);
  const nose = new THREE.Mesh(sphere(0.032 * H, 24, 16), m.nose);
  nose.scale.set(1.15, 0.85, 0.75);
  nose.position.set(0, 0.852 * H, mz + 0.07 * H * 0.84 - 0.004); body.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03 * H, 0.0035 * H, 6, 24, 2.0), m.thread);
  smile.rotation.z = -Math.PI / 2 - 1.0; smile.rotation.x = -0.18;
  smile.position.set(0, 0.79 * H, mz + 0.07 * H * 0.975 + 0.001); body.add(smile);
  const stitch = new THREE.Mesh(new THREE.CylinderGeometry(0.0032 * H, 0.0032 * H, 0.035 * H, 6), m.thread);
  stitch.position.set(0, 0.818 * H, mz + 0.07 * H * 0.995); stitch.rotation.x = -0.25; body.add(stitch);

  // Embroidered eyes: dark outline, white ring, grey-blue center.
  for (const s of [-1, 1]) {
    const a = s * 0.6, p = onSurface(0.872 * H, a, 0.0015);
    const n = new THREE.Vector3(Math.sin(a), 0.12, Math.cos(a)).normalize();
    const eye = new THREE.Group(); eye.position.copy(p); eye.lookAt(p.clone().add(n)); body.add(eye);
    const outline = new THREE.Mesh(new THREE.CircleGeometry(0.039 * H, 28), m.eyeOutline); eye.add(outline);
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.035 * H, 28), m.eyeRing); ring.position.z = 0.0008; eye.add(ring);
    const ctr = new THREE.Mesh(new THREE.CircleGeometry(0.019 * H, 24), m.eyeCenter); ctr.position.z = 0.0016; eye.add(ctr);
  }

  // Round ears on the top corners, orange-tan inside.
  for (const s of [-1, 1]) {
    const a = s * 0.82, p = onSurface(0.94 * H, a, -0.01);
    p.y += 0.025 * H;
    const ear = new THREE.Group(); ear.position.copy(p);
    ear.lookAt(p.clone().add(new THREE.Vector3(Math.sin(a) * 0.55, 0.25, 1)));
    const outer = new THREE.Mesh(sphere(0.055 * H, 24, 16), m.fabricSmall); outer.scale.z = 0.42; outer.castShadow = true; ear.add(outer);
    const inner = new THREE.Mesh(sphere(0.034 * H, 20, 12), m.earInner); inner.scale.z = 0.25; inner.position.z = 0.018 * H; ear.add(inner);
    body.add(ear);
  }

  // Short stubby arms that stick out a little.
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.copy(onSurface(0.57 * H, s * 1.35, -0.02 * H));
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.038 * H, 0.085 * H, 6, 14), m.fabricSmall);
    arm.position.set(s * 0.035 * H, -0.05 * H, 0.012 * H); arm.rotation.z = s * 0.75; arm.castShadow = true;
    pivot.add(arm); body.add(pivot); arms.push(pivot);
  }
  // Short rounded feet.
  const feet = [];
  for (const s of [-1, 1]) {
    const foot = new THREE.Mesh(sphere(1, 24, 16), m.fabricSmall);
    foot.scale.set(0.058 * H, 0.045 * H, 0.085 * H);
    foot.position.set(s * 0.085 * H, 0.04 * H, 0.12 * H); foot.castShadow = true;
    root.add(foot); feet.push(foot);
  }
  // Little red tag on his side.
  if (L.showTag) {
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.014 * H, 0.045 * H, 0.03 * H), m.tag);
    tag.position.copy(onSurface(0.1 * H, Math.PI / 2, 0.004)); body.add(tag);
  }

  const st = { phase: 0, squash: 0, glow: 0, blinkT: 0 };
  return {
    kind: 'bellybutton', name: L.name, root, height: H, radius: 0.24, halfWidth: 0.23,
    parts: { arms, feet, bellyButton, bbMat, glowLight },
    set glow(v) { st.glow = v; }, get glow() { return st.glow; },
    land(strength = 1) { st.squash = Math.min(1, 0.5 + strength * 0.5); },
    animate(dt, a = {}) {
      const speed = a.speed || 0, s = Math.min(1, speed / 3);
      st.phase += dt * (speed > 0.05 ? Math.PI * 2 * speed / 0.55 : 2); // short legs take quick little steps
      // Waddle, steps, arm swing.
      body.rotation.z = Math.sin(st.phase) * 0.09 * s;
      body.position.y = Math.abs(Math.sin(st.phase)) * 0.025 * s;
      feet.forEach((f, i) => {
        const ph = st.phase + i * Math.PI;
        f.position.y = 0.04 * H + Math.max(0, Math.sin(ph)) * 0.07 * s;   // lift one foot...
        f.position.z = 0.12 * H + Math.cos(ph) * 0.1 * s;                // ...and swing it forward while the other goes back
      });
      const air = a.onGround === false;
      arms.forEach((p, i) => {
        const sg = i === 0 ? -1 : 1;
        const targetZ = a.floating ? sg * 1.1 : air ? sg * 0.6 : sg * 0.05 * Math.sin(st.phase * 0.5);
        p.rotation.z = damp(p.rotation.z, targetZ, 10, dt);
        p.rotation.x = Math.sin(st.phase + i * Math.PI) * 0.45 * s + (a.cheer ? Math.sin(st.phase * 3) * 0.8 - 1.2 : 0);
      });
      // Squash when landing, puff up when floating.
      st.squash = damp(st.squash, 0, 7, dt);
      const puff = a.floating ? 1.1 : 1;
      body.scale.set((1 + st.squash * 0.1) * puff, 1 - st.squash * 0.16, (1 + st.squash * 0.1) * puff);
      if (!air && speed < 0.1) body.scale.y *= 1 + Math.sin(st.phase * 0.7) * 0.008; // breathing
      // Belly button glow.
      bbMat.emissiveIntensity = st.glow * 4;
      glowLight.intensity = st.glow * 2.5;
    },
    dispose() { root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); bbMat.dispose(); },
  };
}
