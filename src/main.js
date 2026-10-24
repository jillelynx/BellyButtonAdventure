// BELLY BUTTON ADVENTURE — the game's "brain": modes, menus, saving, drawing.
import * as THREE from 'three';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { Save, DEFAULTS } from './save.js';
import { DEFAULT_CHOICE, LIEV } from './characters/looks.js';
import { Stage } from './select.js';
import { Explore } from './explore.js';
import { Platformer } from './platformer.js';
import { Retro, RETRO_LEVELS } from './retro.js';
import { RetroWar } from './retro_war.js';
import { RetroPacific } from './retro_pacific.js';
import { LEVELS } from './levels.js';
import { PLACES, drawAdventureMap } from './mapdraw.js';
import { DOOR1, DOOR2, DOOR3, DOOR4 } from './areas/bbworld.js';
const DOORS = [DOOR1, DOOR2, DOOR3, DOOR4];
const PLAY_MODES = ['explore', 'platformer', 'retro', 'war', 'pacific'];
import { ADMIN_WORD } from './admin.js';
import { VERSION, VERSION_DATE, VERSION_NOTE } from './version.js';
import { Records, formatTime } from './progress.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const game = {
  renderer, input: Input, audio: new AudioSys(), ui: new UI(document.getElementById('ui')),
  modeName: null, mode: null, paused: false, busy: false,
  settings: Save.load('settings', DEFAULTS.settings),
  choice: Save.load('look', DEFAULT_CHOICE),
  saves: { explore: Save.load('explore', DEFAULTS.explore), platformer: Save.load('platformer', DEFAULTS.platformer) },
  writeSave(k) { Save.write(k, this.saves[k]); },
  saveLook() { Save.write('look', this.choice); },
  saveSettings() { Save.write('settings', this.settings); },
};
window.__bba = game; // used by the automated tests
// Whenever a menu closes, Esc stops pointing at it (so Esc never does something stale).
{ const close = game.ui.closePanel.bind(game.ui); game.ui.closePanel = () => { close(); game.onEsc = null; game.mapOpen = false; }; }
Input.init(canvas);
Input.wheelMode = game.settings.wheel;
game.audio.setVolumes(game.settings);
const modes = { title: new Stage(game), explore: new Explore(game), platformer: new Platformer(game), retro: new Retro(game), war: new RetroWar(game), pacific: new RetroPacific(game) };
modes.select = modes.title;
game.modes = modes;

function applyQuality() {
  const hi = game.settings.quality !== 'low';
  renderer.setPixelRatio(hi ? Math.min(devicePixelRatio, 2) : 1);
  renderer.shadowMap.enabled = hi;
  renderer.setSize(innerWidth, innerHeight, false);
  for (const m of Object.values(modes)) { m.camera.aspect = innerWidth / innerHeight; m.camera.updateProjectionMatrix(); }
  const traverse = (s) => s && s.traverse(o => { if (o.material) [].concat(o.material).forEach(mm => { mm.needsUpdate = true; }); });
  if (game.mode && game.mode.scene) traverse(game.mode.scene);
}
addEventListener('resize', applyQuality);
applyQuality();

