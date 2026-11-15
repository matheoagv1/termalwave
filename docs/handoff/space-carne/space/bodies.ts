import { mat3 } from "gl-matrix";
import { EARTH_RADIUS_KM, projectDirection, projectPoint } from "./camera";
import type { ScreenPoint, SpaceView } from "./camera";
import { icrfToEcef, isPlanet, moonIcrf, phaseAngle, planetIcrf, raDecToVector, sunIcrf, transform } from "./frames";
import type { Vec3 } from "./frames";
import { fitCanvas, layerCanvas } from "./sky";
import type { EphemerisConfig, SpaceHost, SpaceLayer } from "./types";

export { nightPolygon, subsolarPoint } from "./frames";

// sun, moon and planets around the globe from jpl horizons (via /api/ephemeris),
// with the offline formulas of frames.ts while it loads or when it is down.
// 2d canvas in host.back over the sky canvas: the globe hides what is behind it.

export const attribution = "Sol, Luna y planetas: JPL Horizons (NASA/JPL-Caltech); sin conexión: Astronomical Almanac y elementos orbitales de JPL";

const DAY_MS = 86_400_000;
const MAX_DAYS = 6;
const STEP_RAD = 1e-3;
const SUN_RADIUS_KM = 696_000;
const MOON_RADIUS_KM = 1737.4;
const MIN_SUN_PX = 5;
const SUN_GLARE_PX = 70;
const MIN_MOON_PX = 7;
const LABEL_FONT = "11px system-ui, sans-serif";

interface Style {
  name: string;
  color: string;
  px: number;
}

const PLANETS: Record<string, Style> = {
  mercury: { name: "Mercurio", color: "#c9c2b8", px: 2 },
  venus: { name: "Venus", color: "#fff8e6", px: 3.5 },
  mars: { name: "Marte", color: "#ff9a6b", px: 2.5 },
  jupiter: { name: "Júpiter", color: "#f3e3c4", px: 3.2 },
  saturn: { name: "Saturno", color: "#e8d49a", px: 2.8 },
  uranus: { name: "Urano", color: "#b9e6ef", px: 1.8 },
  neptune: { name: "Neptuno", color: "#9db8ff", px: 1.8 },
};

interface Track {
  t0: number;
  step: number;
  // icrf km, xyz per sample
  bodies: Map<string, Float64Array>;
}

interface EphemerisAnswer {
  t0: string;
  step_s: number;
  bodies: Record<string, [number, number, number][]>;
}

function toTrack(a: EphemerisAnswer): Track {
  const bodies = new Map<string, Float64Array>();
  for (const [name, rows] of Object.entries(a.bodies)) {
    const xyz = new Float64Array(rows.length * 3);
    rows.forEach(([ra, dec, km], i) => xyz.set(raDecToVector(ra, dec, km), i * 3));
    bodies.set(name, xyz);
  }
  return { t0: Date.parse(a.t0), step: a.step_s * 1000, bodies };
}

function sample(track: Track, name: string, t: number, out: Vec3): boolean {
  const xyz = track.bodies.get(name);
  if (!xyz) return false;
  const u = (t - track.t0) / track.step;
  const i = Math.floor(u);
  if (i < 0 || (i + 1) * 3 >= xyz.length) return false;
  const f = u - i;
  for (let k = 0; k < 3; k++) out[k] = xyz[i * 3 + k] * (1 - f) + xyz[(i + 1) * 3 + k] * f;
  return true;
}

function offline(name: string, at: Date): Vec3 | null {
  if (name === "sun") return sunIcrf(at);
  if (name === "moon") return moonIcrf(at);
  return isPlanet(name) ? planetIcrf(name, at) : null;
}

export class BodiesLayer implements SpaceLayer {
  readonly id = "bodies";
  private host: SpaceHost | null = null;
  private cfg: EphemerisConfig | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private readonly days = new Map<number, Track | "pending" | "failed">();
  private endpointDown = false;
  private readonly rot = mat3.create();
  private readonly pos = new Map<string, Vec3>();

  mount(host: SpaceHost): void {
    this.host = host;
    this.cfg = host.config.ephemeris;
    this.canvas = layerCanvas(1);
    host.back.append(this.canvas);
  }

  setVisible(on: boolean): void {
    if (this.canvas) this.canvas.style.display = on ? "" : "none";
  }

  /** geocentric icrf km for every configured body at `at` (horizons when loaded, formulas otherwise) */
  positions(at: Date): ReadonlyMap<string, Vec3> {
    const t = at.getTime();
    const track = this.track(t);
    for (const name of Object.keys(this.cfg?.bodies ?? {})) {
      const out = this.pos.get(name) ?? ([0, 0, 0] as Vec3);
      if (track && sample(track, name, t, out)) this.pos.set(name, out);
      else {
        const v = offline(name, at);
        if (v) this.pos.set(name, v);
        else this.pos.delete(name);
      }
    }
    return this.pos;
  }

  private track(t: number): Track | null {
    const day = Math.floor(t / DAY_MS) * DAY_MS;
    const got = this.days.get(day);
    if (got === undefined && !this.endpointDown && this.cfg?.endpoint) void this.fetchDay(day);
    return typeof got === "object" ? got : null;
  }

