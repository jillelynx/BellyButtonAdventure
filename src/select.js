// Title screen and character screen (a little stage with the characters on it).
import * as THREE from 'three';
import { Input } from './input.js';
import { buildCharacter, friendOf } from './characters/index.js';
import { gradient, makeCanvas, toTexture } from './textures.js';
import { clamp } from './util.js';

export class Stage {
  constructor(game) {
    this.g = game;
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: gradient([[0, '#BFE0F3'], [0.55, '#FCE9CF'], [1, '#F3EAD8']]) }));
    bg.position.set(0, 3, -8); scene.add(bg);
    scene.add(new THREE.HemisphereLight('#FFF6E8', '#B9A58A', 1.0));
    const key = new THREE.DirectionalLight('#FFE7C4', 2.4); key.position.set(2.5, 5, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 }); key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight('#BFD8FF', 0.9); rim.position.set(-3, 3, -3); scene.add(rim);
    // A round rug to stand on.
    const [rc, rg] = makeCanvas(256, 256);
    for (let i = 8; i > 0; i--) { rg.fillStyle = i % 2 ? '#F2A7B5' : '#FFF8EC'; rg.beginPath(); rg.arc(128, 128, i * 16, 0, 7); rg.fill(); }
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 64), new THREE.MeshStandardMaterial({ color: '#fff', map: toTexture(rc, { wrap: false }), roughness: 1 }));
    rug.position.y = -0.03; rug.receiveShadow = true; scene.add(rug);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: '#E9DDC6', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.06; floor.receiveShadow = true; scene.add(floor);
    this.spin = 0; this.mode = 'title'; this.t = 0;
  }
  enter(opts = {}) {
    this.mode = opts.mode || 'title';
    this.rebuild();
    this.g.audio.music('menu'); this.g.audio.ambience(null);
    this.g.ui.hud(false);
  }
  exit() { }
  rebuild() {
    for (const c of [this.main, this.side]) if (c) { c.root.removeFromParent(); c.dispose(); }
    const ch = this.g.choice;
    this.main = buildCharacter(ch.player, ch); this.side = buildCharacter(friendOf(ch.player), ch);
    for (const c of [this.main, this.side]) c.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.main.root, this.side.root);
  }
  update(dt) {
    this.t += dt;
    const sel = this.mode === 'select';
    this.spin += (Input.drag.dx * 0.01) + (Input.wheel.x * 0.005);
    if (!Input.drag.active) this.spin += dt * (sel ? 0.25 : 0);
    const W = innerWidth, H = innerHeight, narrow = W / H < 1.2;
    if (this.mode === 'title') {
      this.main.root.position.set(-0.45, 0, 0); this.main.root.rotation.y = 0.35 + Math.sin(this.t * 0.6) * 0.1;
      this.side.root.position.set(0.45, 0, 0.05); this.side.root.rotation.y = -0.35 + Math.sin(this.t * 0.6 + 1) * 0.1;
      this.camera.position.set(0, 1.0, 5.6); this.camera.lookAt(0, 0.85, 0);
    } else {
      this.main.root.position.set(0, 0, 0.2); this.main.root.rotation.y = this.spin;
      this.side.root.position.set(1.05, 0, -0.55); this.side.root.rotation.y = -0.5;
      const zoom = clamp(this.camZoom || 4.6, 2.2, 6);
      this.camZoom = clamp(zoom * Math.exp(Input.wheel.zoom * 0.002), 2.2, 6);
      this.camera.position.set(narrow ? 0.3 : -0.9, 1.0, this.camZoom); this.camera.lookAt(narrow ? 0.3 : -0.55, 0.85, 0);
    }
    if (this.debugCam) { this.camera.position.fromArray(this.debugCam[0]); this.camera.lookAt(...this.debugCam[1]); } // used by tests for close-ups
    this.main.animate(dt, { speed: 0, onGround: true }); this.side.animate(dt, { speed: 0, onGround: true, cheer: this.mode === 'title' && Math.sin(this.t * 0.5) > 0.9 });
    this.g.ui.update(dt);
  }
}