// ---------- Switching modes ----------
game.setMode = async function (name, opts = {}) {
  if (this.busy) return; this.busy = true;
  try {
    if (this.mode) await this.ui.fade(1, 0.3);
    this.ui.closePanel(); this.paused = false; this.onEsc = null;
    if (this.mode && this.mode.exit) this.mode.exit();
    this.modeName = name; this.mode = modes[name];
    this.mode.enter(opts);
    if (name === 'title') showTitle(); else if (name === 'select') showSelect(opts.after);
  } catch (err) {
    // Never leave the player stuck on a blank screen: go back to the start screen.
    console.error(err);
    try { this.modeName = 'title'; this.mode = modes.title; modes.title.enter({}); showTitle(); this.ui.toast('Oops! Something went wrong, so we went back to the start screen.', 4); } catch (_) { /* ignore */ }
  } finally {
    this.busy = false;
    await this.ui.fade(0, 0.45);
  }
};
game.enterDoor = function (levelId, returnTo) {
  this.audio.sfx('door');
  this.lastReturn = returnTo;
  const rl = RETRO_LEVELS[levelId];
  this.setMode(rl ? (rl.pacific ? 'pacific' : rl.war ? 'war' : 'retro') : 'platformer', { level: levelId, returnTo });
};
game.travel = async function (dest) {
  const s = this.saves.explore;
  let opts;
  if (dest === 'home') opts = { area: 'bedroom' };
  else if (dest === 'bbworld') { if (!s.unlocked.bbworld) return; opts = { area: 'bbworld' }; }
  else if (dest === 'cove') opts = { area: 'cove' };
  else if (DOORS.some(d => d.id === dest)) { if (!s.doorsFound.includes(dest)) return; const d = modes.explore.getArea('bbworld').doors.find(x => x.id === dest); opts = { area: 'bbworld', pos: d.front.clone(), yaw: Math.PI }; }
  else return;
  this.ui.closePanel(); this.paused = false;
  this.audio.sfx('paper');
  if (this.modeName === 'explore') {
    await this.ui.fade(1, 0.3); modes.explore.teleport(opts.area, opts.pos, opts.yaw); await this.ui.fade(0, 0.45);
  } else this.setMode('explore', opts);
};
game.leaveLevel = function () {
  const rt = (modes[this.modeName] && modes[this.modeName].returnTo) || { area: 'bbworld' };
  this.setMode('explore', { area: rt.area, pos: rt.pos ? rt.pos.clone() : null, yaw: rt.yaw });
};

// ---------- Menus ----------
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function wire(root, handlers) {
  root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', (e) => { game.audio.init(); game.audio.sfx('ui'); handlers[b.dataset.act] && handlers[b.dataset.act](b, e); }));
}

function showTitle() {
  game.onEsc = null;
  const s = game.saves.explore;
  const has = s.started;
  const root = game.ui.bare(`
    <div class="title-wrap">
      <div style="text-align:center"><h1 class="title">Belly Button Adventure</h1><div class="subtitle">starring Liev &amp; Belly Button</div></div>
      <div class="row">
        <button class="btn big menu-play" data-act="play"><span class="ico">▶</span>${has ? 'Keep playing' : 'Play'}</button>
        ${has ? '<button class="btn menu-new" data-act="new"><span class="ico">🗺️</span>New adventure</button>' : ''}
        <button class="btn menu-chars" data-act="chars"><span class="ico">🐻</span>Characters</button>
        <button class="btn menu-settings" data-act="settings"><span class="ico">⚙️</span>Settings</button>
      </div>
      <div class="version-tag">Version ${VERSION} · ${VERSION_DATE} · new: ${esc(VERSION_NOTE)}</div>
    </div>`);
  wire(root, {
    play: () => { if (!has) game.setMode('select', { mode: 'select', after: 'explore' }); else game.setMode('explore'); },
    new: () => confirmNew(),
    chars: () => game.setMode('select', { mode: 'select', after: 'title' }),
    settings: () => showSettings(() => showTitle()),
  });
}

function confirmNew() {
  const p = game.ui.panel(`<h2>Start a new adventure?</h2><p>This clears the map, doors and stamps.<br>Your character choices stay.</p>
    <div class="row"><button class="btn go" data-act="yes">Yes, start over</button><button class="btn" data-act="no">No, go back</button></div>`);
  game.onEsc = () => showTitle();
  wire(p, {
    yes: () => { resetProgress(); game.ui.closePanel(); game.setMode('select', { mode: 'select', after: 'explore' }); },
    no: () => showTitle(),
  });
}
function resetProgress() {
  game.saves.explore = JSON.parse(JSON.stringify(DEFAULTS.explore)); game.saves.platformer = JSON.parse(JSON.stringify(DEFAULTS.platformer));
  game.writeSave('explore'); game.writeSave('platformer'); Records.clear();
  modes.explore.areas = {}; modes.explore.area = null;
}

