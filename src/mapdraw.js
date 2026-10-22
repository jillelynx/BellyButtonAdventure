// Liev's hand-drawn adventure map. Used for the map on his bedroom wall
// AND for the in-game Map screen, so they always match.
export const PLACES = [
  { id: 'home', name: "Liev's Room", sub: 'Reading, PA', x: 0.2, y: 0.6, color: '#7FB3E0', icon: 'house', open: true },
  { id: 'bbworld', name: "Belly Button's World", sub: '', x: 0.5, y: 0.47, color: '#F2A7B5', icon: 'bear', open: true },
  { id: 'westcork', name: 'West Cork', sub: 'Ireland', x: 0.14, y: 0.24, color: '#7FA35A', icon: 'hills', next: true },
  { id: 'quebec', name: 'Old Quebec City', sub: 'Canada', x: 0.36, y: 0.12, color: '#5F9E8C', icon: 'castle' },
  { id: 'nyc', name: 'New York City', sub: '', x: 0.36, y: 0.72, color: '#F2C230', icon: 'tower' },
  { id: 'dc', name: 'Washington DC', sub: '', x: 0.22, y: 0.86, color: '#ECE7DD', icon: 'dome' },
  { id: 'lewes', name: 'Lewes', sub: 'Delaware', x: 0.4, y: 0.9, color: '#3F8FB5', icon: 'lighthouse' },
  { id: 'miami', name: 'Miami', sub: 'Florida', x: 0.56, y: 0.88, color: '#3DC6C9', icon: 'palm' },
  { id: 'grandcanyon', name: 'Grand Canyon', sub: '', x: 0.68, y: 0.7, color: '#C1663B', icon: 'canyon' },
  { id: 'desert', name: 'Arizona Desert', sub: '', x: 0.8, y: 0.86, color: '#E7C08A', icon: 'cactus' },
  { id: 'antelope', name: 'Antelope Canyon', sub: '', x: 0.88, y: 0.64, color: '#E9813F', icon: 'swirl' },
  { id: 'moscow', name: 'Moscow', sub: 'Russia', x: 0.8, y: 0.2, color: '#A8342E', icon: 'onion' },
  { id: 'kratovo', name: 'Kratovo Dacha', sub: 'near Moscow', x: 0.9, y: 0.4, color: '#5E8C6A', icon: 'cabin' },
  { id: 'france1944', name: 'France, 1944', sub: 'Time Door', x: 0.62, y: 0.2, color: '#B79C78', icon: 'clock', old: true },
];

const INK = '#3A3D45';
const font = (s, bold = true) => `${bold ? 'bold ' : ''}${s}px "Chalkboard SE","Marker Felt","Comic Sans MS","Comic Neue",sans-serif`;

function wobblyCircle(g, x, y, r, seed) {
  g.beginPath();
  for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; const rr = r * (1 + 0.05 * Math.sin(a * 3 + seed)); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath();
}

