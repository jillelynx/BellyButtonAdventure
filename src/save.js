// Automatic saving in the browser. Every key starts with "bba." so this game
// never mixes its saves with any other game. Exploration and Platformer keep
// separate save slots.
const PREFIX = 'bba.';
export const DEFAULTS = {
  settings: { music: 0.5, effects: 0.8, ambience: 0.5, camSpeed: 1, wheel: 'orbit', quality: 'high', showFps: false, timer: false },
  look: null, // filled from DEFAULT_CHOICE
  explore: { area: 'bedroom', pos: null, yaw: Math.PI, unlocked: { bbworld: false }, doorsFound: [], started: false },
  platformer: { levels: {}, stamps: [] },
};
export const Save = {
  load(key, def) {
    const base = JSON.parse(JSON.stringify(def));
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return base;
      const v = JSON.parse(raw);
      return (v && typeof v === 'object') ? Object.assign(base, v) : base;
    } catch (_) { return base; }
  },
  write(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (_) { /* storage may be blocked */ } },
  clear(key) { try { localStorage.removeItem(PREFIX + key); } catch (_) { /* ignore */ } },
};
