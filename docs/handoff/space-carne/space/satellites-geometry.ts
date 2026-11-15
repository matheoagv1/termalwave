import { ecfToLookAngles, eciToEcf, eciToGeodetic, geodeticToEcf, gstime, propagate, type SatRec } from "satellite.js";
import { EARTH_RADIUS_KM } from "./camera";

// orbit math for the satellites layer: subpoints, sensor swaths, radio
// footprints and passes over a target; no map or dom access here

export type SensorKind = "sar" | "optical" | "weather" | "comm" | "crew";
export type LookSide = "left" | "right";

/** One entry of public/satellites/sensors.json. */
export interface Sensor {
  id: string;
  label: string;
  operator: string | null;
  kind: SensorKind;
  band: string | null;
  sensor: string | null;
  mode: string | null;
  swath_km: number | null;
  look?: LookSide;
  incidence_deg?: [number, number];
  altitude_km?: number;
  repeat_days?: number;
}

export interface Bounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface Pass {
  start: Date;
  end: Date;
  /** elevation of the satellite seen from the target at closest approach, degrees */
  maxElevation: number;
  /** radar incidence on the target, degrees (sar only) */
  incidence: number | null;
}

type Vec3 = [number, number, number];
type LonLat = [number, number];

const DEG = Math.PI / 180;
const EARTH_RATE = 7.292115e-5; // rad/s
const PASS_STEP_MS = 60_000;

export function periodMs(rec: SatRec): number {
  // no: mean motion, rad/min
  return ((2 * Math.PI) / rec.no) * 60_000;
}

/** Geodetic subpoint; null when sgp4 has no state (decayed or bad elements). */
export function subpoint(rec: SatRec, ms: number): { lon: number; lat: number; h: number } | null {
  const date = new Date(ms);
  const pv = propagate(rec, date);
  if (!pv) return null;
  const g = eciToGeodetic(pv.position, gstime(date));
  if (!Number.isFinite(g.height)) return null;
  return { lon: g.longitude / DEG, lat: g.latitude / DEG, h: g.height };
}

/** Earth-fixed position (km) and ground-relative velocity (km/s). */
function stateEcf(rec: SatRec, ms: number): { r: Vec3; v: Vec3 } | null {
  const date = new Date(ms);
  const pv = propagate(rec, date);
  if (!pv) return null;
  const gmst = gstime(date);
  const r = eciToEcf(pv.position, gmst);
  const v = eciToEcf(pv.velocity, gmst);
  return { r: [r.x, r.y, r.z], v: [v.x + EARTH_RATE * r.y, v.y - EARTH_RATE * r.x, v.z] };
}

function unit(lon: number, lat: number): Vec3 {
  const c = Math.cos(lat * DEG);
  return [c * Math.cos(lon * DEG), c * Math.sin(lon * DEG), Math.sin(lat * DEG)];
}

