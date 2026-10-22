// SHARED PROGRESS — records that any mode can use (platformer now, the 3D
// sandbox later). No drawing code lives here, so it carries over unchanged.
// Saved in its own slot ("bba.records"), separate from Exploration and
// Platformer saves.
import { Save } from './save.js';

const DEF = { bestTimes: {}, bestTreats: {} };
let rec = Save.load('records', DEF);
const write = () => Save.write('records', rec);

export const Records = {
  reload() { rec = Save.load('records', DEF); },
  bestTime(id) { return rec.bestTimes[id] ?? null; },
  // Returns true when this is a new best time.
  submitTime(id, seconds) {
    const old = rec.bestTimes[id];
    if (old == null || seconds < old) { rec.bestTimes[id] = Math.round(seconds * 100) / 100; write(); return true; }
    return false;
  },
  bestTreats(id) { return rec.bestTreats[id] || 0; },
  submitTreats(id, n) { if (n > (rec.bestTreats[id] || 0)) { rec.bestTreats[id] = n; write(); } },
  clear() { rec = JSON.parse(JSON.stringify(DEF)); write(); },
};

// A stopwatch that only starts when the player first moves.
export class RunTimer {
  constructor(enabled) { this.enabled = enabled; this.started = false; this.t = 0; this.stopped = false; }
  start() { if (this.enabled && !this.started) this.started = true; }
  tick(dt) { if (this.started && !this.stopped) this.t += dt; }
  stop() { this.stopped = true; return this.t; }
}
export const formatTime = (s) => { if (s == null) return '–'; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };

// Rest spots: each one can give its treat only once per run of a level.
export class RestTracker {
  constructor() { this.used = new Set(); this.treats = 0; }
  canRest(i) { return !this.used.has(i); }
  rest(i) { if (this.used.has(i)) return false; this.used.add(i); this.treats++; return true; }
}
