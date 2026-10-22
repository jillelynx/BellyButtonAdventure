// Keyboard, mouse and Mac trackpad input.
export const Input = {
  down: new Set(), pressed: new Set(), typed: '',
  drag: { dx: 0, dy: 0, active: false, lastX: 0, lastY: 0 },
  wheel: { x: 0, y: 0, zoom: 0 },
  wheelMode: 'orbit', // 'orbit' (trackpad swipe turns camera) or 'zoom' (mouse wheel zooms)
  init(canvas) {
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      const k = e.code;
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      if (e.key && e.key.length === 1) this.typed = (this.typed + e.key.toLowerCase()).slice(-24);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.down.delete(e.code); });
    addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('pointerdown', (e) => {
      this.drag.active = true; this.drag.lastX = e.clientX; this.drag.lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag.active) return;
      this.drag.dx += e.clientX - this.drag.lastX; this.drag.dy += e.clientY - this.drag.lastY;
      this.drag.lastX = e.clientX; this.drag.lastY = e.clientY;
    });
    const end = () => { this.drag.active = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      let dx = e.deltaX, dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
      if (e.ctrlKey) this.wheel.zoom += dy * 4;            // trackpad pinch
      else if (this.wheelMode === 'zoom') this.wheel.zoom += dy; // mouse wheel
      else { this.wheel.x += dx; this.wheel.y += dy; }     // two-finger swipe
    }, { passive: false });
  },
  endFrame() {
    this.pressed.clear();
    this.drag.dx = this.drag.dy = 0;
    this.wheel.x = this.wheel.y = this.wheel.zoom = 0;
  },
  key(...codes) { return codes.some(c => this.down.has(c)); },
  hit(...codes) { return codes.some(c => this.pressed.has(c)); },
  axis() {
    const x = (this.key('KeyD', 'ArrowRight') ? 1 : 0) - (this.key('KeyA', 'ArrowLeft') ? 1 : 0);
    const y = (this.key('KeyW', 'ArrowUp') ? 1 : 0) - (this.key('KeyS', 'ArrowDown') ? 1 : 0);
    return { x, y };
  },
};
