// LIEV'S COZY COVE — a small, calm 3D sandbox to explore.
// A sandy beach on a turquoise lagoon with a coral reef you can swim in (sea turtle and fish!),
// a meadow of short grass and wildflowers, a pine grove with fallen logs and a campfire,
// and a rocky headland with a waterfall and a sunset lookout. Press T to change the time of day.
//
// Everything is drawn in code (no image files): terrain, plants, water, sky and particles.
// Things are placed with a fixed random seed, so the cove looks the same every time.
import * as THREE from 'three';
import { makeCanvas, toTexture } from '../textures.js';
import { rng } from '../util.js';

export const WL = 0;                      // water level
const SIZE = 180, N = 240;                // terrain: 180 m square, 0.75 m between points
const HALF = SIZE / 2, SEG = SIZE / N;
const CAMPFIRE = { x: 18, z: -20 };
const POOL = { x: -16, z: 4.5 };          // waterfall pool
const LOOKOUT = { x: -30, z: 17 };
const PIER = { x: 22, z0: 7.2, z1: 19, deck: 0.9 };
const SPAWN = { x: 4, z: 3 };
const REEF = [[-4, 16, 4.5, -1.3], [6, 21, 5, -1.1], [14, 15, 3.5, -1.4], [-12, 24, 4, -1.5], [18, 27, 4.5, -1.6], [2, 31, 5, -1.8], [-6, 29, 3, -1.2], [27, 21, 3, -1.5]];
// Paths (dirt trails): spawn → meadow → campfire; meadow → ramp → lookout; beach → pier.
const PATHS = [
  [[4, 3], [2.5, -4], [0, -11], [6, -17], [13, -20], [16, -20]],
  [[0, -11], [-7, -17], [-15, -21], [-23, -20], [-29, -13], [-31, -2], [-31, 9], [-30, 15]],
  [[4, 3], [11, 4.5], [17, 4.6], [22, 6.5]],
  [[-31, 0], [-27.5, 1.6]],
];
const TIMES = ['sunset', 'day', 'night'];
const TIME_NAMES = { sunset: 'Golden hour', day: 'Sunny day', night: 'Starry night' };
const PRESETS = {
  sunset: { zen: '#3B5BA5', hor: '#F7A56F', gnd: '#D08F74', sunCol: '#FFB27A', sunDir: [-0.55, 0.11, 0.83], sunI: 2.5, light: '#FFD2A6', hemiS: '#FFE4CC', hemiG: '#6E8060', hemiI: 1.15,
    fog: '#E9A98A', fogD: 0.0062, shallow: '#62D9CF', deep: '#13608E', mtn: ['#6C5A8C', '#93739C', '#BC8FA2'], fire: 0.45, night: 0, cloud: 1, motes: 0.9, under: '#1C7F9C' },
  day: { zen: '#2F86DF', hor: '#BFE4F6', gnd: '#9FC3CF', sunCol: '#FFF4DE', sunDir: [-0.32, 0.78, 0.45], sunI: 2.9, light: '#FFF2DC', hemiS: '#DDF1FF', hemiG: '#6F9A5E', hemiI: 1.0,
    fog: '#C2DFEC', fogD: 0.0045, shallow: '#7DEAE0', deep: '#1475A8', mtn: ['#5B7DA0', '#7C98B6', '#A5BCD0'], fire: 0, night: 0, cloud: 0.8, motes: 0.55, under: '#1E95B4' },
  night: { zen: '#060D24', hor: '#1B3558', gnd: '#13202E', sunCol: '#AFC4FF', sunDir: [0.35, 0.5, -0.62], sunI: 1.0, light: '#A8C0FF', hemiS: '#6080C0', hemiG: '#2C3E52', hemiI: 1.0,
    fog: '#1E3352', fogD: 0.0065, shallow: '#1F6B7E', deep: '#071E38', mtn: ['#141E38', '#1C2846', '#263454'], fire: 1, night: 1, cloud: 0.35, motes: 0.12, under: '#0B3550' },
};

// ---------------------------------------------------------------------------
// Little math helpers
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const shoreZ = (x) => 8 + 4 * Math.sin(x * 0.07) + 3 * Math.cos(x * 0.13 + 1);
function pathDist(x, z) {
  let best = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), ex = ax + dx * t - x, ez = az + dz * t - z;
    best = Math.min(best, ex * ex + ez * ez);
  }
  return Math.sqrt(best);
}
const groveMask = (x, z) => Math.max(Math.exp(-((x - 22) ** 2 / (2 * 13 * 13) + (z + 26) ** 2 / (2 * 11 * 11))), sstep(-33, -42, z));
const plateauMask = (x, z) => {
  const ramp = Math.exp(-((z + 20) ** 2) / 30);
  return sstep(-19 + ramp * 9, -25, x) * sstep(30, 21, z);
};

// The shape of the land (before smoothing into a grid).
function rawHeight(x, z, flatten = true) {
  const d = shoreZ(x) - z;
  let h;
  if (d > 0) {
    h = 0.5 + Math.min(d, 6) * 0.12 + Math.max(0, d - 6) * 0.07;
    const roll = sstep(4, 14, d);
    h += roll * (0.7 * Math.sin(x * 0.09 + 0.5) * Math.cos(z * 0.08) + 0.7 * (vnoise(x * 0.06, z * 0.06) - 0.5));
    h += 1.6 * Math.exp(-((x - 22) ** 2 + (z + 26) ** 2) / 260);
  } else {
    const s = -d;
    h = 0.5 - s * 0.55;
    const bed = -3.6 + 0.5 * Math.sin(x * 0.17) * Math.cos(z * 0.15) + 0.5 * (vnoise(x * 0.12, z * 0.12) - 0.5);
    h = Math.max(h, bed);
    for (const [rx, rz, rr, top] of REEF) { const q = ((x - rx) ** 2 + (z - rz) ** 2) / (rr * rr); if (q < 1) h = Math.max(h, bed + (top - bed) * (1 - q) * (1 - q)); }
    if (z > 44) h -= (z - 44) * 0.45;
  }
  if (z < -42) h += (-42 - z) ** 2 * 0.12;                                          // soft hills at the back
  const ax = Math.abs(x); if (ax > 44 && d > -4) h += (ax - 44) ** 2 * 0.12 * sstep(-4, 0, d);
  // The rocky headland in the west (a flat top, cliffs down to the lagoon, a gentle ramp near z = -20).
  const pm = plateauMask(x, z);
  if (pm > 0) {
    let top = 6.2 + 0.6 * (vnoise(x * 0.15, z * 0.15) - 0.5);
    const sp = Math.hypot(x + 30, z - 2); if (sp < 2.6) top -= 0.5 * (1 - (sp / 2.6) ** 2);   // little spring pond
    h = Math.max(h, top * pm);
  }
  const dp = Math.hypot(x - POOL.x, z - POOL.z); if (dp < 4.2) h = Math.min(h, -1.1 + (dp / 4.2) ** 2 * 1.7);
  if (flatten) { const dc = Math.hypot(x - CAMPFIRE.x, z - CAMPFIRE.z); if (dc < 7.5) h += (CAMP_H - h) * (1 - sstep(4, 7.5, dc)); }
  return h;
}
const CAMP_H = rawHeight(CAMPFIRE.x, CAMPFIRE.z, false);

// The grid the ground mesh is made from. Walking uses exactly the same grid, so feet always touch the ground.
const GRID = new Float32Array((N + 1) * (N + 1));
for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) GRID[iz * (N + 1) + ix] = rawHeight(-HALF + ix * SEG, -HALF + iz * SEG);
export function coveHeight(x, z) {
  const gx = (x + HALF) / SEG, gz = (z + HALF) / SEG;
  if (gx < 0 || gz < 0 || gx >= N || gz >= N) return rawHeight(x, z);
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, W = N + 1;
  const ha = GRID[iz * W + ix], hd = GRID[iz * W + ix + 1], hb = GRID[(iz + 1) * W + ix], hc = GRID[(iz + 1) * W + ix + 1];
  return fx + fz <= 1 ? ha + (hd - ha) * fx + (hb - ha) * fz : hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}
function slopeAt(x, z) { const e = 0.6; const dx = coveHeight(x + e, z) - coveHeight(x - e, z), dz = coveHeight(x, z + e) - coveHeight(x, z - e); return 1 / Math.sqrt(1 + (dx * dx + dz * dz) / (4 * e * e)); }

// ---------------------------------------------------------------------------
// Shader helpers: wind for plants, and light patterns (caustics) under the water
// ---------------------------------------------------------------------------
const CAUSTIC_GLSL = `
  float causticLine(vec2 p, float t) {   // the classic "light net" on a sandy sea floor
    vec2 i = p; float c = 1.0, inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0; c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.0);
  }`;
function patch(mat, U, { wind = 0, windSpeed = 1.6, push = 0, key }) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uWL: U.uWL, uPlayer: U.uPlayer, uCaus: U.uCaus, uWindAmp: { value: wind }, uWindSpeed: { value: windSpeed }, uPush: { value: push } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec3 uPlayer; uniform float uWindAmp; uniform float uWindSpeed; uniform float uPush;
        ${wind ? 'attribute float sway;' : ''}
        varying vec3 vWPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${wind ? `{
          #ifdef USE_INSTANCING
            mat4 wm = modelMatrix * instanceMatrix;
          #else
            mat4 wm = modelMatrix;
          #endif
          vec3 bp = wm[3].xyz;
          float ph = uTime * uWindSpeed + bp.x * 0.31 + bp.z * 0.23;
          float gust = 0.6 + 0.4 * sin(uTime * 0.37 + bp.x * 0.05 + bp.z * 0.03);
          vec3 off = vec3(sin(ph) * 0.7 + 0.45, 0.0, cos(ph * 0.83 + 1.1) * 0.45) * uWindAmp * gust * sway;
          vec3 wp = (wm * vec4(transformed, 1.0)).xyz;
          vec2 dd = wp.xz - uPlayer.xz; float dl = length(dd);
          float pk = uPush * (1.0 - smoothstep(0.15, 0.85, dl)) * step(abs(uPlayer.y - wp.y), 1.2) * sway;
          off.xz += (dd / max(dl, 0.001)) * pk; off.y -= pk * 0.5;
          transformed += inverse(mat3(wm)) * off;
        }` : ''}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uWL; uniform float uCaus; varying vec3 vWPos;
        ${CAUSTIC_GLSL}`)
      .replace('#include <opaque_fragment>', `{
          float uw = smoothstep(uWL + 0.05, uWL - 0.35, vWPos.y);
          if (uw > 0.0) {
            float dpt = clamp((uWL - vWPos.y) / 7.0, 0.0, 1.0);
            float cc = causticLine(vWPos.xz * 0.55, uTime * 0.5);
            outgoingLight += cc * uw * uCaus * (1.0 - dpt * 0.75) * vec3(0.6, 0.9, 0.95) * 0.35 * (0.4 + 0.6 * outgoingLight);
            outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.55, 0.85, 0.95), uw * (0.1 + dpt * 0.4));
          }
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'cove-' + key;
  return mat;
}