function showSelect(after = 'explore') {
  game.selectAfter = after;
  const ch = game.choice, liev = ch.player === 'liev';
  const opt = (group, val, label) => `<button class="btn ${ch[group] === val ? 'sel' : ''}" data-act="set" data-g="${group}" data-v="${val}">${label}</button>`;
  const root = game.ui.bare(`
    <div class="select-wrap">
      <div class="select-panel">
        <h2>Who will you play as?</h2>
        <div class="row">${opt('player', 'liev', 'Liev')}${opt('player', 'bellybutton', 'Belly Button')}</div>
        ${liev ? `
          <h3>Outfit</h3><div class="row">${Object.entries(LIEV.outfits).map(([k, o]) => opt('outfit', k, o.label)).join('')}</div>
          <h3>Hair</h3><div class="row">${Object.entries(LIEV.hairstyles).map(([k, l]) => opt('hair', k, l)).join('')}</div>
          <h3>Captain's hat</h3><div class="row"><button class="btn ${!ch.hat ? 'sel' : ''}" data-act="hat" data-v="0">No hat</button><button class="btn ${ch.hat ? 'sel' : ''}" data-act="hat" data-v="1">Wear the hat</button></div>
        ` : `<p style="font-size:20px">Belly Button is ready! (Outfits for him can come later.)</p>`}
        <p style="font-size:17px;margin-top:12px">Your friend comes along too. Drag to spin around.</p>
      </div>
      <div class="select-name">${liev ? 'Liev' : 'Belly Button'}</div>
      <div class="select-go">${after === 'title' ? '' : '<button class="btn" data-act="back">⬅ Go back</button>'}<button class="btn big go" data-act="go">${after === 'title' ? 'Done' : "Let's go!"}</button></div>
    </div>`);
  wire(root, {
    set: (b) => { ch[b.dataset.g] = b.dataset.v; game.saveLook(); modes.title.rebuild(); showSelect(after); },
    hat: (b) => { ch.hat = b.dataset.v === '1'; game.saveLook(); modes.title.rebuild(); showSelect(after); },
    go: () => {
      if (after === 'title') game.setMode('title');
      else if (after === 'resume' && game.resumeTo) { const r = game.resumeTo; game.resumeTo = null; game.setMode(r.mode, r.opts); }
      else game.setMode('explore');
    },
    back: () => selectBack(after),
  });
  game.onEsc = () => selectBack(after);
}
// "Go back" from the character screen: return to where you came from.
function selectBack(after) {
  if (after === 'resume' && game.resumeTo) { const r = game.resumeTo; game.resumeTo = null; game.setMode(r.mode, r.opts); }
  else game.setMode('title');
}

function pause() {
  if (!PLAY_MODES.includes(game.modeName) || game.busy) return;
  game.paused = true; game.ui.prompt(null);
  const plat = game.modeName !== 'explore';
  const p = game.ui.panel(`<h2>Paused</h2><div class="col">
    <button class="btn go" data-act="resume">Keep playing</button>
    <button class="btn" data-act="map">Map</button>
    ${plat ? '<button class="btn" data-act="leave">Leave this level</button>' : '<button class="btn" data-act="chars">Change character</button>'}
    <button class="btn" data-act="settings">Settings</button>
    <button class="btn" data-act="menu">Main menu</button></div>`);
  wire(p, {
    resume: () => resume(),
    map: () => showMap(true),
    leave: () => game.leaveLevel(),
    chars: () => { modes.explore.saveNow(); game.resumeTo = { mode: 'explore', opts: {} }; game.setMode('select', { mode: 'select', after: 'resume' }); },
    settings: () => showSettings(() => pause()),
    menu: () => { if (game.modeName === 'explore') modes.explore.saveNow(); game.setMode('title'); },
  });
  game.onEsc = () => resume();
}
function resume() { game.ui.closePanel(); game.paused = false; game.onEsc = null; game.mapOpen = false; }

