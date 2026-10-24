// All sounds and music are made in code (no sound files, no licensing issues).
// Three separate volume controls: music, effects, ambience.
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const THEMES = {
  menu: { bpm: 84, root: 60, lead: 'triangle',
    mel: [0, null, 4, null, 7, null, 9, 7, 4, null, 2, null, 0, null, null, null, 2, null, 4, null, 7, null, 4, 2, 0, null, -3, null, 0, null, null, null],
    bass: [0, null, null, null, -5, null, null, null, -3, null, null, null, -7, null, null, null] },
  home: { bpm: 76, root: 62, lead: 'sine',
    mel: [7, null, 4, null, 2, null, 4, null, 0, null, null, null, 2, 4, 7, null, 9, null, 7, null, 4, null, 2, null, 4, null, null, null, null, null, null, null],
    bass: [0, null, null, null, -3, null, null, null, -5, null, null, null, -7, null, null, null] },
  bbworld: { bpm: 100, root: 65, lead: 'triangle',
    mel: [0, 2, 4, null, 7, null, 4, null, 9, null, 7, 4, 2, null, null, null, 4, null, 7, 9, 12, null, 9, null, 7, 4, 2, null, 0, null, null, null],
    bass: [0, null, 7, null, -3, null, 4, null, -5, null, 2, null, -7, null, 0, null] },
  war: { bpm: 112, root: 57, lead: 'square',   // a brave little march (minor key)
    mel: [0, null, 0, 3, 7, null, 7, null, 5, null, 3, 5, 7, null, null, null, 0, null, 0, 3, 8, null, 7, null, 5, 3, 2, null, 0, null, null, null],
    bass: [0, null, 0, null, -5, null, -5, null, -4, null, -4, null, -5, null, -7, null] },
  pacific: { bpm: 120, root: 62, lead: 'triangle',   // brave and sunny, a little like a ukulele march
    mel: [0, null, 4, 7, 9, null, 7, null, 4, null, 2, 4, 7, null, null, null, 9, null, 7, 4, 12, null, 11, null, 9, 7, 4, null, 2, null, null, null],
    bass: [0, null, 7, null, 5, null, 7, null, 0, null, 7, null, -5, null, 2, null] },
  cove: { bpm: 72, root: 64, lead: 'sine',   // slow and dreamy, like a lullaby by the sea
    mel: [7, null, null, 4, 9, null, 7, null, 4, null, 2, null, 4, null, null, null, 7, null, 9, null, 11, null, 9, 7, 4, null, null, 2, 0, null, null, null],
    bass: [0, null, null, null, -3, null, null, null, -7, null, null, null, -5, null, null, null] },
  platformer: { bpm: 126, root: 67, lead: 'square',
    mel: [0, null, 4, 7, 12, null, 7, null, 9, null, 5, 9, 12, null, 9, null, 7, null, 4, 7, 11, null, 7, null, 5, 4, 2, null, 0, null, null, null],
    bass: [0, 0, 7, 7, 5, 5, 0, 0, -1, -1, 4, 4, 5, 5, 7, 7] },
};

