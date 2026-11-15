import type maplibregl from "maplibre-gl";
import { eciToGeodetic, gstime, json2satrec, propagate, type OMMJsonObject, type SatRec } from "satellite.js";
import { lonLatToEcef, occludedByEarth, type SpaceView } from "./camera";
import {
  findPass,
  footprintAngle,
  footprintRing,
  periodMs,
  sampleTrack,
  splitLine,
  subpoint,
  swathEdges,
  swathQuads,
  toLonLat,
  type Bounds,
  type Pass,
  type Sensor,
  type SensorKind,
} from "./satellites-geometry";
import type { SatellitesConfig, SpaceHost, SpaceLayer } from "./types";

export type { Bounds, Pass, Sensor, SensorKind } from "./satellites-geometry";

export const attribution = "Órbitas: CelesTrak (elementos GP) · propagación satellite.js (SGP4) · sensores: NASA/JPL, CONAE, ESA, JAXA, CSA, DLR, NOAA, EUMETSAT";

export interface SatellitesOptions {
  groups: string[];
  /** imaged strip on the ground and the radar beam from the satellite */
  swath: boolean;
  /** radio visibility circle of the selected satellite */
  footprint: boolean;
  /** ground track and orbit ring of highlighted and selected satellites */
  tracks: boolean;
  labels: boolean;
}

export interface SatelliteInfo {
  name: string;
  norad: number;
  group: string;
  kind: SensorKind;
  highlighted: boolean;
  selected: boolean;
  sensor: string | null;
  band: string | null;
  swathKm: number | null;
}

interface SensorEntry extends Sensor {
  match: { norad?: number[]; name?: string };
}

interface SensorPack {
  group_kind: Record<string, SensorKind>;
  entries: SensorEntry[];
}

interface GroupDoc {
  group: string;
  day: string;
  satellites: { name: string; norad: number; omm: OMMJsonObject }[];
}

interface Sat {
  name: string;
  norad: number;
  group: string;
  rec: SatRec;
  sensor: Sensor | null;
  kind: SensorKind;
  highlight: boolean;
  period: number;
}

interface Ring {
  at: number;
  gmst: number;
  // ecef earth radii at bake time, rotated with the earth on draw
  pts: Float64Array;
}

const STEP_MS = 250;
const GROUND_MS = 1000;
const RING_REBAKE_MS = 10 * 60_000;
const RING_SAMPLES = 180;
const TRACK_STEP_MS = 30_000;
const PASS_HORIZON_MS = 12 * 86400_000;
const ARCHIVE_AFTER_MS = 3 * 86400_000;
const PICK_PX = 10;
const SWATH_BINS = 5;
const DEG = Math.PI / 180;
const SRC = { track: "tw-sat-track", swath: "tw-sat-swath", footprint: "tw-sat-footprint" } as const;
const LAYERS = ["tw-sat-swath", "tw-sat-footprint-fill", "tw-sat-footprint-line", "tw-sat-track"] as const;

function kindColor(k: SensorKind): string {
  switch (k) {
    case "sar":
      return "#ffc24d";
    case "optical":
      return "#6fd3ff";
    case "weather":
      return "#8fe388";
    case "comm":
      return "#c3a3ff";
    case "crew":
      return "#ff7b6b";
    default: {
      const never: never = k;
      return never;
    }
  }
}

// NISAR: color propio, no el kindColor SAR compartido
const NISAR_COLOR = "#ff6b1a";
const NISAR_PULSE_MS = 1500;

function isNisar(name: string): boolean {
  return name === "NISAR";
}

function satColor(name: string, kind: SensorKind): string {
  return isNisar(name) ? NISAR_COLOR : kindColor(kind);
}

function reducedMotionOn(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 0.55..1 over ~1.5s; static 1 when reduced motion */
function nisarPulse(tMs: number, reduced: boolean): number {
  if (reduced) return 1;
  const p = (Math.sin((tMs / NISAR_PULSE_MS) * Math.PI * 2) + 1) / 2;
  return 0.55 + 0.45 * p;
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

const empty = (): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: [] });