function showSettings(back) {
  const st = game.settings;
  const slider = (k, label) => `<div class="setting"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${st[k]}" data-k="${k}"></div>`;
  const p = game.ui.panel(`<h2>Settings</h2>
    ${slider('music', 'Music')}${slider('effects', 'Sound effects')}${slider('ambience', 'Nature sounds')}
    <div class="setting"><span>Camera speed</span><input type="range" min="0.3" max="2" step="0.1" value="${st.camSpeed}" data-k="camSpeed"></div>
    <div class="setting"><span>Two-finger swipe / scroll wheel</span><span><button class="btn small ${st.wheel === 'orbit' ? 'sel' : ''}" data-act="wheel" data-v="orbit">Turns camera</button><button class="btn small ${st.wheel === 'zoom' ? 'sel' : ''}" data-act="wheel" data-v="zoom">Zooms</button></span></div>
    <div class="setting"><span>Graphics</span><span><button class="btn small ${st.quality !== 'low' ? 'sel' : ''}" data-act="q" data-v="high">Pretty</button><button class="btn small ${st.quality === 'low' ? 'sel' : ''}" data-act="q" data-v="low">Fast</button></span></div>
    <div class="setting"><span>⏱ Race timer in levels</span><span><button class="btn small ${st.timer ? 'sel' : ''}" data-act="timer">${st.timer ? 'On' : 'Off'}</button></span></div>
    <div class="setting"><span>Speed meter (or press F)</span><span><button class="btn small ${st.showFps ? 'sel' : ''}" data-act="fps">${st.showFps ? 'On' : 'Off'}</button></span></div>
    <p style="font-size:17px">Pinch on the trackpad (or press + / −) to zoom. Q / R also turn the camera.</p>
    <p style="font-size:15px;opacity:.75">Version ${VERSION} · ${VERSION_DATE}</p>
    <button class="btn go" data-act="back">Back</button>`);
  p.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => {
    st[r.dataset.k] = parseFloat(r.value); game.audio.setVolumes(st); game.saveSettings();
  }));
  wire(p, {
    wheel: (b) => { st.wheel = b.dataset.v; Input.wheelMode = st.wheel; game.saveSettings(); showSettings(back); },
    q: (b) => { st.quality = b.dataset.v; game.saveSettings(); applyQuality(); showSettings(back); },
    fps: () => { st.showFps = !st.showFps; game.saveSettings(); if (!st.showFps) game.ui.fps(null); showSettings(back); },
    timer: () => { st.timer = !st.timer; game.saveSettings(); if (['platformer', 'retro', 'war', 'pacific'].includes(game.modeName)) modes[game.modeName].updateHud(); showSettings(back); },
    back: () => back(),
  });
  game.onEsc = () => back();
}

function showMap(fromPause = false) {
  if (!PLAY_MODES.includes(game.modeName)) return;
  game.paused = true; game.mapOpen = true; game.ui.prompt(null); game.audio.sfx('paper');
  const s = game.saves.explore, ps = game.saves.platformer;
  const doors = [];
  for (const D of DOORS) if (s.doorsFound.includes(D.id)) doors.push({ id: D.id, name: D.name, place: "Belly Button's World", stamp: ps.stamps.includes(D.id) });
  const p = game.ui.panel(`<h2>Liev's Adventure Map</h2>
    <div class="map-box"><canvas width="1000" height="660"></canvas>${PLACES.map(pl => {
      const open = pl.id === 'home' || (pl.id === 'bbworld' && s.unlocked.bbworld);
      return `<button class="map-spot ${open ? 'open' : 'locked'}" style="left:${pl.x * 100}%;top:${pl.y * 100}%" data-act="${open ? 'go' : 'locked'}" data-id="${pl.id}" title="${esc(pl.name)}"></button>`;
    }).join('')}</div>
    <div class="map-list">${doors.length ? '<b>Doodle Doors found:</b> ' + doors.map(d => `<button class="door-chip" data-act="go" data-id="${d.id}">🚪 ${esc(d.name)} ${d.stamp ? '⭐ stamp!' : ''}</button>`).join('') : 'No Doodle Doors found yet. Explore to find them!'}</div>
    <p style="font-size:18px">Click a colored place (or a door) to travel there.</p>
    <button class="btn go" data-act="close">Close map</button>`);
  const cv = p.querySelector('canvas'); drawAdventureMap(cv.getContext('2d'), 1000, 660, { mode: 'screen', unlocked: s.unlocked, doorsFound: s.doorsFound, stamps: ps.stamps });
  wire(p, {
    go: (b) => game.travel(b.dataset.id),
    locked: (b) => { const pl = PLACES.find(x => x.id === b.dataset.id); game.ui.toast(pl.next ? `${pl.name} is coming in the next update!` : `${pl.name} hasn't been discovered yet.`, 2.5); },
    close: () => closeMap(),
  });
  const closeMap = () => { game.mapOpen = false; if (fromPause) pause(); else resume(); };
  game.onEsc = closeMap; game.closeMap = closeMap;
}

