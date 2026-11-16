import type { SpaceView } from "./camera";
import { lonLatToEcef, projectPoint } from "./camera";
import type { SpaceHost, SpaceLayer } from "./types";

// particle wind field over the globe: advect in lon/lat, hide behind earth,
// fade out at study zoom so terrain stays readable

export interface WindSample {
  lat: number;
  lon: number;
  u_east: number;
  v_north: number;
  speed_kmh: number;
}

type Particle = { lon: number; lat: number; age: number; life: number };

const N_PARTICLES = 900;
const DEG_PER_KMH_S = 0.000012; // soft step so streaks stay readable
const MAX_AGE = 90;
const FADE_ZOOM = 7.5;

export class WindLayer implements SpaceLayer {
  readonly id = "wind";
  private host: SpaceHost | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private visible = false;
  private samples: WindSample[] = [];
  private particles: Particle[] = [];
  private fetchGen = 0;
  private lastFetch = 0;
  private lastBbox = "";
  private lastStep = 0;

  mount(host: SpaceHost): void {
    this.host = host;
    const c = document.createElement("canvas");
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    host.front.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext("2d");
    this.seedParticles();
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (this.canvas) this.canvas.style.display = on ? "block" : "none";
    if (on) void this.refresh(true);
    else this.samples = [];
  }

  frame(view: SpaceView, _now: Date): void {
    if (!this.visible || !this.canvas || !this.ctx || !this.host) return;
    const t = performance.now();
    if (t - this.lastStep < 33) {
      this.host.invalidate();
      return;
    }
    this.lastStep = t;
    const map = this.host.map;
    const z = map.getZoom();
    const alpha = z >= FADE_ZOOM ? Math.max(0, 1 - (z - FADE_ZOOM) / 2.5) : 1;
    if (alpha <= 0.02) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    void this.refresh(false);
    this.fit(view);
    this.step(view, alpha);
  }

  destroy(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.host = null;
    this.samples = [];
    this.particles = [];
  }

  private fit(view: SpaceView): void {
    const c = this.canvas!;
    const w = Math.max(1, Math.floor(view.width * view.pixelRatio));
    const h = Math.max(1, Math.floor(view.height * view.pixelRatio));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  }

  private seedParticles(): void {
    this.particles = [];
    for (let i = 0; i < N_PARTICLES; i++) {
      this.particles.push({
        lon: Math.random() * 360 - 180,
        lat: Math.random() * 140 - 70,
        age: Math.random() * MAX_AGE,
        life: MAX_AGE * (0.5 + Math.random() * 0.5),
      });
    }
  }

  private async refresh(force: boolean): Promise<void> {
    if (!this.host || !this.visible) return;
    const now = Date.now();
    if (!force && now - this.lastFetch < 60_000) return;
    const b = this.host.map.getBounds();
    const pad = 8;
    const west = Math.max(-180, b.getWest() - pad);
    const east = Math.min(180, b.getEast() + pad);
    const south = Math.max(-85, b.getSouth() - pad);
    const north = Math.min(85, b.getNorth() + pad);
    const bbox = [west, south, east, north].map((n) => n.toFixed(1)).join(",");
    if (!force && bbox === this.lastBbox && this.samples.length) return;
    this.lastBbox = bbox;
    this.lastFetch = now;
    const gen = ++this.fetchGen;
    const endpoint = this.host.config.wind?.endpoint || "/api/wind";
    try {
      const r = await fetch(`${endpoint}?bbox=${bbox}`, { credentials: "same-origin" });
      if (!r.ok) return;
      const data = (await r.json()) as { samples?: WindSample[] };
      if (gen !== this.fetchGen) return;
      this.samples = Array.isArray(data.samples) ? data.samples : [];
    } catch {
      /* keep previous field */
    }
  }

  private sampleUv(lon: number, lat: number): { u: number; v: number } | null {
    if (!this.samples.length) return null;
    let best: WindSample | null = null;
    let bestD = Infinity;
    for (const s of this.samples) {
      const dlon = Math.abs(((s.lon - lon + 540) % 360) - 180);
      const dlat = Math.abs(s.lat - lat);
      const d = dlon * dlon + dlat * dlat;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (!best || bestD > 400) return null;
    return { u: best.u_east, v: best.v_north };
  }

  private step(view: SpaceView, alpha: number): void {
    const ctx = this.ctx!;
    const c = this.canvas!;
    const pr = view.pixelRatio;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = Math.max(1, pr * 1.1);
    ctx.strokeStyle = `rgba(220, 235, 255, ${0.55 * alpha})`;
    ctx.beginPath();
    for (const p of this.particles) {
      const uv = this.sampleUv(p.lon, p.lat);
      if (uv) {
        p.lon += uv.u * DEG_PER_KMH_S;
        p.lat += uv.v * DEG_PER_KMH_S;
        if (p.lon > 180) p.lon -= 360;
        if (p.lon < -180) p.lon += 360;
        p.lat = Math.max(-80, Math.min(80, p.lat));
      }
      p.age += 1;
      if (p.age > p.life || !uv) {
        p.lon = Math.random() * 360 - 180;
        p.lat = Math.random() * 140 - 70;
        p.age = 0;
        p.life = MAX_AGE * (0.5 + Math.random() * 0.5);
        continue;
      }
      const ecef = lonLatToEcef(p.lon, p.lat, 8);
      const scr = projectPoint(view, ecef);
      if (scr.hidden) continue;
      const x = scr.x * pr;
      const y = scr.y * pr;
      const len = 4 + Math.min(18, Math.hypot(uv.u, uv.v) * 0.25);
      const ang = Math.atan2(-uv.v, uv.u);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len * pr, y + Math.sin(ang) * len * pr);
    }
    ctx.stroke();
    this.host?.invalidate();
  }
}
