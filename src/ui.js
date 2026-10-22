// On-screen text, buttons and menus (drawn as HTML on top of the 3D view).
export class UI {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="hud" class="hidden">
        <div id="hud-left"></div>
        <div id="hud-right">
          <button class="pill" data-act="map"><b>M</b> Map</button>
          <button class="pill" data-act="hint"><b>H</b> Hint</button>
          <button class="pill" data-act="pause"><b>Esc</b> Menu</button>
        </div>
        <div id="hud-help"></div>
      </div>
      <div id="prompt" class="hidden"></div>
      <div id="edge" class="hidden"></div>
      <div id="arrow" class="hidden"><div>➜</div></div>
      <div id="toast" class="hidden"></div>
      <div id="fps" class="hidden"></div>
      <div id="screen"></div>
      <div id="fade"></div>`;
    this.el = (id) => root.querySelector('#' + id);
    this.toastT = 0; this.arrowT = 0;
    this.onAction = null;
    this.el('hud-right').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && this.onAction) this.onAction(b.dataset.act); });
  }
  hud(show, left = '', help = '') {
    this.el('hud').classList.toggle('hidden', !show);
    if (left !== null) this.el('hud-left').innerHTML = left;
    if (help !== null) this.el('hud-help').innerHTML = help;
  }
  prompt(text) {
    const p = this.el('prompt');
    if (!text) { p.classList.add('hidden'); this.lastPrompt = null; return; }
    if (this.lastPrompt !== text) { p.innerHTML = `<span class="key">E</span> ${text}`; this.lastPrompt = text; }
    p.classList.remove('hidden');
  }
  toast(text, secs = 3.5) { const t = this.el('toast'); t.innerHTML = text; t.classList.remove('hidden'); this.toastT = secs; }
  edge(text) { const e = this.el('edge'); if (!text) { e.classList.add('hidden'); return; } e.textContent = text; e.classList.remove('hidden'); }
  arrow(angle, text, secs = 4) { const a = this.el('arrow'); a.firstElementChild.style.transform = `rotate(${angle - Math.PI / 2}rad)`; a.classList.remove('hidden'); this.arrowT = secs; if (text) this.toast(text, secs); }
  fps(text) { const f = this.el('fps'); if (text === null) f.classList.add('hidden'); else { f.classList.remove('hidden'); f.textContent = text; } }
  fade(to, secs = 0.5, color = '#FFF8EC') {
    const f = this.el('fade'); f.style.background = color; f.style.transition = `opacity ${secs}s ease`; f.style.opacity = to;
    f.style.pointerEvents = to > 0.5 ? 'auto' : 'none';
    return new Promise(r => setTimeout(r, secs * 1000 + 20));
  }
  panel(html, cls = '') {
    const s = this.el('screen');
    s.innerHTML = `<div class="backdrop ${cls}"><div class="panel">${html}</div></div>`;
    return s.querySelector('.panel');
  }
  bare(html) { const s = this.el('screen'); s.innerHTML = html; return s; }
  closePanel() { this.el('screen').innerHTML = ''; }
  get panelOpen() { return this.el('screen').children.length > 0; }
  update(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el('toast').classList.add('hidden'); }
    if (this.arrowT > 0) { this.arrowT -= dt; if (this.arrowT <= 0) this.el('arrow').classList.add('hidden'); }
  }
}