game.showComplete = function (def, got, total, extra = {}) {
  const tm = extra.time;
  const timeHtml = tm ? (tm.record ? `<div class="record">🏆 New record! ${formatTime(tm.t)}</div>${tm.old != null ? `<p>Old best: ${formatTime(tm.old)}</p>` : ''}` : `<p>⏱ Time: <b>${formatTime(tm.t)}</b> &nbsp; (best ${formatTime(tm.old)})</p>`) : '';
  if (tm && tm.record) game.ui.confetti();
  const p = game.ui.panel(`<h1>⭐ Treasure Stamp! ⭐</h1><p><b>${esc(def.name)}</b> is complete!</p><p>${def.collectName === 'Stars' ? '⭐ Stars' : def.collectName === 'Medals' ? '🎖️ Medals' : '🔘 Buttons'}: <b>${got} / ${total}</b> &nbsp; ${def.war ? '🥐' : '🍪'} Treats: <b>${extra.treats ?? 0} / ${extra.treatsTotal ?? 0}</b></p>${timeHtml}
    <div class="row"><button class="btn go big" data-act="back">Back to ${esc(def.place)}</button><button class="btn" data-act="again">Play again</button></div>`, 'clear');
  wire(p, { back: () => game.leaveLevel(), again: () => { const m = modes[game.modeName]; game.setMode(game.modeName, { level: m.levelId, returnTo: m.returnTo }); } });
  game.onEsc = () => game.leaveLevel();
};

