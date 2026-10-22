// Textures drawn in code (no image files needed, no licensing worries).
import * as THREE from 'three';
import { rng } from './util.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
export function toTexture(c, { repeat = null, srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}
// Draw something so it tiles seamlessly (copies near edges wrap around).
function wrapDraw(size, x, y, m, fn) {
  const xs = [x], ys = [y];
  if (x < m) xs.push(x + size); if (x > size - m) xs.push(x - size);
  if (y < m) ys.push(y + size); if (y > size - m) ys.push(y - size);
  for (const a of xs) for (const b of ys) fn(a, b);
}

// Belly Button's fabric: charcoal with short light dash marks.
export function plushDash(base, dash, seed = 1, size = 512, count = 1150) {
  const [c, g] = makeCanvas(size, size);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    g.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  g.strokeStyle = dash; g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, len = 13 + r() * 9, a = Math.PI / 2 + (r() - 0.5) * 0.8;
    const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
    g.lineWidth = 3.6 + r() * 1.6; g.globalAlpha = 0.7 + r() * 0.3;
    wrapDraw(size, x, y, 20, (px, py) => { g.beginPath(); g.moveTo(px - dx, py - dy); g.lineTo(px + dx, py + dy); g.stroke(); });
  }
  g.globalAlpha = 1;
  return toTexture(c);
}

// Soft felt: base color with tiny fibers.
export function felt(base, seed = 2, speck = 0.07, size = 256) {
  const [c, g] = makeCanvas(size, size);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${speck * r()})` : `rgba(0,0,0,${speck * r()})`;
    g.fillRect(r() * size, r() * size, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  g.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = r() * size, y = r() * size, a = r() * 6.28, l = 3 + r() * 6;
    g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    wrapDraw(size, x, y, 10, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); });
  }
  return toTexture(c);
}

// Woodland camo blotches. colors[0] = background.
export function camo(colors, seed = 3, size = 512, blobs = 46, scale = 1) {
  const [c, g] = makeCanvas(size, size);
  g.fillStyle = colors[0]; g.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let ci = 1; ci < colors.length; ci++) {
    g.fillStyle = colors[ci];
    for (let k = 0; k < blobs; k++) {
      const x = r() * size, y = r() * size, R = (16 + r() * 30) * scale, n = 9;
      const pts = []; const rot = r() * 6.28, stretch = 1 + r() * 1.2;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, rr = R * (0.55 + 0.5 * r());
        const ex = Math.cos(a) * rr * stretch, ey = Math.sin(a) * rr;
        pts.push([ex * Math.cos(rot) - ey * Math.sin(rot), ex * Math.sin(rot) + ey * Math.cos(rot)]);
      }
      wrapDraw(size, x, y, R * 2.4, (px, py) => {
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const p = pts[i % n], q = pts[(i + 1) % n];
          const mx = (p[0] + q[0]) / 2 + px, my = (p[1] + q[1]) / 2 + py;
          if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p[0] + px, p[1] + py, mx, my);
        }
        g.fill();
      });
    }
  }
  return toTexture(c);
}

// Digital (pixel) camo, like the cap in the photos.
export function digitalCamo(colors, seed = 4, size = 256, cell = 6) {
  const [c, g] = makeCanvas(size, size);
  g.fillStyle = colors[0]; g.fillRect(0, 0, size, size);
  const r = rng(seed), n = size / cell;
  for (let ci = 1; ci < colors.length; ci++) {
    g.fillStyle = colors[ci];
    for (let k = 0; k < 70; k++) {
      let x = Math.floor(r() * n), y = Math.floor(r() * n);
      const steps = 4 + Math.floor(r() * 12);
      for (let s = 0; s < steps; s++) {
        g.fillRect(((x % n + n) % n) * cell, ((y % n + n) % n) * cell, cell, cell);
        const d = Math.floor(r() * 4); if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else y--;
      }
    }
  }
  return toTexture(c);
}

export function woodPlanks(base = '#B07A4A', size = 512) {
  const [c, g] = makeCanvas(size, size);
  const r = rng(9);
  const rows = 6, h = size / rows;
  for (let i = 0; i < rows; i++) {
    const shade = (r() - 0.5) * 18;
    g.fillStyle = base; g.fillRect(0, i * h, size, h);
    g.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 220 : 0},${shade > 0 ? 180 : 0},${Math.abs(shade) / 90})`;
    g.fillRect(0, i * h, size, h);
    g.strokeStyle = 'rgba(70,40,20,0.18)'; g.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) {
      const y = i * h + 6 + r() * (h - 12);
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= size; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + k) * 2.5);
      g.stroke();
    }
    g.fillStyle = 'rgba(60,35,20,0.45)'; g.fillRect(0, i * h, size, 2.5);
    const cut = r() * size; g.fillRect(cut, i * h, 2.5, h);
  }
  return toTexture(c);
}

export function gradient(stops, w = 4, h = 512) {
  const [c, g] = makeCanvas(w, h);
  const gr = g.createLinearGradient(0, 0, 0, h);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  return toTexture(c, { wrap: false });
}

// A sewing button face (4 holes and a rim).
export function buttonFace(color) {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 7;
  g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.arc(50, 46, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(40,30,40,0.75)';
  for (const [x, y] of [[50, 50], [78, 50], [50, 78], [78, 78]]) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
  return toTexture(c, { wrap: false });
}

// Stitched top strip for felt platforms.
export function stitchStrip(base, stitch = '#FFFFFF') {
  const [c, g] = makeCanvas(256, 64);
  g.fillStyle = base; g.fillRect(0, 0, 256, 64);
  const r = rng(5);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${0.08 * r()})`; g.fillRect(r() * 256, r() * 64, 2, 2); }
  g.strokeStyle = stitch; g.lineWidth = 4; g.lineCap = 'round';
  for (let x = 6; x < 256; x += 24) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 12, 50); g.stroke(); }
  return toTexture(c);
}

export function soccerBall() {
  const [c, g] = makeCanvas(256, 128);
  g.fillStyle = '#FAFAFA'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#222';
  const spots = [[32, 64], [96, 30], [96, 98], [160, 64], [224, 30], [224, 98], [0, 20], [256, 20]];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; const px = x + Math.cos(a) * 15, py = y + Math.sin(a) * 15; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fill();
  }
  return toTexture(c);
}

// Text on a paper sign. lines = array of strings.
export function paperSign(lines, { w = 512, h = 256, bg = '#FFF8EC', ink = '#3A3D45', size = 34, title = null } = {}) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(58,61,69,0.5)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = (s, b) => `${b ? 'bold ' : ''}${s}px "Chalkboard SE","Marker Felt","Comic Sans MS","Comic Neue",sans-serif`;
  let y = 0; const all = title ? [title, ...lines] : lines; const lh = size * 1.3;
  y = h / 2 - (all.length - 1) * lh / 2;
  all.forEach((t, i) => { g.font = font(i === 0 && title ? size * 1.15 : size, i === 0 && title); g.fillText(t, w / 2, y + i * lh); });
  return toTexture(c, { wrap: false });
}