export function toLonLat(p: Vec3): LonLat {
  return [Math.atan2(p[1], p[0]) / DEG, Math.asin(Math.max(-1, Math.min(1, p[2]))) / DEG];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// earth central angle between nadir and the ground point seen at incidence `inc`
function groundAngle(incDeg: number, hKm: number): number {
  const inc = incDeg * DEG;
  return inc - Math.asin((EARTH_RADIUS_KM / (EARTH_RADIUS_KM + hKm)) * Math.sin(inc));
}

/**
 * Cross-track edges of the imaged strip as signed earth central angles
 * (positive = left of the ground track). sar strips sit on the look side,
 * centred on the incidence range; nadir sensors are centred on the track.
 */
export function swathEdges(s: Sensor, hKm: number): [number, number] | null {
  if (!s.swath_km || s.swath_km <= 0) return null;
  const half = s.swath_km / 2 / EARTH_RADIUS_KM;
  if (s.kind !== "sar") return [-half, half];
  if (!s.look || !s.incidence_deg) return null;
  const centre = (groundAngle(s.incidence_deg[0], hKm) + groundAngle(s.incidence_deg[1], hKm)) / 2;
  const sign = s.look === "left" ? 1 : -1;
  return [sign * (centre - half), sign * (centre + half)];
}

/** Half-angle of the ground circle that sees the satellite above `minElevDeg`. */
export function footprintAngle(hKm: number, minElevDeg: number): number {
  const e = minElevDeg * DEG;
  return Math.acos((EARTH_RADIUS_KM / (EARTH_RADIUS_KM + hKm)) * Math.cos(e)) - e;
}

/**
 * Subpoints every `stepMs` over [fromMs, toMs]. `left` is the unit vector to
 * the left of the motion, so strips can be offset across the track.
 */
export function sampleTrack(rec: SatRec, fromMs: number, toMs: number, stepMs: number): { t: number; s: Vec3; left: Vec3; h: number }[] {
  const pts: { t: number; s: Vec3; h: number }[] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    const g = subpoint(rec, t);
    if (g) pts.push({ t, s: unit(g.lon, g.lat), h: g.h });
  }
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)].s;
    const b = pts[Math.min(pts.length - 1, i + 1)].s;
    const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const k = dot(d, p.s);
    const v = normalize([d[0] - k * p.s[0], d[1] - k * p.s[1], d[2] - k * p.s[2]]);
    return { ...p, left: cross(p.s, v) };
  });
}

function offset(s: Vec3, left: Vec3, g: number): LonLat {
  const c = Math.cos(g);
  const n = Math.sin(g);
  return toLonLat([s[0] * c + left[0] * n, s[1] * c + left[1] * n, s[2] * c + left[2] * n]);
}

// shift lon by whole turns so it lies within 180 deg of ref
function near(lon: number, ref: number): number {
  return lon - 360 * Math.round((lon - ref) / 360);
}

/**
 * Antimeridian-safe polyline: longitudes are unwrapped and the line restarts
 * one turn back once it leaves [-180, 180]; maplibre wraps the overhang.
 */
export function splitLine(pts: LonLat[]): LonLat[][] {
  const out: LonLat[][] = [];
  let line: LonLat[] = [];
  let prev: LonLat | null = null;
  for (const p of pts) {
    if (!prev) {
      line.push(p);
      prev = p;
      continue;
    }
    const lon = near(p[0], prev[0]);
    line.push([lon, p[1]]);
    if (Math.abs(lon) > 180) {
      out.push(line);
      const shift = lon > 0 ? -360 : 360;
      line = [[prev[0] + shift, prev[1]], [lon + shift, p[1]]];
      prev = [lon + shift, p[1]];
    } else prev = [lon, p[1]];
  }
  if (line.length > 1) out.push(line);
  return out;
}

/** Strip quads between consecutive samples, each unwrapped around its own first corner. */
export function swathQuads(track: ReturnType<typeof sampleTrack>, edges: [number, number]): LonLat[][] {
  const quads: LonLat[][] = [];
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    const q = [offset(a.s, a.left, edges[0]), offset(b.s, b.left, edges[0]), offset(b.s, b.left, edges[1]), offset(a.s, a.left, edges[1])];
    const ref = q[0][0];
    const ring = q.map(([lon, lat]) => [near(lon, ref), lat] as LonLat);
    ring.push(ring[0]);
    quads.push(ring);
  }
  return quads;
}

/** Ground circle around a subpoint; closes over the pole when it contains one. */
export function footprintRing(lon: number, lat: number, angle: number, steps = 128): LonLat[] {
  const s = unit(lon, lat);
  const east = normalize(cross([0, 0, 1], s));
  const north = cross(s, east);
  const ring: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const b = (i / steps) * 2 * Math.PI;
    const dir: Vec3 = [north[0] * Math.cos(b) + east[0] * Math.sin(b), north[1] * Math.cos(b) + east[1] * Math.sin(b), north[2] * Math.cos(b) + east[2] * Math.sin(b)];
    const p = offset(s, dir, angle);
    ring.push(ring.length ? [near(p[0], ring[ring.length - 1][0]), p[1]] : [near(p[0], lon), p[1]]);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(last[0] - first[0]) > 180) {
    // the bearing sweep went once around the pole: close the ring along it
    const pole = lat > 0 ? 90 : -90;
    ring.push([last[0], pole], [first[0], pole], first);
  } else ring[ring.length - 1] = first;
  return ring;
}