// ---------- Secret admin panel ----------
function showAdmin() {
  game.audio.init();
  const wasPlaying = PLAY_MODES.includes(game.modeName);
  if (wasPlaying) game.paused = true;
  const lvl = LEVELS[DOOR1.level];
  const p = game.ui.panel(`<div class="admin"><h2>🔑 Admin Panel</h2>
    <div class="admin-section"><h3>Go anywhere</h3><div class="row">
      <button class="btn" data-act="tp" data-v="home">Liev's Room</button>
      <button class="btn" data-act="tp" data-v="bbworld">Belly Button's World</button>
      <button class="btn" data-act="tp" data-v="cove">Cozy Cove (3D)</button>
      <button class="btn" data-act="tp" data-v="door">Button Hill Door</button>
      <button class="btn" data-act="tp" data-v="door2">Pixel Door</button>
      <button class="btn" data-act="tp" data-v="door3">Time Door (1944)</button>
      <button class="btn" data-act="tp" data-v="door4">Ocean Door (1943)</button></div></div>
    <div class="admin-section"><h3>Platformer: ${esc(lvl.name)}</h3><div class="row">
      ${lvl.checkpoints.map((_, i) => `<button class="btn" data-act="lvl" data-v="${i}">${i === 0 ? 'Start' : 'Rest spot ' + i}</button>`).join('')}</div></div>
    <div class="admin-section"><h3>Retro level: ${esc(RETRO_LEVELS[DOOR2.level].name)}</h3><div class="row">
      <button class="btn" data-act="retro" data-v="0">Start</button><button class="btn" data-act="retro" data-v="1">Rest spot 1</button><button class="btn" data-act="retro" data-v="2">Rest spot 2</button></div></div>
    <div class="admin-section"><h3>${esc(RETRO_LEVELS[DOOR3.level].name)}</h3><div class="row">
      <button class="btn" data-act="war" data-v="0">Start</button>${['Village', 'Bombing raid', 'Church', 'Tank'].map((n, i) => `<button class="btn" data-act="war" data-v="${i + 2}">${n}</button>`).join('')}</div></div>
    <div class="admin-section"><h3>${esc(RETRO_LEVELS[DOOR4.level].name)}</h3><div class="row">
      <button class="btn" data-act="pac" data-v="0">Start</button><button class="btn" data-act="pac" data-v="2">Jungle</button><button class="btn" data-act="pac" data-v="3">Lagoon</button><button class="btn" data-act="pac" data-v="4">Dock</button><button class="btn" data-act="pac" data-v="sub">Submarine</button><button class="btn" data-act="pac" data-v="plane">Fighter plane</button></div></div>
    <div class="admin-section"><h3>Play as</h3><div class="row">
      <button class="btn" data-act="as" data-v="liev">Liev</button><button class="btn" data-act="as" data-v="bellybutton">Belly Button</button></div></div>
    <div class="admin-section"><h3>Progress</h3><div class="row">
      <button class="btn" data-act="unlock">Unlock everything</button>
      <button class="btn" data-act="stamp">Give stamp</button>
      <button class="btn" data-act="reset">Reset all progress</button>
      <button class="btn" data-act="fps">Speed meter on/off</button></div></div>
    <div class="admin-section"><button class="btn go" data-act="close">Close</button></div></div>`);
  const unlock = () => { const s = game.saves.explore; s.unlocked.bbworld = true; s.started = true; for (const D of DOORS) if (!s.doorsFound.includes(D.id)) s.doorsFound.push(D.id); game.writeSave('explore'); };
  wire(p, {
    tp: (b) => { unlock(); game.travel(b.dataset.v === 'door' ? DOOR1.id : b.dataset.v === 'door2' ? DOOR2.id : b.dataset.v === 'door3' ? DOOR3.id : b.dataset.v === 'door4' ? DOOR4.id : b.dataset.v); },
    pac: (b) => { unlock(); const d = modes.explore.getArea('bbworld').doors[3], v = b.dataset.v; game.setMode('pacific', { level: DOOR4.level, checkpoint: isNaN(+v) ? 0 : +v, phase: isNaN(+v) ? v : null, returnTo: { area: 'bbworld', pos: d.front.clone(), yaw: Math.PI } }); },
    war: (b) => { unlock(); const d = modes.explore.getArea('bbworld').doors[2]; game.setMode('war', { level: DOOR3.level, checkpoint: +b.dataset.v, returnTo: { area: 'bbworld', pos: d.front.clone(), yaw: Math.PI } }); },
    retro: (b) => { unlock(); const d = modes.explore.getArea('bbworld').doors[1]; game.setMode('retro', { level: DOOR2.level, checkpoint: +b.dataset.v, returnTo: { area: 'bbworld', pos: d.front.clone(), yaw: Math.PI } }); },
    lvl: (b) => { unlock(); const d = modes.explore.getArea('bbworld').doors[0]; game.setMode('platformer', { level: DOOR1.level, checkpoint: +b.dataset.v, returnTo: { area: 'bbworld', pos: d.front.clone(), yaw: Math.PI } }); },
    as: (b) => { game.choice.player = b.dataset.v; game.saveLook(); game.ui.toast(`Now playing as ${b.dataset.v === 'liev' ? 'Liev' : 'Belly Button'}`, 2); if (game.modeName === 'explore') { modes.explore.buildChars(); game.ui.hud(true, modes.explore.area.title, modes.explore.helpText()); } closeAdmin(); },
    unlock: () => { unlock(); game.ui.toast('Everything unlocked!', 2); },
    stamp: () => { const ps = game.saves.platformer; if (!ps.stamps.includes(DOOR1.id)) ps.stamps.push(DOOR1.id); ps.levels[DOOR1.id] = { done: true, buttons: 0, total: lvl.buttons.length }; game.writeSave('platformer'); game.ui.toast('Stamp given.', 2); },
    reset: () => { resetProgress(); Records.clear(); game.ui.toast('All progress reset.', 2); game.setMode('title'); },
    fps: () => { game.settings.showFps = !game.settings.showFps; game.saveSettings(); if (!game.settings.showFps) game.ui.fps(null); },
    close: () => closeAdmin(),
  });
  game.onEsc = () => closeAdmin();
  function closeAdmin() {
    game.ui.closePanel(); game.onEsc = null;
    if (game.modeName === 'title') showTitle();
    else if (game.modeName === 'select') showSelect(game.selectAfter || 'title');
    else if (game.modeName === 'platformer' && modes.platformer.done) { const pl = modes.platformer; game.showComplete(pl.def, pl.collected.size, pl.def.buttons.length, { treats: pl.rests.treats, treatsTotal: pl.def.checkpoints.length - 1 }); }
    else if (['retro', 'war', 'pacific'].includes(game.modeName) && modes[game.modeName].done) { const r = modes[game.modeName]; game.showComplete({ ...r.def, collectName: r.def.collectName || 'Stars' }, r.collected.size, r.totalStars, { treats: r.rests.treats, treatsTotal: r.restSpots.length }); }
    else game.paused = false;
  }
}

