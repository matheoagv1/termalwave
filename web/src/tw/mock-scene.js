// MockScene: implementa SceneApi con un globo en canvas y un territorio en DOM con perspectiva
import { fbm } from './noise.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ph = (e, a, b) => clamp((e - a) / (b - a), 0, 1);
const RAD = Math.PI / 180;

const LAND = [
  [[-80, -0.5], [-77, 8], [-72, 12], [-62, 10.5], [-52, 5], [-50, -1], [-35, -5], [-39, -15], [-48, -26], [-58, -35], [-65, -41], [-68, -52], [-72, -54], [-74, -45], [-71, -30], [-70, -18], [-76, -14], [-81, -5]],
  [[-168, 66], [-160, 71], [-140, 70], [-120, 70], [-95, 72], [-80, 68], [-62, 60], [-55, 50], [-67, 45], [-76, 38], [-81, 31], [-80, 25], [-83, 29], [-90, 29], [-97, 26], [-97, 20], [-88, 16], [-83, 9], [-78, 8], [-86, 12], [-95, 16], [-105, 21], [-110, 24], [-112, 30], [-118, 33], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]],
  [[-55, 60], [-45, 60], [-20, 70], [-20, 82], [-45, 83], [-65, 80], [-70, 76]],
  [[-17, 15], [-17, 21], [-10, 30], [-6, 35], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [40, -3], [40, -15], [35, -25], [27, -34], [18, -34], [12, -18], [9, -1], [9, 4], [-8, 4], [-14, 10]],
  [[-10, 36], [-9, 43], [-2, 48], [5, 52], [8, 57], [12, 56], [20, 60], [28, 70], [45, 68], [70, 73], [100, 77], [140, 72], [170, 70], [180, 66], [160, 58], [140, 52], [142, 45], [130, 35], [122, 30], [120, 22], [108, 20], [106, 10], [100, 2], [98, 15], [92, 22], [80, 15], [77, 8], [72, 20], [67, 25], [57, 25], [56, 27], [50, 30], [48, 29], [35, 33], [30, 36], [26, 40], [18, 40], [12, 38], [8, 44], [0, 38]],
  [[35, 29], [43, 30], [48, 29], [56, 25], [60, 22], [52, 16], [44, 12], [38, 20]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [140, -38], [131, -31], [115, -34]],
];
function inPoly(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  }
  return c;
}
let DOTS = null;
function dots() {
  if (DOTS) return DOTS;
  DOTS = [];
  for (let la = -80; la <= 84; la += 2.5) for (let lo = -180; lo < 180; lo += 2.5) if (LAND.some((p) => inPoly(lo, la, p))) DOTS.push([lo, la]);
  return DOTS;
}

export class MockScene {
  constructor(o = {}) {
    this.o = Object.assign({ online: true, terrain: true, basemap: true, reducedMotion: false, labels: { curtain: 'Cortina' } }, o);
    this.s = { camera: 'orbit', layer: '', tickId: '', tilt: 35, northUp: true, viewScale: 'campo' };
    this.cbC = new Set(); this.cbP = new Set();
    this.ds = null; this.ticks = {}; this.aspect = 0.884; this.areaLL = [-64.25, -27.8];
    this.pad = { top: 60, right: 20, bottom: 20, left: 460 }; this.padC = { ...this.pad };
    this.p = 0; this.fly = null; this.lon0 = -105; this.lat0 = -15; this.front = 0; this.W = 800; this.H = 600; this.dpr = 1;
    this._dirty = true;
  }