/**
 * Satellites around the globe: every satellite of the configured celestrak
 * groups propagated with sgp4, highlighted ones with orbit ring, label, radar
 * beam, and on the ground their track and imaged strip; the selected one also
 * shows its radio visibility circle. Positions are sampled at 4 hz and
 * interpolated per frame.
 */
export class SatellitesLayer implements SpaceLayer {
  readonly id = "satellites";
  /** called when a click on the globe picks (or a call to select changes) a satellite */
  onSelect: ((name: string | null) => void) | null = null;

  private host!: SpaceHost;
  private cfg!: SatellitesConfig;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private opts: SatellitesOptions;
  private sensors: SensorPack | null = null;
  private sats: Sat[] = [];
  private byName = new Map<string, number>();
  private selected: number | null = null;
  private visible = true;

  private a = new Float64Array(0);
  private b = new Float64Array(0);
  private cur = new Float64Array(0);
  private screen = new Float32Array(0);
  private ta = NaN;
  private tb = NaN;
  private rings = new Map<number, Ring>();
  private beams = new Map<number, [number, number, number][]>();
  private readonly p: [number, number, number] = [0, 0, 0];
  private readonly xy = new Float32Array(6);

  private groundAt = NaN;
  private groundWall = 0;
  private groundDirty = true;
  private lastNow = NaN;
  private loadedDay = "latest";
  private loading: Promise<void> | null = null;
  private failedDays = new Set<string>();
  private passes = new Map<number, { from: number; pass: Pass | null }>();

  private readonly onClick = (e: maplibregl.MapMouseEvent) => this.pick(e.point.x, e.point.y);
  private readonly onStyle = () => this.addMapLayers();

  constructor(private readonly aoi: Bounds | null = null, opts: Partial<SatellitesOptions> = {}) {
    this.opts = { groups: [], swath: true, footprint: true, tracks: true, labels: true, ...opts };
  }

  async mount(host: SpaceHost): Promise<void> {
    this.host = host;
    this.cfg = host.config.satellites;
    if (!this.opts.groups.length) this.opts.groups = [this.cfg.default_group];
    this.canvas = document.createElement("canvas");
    // pick goes through the map click; this canvas must not steal HUD/map drags
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    host.front.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    host.map.on("click", this.onClick);
    host.map.on("style.load", this.onStyle);
    this.addMapLayers();
    await this.load("latest");
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.canvas.style.display = on ? "" : "none";
    const map = this.host.map;
    for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    this.groundDirty = true;
  }

  async setOptions(o: Partial<SatellitesOptions>): Promise<void> {
    const regroup = o.groups && o.groups.join() !== this.opts.groups.join();
    this.opts = { ...this.opts, ...o };
    this.groundDirty = true;
    this.ta = NaN;
    if (regroup) await this.load(this.loadedDay);
    this.host.invalidate();
  }

  select(name: string | null): void {
    const i = name === null ? null : (this.byName.get(name) ?? null);
    if (i === this.selected) return;
    this.selected = i;
    this.groundDirty = true;
    this.ta = NaN;
    this.onSelect?.(i === null ? null : this.sats[i].name);
    this.host.invalidate();
  }

  list(): SatelliteInfo[] {
    return this.sats.map((s, i) => ({
      name: s.name,
      norad: s.norad,
      group: s.group,
      kind: s.kind,
      highlighted: s.highlight,
      selected: i === this.selected,
      sensor: s.sensor?.sensor ?? null,
      band: s.sensor?.band ?? null,
      swathKm: s.sensor?.swath_km ?? null,
    }));
  }