game.ui.onAction = (act) => { game.audio.init(); if (game.busy) return; if (act === 'map') { if (game.mapOpen) game.closeMap(); else if (!game.paused) showMap(); } if (act === 'hint') { if (game.modeName === 'explore') modes.explore.hint(); else Input.pressed.add('KeyH'); } if (act === 'pause' && !game.paused) pause(); };

// ---------- Helpers for the automated tests (run the game faster than real time) ----------
game.sim = function (seconds, keys = [], press = [], fps = 60) {
  const n = Math.max(1, Math.round(seconds * fps)); this.simulating = true;
  for (let i = 0; i < n; i++) {
    Input.down = new Set(keys); if (i === 0) press.forEach(k => Input.pressed.add(k));
    this.mode.update(1 / fps);
    Input.pressed.clear(); Input.drag.dx = Input.drag.dy = 0; Input.wheel.x = Input.wheel.y = Input.wheel.zoom = 0;
  }
  Input.down = new Set(); this.simulating = false;
  return this.state();
};
game.state = function () {
  const s = { mode: this.modeName, paused: this.paused, panel: this.ui.panelOpen };
  if (this.modeName === 'explore') {
    const e = modes.explore; s.area = e.area.name;
    s.p = { x: e.p.pos.x, y: e.p.pos.y, z: e.p.pos.z, onGround: e.p.onGround, yaw: e.p.yaw };
    s.f = { x: e.f.pos.x, y: e.f.pos.y, z: e.f.pos.z };
    s.cam = { x: e.camera.position.x, y: e.camera.position.y, z: e.camera.position.z };
    s.cut = !!e.cut; s.player = e.pc.kind;
  }
  if (this.modeName === 'platformer') {
    const pl = modes.platformer; const p = pl.p;
    s.p = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, climbing: p.climbing, diving: p.diving, floating: p.floating };
    s.checkpoint = pl.checkpoint; s.treats = pl.rests.treats; s.resting = !!pl.resting; s.timer = { on: pl.timer.enabled, started: pl.timer.started, t: pl.timer.t }; s.collected = pl.collected.size; s.done = pl.done; s.bridge = pl.bridgeOn; s.ball = !!pl.ball; s.player = pl.pc.kind;
  }
  if (['retro', 'war', 'pacific'].includes(this.modeName)) {
    const r = modes[this.modeName], p = r.p;
    s.p = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, h: p.h, sliding: p.sliding, ducking: p.ducking, action: p.action, face: p.face };
    s.anim = { name: r.anim.name, row: r.anim.row, col: r.anim.col }; s.stars = r.collected.size; s.totalStars = r.totalStars; s.gateOpen = r.gateOpen;
    s.ball = r.ball ? { x: r.ball.x, y: r.ball.y } : null; s.done = r.done; s.treats = r.rests.treats; s.checkpoint = r.checkpoint.x; s.spriteReady = !!(r.constructor && window.__bbaSprite && window.__bbaSprite.ready);
    if (this.modeName === 'pacific') { s.phase = r.phase; s.kills = r.kills; s.shipsStopped = r.shipsStopped; s.sub = r.sub && { x: r.sub.x, y: r.sub.y }; s.pl = r.pl && { x: r.pl.x, y: r.pl.y, vx: r.pl.vx, vy: r.pl.vy, a: r.pl.a, th: r.pl.th, gear: r.pl.gear, state: r.pl.state, stalled: !!r.pl.stalled }; s.hidden = r.hidden; }
    if (this.modeName === 'war' || this.modeName === 'pacific') Object.assign(s, { hearts: r.hearts, weapon: r.weapon, ammo: { rifle: r.ammo.rifle, grenade: r.ammo.grenade }, hidden: r.hidden, rescued: r.rescued, captured: r.captured,
      enemies: r.enemies.map(e => ({ type: e.type, x: e.x, y: e.y, state: e.state, hp: e.hp })), tank: r.tank && { x: r.tank.x, hp: r.tank.hp, state: r.tank.state }, safe: r.restSpots.map(q => q.x),
      cages: r.cages.map(c => ({ x: c.x, open: c.open })), bullets: r.bullets.length, ebullets: r.ebullets.length, bombs: r.bombs.length, rocks: r.rocks.length, grenadesLive: r.grenadesLive.length, invuln: r.invuln, damageTaken: r.damageTaken,
      crumbles: [...r.crumbles.values()].filter(c => c.state !== 'solid').length });
  }
  s.saves = this.saves;
  return s;
};