  mount(el) {
    this.el = el;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    const mk = (tag, css, parent = el) => { const n = document.createElement(tag); n.style.cssText = css; parent.appendChild(n); return n; };
    this.gc = mk('canvas', 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab');
    this.g = this.gc.getContext('2d');
    this.stage = mk('div', 'position:absolute;inset:0;perspective:1400px;opacity:0;pointer-events:none');
    this.plane = mk('div', 'position:absolute;pointer-events:none;will-change:transform');
    this.stage.appendChild(this.plane);
    this.base = mk('canvas', 'position:absolute;inset:0;width:100%;height:100%', this.plane);
    this.area = mk('div', 'position:absolute;outline:1px solid var(--scene-outline)', this.plane);
    this.clip = mk('div', 'position:absolute;inset:0;overflow:hidden', this.area);
    const imgCss = 'position:absolute;opacity:0;pointer-events:none;user-select:none;opacity:0;transition:opacity 260ms linear';
    this.imgs = [0, 1].map(() => { const i = mk('img', imgCss, this.clip); i.alt = ''; i.draggable = false; return i; });
    const hatch = 'position:absolute;inset:0;display:none;background:repeating-linear-gradient(135deg,var(--scene-hatch) 0 2px,transparent 2px 6px)';
    this.gap = mk('div', hatch, this.clip);
    this.cmpWrap = mk('div', 'position:absolute;inset:0;display:none;pointer-events:none', this.clip);
    this.cmpGap = mk('div', hatch, this.cmpWrap);
    this.cmpImg = mk('img', imgCss + ';opacity:.92;transition:none', this.cmpWrap); this.cmpImg.alt = ''; this.cmpImg.draggable = false;
    this.handle = mk('div', 'position:absolute;top:0;bottom:0;width:24px;margin-left:-12px;display:none;cursor:ew-resize;touch-action:none;pointer-events:auto', this.area);
    this.handle.tabIndex = 0; this.handle.setAttribute('role', 'slider'); this.handle.setAttribute('aria-label', this.o.labels.curtain);
    this.handle.setAttribute('aria-valuemin', '0'); this.handle.setAttribute('aria-valuemax', '100'); this.handle.setAttribute('data-scene-handle', '1');
    mk('div', 'position:absolute;left:11px;top:0;bottom:0;width:2px;background:var(--acc)', this.handle);
    mk('div', 'position:absolute;left:4px;top:50%;width:12px;height:12px;margin-top:-8px;border:2px solid var(--acc);background:var(--bg)', this.handle);
    this.spotsEl = mk('div', 'position:absolute;inset:0;pointer-events:none', this.area);
    this.probe = mk('div', 'position:absolute;width:1px;height:1px;pointer-events:none', this.area);

    this.gc.addEventListener('pointerdown', (e) => { if (this.p > 0 || this.s.camera !== 'orbit') return; this.drag = { x: e.clientX, y: e.clientY }; this.gc.setPointerCapture(e.pointerId); this.gc.style.cursor = 'grabbing'; });
    this.gc.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const k = 57.3 / (this._R || 300);
      this.lon0 -= (e.clientX - this.drag.x) * k; this.lat0 = clamp(this.lat0 + (e.clientY - this.drag.y) * k, -80, 80);
      this.drag = { x: e.clientX, y: e.clientY }; this._dirty = true;
    });
    const up = () => { this.drag = null; this.gc.style.cursor = 'grab'; };
    this.gc.addEventListener('pointerup', up); this.gc.addEventListener('pointercancel', up);
    this.plane.addEventListener('click', (e) => { if (this.s.camera === 'detail' && !e.target.closest('[data-spot]')) this.cbP.forEach((c) => c(null)); });
    this.handle.addEventListener('pointerdown', (e) => { this.hd = true; this.handle.setPointerCapture(e.pointerId); });
    this.handle.addEventListener('pointermove', (e) => {
      if (!this.hd || !this.s.compare) return;
      const r = this.clip.getBoundingClientRect();
      this._split(clamp((e.clientX - r.left) / r.width, 0, 1));
    });
    this.handle.addEventListener('pointerup', () => { this.hd = false; });
    this.handle.addEventListener('keydown', (e) => {
      if (!this.s.compare) return;
      const d = e.key === 'ArrowLeft' ? -0.05 : e.key === 'ArrowRight' ? 0.05 : 0;
      if (d) { e.preventDefault(); e.stopPropagation(); this._split(clamp(this.s.compare.split + d, 0, 1)); }
    });

    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(el);
    this.refreshStyle();
    this._resize();
    this._apply(performance.now());
    this.raf = requestAnimationFrame(this._loop);
  }

  _split(v) { this.s.compare = { ...this.s.compare, split: v }; this._applyCompare(); this._emit(); }

  _resize() {
    this.W = this.el.clientWidth || 800; this.H = this.el.clientHeight || 600; this.dpr = window.devicePixelRatio || 1;
    this.gc.width = this.W * this.dpr; this.gc.height = this.H * this.dpr; this._dirty = true;
  }

  refreshStyle() {
    const cs = getComputedStyle(this.el), v = (n) => cs.getPropertyValue(n).trim();
    this.col = {};
    ['sphere', 'land', 'grid', 'ground', 'ground-hi', 'line', 'label', 'outline'].forEach((k) => { this.col[k] = v('--scene-' + k); });
    this.col.acc = v('--acc'); this.col.bg = v('--bg');
    this._drawBase(); this._dirty = true;
  }

  _rgb(c) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
  }

  _drawBase() {
    if (!this.base) return;
    const BW = 1200, BH = Math.round(BW / this.aspect), cv = this.base, g = cv.getContext('2d');
    cv.width = BW; cv.height = BH;
    g.fillStyle = this.col.ground; g.fillRect(0, 0, BW, BH);
    if (!this.o.basemap) return;
    if (this.o.terrain) {
      const gw = 150, gh = Math.round(gw / this.aspect), h = [];
      for (let y = 0; y <= gh; y++) { h[y] = []; for (let x = 0; x <= gw; x++) h[y][x] = fbm(x * 0.045, y * 0.045, 21, 4); }
      const a = this._rgb(this.col.ground), b = this._rgb(this.col['ground-hi']);
      const t = document.createElement('canvas'); t.width = gw; t.height = gh;
      const tg = t.getContext('2d'), im = tg.createImageData(gw, gh);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const nw = h[Math.max(0, y - 1)][Math.max(0, x - 1)], se = h[Math.min(gh, y + 1)][Math.min(gw, x + 1)];
        const s = clamp((nw - se) * 7 + 0.5 + (h[y][x] - 0.5) * 0.6, 0, 1), i = (y * gw + x) * 4;
        for (let c = 0; c < 3; c++) im.data[i + c] = lerp(a[c], b[c], s);
        im.data[i + 3] = 255;
      }
      tg.putImageData(im, 0, 0);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(t, 0, 0, BW, BH);
    } else {
      g.fillStyle = this.col.line; g.globalAlpha = 0.25;
      for (let y = 0; y < BH; y += 40) g.fillRect(0, y, BW, 1);
      g.globalAlpha = 1;
    }
    if (!this.ds) return;
    const bd = this.ds.area.bounds, dl = bd.east - bd.west, dt = bd.north - bd.south, k = 0.6;
    const w0 = bd.west - k * dl, n0 = bd.north + k * dt, W = dl * (1 + 2 * k), Ht = dt * (1 + 2 * k);
    g.strokeStyle = this.col.line; g.lineWidth = 1; g.fillStyle = this.col.label; g.font = '13px ui-monospace,Menlo,Consolas,monospace';
    for (let lo = Math.ceil(w0 / 0.05) * 0.05; lo < w0 + W; lo += 0.05) {
      const x = ((lo - w0) / W) * BW; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, BH); g.stroke(); g.fillText(lo.toFixed(2), x + 4, 14);
    }
    for (let la = Math.floor(n0 / 0.05) * 0.05; la > n0 - Ht; la -= 0.05) {
      const y = ((n0 - la) / Ht) * BH; g.beginPath(); g.moveTo(0, y); g.lineTo(BW, y); g.stroke(); g.fillText(la.toFixed(2), 4, y - 4);
    }
  }

  setDataset(ds) {
    this.ds = ds; const b = ds.area.bounds;
    this.aspect = ((b.east - b.west) * Math.cos(ds.area.center[1] * RAD)) / (b.north - b.south);
    this.areaLL = ds.area.center; this.ticks = {};
    ds.segments.forEach((s) => s.ticks.forEach((t) => { this.ticks[t.id] = t; }));
    this._drawBase(); this._applyFrame(); this._applyCompare(); this._dirty = true; this._apply(performance.now());
  }

  _frac(ll) { const b = this.ds ? this.ds.area.bounds : { west: 0, east: 1, south: 0, north: 1 }; return { x: (ll[0] - b.west) / (b.east - b.west), y: (b.north - ll[1]) / (b.north - b.south) }; }

  _place(img, fr) {
    const b = this.ds.area.bounds, fb = fr.bounds, dl = b.east - b.west, dt = b.north - b.south;
    img.style.left = ((fb.west - b.west) / dl) * 100 + '%'; img.style.top = ((b.north - fb.north) / dt) * 100 + '%';
    img.style.width = ((fb.east - fb.west) / dl) * 100 + '%'; img.style.height = ((fb.north - fb.south) / dt) * 100 + '%';
    const m = fr.quality === 'partial' ? 'linear-gradient(90deg,#000 75%,transparent 75%)' : 'none';
    img.style.webkitMaskImage = m; img.style.maskImage = m;
  }

  _applyFrame() {
    if (!this.ds) return;
    const tk = this.ticks[this.s.tickId], fr = tk && tk.frames[this.s.layer];
    const dur = this.o.reducedMotion ? '0ms' : '260ms';
    this.imgs.forEach((i) => { i.style.transitionDuration = dur; });
    const back = this.imgs[1 - this.front], front = this.imgs[this.front];
    if (!fr) { this.imgs.forEach((i) => { i.style.opacity = 0; }); this.gap.style.display = tk ? 'block' : 'none'; return; }
    this.gap.style.display = 'none';
    if (front.getAttribute('src') === fr.url && front.style.opacity !== '0') { this._place(front, fr); return; }
    back.src = fr.url; this._place(back, fr);
    back.style.opacity = 0.92; front.style.opacity = 0; this.front = 1 - this.front;
  }

  _applyCompare() {
    const c = this.s.compare;
    if (!c || !this.ds) { this.cmpWrap.style.display = 'none'; this.handle.style.display = 'none'; return; }
    this.cmpWrap.style.display = 'block'; this.cmpWrap.style.clipPath = `inset(0 ${(1 - c.split) * 100}% 0 0)`;
    this.handle.style.display = 'block'; this.handle.style.left = c.split * 100 + '%';
    this.handle.setAttribute('aria-valuenow', String(Math.round(c.split * 100)));
    const tk = this.ticks[c.tickId], fr = tk && tk.frames[this.s.layer];
    if (fr) { this.cmpImg.src = fr.url; this._place(this.cmpImg, fr); this.cmpImg.style.display = 'block'; this.cmpGap.style.display = 'none'; }
    else { this.cmpImg.style.display = 'none'; this.cmpGap.style.display = 'block'; }
  }

  setHotspots(list) {
    this.spotsEl.textContent = '';
    list.forEach((h) => {
      const f = this._frac(h.lonlat), b = document.createElement('button');
      b.setAttribute('data-spot', h.id); b.setAttribute('aria-label', h.title); b.dataset.ll = h.lonlat.join(',');
      b.style.cssText = `position:absolute;left:${f.x * 100}%;top:${f.y * 100}%;width:32px;height:32px;margin:-16px 0 0 -16px;padding:0;border:0;background:transparent;cursor:pointer;pointer-events:auto;display:flex;align-items:center;justify-content:center`;
      const s = document.createElement('span'); b.appendChild(s);
      b.addEventListener('click', (e) => { e.stopPropagation(); this.cbP.forEach((c) => c(h.id)); });
      this.spotsEl.appendChild(b);
    });
    this._applyFocus();
  }

  _applyFocus() {
    const fl = this.s.focus && this.s.focus.lonlat.join(',');
    this.spotsEl.querySelectorAll('[data-spot]').forEach((b) => {
      const on = b.dataset.ll === fl, s = b.firstChild, z = on ? 16 : 10;
      s.style.cssText = `display:block;width:${z}px;height:${z}px;border:2px solid ${on ? 'var(--acc)' : 'var(--scene-spot)'};background:${on ? 'var(--acc)' : 'transparent'}`;
    });
  }

  setPadding(p) { this.pad = { ...p }; if (this.o.reducedMotion || (this.p >= 0.5 && !this.fly)) this.padC = { ...p }; this._dirty = true; }
  setReducedMotion(on) { this.o.reducedMotion = on; this._dirty = true; }
  getState() { const s = this.s; return { ...s, compare: s.compare ? { ...s.compare } : undefined, focus: s.focus ? { ...s.focus } : undefined }; }
  status() { return { online: this.o.online, terrain: this.o.terrain, basemap: this.o.basemap }; }
  onChange(cb) { this.cbC.add(cb); return () => this.cbC.delete(cb); }
  onPick(cb) { this.cbP.add(cb); return () => this.cbP.delete(cb); }
  _emit() { const st = this.getState(); this.cbC.forEach((c) => c(st)); }

  project(ll) {
    if (!this.ds || parseFloat(this.stage.style.opacity) < 0.02) return null;
    const f = this._frac(ll); this.probe.style.left = f.x * 100 + '%'; this.probe.style.top = f.y * 100 + '%';
    const r = this.probe.getBoundingClientRect(), b = this.el.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top };
  }

  set(n, opt = {}) {
    const s = this.s;
    ['layer', 'tickId', 'tilt', 'northUp', 'viewScale'].forEach((k) => { if (n[k] !== undefined) s[k] = n[k]; });
    if ('compare' in n) { if (n.compare) s.compare = { ...n.compare }; else delete s.compare; }
    if ('focus' in n) { if (n.focus) s.focus = { ...n.focus }; else delete s.focus; }
    if (n.camera && n.camera !== s.camera) {
      if (opt.instant) {
        this.fly = null; this.p = n.camera === 'orbit' ? 0 : n.camera === 'approach' ? 0.55 : 1; s.camera = n.camera;
        if (this.p === 1) { this.lon0 = this.areaLL[0]; this.lat0 = this.areaLL[1]; }
        this.padC = { ...this.pad };
      } else this.flyTo(n.camera);
    }
    this._applyFrame(); this._applyCompare(); this._applyFocus(); this._dirty = true;
    if (opt.instant && this.W) this._apply(performance.now());
    this._emit();
  }

  flyTo(camera) {
    return new Promise((res) => {
      const to = camera === 'orbit' ? 0 : camera === 'approach' ? 0.55 : 1, from = this.p;
      if (this.fly) this.fly.res();
      if (Math.abs(to - from) < 0.001) { this.s.camera = camera; this._emit(); return res(); }
      if (camera !== 'orbit' && camera !== 'approach') this.s.camera = 'approach'; else if (camera === 'orbit') this.s.camera = 'approach';
      else this.s.camera = camera;
      const dur = this.o.reducedMotion ? 300 : (to > from ? 2200 : 1600) * Math.abs(to - from);
      this.fly = { from, to, dur, t0: null, res, final: camera };
      this._emit();
    });
  }

  resetToOrbit() { if (this.s.focus) delete this.s.focus; this._applyFocus(); return this.flyTo('orbit'); }

  _geom() {
    const p = this.padC, fw = Math.max(80, this.W - p.left - p.right), fh = Math.max(80, this.H - p.top - p.bottom);
    const w = Math.min(fw * 0.84, fh * 0.84 * this.aspect);
    return { cx: p.left + fw / 2, cy: p.top + fh / 2, fw, fh, w, h: w / this.aspect };
  }

  _loop = (t) => {
    this.raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.1, (t - (this._t || t)) / 1000); this._t = t;
    const rm = this.o.reducedMotion;
    let moving = false;
    for (const k in this.pad) {
      const d = this.pad[k] - this.padC[k];
      if (rm || Math.abs(d) < 0.5) this.padC[k] = this.pad[k]; else { this.padC[k] += d * 0.14; moving = true; }
    }
    if (this.fly) {
      const f = this.fly; if (f.t0 == null) f.t0 = t;
      const q = clamp((t - f.t0) / Math.max(1, f.dur), 0, 1);
      this.p = lerp(f.from, f.to, q);
      if (q >= 1) {
        this.p = f.to; this.fly = null; this.s.camera = f.final;
        if (this.p === 1) { this.lon0 = this.areaLL[0]; this.lat0 = this.areaLL[1]; }
        this._emit(); f.res();
      }
      this._dirty = true;
    }
    if (this.p === 0 && this.s.camera === 'orbit' && !this.drag) {
      const f = this.s.focus;
      if (f) { this.lon0 += (((f.lonlat[0] - this.lon0 + 540) % 360) - 180) * 0.06; this.lat0 += (f.lonlat[1] - this.lat0) * 0.06; this._dirty = true; }
      else if (!rm) { this.lon0 += 3 * dt; this._dirty = true; }
    }
    if (moving || this._dirty || this.p < 1) { this._apply(t); this._dirty = false; }
  };

  _apply(t) {
    const g = this._geom(), PW = g.w * 2.2, PH = g.h * 2.2, rm = this.o.reducedMotion, e = ease(this.p);
    const pl = this.plane.style;
    pl.left = g.cx - PW / 2 + 'px'; pl.top = g.cy - PH / 2 + 'px'; pl.width = PW + 'px'; pl.height = PH + 'px';
    const a = this.area.style; a.left = (PW - g.w) / 2 + 'px'; a.top = (PH - g.h) / 2 + 'px'; a.width = g.w + 'px'; a.height = g.h + 'px';
    this.stage.style.perspectiveOrigin = `${g.cx}px ${g.cy}px`;
    const sa = rm ? e : ph(e, 0.55, 1), sc = rm ? 1 : lerp(0.55, 1, 1 - Math.pow(1 - sa, 3));
    const tiltEff = this.o.terrain ? this.s.tilt : 0, tl = rm ? tiltEff : tiltEff * sa, br = this.s.northUp ? 0 : -18;
    let z = 1, tx = 0, ty = 0;
    if (this.s.camera === 'detail' && this.s.focus) {
      const boost = this.s.viewScale === 'urbano' ? 1.35 : 1;
      z = (this.s.focus.zoom || 1.7) * boost;
      const f = this._frac(this.s.focus.lonlat);
      tx = (f.x - 0.5) * g.w;
      ty = (f.y - 0.5) * g.h;
    } else if (this.s.camera === 'territory' && this.s.viewScale === 'urbano') {
      z = 1.28;
    }
    pl.transition = this.fly ? 'none' : `transform ${rm ? 0 : 700}ms cubic-bezier(.2,.7,.2,1)`;
    pl.transform = `rotateX(${tl}deg) rotateZ(${br}deg) scale(${sc * z}) translate(${-tx}px,${-ty}px)`;
    this.stage.style.opacity = sa;
    pl.pointerEvents = this.p > 0.98 ? 'auto' : 'none';
    this.gc.style.pointerEvents = this.p === 0 ? 'auto' : 'none';
    this._drawGlobe(g, e, t);
  }

  _drawGlobe(gm, e, t) {
    const c = this.g, rm = this.o.reducedMotion, W = this.W, H = this.H;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, W, H);
    const ga = rm ? 1 - e : 1 - ph(e, 0.7, 1);
    if (ga <= 0.002) return;
    const m = rm ? 0 : ease(ph(e, 0, 0.6)), k = rm ? 1 : 1 + 8 * Math.pow(ph(e, 0.15, 0.8), 3);
    const lon = this.lon0 + (((this.areaLL[0] - this.lon0 + 540) % 360) - 180) * m, lat = lerp(this.lat0, this.areaLL[1], m);
    const R0 = Math.min(gm.fw, gm.fh) * 0.46, R = R0 * k, cx = gm.cx, cy = gm.cy;
    this._R = R0;
    const l0 = lon * RAD, f0 = lat * RAD, s0 = Math.sin(f0), c0 = Math.cos(f0);
    const P = (lo, la) => {
      const l = lo * RAD - l0, f = la * RAD, cf = Math.cos(f), sf = Math.sin(f), cc = s0 * sf + c0 * cf * Math.cos(l);
      return [cx + R * cf * Math.sin(l), cy - R * (c0 * sf - s0 * cf * Math.cos(l)), cc];
    };
    c.globalAlpha = ga;
    c.fillStyle = this.col.sphere; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.clip();
    const gr = c.createRadialGradient(cx, cy, R * 0.55, cx, cy, R); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.32)');
    c.fillStyle = gr; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    c.strokeStyle = this.col.grid; c.lineWidth = 1;
    const line = (pts) => { c.beginPath(); let on = false; pts.forEach((p) => { if (p[2] > 0) { on ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); on = true; } else on = false; }); c.stroke(); };
    for (let la = -60; la <= 60; la += 30) { const pts = []; for (let lo = -180; lo <= 180; lo += 4) pts.push(P(lo, la)); line(pts); }
    for (let lo = -180; lo < 180; lo += 30) { const pts = []; for (let la = -88; la <= 88; la += 4) pts.push(P(lo, la)); line(pts); }
    c.fillStyle = this.col.land; const rd = 1.3 * Math.min(k, 3);
    dots().forEach((d) => { const p = P(d[0], d[1]); if (p[2] > 0.02) { c.globalAlpha = ga * Math.min(1, p[2] * 1.6); c.fillRect(p[0] - rd / 2, p[1] - rd / 2, rd, rd); } });
    c.restore(); c.globalAlpha = ga;
    c.strokeStyle = this.col.line; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke();
    const ap = P(this.areaLL[0], this.areaLL[1]);
    if (ap[2] > 0) {
      const base = 9 * Math.min(k, 2.2), pulse = rm ? 0 : (t / 2000) % 1;
      c.strokeStyle = this.col.acc; c.lineWidth = 2; c.beginPath(); c.arc(ap[0], ap[1], base, 0, 6.2832); c.stroke();
      if (!rm) { c.globalAlpha = ga * (1 - pulse); c.lineWidth = 1; c.beginPath(); c.arc(ap[0], ap[1], base + pulse * 16, 0, 6.2832); c.stroke(); c.globalAlpha = ga; }
    }
    const fo = this.s.focus;
    if (fo && this.p === 0) {
      const fp = P(fo.lonlat[0], fo.lonlat[1]);
      if (fp[2] > 0) { c.strokeStyle = this.col.outline; c.lineWidth = 1; c.beginPath(); c.moveTo(fp[0] - 8, fp[1]); c.lineTo(fp[0] + 8, fp[1]); c.moveTo(fp[0], fp[1] - 8); c.lineTo(fp[0], fp[1] + 8); c.stroke(); }
    }
    c.globalAlpha = 1;
  }

  destroy() { cancelAnimationFrame(this.raf); if (this.ro) this.ro.disconnect(); if (this.el) { [this.gc, this.stage].forEach((n) => n && n.remove()); } this.cbC.clear(); this.cbP.clear(); }
}