  /** Next time the imaged strip of `name` covers the aoi centre, within 12 days of the scene clock. */
  nextPass(name: string): Pass | null {
    const i = this.byName.get(name);
    if (i === undefined || !this.aoi) return null;
    const s = this.sats[i];
    if (!s.sensor) return null;
    const now = this.host.now().getTime();
    const hit = this.passes.get(i);
    if (hit && now >= hit.from && (hit.pass ? now <= hit.pass.end.getTime() : now - hit.from < 3600_000)) return hit.pass;
    const pass = findPass(s.rec, s.sensor, this.aoi, now, PASS_HORIZON_MS);
    this.passes.set(i, { from: now, pass });
    return pass;
  }

  frame(view: SpaceView, now: Date): void {
    const t = now.getTime();
    this.maybeReload(t);
    if (!this.sats.length) return;
    this.advance(t);
    this.draw(view, t);
    this.updateGround(t);
    // a live clock keeps moving; a pinned one needs no more frames
    if (t !== this.lastNow) this.host.invalidate();
    this.lastNow = t;
  }

  destroy(): void {
    const map = this.host.map;
    map.off("click", this.onClick);
    map.off("style.load", this.onStyle);
    for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of Object.values(SRC)) if (map.getSource(id)) map.removeSource(id);
    this.canvas.remove();
    this.sats = [];
  }

  // ---- data

  private asset(file: string): string {
    return new URL(this.host.config.satellite_assets + file, new URL(import.meta.env.BASE_URL, location.href)).href;
  }

  private async fetchGroup(group: string, day: string): Promise<GroupDoc | null> {
    const q = new URLSearchParams({ group });
    if (day !== "latest") q.set("day", day);
    const doc = await fetchJson<GroupDoc>(`${this.cfg.endpoint}?${q}`);
    if (doc && Array.isArray(doc.satellites)) return doc;
    if (day !== "latest") return null;
    const snap = await fetchJson<GroupDoc>(this.asset(`gp-${group}.json`));
    return snap && Array.isArray(snap.satellites) ? snap : null;
  }

  private load(day: string): Promise<void> {
    const run = async () => {
      this.sensors ??= await fetchJson<SensorPack>(this.asset("sensors.json"));
      const groups = this.opts.groups.filter((g) => this.cfg.groups.includes(g));
      const docs = await Promise.all(groups.map((g) => this.fetchGroup(g, day)));
      if (day !== "latest" && docs.some((d) => !d)) {
        this.failedDays.add(day);
        return;
      }
      this.build(docs.filter((d): d is GroupDoc => d !== null));
      this.loadedDay = day;
    };
    this.loading = run().finally(() => {
      this.loading = null;
      this.host.invalidate();
    });
    return this.loading;
  }

  // past days use the elements archived for that day when the worker has them
  private maybeReload(t: number): void {
    if (this.loading) return;
    const want = Date.now() - t > ARCHIVE_AFTER_MS ? utcDay(t) : "latest";
    if (want === this.loadedDay || this.failedDays.has(want)) return;
    void this.load(want);
  }

  private build(docs: GroupDoc[]): void {
    const keepSelected = this.selected === null ? null : this.sats[this.selected]?.name;
    const highlight = new Set(this.cfg.highlight);
    const seen = new Set<number>();
    const sats: Sat[] = [];
    for (const doc of docs) {
      for (const d of doc.satellites) {
        // only the constellation we care about (config highlight); skip the rest of the catalog
        if (!highlight.has(d.name)) continue;
        if (seen.has(d.norad)) continue;
        let rec: SatRec;
        try {
          rec = json2satrec(d.omm);
        } catch {
          continue;
        }
        if (rec.error) continue;
        seen.add(d.norad);
        const sensor = this.matchSensor(d.norad, d.name);
        const kind = sensor?.kind ?? this.sensors?.group_kind[doc.group] ?? "comm";
        sats.push({ name: d.name, norad: d.norad, group: doc.group, rec, sensor, kind, highlight: true, period: periodMs(rec) });
      }
    }
    this.sats = sats;
    this.byName = new Map(sats.map((s, i) => [s.name, i]));
    this.selected = keepSelected ? (this.byName.get(keepSelected) ?? null) : null;
    const n = sats.length * 3;
    this.a = new Float64Array(n);
    this.b = new Float64Array(n);
    this.cur = new Float64Array(n);
    this.screen = new Float32Array(sats.length * 3);
    this.ta = this.tb = NaN;
    this.rings.clear();
    this.beams.clear();
    this.passes.clear();
    this.groundDirty = true;
  }

  private matchSensor(norad: number, name: string): Sensor | null {
    for (const e of this.sensors?.entries ?? []) if (e.match.norad?.includes(norad)) return e;
    for (const e of this.sensors?.entries ?? []) if (e.match.name && new RegExp(e.match.name).test(name)) return e;
    return null;
  }

  // ---- motion

  private featured(i: number): boolean {
    return this.sats[i].highlight || i === this.selected;
  }

  private sample(out: Float64Array, ms: number): void {
    const date = new Date(ms);
    const gmst = gstime(date);
    for (let i = 0; i < this.sats.length; i++) {
      const pv = propagate(this.sats[i].rec, date);
      const o = i * 3;
      if (!pv) {
        out[o] = out[o + 1] = out[o + 2] = NaN;
        continue;
      }
      // geodetic, so a satellite sits exactly over its ground track on the sphere
      const g = eciToGeodetic(pv.position, gmst);
      const e = lonLatToEcef(g.longitude / DEG, g.latitude / DEG, g.height);
      out[o] = e[0];
      out[o + 1] = e[1];
      out[o + 2] = e[2];
    }
  }

  private advance(t: number): void {
    if (!(t >= this.ta && t <= this.tb + STEP_MS)) {
      this.sample(this.a, t);
      this.ta = t;
      this.sample(this.b, t + STEP_MS);
      this.tb = t + STEP_MS;
      this.refreshFeatured(t);
    } else if (t > this.tb) {
      [this.a, this.b] = [this.b, this.a];
      this.ta = this.tb;
      this.tb = this.ta + STEP_MS;
      this.sample(this.b, this.tb);
      this.refreshFeatured(t);
    }
    const f = (t - this.ta) / (this.tb - this.ta);
    for (let k = 0; k < this.cur.length; k++) this.cur[k] = this.a[k] + (this.b[k] - this.a[k]) * f;
  }

  // orbit rings and radar beams of the featured satellites, at sample rate
  private refreshFeatured(t: number): void {
    for (const k of this.rings.keys()) if (!this.featured(k)) this.rings.delete(k);
    this.beams.clear();
    for (let i = 0; i < this.sats.length; i++) {
      if (!this.featured(i)) continue;
      const s = this.sats[i];
      const ring = this.rings.get(i);
      if (this.opts.tracks && (!ring || Math.abs(t - ring.at) > RING_REBAKE_MS)) this.rings.set(i, this.bakeRing(s, t));
      if (this.opts.swath && s.sensor) {
        const tr = sampleTrack(s.rec, t - 1000, t + 1000, 1000);
        const mid = tr[1];
        const edges = mid && swathEdges(s.sensor, mid.h);
        if (edges) {
          this.beams.set(
            i,
            edges.map((g) => {
              const c = Math.cos(g);
              const n = Math.sin(g);
              return [mid.s[0] * c + mid.left[0] * n, mid.s[1] * c + mid.left[1] * n, mid.s[2] * c + mid.left[2] * n] as [number, number, number];
            }),
          );
        }
      }
    }
  }

  private bakeRing(s: Sat, t: number): Ring {
    const pts = new Float64Array(RING_SAMPLES * 3).fill(NaN);
    const gmst = gstime(new Date(t));
    for (let k = 0; k < RING_SAMPLES; k++) {
      const pv = propagate(s.rec, new Date(t + (k / RING_SAMPLES - 0.5) * s.period));
      if (!pv) continue;
      // inertial orbit frozen at the earth orientation of `t`
      const g = eciToGeodetic(pv.position, gmst);
      const e = lonLatToEcef(g.longitude / DEG, g.latitude / DEG, g.height);
      pts.set(e, k * 3);
    }
    return { at: t, gmst, pts };
  }

  // ---- drawing

  private project(view: SpaceView, x: number, y: number, z: number, out: Float32Array, o: number): boolean {
    const m = view.viewProj;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!(w > 0)) return false;
    out[o] = (((m[0] * x + m[4] * y + m[8] * z + m[12]) / w + 1) / 2) * view.width;
    out[o + 1] = ((1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w) / 2) * view.height;
    return true;
  }

  private hidden(view: SpaceView, x: number, y: number, z: number): boolean {
    this.p[0] = x;
    this.p[1] = y;
    this.p[2] = z;
    return occludedByEarth(view.eye, this.p);
  }

  private draw(view: SpaceView, t: number): void {
    const pr = view.pixelRatio;
    const w = Math.round(view.width * pr);
    const h = Math.round(view.height * pr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const ctx = this.ctx;
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    if (this.opts.tracks) this.drawRings(view, t);
    if (this.opts.swath) this.drawBeams(view);
    this.drawPoints(view, t);
    this.pulseGroundTrack(t);
  }

  private drawRings(view: SpaceView, t: number): void {
    const ctx = this.ctx;
    const xy = this.xy;
    const gmst = gstime(new Date(t));
    const reduced = reducedMotionOn();
    const lowZ = this.host.map.getZoom() < 6;
    const pulse = nisarPulse(t, reduced);
    for (const [i, ring] of this.rings) {
      // the ring was frozen at ring.gmst; turn it with the earth since then
      const rot = ring.gmst - gmst;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const sat = this.sats[i];
      const nisar = isNisar(sat.name);
      ctx.strokeStyle = satColor(sat.name, sat.kind);
      // NISAR late en orbita/poco zoom; el resto de highlights queda mas quieto
      const baseW = nisar ? (lowZ ? 1.4 + 0.8 * pulse : 1.5) : i === this.selected ? 1.35 : 0.9;
      ctx.lineWidth = baseW;
      for (const pass of [true, false]) {
        const bright = nisar ? (lowZ ? 0.55 + 0.4 * pulse : 0.85) : 0.45;
        ctx.globalAlpha = pass ? bright : bright * 0.18;
        ctx.beginPath();
        let open = false;
        for (let k = 0; k <= RING_SAMPLES; k++) {
          const o = (k % RING_SAMPLES) * 3;
          const x0 = ring.pts[o];
          const y0 = ring.pts[o + 1];
          const z = ring.pts[o + 2];
          const x = x0 * c - y0 * s;
          const y = x0 * s + y0 * c;
          if (Number.isNaN(z) || this.hidden(view, x, y, z) === pass || !this.project(view, x, y, z, xy, 0)) {
            open = false;
            continue;
          }
          if (open) ctx.lineTo(xy[0], xy[1]);
          else ctx.moveTo(xy[0], xy[1]);
          open = true;
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawBeams(view: SpaceView): void {
    const ctx = this.ctx;
    const xy = this.xy;
    for (const [i, edges] of this.beams) {
      const o = i * 3;
      const x = this.cur[o];
      const y = this.cur[o + 1];
      const z = this.cur[o + 2];
      if (Number.isNaN(x) || this.hidden(view, x, y, z) || !this.project(view, x, y, z, xy, 0)) continue;
      if (!this.project(view, ...edges[0], xy, 2) || !this.project(view, ...edges[1], xy, 4)) continue;
      const sat = this.sats[i];
      ctx.fillStyle = satColor(sat.name, sat.kind);
      ctx.globalAlpha = isNisar(sat.name) ? 0.22 : 0.1;
      ctx.beginPath();
      ctx.moveTo(xy[0], xy[1]);
      ctx.lineTo(xy[2], xy[3]);
      ctx.lineTo(xy[4], xy[5]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawPoints(view: SpaceView, t: number): void {
    const ctx = this.ctx;
    const scr = this.screen;
    const labels: number[] = [];
    const reduced = reducedMotionOn();
    const lowZ = this.host.map.getZoom() < 6;
    const pulse = nisarPulse(t, reduced);
    let color = "";
    for (let i = 0; i < this.sats.length; i++) {
      const o = i * 3;
      const x = this.cur[o];
      const y = this.cur[o + 1];
      const z = this.cur[o + 2];
      scr[o + 2] = 0;
      if (Number.isNaN(x) || !this.project(view, x, y, z, scr, o) || this.hidden(view, x, y, z)) continue;
      scr[o + 2] = 1;
      const s = this.sats[i];
      const big = this.featured(i);
      const nisar = isNisar(s.name);
      const c = satColor(s.name, s.kind);
      if (c !== color) ctx.fillStyle = color = c;
      if (big) {
        const r = nisar
          ? (lowZ ? 3.2 + 1.6 * pulse : 4)
          : i === this.selected
            ? 3.8
            : 2.8;
        if (nisar && lowZ && !reduced) {
          ctx.globalAlpha = 0.25 + 0.35 * pulse;
          ctx.beginPath();
          ctx.arc(scr[o], scr[o + 1], r + 3.5 * pulse, 0, 2 * Math.PI);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
        }
        ctx.beginPath();
        ctx.arc(scr[o], scr[o + 1], r, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = nisar ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)";
        ctx.lineWidth = nisar ? 1.4 : 1;
        ctx.stroke();
        labels.push(i);
      } else ctx.fillRect(scr[o] - 1.25, scr[o + 1] - 1.25, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    if (!this.opts.labels) return;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const i of labels) {
      const o = i * 3;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(this.sats[i].name, scr[o] + 8, scr[o + 1]);
      ctx.fillStyle = "#fff";
      ctx.fillText(this.sats[i].name, scr[o] + 8, scr[o + 1]);
    }
  }

  private pick(x: number, y: number): void {
    if (!this.visible) return;
    let best = -1;
    let bestD = PICK_PX * PICK_PX;
    for (let i = 0; i < this.sats.length; i++) {
      const o = i * 3;
      if (!this.screen[o + 2]) continue;
      const d = (this.screen[o] - x) ** 2 + (this.screen[o + 1] - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) this.select(this.sats[best].name);
  }

  // ---- ground layers

  private addMapLayers(): void {
    const map = this.host.map;
    try {
      for (const id of Object.values(SRC)) if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty() });
    } catch {
      // style not loaded yet; style.load calls back
      return;
    }
    const vis = this.visible ? "visible" : "none";
    const add = (spec: maplibregl.LayerSpecification) => {
      if (!map.getLayer(spec.id)) map.addLayer(spec);
    };
    add({ id: "tw-sat-swath", type: "fill", source: SRC.swath, layout: { visibility: vis }, paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "alpha"], "fill-antialias": false } });
    add({ id: "tw-sat-footprint-fill", type: "fill", source: SRC.footprint, layout: { visibility: vis }, paint: { "fill-color": ["get", "color"], "fill-opacity": 0.07 } });
    add({ id: "tw-sat-footprint-line", type: "line", source: SRC.footprint, layout: { visibility: vis }, paint: { "line-color": ["get", "color"], "line-width": 1.2, "line-opacity": 0.8, "line-dasharray": [3, 2] } });
    add({
      id: "tw-sat-track",
      type: "line",
      source: SRC.track,
      layout: { visibility: vis, "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["case", ["get", "nisar"], 2.2, ["case", ["get", "next"], 1.35, 0.85]],
        "line-opacity": ["case", ["get", "nisar"], 0.92, ["case", ["get", "next"], 0.55, 0.22]],
      },
    });
    this.groundDirty = true;
  }

  private setData(id: string, data: GeoJSON.FeatureCollection): void {
    (this.host.map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data);
  }

  private updateGround(t: number): void {
    const wall = performance.now();
    const jumped = Math.abs(t - this.groundAt) > 60_000;
    if (!this.groundDirty && !jumped && (t === this.groundAt || wall - this.groundWall < GROUND_MS)) return;
    this.groundDirty = false;
    this.groundAt = t;
    this.groundWall = wall;
    const track = empty();
    const swath = empty();
    const foot = empty();
    if (this.visible) {
      for (let i = 0; i < this.sats.length; i++) if (this.featured(i)) this.groundFor(i, t, track, swath);
      if (this.opts.footprint && this.selected !== null) this.footprintFor(this.selected, t, foot);
    }
    this.setData(SRC.track, track);
    this.setData(SRC.swath, swath);
    this.setData(SRC.footprint, foot);
  }

  private groundFor(i: number, t: number, track: GeoJSON.FeatureCollection, swath: GeoJSON.FeatureCollection): void {
    const s = this.sats[i];
    const color = satColor(s.name, s.kind);
    const nisar = isNisar(s.name);
    const samples = sampleTrack(s.rec, t - s.period, t + s.period, TRACK_STEP_MS);
    if (this.opts.tracks) {
      for (const next of [false, true]) {
        const part = samples.filter((p) => (next ? p.t >= t - TRACK_STEP_MS : p.t <= t));
        const lines = splitLine(part.map((p) => toLonLat(p.s)));
        if (lines.length) {
          track.features.push({
            type: "Feature",
            properties: { color, next, nisar },
            geometry: { type: "MultiLineString", coordinates: lines },
          });
        }
      }
    }
    const edges = this.opts.swath && s.sensor ? swathEdges(s.sensor, samples[0]?.h ?? 0) : null;
    if (!edges) return;
    // half an orbit behind, a full one ahead, fading with distance from now
    const strip = samples.filter((p) => p.t >= t - s.period / 2);
    const quads = swathQuads(strip, edges);
    const bins: GeoJSON.Position[][][][] = Array.from({ length: SWATH_BINS }, () => []);
    quads.forEach((q, k) => {
      const dt = Math.abs(strip[k].t - t) / s.period;
      bins[Math.min(SWATH_BINS - 1, Math.floor(dt * SWATH_BINS))].push([q]);
    });
    bins.forEach((polys, b) => {
      if (polys.length) swath.features.push({ type: "Feature", properties: { color, alpha: 0.42 * (1 - b / SWATH_BINS) }, geometry: { type: "MultiPolygon", coordinates: polys } });
    });
  }

  private footprintFor(i: number, t: number, foot: GeoJSON.FeatureCollection): void {
    const g = subpoint(this.sats[i].rec, t);
    if (!g) return;
    const ring = footprintRing(g.lon, g.lat, footprintAngle(g.h, this.cfg.min_elevation_deg));
    const s = this.sats[i];
    foot.features.push({
      type: "Feature",
      properties: { color: satColor(s.name, s.kind) },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }

  /** pulso de ancho/opacidad del ground track NISAR en orbita / poco zoom */
  private pulseGroundTrack(t: number): void {
    const map = this.host.map;
    if (!map.getLayer("tw-sat-track")) return;
    const reduced = reducedMotionOn();
    const lowZ = map.getZoom() < 6;
    const pulse = nisarPulse(t, reduced);
    const nisarW = lowZ && !reduced ? 1.4 + 1.2 * pulse : 2.2;
    const nisarA = lowZ && !reduced ? 0.5 + 0.45 * pulse : 0.92;
    map.setPaintProperty("tw-sat-track", "line-width", [
      "case",
      ["get", "nisar"],
      nisarW,
      ["case", ["get", "next"], 1.35, 0.85],
    ]);
    map.setPaintProperty("tw-sat-track", "line-opacity", [
      "case",
      ["get", "nisar"],
      nisarA,
      ["case", ["get", "next"], 0.55, 0.22],
    ]);
  }
}