// ---------- Main loop ----------
const clock = new THREE.Clock();
let fpsAcc = 0, fpsFrames = 0, worst = 0;
addEventListener('pointerdown', () => game.audio.init());
addEventListener('keydown', () => game.audio.init());

function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta(); const dt = Math.min(raw, 1 / 20);
  // Keys that work everywhere.
  if (Input.typed.endsWith(ADMIN_WORD)) { Input.typed = ''; showAdmin(); }
  if (Input.hit('KeyF')) { game.settings.showFps = !game.settings.showFps; game.saveSettings(); if (!game.settings.showFps) game.ui.fps(null); }
  const playing = PLAY_MODES.includes(game.modeName) && !game.busy;
  // Esc always means "go back" on any screen; during play with nothing open, it pauses.
  if (Input.hit('Escape') && !game.busy) { if (game.onEsc) game.onEsc(); else if (playing && !game.paused) pause(); }
  if (playing && Input.hit('KeyM')) { if (game.mapOpen) game.closeMap(); else if (!game.paused) showMap(); }
  if (game.mode) {
    game.mode.update(dt);
    if (!game.mode.is2d) renderer.render(game.mode.scene, game.mode.camera);
  }
  Input.endFrame();
  // Speed meter.
  fpsAcc += raw; fpsFrames++; worst = Math.max(worst, raw);
  if (fpsAcc > 0.5) {
    if (game.settings.showFps) game.ui.fps(`${Math.round(fpsFrames / fpsAcc)} fps · slowest frame ${(worst * 1000).toFixed(0)} ms`);
    game.fpsNow = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; worst = 0;
  }
}
game.setMode('title');
frame();
