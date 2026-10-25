// EXPLORATION MODE — walk around in 3D with your best friend.
import * as THREE from 'three';
import { Input } from './input.js';
import { buildCharacter, friendOf } from './characters/index.js';
import { buildBedroom } from './areas/bedroom.js';
import { buildBBWorld } from './areas/bbworld.js';
import { buildCove } from './areas/cove.js';
import { clamp, damp, dampAngle, angleDiff } from './util.js';

const AREA_BUILDERS = { bedroom: buildBedroom, bbworld: buildBBWorld, cove: buildCove };
const G = 18, JUMP_V = 6.4, WALK = 3.4, RUN = 6.2, STEP = 0.42, SWIM = 2.5, SWIM_FAST = 3.9;

export class Explore {
  constructor(game) {
    this.g = game;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 600);
    this.areas = {};
    this.cam = { yaw: 0, pitch: 0.32, dist: 4.4, cur: 4.4, manualT: 9 };
    this.p = { pos: new THREE.Vector3(), vel: new THREE.Vector2(), vy: 0, onGround: true, yaw: Math.PI, speed: 0, coyote: 0, buffer: 0, radius: 0.24, floating: false };
    this.f = { pos: new THREE.Vector3(), vel: new THREE.Vector2(), vy: 0, onGround: true, yaw: Math.PI, speed: 0, radius: 0.24, stuckT: 0 };
    this.time = 0; this.cut = null; this.saveT = 0; this.area = null;
    this.tmpV = new THREE.Vector3(); this.tmpD = new THREE.Vector3();
  }
  get scene() { return this.area.scene; }
  getArea(name) { if (!this.areas[name]) this.areas[name] = AREA_BUILDERS[name](this.g); return this.areas[name]; }

  enter(opts = {}) {
    const s = this.g.saves.explore;
    s.started = true;
    let area = opts.area || s.area || 'bedroom';
    if (area === 'bbworld' && !s.unlocked.bbworld && !opts.force) area = 'bedroom';
    this.buildChars();
    const pos = opts.pos || (s.pos && area === s.area && !opts.area ? new THREE.Vector3().fromArray(s.pos) : null);
    this.setArea(area, pos, opts.yaw ?? (pos ? s.yaw : null));
    this.g.ui.hud(true, this.area.title, this.helpText());
  }
  exit() { this.saveNow(); this.g.ui.prompt(null); this.g.ui.edge(null); }
  helpText() {
    const bb = this.g.choice.player === 'bellybutton';
    const extra = this.area && this.area.helpExtra ? ' · ' + this.area.helpExtra : '';
    return `<span class="key">W A S D</span> walk · <span class="key">Shift</span> run · <span class="key">Space</span> jump${bb ? ' (hold to float)' : ''} · <span class="key">E</span> use · <span class="key">C</span> swap friend · drag or swipe to look${extra}`;
  }
  buildChars() {
    for (const c of [this.pc, this.fc]) if (c) { c.root.removeFromParent(); c.dispose(); }
    const ch = this.g.choice;
    this.pc = buildCharacter(ch.player, ch);
    this.fc = buildCharacter(friendOf(ch.player), ch);
    this.p.radius = this.pc.radius; this.f.radius = this.fc.radius;
    if (this.area) { this.area.scene.add(this.pc.root, this.fc.root); }
  }
  swap() {
    const ch = this.g.choice; ch.player = friendOf(ch.player); this.g.saveLook();
    const pp = this.p.pos.clone(), fp = this.f.pos.clone(), py = this.p.yaw, fy = this.f.yaw;
    this.buildChars();
    this.p.pos.copy(fp); this.f.pos.copy(pp); this.p.yaw = fy; this.f.yaw = py;
    this.g.ui.hud(true, this.area.title, this.helpText());
    this.g.ui.toast(`Now playing as <b>${this.pc.name}</b>!`, 2.2);
    this.g.audio.sfx('poof');
  }

  setArea(name, pos = null, yaw = null) {
    const a = this.getArea(name);
    this.area = a;
    a.scene.add(this.pc.root, this.fc.root);
    const p = this.p;
    p.pos.copy(pos || a.spawn.pos); p.pos.y = this.groundAt(p.pos.x, p.pos.z, 99, p.radius, true);
    p.yaw = yaw ?? a.spawn.yaw; p.vy = 0; p.vel.set(0, 0); p.onGround = true;
    // Friend appears just behind you.
    const back = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    this.f.pos.copy(p.pos).addScaledVector(back, 1.3).add(new THREE.Vector3(Math.cos(p.yaw) * 0.7, 0, -Math.sin(p.yaw) * 0.7));
    this.f.pos.y = this.groundAt(this.f.pos.x, this.f.pos.z, 99, this.f.radius, true);
    this.collide(this.f.pos, this.f.radius, this.f.pos.y, false);
    this.f.yaw = p.yaw; this.f.vy = 0;
    p.swimming = false; this.f.swimming = false;
    this.cam.yaw = p.yaw + Math.PI; this.cam.cur = Math.min(this.cam.dist, a.maxCamDist || 7);
    this.g.audio.music(a.music); this.g.audio.ambience(a.ambience);
    const s = this.g.saves.explore; s.area = name; this.saveNow();
    this.g.ui.hud(true, a.title, this.helpText());
    this.g.ui.edge(null);
  }
  teleport(name, pos, yaw) { this.cut = null; this.setArea(name, pos ? pos.clone() : null, yaw); }

  saveNow() {
    const s = this.g.saves.explore;
    if (this.area) { s.area = this.area.name; s.pos = this.p.pos.toArray().map(v => +v.toFixed(2)); s.yaw = +this.p.yaw.toFixed(3); }
    this.g.writeSave('explore');
  }

  // ---- World collision ----
  groundAt(x, z, y, r, snapAnyTop = false) {
    let h = this.area.terrain(x, z);
    for (const c of this.area.circles) if (c.top !== undefined && Math.hypot(x - c.x, z - c.z) < c.r && (snapAnyTop || y >= c.top - STEP)) h = Math.max(h, c.top);
    for (const b of this.area.boxes) if (b.top !== undefined && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && (snapAnyTop || y >= b.top - STEP)) h = Math.max(h, b.top);
    return h;
  }
  collide(pos, r, y, isPlayer) {
    const a = this.area;
    for (const c of a.circles) {
      if (c.top !== undefined && y >= c.top - STEP) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = r + c.r;
      if (d < min) { if (d < 1e-5) { pos.x += min; continue; } pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
    }
    for (const b of a.boxes) {
      if (b.top !== undefined && y >= b.top - STEP) continue;
      const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-5) { pos.x = cx + dx / d * r; pos.z = cz + dz / d * r; }
        else { // centre is inside the box: push out the shortest way
          const pen = [pos.x - b.minX, b.maxX - pos.x, pos.z - b.minZ, b.maxZ - pos.z]; const i = pen.indexOf(Math.min(...pen));
          if (i === 0) pos.x = b.minX - r; if (i === 1) pos.x = b.maxX + r; if (i === 2) pos.z = b.minZ - r; if (i === 3) pos.z = b.maxZ + r;
        }
      }
    }
    // Characters are solid to each other. The friend always steps aside.
    const other = isPlayer ? this.f : this.p;
    const dx = pos.x - other.pos.x, dz = pos.z - other.pos.z, d = Math.hypot(dx, dz), min = r + other.radius;
    if (d < min && Math.abs(y - other.pos.y) < 0.9) { const k = d < 1e-5 ? 1 : 1 / d; pos.x = other.pos.x + dx * k * min; pos.z = other.pos.z + dz * k * min; }
    return a.limit(pos, r);
  }
  moveBody(body, dx, dz, isPlayer) {
    const len = Math.hypot(dx, dz); const n = Math.max(1, Math.ceil(len / 0.08));
    let msg = null;
    for (let i = 0; i < n; i++) {
      body.pos.x += dx / n; body.pos.z += dz / n;
      const m = this.collide(body.pos, body.radius, body.pos.y, isPlayer); if (m) msg = m;
    }
    return msg;
  }
  // Swimming: in water deeper than about chest height you float at the surface.
  // Space swims up, X (or Z) dives down. No air meter: this is a cozy game.
  swimY(body, dt, char, ground) {
    const wl = this.area.waterLevel; if (wl === undefined) return false;
    const floatY = wl - char.height * 0.62;
    const deep = ground < floatY - 0.05;
    if (!deep || (!body.swimming && body.pos.y > floatY + 0.02)) { body.swimming = false; return false; }
    if (!body.swimming) { body.swimming = true; if (body.vy < -3) { this.g.audio.sfx('splash'); this.area.splash && this.area.splash(body.pos); } body.vy *= 0.25; }
    let vyT;
    if (body === this.p) vyT = Input.key('Space') ? 2.4 : Input.key('KeyX', 'KeyZ', 'ControlLeft') ? -2.4 : (body.pos.y < floatY - 0.05 ? 0.8 : 0);
    else { const ty = this.p.swimming ? Math.min(this.p.pos.y, floatY) : floatY; vyT = clamp((ty - body.pos.y) * 2, -2.4, 2.4); }
    body.vy = damp(body.vy, vyT, 5, dt); body.pos.y += body.vy * dt;
    if (body.pos.y > floatY) { body.pos.y = floatY; if (body.vy > 0) body.vy = 0; }
    if (body.pos.y < ground + 0.05) { body.pos.y = ground + 0.05; body.vy = Math.max(0, body.vy); }
    body.onGround = false;
    return true;
  }
  physicsY(body, dt, char) {
    const ground = this.groundAt(body.pos.x, body.pos.z, body.pos.y, body.radius);
    if (this.swimY(body, dt, char, ground)) return;
    if (body.onGround && body.vy <= 0 && body.pos.y - ground < STEP && body.pos.y - ground > -STEP) { body.pos.y = ground; body.vy = 0; return; }
    body.vy -= G * dt; body.pos.y += body.vy * dt;
    if (body.pos.y <= ground) {
      if (!body.onGround) { const s = clamp(-body.vy / 10, 0.2, 1); char.land(s); if (body === this.p && body.vy < -4) this.g.audio.sfx(char.kind === 'bellybutton' ? 'squish' : 'land'); }
      body.pos.y = ground; body.vy = 0; body.onGround = true;
    } else if (body.pos.y > ground + 0.02) body.onGround = false;
  }

  // ---- Main update ----
  update(dt) {
    this.time += dt;
    const a = this.area, p = this.p, f = this.f, ui = this.g.ui;
    const paused = this.g.paused;
    if (!paused) {
      this.overridden = !this.cut && a.camOverride && a.camOverride(dt, this);   // e.g. stargazing: the area drives the camera
      if (this.cut) this.updateCutscene(dt);
      else if (!this.overridden) this.updatePlayer(dt);
      this.updateFriend(dt);
      if (!this.cut && !this.overridden) this.updateInteract();
      if (a.keys) for (const k in a.keys) if (Input.hit(k)) a.keys[k](this);
      a.update(dt, { player: p, friend: f, time: this.time, camera: this.camera, explore: this, stamps: this.g.saves.platformer.stamps, doorsFound: this.g.saves.explore.doorsFound });
      this.saveT += dt; if (this.saveT > 4) { this.saveT = 0; this.saveNow(); }
    }
    if (!this.cut && !this.overridden) this.updateCamera(dt, paused);
    // Place and animate characters.
    for (const [c, b] of [[this.pc, p], [this.fc, f]]) {
      c.root.position.copy(b.pos); c.root.rotation.order = 'YXZ'; c.root.rotation.y = b.yaw;
      // Swimming: lean forward (more when diving) and bob gently at the surface.
      const lean = b.swimming ? (b.vy < -0.6 ? 0.95 : b.speed > 0.5 ? 0.55 : 0.12) : 0;
      c.root.rotation.x = damp(c.root.rotation.x, lean, 6, dt);
      if (b.swimming) c.root.position.y += Math.sin(this.time * 2.2 + (b === p ? 0 : 1.7)) * 0.035;
      // Liev puts on swim gear: a snorkel at the surface, scuba gear as soon as he dives.
      if (c.setGear) { const wl = this.area.waterLevel; c.setGear(b.swimming && wl !== undefined ? (b.pos.y < wl - c.height * 0.62 - 0.2 ? 'scuba' : 'snorkel') : null); }
      if (!paused) c.animate(dt, { speed: b.speed, onGround: b.onGround, floating: b.floating, cheer: b.cheer, swimming: b.swimming });
    }
    ui.update(paused ? 0 : dt);
  }

  updatePlayer(dt) {
    const p = this.p, ui = this.g.ui, bb = this.pc.kind === 'bellybutton';
    if (Input.hit('KeyC')) { this.swap(); return; }
    const ax = Input.axis();
    const yaw = this.cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let dx = rx * ax.x + fx * ax.y, dz = rz * ax.x + fz * ax.y;
    const l = Math.hypot(dx, dz); if (l > 1) { dx /= l; dz /= l; }
    const fast = Input.key('ShiftLeft', 'ShiftRight');
    const max = p.swimming ? (fast ? SWIM_FAST : SWIM) : fast ? RUN : WALK;
    const k = p.onGround ? 14 : p.swimming ? 4 : 5;
    p.vel.x = damp(p.vel.x, dx * max, k, dt); p.vel.y = damp(p.vel.y, dz * max, k, dt);
    if (l > 0.1) p.yaw = dampAngle(p.yaw, Math.atan2(dx, dz), 12, dt);
    // Jump with forgiving timing (coyote time + jump buffer).
    p.buffer = Input.hit('Space') ? 0.14 : p.buffer - dt;
    p.coyote = p.onGround ? 0.12 : p.coyote - dt;
    if (p.buffer > 0 && p.coyote > 0) { p.vy = JUMP_V; p.onGround = false; p.buffer = 0; p.coyote = 0; this.g.audio.sfx('jump'); }
    if (!Input.key('Space') && p.vy > 0) p.vy -= G * 0.9 * dt; // short hop if released early
    p.floating = bb && !p.onGround && p.vy < 0 && Input.key('Space');
    if (p.floating) p.vy = Math.max(p.vy, -2.2);
    const before = this.tmpV.copy(p.pos);
    const msg = this.moveBody(p, p.vel.x * dt, p.vel.y * dt, true);
    this.physicsY(p, dt, this.pc);
    p.speed = Math.hypot(p.pos.x - before.x, p.pos.z - before.z) / Math.max(dt, 1e-4);
    ui.edge(msg);
    if (Input.hit('KeyH')) this.hint();
  }

  updateFriend(dt) {
    const p = this.p, f = this.f;
    const fwdX = Math.sin(p.yaw), fwdZ = Math.cos(p.yaw);
    const tx = p.pos.x - fwdX * 1.35 + fwdZ * 0.75, tz = p.pos.z - fwdZ * 1.35 - fwdX * 0.75;
    let dx = tx - f.pos.x, dz = tz - f.pos.z; const d = Math.hypot(dx, dz);
    const distP = Math.hypot(p.pos.x - f.pos.x, p.pos.z - f.pos.z);
    if (distP > 22 && !this.cut) { // got left far behind: hop back to you
      f.pos.set(tx, 0, tz); this.collide(f.pos, f.radius, 99, false); f.pos.y = this.groundAt(f.pos.x, f.pos.z, 99, f.radius, true); f.vy = 0; return;
    }
    let speed = d > 4 ? RUN : d > 0.5 ? WALK * Math.min(1, d / 1.4) : 0;
    if (f.swimming) speed = Math.min(speed, SWIM_FAST);
    let vx = d > 1e-3 ? dx / d * speed : 0, vz = d > 1e-3 ? dz / d * speed : 0;
    // Step out of the way if you walk into them.
    if (distP < 1.3 && d > 0.5) { // you're in the way: curve around you instead of pushing
      const sx = -(p.pos.z - f.pos.z), sz = p.pos.x - f.pos.x, sl = Math.hypot(sx, sz) || 1, side = (sx * dx + sz * dz) >= 0 ? 1 : -1;
      vx += sx / sl * side * speed * 0.8; vz += sz / sl * side * speed * 0.8;
    }
    if (distP < 0.95) { const k = 2.6 / Math.max(distP, 0.1); vx += (f.pos.x - p.pos.x) * k; vz += (f.pos.z - p.pos.z) * k; }
    f.vel.x = damp(f.vel.x, vx, 8, dt); f.vel.y = damp(f.vel.y, vz, 8, dt);
    const before = this.tmpD.copy(f.pos);
    this.moveBody(f, f.vel.x * dt, f.vel.y * dt, false);
    const moved = Math.hypot(f.pos.x - before.x, f.pos.z - before.z);
    // Blocked by something low (like the bed)? Jump.
    if (speed > 1 && moved < speed * dt * 0.3 && f.onGround && distP > 1.3) { f.stuckT += dt; if (f.stuckT > 0.25) { f.vy = JUMP_V; f.onGround = false; f.stuckT = 0; } } else f.stuckT = 0;
    this.physicsY(f, dt, this.fc);
    f.speed = moved / Math.max(dt, 1e-4);
    const faceYaw = f.speed > 0.4 ? Math.atan2(f.pos.x - before.x, f.pos.z - before.z) : Math.atan2(p.pos.x - f.pos.x, p.pos.z - f.pos.z);
    f.yaw = dampAngle(f.yaw, faceYaw, 6, dt);
  }

  updateInteract() {
    const a = this.area, p = this.p, s = this.g.saves.explore;
    // Discover doors when you get close.
    for (const d of a.doors || []) {
      if (!s.doorsFound.includes(d.id) && p.pos.distanceTo(this.tmpV.set(d.x, p.pos.y, d.z)) < 8) {
        s.doorsFound.push(d.id); this.saveNow();
        this.g.ui.toast('You found a <b>Doodle Door</b>! It is on your map now (press <b>M</b>).', 4.5);
        this.g.audio.sfx('found');
      }
    }
    let best = null, bd = Infinity;
    for (const it of a.interact) { const dd = Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z); if (dd < it.r && dd < bd) { best = it; bd = dd; } }
    this.g.ui.prompt(best ? best.prompt() : null);
    if (best && Input.hit('KeyE')) this.doAction(best);
  }
  doAction(it) {
    const g = this.g;
    if (it.action === 'mapMagic') this.startMapMagic();
    else if (it.action === 'door') g.enterDoor(it.door, { area: this.area.name, pos: this.area.doors.find(d => d.id === it.door).front.clone(), yaw: Math.PI });
    else if (it.action === 'westcork') { g.ui.toast("This page isn't colored in yet. West Cork opens in the next update!", 4); g.audio.sfx('paper'); }
    else if (it.action === 'home') g.travel('home');
    else if (it.action === 'travel') g.travel(it.dest);
    else if (it.action === 'fn') it.fn(this);
  }

  startMapMagic() {
    this.cut = { type: 'mapMagic', t: 0, flashed: false, startPos: this.camera.position.clone(), startLook: this.p.pos.clone().add(new THREE.Vector3(0, 1.1, 0)) };
    this.g.ui.prompt(null); this.g.audio.sfx('magic');
    this.g.ui.toast("Belly Button's belly button is glowing...!", 2.5);
  }
  updateCutscene(dt) {
    const c = this.cut; c.t += dt;
    const bbChar = this.pc.kind === 'bellybutton' ? this.pc : this.fc;
    bbChar.glow = Math.min(1, c.t / 0.8) * (0.75 + 0.25 * Math.sin(c.t * 14));
    this.p.speed = 0; this.p.vel.set(0, 0);
    const look = this.area.mapLook;
    const k = Math.min(1, c.t / 1.6), e = k * k * (3 - 2 * k);
    this.camera.position.lerpVectors(c.startPos, look.cam, e);
    const lk = this.tmpV.lerpVectors(c.startLook, look.target, e); this.camera.lookAt(lk);
    this.fc.root.visible = true;
    if (c.t > 1.7 && !c.flashed) { c.flashed = true; this.g.ui.fade(1, 0.5, '#FFF6DA'); }
    if (c.t > 2.35) {
      bbChar.glow = 0; this.cut = null;
      this.g.saves.explore.unlocked.bbworld = true;
      this.setArea('bbworld');
      this.g.ui.fade(0, 1.2, '#FFF6DA');
      this.g.ui.toast("Whoa! We jumped <b>inside the map</b>! Welcome to Belly Button's World!", 5);
      this.g.audio.sfx('door');
    }
  }

  hint() {
    const a = this.area; const goals = a.goals({ stamps: this.g.saves.platformer.stamps, doorsFound: this.g.saves.explore.doorsFound });
    if (!goals.length) return;
    // Point at the nearest goal.
    let g0 = goals[0], bd = Infinity; for (const gg of goals) { const d = this.p.pos.distanceTo(gg.pos); if (d < bd) { bd = d; g0 = gg; } }
    const ang = Math.atan2(g0.pos.x - this.p.pos.x, g0.pos.z - this.p.pos.z);
    const camFwd = Math.atan2(-Math.sin(this.cam.yaw), -Math.cos(this.cam.yaw));
    const rel = angleDiff(camFwd, ang); // 0 = straight ahead
    this.g.ui.arrow(-rel, g0.text, 5);
    this.g.audio.sfx('ui');
  }

  updateCamera(dt, paused) {
    const c = this.cam, s = this.g.settings.camSpeed, a = this.area;
    const manual = Input.drag.dx || Input.drag.dy || Input.wheel.x || Input.wheel.y;
    c.yaw -= (Input.drag.dx * 0.006 + Input.wheel.x * 0.004) * s;
    c.pitch = clamp(c.pitch + (Input.drag.dy * 0.004 + Input.wheel.y * 0.003) * s, -0.15, 1.2);
    if (Input.key('KeyQ')) c.yaw += 2 * dt * s; if (Input.key('KeyR')) c.yaw -= 2 * dt * s;
    const z = Input.wheel.zoom + (Input.key('Equal', 'NumpadAdd') ? -300 * dt : 0) + (Input.key('Minus', 'NumpadSubtract') ? 300 * dt : 0);
    c.dist = clamp(c.dist * Math.exp(z * 0.0025), 1.6, a.maxCamDist || 7);
    c.manualT = manual ? 0 : c.manualT + dt;
    // Gently swing behind you while you walk (only after you stop steering the camera).
    if (!paused && c.manualT > 2 && this.p.speed > 1) c.yaw = dampAngle(c.yaw, this.p.yaw + Math.PI, 0.8, dt);
    const h = this.pc.height;
    const target = this.tmpV.set(this.p.pos.x, this.p.pos.y + h * 0.85, this.p.pos.z);
    const dir = this.tmpD.set(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
    // When falling a long way, tilt down so you can see where you'll land.
    if (this.p.vy < -6) { c.pitch = damp(c.pitch, 0.8, 2, dt); }
    const allowed = a.camLimit(target, dir, c.dist);
    c.cur = allowed < c.cur ? allowed : damp(c.cur, allowed, 4, dt);
    this.camera.position.copy(target).addScaledVector(dir, c.cur);
    this.camera.lookAt(target);
  }
}