function icon(g, kind, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineWidth = 3 / s * s * 0.12; g.strokeStyle = INK; g.lineJoin = 'round';
  const L = (pts, fill) => { g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); };
  g.lineWidth = 0.12;
  switch (kind) {
    case 'house': L([[-0.6, 0.6], [-0.6, -0.1], [0, -0.7], [0.6, -0.1], [0.6, 0.6], [-0.6, 0.6]], '#FFF3D6'); L([[-0.15, 0.6], [-0.15, 0.15], [0.15, 0.15], [0.15, 0.6]], '#B07A4A'); break;
    case 'bear': g.fillStyle = '#3A3D45'; g.beginPath(); g.arc(-0.5, -0.55, 0.25, 0, 7); g.arc(0.5, -0.55, 0.25, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, 0, 0.62, 0.7, 0, 0, 7); g.fill();
      g.fillStyle = '#F1ECE3'; g.beginPath(); g.ellipse(0, 0.2, 0.32, 0.28, 0, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0.08, 0.1, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-0.3, -0.18, 0.09, 0, 7); g.arc(0.3, -0.18, 0.09, 0, 7); g.fill(); break;
    case 'hills': L([[-0.8, 0.5], [-0.35, -0.3], [0.05, 0.2], [0.4, -0.55], [0.85, 0.5]], '#5E8F4A'); L([[-0.2, 0.5], [-0.2, 0.15], [0.3, 0.15], [0.3, 0.5]]); break;
    case 'castle': L([[-0.6, 0.6], [-0.6, -0.2], [-0.3, -0.2], [-0.3, -0.6], [0.3, -0.6], [0.3, -0.2], [0.6, -0.2], [0.6, 0.6], [-0.6, 0.6]], '#CFC6B8'); L([[-0.35, -0.6], [0, -0.95], [0.35, -0.6]], '#5F9E8C'); break;
    case 'tower': L([[-0.25, 0.7], [-0.15, -0.4], [0, -0.9], [0.15, -0.4], [0.25, 0.7]], '#B9C3CF'); L([[-0.7, 0.7], [-0.7, 0.1], [-0.4, 0.1], [-0.4, 0.7]], '#9C5B48'); L([[0.45, 0.7], [0.45, -0.1], [0.75, -0.1], [0.75, 0.7]], '#9C5B48'); break;
    case 'dome': L([[-0.7, 0.6], [-0.7, 0.2], [0.7, 0.2], [0.7, 0.6], [-0.7, 0.6]], '#FFF'); g.beginPath(); g.arc(0, 0.2, 0.45, Math.PI, 0); g.fillStyle = '#fff'; g.fill(); g.stroke(); L([[0, -0.25], [0, -0.6]]); break;
    case 'lighthouse': L([[-0.25, 0.7], [-0.15, -0.5], [0.15, -0.5], [0.25, 0.7], [-0.25, 0.7]], '#FFF'); L([[-0.2, 0.2], [0.2, 0.2]]); L([[-0.22, -0.1], [0.22, -0.1]]); g.fillStyle = '#C8473D'; g.fillRect(-0.18, -0.75, 0.36, 0.25); g.strokeRect(-0.18, -0.75, 0.36, 0.25); break;
    case 'palm': L([[0, 0.7], [0.1, -0.4]]); for (const a of [-2.6, -1.9, -1.2, -0.5]) L([[0.1, -0.4], [0.1 + Math.cos(a) * 0.7, -0.4 + Math.sin(a) * 0.35 + 0.15]]); break;
    case 'canyon': L([[-0.8, -0.3], [-0.3, -0.3], [-0.2, 0.6], [0.2, 0.6], [0.3, -0.3], [0.8, -0.3], [0.8, 0.7], [-0.8, 0.7], [-0.8, -0.3]], '#C1663B'); break;
    case 'cactus': L([[0, 0.7], [0, -0.6]]); L([[0, 0.1], [-0.4, 0.1], [-0.4, -0.3]]); L([[0, -0.1], [0.35, -0.1], [0.35, -0.45]]); break;
    case 'swirl': g.beginPath(); for (let i = 0; i < 60; i++) { const a = i * 0.25, r = i * 0.012; const px = Math.cos(a) * r, py = Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); break;
    case 'onion': L([[-0.5, 0.7], [-0.5, 0], [0.5, 0], [0.5, 0.7], [-0.5, 0.7]], '#A8342E'); g.beginPath(); g.moveTo(-0.4, 0); g.quadraticCurveTo(-0.5, -0.5, 0, -0.85); g.quadraticCurveTo(0.5, -0.5, 0.4, 0); g.closePath(); g.fillStyle = '#E3B341'; g.fill(); g.stroke(); break;
    case 'cabin': L([[-0.6, 0.6], [-0.6, 0], [0, -0.55], [0.6, 0], [0.6, 0.6], [-0.6, 0.6]], '#5E8C6A'); L([[-0.2, 0.25], [0.2, 0.25]]); break;
    case 'clock': g.beginPath(); g.arc(0, 0, 0.6, 0, 7); g.fillStyle = '#E8D9B8'; g.fill(); g.stroke(); L([[0, 0], [0, -0.4]]); L([[0, 0], [0.3, 0.1]]); break;
    default: break;
  }
  g.restore();
}