/**
 * First pass within `horizonMs` whose imaged strip covers the centre of
 * `aoi`. Uses zero-doppler geometry: the target is broadside when the line
 * of sight is normal to the ground-relative velocity. Strip start/end are the
 * broadside times of the aoi corners.
 */
export function findPass(rec: SatRec, sensor: Sensor, aoi: Bounds, fromMs: number, horizonMs: number): Pass | null {
  const centre = target((aoi.west + aoi.east) / 2, (aoi.south + aoi.north) / 2);
  const corners = [
    target(aoi.west, aoi.south),
    target(aoi.east, aoi.south),
    target(aoi.east, aoi.north),
    target(aoi.west, aoi.north),
  ];
  let prev = doppler(rec, centre.ecf, fromMs);
  for (let t = fromMs + PASS_STEP_MS; t <= fromMs + horizonMs; t += PASS_STEP_MS) {
    const cur = doppler(rec, centre.ecf, t);
    if (prev !== null && cur !== null && prev > 0 && cur <= 0) {
      const tc = broadside(rec, centre.ecf, t - PASS_STEP_MS, t);
      const hit = covers(rec, sensor, centre, tc);
      if (hit) {
        const times = corners.map((c) => broadside(rec, c.ecf, tc - PASS_STEP_MS, tc + PASS_STEP_MS));
        return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)), maxElevation: hit.elevation, incidence: sensor.kind === "sar" ? 90 - hit.elevation : null };
      }
    }
    prev = cur;
  }
  return null;
}

interface Target {
  gd: { longitude: number; latitude: number; height: number };
  ecf: Vec3;
}

function target(lon: number, lat: number): Target {
  const gd = { longitude: lon * DEG, latitude: lat * DEG, height: 0 };
  const e = geodeticToEcf(gd);
  return { gd, ecf: [e.x, e.y, e.z] };
}

// line of sight dotted with ground velocity: positive while the target is ahead
function doppler(rec: SatRec, p: Vec3, ms: number): number | null {
  const st = stateEcf(rec, ms);
  if (!st) return null;
  return dot([p[0] - st.r[0], p[1] - st.r[1], p[2] - st.r[2]], st.v);
}

function broadside(rec: SatRec, p: Vec3, lo: number, hi: number): number {
  for (let i = 0; i < 20 && hi - lo > 200; i++) {
    const mid = (lo + hi) / 2;
    const d = doppler(rec, p, mid);
    if (d === null) break;
    if (d > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// same strip as the map draws: signed cross-track angle of the target at broadside
function covers(rec: SatRec, s: Sensor, t: Target, ms: number): { elevation: number } | null {
  const st = stateEcf(rec, ms);
  if (!st) return null;
  const elevation = ecfToLookAngles(t.gd, { x: st.r[0], y: st.r[1], z: st.r[2] }).elevation / DEG;
  if (elevation <= 0) return null;
  const rKm = Math.hypot(st.r[0], st.r[1], st.r[2]);
  const edges = swathEdges(s, rKm - EARTH_RADIUS_KM);
  if (!edges) return null;
  const angle = Math.acos(Math.min(1, dot(normalize(st.r), normalize(t.ecf))));
  // angular momentum (r x v) points to the left of the motion
  const signed = dot(cross(st.r, st.v), t.ecf) > 0 ? angle : -angle;
  return signed >= Math.min(edges[0], edges[1]) && signed <= Math.max(edges[0], edges[1]) ? { elevation } : null;
}