// Build geometry pieces with per-vertex color and "sway" (how much the wind moves that point).
function prep(geo, colorFn, swayFn = () => 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3), sw = new Float32Array(p.count);
  const v = new THREE.Vector3(), nn = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i); colorFn(v, nn, c, i); col.set([c.r, c.g, c.b], i * 3); sw[i] = swayFn(v, i); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('sway', new THREE.BufferAttribute(sw, 1));
  return g;
}
function merge(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color', 'sway']) {
    const sz = geos[0].attributes[name].itemSize, arr = new Float32Array(n * sz); let o = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
  }
  out.computeBoundingSphere(); return out;
}
const C = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------------------
export function buildCove(game) {
  const hi = !game || game.settings.quality !== 'low';
  const R = rng(5150);
  const scene = new THREE.Scene();
  const U = { uTime: { value: 0 }, uWL: { value: WL }, uPlayer: { value: new THREE.Vector3(0, -99, 0) }, uCaus: { value: 1 } };
  const circles = [], boxes = [], interact = [], updaters = [];
  const dummy = new THREE.Object3D();
  const occupied = [];   // spots already used by trees/rocks so things don't overlap
  const free = (x, z, r) => occupied.every(o => Math.hypot(o.x - x, o.z - z) > o.r + r);
  const occupy = (x, z, r) => occupied.push({ x, z, r });

  // ---------------- Sky, sun and fog ----------------
  const cur = {}; const lerpPreset = (name, k) => {
    const P = PRESETS[name];
    for (const key of ['zen', 'hor', 'gnd', 'sunCol', 'light', 'hemiS', 'hemiG', 'fog', 'shallow', 'deep', 'under']) { if (!cur[key]) cur[key] = C(P[key]); else cur[key].lerp(C(P[key]), k); }
    for (const key of ['sunI', 'hemiI', 'fogD', 'fire', 'night', 'cloud', 'motes']) cur[key] = cur[key] === undefined ? P[key] : cur[key] + (P[key] - cur[key]) * k;
    const sd = new THREE.Vector3(...P.sunDir).normalize(); cur.sunDir = cur.sunDir ? cur.sunDir.lerp(sd, k).normalize() : sd;
    cur.mtn = P.mtn.map((h, i) => (cur.mtn ? cur.mtn[i].lerp(C(h), k) : C(h)));
  };
  let timeName = 'sunset'; lerpPreset(timeName, 1);

  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uZen: { value: cur.zen }, uHor: { value: cur.hor }, uGnd: { value: cur.gnd }, uSunDir: { value: cur.sunDir }, uSunCol: { value: cur.sunCol }, uNight: { value: 0 }, uTime: U.uTime, uCloud: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uZen, uHor, uGnd, uSunDir, uSunCol; uniform float uNight, uTime, uCloud; varying vec3 vDir;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vn(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = h > 0.0 ? mix(uHor, uZen, pow(smoothstep(0.0, 0.6, h), 0.75)) : mix(uHor, uGnd, smoothstep(0.0, -0.12, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunCol * (pow(sd, 5.0) * 0.28 + pow(sd, 48.0) * 0.5) * (1.0 - uNight * 0.75);
        col += uSunCol * smoothstep(0.9986, 0.9993, sd) * mix(4.0, 1.3, uNight);
        if (h > 0.0) {
          vec2 cp = d.xz / (h + 0.14) * 1.3 + vec2(uTime * 0.006, uTime * 0.002);
          float c = fbm(cp); c = smoothstep(0.5, 0.78, c) * smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.32, 0.7, h));
          vec3 lit = mix(uHor * 1.1 + vec3(0.04), uSunCol * 1.25, pow(sd, 2.5) * 0.9);
          vec3 cc = mix(lit, uZen * 0.7 + uHor * 0.3, smoothstep(0.55, 0.85, fbm(cp + 4.0)) * 0.5);
          col = mix(col, mix(cc, uZen * 1.3 + vec3(0.03), uNight * 0.85), c * uCloud);
          if (uNight > 0.01) {
            vec3 sp = floor(d * 280.0); float st = step(0.9968, h31(sp));
            col += vec3(st * (0.55 + 0.45 * sin(uTime * 2.5 + h31(sp + 1.0) * 40.0)) * uNight * smoothstep(0.03, 0.25, h) * (1.0 - c));
            float north = smoothstep(0.15, -0.75, d.z), band = smoothstep(0.06, 0.2, h) * (1.0 - smoothstep(0.32, 0.62, h));
            float a = fbm(vec2(d.x * 2.6 + uTime * 0.025, h * 1.8));
            float curtain = pow(0.5 + 0.5 * sin(d.x * 13.0 + a * 7.0 + uTime * 0.22), 3.0);
            col += vec3(0.12, 0.95, 0.58) * curtain * band * north * uNight * (0.45 + 0.55 * a);
            col += vec3(0.45, 0.2, 0.75) * band * north * uNight * 0.18 * smoothstep(0.25, 0.5, h);
            col += vec3(0.04, 0.08, 0.16) * uNight * pow(1.0 - abs(d.x * 0.6 - d.z * 0.3), 6.0) * smoothstep(0.0, 0.5, h);   // a faint milky way
          }
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  const hemi = new THREE.HemisphereLight(cur.hemiS, cur.hemiG, cur.hemiI); scene.add(hemi);
  const sun = new THREE.DirectionalLight(cur.light, cur.sunI);
  sun.castShadow = true; sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; scene.add(sun, sun.target);
  scene.fog = new THREE.FogExp2(cur.fog.clone(), cur.fogD);

  // Faraway mountains in layers (lighter and hazier the farther they are), low islands to the south.
  const mtnMats = [];
  [[175, 0], [215, 1], [265, 2]].forEach(([rad, li]) => {
    const segs = 420, pos = [], tv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2, x = Math.sin(a) * rad, z = -Math.cos(a) * rad;   // a = 0 is north (−z)
      const north = Math.max(0, Math.cos(a)), side = Math.abs(Math.sin(a));
      const u = i * 0.43;   // smooth ridges with a few peaks
      let hgt = (14 + 48 * north ** 1.5 + 14 * side * (1 - north)) * (0.45 + 0.75 * vnoise(u * 0.09 + li * 7, li * 3) + 0.3 * vnoise(u * 0.25 + li, 5)) * (1 - li * 0.08);
      hgt += 9 * (1 - Math.abs(2 * vnoise(u * 0.6 + li * 9, 2) - 1)) * (0.3 + north);
      if (Math.cos(a) < -0.35) { const isl = vnoise(u * 0.08, li * 5); hgt = isl > 0.62 ? (isl - 0.62) * 60 * (0.7 + 0.3 * vnoise(u * 0.5, li)) : -4; }   // ocean to the south, a few islands
      pos.push(x, -3, z, x, hgt, z); tv.push(0, 1);
      if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('t', new THREE.Float32BufferAttribute(tv, 1)); g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: cur.mtn[li].clone() }, uBot: { value: cur.hor.clone() } },
      vertexShader: 'attribute float t; varying float vT; void main() { vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uTop, uBot; varying float vT; void main() { gl_FragColor = vec4(mix(uBot, uTop, smoothstep(0.0, 0.7, vT)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      side: THREE.DoubleSide, fog: false, depthWrite: true,
    });
    m.userData.layer = li; mtnMats.push(m);
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -5 + li; mesh.frustumCulled = false; scene.add(mesh);
  });

  // ---------------- Ground ----------------
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N); geo.rotateX(-Math.PI / 2);
  const gp = geo.attributes.position;
  for (let i = 0; i < gp.count; i++) { const ix = i % (N + 1), iz = Math.floor(i / (N + 1)); gp.setY(i, GRID[iz * (N + 1) + ix]); }
  geo.computeVertexNormals();
  const gn = geo.attributes.normal, gcol = new Float32Array(gp.count * 3);
  const cSandDry = C('#F7E8C4'), cSandWet = C('#DCC596'), cSandSea = C('#E6D6A6'), cSeaDeep = C('#B9AE86'), cGrass = C('#77B04C'), cGrassY = C('#A5BF56'), cGrassD = C('#4F8C3A'),
    cForest = C('#4C7634'), cDirt = C('#7A6040'), cPath = C('#B58F5E'), cRock = C('#8E887E'), cRockD = C('#6C675F'), cMoss = C('#6E8F45'), tc = new THREE.Color(), t2 = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), h = gp.getY(i), ny = gn.getY(i), d = shoreZ(x) - z, n1 = vnoise(x * 0.11, z * 0.11), n2 = vnoise(x * 0.43 + 9, z * 0.43);
    if (h < -0.15) tc.copy(cSandSea).lerp(cSeaDeep, sstep(-0.5, -4, h)).lerp(C('#D9C29A'), n2 * 0.25);
    else if (h < 0.35) tc.copy(cSandWet).lerp(cSandDry, sstep(0.05, 0.35, h));
    else {
      const beach = 1 - sstep(4.5, 7, d);
      tc.copy(cGrass).lerp(cGrassY, sstep(0.45, 0.8, n1)).lerp(cGrassD, sstep(0.45, 0.15, n1) * 0.8);
      const gm = groveMask(x, z); tc.lerp(cForest, sstep(0.3, 0.6, gm)); if (gm > 0.45 && n2 > 0.62) tc.lerp(cDirt, 0.45);
      const pm = plateauMask(x, z); if (pm > 0.5) tc.lerp(cMoss, 0.35 + n2 * 0.3);
      tc.lerp(cSandDry.clone().lerp(cSandWet, 0.1 + n2 * 0.15), beach * (pm > 0.5 ? 0 : 1));
      const rock = sstep(0.82, 0.62, ny); tc.lerp(t2.copy(cRock).lerp(cRockD, n2), rock);
      const pd = pathDist(x, z); if (pd < 1.25 && h > 0.25) tc.lerp(cPath.clone().lerp(cDirt, n2 * 0.4), (1 - sstep(0.55, 1.25, pd)) * (1 - rock * 0.7));
      const dc = Math.hypot(x - CAMPFIRE.x, z - CAMPFIRE.z); if (dc < 4.2) tc.lerp(cDirt, (1 - sstep(2.5, 4.2, dc)) * 0.75);
    }
    gcol.set([tc.r, tc.g, tc.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
  const [nc, ng] = makeCanvas(256, 256); { const id = ng.createImageData(256, 256); const r = rng(9); for (let i = 0; i < 256 * 256; i++) { const v = 215 + r() * 40; id.data.set([v, v, v, 255], i * 4); } ng.putImageData(id, 0, 0); }
  const groundTex = toTexture(nc, { repeat: [70, 70] });
  const groundMat = patch(new THREE.MeshStandardMaterial({ map: groundTex, vertexColors: true, roughness: 0.96 }), U, { key: 'ground' });
  const ground = new THREE.Mesh(geo, groundMat); ground.receiveShadow = true; scene.add(ground);

  // ---------------- Water ----------------
  const HT = 256, hdata = new Uint8Array(HT * HT * 4);
  for (let j = 0; j < HT; j++) for (let i = 0; i < HT; i++) {
    const x = -HALF + (i + 0.5) / HT * SIZE, z = -HALF + (j + 0.5) / HT * SIZE;
    const v = clamp((WL - coveHeight(x, z) + 1) / 9, 0, 1) * 255; hdata.set([v, v, v, 255], (j * HT + i) * 4);
  }
  const heightTex = new THREE.DataTexture(hdata, HT, HT); heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
  const waterU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
  Object.assign(waterU, { uTime: U.uTime, uWL: U.uWL, uHeight: { value: heightTex }, uRect: { value: new THREE.Vector4(-HALF, -HALF, SIZE, SIZE) },
    uSunDir: { value: cur.sunDir }, uSunCol: { value: cur.sunCol }, uSkyH: { value: cur.hor }, uSkyZ: { value: cur.zen }, uShallow: { value: cur.shallow }, uDeep: { value: cur.deep }, uSunI: { value: 1 } });
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterU, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    vertexShader: `#include <fog_pars_vertex>
      uniform float uTime; varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += sin(w.x * 0.35 + uTime * 1.1) * 0.045 + sin(w.z * 0.27 - uTime * 0.9) * 0.045 + sin((w.x + w.z) * 0.6 + uTime * 1.7) * 0.02;
        vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform float uTime, uWL, uSunI; uniform sampler2D uHeight; uniform vec4 uRect; uniform vec3 uSunDir, uSunCol, uSkyH, uSkyZ, uShallow, uDeep; varying vec3 vW;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float rip(vec2 p) { return vn(p * 1.5 + vec2(uTime * 0.35, uTime * 0.2)) * 0.5 + vn(p * 3.2 - vec2(uTime * 0.25, -uTime * 0.4)) * 0.33 + vn(p * 7.0 + uTime * 0.6) * 0.17; }
      void main() {
        vec2 uv = (vW.xz - uRect.xy) / uRect.zw;
        float depth = texture2D(uHeight, uv).r * 9.0 - 1.0;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) depth = 8.0;
        float e = 0.12, r0 = rip(vW.xz), rx = rip(vW.xz + vec2(e, 0.0)), rz = rip(vW.xz + vec2(0.0, e));
        vec3 N = normalize(vec3((r0 - rx) * 1.4, 1.0, (r0 - rz) * 1.4));
        vec3 V = normalize(cameraPosition - vW);
        vec3 col; float alpha;
        if (gl_FrontFacing) {
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          vec3 water = mix(uShallow, uDeep, smoothstep(0.3, 6.5, depth));
          water = mix(water, uShallow * 1.15, (1.0 - smoothstep(0.0, 1.2, depth)) * 0.5);
          col = mix(water, mix(uSkyH, uSkyZ, 0.35), clamp(fres * 0.85 + 0.06, 0.0, 1.0));
          vec3 Rf = reflect(-V, N); float sd = max(dot(Rf, normalize(uSunDir)), 0.0);
          col += uSunCol * (pow(sd, 260.0) * 3.0 + pow(sd, 22.0) * 0.22) * uSunI;
          float foamEdge = 0.28 + 0.1 * sin(uTime * 1.3 + vW.x * 0.7 + vW.z * 0.4);
          float foam = (1.0 - smoothstep(0.0, foamEdge, depth)) * (0.55 + 0.45 * vn(vW.xz * 3.0 + uTime * 0.8));
          foam += (1.0 - smoothstep(0.0, 0.08, abs(depth - 0.45 - 0.12 * sin(uTime * 0.9 + vW.x * 0.3)))) * 0.35 * vn(vW.xz * 4.0 - uTime);
          col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
          alpha = mix(0.45, 0.95, smoothstep(0.0, 5.0, depth));
          alpha = max(alpha, fres * 0.85); alpha = max(alpha, clamp(foam, 0.0, 1.0) * 0.9);
        } else {   // looking up from under the water
          float sh = pow(r0, 3.0);
          col = mix(uDeep * 1.4, uShallow, 0.35) + uSunCol * sh * 0.5 * uSunI;
          alpha = 0.8;
        }
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const waterGeo = new THREE.PlaneGeometry(420, 420, 168, 168); waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, waterMat); water.position.y = WL; water.renderOrder = 2; scene.add(water);

  // ---------------- Shared plant materials ----------------
  const plantMat = (key, wind, extra = {}) => patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, ...extra }), U, { wind, push: extra.push || 0, windSpeed: extra.windSpeed || 1.6, key });
  const grassMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }), U, { wind: 0.07, push: 0.22, key: 'grass' });
  const solidMat = (key) => patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), U, { key });
  const flatMat = (key) => patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), U, { key });

  const inst = (geom, mat, list, { shadow = true, receive = true } = {}) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geom, mat, list.length);
    list.forEach((it, i) => { dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); dummy.scale.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, it.c || C('#FFFFFF')); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = shadow; m.receiveShadow = receive; m.computeBoundingSphere(); scene.add(m); return m;
  };

  // ---------------- Landmarks placed by hand first (so plants keep clear of them) ----------------
  occupy(SPAWN.x, SPAWN.z, 2.5); occupy(CAMPFIRE.x, CAMPFIRE.z, 4.2); occupy(LOOKOUT.x, LOOKOUT.z, 2.2); occupy(POOL.x, POOL.z, 4.5); occupy(-30, 2, 3); occupy(-0.5, 5.8, 1.3);
  for (let z = PIER.z0; z < PIER.z1; z += 2) occupy(PIER.x, z, 1.6);
  occupy(11.5, 5.4, 2.6);   // hammock

  // ---------------- Rocks and boulders ----------------
  const rockGeo = (seed, moss) => {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = vnoise(v.x * 1.7 + seed, v.z * 1.7 + v.y * 1.3) * 0.5 + vnoise(v.x * 4 + seed, v.y * 4) * 0.18; v.multiplyScalar(0.78 + n * 0.5); if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.3; v.y *= 0.72; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    return prep(g, (pv, nn, c) => { c.set('#9A948A').lerp(C('#76716A'), vnoise(pv.x * 3 + seed, pv.z * 3)); if (moss && nn.y > 0.55) c.lerp(C('#6E8F3E'), sstep(0.55, 0.85, nn.y) * 0.85); else if (nn.y > 0.7) c.lerp(C('#B3AC9E'), 0.3); });
  };
  const rockGeos = [rockGeo(1, false), rockGeo(7, false), rockGeo(3, true), rockGeo(11, true)];
  const rockLists = [[], [], [], []];
  const addRock = (x, z, s, { moss = false, climb = true, sink = 0.25 } = {}) => {
    const y = coveHeight(x, z) - s * sink, v = (moss ? 2 : 0) + (R() < 0.5 ? 0 : 1);
    const sx = s * (0.9 + R() * 0.4), sz = s * (0.9 + R() * 0.4), sy = s * (0.8 + R() * 0.5);
    rockLists[v].push({ x, y, z, ry: R() * 6.28, sx, sy, sz, c: C('#FFFFFF').lerp(C(moss ? '#D8E0C8' : '#F2E6D8'), R() * 0.5) });
    const r = Math.min(sx, sz) * 0.8, top = y + sy * 0.72 * 0.95;
    circles.push({ x, z, r, top: climb && sy < 1.6 ? top : undefined, camH: top, y0: y - 1 });
    occupy(x, z, r + 0.3);
  };
  // Beach and lagoon rocks (some half in the water), headland boulders, meadow and grove boulders.
  for (const [x, z, s] of [[-9, 9.5, 1.3], [-7.6, 10.8, 0.7], [9, 13.5, 1.0], [30, 12, 1.6], [32, 14.5, 1.1], [-19, 7.5, 1.4], [-21, 9.5, 2.0], [-23.5, 12, 1.6], [-21.5, 26, 1.8], [-26, 31, 2.2], [24, 2.6, 0.8], [-2, 6.5, 0.6]]) addRock(x, z, s);
  for (const [x, z, s] of [[-23.4, 0.2, 1.3], [-24.2, 4.6, 1.4], [-22, -0.8, 0.9], [-21.2, 5.4, 1.0], [-18.8, 1.4, 0.8], [-19.5, 6.6, 0.9]]) addRock(x, z, s, { moss: true });   // around the waterfall
  for (let i = 0; i < 90 && rockLists.flat().length < 70; i++) {
    const x = -42 + R() * 84, z = -46 + R() * 50; const h = coveHeight(x, z); if (h < 1 || pathDist(x, z) < 2.2) continue;
    const gm = groveMask(x, z), pm = plateauMask(x, z); if (gm < 0.35 && pm < 0.5 && R() < 0.6) continue;
    const s = 0.45 + R() * (R() < 0.25 ? 1.6 : 0.7); if (!free(x, z, s + 0.5)) continue;
    addRock(x, z, s, { moss: gm > 0.35 });
  }
  rockLists.forEach((l, i) => inst(rockGeos[i], flatMat('rock'), l));

  // ---------------- Pine trees ----------------
  const pineFoliage = (seed) => {
    const parts = []; const r = rng(seed);
    for (let k = 0; k < 5; k++) {
      const rad = 1.55 - k * 0.27, hgt = 1.55 - k * 0.08, yc = 2.1 + k * 0.85;
      const g = new THREE.ConeGeometry(rad, hgt, 10, 2), p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y < hgt / 2 - 0.01) { const a = Math.atan2(v.z, v.x), j = 1 + (vnoise(a * 3 + seed + k, k) - 0.5) * 0.35; v.x *= j; v.z *= j; if (v.y < -hgt / 2 + 0.01) v.y -= 0.18 * (0.6 + r() * 0.8); } v.y += yc; p.setXYZ(i, v.x, v.y, v.z); }
      parts.push(prep(g, (pv, nn, c) => { const t = clamp((pv.y - 1.3) / 5, 0, 1); c.set('#1F4A2C').lerp(C('#3E7A3C'), 0.25 + t * 0.4 + Math.max(0, nn.y) * 0.25); }, (pv) => clamp((pv.y - 1.4) / 5, 0, 1) ** 2));
    }
    return merge(parts);
  };
  const trunkGeo = prep(new THREE.CylinderGeometry(0.13, 0.24, 2.8, 7).translate(0, 1.4, 0), (pv, nn, c) => c.set('#5B3D24').lerp(C('#3E2A18'), vnoise(pv.y * 4, Math.atan2(pv.z, pv.x) * 2)));
  const pineGeos = [pineFoliage(3), pineFoliage(8)], pineLists = [[], []], trunkList = [];
  const addPine = (x, z, s) => {
    const y = coveHeight(x, z) - 0.1;
    trunkList.push({ x, y, z, ry: R() * 6.28, s, c: C('#FFFFFF') });
    pineLists[R() < 0.5 ? 0 : 1].push({ x, y, z, ry: R() * 6.28, s, sy: s * (0.9 + R() * 0.25), c: C('#FFFFFF').lerp(C('#C8E0A8'), R() * 0.5) });
    circles.push({ x, z, r: 0.28 * s, camH: y + 6.5 * s, y0: y - 1 }); occupy(x, z, 1.1 * s);
  };
  for (let i = 0; i < 1400 && trunkList.length < (hi ? 110 : 70); i++) {
    const x = -46 + R() * 92, z = -60 + R() * 58, h = coveHeight(x, z);
    if (h < 1.2 || pathDist(x, z) < 2.4) continue;
    const gm = groveMask(x, z), pm = plateauMask(x, z);
    if (!(gm > 0.42 || (pm > 0.7 && z < -12 && R() < 0.5) || (z < -38))) continue;
    if (slopeAt(x, z) < 0.7) continue;
    const s = 0.75 + R() * 0.75; if (!free(x, z, 1.3 * s)) continue;
    addPine(x, z, s);
  }
  inst(trunkGeo, solidMat('trunk'), trunkList);
  pineGeos.forEach((g, i) => inst(g, plantMat('pine', 0.06, { windSpeed: 1.1 }), pineLists[i]));

  // ---------------- Palm trees ----------------
  const palmMat = plantMat('palm', 0.16, { windSpeed: 1.3 });
  const addPalm = (x, z, s, lean) => {
    const y = coveHeight(x, z) - 0.1, H = 4.6 * s, la = R() * 6.28;
    const top = new THREE.Vector3(Math.cos(lean) * H * 0.33, H, Math.sin(lean) * H * 0.33);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(top.x * 0.1, H * 0.55, top.z * 0.1), top);
    const parts = [prep(new THREE.TubeGeometry(curve, 14, 0.15 * s, 7), (pv, nn, c) => { const band = Math.floor(pv.y / (0.32 * s)) % 2; c.set(band ? '#8B6B44' : '#A07D50').lerp(C('#6E5233'), 0.2); }, (pv) => (pv.y / H) ** 2 * 0.25)];
    for (let f = 0; f < 9; f++) {   // fronds: a curved spine with leaflets on both sides
      const a = la + f / 9 * Math.PI * 2 + R() * 0.3, L = (2.4 + R() * 0.6) * s, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-dir.z, 0, dir.x);
      const spine = (t) => top.clone().addScaledVector(dir, t * L).add(new THREE.Vector3(0, 0.45 * s * t - 1.35 * s * t * t, 0));
      const pos = [];
      for (let k = 0; k < 10; k++) {
        const t0 = k / 10, t1 = (k + 1) / 10, p0 = spine(t0), p1 = spine(t1), w = (0.55 * Math.sin(Math.PI * Math.min(1, t0 * 1.1 + 0.08))) * s;
        for (const sd of [-1, 1]) { const tip = p0.clone().lerp(p1, 0.5).addScaledVector(side, sd * w).add(new THREE.Vector3(0, -0.22 * s, 0)); pos.push(...p0.toArray(), ...p1.toArray(), ...tip.toArray()); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      parts.push(prep(g, (pv, nn, c) => c.set('#3E8E3A').lerp(C('#7FB848'), clamp(pv.distanceTo(top) / L, 0, 1) * 0.6), (pv) => 0.25 + clamp(pv.distanceTo(top) / L, 0, 1)));
    }
    for (let k = 0; k < 3; k++) { const a = la + k * 2.1; parts.push(prep(new THREE.SphereGeometry(0.13 * s, 8, 6).translate(top.x + Math.cos(a) * 0.18 * s, top.y - 0.18 * s, top.z + Math.sin(a) * 0.18 * s), (pv, nn, c) => c.set('#6B4A26'), () => 0.2)); }
    const mesh = new THREE.Mesh(merge(parts), palmMat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    circles.push({ x, z, r: 0.22 * s, camH: y + H * 0.6, y0: y - 1 }); occupy(x, z, 1.2);
  };
  for (const [x, z, s, lean] of [[-3, 6.2, 1.05, 2.0], [9.5, 6.4, 1.1, 1.7], [13.6, 5.2, 1.0, 1.4], [27, 7.5, 1.15, 1.2], [-12, 6.4, 0.95, 1.9], [19, 4.8, 0.9, 1.6], [-27, 22, 1.1, 1.4], [-33, 24, 1.0, 1.8], [-28.5, 9, 0.95, 0.6], [33, 9, 1.0, 1.0], [-6.5, 3.5, 0.85, 2.4], [2, 5.6, 0.8, 1.1]]) addPalm(x, z, s, lean);

  // ---------------- Fallen logs and stumps (good for hiding behind) ----------------
  const logMat = flatMat('log');
  const addLog = (x, z, len, rad, ang) => {
    const g = new THREE.CylinderGeometry(rad, rad * 0.92, len, 12, 3); g.rotateZ(Math.PI / 2);
    const lg = prep(g, (pv, nn, c) => {
      if (Math.abs(nn.x) > 0.9) { const rr = Math.hypot(pv.y, pv.z) / rad; c.set('#D4AE76').lerp(C('#9C7448'), (Math.sin(rr * 18) * 0.5 + 0.5) * 0.5 + rr * 0.3); return; }   // end rings
      c.set('#6A4A2E').lerp(C('#4A3320'), vnoise(pv.x * 3, Math.atan2(pv.z, pv.y) * 3));
      if (nn.y > 0.45) c.lerp(C('#5E8A36'), sstep(0.45, 0.9, nn.y) * (0.5 + 0.5 * vnoise(pv.x * 2, 1)));
    });
    const y = Math.min(coveHeight(x, z), coveHeight(x + Math.cos(ang) * len / 2, z - Math.sin(ang) * len / 2), coveHeight(x - Math.cos(ang) * len / 2, z + Math.sin(ang) * len / 2)) + rad * 0.82;
    const m = new THREE.Mesh(lg, logMat); m.position.set(x, y, z); m.rotation.y = ang; m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const n = Math.ceil(len / (rad * 1.2));
    for (let i = 0; i <= n; i++) { const t = (i / n - 0.5) * (len - rad), cx = x + Math.cos(ang) * t, cz = z - Math.sin(ang) * t; circles.push({ x: cx, z: cz, r: rad * 0.95, top: y + rad * 0.95, camH: y + rad, y0: y - rad - 1 }); }
    occupy(x, z, len / 2 + 0.4);
  };
  addLog(10.5, -14.5, 4.6, 0.48, 0.35); addLog(24, -15, 5.2, 0.55, -0.4); addLog(15.5, -26.5, 4.2, 0.5, 1.2); addLog(28.5, -27, 4.8, 0.52, 0.7);
  addLog(-3, -21, 3.8, 0.42, 1.0); addLog(5, -30, 4.4, 0.5, -0.2); addLog(33, -20, 3.6, 0.45, 1.6); addLog(-10, -6.5, 3.2, 0.38, 0.2);
  // Seats around the campfire.
  addLog(CAMPFIRE.x - 2.9, CAMPFIRE.z + 0.4, 2.6, 0.32, 1.35); addLog(CAMPFIRE.x + 2.8, CAMPFIRE.z - 0.6, 2.6, 0.32, 1.75); addLog(CAMPFIRE.x + 0.2, CAMPFIRE.z + 2.9, 2.4, 0.3, 0.1);
  const stumpList = [];
  for (const [x, z, s] of [[20.5, -12, 1], [12, -24, 0.8], [30, -16, 1.1], [-6, -28, 0.9], [8, -21, 0.7]]) {
    const y = coveHeight(x, z) - 0.05; stumpList.push({ x, y, z, s, ry: R() * 6.28 }); circles.push({ x, z, r: 0.42 * s, top: y + 0.55 * s, camH: y + 0.55 * s, y0: y - 1 }); occupy(x, z, 0.8);
  }
  inst(prep(new THREE.CylinderGeometry(0.38, 0.48, 0.55, 10).translate(0, 0.275, 0), (pv, nn, c) => { if (nn.y > 0.9) { const rr = Math.hypot(pv.x, pv.z) / 0.38; c.set('#D4AE76').lerp(C('#9C7448'), (Math.sin(rr * 16) * 0.5 + 0.5) * 0.5); } else c.set('#5E4029').lerp(C('#3E2A18'), vnoise(pv.y * 6, Math.atan2(pv.z, pv.x) * 3)); }), flatMat('stump'), stumpList);

  // ---------------- Short grass (thousands of tiny blades, bent by wind and by your feet) ----------------
  const blade = (() => {
    const g = new THREE.PlaneGeometry(0.07, 1, 1, 3).translate(0, 0.5, 0), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * 0.85)); p.setZ(i, y * y * 0.12); }
    const out = prep(g, (pv, nn, c) => c.set('#3F7A2E').lerp(C('#A8D468'), pv.y), (pv) => pv.y);
    const n = out.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);   // soft lighting like a lawn
    return out;
  })();
  const CH = 12, grassChunks = new Map(), seaChunks = new Map();
  const density = hi ? 7 : 3.2;
  const gTint = [C('#FFFFFF'), C('#E9F2C8'), C('#D2E8B0'), C('#F6EBC0')];
  for (let cz = -54; cz < 12; cz += CH) for (let cx = -48; cx < 48; cx += CH) {
    const n = Math.floor(CH * CH * density);
    for (let i = 0; i < n; i++) {
      const x = cx + R() * CH, z = cz + R() * CH, h = coveHeight(x, z);
      if (h < 0.9) continue;
      const d = shoreZ(x) - z; if (d < 5.2 + vnoise(x * 0.3, z * 0.3) * 1.5) continue;           // no grass on the sand
      const pd = pathDist(x, z); if (pd < 0.75 || (pd < 1.3 && R() < 0.6)) continue;
      if (Math.hypot(x - CAMPFIRE.x, z - CAMPFIRE.z) < 3.4) continue;
      const sl = slopeAt(x, z); if (sl < 0.8) continue;
      const gm = groveMask(x, z), pm = plateauMask(x, z);
      if (gm > 0.5 && R() < 0.55) continue; if (pm > 0.5 && R() < 0.35) continue;
      if (occupied.some(o => o.r < 1.5 && Math.hypot(o.x - x, o.z - z) < o.r * 0.6)) continue;
      const key = `${cx},${cz}`; if (!grassChunks.has(key)) grassChunks.set(key, []);
      const tall = 0.17 + R() * 0.17 + (pd > 2.5 ? 0.06 : 0) - (gm > 0.5 ? 0.04 : 0);
      grassChunks.get(key).push({ x, y: h - 0.02, z, ry: R() * 6.28, sx: 0.8 + R() * 0.6, sy: tall, sz: 1, c: gTint[Math.floor(R() * 4)].clone().lerp(C(gm > 0.5 ? '#BFD8A0' : '#FFFFFF'), 0.5) });
    }
  }
  for (const list of grassChunks.values()) inst(blade, grassMat, list, { shadow: false });

  // ---------------- Wildflowers in patches ----------------
  const stem = (h) => prep(new THREE.CylinderGeometry(0.008, 0.01, h, 3).translate(0, h / 2, 0), (pv, nn, c) => c.set('#4E8A36'), (pv) => pv.y / h);
  const daisy = (() => { const parts = [stem(0.32)]; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; parts.push(prep(new THREE.PlaneGeometry(0.035, 0.08).rotateX(-Math.PI / 2 + 0.25).translate(0, 0, 0.05).rotateY(a).translate(0, 0.32, 0), (pv, nn, c) => c.set('#FFFFFF'), () => 1)); } parts.push(prep(new THREE.SphereGeometry(0.025, 6, 4).translate(0, 0.33, 0), (pv, nn, c) => c.set('#F2B624'), () => 1)); return merge(parts); })();
  const buttercup = (() => { const parts = [stem(0.24)]; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; parts.push(prep(new THREE.CircleGeometry(0.03, 5).rotateX(-Math.PI / 2 + 0.6).translate(0, 0, 0.03).rotateY(a).translate(0, 0.24, 0), (pv, nn, c) => c.set('#FFD23A'), () => 1)); } return merge(parts); })();
  const poppy = (() => { const parts = [stem(0.38)]; parts.push(prep(new THREE.SphereGeometry(0.06, 8, 5, 0, Math.PI * 2, 0, 1.4).rotateX(Math.PI).translate(0, 0.42, 0), (pv, nn, c) => c.set('#E2382C').lerp(C('#FF6A3D'), sstep(0.36, 0.42, pv.y)), () => 1)); parts.push(prep(new THREE.SphereGeometry(0.018, 6, 4).translate(0, 0.39, 0), (pv, nn, c) => c.set('#2A1A14'), () => 1)); return merge(parts); })();
  const lupine = (() => { const parts = [stem(0.3)]; for (let k = 0; k < 14; k++) { const y = 0.3 + k * 0.03, a = k * 2.4, r = 0.04 * (1 - k / 16); parts.push(prep(new THREE.SphereGeometry(0.018, 5, 4).translate(Math.cos(a) * r, y, Math.sin(a) * r), (pv, nn, c) => c.set('#6A4FC8').lerp(C('#B49CF0'), k / 14), () => 1)); } return merge(parts); })();
  const flowerLists = { daisy: [], buttercup: [], poppy: [], lupine: [] };
  const flowerMat = plantMat('flower', 0.05, { push: 0.15 });
  for (let i = 0; i < (hi ? 9000 : 4000); i++) {
    const x = -40 + R() * 70, z = -40 + R() * 46, h = coveHeight(x, z);
    if (h < 1 || shoreZ(x) - z < 7 || pathDist(x, z) < 1.1 || groveMask(x, z) > 0.4 || plateauMask(x, z) > 0.3 || slopeAt(x, z) < 0.8) continue;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 2) continue;
    const pat = vnoise(x * 0.12, z * 0.12), kindN = vnoise(x * 0.07 + 30, z * 0.07);
    if (pat < 0.55 && R() < 0.92) continue;
    const kind = kindN < 0.3 ? 'lupine' : kindN < 0.5 ? 'poppy' : kindN < 0.72 ? 'daisy' : 'buttercup';
    if (!free(x, z, 0.1)) continue;
    flowerLists[kind].push({ x, y: h - 0.02, z, ry: R() * 6.28, s: 0.8 + R() * 0.6 });
  }
  for (const [k, g] of Object.entries({ daisy, buttercup, poppy, lupine })) inst(g, flowerMat, flowerLists[k], { shadow: false });

  // ---------------- Ferns, bushes and mushrooms in the grove ----------------
  const fern = (() => {
    const parts = [];
    for (let f = 0; f < 7; f++) {
      const a = f / 7 * Math.PI * 2, L = 0.75, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-dir.z, 0, dir.x), pos = [];
      const sp = (t) => dir.clone().multiplyScalar(t * L).add(new THREE.Vector3(0, 0.5 * t - 0.45 * t * t, 0));
      for (let k = 0; k < 8; k++) { const p0 = sp(k / 8), p1 = sp((k + 1) / 8), w = 0.13 * Math.sin(Math.PI * Math.min(1, k / 8 + 0.1)); for (const s of [-1, 1]) { const tip = p0.clone().lerp(p1, 0.5).addScaledVector(side, s * w).add(new THREE.Vector3(0, -0.04, 0)); pos.push(...p0.toArray(), ...p1.toArray(), ...tip.toArray()); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      parts.push(prep(g, (pv, nn, c) => c.set('#2F6B2C').lerp(C('#6AA848'), Math.hypot(pv.x, pv.z) / L), (pv) => Math.hypot(pv.x, pv.z) / L));
    }
    return merge(parts);
  })();
  const bush = (() => { const parts = []; const r = rng(4); for (let k = 0; k < 6; k++) { const g = new THREE.IcosahedronGeometry(0.45 + r() * 0.2, 1).translate((r() - 0.5) * 0.7, 0.35 + r() * 0.25, (r() - 0.5) * 0.7); parts.push(prep(g, (pv, nn, c) => c.set('#2F6A30').lerp(C('#5E9A42'), Math.max(0, nn.y) * 0.6 + r() * 0.2), (pv) => pv.y * 0.3)); } return merge(parts); })();
  const mushroom = merge([prep(new THREE.CylinderGeometry(0.025, 0.03, 0.09, 6).translate(0, 0.045, 0), (pv, nn, c) => c.set('#F2E8D8')), prep(new THREE.SphereGeometry(0.06, 8, 5, 0, Math.PI * 2, 0, 1.5).scale(1, 0.7, 1).translate(0, 0.09, 0), (pv, nn, c) => c.set('#D93A2C').lerp(C('#FFFFFF'), hash2(pv.x * 50, pv.z * 50) > 0.8 ? 0.9 : 0))]);
  const fernList = [], bushList = [], mushList = [];
  for (let i = 0; i < 2500 && fernList.length < (hi ? 420 : 200); i++) {
    const x = -46 + R() * 92, z = -56 + R() * 50, h = coveHeight(x, z);
    if (h < 1.2 || pathDist(x, z) < 1.2 || groveMask(x, z) < 0.45 || slopeAt(x, z) < 0.75 || Math.hypot(x - CAMPFIRE.x, z - CAMPFIRE.z) < 4) continue;
    if (!free(x, z, 0.4)) continue; fernList.push({ x, y: h - 0.03, z, ry: R() * 6.28, s: 0.7 + R() * 0.8, c: C('#FFFFFF').lerp(C('#DDEEBB'), R()) });
  }
  for (let i = 0; i < 600 && bushList.length < 46; i++) {
    const x = -44 + R() * 88, z = -50 + R() * 54, h = coveHeight(x, z), d = shoreZ(x) - z;
    if (h < 1 || pathDist(x, z) < 1.8 || slopeAt(x, z) < 0.8) continue;
    const gm = groveMask(x, z); if (!((gm > 0.25 && gm < 0.6) || (d > 6 && d < 9) || plateauMask(x, z) > 0.8)) continue;
    const s = 0.8 + R() * 0.7; if (!free(x, z, 0.9 * s)) continue;
    bushList.push({ x, y: h - 0.05, z, ry: R() * 6.28, s, c: C('#FFFFFF').lerp(C('#D8F0B8'), R()) }); circles.push({ x, z, r: 0.55 * s, camH: h + 0.7 * s, y0: h - 1 }); occupy(x, z, 0.8 * s);
  }
  for (const o of circles.filter(c => c.top && c.r < 0.7 && groveMask(c.x, c.z) > 0.3 && R() < 0.3)) for (let k = 0; k < 2; k++) { const a = R() * 6.28, rr = o.r + 0.15 + R() * 0.3, x = o.x + Math.cos(a) * rr, z = o.z + Math.sin(a) * rr; mushList.push({ x, y: coveHeight(x, z) - 0.01, z, s: 0.7 + R() * 0.8, ry: R() * 6 }); }
  inst(fern, plantMat('fern', 0.05, { windSpeed: 1.2, push: 0.2 }), fernList, { shadow: false });
  inst(bush, plantMat('bush', 0.04), bushList);
  inst(mushroom, solidMat('mush'), mushList, { shadow: false });

  // ---------------- The coral reef ----------------
  const reefSpot = (cx, cz, rr) => { const a = R() * 6.28, d = Math.sqrt(R()) * rr; const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; return { x, z, y: coveHeight(x, z) }; };
  const brain = prep((() => { const g = new THREE.IcosahedronGeometry(0.5, 4), p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); const rid = Math.abs(Math.sin(n.x * 22 + Math.sin(n.y * 9) * 2) * Math.sin(n.z * 20 + Math.sin(n.x * 8) * 2)); v.multiplyScalar(1 + rid * 0.06); if (v.y < 0) v.y *= 0.3; p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; })(),
    (pv, nn, c) => c.set('#E0C08C').lerp(C('#B88E5A'), sstep(0.3, 0.8, Math.abs(Math.sin(pv.x * 40 + Math.sin(pv.y * 18) * 2)))));
  const branchCoral = (seed) => { const parts = [], r = rng(seed);
    const grow = (base, dir, len, rad, depth) => { const end = base.clone().addScaledVector(dir, len); const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5).translate(0, len / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.applyQuaternion(q); g.translate(base.x, base.y, base.z);
      parts.push(prep(g, (pv, nn, c) => c.set('#FFFFFF').lerp(C('#FFE0D0'), clamp(pv.y / 1.2, 0, 1)), (pv) => clamp(pv.y / 1.2, 0, 1) * 0.6));
      if (depth < 3) for (let k = 0; k < 2 + (r() < 0.4 ? 1 : 0); k++) { const nd = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.3, 0.25, (r() - 0.5) * 1.3)).normalize(); grow(end, nd, len * 0.72, rad * 0.7, depth + 1); } };
    for (let k = 0; k < 3; k++) grow(new THREE.Vector3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3), new THREE.Vector3((r() - 0.5) * 0.6, 1, (r() - 0.5) * 0.6).normalize(), 0.42, 0.06, 0);
    return merge(parts); };
  const fanTex = (() => { const [c, g] = makeCanvas(128, 128); g.strokeStyle = '#FFFFFF'; g.lineCap = 'round'; const r = rng(12);
    const br = (x, y, a, l, w, d) => { const x2 = x + Math.cos(a) * l, y2 = y - Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); if (d < 6) { br(x2, y2, a + 0.25 + r() * 0.2, l * 0.78, w * 0.75, d + 1); br(x2, y2, a - 0.25 - r() * 0.2, l * 0.78, w * 0.75, d + 1); } };
    br(64, 126, Math.PI / 2, 30, 5, 0); for (let i = 0; i < 40; i++) { g.lineWidth = 1; g.beginPath(); const y = 20 + i * 2.6; g.moveTo(64 - (126 - y) * 0.6, y); g.lineTo(64 + (126 - y) * 0.6, y); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1; } return toTexture(c, { wrap: false }); })();
  const fanGeo = (() => { const g = new THREE.PlaneGeometry(1, 1, 2, 2).translate(0, 0.5, 0); const p = g.attributes.position; const sw = new Float32Array(p.count), col = new Float32Array(p.count * 3).fill(1); for (let i = 0; i < p.count; i++) sw[i] = p.getY(i) * 0.7; g.setAttribute('sway', new THREE.BufferAttribute(sw, 1)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; })();
  const fanMat = patch(new THREE.MeshStandardMaterial({ map: fanTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, vertexColors: true }), U, { wind: 0.12, windSpeed: 0.7, key: 'fan' });
  const tube = merge([0, 1, 2, 3].map(k => prep(new THREE.CylinderGeometry(0.08, 0.06, 0.45 + k * 0.12, 8, 1, true).translate((k % 2 - 0.5) * 0.17, (0.45 + k * 0.12) / 2, (Math.floor(k / 2) - 0.5) * 0.17), (pv, nn, c) => c.set('#FFFFFF').lerp(C('#E0D0FF'), pv.y), (pv) => pv.y * 0.3)));
  const star = (() => { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 0.05 : 0.13; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return prep(new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false }).rotateX(-Math.PI / 2), (pv, nn, c) => c.set('#F28A3A')); })();
  const seaBlade = (() => { const g = new THREE.PlaneGeometry(0.06, 1, 1, 4).translate(0, 0.5, 0), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - p.getY(i) * 0.6)); return prep(g, (pv, nn, c) => c.set('#2E6E3A').lerp(C('#7DBF5A'), pv.y), (pv) => pv.y); })();
  const lists = { brain: [], b1: [], b2: [], fan: [], tube: [], star: [], sea: [] };
  const coralCols = ['#FF6A2A', '#FF8A4A', '#F03A70', '#FFC23A', '#9A5FF0', '#3ED2D8'].map(C);
  for (const [cx, cz, rr] of REEF) {
    const nb = Math.round(rr * 1.6); for (let i = 0; i < nb; i++) { const s = reefSpot(cx, cz, rr * 0.8); lists.brain.push({ ...s, y: s.y - 0.08, s: 0.7 + R() * 1.1, ry: R() * 6, c: C('#FFFFFF').lerp(C(R() < 0.4 ? '#FFC6B8' : '#E0F0B0'), R() * 0.6) }); }
    for (let i = 0; i < rr * 5; i++) { const s = reefSpot(cx, cz, rr); (R() < 0.5 ? lists.b1 : lists.b2).push({ ...s, y: s.y - 0.05, s: 0.7 + R() * 0.9, ry: R() * 6, c: coralCols[Math.floor(R() * 4)] }); }
    for (let i = 0; i < rr * 1.6; i++) { const s = reefSpot(cx, cz, rr); lists.fan.push({ ...s, y: s.y - 0.05, s: 0.8 + R() * 0.9, ry: R() * 6, c: R() < 0.6 ? C('#9A5FD8') : C('#E85A8A') }); }
    for (let i = 0; i < rr; i++) { const s = reefSpot(cx, cz, rr); lists.tube.push({ ...s, y: s.y - 0.05, s: 0.8 + R() * 0.7, ry: R() * 6, c: R() < 0.5 ? C('#8A5ACF') : C('#F2A23A') }); }
    for (let i = 0; i < 3; i++) { const s = reefSpot(cx, cz, rr * 1.3); lists.star.push({ ...s, y: s.y + 0.01, s: 0.8 + R() * 0.6, ry: R() * 6, c: R() < 0.5 ? C('#F28A3A') : C('#E8507A') }); }
  }
  for (let i = 0; i < (hi ? 2600 : 1200); i++) {   // seagrass meadows on the sandy lagoon floor
    const x = -30 + R() * 60, z = 8 + R() * 36, h = coveHeight(x, z); if (h > -0.9 || h < -4) continue;
    if (vnoise(x * 0.15, z * 0.15) < 0.55) continue;
    lists.sea.push({ x, y: h - 0.02, z, ry: R() * 6, sx: 1, sy: 0.35 + R() * 0.55, sz: 1, c: C('#FFFFFF').lerp(C('#C8E8A0'), R()) });
  }
  const reefMat = solidMat('reef'), coralWind = plantMat('coral', 0.05, { windSpeed: 0.8 });
  inst(brain, reefMat, lists.brain); inst(branchCoral(2), coralWind, lists.b1); inst(branchCoral(5), coralWind, lists.b2);
  inst(fanGeo, fanMat, lists.fan, { shadow: false }); inst(tube, coralWind, lists.tube); inst(star, reefMat, lists.star, { shadow: false });
  inst(seaBlade, plantMat('seagrass', 0.14, { windSpeed: 0.9 }), lists.sea, { shadow: false });

  // Fish schools (they swim in loops and scatter when you come close).
  const fishGeo = merge([prep(new THREE.SphereGeometry(1, 8, 6).scale(0.045, 0.06, 0.15), (pv, nn, c) => c.set('#FFFFFF').lerp(C('#BBBBBB'), sstep(0, -0.05, pv.y) * 0.5)),
    prep(new THREE.ConeGeometry(0.06, 0.1, 4).rotateX(-Math.PI / 2).scale(0.4, 1, 1).translate(0, 0, -0.18), (pv, nn, c) => c.set('#DDDDDD'))]);
  const schools = [{ c: [2, 21], r: 3.5, y: -1.1, n: 34, col: '#FFD23A', sp: 0.35 }, { c: [-6, 25], r: 4.5, y: -1.5, n: 44, col: '#3A6AE8', sp: -0.28 }, { c: [14, 19], r: 2.6, y: -1.2, n: 14, col: '#FF8A3A', sp: 0.5 }, { c: [20, 28], r: 3.4, y: -1.6, n: 22, col: '#5EE0D0', sp: -0.4 }];
  const fishData = []; schools.forEach((s, si) => { for (let i = 0; i < s.n; i++) fishData.push({ si, a: R() * 6.28, rr: s.r * (0.6 + R() * 0.6), dy: (R() - 0.5) * 0.6, ph: R() * 6.28, sc: 0.55 + R() * 0.4, off: new THREE.Vector3() }); });
  const fish = new THREE.InstancedMesh(fishGeo, solidMat('fish'), fishData.length); fishData.forEach((f, i) => fish.setColorAt(i, C(schools[f.si].col).lerp(C('#FFFFFF'), R() * 0.25))); fish.instanceColor.needsUpdate = true; fish.frustumCulled = false; scene.add(fish);
  // A friendly sea turtle.
  const turtle = new THREE.Group(); {
    const shellMat = new THREE.MeshStandardMaterial({ color: '#6B7A3A', roughness: 0.7, flatShading: true }), skin = new THREE.MeshStandardMaterial({ color: '#A8B87A', roughness: 0.8 });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), shellMat); shell.scale.set(1, 0.38, 1.25); turtle.add(shell);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), new THREE.MeshStandardMaterial({ color: '#E2D7A0' })); belly.scale.set(0.95, 0.2, 1.2); belly.position.y = -0.06; turtle.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin); head.scale.set(1, 0.85, 1.3); head.position.set(0, 0.02, 0.6); turtle.add(head);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: '#1A1A1A' })); e.position.set(sx * 0.07, 0.06, 0.7); turtle.add(e); }
    turtle.userData.flips = [];
    for (const [sx, z, L] of [[-1, 0.28, 0.5], [1, 0.28, 0.5], [-1, -0.36, 0.25], [1, -0.36, 0.25]]) { const pv = new THREE.Group(); pv.position.set(sx * 0.32, -0.02, z); const fl = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4), skin); fl.scale.set(L, 0.03, L * 0.35); fl.position.x = sx * L * 0.85; pv.add(fl); turtle.add(pv); turtle.userData.flips.push({ pv, sx, front: z > 0 }); }
    turtle.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(turtle);
  }

  // ---------------- Campfire ----------------
  const camp = new THREE.Group(); camp.position.set(CAMPFIRE.x, CAMP_H, CAMPFIRE.z); scene.add(camp);
  const stoneList = []; for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; stoneList.push({ x: CAMPFIRE.x + Math.cos(a) * 0.75, y: CAMP_H + 0.02, z: CAMPFIRE.z + Math.sin(a) * 0.75, s: 0.2 + R() * 0.06, ry: R() * 6, c: C('#E0D8CC') }); }
  inst(rockGeos[0], flatMat('rock'), stoneList);
  for (let k = 0; k < 4; k++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 7), new THREE.MeshStandardMaterial({ color: '#4A3020', roughness: 0.9 })); lg.position.set(0, 0.18, 0); lg.rotation.set(1.1, k * 1.57 + 0.4, 0); lg.position.x = Math.sin(k * 1.57 + 0.4) * 0.15; lg.position.z = Math.cos(k * 1.57 + 0.4) * 0.15; lg.castShadow = true; camp.add(lg); }
  const embersBed = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#FF7A2A' })); embersBed.position.y = 0.04; camp.add(embersBed);
  const flameMat = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uI: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime; varying vec2 vUv; void main() { vUv = uv; vec3 p = position; float t = uv.y; p.x += sin(uTime * 9.0 + t * 6.0) * 0.05 * t; p.z += cos(uTime * 7.0 + t * 5.0) * 0.05 * t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uTime, uI; varying vec2 vUv; void main() { float t = vUv.y; float n = sin(vUv.x * 30.0 + uTime * 6.0) * 0.5 + 0.5; vec3 col = mix(vec3(1.0, 0.85, 0.35), vec3(1.0, 0.32, 0.08), t); float a = (1.0 - t) * (0.55 + 0.45 * n) * uI; gl_FragColor = vec4(col * a * 1.6, a); }` });
  const flames = []; for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.28 - k * 0.06, 0.9 - k * 0.15, 10, 4, true), flameMat); f.position.y = 0.45 - k * 0.07; f.rotation.y = k; camp.add(f); flames.push(f); }
  const glowTex = (() => { const [c, g] = makeCanvas(64, 64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(0.4, 'rgba(255,140,60,0.35)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return toTexture(c, { wrap: false }); })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(4, 4, 1); glow.position.y = 0.6; camp.add(glow);
  const fireLight = new THREE.PointLight('#FF9A4A', 0, 16, 1.6); fireLight.position.y = 1.0; camp.add(fireLight);
  circles.push({ x: CAMPFIRE.x, z: CAMPFIRE.z, r: 0.95, camH: CAMP_H + 0.3, y0: CAMP_H - 1 });

  // ---------------- Waterfall ----------------
  const fallPts = []; for (let i = 0; i <= 26; i++) { const t = i / 26, x = -26.6 + t * 10.2, z = 2.3 + t * 2.0; fallPts.push([x, z, Math.max(coveHeight(x, z), WL - 0.2) + 0.14]); }
  const fallGeo = (() => { const pos = [], uv = [], idx = []; fallPts.forEach(([x, z, y], i) => { const w = 1.15 + i / 26 * 0.9; for (const s of [-1, 1]) { pos.push(x - 0.37 * s * w * 0.4, y, z + s * w); uv.push(s < 0 ? 0 : 1, i / 26); } if (i < 26) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g; })();
  const fallMat = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uTint: { value: C('#DDF4FF') } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main() { float s = vn(vec2(vUv.x * 14.0, vUv.y * 9.0 - uTime * 2.6)) * 0.6 + vn(vec2(vUv.x * 30.0, vUv.y * 20.0 - uTime * 4.0)) * 0.4;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        vec3 col = mix(vec3(0.45, 0.75, 0.9), uTint, smoothstep(0.35, 0.8, s));
        float a = edge * (0.55 + 0.45 * s) * smoothstep(1.0, 0.86, vUv.y);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const fall = new THREE.Mesh(fallGeo, fallMat); fall.renderOrder = 3; scene.add(fall);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4FB8C8', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
  pond.position.set(-30, coveHeight(-30, 2) + 0.32, 2); scene.add(pond);

  // ---------------- Pier, hammock, bench, painting-door back home, signpost ----------------
  const wood = new THREE.MeshStandardMaterial({ color: '#A57A4E', roughness: 0.85 }), woodD = new THREE.MeshStandardMaterial({ color: '#6E4E30', roughness: 0.9 });
  for (let z = PIER.z0; z < PIER.z1; z += 0.42) { const pl = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.36), z % 0.84 < 0.42 ? wood : woodD); pl.position.set(PIER.x + (hash2(z, 3) - 0.5) * 0.06, PIER.deck - 0.04, z); pl.castShadow = pl.receiveShadow = true; scene.add(pl); }
  for (let z = PIER.z0 + 1.5; z < PIER.z1; z += 2.4) for (const sx of [-0.95, 0.95]) { const gz = coveHeight(PIER.x + sx, z); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, PIER.deck - gz + 0.25, 8), woodD); post.position.set(PIER.x + sx, (PIER.deck + gz + 0.25) / 2, z); post.castShadow = true; scene.add(post); }
  boxes.push({ minX: PIER.x - 0.95, maxX: PIER.x + 0.95, minZ: PIER.z0, maxZ: PIER.z1, top: PIER.deck });
  // Hammock between two posts.
  const hamA = new THREE.Vector3(10.2, coveHeight(10.2, 5.2), 5.2), hamB = new THREE.Vector3(13, coveHeight(13, 5.7), 5.7);
  for (const p of [hamA, hamB]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8), woodD); post.position.set(p.x, p.y + 0.8, p.z); post.castShadow = true; scene.add(post); circles.push({ x: p.x, z: p.z, r: 0.12, camH: p.y + 1.6, y0: p.y - 1 }); }
  { const [c, g] = makeCanvas(64, 64); for (let i = 0; i < 8; i++) { g.fillStyle = ['#F2A7B5', '#FFF4E0', '#7FB3E0', '#FFF4E0'][i % 4]; g.fillRect(0, i * 8, 64, 8); }
    const pos = [], uv = [], idx = []; const W = 0.55;
    for (let i = 0; i <= 12; i++) { const t = i / 12, p = hamA.clone().lerp(hamB, t); p.y += 1.25 - Math.sin(Math.PI * t) * 0.55; const dir = hamB.clone().sub(hamA).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x); for (const s of [-1, 1]) { const q = p.clone().addScaledVector(side, s * W * Math.sin(Math.PI * (0.15 + t * 0.7))); pos.push(q.x, q.y + (s ? 0.04 * Math.sin(Math.PI * t) : 0), q.z); uv.push(s < 0 ? 0 : 1, t); } if (i < 12) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); hg.setIndex(idx); hg.computeVertexNormals();
    const ham = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ map: toTexture(c), side: THREE.DoubleSide, roughness: 0.9 })); ham.castShadow = true; scene.add(ham); }
  // Lookout bench.
  const benchY = coveHeight(LOOKOUT.x, LOOKOUT.z);
  { const b = new THREE.Group(); b.position.set(LOOKOUT.x, benchY, LOOKOUT.z); b.rotation.y = -0.6; const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), wood); seat.position.y = 0.45; b.add(seat); const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), wood); back.position.set(0, 0.8, -0.24); b.add(back);
    for (const sx of [-0.8, 0.8]) for (const sz of [-0.2, 0.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), woodD); l.position.set(sx, 0.22, sz); b.add(l); } b.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(b);
    circles.push({ x: LOOKOUT.x, z: LOOKOUT.z, r: 0.55, top: benchY + 0.5, camH: benchY + 1, y0: benchY - 1 }); }
  // A painting on an easel: step into it to go back to Belly Button's World.
  const easelPos = new THREE.Vector3(-0.5, coveHeight(-0.5, 5.8), 5.8);
  { const e = new THREE.Group(); e.position.copy(easelPos); e.rotation.y = Math.PI - 0.35;
    for (const [x, rz] of [[-0.45, -0.12], [0.45, 0.12]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.0, 0.07), woodD); leg.position.set(x, 1.0, 0); leg.rotation.z = rz; e.add(leg); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.9, 0.07), woodD); back.position.set(0, 0.95, -0.35); back.rotation.x = -0.2; e.add(back);
    const [c, g] = makeCanvas(256, 200); const gr = g.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, '#8EC3EA'); gr.addColorStop(0.6, '#FCE9CF'); g.fillStyle = gr; g.fillRect(0, 0, 256, 200);
    g.fillStyle = '#86C99A'; g.beginPath(); g.moveTo(0, 150); g.quadraticCurveTo(128, 90, 256, 150); g.lineTo(256, 200); g.lineTo(0, 200); g.fill();
    g.fillStyle = '#F2C230'; g.fillRect(120, 95, 24, 40); g.fillStyle = '#4A90D9'; g.fillRect(124, 99, 16, 36); g.fillStyle = '#F2A7B5'; g.beginPath(); g.arc(60, 150, 14, 0, 7); g.fill(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(200, 40, 20, 0, 7); g.arc(220, 44, 16, 0, 7); g.fill();
    g.strokeStyle = '#8B5A2B'; g.lineWidth = 14; g.strokeRect(0, 0, 256, 200);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.0), new THREE.MeshStandardMaterial({ map: toTexture(c, { wrap: false }), roughness: 0.6, emissive: '#FFF3D6', emissiveIntensity: 0.15, emissiveMap: toTexture(c, { wrap: false }) }));
    art.position.set(0, 1.45, 0.08); art.rotation.x = -0.12; e.add(art); e.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(e);
    circles.push({ x: easelPos.x, z: easelPos.z, r: 0.4, camH: easelPos.y + 2, y0: easelPos.y - 1 }); }

  // ---------------- Particles: fireflies, floating light motes, embers, waterfall mist, bubbles ----------------
  const points = (n, seedFn, vert, frag, uniforms = {}) => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n); for (let i = 0; i < n; i++) { const [x, y, z] = seedFn(i); pos.set([x, y, z], i * 3); seed[i] = R(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uI: { value: 1 }, uScale: { value: 300 }, uCam: { value: new THREE.Vector3() }, uWL: U.uWL, ...uniforms }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return p;
  };
  const dotFrag = (col) => `uniform float uI; varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q); float a = smoothstep(0.5, 0.0, d); a = a * a * vA * uI; if (a < 0.01) discard; gl_FragColor = vec4(vec3(${col}) * a, a); }`;
  const fireflySpots = []; for (let i = 0; i < 60; i++) { const a = R() * 6.28, r = 3 + R() * 9, x = CAMPFIRE.x + Math.cos(a) * r, z = CAMPFIRE.z + Math.sin(a) * r; fireflySpots.push([x, coveHeight(x, z) + 0.5 + R() * 1.6, z]); }
  for (let i = 0; i < 400 && fireflySpots.length < 260; i++) { const x = -40 + R() * 80, z = -45 + R() * 48, h = coveHeight(x, z); if (h < 1.1 || (groveMask(x, z) < 0.3 && R() < 0.6)) continue; fireflySpots.push([x, h + 0.4 + R() * 1.8, z]); }
  const fireflies = points(fireflySpots.length, (i) => fireflySpots[i],
    `uniform float uTime, uScale; attribute float seed; varying float vA; void main() { vec3 p = position; float s = seed * 40.0; p += vec3(sin(uTime * 0.45 + s) * 0.9, sin(uTime * 0.7 + s * 1.3) * 0.35, cos(uTime * 0.4 + s * 0.7) * 0.9);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(2.0, uScale * 0.09 / -mv.z); vA = pow(0.5 + 0.5 * sin(uTime * 2.2 + s * 3.0), 2.0); }`, dotFrag('1.0, 0.95, 0.45'));
  const motes = points(hi ? 420 : 200, () => [(R() - 0.5) * 30, R() * 8, (R() - 0.5) * 30],
    `uniform float uTime, uScale, uWL; uniform vec3 uCam; attribute float seed; varying float vA; void main() { vec3 b = position + vec3(uTime * 0.25, sin(uTime * 0.3 + seed * 20.0) * 0.6, uTime * 0.12);
      vec3 p = mod(b - uCam + vec3(15.0, 2.0, 15.0), vec3(30.0, 8.0, 30.0)) - vec3(15.0, 2.0, 15.0) + uCam; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = uScale * 0.035 / -mv.z; vA = (0.35 + 0.65 * fract(seed * 7.0)) * step(uWL + 0.1, p.y) * smoothstep(30.0, 6.0, -mv.z); }`, dotFrag('1.0, 0.92, 0.75'));
  const bubbles = points(hi ? 260 : 120, () => [(R() - 0.5) * 16, R() * 5, (R() - 0.5) * 16],
    `uniform float uTime, uScale, uWL; uniform vec3 uCam; attribute float seed; varying float vA; void main() { vec3 b = position + vec3(sin(uTime * 2.0 + seed * 30.0) * 0.15, uTime * (0.4 + seed * 0.5), 0.0);
      vec3 p = mod(b - uCam + vec3(8.0, 3.0, 8.0), vec3(16.0, 5.0, 16.0)) - vec3(8.0, 3.0, 8.0) + uCam; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = uScale * (0.02 + seed * 0.03) / -mv.z; vA = step(p.y, uWL - 0.05) * 0.8; }`, dotFrag('0.75, 0.95, 1.0'));
  const embers = points(60, () => [CAMPFIRE.x + (R() - 0.5) * 0.5, CAMP_H + 0.3, CAMPFIRE.z + (R() - 0.5) * 0.5],
    `uniform float uTime, uScale; attribute float seed; varying float vA; void main() { float t = fract(uTime * (0.35 + seed * 0.3) + seed); vec3 p = position + vec3(sin(seed * 50.0 + t * 6.0) * 0.4 * t, t * 3.2, cos(seed * 30.0 + t * 5.0) * 0.4 * t);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uScale * 0.03 / -mv.z; vA = (1.0 - t); }`, dotFrag('1.0, 0.55, 0.15'));
  const mist = points(140, () => [POOL.x - 0.5 + (R() - 0.5) * 2.5, WL + 0.1, POOL.z + (R() - 0.5) * 3],
    `uniform float uTime, uScale; attribute float seed; varying float vA; void main() { float t = fract(uTime * (0.2 + seed * 0.2) + seed); vec3 p = position + vec3((seed - 0.5) * 2.0 * t, t * 2.2, sin(seed * 40.0) * t);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uScale * (0.12 + t * 0.25) / -mv.z; vA = (1.0 - t) * 0.25; }`, dotFrag('0.9, 0.97, 1.0'));
  mist.material.blending = THREE.NormalBlending;
  const pointSets = [fireflies, motes, bubbles, embers, mist];

  // Splash rings when you jump in.
  const rings = []; const ringGeo = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
  const splash = (pos) => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.8, depthWrite: false })); m.position.set(pos.x, WL + 0.06, pos.z); m.scale.setScalar(0.2); scene.add(m); rings.push({ m, t: 0 }); };

  // ---------------- Interaction spots ----------------
  const places = [
    { id: 'reef', pos: new THREE.Vector3(3, 0, 20), r: 6, name: 'the Coral Reef', text: 'Swim out to the coral reef. Press X to dive and visit the fish and the sea turtle!' },
    { id: 'campfire', pos: new THREE.Vector3(CAMPFIRE.x, 0, CAMPFIRE.z), r: 4, name: 'the Campfire', text: 'Follow the dirt path into the pine grove to find the campfire.' },
    { id: 'waterfall', pos: new THREE.Vector3(POOL.x, 0, POOL.z), r: 4.5, name: 'the Waterfall', text: 'Listen for rushing water: the waterfall pours off the rocky cliffs to the west.' },
    { id: 'lookout', pos: new THREE.Vector3(LOOKOUT.x, 0, LOOKOUT.z), r: 3.5, name: 'the Sunset Lookout', text: 'Take the path up the ramp onto the rocky headland to reach the Sunset Lookout bench.' },
    { id: 'pier', pos: new THREE.Vector3(PIER.x, 0, PIER.z1 - 1), r: 2.5, name: 'the end of the Pier', text: 'Walk to the end of the wooden pier, then jump in!' },
  ];
  const visited = new Set();
  let marshmallows = 0;
  interact.push(
    { id: 'campfire', pos: new THREE.Vector3(CAMPFIRE.x, 0, CAMPFIRE.z), r: 2.6, prompt: () => 'Toast a marshmallow', action: 'fn', fn: (ex) => { marshmallows++; ex.g.audio.sfx('collect'); ex.g.ui.toast(marshmallows === 1 ? '🔥 Toasty! A golden marshmallow. Belly Button wants one too.' : `🔥 Marshmallow number ${marshmallows}. Perfectly golden!`, 2.5); ex.p.cheer = 1; setTimeout(() => { ex.p.cheer = 0; }, 900); } },
    { id: 'hammock', pos: hamA.clone().lerp(hamB, 0.5), r: 2.2, prompt: () => 'Rest in the hammock', action: 'fn', fn: (ex) => { ex.g.audio.sfx('ui'); ex.g.ui.toast('😌 Swing, swing... the waves are so relaxing.', 3); } },
    { id: 'bench', pos: new THREE.Vector3(LOOKOUT.x, 0, LOOKOUT.z), r: 2.2, prompt: () => 'Watch the sunset', action: 'fn', fn: (ex) => { setTime('sunset', ex); ex.cam.yaw = Math.atan2(-cur.sunDir.x, -cur.sunDir.z) + Math.PI; ex.cam.pitch = 0.12; ex.cam.manualT = 0; ex.g.ui.toast('🌅 What a view. Press T to see the stars come out.', 3.5); } },
    { id: 'easel', pos: easelPos.clone().add(new THREE.Vector3(0.4, 0, -1.1)), r: 1.8, prompt: () => "Step into the painting (back to Belly Button's World)", action: 'travel', dest: 'bbworld' },
  );

  const setTime = (name, ex, instant = false) => { timeName = name; if (instant) lerpPreset(name, 1); if (ex) { ex.g.ui.toast(`🕒 ${TIME_NAMES[name]}`, 1.8); ex.g.audio.sfx('paper'); } };

  // Camera: don't look through tree trunks, logs, rocks or the ground.
  const camLimit = (target, dir, dist) => {
    let t = dist; const tv = new THREE.Vector3();
    for (let i = 1; i <= 16; i++) { const s = dist * i / 16; tv.copy(target).addScaledVector(dir, s); if (tv.y < coveHeight(tv.x, tv.z) + 0.3) { t = Math.min(t, Math.max(0.6, s - dist / 16)); break; } }
    const dx = dir.x, dz = dir.z, a = dx * dx + dz * dz;
    if (a > 1e-6) for (const c of circles) {
      if (c.camH === undefined) continue;
      const ox = target.x - c.x, oz = target.z - c.z; if (ox * ox + oz * oz > (t + c.r + 1) ** 2) continue;
      const b = ox * dx + oz * dz, cc = ox * ox + oz * oz - c.r * c.r; if (cc < 0) continue;
      const disc = b * b - a * cc; if (disc < 0) continue;
      const s = (-b - Math.sqrt(disc)) / a; if (s <= 0 || s >= t) continue;
      const y = target.y + dir.y * s; if (y > c.y0 && y < c.camH) t = Math.max(0.6, s - 0.3);
    }
    return t;
  };

  // ---------------- Every frame ----------------
  const fogNormal = new THREE.Color(), fogUnder = new THREE.Color(); let wasUnder = false, underTold = false;
  const update = (dt, ctx) => {
    const t = ctx.time, cam = ctx.camera, P = ctx.player;
    U.uTime.value = t; U.uPlayer.value.copy(P.pos);
    lerpPreset(timeName, 1 - Math.exp(-dt * 1.6));
    // Sun follows the player so shadows stay sharp nearby.
    sun.position.copy(P.pos).addScaledVector(cur.sunDir, 70); sun.target.position.copy(P.pos);
    sun.color.copy(cur.light); sun.intensity = cur.sunI; hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = cur.hemiI;
    skyMat.uniforms.uNight.value = cur.night; skyMat.uniforms.uCloud.value = cur.cloud; sky.position.copy(cam.position);
    waterU.uSunI.value = Math.min(1, cur.sunI / 2.5) * (1 - cur.night * 0.6);
    mtnMats.forEach(m => { m.uniforms.uTop.value.copy(cur.mtn[m.userData.layer]); m.uniforms.uBot.value.copy(cur.hor); });
    // Under the water: blue-green haze, close fog, bubbles; above: normal air.
    const under = cam.position.y < WL + 0.02 && cam.position.distanceTo(P.pos) < 15;
    fogNormal.copy(cur.fog); fogUnder.copy(cur.under);
    scene.fog.color.copy(under ? fogUnder : fogNormal); scene.fog.density = under ? 0.048 : cur.fogD;
    U.uCaus.value = 0.6 + 0.4 * (1 - cur.night) * Math.min(1, cur.sunI);
    if (under && P.swimming && !wasUnder && !underTold) { underTold = true; ctx.explore.g.ui.toast('🐠 Underwater! Hold X to dive deeper, Space to swim up.', 3.5); }
    wasUnder = under;
    // Particles.
    const scale = window.innerHeight * 0.9;
    for (const p of pointSets) { p.material.uniforms.uScale.value = scale; p.material.uniforms.uCam.value.copy(cam.position); }
    fireflies.material.uniforms.uI.value = cur.fire; motes.material.uniforms.uI.value = cur.motes * (under ? 0 : 1); bubbles.material.uniforms.uI.value = under ? 1 : 0;
    // Campfire flicker (brighter at night).
    const fl = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 23.7) * 0.06;
    fireLight.intensity = (4 + cur.night * 10) * fl; glow.material.opacity = 0.55 + cur.night * 0.45; flames.forEach((f, i) => { f.scale.y = fl + Math.sin(t * 8 + i) * 0.08; });
    // Fish.
    fishData.forEach((f, i) => {
      const s = schools[f.si]; f.a += s.sp * dt * (1 + Math.sin(t + f.ph) * 0.2);
      const x = s.c[0] + Math.cos(f.a) * f.rr, z = s.c[1] + Math.sin(f.a) * f.rr, y = Math.max(coveHeight(x, z) + 0.35, s.y + f.dy + Math.sin(t * 1.3 + f.ph) * 0.15);
      const dx = x + f.off.x - P.pos.x, dz = z + f.off.z - P.pos.z, dy = y - (P.pos.y + 0.6), d = Math.hypot(dx, dy, dz);
      if (d < 2.2) { const k = (2.2 - d) * 2.5 * dt; f.off.x += dx / d * k; f.off.z += dz / d * k; }
      f.off.multiplyScalar(1 - dt * 0.6);
      dummy.position.set(x + f.off.x, Math.min(y, WL - 0.25), z + f.off.z);
      dummy.rotation.set(0, Math.atan2(-Math.sin(f.a) * Math.sign(s.sp), Math.cos(f.a) * Math.sign(s.sp)) + Math.sin(t * 9 + f.ph) * 0.15, 0);
      dummy.scale.setScalar(f.sc); dummy.updateMatrix(); fish.setMatrixAt(i, dummy.matrix);
    });
    fish.instanceMatrix.needsUpdate = true;
    // Turtle swims a slow lap around the reef.
    const ta = t * 0.06, tx = 4 + Math.cos(ta) * 11, tz = 23 + Math.sin(ta) * 7;
    turtle.position.set(tx, Math.max(coveHeight(tx, tz) + 0.6, -1.7 + Math.sin(t * 0.5) * 0.25), tz);
    turtle.rotation.set(Math.sin(t * 0.5) * 0.08, Math.atan2(-Math.sin(ta) * 11, Math.cos(ta) * 7) + Math.PI / 2 + Math.PI, Math.sin(t * 1.1) * 0.06);
    for (const f of turtle.userData.flips) { const w = Math.sin(t * 2.2 + (f.front ? 0 : 1.5)); f.pv.rotation.z = f.sx * w * (f.front ? 0.5 : 0.3); f.pv.rotation.y = f.sx * w * 0.25; }
    // Splash rings.
    for (const r of rings) { r.t += dt; r.m.scale.setScalar(0.3 + r.t * 2.2); r.m.material.opacity = Math.max(0, 0.8 - r.t * 0.8); }
    while (rings.length && rings[0].t > 1) { const r = rings.shift(); scene.remove(r.m); r.m.material.dispose(); }
    // Discover the special places.
    for (const pl of places) if (!visited.has(pl.id) && Math.hypot(P.pos.x - pl.pos.x, P.pos.z - pl.pos.z) < pl.r) { visited.add(pl.id); ctx.explore.g.audio.sfx('found'); ctx.explore.g.ui.toast(`✨ You found <b>${pl.name}</b>! (${visited.size}/${places.length})`, 3); }
  };

  return {
    name: 'cove', title: "Liev's Cozy Cove", scene, sun, music: 'cove', ambience: 'shore',
    spawn: { pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), yaw: 0, camYaw: Math.PI },
    circles, boxes, camSpheres: [], maxCamDist: 8, terrain: coveHeight, waterLevel: WL, splash,
    doors: [],
    helpExtra: '<span class="key">T</span> time of day · deep water: <span class="key">Space</span> up, <span class="key">X</span> dive',
    keys: { KeyT: (ex) => setTime(TIMES[(TIMES.indexOf(timeName) + 1) % TIMES.length], ex) },
    get timeName() { return timeName; }, setTime, visited, places,
    limit(p) {
      const r = Math.hypot(p.x, p.z - 2);
      if (r > 58) { p.x *= 58 / r; p.z = 2 + (p.z - 2) * 58 / r; }
      return r > 55 ? "That's the open ocean and the wild hills. Let's stay in the cozy cove!" : null;
    },
    camLimit,
    interact,
    goals: () => { const left = places.filter(p => !visited.has(p.id)); return (left.length ? left : places.filter(p => p.id === 'campfire').map(p => ({ ...p, text: 'You found every special place! Toast a marshmallow at the campfire, or press T for a starry night.' }))).map(p => ({ pos: p.pos, text: p.text })); },
    update,
    stats: () => ({ grassBlades: [...grassChunks.values()].reduce((a, l) => a + l.length, 0), pines: trunkList.length, rocks: rockLists.flat().length, flowers: Object.values(flowerLists).reduce((a, l) => a + l.length, 0), fish: fishData.length, ferns: fernList.length }),
  };
}