// state: { mode: 'wall' | 'screen', unlocked:{}, doorsFound:[], stamps:[] }
export function drawAdventureMap(g, w, h, state = { mode: 'wall' }) {
  const S = w / 1000;
  // Paper.
  g.fillStyle = '#FBF5E6'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(127,179,224,0.25)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 28 * S) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 28 * S) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  // Sea and land blobs in crayon.
  g.fillStyle = 'rgba(127,179,224,0.18)'; wobblyCircle(g, w * 0.5, h * 0.5, w * 0.48, 1); g.fill();
  g.fillStyle = 'rgba(168,216,185,0.35)'; wobblyCircle(g, w * 0.28, h * 0.55, w * 0.2, 2); g.fill(); wobblyCircle(g, w * 0.78, h * 0.6, w * 0.17, 4); g.fill(); wobblyCircle(g, w * 0.78, h * 0.25, w * 0.13, 5); g.fill(); wobblyCircle(g, w * 0.2, h * 0.2, w * 0.1, 6); g.fill();
  // Title.
  g.fillStyle = INK; g.textAlign = 'center'; g.font = font(40 * S); g.fillText("LIEV'S ADVENTURE MAP", w / 2, 52 * S);
  // Dashed trails from Belly Button's World to everywhere.
  const bb = PLACES[1];
  g.setLineDash([10 * S, 9 * S]); g.lineWidth = 3.5 * S; g.strokeStyle = 'rgba(200,71,61,0.6)';
  for (const p of PLACES) { if (p === bb) continue; g.beginPath(); g.moveTo(bb.x * w, bb.y * h); g.quadraticCurveTo((bb.x + p.x) / 2 * w + 30 * S, (bb.y + p.y) / 2 * h - 30 * S, p.x * w, p.y * h); g.stroke(); }
  g.setLineDash([]);
  // Treasure X.
  g.strokeStyle = '#C8473D'; g.lineWidth = 7 * S;
  const tx = 0.6 * w, ty = 0.36 * h;
  g.beginPath(); g.moveTo(tx - 16 * S, ty - 16 * S); g.lineTo(tx + 16 * S, ty + 16 * S); g.moveTo(tx + 16 * S, ty - 16 * S); g.lineTo(tx - 16 * S, ty + 16 * S); g.stroke();
  // Places.
  const screen = state.mode === 'screen';
  for (const p of PLACES) {
    const x = p.x * w, y = p.y * h, r = (p.id === 'bbworld' ? 54 : 40) * S;
    const isOpen = !screen || p.id === 'home' || (p.id === 'bbworld' && state.unlocked && state.unlocked.bbworld);
    g.globalAlpha = isOpen ? 1 : 0.45;
    if (p.old) { g.fillStyle = 'rgba(150,120,80,0.35)'; wobblyCircle(g, x, y, r * 1.25, 9); g.fill(); }
    g.fillStyle = p.color; wobblyCircle(g, x, y, r, p.x * 10); g.fill();
    g.lineWidth = 4 * S; g.strokeStyle = INK;
    if (!isOpen) g.setLineDash([8 * S, 7 * S]);
    g.stroke(); g.setLineDash([]);
    if (isOpen || !screen) icon(g, p.icon, x, y, r * 0.75);
    else { g.fillStyle = INK; g.font = font(40 * S); g.textBaseline = 'middle'; g.fillText('?', x, y + 2 * S); g.textBaseline = 'alphabetic'; }
    g.fillStyle = INK; g.font = font(21 * S); g.fillText(p.name, x, y + r + 24 * S);
    if (p.sub) { g.font = font(16 * S, false); g.fillText(p.sub, x, y + r + 43 * S); }
    if (screen && p.next && !isOpen) { g.globalAlpha = 1; g.fillStyle = '#C8473D'; g.font = font(17 * S); g.fillText('coming next!', x, y - r - 10 * S); }
    g.globalAlpha = 1;
  }
}