  private async fetchDay(day: number): Promise<void> {
    this.days.set(day, "pending");
    while (this.days.size > MAX_DAYS) this.days.delete(this.days.keys().next().value!);
    try {
      const r = await fetch(`${this.cfg!.endpoint}?t=${new Date(day).toISOString()}`);
      // dev servers answer unknown /api paths with index.html
      if (!r.ok || !r.headers.get("content-type")?.includes("json")) {
        if (r.status === 404 || r.ok) this.endpointDown = true;
        throw new Error(`ephemeris ${r.status}`);
      }
      this.days.set(day, toTrack((await r.json()) as EphemerisAnswer));
      this.host?.invalidate();
    } catch {
      this.days.set(day, "failed");
    }
  }

  frame(view: SpaceView, now: Date): void {
    const c = this.canvas;
    if (!c) return;
    fitCanvas(c, view);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    ctx.font = LABEL_FONT;
    ctx.textBaseline = "middle";
    icrfToEcef(now, this.rot);
    const pos = this.positions(now);
    const sun = pos.get("sun");

    for (const [name, v] of pos) {
      const style = PLANETS[name];
      if (!style) continue;
      const p = projectDirection(view, transform(this.rot, v));
      if (p.hidden) continue;
      this.dot(ctx, p, style.px, style.color);
      this.label(ctx, p, style.name, style.px + 4);
    }
    const moon = pos.get("moon");
    if (moon && sun) this.drawMoon(ctx, view, moon, sun);
    if (sun) this.drawSun(ctx, view, sun);
  }

  private dot(ctx: CanvasRenderingContext2D, p: ScreenPoint, r: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
    ctx.fill();
  }

  private label(ctx: CanvasRenderingContext2D, p: ScreenPoint, text: string, dx: number): void {
    ctx.fillStyle = "rgba(225, 230, 240, 0.85)";
    ctx.textAlign = "left";
    ctx.fillText(text, p.x + dx, p.y);
  }

  // screen pixels per radian around a direction (fov and zoom differ per pose)
  private pxPerRad(view: SpaceView, d: Vec3, p: ScreenPoint): number {
    const len = Math.hypot(d[0], d[1], d[2]);
    const a = Math.abs(d[2]) < 0.9 * len ? [0, 0, 1] : [1, 0, 0];
    const c = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]];
    const k = STEP_RAD / Math.hypot(c[0], c[1], c[2]);
    const q = projectDirection(view, [d[0] / len + c[0] * k, d[1] / len + c[1] * k, d[2] / len + c[2] * k]);
    return Math.hypot(q.x - p.x, q.y - p.y) / STEP_RAD;
  }

  private drawSun(ctx: CanvasRenderingContext2D, view: SpaceView, sun: Vec3): void {
    const d = transform(this.rot, sun);
    const p = projectDirection(view, d);
    if (p.hidden) return;
    const r = Math.max(MIN_SUN_PX, this.pxPerRad(view, d, p) * (SUN_RADIUS_KM / Math.hypot(sun[0], sun[1], sun[2])));
    const glare = Math.max(SUN_GLARE_PX, r * 6);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glare);
    g.addColorStop(0, "rgba(255, 250, 235, 1)");
    g.addColorStop(r / glare, "rgba(255, 244, 214, 0.95)");
    g.addColorStop(Math.min(0.99, (r / glare) * 2.2), "rgba(255, 214, 150, 0.35)");
    g.addColorStop(1, "rgba(255, 190, 120, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - glare, p.y - glare, glare * 2, glare * 2);
    ctx.restore();
    this.label(ctx, p, "Sol", r + 6);
  }

  // drawn at its real distance from the geocentre, so parallax against the stars is right
  private drawMoon(ctx: CanvasRenderingContext2D, view: SpaceView, moon: Vec3, sun: Vec3): void {
    const e = transform(this.rot, moon);
    const at: Vec3 = [e[0] / EARTH_RADIUS_KM, e[1] / EARTH_RADIUS_KM, e[2] / EARTH_RADIUS_KM];
    const p = projectPoint(view, at);
    if (p.hidden) return;
    const eye = view.eye;
    const fromEye: Vec3 = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]];
    const r = Math.max(MIN_MOON_PX, this.pxPerRad(view, fromEye, p) * ((MOON_RADIUS_KM / EARTH_RADIUS_KM) / Math.hypot(...fromEye)));
    // bright limb faces the sun: project a step from the moon toward it
    const s = transform(this.rot, sun);
    const ms = Math.hypot(s[0] - e[0], s[1] - e[1], s[2] - e[2]);
    const toward = projectPoint(view, [at[0] + (s[0] - e[0]) / ms, at[1] + (s[1] - e[1]) / ms, at[2] + (s[2] - e[2]) / ms]);
    const angle = Math.atan2(toward.y - p.y, toward.x - p.x);
    const k = Math.cos(phaseAngle(moon, sun));

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(38, 42, 52, 1)";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fill();
    // lit half toward +x, closed by the terminator ellipse (semi-axis r*|cos i|)
    ctx.fillStyle = "#ece9e0";
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.ellipse(0, 0, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k < 0);
    ctx.fill();
    ctx.restore();
    this.label(ctx, p, `Luna ${Math.round(((1 + k) / 2) * 100)}%`, r + 5);
  }

  destroy(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.host = null;
    this.days.clear();
  }
}