export class AudioSys {
  constructor() { this.ctx = null; this.vol = { music: 0.5, effects: 0.8, ambience: 0.5 }; this.theme = null; this.ambKind = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C();
    this.master = c.createGain(); this.master.gain.value = 0.85; this.master.connect(c.destination);
    this.bus = {};
    for (const k of ['music', 'effects', 'ambience']) { const g = c.createGain(); g.connect(this.master); this.bus[k] = g; }
    this.setVolumes(this.vol);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this.tick(), 80);
    if (this.theme) this.music(this.theme, true);
    if (this.ambKind) this.ambience(this.ambKind, true);
  }
  setVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.bus) return;
    const t = this.ctx.currentTime;
    this.bus.music.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.bus.effects.gain.setTargetAtTime(this.vol.effects, t, 0.05);
    this.bus.ambience.gain.setTargetAtTime(this.vol.ambience, t, 0.05);
  }
  tone(freq, t, dur, { type = 'sine', gain = 0.2, bus = 'effects', attack = 0.005, slideTo = null, cutoff = null } = {}) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (cutoff) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
    node.connect(g); g.connect(this.bus[bus]); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, { gain = 0.2, freq = 1000, q = 1, type = 'bandpass', bus = 'effects', slideTo = null } = {}) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.bus[bus]); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  sfx(name) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    switch (name) {
      case 'jump': this.tone(320, t, 0.18, { type: 'triangle', gain: 0.18, slideTo: 640 }); break;
      case 'land': this.noise(t, 0.12, { gain: 0.25, freq: 300, type: 'lowpass' }); break;
      case 'squish': this.noise(t, 0.22, { gain: 0.3, freq: 600, slideTo: 150, type: 'lowpass' }); this.tone(180, t, 0.2, { gain: 0.12, slideTo: 90 }); break;
      case 'boing': this.tone(180, t, 0.45, { type: 'triangle', gain: 0.25, slideTo: 720 }); break;
      case 'collect': this.tone(880, t, 0.12, { type: 'square', gain: 0.07 }); this.tone(1320, t + 0.07, 0.18, { type: 'square', gain: 0.07 }); break;
      case 'kick': this.noise(t, 0.08, { gain: 0.4, freq: 900 }); this.tone(140, t, 0.12, { gain: 0.3, slideTo: 60 }); break;
      case 'hit': [660, 880, 1100].forEach((f, i) => this.tone(f, t + i * 0.06, 0.25, { type: 'triangle', gain: 0.12 })); break;
      case 'door': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.08, 0.5, { type: 'sine', gain: 0.12 })); break;
      case 'stamp': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.1, 0.4, { type: 'triangle', gain: 0.14 })); break;
      case 'magic': for (let i = 0; i < 14; i++) this.tone(800 + Math.random() * 1600, t + i * 0.09, 0.4, { type: 'sine', gain: 0.05 }); this.noise(t, 2.0, { gain: 0.05, freq: 3000, q: 3, slideTo: 8000 }); break;
      case 'poof': this.noise(t, 0.35, { gain: 0.3, freq: 1500, slideTo: 300 }); break;
      case 'ui': this.tone(660, t, 0.07, { type: 'triangle', gain: 0.08 }); break;
      case 'paper': this.noise(t, 0.25, { gain: 0.18, freq: 2500, q: 0.7 }); break;
      case 'found': [659, 784, 988].forEach((f, i) => this.tone(f, t + i * 0.1, 0.35, { type: 'triangle', gain: 0.12 })); break;
      case 'shot': this.noise(t, 0.09, { gain: 0.35, freq: 1800, q: 0.8 }); this.tone(400, t, 0.06, { type: 'square', gain: 0.05, slideTo: 120 }); break;
      case 'rifle': this.noise(t, 0.16, { gain: 0.45, freq: 1100, q: 0.6, slideTo: 300 }); this.tone(180, t, 0.12, { type: 'square', gain: 0.06, slideTo: 60 }); break;
      case 'enemyshot': this.noise(t, 0.08, { gain: 0.22, freq: 1300, q: 1 }); break;
      case 'boom': this.noise(t, 0.7, { gain: 0.55, freq: 500, type: 'lowpass', slideTo: 80 }); this.tone(90, t, 0.5, { gain: 0.25, slideTo: 40 }); break;
      case 'whistle': this.tone(1400, t, 0.9, { type: 'sine', gain: 0.05, slideTo: 500 }); break;
      case 'plane': this.tone(110, t, 2.2, { type: 'sawtooth', gain: 0.025, cutoff: 500, slideTo: 95 }); break;
      case 'ping': this.tone(1800, t, 0.12, { type: 'triangle', gain: 0.07, slideTo: 2400 }); break;
      case 'hurt': this.tone(300, t, 0.25, { type: 'square', gain: 0.07, slideTo: 140 }); break;
      case 'cage': [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.07, 0.3, { type: 'triangle', gain: 0.1 })); this.noise(t, 0.15, { gain: 0.2, freq: 900 }); break;
      case 'pickup': this.tone(700, t, 0.1, { type: 'triangle', gain: 0.1 }); this.tone(1050, t + 0.06, 0.15, { type: 'triangle', gain: 0.1 }); break;
      case 'crumble': this.noise(t, 0.4, { gain: 0.25, freq: 700, slideTo: 200 }); break;
      case 'switch': this.tone(900, t, 0.05, { type: 'square', gain: 0.05 }); this.tone(600, t + 0.05, 0.05, { type: 'square', gain: 0.05 }); break;
      case 'torpedo': this.noise(t, 0.6, { gain: 0.22, freq: 400, type: 'lowpass', slideTo: 900 }); this.tone(160, t, 0.3, { gain: 0.08, slideTo: 260 }); break;
      case 'sonar': this.tone(1250, t, 0.9, { type: 'sine', gain: 0.07 }); this.tone(1250, t + 0.45, 0.6, { type: 'sine', gain: 0.025 }); break;
      case 'gun': this.noise(t, 0.05, { gain: 0.2, freq: 2200, q: 1 }); this.tone(260, t, 0.04, { type: 'square', gain: 0.04, slideTo: 120 }); break;
      case 'splash': this.noise(t, 0.6, { gain: 0.35, freq: 1200, slideTo: 300 }); break;
      case 'warn': this.tone(880, t, 0.1, { type: 'square', gain: 0.05 }); this.tone(880, t + 0.16, 0.1, { type: 'square', gain: 0.05 }); break;
      case 'bubble': this.tone(500, t, 0.12, { type: 'sine', gain: 0.06, slideTo: 1100 }); break;
      case 'bonk': this.tone(220, t, 0.1, { type: 'square', gain: 0.06, slideTo: 160 }); break;
      default: break;
    }
  }
  music(theme, force = false) {
    if (this.theme === theme && !force) return;
    this.theme = theme; this.step = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.15;
  }
  ambience(kind, force = false) {
    if (this.ambKind === kind && !force) return;
    this.ambKind = kind;
    if (!this.ctx) return;
    if (this.ambSrc) { try { this.ambSrc.stop(); } catch (_) { /* ignore */ } this.ambSrc = null; }
    if (this.ambLfo) { try { this.ambLfo.stop(); } catch (_) { /* ignore */ } this.ambLfo = null; }
    if (!kind) return;
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'room' ? 350 : 800;
    const g = c.createGain(); g.gain.value = kind === 'room' ? 0.05 : 0.06;
    s.connect(f); f.connect(g); g.connect(this.bus.ambience); s.start(); this.ambSrc = s;
    if (kind === 'shore') { // waves: a slow swell in loudness and brightness
      g.gain.value = 0.07; f.frequency.value = 600;
      const lfo = c.createOscillator(), lg = c.createGain(), lf = c.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 0.05; lf.gain.value = 350;
      lfo.connect(lg); lg.connect(g.gain); lfo.connect(lf); lf.connect(f.frequency); lfo.start(); this.ambLfo = lfo;
    }
  }
  tick() {
    const c = this.ctx; if (!c || !this.theme) return;
    const th = THEMES[this.theme]; if (!th) return;
    const stepDur = 60 / th.bpm / 2;
    if (this.nextTime < c.currentTime - 0.5) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.3) {
      const i = this.step;
      const m = th.mel[i % th.mel.length];
      if (m !== null) this.tone(midi(th.root + m), this.nextTime, stepDur * 1.8, { type: th.lead, gain: th.lead === 'square' ? 0.05 : 0.12, bus: 'music', attack: 0.02, cutoff: 2200 });
      if (i % 2 === 0) { const b = th.bass[(i / 2) % th.bass.length]; if (b !== null) this.tone(midi(th.root - 24 + b), this.nextTime, stepDur * 3.5, { type: 'sine', gain: 0.16, bus: 'music', attack: 0.03 }); }
      this.step++; this.nextTime += stepDur;
    }
    if ((this.ambKind === 'outdoor' || this.ambKind === 'shore') && Math.random() < 0.03) { // soft birdsong
      const t = c.currentTime + Math.random() * 0.2, f = 2200 + Math.random() * 1500;
      this.tone(f, t, 0.08, { gain: 0.03, bus: 'ambience', slideTo: f * 1.3 }); this.tone(f * 1.1, t + 0.11, 0.08, { gain: 0.025, bus: 'ambience', slideTo: f * 0.9 });
    }
  }
}
